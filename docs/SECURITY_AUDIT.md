# Security audit: SAP Phase 1 (orders, dispatch, delivery)

| | |
| --- | --- |
| Scope | Full Phase 1 change set on branch `sap_integration` against base commit `6ee8500` (15 modified files, 19 new files) |
| Audit date | 2026-11-12 |
| Method | Read-only code and security review, test runs, a real-browser PDF retry scenario, and `curl` checks against WAMP Apache and the `php -S` dev router. Guidelines applied: Karpathy guidelines (Andrej), ECC `mysql-patterns` and `database-migrations` |
| Owner decision | Audit accepted. M1, M2 and the SweetAlert2 issue fixed before commit. H1 and authentication deferred to the authentication/security phase |
| Status | Fixes applied locally. **Not committed, pushed, merged or deployed.** Live deployment stays blocked (section 5) |

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

- [ ] A1: login, sessions, API authorization, CSRF
- [ ] H1: import admin-only or disabled after migration
- [ ] `DELIVERY_PDF_DIR` set to an existing, writable folder outside `public_html` (otherwise 503 by design)
- [ ] `php cli/orders-admin.php migrate` run on live from SSH, after a backup
- [ ] Direct-access checks (403 on `cli/`, `database/`, `storage/`) repeated on the live server
- [ ] Hostinger items H1 to H9 answered

## 6. History

| Date | Event |
| --- | --- |
| 2026-11-12 | Read-only audit of the Phase 1 diff against `6ee8500`. Recommendation: PASS for commit to `sap_integration`, FAIL for merge or deploy until section 5 is done |
| 2026-11-12 | Owner accepted the audit. M1, M2 and L1 fixed; H1 and A1 deferred to the authentication phase; L2 to L12 recorded |
