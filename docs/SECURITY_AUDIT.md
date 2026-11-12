# Security audit: SAP Phase 1 (orders, dispatch, delivery)

| | |
| --- | --- |
| Scope | Full Phase 1 change set on branch `sap_integration` against base commit `6ee8500` (15 modified files, 19 new files) |
| Audit date | 2026-11-12 |
| Method | Read-only code and security review, test runs, a real-browser PDF retry scenario, and `curl` checks against WAMP Apache and the `php -S` dev router. Guidelines applied: Karpathy guidelines (Andrej), ECC `mysql-patterns` and `database-migrations` |
| Owner decision | Audit accepted. M1, M2 and the SweetAlert2 issue fixed before commit. H1 and authentication deferred to the authentication/security phase |
| Status | Fixes committed (`a6ad9b9`) and merged into `main` by the owner (PRs #1 to #3). Live deployment **not verified** and stays **blocked** (sections 5 and 7) |

Test evidence for every statement here is in [TEST_REGISTER.md](TEST_REGISTER.md).

Finding IDs (H1, M1, M2, L1 to L12) belong to this audit only. Elsewhere they are written "audit H1" and so on. They are not the same as the Hostinger items H1 to H9 in [SAP_INTEGRATION.md](SAP_INTEGRATION.md).

## 1. Summary

| Severity | Found | Fixed before commit | Deferred |
| --- | --- | --- | --- |
| Critical | 0 | - | - |
| High | 1 (H1) | - | H1 → authentication phase |
| Medium | 2 (M1, M2) | M1, M2 | - |
| Low | 12 (L1 to L12) | L1 (SweetAlert2) | L2 to L12 |

## 2. Areas checked

| # | Area | Result |
| --- | --- | --- |
| 1 | Local-only security configuration; production fails closed | Passed. Hardened further by M1 and M2 |
| 2 | Authentication boundary for every order and PDF API | Every entry point calls `ordersRequireAccess()` first ([api/order-records.php](../api/order-records.php) `ordersApi`, `ordersPdfApi`). Real Apache returns **401** |
| 3 | SQL injection, transactions, row locks, concurrency | Prepared statements only. Dynamic column names come only from code constants. Fixed lock order: order, then lines, then deliveries (`FOR UPDATE`). Compare-and-set on quantities, `version` check, bounded deadlock retry. Concurrency tests a–g pass |
| 4 | Import idempotency, partial failure, conflicts, PDF retry | Idempotent through `legacyHash`. Conflicts are never overwritten. PDF retry was verified in a real browser (TR-AUD-04) |
| 5 | PDF validation, path traversal, direct access, download headers | Checks: 10 MB limit, `finfo` MIME type, `%PDF-` signature, random 32-hex file names. Downloads accept only `^[a-f0-9]{32}\.pdf$` and send `private, no-store`, `nosniff`, `attachment` and a sandbox CSP. Apache returns **403** on `storage/`, `cli/` and `database/cli-migrations/`, including trailing-dot variants |
| 6 | CLI migration safety; MySQL 8.4 / MariaDB 11.4 | CLI only (`PHP_SAPI` check). `GET_LOCK`. The marker is recorded only after `verify`. `down` is refused unless the local database name ends in `_test`, checked before connecting. Full suite passes on both engines (TR-AUD-02, TR-AUD-03, TR-FIX-01, TR-FIX-02) |
| 7 | Order lifecycle and server-side rules | Enforced on the server (D1: edit, status and delete only before Pass to Dispatch). PHP/JS rule parity test passes. Exception: the `import` action (H1) |
| 8 | XSS in modified frontend files | Table and modal output goes through `esc()`. SweetAlert2 messages were rendered as HTML (L1), now fixed |
| 9 | Export, rollback, restore | Round trip is lossless (rollback rehearsal test). Minor gaps: L3 to L5 |
| 10 | Existing functionality / unintended changes | `productionEngine.js`, `manufacturing/`, `includes/` (including `db.php`), `settings/`, `uploads/`, other APIs: unchanged since `6ee8500`. No inventory, invoice or payment files touched. `npm test` 14/14 |
| - | Credentials, dumps, test PDFs, temp files in Git changes | None. Only local `root`/blank defaults. `storage/delivery-pdfs/` is ignored and empty |
| - | Can the dev switch be enabled on production by accident? | The switch is set only by `cli/dev-server.cjs` and the tests. The repo has no `SetEnv`, `PassEnv`, `putenv`, `.user.ini` or `.env`. Request headers cannot set `APP_ENV`. After M1, the switch also requires PHP's built-in server |

## 3. Findings and decisions

### Fixed before commit

**M1: dev switch depended only on environment variables.** *Medium. Fixed.*
- Before: one mistaken `SetEnv APP_ENV development` plus `SetEnv ORDERS_ALLOW_UNAUTHENTICATED_DEV 1` in a Hostinger `.htaccess` would have opened the order APIs without login.
- Fix: [api/order-records.php:38](../api/order-records.php#L38) now also requires `PHP_SAPI === 'cli-server'` (PHP's built-in server, used only by `npm run dev`). Under Apache, LiteSpeed, FPM or CGI the API returns 401 whatever the environment says.
- Evidence: TC-05 in TR-FIX-05; real Apache 401 in TR-FIX-07.

**M2: PDF storage silently fell back into the web root.** *Medium. Fixed.*
- Before: if `DELIVERY_PDF_DIR` was unset on live, PDFs were written to `storage/delivery-pdfs` inside `public_html`.
- Fix in [api/order-records.php](../api/order-records.php) `ordersPdfDirectory()` (line 1097) plus the small helper `ordersInsideFolder()` (line 1084):
  - Outside `APP_ENV=development`, a missing `DELIVERY_PDF_DIR` returns **503**: "PDF storage is not configured".
  - Outside development, a configured folder that does not exist, is not writable, or lies inside the project folder or the web server's `DOCUMENT_ROOT` also returns **503**. The path comparison ignores case on Windows.
  - Nothing is created on live; the folder must already exist.
  - Local development behaves as before: the fallback `storage/delivery-pdfs` is used only while the deny-all `storage/.htaccess` exists.
- The CLI (`export`, `orphans`) follows the same rule, so live CLI use also needs `DELIVERY_PDF_DIR`.
- Evidence: TC-05 in TR-FIX-05. CLI export, restore and orphans still pass with a valid folder: TC-15 and TC-18 in TR-FIX-05.

**L1: SweetAlert2 rendered error messages as HTML.** *Low. Fixed.*
- Cause: SweetAlert2 treats the second argument of `Swal.fire(title, message, icon)` as HTML, and `showValidationMessage()` also renders HTML. Server messages can echo a typed barcode ([api/order-records.php:709](../api/order-records.php#L709), "Product … is not in the product list").
- Fix: the 7 calls now use the `text` option, or `esc()` before `showValidationMessage`:
  - [orderList.js:24](../assets/js/orderList.js#L24) and [orderList.js:140](../assets/js/orderList.js#L140);
  - [orderPunch.js:406](../assets/js/orderPunch.js#L406), [orderPunch.js:416](../assets/js/orderPunch.js#L416) and [orderPunch.js:460](../assets/js/orderPunch.js#L460);
  - [orderImport.js:115](../assets/js/orderImport.js#L115);
  - [delivery.js:13](../assets/js/delivery.js#L13).
- Same titles, messages, icons and follow-up actions, so the workflow is unchanged.
- Evidence: TC-06 (regression guard) in TR-FIX-05; real-browser check TR-FIX-06.

### Deferred to the authentication/security phase (required before live)

| ID | Item | Requirement |
| --- | --- | --- |
| H1 | `POST import` ([api/order-records.php:745](../api/order-records.php#L745) `ordersHandleAction`; import code [line 900](../api/order-records.php#L900) `ordersNormalizeImport`) accepts any status, quantities and delivery state, bypassing lifecycle rules | Import must be **admin-only**, or **disabled** once the one-time browser migration is complete. Today it is reachable only through the local dev switch (401 everywhere else) |
| A1 | Login, session security, API authorization and CSRF protection | Mandatory before live (owner decision D3). Covers the new order and PDF APIs **and** the existing master, product and manufacturing APIs, which had no login before Phase 1 either (L12) |

### Deferred low-priority items (recorded, no change now)

| ID | Finding | Location |
| --- | --- | --- |
| L2 | Imported timestamps accept relative words such as "tomorrow" (`new DateTime`) | `api/order-records.php:81` `ordersDbFromIso` |
| L3 | `export` writes `orders.json` before the PDF check; a failed export leaves a folder without a manifest (restore refuses it) | `cli/orders-admin.php:183` `commandExport` (lines 199, 206) |
| L4 | Export reads orders and PDFs in separate statements, not one snapshot; a PDF passed in between is handled safely by restore | `cli/orders-admin.php:197` and `:201` |
| L5 | Restore re-imports, so `legacyData` becomes the export snapshot and `importedAt` the restore time | `cli/orders-admin.php:217` `commandRestore` |
| L6 | `verify` checks tables, columns, indexes and foreign keys by name, not column types | `cli/orders-admin.php:61` `verifySchema` |
| L7 | Banner says orders "were not imported" even when only PDFs failed | `assets/js/orderImport.js:82` |
| L8 | PDFs marked `notInBrowser` stay candidates, so every page load fetches the full order list | `assets/js/orderImport.js:49` |
| L9 | Any valid PDF can fill a `missing` slot; it is not compared with the original size or name | `api/order-records.php:1197` `ordersAttachPdf` |
| L10 | `tests/` is readable over Apache. The PHP helpers exit at once outside the CLI, but the `.cjs` files can be downloaded | Web server configuration |
| L11 | GET returns every order; the whole catalog is loaded on each create, update and replace | `api/order-records.php` |
| L12 | Other APIs have no login (pre-existing, not introduced by Phase 1) | `api/master-records.php`, `api/product-records.php`, `api/manufacturing-state.php` |

## 4. Remaining risks

1. **No authentication (A1, H1).** Mitigated only by fail-closed 401 outside `php -S` with the dev switch. Do not deploy until A1 and H1 are done.
2. **Hostinger is unverified.** LiteSpeed's handling of `Require all denied` (`cli/`, `database/`, `storage/`) and where `DB_*` and `DELIVERY_PDF_DIR` are set are pending (Hostinger items H1 to H9 in [SAP_INTEGRATION.md](SAP_INTEGRATION.md)). M2 now fails closed if `DELIVERY_PDF_DIR` is wrong, but the deny rules must still be checked on live after deploy.
3. **Pre-existing unauthenticated APIs (L12).** Customer, product and manufacturing data can still be read and written without login on any deployed copy.
4. **Third-party scripts from a CDN** (SweetAlert2, jQuery and others) are loaded without Subresource Integrity. Pre-existing, outside Phase 1.
5. **Low items L2 to L11.** Accepted for now; none allows access without the dev switch.

## 5. Conditions for live deployment

- [ ] A1: login, sessions, API authorization, CSRF. **Implemented** on branch `feature/authentication` (section 8); not yet merged or deployed
- [ ] H1: import admin-only or disabled after migration. **Implemented** (admin-only) on `feature/authentication`; not yet merged or deployed
- [ ] On live after deploying authentication: `php cli/orders-admin.php migrate` (creates `appUsers`) and `php cli/users-admin.php create <username> admin`. Without them **nobody can sign in** (fail closed)
- [ ] `DELIVERY_PDF_DIR` set to an existing, writable folder outside `public_html` (otherwise 503 by design)
- [ ] `php cli/orders-admin.php migrate` run on live from SSH, after a backup
- [ ] Direct-access checks (403 on `cli/`, `database/`, `storage/`) repeated on the live server
- [ ] Hostinger items H1 to H9 answered
- [ ] QA blockers B1 to B6 (section 7) resolved

## 6. History

| Date | Event |
| --- | --- |
| 2026-11-12 | Read-only audit of the Phase 1 diff against `6ee8500`. Recommendation: PASS for commit to `sap_integration`, FAIL for merge or deploy until section 5 is done |
| 2026-11-12 | Owner accepted the audit. M1, M2 and L1 fixed; H1 and A1 deferred to the authentication phase; L2 to L12 recorded |
| 2026-11-12 | Owner merged PRs #1 to #3 into `main` (`084f41b`, `5212e03`, `745fb01`). Phase 1 and the `db.php` untracking are on `main`, against the recommendation in this audit's first history row (FAIL for merge or deploy) |
| 2026-11-12 | Focused QA on `6154194`: no application bugs found; deployment blockers B1 to B6 recorded (section 7) |
| 2026-11-12 | Owner reports Phase 1 merged and deployed. Authentication implemented on `feature/authentication` (section 8): A1 and H1 implemented, not committed |

## 7. Deployment blockers found in QA (2026-11-12, commit `6154194`)

Hostinger was **not** inspected; there is no access from this environment. The statements below come from the repository, the GitHub API and local tests.

| ID | Blocker | Evidence | Smallest next step |
| --- | --- | --- | --- |
| B1 | **`main` already contains Phase 1 and the `db.php` untracking** (PRs #1 to #3). If Hostinger deploys `main`: <br>• every order and PDF API returns **401**, because `ordersRequireAccess()` runs first and the dev switch only works under `php -S`; <br>• the deploy of PR #3 **deletes `includes/db.php`** on the server, so every database API fails ("Invalid server response") until `db.example.php` is copied to `db.php`. | `git merge-base`; GitHub API (`merge_commit_sha`). Which branch Hostinger deploys is not documented (Hostinger item H1). GitHub has 0 deployment records, so there is no evidence either way that a deploy happened | Check hPanel → Git for the branch and the last deploy. If `main` was deployed: copy `includes/db.example.php` to `includes/db.php` on the server at once, then decide between reverting PRs #1 to #3 on `main` or leaving Phase 1 live and disabled (401) |
| B2 | **`DELIVERY_PDF_DIR` cannot be set safely on Hostinger.** It is read only from the environment, and since M2 the PDF APIs return 503 without it. On shared hosting the usual place is a `SetEnv` line in `.htaccess`, but the root `.htaccess` is tracked, so deploys overwrite it | `api/order-records.php` `ordersPdfDirectory()` | Also read `DELIVERY_PDF_DIR` from the ignored `includes/db.config.php` (see the recommendation below) |
| B3 | **No login or API authorization** (A1), and the import action is not admin-only (audit H1) | Section 3 | Authentication phase |
| B4 | **CLI migration** needs SSH and PHP CLI on Hostinger (Hostinger item H8). Until it runs, the order APIs return 503 (after login exists) | `cli/orders-admin.php` | Confirm SSH access; back up; run `php cli/orders-admin.php migrate` |
| B5 | **PHP upload limits.** 10 MB PDFs need `upload_max_filesize` ≥ 11M and `post_max_size` ≥ 12M (Hostinger item H5). Local WAMP Apache has 2M/8M, so PDFs over 2 MB get a 413 there (`npm run dev` raises the limits) | Local `php.ini`; TR-QA-04 | Check and, if needed, raise in hPanel → PHP Configuration |
| B6 | **Live database configuration.** `includes/db.config.php` must exist on the server with the live values in the `<?php return [...];` shape, or the `DB_*` variables must be set. `includes/` has no deny rule: PHP files there run and print nothing (TR-QA-05), but a non-PHP copy (`db.config.php.bak`, `.txt`) would be served as plain text | `includes/db.example.php` `databaseConfigFile()`; local Apache check | Create the file once on the server; never leave copies under `public_html`. Optional later: a deny rule for `includes/db.config*` |

**Recommendation for B2 (not implemented; needs owner approval).** In `ordersPdfDirectory()`, fall back to the config file when the environment variable is empty:

```php
$configured = getenv('DELIVERY_PDF_DIR');
if (($configured === false || $configured === '') && function_exists('databaseConfigFile')) {
    $configured = (string) (databaseConfigFile(dirname(__DIR__) . '/includes/db.config.php')['DELIVERY_PDF_DIR'] ?? '');
}
```

Add `'DELIVERY_PDF_DIR' => '/home/<account>/delivery-pdfs'` to `includes/db.config.example.php`, and extend TC-05 with a config-file case.
- **Safe:** the file is ignored by Git, lives only on the server, already holds the database password, and is loaded through the same validation (a malformed file is ignored and logged).
- **Unchanged checks:** M2 still applies. Outside development the folder must exist, be writable and lie outside the project and web root, otherwise 503.
- **Old servers:** `function_exists` keeps this safe on a server whose untracked `db.php` predates `databaseConfigFile()`.

## 8. Authentication and authorization (Phase 2, branch `feature/authentication`, 2026-11-12)

**Starting point.** The repository had no login: no user table, no `employeeusers` table, no `permission-helper.php`, no sessions, no CSRF protection. `login.php` was a template whose Sign In button only linked to the dashboard. `employeeRecords` holds production workers (cutting, stitching, ironing) and has no login fields, so it was not reused for accounts.

**Owner decisions (2026-11-12):**
- Two roles: **admin**, who can do everything, and **employee**, who uses Order Booking and Manufacturing, including BOM Master's quick-add of colours and items.
- Settings pages and other master-data changes are admin-only. Order import is admin-only.
- Accounts are managed with a CLI command plus an admin Users page.

### What was implemented

| Requirement | Implementation |
| --- | --- |
| Admin and employee sign-in and sign-out | `login.php`: the existing form now posts with a CSRF token. `logout.php`: POST with the CSRF token only. Log Out is in the header menu of every page |
| Accounts | One new table, `appUsers` (CLI migration `database/cli-migrations/20261112_002_app-users.sql`). Managed with `php cli/users-admin.php` and the admin page **Settings → Users** (`settings/users.php`, `api/users.php`). There is no default account |
| Password hashing | `password_hash(PASSWORD_DEFAULT)` (bcrypt), rehashed on sign-in when needed. Minimum 8 characters. An unknown username is checked against a dummy hash, so timing does not reveal it |
| Brute force | 5 wrong passwords lock the account for 15 minutes. An admin password reset unlocks it |
| Session security | Cookie `ORDERBOOKINGSESSID`: `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS, strict mode, cookies only. The session ID is regenerated at sign-in (no fixation). The session is destroyed at sign-out |
| Expiry | 2 hours idle and 12 hours absolute (`AUTH_IDLE_SECONDS`, `AUTH_ABSOLUTE_SECONDS`). Each request re-checks the account. Disabling it, changing its role or resetting its password (`authVersion`) signs the user out at once |
| Page protection | `includes/header.php` (Order Booking and Manufacturing) requires any signed-in user; `includes/header2.php` (Settings) requires an admin. This also covers direct requests to page files. Signed-out visitors go to the sign-in page and return afterwards (`next`, restricted to app routes) |
| API authentication and roles | `authRequireApi()` in every handler (`masterRecords`, `manufacturingRecords`, `productRecords`, `ordersApi`, `ordersPdfApi`, `manufacturing-state.php`, `patterns.php`, `usersApi`). Returns 401 when signed out and 403 without the role. The rules are one table, `AUTH_API_RULES` in `includes/auth.php`. Unlisted resources are admin-only |
| CSRF | Every POST, PUT or DELETE to an API needs the `X-CSRF-Token` header matching the session's token. A small fetch hook in the page `<head>` adds it to every same-origin change, including those from `productionEngine.js`, which is unchanged. Forms (sign-in, sign-out) carry a hidden token |
| Admin-only import | `action: import` and the PDF `mode=import` return 403 for employees. Employees see a note ("an administrator must sign in on this computer") instead of the import prompt |
| Delivery PDFs | Upload needs sign-in and CSRF. Download needs sign-in. Both are open to admin and employee. File checks and private download headers are unchanged |
| Expired session in the browser | An API 401 with `loginRequired` sends the page to `login?expired=1&next=<page>` |

**API access (`AUTH_API_RULES`):**

| Resource | Read | Create (POST) | Change or delete |
| --- | --- | --- | --- |
| orders, delivery-pdf, customer, manufacturing-state, bom | any | any | any (order/PDF import: admin) |
| colour, item-list | any | any (BOM Master quick-add) | admin |
| agent, distributor, transporter, employee, piece-item-list, additional-work, patterns, product | any | admin | admin |
| users | admin | admin | admin |

### Not changed
- Order rules, dispatch, Replace and delivery logic.
- Manufacturing and `productionEngine.js`, inventory.
- Screen layouts, apart from the sign-in form, the "Signed in as" line, Log Out, and the Users page.

The Phase 1 test switch (`authDevBypass`, PHP built-in server only) now covers all APIs. Only `npm run test:orders` sets it; `npm run dev` no longer does, so local development signs in like the live site.

### Remaining security issues

| ID | Issue | Severity |
| --- | --- | --- |
| R1 | `api/bom.php` and `api/product.php` share `productRecords()`. An employee may write through `bom.php` (BOM Master), so they could also send product-style changes there. **Fixed 2026-11-12, see below** | ~~Low~~ Fixed |
| R2 | The lock-out is per account. Anyone can lock a known username for 15 minutes with wrong passwords. There is no per-IP limit, which would need a new table | Low |
| R3 | The "too many attempts" and "account disabled" messages reveal that an account exists (the disabled one only after a correct password) | Low |
| R4 | CDN scripts (SweetAlert2, jQuery plugins and others) load without Subresource Integrity. With sessions, a compromised CDN could act as the signed-in user. This predates Phase 2 | Medium |
| R5 | `index.php` falls back to `"<route>.php"` for any top-level PHP file (pre-existing). `login` and `logout` use it; `config.php`, `403.php` and `404.php` are also reachable but harmless | Low |
| R6 | No multi-factor authentication or password-complexity rules beyond a minimum length of 8 | Low |
| R7 | Deployment blockers B2 and B4–B6 (section 7) still apply. B4 (SSH for the CLI) now also gates account creation | Blocker |
| R8 | Low items L2–L11 (section 3) are unchanged | Low |

### R1 fix: BOM and Product share one handler (2026-11-12)

**Request paths** in `productRecords($mode)` (`api/product-records.php`). `bom.php` passes `mode=bom` and its writes are open to any signed-in user. `product.php` passes `mode=product` and its writes are admin-only.

| Action (via `bom.php`) | Data written | Before the fix (employee) |
| --- | --- | --- |
| `save`, no `id` | New `productRecords` row, `inProductList = 0` (a BOM only) | Allowed. BOM Master work |
| `save`, `id` of a BOM-only row | Brand, design number, colour, pattern, MRP, photo, pieces, link tables | Allowed. BOM Master work |
| `save`, `id` of a row **in the Product List** | The same columns, which include the product's brand, design number, colour (its barcode) and photo | **Allowed: product change by an employee** |
| `status` | `status` only | Allowed. Active BOMs are the ones selectable for batches |
| `DELETE` | Removes the row, its photo and its link tables | **Allowed for Product List rows: product deletion by an employee** |
| `import` | `inProductList = 1` | Already refused with 422 in BOM mode |
| (side path) piece-item insert in `save` | `pieceItemList` | In BOM mode, any new piece item fails the pattern check, and the transaction is rolled back, so nothing is written |

Colour and item quick-add in BOM Master do not use this handler. They go to `api/colour.php` and `api/item-list.php`, which already allow create for any user and change or delete for admins only.

**Fix** (one flag and two checks, at the action level, BOM mode, non-admin, row with `inProductList = 1`):
- `DELETE` → 403 "Only an administrator can delete a product that is in the Product List."
- `save` that changes brand, design number or colour, or uploads a photo → 403. Nothing is written: the check runs before the photo is stored and before the transaction.
- Still allowed for employees on those rows: completing or editing the BOM (pattern, MRP, pieces) and the active/inactive status. That is the existing BOM Master workflow, including "In Progress" products created on the Product page.
- Admins: unchanged.
- The product, BOM and manufacturing rules are unchanged, and the API is not split.

**Effect on screens:**
- BOM Master still shows the Delete button on Product List rows for employees. Clicking it now shows the server message instead of deleting.
- For the same rows, changing brand, design number, colour or photo gives the same kind of message.

**Owner choices made in the fix** (each can be reversed by editing one line):
- MRP of a listed product stays changeable by employees, because only BOM Master can change it today (the Product page keeps the old MRP).
- The photo counts as a product field.

**New finding R9 (pre-existing on `main`, not authorization):** BOM Master's "add item" sends only `{name}`, but `api/item-list.php` requires `itemType` (Cutting or Non-Cutting). Quick-add of an item therefore fails with 422 "Select Cutting or Non-Cutting for this item." for everyone, admins included. Adding a colour works. Not changed here, because fixing it would change the BOM Master form or the item rule; owner decision needed.

### Owner decisions and final changes (2026-11-12)

**Decisions:**
- MRP of a listed product: employees may edit it.
- Photo, brand, design number, colour and deletion of a listed product: admin-only. This confirms the R1 fix as implemented.

**R9 fixed: BOM Master item quick-add.**
- **Cause, found while fixing:** commit `d48168e` (2026-10-26) made `itemType` required in `api/item-list.php` and, in the same commit, removed the "+" button from each piece's Item List. The click handler stayed but could no longer be reached, so items could only be added on Settings → Item List.
- **Change, front end only:**
  - The button is restored, byte-identical to its earlier markup (`f128d03`).
  - The quick-add editor now has a required **Item Type** selector (Cutting / Non-Cutting), the same options as Settings → Item List.
  - The page stops with "Select Cutting or Non-Cutting." if none is chosen.
  - The selected type is sent as `itemType` to the existing API.
  - One CSS line keeps the selector inline.
- **Not changed:** API validation and item rules. A request without a type is still refused with 422.
- **Owner check:** restoring the button brings back a control that was removed on 2026-10-26. If that removal was intended for another reason, delete the one restored `<button>`; the selector code then stays unused and harmless.

### Final review of `feature/authentication` (2026-11-12)

**Checked:**
- `includes/auth.php`, `includes/users.php`, `api/users.php`, the guards in every file under `api/`, `login.php`, `logout.php`, both headers, `cli/users-admin.php`, the Users page, the R1 guard and the R9 change.
- All 20 files under `api/` reach a guarded handler.
- No page sends changes with jQuery `$.ajax`, `$.post` or `XMLHttpRequest`, so the fetch hook covers every state change. The only HTML forms are sign-in and sign-out, and both carry `_csrf`.
- Output is escaped in the header ("Signed in as"), on the sign-in page and on the Users page.
- Redirect targets (`next`) are limited to app routes.
- Sessions:
  - strict mode, cookies only;
  - session ID regenerated at sign-in;
  - checked against the database (`active`, `authVersion`) on every request.
- Database errors fail closed (401 or 503).

**No new blocking issues.** One new low item:

| ID | Issue | Severity |
| --- | --- | --- |
| R10 | The failed-sign-in counter is read, then written (not `failedLogins = failedLogins + 1`). Simultaneous wrong passwords can therefore exceed 5 slightly before the lock applies | Low |

**Still open:** R2 to R8 above, and deployment blockers B2 and B4–B6 (section 7). The deploy order is unchanged: merge, then `php cli/orders-admin.php migrate`, then `php cli/users-admin.php create <username> admin`.

**Local test accounts (owner request):** created in the owner's **local** database only.
- The database is `order-booking`, MySQL 8.4 on 127.0.0.1:3306. It was migrated for this, after a `mysqldump` backup.
- Usernames: `testadmin` (admin) and `teststaff` (employee). The passwords were given in the session, not written to any file.
- Not for the live server: create live accounts there with the CLI.
