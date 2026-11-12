# Project Overview: Order Booking & Garment Production

> Context for an AI assistant. Read this before suggesting changes. Last checked against commit `6ee8500` (2026-11-12).

## 1. What the app is

The app is a PHP web application for a garment manufacturer (brands: Little Dolly, Amari, Nivi Blossom). It has three areas:

1. **Order Booking**: customers, orders, dispatch and delivery.
2. **Manufacturing**: BOM, batches, approval, and production stages through to finished-goods inventory.
3. **Settings / masters**: agents, distributors, transporters, employees, colours, items, additional works, patterns and products.

It is deployed from GitHub (`pkmewada/order-booking`) to Hostinger.

## 2. Tech stack

| Item | Detail |
| --- | --- |
| Server | PHP with Apache. The router is `index.php` plus `.htaccess`. |
| Database | **MySQL** through PDO (`includes/db.php`). Credentials come from the `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD` environment variables, otherwise from `includes/db.config.php` (one per server, ignored by Git; template `includes/db.config.example.php`). The fallback is XAMPP `root` with no password. `includes/db.php` is tracked code and must not hold credentials. |
| Schema | `database/order-booking.sql` is the full schema. Files in `database/migrations/` run automatically on the first API call after a deploy (`includes/schema-migrations.php`, tracked in `appSchemaMigrations`). |
| APIs | `api/*.php` return JSON: `{success, data}` or `{success:false, message}`. They use prepared statements. |
| Frontend | jQuery, Bootstrap 5 (Mamix template), SweetAlert2, DataTables, html5-qrcode / qrcode.js, SheetJS. |
| Auth | **None.** `login.php` is a template page. Pages and APIs are open to anyone with the URL. |

## 3. Routing and folders

- `.htaccess` sends every URL that isn't a real file to `index.php?url=...`.
- `index.php` maps the first URL segment through `$pageRoutes`; for example, `bom-master` loads `manufacturing/bomMaster.php`. If a segment isn't listed, it falls back to `<segment>.php`, and then to `404.php`.

| Folder | Contents |
| --- | --- |
| `orderBooking/` | customerCreation, orderPunch, orderList, dispatch, dispatchConfirm, delivery, dashboard |
| `manufacturing/` | bomMaster, batch, batchApproval, requirements, cuttingManager, additional-work-manager (Embroidery, Digital Print, Screen Print, Handwork, Peco), stitchingManager, ironing, packing, bundling, inventory, stock, finalProduction, damageRepair, autoPass, productManager |
| `settings/` | agent, distributor, transporter, employee, colour, itemList, additionalWork, pattern, productCreation, productForm, settings |
| `api/` | one endpoint per resource, plus the shared handlers `master-records.php`, `manufacturing-records.php` and `product-records.php` |
| `assets/js/` | page scripts in camelCase (`bomMaster.js`, `orderPunch.js`, …) and the shared `productionEngine.js` |
| `database/` | schema and migrations (blocked from web access). `database/cli-migrations/` is applied only by `php cli/orders-admin.php migrate` |
| `cli/` | command-line tools (`orders-admin.php`) and the local dev server (`dev-server.cjs`, `dev-router.php`); blocked from web access |
| `storage/` | local fallback for delivery PDFs (deny-all `.htaccess`; contents ignored by Git) |
| `uploads/products/` | product photos (random file names; listing and script execution blocked) |
| `docs/` | `flow.md` (flow and table register), `databaseReadme.md`, `productionFlow.md`, `packingBundlingInventory.md`, `claude.md` |

## 4. Where data is saved

| Data | Saved in | API | Table(s) |
| --- | --- | --- | --- |
| Agents, distributors, transporters | MySQL | `api/agent.php`, `distributor.php`, `transporter.php` | `agents`, `distributors`, `transporters` |
| Customers | MySQL | `api/customer.php` | `customerRecords` |
| Employees, colours, items, additional works, piece items | MySQL | `api/employee.php`, `colour.php`, `item-list.php`, `additional-work.php`, `piece-item-list.php` | `employeeRecords`, `colourRecords`, `itemList`, `additionalWork`, `pieceItemList` |
| Patterns | MySQL | `api/patterns.php` | `patternRecords`, `patternPieceLinks` |
| BOM / products (one shared catalog) | MySQL | `api/bom.php`, `api/product.php` | `productRecords`, `productItemLinks`, `productWorkSteps` (`productWorkLinks` is legacy) |
| All production state (batches, approval, requirements, every stage, packing, bundling, inventory, repairs) | MySQL, stored as JSON with one row per key | `api/manufacturing-state.php` | `manufacturingState`, `manufacturingStateMeta` |
| Orders, dispatch, delivery (branch `sap_integration`, local only) | MySQL | `api/orders.php` (logic in `api/order-records.php`) | `customerOrders`, `customerOrderItems`, `deliveryBatches`, `deliveryBatchItems` |
| Delivery PDFs (branch `sap_integration`, local only) | Private server folder (`DELIVERY_PDF_DIR`, local fallback `storage/delivery-pdfs/`) | `api/delivery-pdf.php` | `deliveryBatches.pdf*` |

Notes:
- Pages also keep a **localStorage cache** of database records (`customers`, `products`, `bomMasterData`, …) so older order and production screens can read them. **MySQL is the real copy**; the cache is rebuilt when a page loads.
- **Production engine persistence:** `productionEngine.js` loads the full state from `api/manufacturing-state.php` and works on it in the browser. It saves changes back with a **revision number**. If another session saved first, the API returns 409 and the user must reload. On first use it imports any old browser data once.
- **Orders (SAP Phase 1, not yet merged or deployed):**
  - On `main` and on the live site, orders are still browser-only (localStorage `orders`, PDFs in IndexedDB).
  - On branch `sap_integration` they are in MySQL. `orderImport.js` imports each browser's old orders once, and nothing in the browser is deleted.
  - The order APIs return **401** unless the explicit local dev switch is set (`npm run dev`). They return **503** until `php cli/orders-admin.php migrate` has run.
  - Details: `docs/flow.md` and `docs/SAP_INTEGRATION.md`.

## 5. Order Booking flow

```
Customer (QR) → Order Punch (scan customer + product barcodes, sets) → Order List
  → Pass to Dispatch → Dispatch (scan pieces; each partial dispatch = a delivery batch)
  → Delivery: In Progress → Pass with PDF upload → Success
```

- Order fields: customer (id, name, shop, city, contact), agent, transporter, distributor, delivery date and items. Each item has barcode, description, size, brand, pieces per set and quantity in sets.
- Orders have **no price, tax, discount or warehouse** yet.

## 6. Manufacturing flow

```
BOM Master → Batch → Batch Approval (materials) → [Requirements if missing]
  → [Before-Cutting works] → Cutting → [After-Cutting works, up to 5 in parallel]
  → Stitching → [1 After-Stitching work] → Ironing → [1 After-Ironing work]
  → Packing → Bundling → Inventory / Stock
```

- **BOM / product** (`productRecords`): brand, numeric design number (unique), colour, pattern, MRP, photo and pieces. Each piece has its items/materials from `itemList` and ordered work steps from `additionalWork`. Products created in Product Creation are drafts until their BOM is completed.
- **Generated fields:** barcode = brand prefix + design + colour + size. Size range is fixed per brand: Little Dolly 18-26, Amari S-L, Nivi Blossom 28-34.
- **Route:** `Production.buildRoute(piece)` builds the route. It is saved on the pool at approval, so later BOM edits don't reroute running production.
- **Quantities:** each assignment has `inputQty`, `assignedQty`, `completedQty`, `damageQty` and `passedQty`. Pass is an explicit action and only sends the new difference. Damage links to `repairData`. Full rules are in `docs/claude.md` and `docs/productionFlow.md`.
- **Packing, Bundling and Inventory** work in sets. Bundling splits by brand size assortment (Little Dolly 5 sizes, Amari 3, Nivi Blossom 4). Rules are in `docs/packingBundlingInventory.md`.

## 7. Rules for changing the code

1. All quantity and route logic goes through `productionEngine.js`. Pages must not write production state directly.
2. Schema changes need two edits: update `database/order-booking.sql` **and** add an idempotent file in `database/migrations/`, because Hostinger doesn't run SQL on deploy.
3. New tables and columns use lower camelCase (`customerOrders`, `deliveryBatches`).
4. Never commit live credentials. Use Hostinger environment variables.
5. Keep `docs/flow.md` updated whenever APIs or tables change.
6. URLs come from `$pageRoutes` in `index.php`; old misspelt routes (`requirment`, `empolyee`) are kept as aliases.
7. Tests:
   - `npm test` runs `tests/*.test.cjs`: `parallel-piece-routing` and `production-damage-flow` (14 tests).
   - `npm run test:orders` runs the Phase 1 integration tests. They need the PHP CLI and local MariaDB/MySQL, and use only a local `*_test` database (default `order_booking_test` on 127.0.0.1:3307).
   - `npm run dev` starts the local development server on 127.0.0.1:8080, with the app at `/order-bookings/`.
8. Order changes go through `api/order-records.php`. Pages must not write orders to localStorage. Never set `ORDERS_ALLOW_UNAUTHENTICATED_DEV` outside local development.

## 8. Known gaps

- On `main` and live, orders, dispatch and delivery are still browser-only. SAP Phase 1 on branch `sap_integration` moves them to MySQL; it is not merged or deployed.
- There is no login or access control on pages or APIs. The new order APIs refuse all requests outside local development until login exists.
- There is no SAP Business One integration yet, and SAP's required fields (customer group, GSTIN, payment terms, item code, UoM, unit price, tax code, warehouse) are missing.
- Production state is stored as JSON per key, not as normalized tables. Reporting has to go through the engine.
