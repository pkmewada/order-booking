# SAP Phase 1 plan: orders, dispatch and delivery to MySQL

**Status:** revision 2 approved (2026-11-12). **Implemented locally** on branch `sap_integration` (not committed, pushed or deployed). See section 14 for the outcome and the differences from this plan. Passages superseded by the owner's security clarification are marked *(superseded)*.

| | |
| --- | --- |
| Branch | `sap_integration` (local; nothing committed or pushed) |
| Base commit | `6ee8500` |
| Revised | 2026-11-12 |
| Progress tracking | `docs/SAP_INTEGRATION.md` |

## 0. Owner decisions and requirements (fixed inputs)

| Ref | Decision / requirement |
| --- | --- |
| D1 | Edit, delete **and status change** are allowed only before Pass to Dispatch, enforced on the server |
| D2 | Delivery PDF limit is 10 MB |
| D3 | Build locally now. **Authentication and API authorization are mandatory before any live deployment** |
| R1 | Migrations run through an explicit CLI step, never from a public request. Success is verified before the new APIs work. Migrations are safe to run twice |
| R2 | Order import and PDF import are tracked separately. A failed PDF upload can be retried without importing the order again. Browser data is never deleted. Conflicts stay visible and are never overwritten |
| R3 | MySQL transactions and row locks, proven by genuinely concurrent tests (independent processes and connections) for scans, deliveries and PDF passes |
| R4 | PDFs are checked on the server (upload error, size, MIME type, signature) and stored safely outside the web root where possible. Downloads are private and not cached. Direct access is denied and tested. Orphaned files are cleaned up |
| R5 | Order ID collisions are handled. The test runner cannot reach a production database. A missing PDF looks different from a completed delivery. Rollback and restore are tested |
| R6 | Existing PHP/PDO/MySQL/jQuery architecture, with no new dependencies. `productionEngine.js`, manufacturing, inventory, invoices and payments are not touched. All 14 existing tests keep passing |

## 0.1 Skills applied

| Skill | Status | Guidance used in this plan |
| --- | --- | --- |
| `karpathy-guidelines` (Andrej Karpathy) | Available, read | Minimal code, no speculative abstractions, change only what the task needs (section 5), a check for every step (section 13) |
| `mysql-patterns` (ECC) | Available, read | Check engine and version first (H9). UTC `DATETIME` set by the app. Short transactions with locks always taken in the same order. No file or external work inside a transaction. Bounded retry on deadlock. Indexed foreign keys. Avoid MySQL-only syntax so MariaDB also works. Least-privilege runtime user, separate from the migration user (H3) |
| `database-migrations` (ECC) | Available, read | Forward-only in production. Schema changes kept separate from data import. A migration is never edited after it has been deployed. A `down` script exists for local and test rollback only. Documented rollback |
| `strategic-compact` (ECC) | Available, not relevant | |
| ECC `security-review`, `backend-patterns` | **Not installed** (they are only mentioned by the ECC skills above) | Security rules were taken from the owner's requirements and existing project practice |

## 1. What the code does today (verified)

| Page (route) | Script(s) | Storage today |
| --- | --- | --- |
| Order Punch (`order-punch`, `?id=` for edit) | `orderPunch.js`, `orderQuantities.js` | Writes localStorage `orders`. Reads the `customers`, `agents`, `transporters`, `distributors` and `products` caches |
| Order List (`order-list`) | `orderList.js`, `orderPdf.js`, `orderDetails.js` | `orders` (status toggle, delete, Pass to Dispatch) |
| Dispatch (`dispatch`) | `dispatch.js`, `dispatchFlow.js` | `orders` (scan, Replace design, pass sets to delivery). Reads the `products` cache |
| Delivery (`delivery`) | `delivery.js`, `deliveryRecords.js`, `orderDetails.js`, `orderPdf.js` | `orders`. PDFs in IndexedDB `order-booking-delivery-pdfs` / store `pdfs` |

**The order object stored today:**
- **Order fields:**
  - identity and status: `id` (`ORD<ms>`), `status`, `createdAt`, `updatedAt`
  - customer snapshot: `customerId`, `customerName`, `shopName`, `city`, `contact`, `existingCustomer`
  - linked masters: `agentId`/`agentName`, `transporterId`/`transportName`, `distributorId`
  - delivery date: `deliveryDate`
  - totals: `totalSets`, `totalPcs`
  - dispatch: `dispatchPassedAt`, `dispatchStatus`, `dispatchConfirmedAt`, `dispatchCompletedAt`, `dispatchConfirmedItems`
  - delivery: `deliveredAt`, `deliveryStatus`
  - read only by the PDF and details views: `orderTakenBy`
- **`items[]` (each line):**
  - product snapshot: `barcode`, `description`, `designNumber`, `brand`, `size`, `color`
  - set size and quantity: `piecesPerSet`, `qty` (sets)
  - dispatch progress: `dispatchScannedPieces`, `dispatchDeliveredPieces`, `dispatchChecked`
  - older orders may use `itemCode` or `itemDescription`
- **`deliveryBatches[]` (each delivery):** `id` (`DLV-<orderId>-<ms>[-n]`), `createdAt`, `status`, `completedAt`, `items[]` (snapshot plus `sets`, `pieces`), and `pdf {key, name, size, uploadedAt}`.
- **Older orders** with `deliveredAt` but no batches get a generated batch `DLV-LEGACY-<orderId>`.

**Business rules to keep (`orderQuantities.js` / `dispatchFlow.js`):**
- **Sets:** set size by brand (Little Dolly 5, Amari 3, Nivi Blossom 4, otherwise the stored value). Pieces = sets × per set.
- **Lifecycle:** Order List shows orders not yet passed. Pass to Dispatch keeps the first timestamp.
- **Scanning:** one scan adds 1 piece to the first unfinished line with that barcode, up to the ordered pieces. Scanning is blocked after full delivery.
- **Passing to delivery:** whole sets only, up to *scanned minus delivered*, and one batch per pass.
- **Replace design:** the product must not already be in the order. Passed sets stay on the old line and the remaining sets move to a new line. A line with a partial set already passed cannot be replaced.
- **Delivery Pass:** the file must be a real PDF, and each batch is passed once.

**Not affected:** order pages never use production keys or inventory, so `productionEngine.js` is not involved. There is no invoice or payment code.

**Problems found:**
- Order Punch, Order Details and Replace read customers and products from caches that are filled only by other pages, so a new PC sees no customers.
- Some values are inserted into HTML without escaping.
- `order-punch?id=` can edit an order that has already been passed to dispatch, which resets its scan progress.

## 2. Design

1. **The server is the source of truth.** The API returns orders in the **same JSON shape** as today, so pages change only where they read and write data. `orderQuantities.js` and `dispatchFlow.js` stay unchanged and are used for display.
2. **Every business rule and validation runs on the server** in `api/order-records.php`. The rules mirror `OrderQuantities`/`DispatchFlow`, and a parity test proves they agree. The browser checks only improve the messages users see.
3. **Transactions and locks:** every change runs in one short transaction that locks rows in a fixed order: **order row (`SELECT … FOR UPDATE`) → its item rows → its batch rows.** This serializes all changes to the same order. The quantity updates are also conditional. For example, `UPDATE … SET dispatchScannedPieces = dispatchScannedPieces + 1 WHERE id = ? AND dispatchScannedPieces < ?` must change exactly 1 row. Deadlock and lock-wait errors (1213/1205) are retried up to 3 times. No file work happens inside a transaction.
4. **Stale and duplicate protection:** each order has a `version`. Edit, status, delete, Replace and pass-to-delivery requests send the version the page showed. A mismatch returns **409** ("Order changed in another session. Reload."). Scans lock the order but don't check the version, because each scan is a physical event and must not be rejected because of another device. Scans can never go above the ordered pieces.
5. **IDs keep today's formats:**
   - `ORD<ms>`: the server tries the current millisecond. On a duplicate key (MySQL error 1062) it moves to the next millisecond and retries, up to 50 times, then returns 503. Imported IDs share the same primary key, so they also count as collisions.
   - `DLV-<orderId>-<ms>[-n]` and `DLV-LEGACY-<orderId>` stay as they are.
6. **Timestamps** are written from PHP in UTC (`DATETIME(3)`) and returned in ISO 8601 with a trailing `Z`.
7. **Access before login (fails closed):** *(superseded: the same-machine IP check proposed here was replaced by the owner's clarification of 2026-11-12)*.
   - Unauthenticated access is allowed only through an explicit local-development configuration: `APP_ENV=development` **and** `ORDERS_ALLOW_UNAUTHENTICATED_DEV=1`, set only by `npm run dev`.
   - Every other environment, including production, gets **401**.
   - No IP, `Origin` or random-URL check is used as a substitute for authentication.
   - The local PHP server binds to `127.0.0.1`.
   - Login, session security, API authorization and CSRF protection are mandatory before live deployment.
8. **Existing conventions:** PDO prepared statements, `{success, data}` / `{success:false, message}` responses, the `respond()` helper from `master-records.php`, logic in `api/*-records.php` with thin endpoint files, and lower camelCase table names. No new libraries.

## 3. Database and migrations

### 3.1 Tables (only new tables; nothing existing is altered)

| Table | Key columns | Notes |
| --- | --- | --- |
| `customerOrders` | `id` VARCHAR(40) PK, `status`, customer and agent snapshot columns, `orderTakenBy`, `deliveryDate` DATE, `totalSets`, `totalPcs`, dispatch and delivery fields, `version` INT UNSIGNED, `createdAt`, `updatedAt` DATETIME(3), `legacyData` LONGTEXT NULL, `legacyHash` CHAR(64) NULL, `importedAt` NULL | No foreign key to `customerRecords`: orders keep a customer snapshot, as they do today. Indexes on `createdAt`, `dispatchPassedAt`, `customerId` |
| `customerOrderItems` | `id` BIGINT UNSIGNED AI PK, `orderId` FK (CASCADE), `sortOrder`, item snapshot, `piecesPerSet`, `qty`, `dispatchScannedPieces`, `dispatchDeliveredPieces`, `dispatchChecked` | Index on `(orderId, sortOrder)` |
| `deliveryBatches` | `id` VARCHAR(80) PK, `orderId` FK (RESTRICT), `status`, `createdAt`, `completedAt`, `isLegacy`, `pdfState` (`none` / `stored` / `missing`), `pdfFile` NULL UNIQUE, `pdfName`, `pdfSize`, `pdfSha256`, `pdfUploadedAt` | `missing` means imported metadata says a PDF existed but the server has no file yet (section 6) |
| `deliveryBatchItems` | `id` AI PK, `batchId` FK (CASCADE), `orderItemId` NULL, snapshot, `sets`, `pieces` | |

All tables are InnoDB, utf8mb4_unicode_ci. The rules are enforced in PHP, not with `CHECK` constraints (older MySQL and MariaDB ignore those) or `ENUM`. The SQL avoids MySQL-only syntax, so it also runs on MariaDB (H9).

### 3.2 Explicit CLI migration (R1)

- **Migration files:**
  - New folder `database/cli-migrations/`: `<yyyymmdd>_001_customer-orders.sql` (up) and `<yyyymmdd>_001_customer-orders.down.sql` (**local and test only**).
  - The existing automatic runner in `includes/db.php` only reads `database/migrations/*.sql`, so it **never** picks these up. `includes/db.php` is not modified.
- **New `cli/orders-admin.php`** (`cli/.htaccess` = `Require all denied`; the script also exits unless `PHP_SAPI === 'cli'`):

  | Command | What it does |
  | --- | --- |
  | `migrate` | Takes `GET_LOCK`, runs pending up-files in order (each uses `CREATE TABLE IF NOT EXISTS`, so running it twice is safe), then runs `verify`. **Only if verify passes** does it record `cli/<file>` in `appSchemaMigrations`. Prints the DB engine and version |
  | `verify` | Checks via `information_schema` that every table, column, index and foreign key exists. Exit code 0 means OK |
  | `status` | Lists applied and pending migrations |
  | `export <dir>` / `restore <dir>` | Section 10 |
  | `orphans [--delete]` | Section 8 |
  | `down` | Runs the down-file. **Refused** unless the database name ends in `_test` and the host is `127.0.0.1` or `localhost` |

- **Ready check:** every new API first checks that the migration marker exists. If it doesn't, it returns 503 ("Orders database not migrated. Run `php cli/orders-admin.php migrate`.") and changes nothing. The new APIs therefore stay disabled until the migration has been verified.
- **Schema file:** the same DDL is also added to `database/order-booking.sql` for fresh installs. A fresh install still runs `migrate` (safe, because the tables already exist) to verify and record the marker.
- **Forward-only on live:** the live rollback never drops tables (section 10).
- **Follow-up, outside Phase 1:** the *existing* automatic runner still applies `database/migrations/*.sql` on public requests. Changing that means editing `includes/db.php`, which is frozen until the Hostinger setup is confirmed. This is recorded in `SAP_INTEGRATION.md`.

## 4. API (all rules on the server, R4/R5)

**`api/orders.php`** (thin) uses **`api/order-records.php`**.

| Method / action | Input | Server rules |
| --- | --- | --- |
| `GET` / `GET ?id=` | | Orders with `items[]` and `deliveryBatches[]` in today's shape. PDF info is `{name, size, uploadedAt, state}`, with no file path |
| `POST create` | customerId, existingCustomer, deliveryDate, items[{barcode, qty}] | Customer must exist. The customer and agent snapshot comes from the database. Each barcode must exist in the product catalog (`productRows()`, `inProductList`), and the line snapshot (description, brand, size, set size) comes from the catalog. `qty` must be a whole number from 1 to 100000. At most 500 lines. A valid date. Totals are computed on the server. Collision-safe ID |
| `POST update` | id, version, same fields | Only if **not passed to dispatch** (D1). Customer snapshot is refreshed if the customer still exists, otherwise the stored one is kept. Lines already on the order keep their stored snapshot if the product has since been removed |
| `POST setStatus` | id, version, Active/Inactive | Only before pass (D1) |
| `POST delete` | id, version | Only before pass (D1). Cannot delete an order that has deliveries |
| `POST passToDispatch` | id | Safe to repeat: keeps the first timestamp |
| `POST scan` | id, barcode | Order must be passed to dispatch and not fully delivered. Conditional atomic increment (section 2.3). Same messages as today |
| `POST replaceItem` | id, version, itemId, productBarcode | Same rules as `dispatch.js`, run on the server against the catalog |
| `POST deliverPartial` | id, version, lines[{itemId, sets}] | Whole sets, 0 ≤ sets × per set ≤ scanned minus delivered, at least one set. Creates one batch and updates fields exactly as `DispatchFlow.deliverPartial` does |
| `POST import` | orders[] (raw browser objects, at most 200 per call) | Section 6 |

**`api/delivery-pdf.php`**

| Method | Purpose |
| --- | --- |
| `POST` (multipart: batchId, file) | Pass a delivery. Allowed when `pdfState = none`. Also allowed when it is `missing`, to fill a missing PDF manually |
| `POST` (… `mode=import`) | Upload a PDF from old browser data. Allowed only when `pdfState = missing` |
| `GET ?batchId=` | Download. Local dev switch now, login check later (section 2.7). Never served from a public path |

## 5. Frontend changes (minimal, file by file)

| File | Change |
| --- | --- |
| **New** `assets/js/ordersApi.js` | `fetch` wrapper in the `catalogApi.js` style, plus loaders for customers, masters and products (which still write the compatibility caches) |
| **New** `assets/js/orderImport.js` | Browser import and PDF retry (section 6) |
| `orderPunch.js` | Load masters and products from the APIs. Save through the API with the button disabled while saving. Edit loads from the API. Escape values written into HTML |
| `orderList.js` | Data from the API. Toggle, delete and pass call the API. Reload when the tab regains focus (replaces the `storage` event). Escape values. Banner listing import conflicts |
| `dispatch.js` | Scan, Replace and pass-to-delivery become API calls. Products come from the API. Reload on focus |
| `delivery.js` | Data from the API. **Status column:** `Success` (green, PDF stored), `In Progress` (blue, no PDF yet, Pass button), **`PDF missing`** (orange, imported delivery whose PDF is not on the server, with an **Upload PDF** button) |
| `deliveryRecords.js` | `pass()` uploads to the server. `downloadFile()` uses the API. The IndexedDB readers stay, used only by the import |
| 4 `orderBooking/*.php` pages | Add the two new script tags (with `filemtime` cache-busting) |
| **Unchanged** | `orderQuantities.js`, `dispatchFlow.js`, `orderPdf.js`, `orderDetails.js`, `productionEngine.js`, manufacturing, inventory, settings, `includes/db.php`, existing uploads |

## 6. Importing browser data (R2)

**Order import and PDF import are tracked separately.**

- **Server side:**
  - Each order is imported in its **own transaction**.
  - `legacyHash` is the SHA-256 of the original browser object in a fixed key order.
    - New ID: the order is inserted with its items and batches (including the `DLV-LEGACY-…` batch where today's code generates one), keeping `legacyData` and `legacyHash`. Each batch that had `pdf` metadata gets `pdfState = missing`, keeping its original name, size and upload time. Result: **imported**.
    - The ID already exists with the same `legacyHash`: **already imported**. Nothing changes, even if the server copy was edited afterwards.
    - The ID already exists with a different hash, or it belongs to a server-created order: **conflict**. Nothing is written.
    - Malformed data: **invalid**. Nothing is written.
  - Two browsers importing the same order at the same moment are serialized by the primary key and a transaction. One inserts it, the other gets *already imported* or *conflict*. There are never duplicates.
- **Browser record:** localStorage `ordersServerImport` = `{orders: {id: status}, pdfs: {batchId: status}, updatedAt}`.
- **Step A, orders:** when one of the 4 order pages loads, local orders that have no recorded status cause a prompt (**Import** / **Later**). Results are saved per order.
- **Step B, PDFs (independent):** on every page load, the server's `pdfState` is checked for each batch in an imported or already-imported order:
  - `missing`, and the browser has the file in IndexedDB: upload it (`mode=import`).
  - Uploaded: record **uploaded**.
  - The browser doesn't have the file: record **not in this browser**.
  - Network or server error: record **failed**, and retry automatically on the next page load.

  A failed PDF never imports the order again. The server only accepts an import upload while `pdfState = missing`, so a retry can never replace a stored PDF.
- **Visibility:**
  - Order List shows a banner while conflicts or invalid entries exist, with **Download local copy** (a JSON file of the browser's version), so nothing is hidden.
  - Delivery shows **PDF missing** for every batch still in `missing` state.
- **Nothing in the browser is deleted:** localStorage `orders` and the IndexedDB PDFs stay. Clean-up is a later, separate step that the owner must approve.
- **Imported orders deleted on the server later** are not offered again, because their status is already recorded.

## 7. Backward compatibility

IDs, routes, layouts, the order JSON shape and quantity calculations stay the same. A tab left open from before the deploy can still write localStorage until it is reloaded. Its new orders are then offered by the import, so nothing is lost silently. The compatibility caches for customers and masters are still written.

## 8. PDF storage and security (R4)

- **Where PDFs are stored:**
  1. `DELIVERY_PDF_DIR` environment variable: **required on live, and must be outside `public_html`** (H4).
  2. Otherwise (local), `storage/delivery-pdfs/` inside the repo. A tracked `storage/.htaccess` contains `Require all denied` and `Options -Indexes`, and `storage/delivery-pdfs/` is in `.gitignore`.

  Before each write, the API refuses to store files if the folder is inside the web root **and** `storage/.htaccess` is missing.
- **Permissions:** folder `0750`, files `0640`. File names are 32 random hex characters plus `.pdf`. The real path is never sent to the browser.
- **Upload checks, in order:**
  1. Access check (section 2.7; login later).
  2. `CONTENT_LENGTH` above 10 MB, or `$_FILES` empty because the post size limit was exceeded: **413**.
  3. `$_FILES['file']['error']`:
     - `INI_SIZE` / `FORM_SIZE`: 413
     - `PARTIAL` / `NO_FILE`: 422
     - `NO_TMP_DIR` / `CANT_WRITE` / `EXTENSION`: 500, logged
  4. `is_uploaded_file`.
  5. Size between 1 byte and 10,485,760 bytes.
  6. `finfo` MIME type = `application/pdf`.
  7. The first 5 bytes are `%PDF-`.
  8. The original file name is cleaned (basename, control characters removed, at most 150 characters, `.pdf` enforced).
- **Write order (no file work inside a transaction):**
  1. Move the file to its random final name.
  2. Transaction: lock order, then batch, check `pdfState`, update.
  3. If the update fails or is rejected (for example, it lost a concurrent race), **delete the new file** before replying.
- **Download headers:** `Content-Type: application/pdf`, `Content-Disposition: attachment` with the cleaned name, `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache`, `Expires: 0`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Content-Length`.
- **Orphans:** `orphans` lists files in the storage folder that no batch references and that are older than 1 hour. `--delete` removes them. Files that are referenced are never touched.
- **Direct access tests:** locally through WAMP Apache, `GET /order-bookings/storage/delivery-pdfs/<file>` must return 403. The same check is repeated on live after deploy. If Apache isn't running locally, the test reports **NOT RUN**, never a pass.
- **Mandatory before live (D3):** login, session security, API authorization and CSRF protection, replacing the local dev switch. A separate phase that needs planning and approval.

## 9. Testing (R3, R5, R6)

**Test database safety:**
- `tests/helpers/test-db.cjs` refuses to run unless the database name **ends in `_test`** (default `order_booking_test`), the host is `127.0.0.1` or `localhost`, and the name differs from any `DB_NAME` set in the environment.
- It creates and drops **only** that database. The CLI `down` command has the same checks built in.
- All test servers and CLI calls get the test database variables explicitly.

| # | Test | Command | Needs |
| --- | --- | --- | --- |
| 1 | `php -l` on every new and changed PHP file | `npm run test:orders` | PHP CLI |
| 2 | Existing 14 tests; `productionEngine.js`, manufacturing, inventory and settings unchanged (`git diff --quiet` on those paths) | `npm test` + check | Node |
| 3 | **Parity:** the same fixtures through JS `OrderQuantities`/`DispatchFlow` and the PHP rules (set size, scanned, available, delivered, pass-to-delivery result, Replace split) | `test:orders` | PHP CLI |
| 4 | **Migration:** `migrate` twice (no change the second time), `verify`, `status`. The API returns 503 before migrate and works after | `test:orders` | MySQL |
| 5 | **API rules:** create (bad customer, bad barcode, qty limits, line limit, date); D1 blocks on update, setStatus and delete after pass; pass is safe to repeat; scan limits; Replace rules; pass-to-delivery limits; 409 on a stale version; access check (401 without the dev switch); 503 when not migrated | `test:orders` | MySQL |
| 6 | **Concurrency, genuine:** 4 separate `php -S` processes (independent PHP processes and DB connections) on the test DB, with requests fired together | `test:orders` | MySQL |
| | a) 30 simultaneous scans of one barcode on a 10-piece line: exactly 10 succeed, 20 are rejected, and the DB holds 10 | | |
| | b) Simultaneous scans across 3 lines of one order: no update lost (total = successes) | | |
| | c) 2 simultaneous pass-to-delivery calls with the same version: 1 succeeds and 1 gets 409; 1 batch; delivered pieces correct | | |
| | d) 2 simultaneous pass-to-delivery calls with fresh versions but stock for only one: the second is rejected, nothing is over-delivered | | |
| | e) 2 simultaneous PDF passes on one batch: 1 succeeds and 1 gets 409; **exactly 1 file** on disk | | |
| | f) 20 simultaneous creates: 20 unique IDs and 20 rows (collision retry). Plus a forced collision: IDs for the next milliseconds are pre-inserted and create still succeeds with a free ID | | |
| | g) The same import sent from 2 "browsers" at once: 1 imported, 1 already imported or conflict; no duplicate rows | | |
| 7 | **PDF security:** valid PDF; text file renamed `.pdf` (MIME or signature fails); 10 MB + 1 byte (413); empty file; missing file; duplicate pass (409); download headers checked exactly; unknown batch (404); request from another IP (403); orphan file found and deleted while referenced files stay | `test:orders` | MySQL |
| 8 | **Direct access denied:** Apache `GET` on the storage folder and on `cli/` returns 403 | `test:orders` | Local Apache; otherwise reported **NOT RUN** |
| 9 | **Import:** new, already imported, conflict, invalid; `DLV-LEGACY` batch; PDF metadata becomes `pdfState = missing`; PDF import upload succeeds once, then 409; PDF retry after a simulated failure does not import the order again | `test:orders` | MySQL |
| 10 | **Rollback and restore:** section 10, run end to end on the test DB | `test:orders` | MySQL + `mysqldump` |
| 11 | **Manual, two browsers** (Chrome and Edge as two PCs) on localhost: punch, edit, toggle, pass, scan, Replace, partial delivery, PDF pass and download, viewed in the second browser. Import with seeded localStorage and IndexedDB data, including a forced PDF failure and retry, and a conflict banner | Manual checklist recorded in `SAP_INTEGRATION.md` | WAMP |

The new test files are named `*.integration.cjs`, so `npm test` stays unchanged. They run with a new script, `npm run test:orders`.

**Local prerequisite:** the PHP CLI could not connect to local MySQL today (the WAMP MySQL service is probably stopped). The test database also needs a local MySQL user that can create databases.

## 10. Rollback and data export (R5, tested)

- **`export <dir>`** writes:
  - `orders.json`: **exactly the browser `orders` shape**, so the old pages can read it;
  - `pdfs/<batchId>.pdf`, copied;
  - `manifest.json`: counts and SHA-256 checksums.
- **`restore <dir>`** loads an export into a migrated database through the same import logic (safe to repeat, conflicts reported) and restores the PDF files.
- **Live rollback procedure** (documented and rehearsed locally):
  1. **Before deploy:** hPanel backup (H7), plus `mysqldump` of the 4 new tables after migrate.
  2. **If a rollback is needed:**
     - run `export`;
     - revert the code and redeploy;
     - the old pages read each browser's localStorage `orders`, which was never deleted;
     - for orders created on the server after go-live, load `orders.json` into that browser (documented console step);
     - their PDFs are available as files in the export folder.
  3. **Tables are not dropped** (forward-only). Moving forward again means redeploying the code; the data is still in MySQL.
- **Automated rehearsal (test 10, test DB only):**
  1. Seed through the API (orders, scans, partial deliveries, PDFs, an imported legacy order).
  2. `export` (A).
  3. `mysqldump` the 4 tables, run `down` (drop), and restore the dump: `verify` passes and a new export **equals A**.
  4. `down`, then `migrate` and `restore A`: a new export **equals A** (lossless round trip). PDF checksums match.
  5. `orders.json` from A is fed through the **unchanged** JS `OrderQuantities`, `DispatchFlow` and `DeliveryRecords.batches/snapshot`, with the same totals and statuses. This proves the old pages can read it.

## 11. Local work and Hostinger dependencies

**Fully local:** sections 3 to 10.

**Needed before any live deploy:**

| # | Item | Why |
| --- | --- | --- |
| **A1** | **Login, session security, API authorization and CSRF protection implemented and approved** (D3) | Mandatory gate. It replaces the local dev switch |
| H1 | Does Git deploy update the folder in place or replace it? | Shows whether files inside the deploy folder survive deploys |
| H2 | Where the live `DB_*` variables are set | `DELIVERY_PDF_DIR` will be set the same way |
| H3 | Database users: can there be a migration user with `CREATE` rights separate from the runtime user (`SELECT/INSERT/UPDATE/DELETE`)? | Least privilege. Note: the existing automatic runner currently needs `CREATE` on the runtime user |
| H4 | A writable folder **outside `public_html`** for `DELIVERY_PDF_DIR` | R4 |
| H5 | Live PHP `upload_max_filesize` and `post_max_size` of at least 11 MB | D2 |
| H6 | Which PCs and browsers hold live order data, and no browser data cleared until the import is confirmed | They hold the only copy |
| H7 | A fresh hPanel backup (database and files) just before deploy | Rollback |
| H8 | **SSH access** to run `php cli/orders-admin.php migrate`. Otherwise a one-off hPanel cron job running the same command with its output logged | R1, the explicit migration step |
| H9 | Live database engine and version (`SELECT VERSION()`): MySQL or MariaDB | Syntax compatibility |

**Live deploy order (later, after A1 and H1 to H9):**
1. Backup.
2. Deploy the code. The order APIs answer 503 until migration, and no writes happen.
3. Run `migrate` (verify runs inside it).
4. Smoke test.
5. Import on each browser listed in H6.
6. Run the direct-access 403 checks on live.

## 12. Risks remaining after Phase 1 (local)

- No login yet. The order APIs fail closed (401) outside the explicit local dev switch, and live deploy is blocked by A1.
- The existing automatic migration runner for older migrations is unchanged (follow-up).
- Live deploy behaviour (H1) and folder layout (H4) are unconfirmed.
- Old browser copies stay until the owner approves clean-up.

## 13. Implementation steps (each with its check)

| # | Step | Check |
| --- | --- | --- |
| 0 | Start local MySQL; set up the test DB and test harness with the safety checks | Harness refuses a name without `_test`; existing `npm test` passes 14 of 14 |
| 1 | Migration files, `cli/orders-admin.php` (`migrate`, `verify`, `status`, `down`), `cli/.htaccess`, `database/order-booking.sql` | Test 4 |
| 2 | `api/order-records.php` + `api/orders.php` (guard, ready check, rules, locks) | Tests 1, 3, 5, 6a to d, 6f |
| 3 | `api/delivery-pdf.php` + storage + `orphans` | Tests 6e, 7, 8 |
| 4 | Import (server) | Tests 6g, 9 |
| 5 | `export` / `restore` | Test 10 |
| 6 | `ordersApi.js`, then each page: Order Punch, Order List, Dispatch, Delivery | `npm test` 14 of 14 after each page, plus a manual check of that page |
| 7 | `orderImport.js` (Steps A and B, banner, PDF missing state) | Test 11, import part |
| 8 | Docs: `docs/flow.md`, `SAP_INTEGRATION.md`, `PROJECT_OVERVIEW.md`, line 3 of `docs/claude.md` | Review |
| 9 | Full manual run in two browsers, then the final report | Test 11, then **stop** for approval |

## 14. Implementation outcome (2026-11-12, local only)

**Status:** all steps 0 to 9 are done on branch `sap_integration`. Nothing is committed, pushed or deployed.

**Differences from the plan:**

| Item | Plan | Implemented | Why |
| --- | --- | --- | --- |
| Access before login | Same-machine IP guard | Explicit dev switch `APP_ENV=development` + `ORDERS_ALLOW_UNAUTHENTICATED_DEV=1`; everything else returns 401 | Owner security clarification (no IP, `Origin` or token substitutes for login) |
| PDF download key | Random token | `?batchId=` behind the access check | Tokens are not an access control; login will authorize downloads |
| Local dev server | `php -S` at `/` | `npm run dev`: 127.0.0.1:8080, app at `/order-bookings/` (document root is the parent folder; the router answers 404 for anything else) | On Windows, the existing `<base href>` code in `includes/header.php` produces `\/` at the web root. Mounting like WAMP avoids changing the shared header |
| Test 6d (over-delivery) | Simultaneous requests with fresh versions | Sequential: correct version, nothing left to deliver, 422 | Two simultaneous requests cannot both hold a fresh version; the version check serializes them (test 6c) |
| Test 11 (two browsers) | Manual checklist | Automated with headless Chrome, two separate profiles, via the DevTools protocol (local script, not committed) | Repeatable; 26 checks |
| Test database | MySQL | MariaDB 11.4 (default, port 3307) **and** MySQL 8.4 (port 3306, `lower_case_table_names=1`) | Live engine unknown (H9). Both pass |

**Bug found and fixed during the browser test:** `orderImport.js` expected an array, but the import API returns `{results: [...]}`. The server import had already succeeded. The next run correctly reported *already on server*, which also confirmed that import recovers after a client crash.

**Mutation check of the concurrency tests:** with the row locks, the quantity compare-and-set and the order version condition removed, tests 6a and 6b failed (lost scans), so they detect missing locking. Test 6c still passed, because the row-count check in `ordersSave` is a second protection layer.
