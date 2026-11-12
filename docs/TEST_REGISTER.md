# Test register

Every test case has a fixed ID (`TC-…`). Every execution is logged as a run (`TR-…`), with the exact command, environment, code version and result.

**Do not edit or delete past runs.** They are historical evidence. Add new runs at the end of section 3.

Related: [SECURITY_AUDIT.md](SECURITY_AUDIT.md), [SAP_INTEGRATION.md](SAP_INTEGRATION.md) section 10.

## 1. Environment

| Component | Version |
| --- | --- |
| OS | Windows 11 (WAMP) |
| PHP CLI | 8.3.28 (ZTS, x64) |
| Node.js | v24.14.1 |
| MariaDB | 11.4.9 on 127.0.0.1:3307 (default test database server) |
| MySQL | 8.4.7 on 127.0.0.1:3306 (`lower_case_table_names=1`) |
| Apache | WAMP Apache on `http://localhost/order-bookings` |
| Browser | Headless Google Chrome (DevTools protocol), separate temporary profiles |

Test databases are local only. The harness ([tests/helpers/orders-env.cjs](../tests/helpers/orders-env.cjs)) refuses any database whose name does not end in `_test`, and any host other than 127.0.0.1 or localhost. The default is `order_booking_test`.

**Code versions:**
- Runs before the first commit say `6ee8500 + working tree` (base commit plus uncommitted changes on `sap_integration`).
- From TR-FIX-05 on, the code is also identified by a fingerprint computed with:

```sh
git ls-files -co --exclude-standard -z -- api assets cli database tests orderBooking includes storage package.json .htaccess .gitignore | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-16
```

The fingerprint covers code and tests, not `*.md` documentation in `docs/`.

## 2. Test case catalogue

### Unit tests: `npm test` (`node --test tests/*.test.cjs`)

| ID | File | Covers |
| --- | --- | --- |
| TC-U01 | [tests/parallel-piece-routing.test.cjs](../tests/parallel-piece-routing.test.cjs) | Production engine piece routing |
| TC-U02 | [tests/production-damage-flow.test.cjs](../tests/production-damage-flow.test.cjs) | Production engine damage flow |

Together: 14 test cases.

### Phase 1 integration tests: `npm run test:orders`

| ID | File:line | Test | Since |
| --- | --- | --- | --- |
| TC-01 | [order-rules-parity.integration.cjs:80](../tests/order-rules-parity.integration.cjs#L80) | `php -l` on every Phase 1 PHP file | Phase 1 |
| TC-02 | [order-rules-parity.integration.cjs:88](../tests/order-rules-parity.integration.cjs#L88) | PHP order rules = browser rules for every fixture | Phase 1 |
| TC-03 | [orders-api.integration.cjs:41](../tests/orders-api.integration.cjs#L41) | 503 until CLI migration verified; migrate idempotent | Phase 1 |
| TC-04 | [orders-api.integration.cjs:57](../tests/orders-api.integration.cjs#L57) | Production fails closed (401) without the full dev switch | Phase 1 |
| TC-05 | [orders-api.integration.cjs:69](../tests/orders-api.integration.cjs#L69) | Dev switch only under PHP built-in server (M1); PDF storage 503 if unset, missing or inside the project (M2) | Audit fixes |
| TC-06 | [orders-api.integration.cjs:90](../tests/orders-api.integration.cjs#L90) | SweetAlert2: messages never passed as HTML (L1 regression guard) | Audit fixes |
| TC-07 | [orders-api.integration.cjs:100](../tests/orders-api.integration.cjs#L100) | Create: server validation, database snapshots | Phase 1 |
| TC-08 | [orders-api.integration.cjs:134](../tests/orders-api.integration.cjs#L134) | D1: edit, status, delete only before Pass to Dispatch; versions | Phase 1 |
| TC-09 | [orders-api.integration.cjs:165](../tests/orders-api.integration.cjs#L165) | Scan, Replace, pass-to-delivery rules | Phase 1 |
| TC-10 | [orders-api.integration.cjs:215](../tests/orders-api.integration.cjs#L215) | Concurrency a: 30 scans on 10 pieces → 10 | Phase 1 |
| TC-11 | [orders-api.integration.cjs:224](../tests/orders-api.integration.cjs#L224) | Concurrency b: scans across 3 lines, no lost update | Phase 1 |
| TC-12 | [orders-api.integration.cjs:233](../tests/orders-api.integration.cjs#L233) | Concurrency c, d: duplicate delivery → one batch; over-delivery refused | Phase 1 |
| TC-13 | [orders-api.integration.cjs:247](../tests/orders-api.integration.cjs#L247) | Concurrency e: simultaneous PDF passes → one file | Phase 1 |
| TC-14 | [orders-api.integration.cjs:260](../tests/orders-api.integration.cjs#L260) | Concurrency f: unique IDs; taken order number skipped | Phase 1 |
| TC-15 | [orders-api.integration.cjs:284](../tests/orders-api.integration.cjs#L284) | PDF security: limits, MIME, signature, headers, one pass, orphans | Phase 1 |
| TC-16 | [orders-api.integration.cjs:347](../tests/orders-api.integration.cjs#L347) | Import: idempotent, conflicts, invalid, never overwrites | Phase 1 |
| TC-17 | [orders-api.integration.cjs:402](../tests/orders-api.integration.cjs#L402) | Concurrency g: same import from two browsers, no duplicates | Phase 1 |
| TC-18 | [orders-api.integration.cjs:419](../tests/orders-api.integration.cjs#L419) | Rollback rehearsal: export, dump, drop, restore, down/migrate, restore. **Skips** if `mysqldump` is not found (`MYSQL_BIN_DIR`). Needs the data created by TC-07 to TC-17, so it cannot run on its own | Phase 1 |
| TC-19 | [orders-api.integration.cjs:481](../tests/orders-api.integration.cjs#L481) | Direct web access denied (dev router; and Apache). **Skips** the Apache part, and reports the test as skipped, if `APACHE_BASE_URL` (default `http://localhost/order-bookings`) is unreachable. When Apache is reachable it writes and removes a probe PDF in `storage/delivery-pdfs/` | Phase 1 |

TC-01 to TC-04 and TC-07 to TC-19 are the original 17 Phase 1 tests. TC-05 and TC-06 were added for the audit fixes, so `test:orders` now has **19** tests.

### Manual and scripted checks (not in `npm` scripts)

These scripts live in the session scratchpad, outside the repository, so they are not version-controlled. They use a scratch database `order_booking_audit_test` (MariaDB) that is dropped afterwards, and scratch PDF folders that are deleted.

| ID | Check | How |
| --- | --- | --- |
| TC-M01 | Two-browser end-to-end (two Chrome profiles as two PCs) | `node e2e.cjs` against `npm run dev` |
| TC-M02 | Browser PDF import retry: network failure, then lost response, then reload | `node pdf-retry.cjs` (own `php -S` on 127.0.0.1:8090, Fetch interception) |
| TC-M03 | SweetAlert2 text rendering on a real page, plus library behaviour | `node swal-text.cjs` (own `php -S` on 127.0.0.1:8092) |
| TC-M04 | Direct-access and bypass checks with `curl --path-as-is` on Apache and on the dev router | See TR-AUD-05 |

## 3. Execution log

### Phase 0 and Phase 1 implementation (historical)

| Run | Date | Command | DB | Code version | Result |
| --- | --- | --- | --- | --- | --- |
| TR-P0-01 | 2026-11-12 | `npm test` | - | `6ee8500` | 14 passed, 0 failed |
| TR-P1-01 | 2026-11-12 | `npm test` | - | `6ee8500 + working tree` (Phase 1) | 14 passed, 0 failed |
| TR-P1-02 | 2026-11-12 | `npm run test:orders` | MariaDB 11.4.9 | `6ee8500 + working tree` (Phase 1) | **17 tests: 17 passed, 0 failed, 0 skipped** (run 5 times). Apache was reachable, so TC-19 ran in full |
| TR-P1-03 | 2026-11-12 | `TEST_DB_PORT=3306 MYSQL_BIN_DIR=C:/wamp64/bin/mysql/mysql8.4.7/bin npm run test:orders` | MySQL 8.4.7 | `6ee8500 + working tree` (Phase 1) | **17 tests: 17 passed, 0 failed, 0 skipped** |
| TR-P1-04 | 2026-11-12 | TC-M01 | Local development database (`npm run dev`) | `6ee8500 + working tree` (Phase 1) | 26 of 26 checks |
| TR-P1-05 | 2026-11-12 | `curl` on Apache without the dev switch | - | `6ee8500 + working tree` (Phase 1) | Order and PDF APIs 401; `cli/`, `storage/`, `database/` 403 |
| TR-P1-06 | 2026-11-12 | Mutation check: row locks and compare-and-set removed, TC-10 and TC-11 run | MariaDB 11.4.9 | Temporarily mutated, then restored | TC-10 and TC-11 **failed as intended**; code restored |

### Read-only security audit (historical)

Code version for all audit runs: `6ee8500 + working tree`, Phase 1 as implemented, before the audit fixes. No fingerprint was recorded.

| Run | Command | DB | Result |
| --- | --- | --- | --- |
| TR-AUD-01 | `npm test` | - | 14 passed, 0 failed |
| TR-AUD-02 | `APACHE_BASE_URL=http://127.0.0.1:1 npm run test:orders` | MariaDB 11.4.9 | **17 tests: 16 passed, 0 failed, 1 skipped** (TC-19, Apache deliberately unreachable) |
| TR-AUD-03 | `APACHE_BASE_URL=http://127.0.0.1:1 TEST_DB_PORT=3306 MYSQL_BIN_DIR=C:/wamp64/bin/mysql/mysql8.4.7/bin npm run test:orders` | MySQL 8.4.7 | **17 tests: 16 passed, 0 failed, 1 skipped** (TC-19) |
| TR-AUD-04 | TC-M02 | MariaDB 11.4.9 (scratch) | 17 of 18 checks. The one failure is browser exceptions from `assets/js/custom.js` (simplebar) and `assets/js/salesDashboard.js` (apexcharts). Both are unchanged since `6ee8500`, so these errors existed before Phase 1. All retry, no-duplicate, `importedAt` and download-header checks passed |
| TR-AUD-05 | TC-M04 | - | Apache: 403 for `storage/`, `storage./`, `cli/`, `cli./`, `database/cli-migrations/`; 401 for `api/orders.php`; 200 with empty body for `tests/helpers/test-db.php` (exits at once outside the CLI, see L10). Dev router: 403 or 404 for every variant |

### Why 17 tests passed before but only 16 in the audit

Nothing broke. The only difference is that **TC-19 was skipped on purpose** in the audit.

- `npm run test:orders` had 17 tests: 2 in the parity file and 15 in the API file.
- In TR-P1-02 and TR-P1-03, WAMP Apache was reachable, so TC-19 ran and passed: **17 passed**.
- The audit had to be read-only. TC-19 writes a probe PDF into `storage/delivery-pdfs/` inside the repository whenever Apache is reachable ([orders-api.integration.cjs:481](../tests/orders-api.integration.cjs#L481)). So the audit ran with `APACHE_BASE_URL=http://127.0.0.1:1`, an unreachable address. TC-19 then reports itself as skipped ("NOT RUN: Apache not reachable"): **16 passed, 1 skipped, 0 failed**.
- The Apache checks TC-19 would have made were done by hand instead, read-only (TR-AUD-05).
- The audit report said "16 pass, 0 fail" and mentioned the skip only separately. The total was 17 throughout.

### Why "17 passed + 1 skipped" became "18 passed + 1 skipped" after adding two tests

The two new tests were added at different times, and the "17 + 1" runs already included the first one.

| Runs | Tests in `test:orders` | Passed | Skipped (TC-19) |
| --- | --- | --- | --- |
| TR-AUD-02, TR-AUD-03 (audit, before fixes) | 17 (original) | 16 | 1 |
| TR-FIX-01, TR-FIX-02 (intermediate) | 18 = 17 + **TC-05** | 17 | 1 |
| TR-FIX-05 (final) | 19 = 18 + **TC-06** | 18 | 1 |

- Against the audit baseline, two tests were added (TC-05, TC-06), and the passed count rose by two (16 → 18).
- Between the intermediate and final runs only TC-06 was added, so the passed count rose by one (17 → 18).
- TC-05 was extended for the folder-location checks; it remained one test.
- TC-19 is skipped in every one of these runs, on purpose (`APACHE_BASE_URL=http://127.0.0.1:1`).
- No test failed in TR-AUD-02, TR-AUD-03, TR-FIX-01, TR-FIX-02 or TR-FIX-05.

### Audit fixes (M1, M2, L1)

| Run | Command | DB | Code version | Result |
| --- | --- | --- | --- | --- |
| TR-FIX-01 | `npm test`; then `APACHE_BASE_URL=http://127.0.0.1:1 npm run test:orders` | MariaDB 11.4.9 | Intermediate: M1 plus M2 for an unset folder only; TC-05 first version (no TC-06) | `npm test` 14/14. `test:orders` **18 tests: 17 passed, 0 failed, 1 skipped** (TC-19). Superseded by TR-FIX-05 |
| TR-FIX-02 | `APACHE_BASE_URL=http://127.0.0.1:1 TEST_DB_PORT=3306 MYSQL_BIN_DIR=C:/wamp64/bin/mysql/mysql8.4.7/bin npm run test:orders` | MySQL 8.4.7 | Same intermediate code as TR-FIX-01 | **18 tests: 17 passed, 0 failed, 1 skipped** (TC-19) |
| TR-FIX-03 | `php -l api/order-records.php`; `node --check` on `orderList.js`, `orderPunch.js`, `orderImport.js`, `delivery.js` | - | Final (`3c0b01c08affb097`) | No syntax errors |
| TR-FIX-04 | `APACHE_BASE_URL=http://127.0.0.1:1 node --test --test-concurrency=1 --test-name-pattern="APIs stay disabled\|dev switch works\|production mode fails closed\|text, never as HTML\|PDF security\|concurrency e\|rollback rehearsal" tests/orders-api.integration.cjs` | MariaDB 11.4.9 | Final (`3c0b01c08affb097`) | 7 tests: 6 passed, **1 failed: TC-18**. TC-18 needs the data created by TC-07 to TC-17, which this filtered run left out (`ordersA.length > 20` was false). Not a code failure; TR-FIX-05 runs TC-18 in full |
| TR-FIX-05 | `APACHE_BASE_URL=http://127.0.0.1:1 npm run test:orders` | MariaDB 11.4.9 | Final (`3c0b01c08affb097`) | **19 tests: 18 passed, 0 failed, 1 skipped** (TC-19, Apache deliberately unreachable). Includes TC-05, TC-06 and TC-18 |
| TR-FIX-06 | TC-M03 | MariaDB 11.4.9 (scratch, not migrated) | Final (`3c0b01c08affb097`) | **5 of 5.** Results: <br>• Order Punch "Not Found!" still shows the server message, now as text, with the same warning icon. <br>• The old shorthand renders HTML (the issue confirmed). <br>• The `text` option and `esc()` + `showValidationMessage` show the characters as text. |
| TR-FIX-07 | `curl http://localhost/order-bookings/api/orders.php` and `.../api/delivery-pdf.php?batchId=x` | - | Final (`3c0b01c08affb097`) | Both **401** on real Apache |

**Not repeated after the final changes, and why:**
- **MySQL 8.4 suite.** After TR-FIX-02 the only changes were the PDF folder check (filesystem, no SQL), front-end popup calls and tests. TR-FIX-02 already covers every SQL path on MySQL 8.4.
- **`npm test`.** The production engine and its tests were not touched. TR-FIX-01 ran it after the PHP access change: 14/14.
- **TC-M01 and TC-M02.** Neither touches the changed code paths beyond what TC-05, TC-06 and TR-FIX-06 check.

### Database configuration fix (`includes/db.config.php`)

Code version: commit `a6ad9b9` plus working tree, fingerprint `cd5a0d3a5f6a6b32`.

| Run | Command / check | DB | Result |
| --- | --- | --- | --- |
| TR-DB-01 | `php -l includes/db.php includes/db.config.example.php` | - | No syntax errors |
| TR-DB-02 | `git check-ignore -v includes/db.config.php`; `git ls-files -ci --exclude-standard` | - | `db.config.php` ignored. `db.php` and the example are tracked and no longer ignored. Only `uploads/` stays tracked-but-ignored, on purpose |
| TR-DB-03 | Temporary `includes/db.config.php` pointing to `order_booking_test` on 3307 (deleted afterwards), with `DB_*` env unset: `SELECT @@port, DATABASE()` | MariaDB 11.4.9 | `3307 order_booking_test`, so the config file is used |
| TR-DB-04 | Same file, plus `DB_NAME=order_booking_envwins_test` | MariaDB 11.4.9 | `Unknown database 'order_booking_envwins_test'`, so the env var wins over the file |
| TR-DB-05 | `APACHE_BASE_URL=http://127.0.0.1:1 npm run test:orders` (env-var path used by every API and CLI test) | MariaDB 11.4.9 | **19 tests: 18 passed, 0 failed, 1 skipped** (TC-19, on purpose) |
| TR-DB-06 | `curl http://localhost/order-bookings/order-list` on WAMP Apache, no config file | MySQL 8.4.7 (defaults) | 200 |

Not repeated, and why:
- **MySQL 8.4 suite:** no SQL changed.
- **`npm test`:** it does not use `db.php`.

### Malformed `db.config.php` ("Invalid server response. Check database setup.")

Code version: commit `9f7677b` plus working tree, fingerprint `24d7e2bd3eeeac15`.

**Before the fix**, run against local Apache with `display_errors = On`; checked `GET api/bom.php`:
- A config file that was a copy of the old `db.php` returned **non-JSON**: a fatal "cannot redeclare `database()`".
- A plain-text config without `<?php` returned **non-JSON**: the text was printed before the JSON.

Both give the browser message "Invalid server response. Check database setup." A correct config, or none at all, returned JSON.

**After the fix:**

| Run | Check | Result |
| --- | --- | --- |
| TR-DB-07 | Same calls with these config files: copy of old `db.php`; plain text; `<?php` without `return`; UTF-8 BOM + correct `return`; correct; correct with a wrong password; no file | All return **JSON**. Malformed files are ignored, and the reason is written to the PHP error log. A wrong password gives the normal 503 JSON "Unable to save/load product…" |
| TR-DB-08 | `APACHE_BASE_URL=http://127.0.0.1:1 npm run test:orders` (MariaDB 11.4.9) | **19 tests: 18 passed, 0 failed, 1 skipped** (TC-19, on purpose) |
| TR-DB-09 | Wrong credentials, no config file, `display_errors=0` (simulated live) | Every catalog and master endpoint returns 503 JSON, so missing credentials alone do not cause "Invalid server response" |
