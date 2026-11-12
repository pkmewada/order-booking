# SAP Business One Integration

This is the single source of truth for SAP work. Update it at the end of every session.

| | |
| --- | --- |
| **Current phase** | Phase 1: orders, dispatch and delivery to MySQL |
| **Phase status** | **Implemented, tested and merged into `main`** (2026-11-12): PR #1 `084f41b`, PR #2 `5212e03`, PR #3 `745fb01`. Focused QA passed on `6154194`. Live deployment **not verified and blocked**. [Plan and outcome](SAP_PHASE1_PLAN.md) |
| **Next action** | Owner review of the authentication work on branch `feature/authentication` (A1 and audit H1 implemented, not committed). Confirm on Hostinger whether `main` is auto-deployed (H1). Live deploy stays **blocked** until authentication is merged, `migrate` and the first admin are run on the server, the QA blockers in [SECURITY_AUDIT.md](SECURITY_AUDIT.md) section 7 and Hostinger items H1 to H9 are resolved. No other phase starts without approval. |
| **Branch** | `sap_integration` (local, created 2026-11-12 from `main` at `6ee8500`; nothing committed or pushed) |
| **Last updated** | 2026-11-12 |
| **Team report** | [SAP Service Layer access and requirement gaps](https://claude.ai/artifact/6xKTLpcSALsjHVj6BLpq1R) |

## 1. Objective and scope

The goal is a two-way integration between the Little Dolly app (this repo) and Little Dolly's SAP Business One, through the SAP B1 Service Layer. Accelon Technologies is the SAP partner.

**In scope:** customers, products and items, orders, production, dispatch and delivery, and inventory.

**Out of scope:** invoice and payment sync. There are no invoice or payment APIs, queues or tables. The app has no invoice feature today; the only mention is one reference in `assets/js/finishing.js`, which must stay unchanged.

**Approach:** extend the existing PHP/MySQL app. Do not add frameworks, a Node backend, queues such as Redis or RabbitMQ, or microservices.

## 2. Existing architecture relevant to SAP

- PHP and Apache, deployed from GitHub (`pkmewada/order-booking`) to Hostinger. Routing is `.htaccess` → `index.php` (`$pageRoutes`).
- MySQL through PDO in `includes/db.php`, using the `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD` environment variables.
- Schema: `database/order-booking.sql` plus migrations in `database/migrations/`. Migrations run automatically on the first API call (`includes/schema-migrations.php`, tracked in `appSchemaMigrations`).
- **Authentication:** none on `main`. Implemented on branch `feature/authentication` (not merged): sign-in, admin and employee roles, CSRF. See `SECURITY_AUDIT.md` section 8.

| Data | Stored in today | SAP object |
| --- | --- | --- |
| Customers | MySQL `customerRecords` (`api/customer.php`) | `BusinessPartners` |
| Products / BOM | MySQL `productRecords`, `productItemLinks`, `productWorkSteps` | `Items` (and BOM) |
| Raw materials | MySQL `itemList` | `Items` |
| Production (batches → stages → packing → bundling → inventory) | MySQL `manufacturingState` as JSON per key (`api/manufacturing-state.php`), managed by `assets/js/productionEngine.js` | Production orders, issues and receipts, stock (to be confirmed) |
| Orders, dispatch, delivery | `main` and live: browser localStorage only. Branch `sap_integration`: MySQL `customerOrders`, `customerOrderItems`, `deliveryBatches`, `deliveryBatchItems` (`api/orders.php`) | `Orders`, `DeliveryNotes` |
| Delivery PDFs | `main` and live: browser IndexedDB. Branch `sap_integration`: private server folder (`api/delivery-pdf.php`) | attachment (to be confirmed) |

## 3. SAP integration architecture (proposed; confirm in Phases 3 and 4)

```
Browser (jQuery) → api/*.php → MySQL (local copy, SAP mapping columns, sync log)
                                    ↕  PHP Service Layer client (server side only)
                         SAP B1 Service Layer  https://<server>:<port>/b1s/v1/
```

- Login: `POST /Login` (CompanyDB, UserName, Password) returns a `B1SESSION` cookie that the server reuses until it expires.
- Outbound: local records are pushed to `BusinessPartners`, `Items`, `Orders` and `DeliveryNotes` (a delivery links to its order with BaseType 17, BaseEntry and BaseLine).
- Inbound: changed SAP records are pulled by polling `UpdateDate`/`UpdateTime`. How inbound sync is triggered (Hostinger cron or on demand) is to be decided.
- Every local record stores its SAP key (CardCode, ItemCode, DocEntry/DocNum) and a sync status. Errors go to a sync log table and can be retried.
- Credentials are server side only, never in JavaScript, localStorage or Git.
- Field ownership (which system is the master for each field) must be agreed with Accelon before Phase 4.

## 4. Phases

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Repository safety and baseline | Done except 2 pending Hostinger checks |
| 1 | Move orders, dispatch and delivery to MySQL; delivery PDFs to server storage | **Done; merged into `main`** (PRs #1 to #3). Live deploy blocked by A1, QA blockers B1 to B6 and H1 to H9 |
| 2 | SAP fields and local database readiness | Not started |
| 3 | SAP settings and connection foundation | Blocked on admin authentication and SAP test access |
| 4 | Customer and product sync | Blocked on Phase 3 |
| 5 | Orders, production, dispatch and inventory sync | Blocked on Phase 4 |
| 6 | Testing and production rollout | Not started |

Work on one phase at a time. Stop after each phase and wait for approval.

## 5. Task checklists

### Phase 0: Repository safety and baseline
- [x] Inspect repository structure and Git tracking
- [x] Review `.gitignore`; add `.env`, `.env.*` (except `.env.example`), key and certificate files, and `uploads/`
- [x] Check for tracked sensitive files and secrets in Git history (none found; section 9)
- [x] Review `package.json` scripts and tests; record the baseline (section 10)
- [x] Create this document; add an SAP reference to `docs/claude.md`
- [x] Owner decisions recorded (section 9, decisions 5 to 8)
- [x] Remove the six broken test scripts from `package.json`; `npm test` still passes 14 of 14
- [ ] **Pending:** confirm how Hostinger Git deploy updates the live folder (section 12)
- [ ] **Pending:** confirm how the live database credentials are set on Hostinger (section 12)

### Phase 1: Orders, dispatch and delivery to MySQL
Full file-by-file plan: [SAP_PHASE1_PLAN.md](SAP_PHASE1_PLAN.md).
- [x] Plan written (2026-11-12)
- [x] Owner decisions D1 to D3 recorded (2026-11-12)
- [x] Plan revision 2 with owner requirements: CLI-only migrations, separate order and PDF import, genuine concurrency tests, PDF hardening, test-database safety, tested rollback (2026-11-12)
- [x] Branch `sap_integration` created locally
- [x] Owner approval of revision 2 and of the security clarification (2026-11-12)
- [x] Read `orderPunch.js`, `orderList.js`, `dispatch.js`, `delivery.js`, `deliveryRecords.js` and the matching pages; document the current `orders` structure
- [x] Tables `customerOrders`, `customerOrderItems`, `deliveryBatches`, `deliveryBatchItems` (CLI-only migration, verified)
- [x] PHP/PDO APIs: create, list, update, status, delete, pass to dispatch, scan, Replace, partial delivery, import
- [x] Duplicate prevention: row locks, compare-and-set, order `version`, one PDF per delivery
- [x] Private PDF storage (`DELIVERY_PDF_DIR` outside the web root; local fallback with deny-all `.htaccess`); private download headers
- [x] One-time browser import of orders, plus a separate, retried PDF import; nothing deleted in the browser
- [x] `database/order-booking.sql`, `database/cli-migrations/`, `docs/flow.md` updated
- [x] Two-browser end-to-end check (headless Chrome, 2 profiles): 26 of 26
- [x] Read-only security audit of the Phase 1 diff (2026-11-12): no critical findings. Audit M1, M2 and L1 fixed before commit. See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) and [TEST_REGISTER.md](TEST_REGISTER.md)
- [ ] **Before live:** A1 (login, sessions, API authorization, CSRF): **implemented** on `feature/authentication`, awaiting approval and merge. Hostinger items H1 to H9 still open
- [ ] **Before live (audit H1):** the `import` action must be admin-only, or disabled once the browser migration is complete. **Implemented** (admin-only) on `feature/authentication`

### Phase 2: SAP fields
- [ ] Confirm the mandatory fields with Accelon for each form (including production and inventory)
- [ ] Add the confirmed fields and SAP key columns, with a migration
- [ ] Update forms and APIs; no SAP calls yet

### Phase 3: Settings and connection
- [ ] Admin login and authorization (prerequisite). Implemented on `feature/authentication`, not merged
- [ ] Server-side SAP config that is never returned by any API
- [ ] SAP Settings page (admin only): environment, URL, port, CompanyDB, user, password (write only), connection test
- [ ] Service Layer client (login, session reuse, logout, error handling) once test credentials exist

### Phase 4: Customer and product sync
- [ ] Mapping, duplicate prevention, SAP key storage, sync status, error log, retry

### Phase 5: Orders, production, dispatch and inventory sync
- [ ] Sales orders, production references, material consumption, finished goods, deliveries, stock
- [ ] Two-way status updates and quantity reconciliation, without bypassing `productionEngine.js`

### Phase 6: Testing and rollout
- [ ] Full test list (sync, duplicates, network failure, retry, partial dispatch, security, UAT) on the SAP test DB
- [ ] Production go-live only after test sign-off; rotate the SAP password after go-live

## 6. Database changes and migrations

| Date | Migration | Tables / columns | Phase |
| --- | --- | --- | --- |
| 2026-11-12 | `database/cli-migrations/20261112_001_customer-orders.sql` (+ `.down.sql`, local/test only) | New: `customerOrders`, `customerOrderItems`, `deliveryBatches`, `deliveryBatchItems`. Additive; nothing existing altered. Also copied into `database/order-booking.sql`. Applied only by `php cli/orders-admin.php migrate` and recorded as `cli/20261112_001_customer-orders.sql` after verification. Tested on MariaDB 11.4 and MySQL 8.4 | 1 |
| 2026-11-12 | `database/cli-migrations/20261112_002_app-users.sql` (+ `.down.sql`, test only) | New: `appUsers` (accounts for sign-in). There was no user table, and `employeeRecords` holds production workers without login fields. Additive. Also in `database/order-booking.sql`. Applied by `php cli/orders-admin.php migrate`. Branch `feature/authentication`, not merged | Auth |

**Not yet applied** to the live database. The owner's local `order-booking` (MySQL 8.4, port 3306) was migrated on 2026-11-12 (both CLI migrations, after a `mysqldump` backup) so that local test accounts could be created.

## 7. API endpoints introduced or modified

| Date | Endpoint | Change | Phase |
| --- | --- | --- | --- |
| 2026-11-12 | `api/orders.php` | New. `GET` (all or `?id=`); `POST` actions `create`, `update`, `setStatus`, `delete`, `passToDispatch`, `scan`, `replaceItem`, `deliverPartial`, `import`. 401 without login (dev switch only); 503 until migrated | 1 |
| 2026-11-12 | `api/delivery-pdf.php` | New. `POST` (pass, or `mode=import`); `GET ?batchId=` private download | 1 |
| 2026-11-12 | All page APIs (orders, PDF, masters, manufacturing, product, BOM, patterns, manufacturing state) | Sign-in required (401), role rules (403), CSRF header on changes. Order and PDF import admin-only | Auth |
| 2026-11-12 | `api/users.php` | New, admin only: list, create, update, set password | Auth |

## 8. Files created or modified

| Date | File | Change | Phase |
| --- | --- | --- | --- |
| 2026-11-12 | `docs/SAP_INTEGRATION.md` | Created | 0 |
| 2026-11-12 | `docs/claude.md` | Added SAP reference and rules | 0 |
| 2026-11-12 | `.gitignore` | Added env, key/certificate and `uploads/` rules | 0 |
| 2026-11-12 | `package.json` | Removed six scripts that pointed to missing files; only `test` remains | 0 |
| 2026-11-12 | `PROJECT_OVERVIEW.md` | Updated the tests line | 0 |
| 2026-11-12 | `docs/SAP_PHASE1_PLAN.md` | Created (plan only); rewritten as revision 2; outcome added (section 14) | 1 |
| 2026-11-12 | `api/order-records.php` (new) | All order, dispatch, delivery, import and PDF rules, locks and validation | 1 |
| 2026-11-12 | `api/orders.php`, `api/delivery-pdf.php` (new) | Thin endpoints | 1 |
| 2026-11-12 | `database/cli-migrations/20261112_001_customer-orders.sql` and `.down.sql` (new) | Order tables (section 6) | 1 |
| 2026-11-12 | `database/order-booking.sql` | Same 4 tables appended for fresh installs | 1 |
| 2026-11-12 | `cli/orders-admin.php` (new) | `migrate`, `verify`, `status`, `down` (test only), `export`, `restore`, `orphans` | 1 |
| 2026-11-12 | `cli/dev-server.cjs`, `cli/dev-router.php` (new) | Local dev server (`npm run dev`, 127.0.0.1 only, explicit dev switch) | 1 |
| 2026-11-12 | `cli/.htaccess`, `storage/.htaccess` (new) | Deny all web access | 1 |
| 2026-11-12 | `assets/js/ordersApi.js`, `assets/js/orderImport.js` (new) | API client; browser import (orders and PDFs tracked separately) | 1 |
| 2026-11-12 | `assets/js/orderPunch.js`, `orderList.js`, `dispatch.js`, `delivery.js`, `deliveryRecords.js` | Read and write through the API; HTML escaping; reload on focus; PDF missing state | 1 |
| 2026-11-12 | `orderBooking/orderPunch.php`, `orderList.php`, `dispatch.php`, `delivery.php` | Two script tags added | 1 |
| 2026-11-12 | `tests/order-rules-parity.integration.cjs`, `tests/orders-api.integration.cjs`, `tests/helpers/*` (new) | Phase 1 tests (`npm run test:orders`) | 1 |
| 2026-11-12 | `package.json` | Scripts `test:orders`, `dev` | 1 |
| 2026-11-12 | `.gitignore` | `storage/delivery-pdfs/` | 1 |
| 2026-11-12 | `docs/flow.md`, `PROJECT_OVERVIEW.md`, `docs/claude.md` | Order database flow, storage table, tests, rules | 1 |
| 2026-11-12 | `api/order-records.php` | Audit fixes. M1: the dev switch also needs PHP's built-in server. M2: outside development, PDF storage needs an existing, writable `DELIVERY_PDF_DIR` outside the project and web root, otherwise 503 | 1 |
| 2026-11-12 | `assets/js/orderList.js`, `orderPunch.js`, `orderImport.js`, `delivery.js` | Audit L1: error messages shown as text in SweetAlert2 (7 calls) | 1 |
| 2026-11-12 | `tests/orders-api.integration.cjs` | Tests TC-05 (M1, M2) and TC-06 (L1 guard) | 1 |
| 2026-11-12 | `includes/auth.php`, `includes/users.php`, `api/users.php`, `cli/users-admin.php`, `settings/users.php`, `assets/js/users.js`, `logout.php`, `tests/auth.integration.cjs`, migration `20261112_002` (new) | Authentication (branch `feature/authentication`) | Auth |
| 2026-11-12 | `login.php`, `index.php`, `includes/header.php`, `includes/header2.php`, the API handlers, `assets/js/orderImport.js`, `cli/dev-server.cjs`, `package.json`, `database/order-booking.sql`, TC-01 list | Sign-in form, page and API guards, Log Out, Users menu item, admin-only import notice; `npm run dev` no longer bypasses sign-in | Auth |
| 2026-11-12 | `docs/SECURITY_AUDIT.md`, `docs/TEST_REGISTER.md` (new) | Audit findings, decisions, deferred items; test catalogue and run log | 1 |
| 2026-11-12 | `includes/db.php`, `includes/db.config.example.php` (new), `.gitignore` | Credentials moved out of tracked code into the ignored `includes/db.config.php`; removed the ineffective `includes/db.php` ignore rule (decision 2) | 1 (fix) |
| 2026-11-12 | `docs/databaseReadme.md`, `docs/flow.md`, `PROJECT_OVERVIEW.md` | Connection setup now points to `db.config.php` or env vars, never to editing `db.php` | 1 (fix) |
| 2026-11-12 | `includes/db.php` (removed from Git, kept on disk), `includes/db.example.php` (new), `.gitignore`, `docs/databaseReadme.md`, `docs/flow.md`, `PROJECT_OVERVIEW.md` | `db.php` untracked at the owner's request; template plus the server switch-over steps | 1 (fix) |

Not modified, on purpose (verified with `git diff 6ee8500`):
- `includes/` (including `db.php`) and the database configuration;
- `uploads/`;
- `assets/js/productionEngine.js`, `manufacturing/`, `settings/`;
- `orderQuantities.js`, `dispatchFlow.js`, `orderPdf.js`, `orderDetails.js`.

There is no invoice or payment code.

## 9. Important decisions

1. **The 5 files already tracked under `uploads/` stay tracked for now.** If they were untracked with `git rm --cached` and that commit were deployed, Git would delete them from the Hostinger folder. That would remove 4 product photos and `uploads/products/.htaccess`, which blocks script execution and directory listing. New uploads are ignored from now on.
2. **`includes/db.php` is listed in `.gitignore` but is tracked.** The ignore rule has no effect. The file holds no secrets (it only reads environment variables) and the app needs it. Do not untrack it, or the next deploy will delete it from the server.
   - **Resolved 2026-11-12, owner request.** `db.php` stays tracked as code; the misleading ignore rule was removed. Credentials now go in `includes/db.config.php` (ignored, one per server; template `includes/db.config.example.php`) or in the `DB_*` environment variables, which take priority.
   - Without a config file the behaviour is unchanged. Decision 6 is lifted for this change only.
   - **Changed later on 2026-11-12, owner decision ("untrack, safe procedure").** `includes/db.php` is no longer in Git and is ignored again. The tracked template `includes/db.example.php` is copied to `db.php` on every server and clone.
   - The deploy that removes it deletes `db.php` on the server. The one-time switch-over steps are in `docs/databaseReadme.md`. Later code changes to the template must be copied to each server by hand.
3. **No secrets found.** Every version of `includes/db.php` in history uses environment variables with the local fallback `root` and an empty password. No `.env`, key, certificate or SQL dump has ever been committed. No credential rotation is needed.
4. **Invoices and payments are excluded** (section 1).
5. **Hostinger deploy behaviour is not assumed** (owner, 2026-11-12). It cannot be verified from the repo: there is no deploy config, and Hostinger access is not connected in this environment. It stays pending until the owner confirms it.
6. **`includes/db.php` and the database configuration are frozen** until the live Hostinger setup is confirmed (owner, 2026-11-12). Exception, approved by the owner on 2026-11-12: the config-file change in decision 2.
7. **Obsolete test scripts removed** (owner, 2026-11-12). The six broken scripts were removed from `package.json`. The deleted test files are **not** restored. All 14 passing tests are kept.
8. **The 4 tracked product photos and `uploads/products/.htaccess` stay in Git** (owner, 2026-11-12). No live uploads are removed or deleted. Revisit after the deploy behaviour and backup strategy are confirmed.
9. **Phase 1 decisions** (owner, 2026-11-12):
   - D1: edit, delete and status change only before Pass to Dispatch, enforced on the server;
   - D2: 10 MB PDF limit;
   - D3: build locally; **login and API authorization are mandatory before any live deploy**.
10. **Phase 1 requirements** (owner, 2026-11-12):
    - migrations only through an explicit CLI step, never from public requests, verified before the APIs work;
    - order import and PDF import tracked separately, with PDF retry;
    - genuine concurrency tests;
    - PDF hardening and private downloads;
    - order ID collision handling;
    - a test runner that cannot reach a production database;
    - missing PDFs shown differently from completed deliveries;
    - tested rollback and restore.
11. **New order migrations live in `database/cli-migrations/`**, which the existing automatic runner does not read. This meets the CLI-only requirement without touching the frozen `includes/db.php`.
12. **Access before login** (owner clarification, 2026-11-12):
    - Unauthenticated access to the new order and PDF APIs exists only behind an explicit local-development configuration (`APP_ENV=development` + `ORDERS_ALLOW_UNAUTHENTICATED_DEV=1`, set only by `npm run dev`).
    - Production fails closed with 401.
    - No IP, `Origin` or random-URL checks are used as a substitute for authentication.
    - The local PHP server binds to 127.0.0.1.
    - Login, session security, API authorization and CSRF protection are mandatory before live deployment.
13. **Git workflow:** all SAP work happens on branch `sap_integration` and is merged after review (owner, 2026-11-12). Nothing is committed or pushed without the owner asking.
14. **Skills applied:**
    - `karpathy-guidelines` (Andrej Karpathy);
    - the ECC skills `mysql-patterns` and `database-migrations`.

    The ECC `security-review` and `backend-patterns` skills mentioned by those skills are **not installed**.

## 10. Testing results

Baseline on 2026-11-12, commit `6ee8500`, Node v24.14.1:

| Command | Result |
| --- | --- |
| `npm test` (`tests/*.test.cjs`) | **14 passed, 0 failed** (`parallel-piece-routing`, `production-damage-flow`) |
| `npm run verify` | Broken: `tests/verify-source.cjs` was deleted in commit `07627b0` |
| `npm run test:browser` | Broken: `tests/browser-production.cjs` was deleted in `07627b0` |
| `npm run test:packing` | Broken: `tests/browser-packing.cjs` was deleted in `07627b0` |
| `npm run test:dispatch` | Broken: `order-quantities.test.cjs` and `dispatch-flow.test.cjs` are not in this repo's history |
| `npm run test:dispatch:browser` | Broken: `browser-dispatch.cjs` is not in this repo's history |
| `npm run test:history` | Broken: `browser-navbar-history.cjs` is not in this repo's history |

After cleanup (2026-11-12): the six broken scripts were removed. `npm test` is the only script and gives **14 passed, 0 failed**. `package.json` is still valid JSON.

**Phase 1 results (2026-11-12, Node v24.14.1, PHP 8.3.28):**

| Command | Result |
| --- | --- |
| `npm test` | **14 passed, 0 failed** (unchanged) |
| `npm run test:orders` on MariaDB 11.4 (default, 127.0.0.1:3307) | **17 passed, 0 failed, 0 skipped** (run 5 times) |
| `npm run test:orders` with `TEST_DB_PORT=3306 MYSQL_BIN_DIR=C:/wamp64/bin/mysql/mysql8.4.7/bin` (MySQL 8.4, `lower_case_table_names=1`) | **17 passed, 0 failed, 0 skipped** |
| Two-browser end-to-end check (headless Chrome, 2 profiles, local script) | **26 of 26** |
| Apache (WAMP) without the dev switch | `api/orders.php` and `api/delivery-pdf.php` return **401**; `cli/`, `storage/`, `database/` return **403** |
| Mutation check (row locks and compare-and-set removed) | Concurrency tests 6a and 6b **fail**, as they should; restored afterwards |

The 17 tests cover:
- `php -l` and PHP/JS rule parity;
- migration (503 before migrate, idempotent, verify);
- fail-closed access (401);
- create validation; D1 restrictions; dispatch, Replace and delivery rules;
- genuine concurrency over 4 independent `php -S` processes: 30 scans on a 10-piece line, scans on 3 lines, 8 duplicate deliveries, 3 simultaneous PDF passes, 20 simultaneous creates plus a forced ID collision, the same import from 4 browsers;
- PDF security: 10 MB + 1 rejected, 10 MB exact accepted, fake PDF, PNG, empty, missing, duplicate, download headers, orphan clean-up;
- import (imported, already imported, conflict, invalid, legacy delivery, PDF retry after a failed upload);
- rollback (export, `mysqldump`, drop, restore, migrate, restore, lossless round trip, readable by the pre-Phase-1 browser code);
- direct access denied on `php -S` and on Apache.

The browser check covers:
- import prompt and conflict banner;
- separate PDF tracking; local data kept; no second prompt;
- Order Punch through the API with database snapshots; HTML escaping;
- the second PC sees the order; status toggle; pass to dispatch; editing a passed order refused;
- 5 scans and a wrong barcode; partial delivery; Replace;
- the three delivery states (In Progress, Success, PDF missing); PDF pass and private download; Upload PDF for missing; details modal;
- no errors from the order scripts.

Not covered by an automated browser test: the browser's PDF `failed` retry path. It is covered at API level in the import test.

**Security audit and fixes (2026-11-12).** The results above are kept unchanged as historical evidence. Every later run is logged in [TEST_REGISTER.md](TEST_REGISTER.md):
- The audit ran with Apache deliberately unreachable: 17 tests, 16 passed, 1 skipped.
- The browser PDF retry scenario was run in a real browser.
- After the fixes, `test:orders` has 19 tests: 18 passed, 0 failed, 1 skipped (Apache test, on purpose) on MariaDB 11.4.
- The MySQL 8.4 run of the same SQL code gave 17 passed, 1 skipped.

## 11. Bugs discovered and resolved

| Date | Bug | Status |
| --- | --- | --- |
| 2026-11-12 | Six `package.json` test scripts point to missing files (section 10) | Resolved: scripts removed |
| 2026-11-12 | `docs/claude.md` "Verification" section names deleted tests (`production-engine.test.cjs`, `browser-production.cjs`) | Open; left unchanged to preserve production docs |
| 2026-11-12 | `api/product-records.php` creates `uploads/products/` if it is missing but does not create its protective `.htaccess` | Open; low risk while the tracked `.htaccess` exists |
| 2026-11-12 | Order Punch, Order Details and Dispatch Replace read customers and products from localStorage caches that are filled only by other pages, so a new device sees no customers | Resolved (Phase 1): Order Punch and Dispatch load them from the APIs |
| 2026-11-12 | `orderList.js` and `orderPunch.js` insert some order values into HTML without escaping | Resolved (Phase 1) |
| 2026-11-12 | The `order-punch?id=` URL can edit an order already passed to dispatch, which resets its scan progress | Resolved (Phase 1, D1): refused by the server and the page |
| 2026-11-12 | Local PHP CLI could not connect to MySQL; local `upload_max_filesize` is 2M | Resolved: the services were running when re-checked (the app database simply did not exist); the dev server and tests start PHP with an 11 MB upload limit |
| 2026-11-12 | `orderImport.js` expected an array but the import API returns `{results}` (found by the browser test) | Resolved (Phase 1) |
| 2026-11-12 | `includes/header.php` builds `<base href="\/">` when the app is served at the web root on Windows (`dirname()` returns `\`) | Open, pre-existing. Not hit on WAMP or Linux; the dev server mounts the app at `/order-bookings/` instead of changing the header |
| 2026-11-12 | The trailing `ALTER TABLE … ADD COLUMN IF NOT EXISTS` statements in `database/order-booking.sql` are MariaDB-only; a full import on MySQL 8 stops there, before the appended order tables | Open, pre-existing. On MySQL, create the order tables with `php cli/orders-admin.php migrate`. The test helper skips those statements on MySQL only |
| 2026-11-12 | Every page logs template errors from `salesDashboard.js` (ApexCharts "Element not found") and `custom.js` (SimpleBar) | Open, pre-existing, unrelated to orders |

## 12. Pending work and blockers

**Phase 0, still pending (owner to supply):**

1. **Hostinger Git deploy behaviour.** Not verified, and not assumed. Needed from hPanel → Websites → *site* → Advanced → GIT:
   - the repository, branch and install path shown there;
   - whether auto-deploy (webhook) is on, and whether it ever showed "directory not empty" or similar;
   - a simple test: upload one product photo on the live site, push any small commit, deploy, and check whether the photo is still there. If it is, the deploy updates the existing folder; if it is gone, the deploy replaces it.
2. **Live database configuration.** `includes/db.php` stays untouched until this is known. Needed: are the `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD` variables set somewhere on Hostinger (PHP environment, `.htaccess` `SetEnv`, `.user.ini` or similar), or was `includes/db.php` edited directly on the server? Say *where* only, never the values.
3. **Backup of live uploads.** Is there a current Hostinger backup that includes `public_html/uploads/`? This is needed before any future change to how uploads are tracked.

Resolved on 2026-11-12: test scripts (decision 7) and tracked photos (decision 8).

**Phase 1, needed before any live deploy** (full list in `SAP_PHASE1_PLAN.md` section 11):
- **A1: login and API authorization implemented and approved (mandatory).**
- H1 to H3 above, plus:
  - H4: a writable folder outside `public_html` for PDFs;
  - H5: live PHP upload limits of at least 11 MB;
  - H6: which browsers hold live order data;
  - H7: a backup just before deploy;
  - H8: SSH, or an hPanel cron job, to run the CLI migration;
  - H9: live database engine and version.

**Phase 1, local use:** the owner created a local `order-booking` database (MySQL 8.4, 127.0.0.1:3306) on 2026-11-12. It is **not migrated yet**. To use the new order pages locally:
1. `php cli/orders-admin.php migrate` (uses the `includes/db.php` defaults: 127.0.0.1:3306, `order-booking`, root).
2. `npm run dev`, then open http://127.0.0.1:8080/order-bookings/order-list.

Through WAMP Apache the order pages show "Login required" (401) by design.

**Phase 1, rollback:**
- **Local now** (nothing is committed): `git stash push -u -m "sap-phase1"` puts every Phase 1 change aside and leaves the code as on `main`; `git stash pop` brings it back. If `migrate` was run, the 4 new tables can stay: the old code ignores them.
- **Live later:** procedure in `SAP_PHASE1_PLAN.md` section 10. Backup first; on rollback run `export`, revert and redeploy the code, never drop tables, and load `orders.json` into a browser only for orders created after go-live.

**Follow-up, outside Phase 1:** the existing automatic runner still applies `database/migrations/*.sql` on public requests. Changing that requires editing `includes/db.php`, which stays frozen until the Hostinger setup is confirmed.

**Blockers for later phases:**
- SAP Service Layer access (section 14): none received yet.
- Accelon's field requirements for **production** and **inventory**. Their 24 Oct list covers only Item, Customer, Sales Order and Delivery.
- Field ownership rules for the two-way sync.
- Admin authentication (prerequisite for Phase 3).

## 13. Accelon requirements and responses

| Date | Event |
| --- | --- |
| 9 Oct 2026 | Requirement meeting |
| 13 Oct 2026 | Minutes shared |
| 24 Oct 2026 | Accelon sent the FashionNX mandatory field list for Item Master, Customer Master, Sales Order and Delivery |
| 3 Nov 2026 | Accelon asked for Service Layer credentials |
| 9 Nov 2026 | Accelon asked again for Service Layer credentials |

Fields known to be missing locally: customer group, GSTIN, payment terms, SAP ItemCode, UoM, unit price, tax code and warehouse. These must be **verified against Accelon's list** before Phase 2. The full gap tables are in the team report linked at the top.

The credentials belong to Little Dolly's SAP server. The SAP administrator (Accelon or Little Dolly IT) issues them to us. We do not issue them to SAP.

## 14. SAP connection configuration (placeholders)

All values are unknown. Do not invent them. Real values go in server-side config only, never in Git.

| Setting | Value |
| --- | --- |
| Environment | |
| Service Layer URL | |
| Port | |
| CompanyDB (test) | |
| CompanyDB (production) | |
| Username (dedicated integration user, not `manager`) | |
| Password | *(shared through a separate secure channel; never written here)* |
| SAP B1 version | |
| Service Layer API version (`v1` / `v2`) | |
| Network / VPN / IP whitelist | |
| SSL certificate details | |

## 15. Implementation history

| Date | Session | Summary |
| --- | --- | --- |
| 2026-11-12 | Phase 0 | Safety review, `.gitignore` hardening, test baseline, created this document |
| 2026-11-12 | Phase 0 | Recorded owner decisions; removed six obsolete test scripts (14 of 14 still pass); Hostinger checks marked pending |
| 2026-11-12 | Phase 1 planning | Read all order, dispatch and delivery code; wrote `SAP_PHASE1_PLAN.md`; no implementation code changed |
| 2026-11-12 | Phase 1 planning, revision 2 | Created local branch `sap_integration`; read the skills; rewrote the plan with D1 to D3 and R1 to R6; no implementation code changed |
| 2026-11-12 | Phase 1 implementation (local) | Migration, CLI, APIs, pages, import, tests, docs. 14 + 17 tests pass on MariaDB 11.4 and MySQL 8.4; 26 of 26 browser checks. Not committed, pushed or deployed. Stopped for owner review |
| 2026-11-12 | Phase 1 security audit | Read-only audit, accepted by the owner. Audit M1, M2 and L1 fixed; audit H1 and A1 deferred to the authentication phase; L2 to L12 recorded. 2 new tests; 18 of 19 pass, 1 Apache test skipped on purpose. Not committed. Stopped for owner review |
| 2026-11-12 | Commit and push | Phase 0 + 1 committed as `a6ad9b9` on `sap_integration` and pushed to `origin/sap_integration` (owner request). `main` unchanged |
| 2026-11-12 | DB config fix | `includes/db.php` was tracked despite `.gitignore`, so credential edits kept showing as changes and deploys replaced them. Credentials moved to the ignored `includes/db.config.php`. Committed by the owner as `9f7677b`; PRs #1 and #2 merged into `main` by the owner |
| 2026-11-12 | DB config hardening | "Invalid server response. Check database setup." reproduced with a malformed `db.config.php` (copy of the old `db.php`, or plain text). `db.php` now ignores and logs a malformed config file instead of breaking every API. Committed as `3123d87` |
| 2026-11-12 | Untrack `db.php` | Owner chose "untrack, safe procedure": `includes/db.php` removed from Git (kept on disk) and ignored; tracked template `includes/db.example.php`. Committed on `sap_integration` for a PR; `main` not touched directly |
| 2026-11-12 | Merges by owner | PRs #1 (`084f41b`), #2 (`5212e03`) and #3 (`745fb01`) merged `sap_integration` into `main`. Whether Hostinger deployed them is not verified |
| 2026-11-12 | Focused QA | QA on `6154194`: no application bugs. Two-browser e2e 25/26 (1 test-data artifact, re-checked: pass). Blockers B1 to B6 recorded in `SECURITY_AUDIT.md` section 7; runs TR-QA-01 to TR-QA-06 in `TEST_REGISTER.md`. No application code changed. Docs not committed |
| 2026-11-12 | Authentication (`feature/authentication` from `origin/main` `745fb01`) | Owner decisions: employees get Order Booking and Manufacturing; accounts via CLI and an admin Users page. Implemented A1 and audit H1. Tests: `test:orders` 30 (29 pass, 1 skipped on purpose) on MariaDB 11.4 and MySQL 8.4; `npm test` 14/14; browser 20/20 and 27/28 (known test-data artifact). Not committed. SAP sync not started |
