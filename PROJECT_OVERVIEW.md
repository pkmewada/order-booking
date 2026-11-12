# Project Overview: Order Booking & Garment Production Tracker

> Context for an AI assistant. Read this before suggesting changes to the code.

## 1. What the app is

A web app for a garment manufacturer. It does two jobs:

1. **Order Booking**: create customers and record their orders.
2. **Manufacturing / Production tracking**: define designs (BOM), create production batches, approve them against materials, and follow every piece through Cutting → Additional Work → Stitching → Ironing → Packing.

## 2. Tech stack and limitations

| Item | Detail |
| --- | --- |
| Server | PHP on WAMP (Apache). PHP only renders HTML pages. There is **no backend logic**. |
| Data | All business data lives in **browser `localStorage`** as JSON arrays. There is **no database**: `includes/db.php` is empty. |
| Frontend | jQuery, Bootstrap 5 (the "Mamix" admin template), SweetAlert2, DataTables, Choices.js, qrcode.js / html5-qrcode, SheetJS (xlsx). |
| Auth | None. `login.php` is a template page that links to the dashboard. |
| Tests | Node.js: `npm test`, `npm run verify`, `npm run test:browser`. |

**Consequences:** data is per browser and per device. Clearing site data deletes everything. There is no multi-user sync. The production engine needs `localhost` or HTTPS, because it uses the Web Locks API.

## 3. Routing

- `.htaccess` sends every URL that is not a real file to `index.php?url=...`.
- `index.php` loads `<first-segment>.php`. For example, `/batch-approval` loads `batch-approval.php`. An empty URL loads `login`. Unknown pages load `404.php`.
- Each page includes `includes/header.php` (top bar and sidebar menu), its own markup, `includes/footer.php`, and then its page script from `assets/js/`.
- `config.php` builds `$baseURL`.

## 4. Modules and pages

### A. Order Booking (sidebar: "Order Booking")

| Page | Script | localStorage key | Purpose |
| --- | --- | --- | --- |
| `customer-creation` | `customer-creation.js` | `customers` | Create customers and link them to an agent, distributor and transporter. Has QR support. |
| `order-punch` | `order-punch.js` | `orders` (reads `products`, `customers`) | Create or edit an order: pick a customer, add product items, set the delivery date. Has a QR scanner. |
| `order-list` | `order-list.js` | `orders` | List and manage orders. |
| `agent`, `distributor`, `transporter` | same-name `.js` | `agents`, `distributors`, `transporters` | Master lists. Use `state-city.js` with `assets/data/in-states-cities.json` (Indian states and cities). |
| `product-creation`, `product-form` | same-name `.js` | `products` | Product master. Brand sets the size range (for example `AMARI` → `S-L`). |
| `empolyee` (spelling as in the code) | `empolyee.js` | `employees` | Employee master. |

**Order Booking is not connected to Production.** An order does not create a batch.

Pages with **in-memory sample data only, which is lost on reload**: `item-list`, `colour`, `additional-work`, `stock`, `product-manager`. `dashboard.php` shows template demo numbers.

### B. Manufacturing (sidebar: "Manufacturing")

| Page | Script | Role |
| --- | --- | --- |
| `bom-master` | `bom-master.js` | Defines a **design** (BOM): design number, brand, colour, photo, and **pieces**. Each piece has materials and optional additional works, and each work has a timing. A BOM is active or inactive. |
| `batch` | `batch.js` | Creates a **batch** from an active BOM: quantity, priority, and a snapshot of its pieces. Gets a `BATCH-XXX` ID. |
| `batch-approval` (menu label "Production") | `batch-approval.js` | Checks each piece's materials and approves it, which sends the piece into production. |
| `requirment` (spelling as in the code) | `requirment.js` | Lists missing materials and records their receipt. |
| `cutting-manager` | `cutting-manager.js` | Cutting stage. |
| `Embroidery`, `Digital-Print`, `Screen-Print`, `Handwork`, `Peco` | same-name `.js` | Additional-work stages. All five pages are built on `additional-work-template.js`. |
| `stitching-manager` | `stitching-manager.js` | Stitching, done in-house or outsourced. |
| `ironing` | `ironing.js` | Ironing. Passed pieces go to `packingPool`. |
| *(no page)* | n/a | **Packing.** The engine supports it, but there is no Packing UI yet. |

Shared files that every production page loads:

- **`assets/js/production-engine.js`**: the core. It holds all quantity math, routing, validation and transactions. It runs in the browser (`window.Production`) and in Node for tests.
- **`assets/js/production-controls.js`**: shared UI controls for the managers: assign, edit, pass, stop, and the progress modal.

## 5. End-to-end production flow

```
BOM Master  →  Batch  →  Batch Approval  →  [Requirement if materials missing]
                               │
                               ▼  (one "pool" per batch + piece)
   [Before-Cutting works] → Cutting → [After-Cutting works] → Stitching
   → [After-Stitching works] → Ironing → [After-Ironing works] → Packing
```

- **Additional works** are Embroidery, Digital Print, Screen Print, Hand Work and Peco. They always run in that order within a timing slot. Each work can be placed **Before Cutting, After Cutting, After Stitching or After Ironing**. Older data with no timing defaults to After Cutting. A piece with no works goes straight from Cutting to Stitching.
- `Production.buildRoute(piece)` is the **only** route builder.
- The route is **saved into the pool when the piece is approved**. Editing a BOM later does not change production that already exists.

### Batch Approval outcomes

| Action | Display | Production | Requirement |
| --- | --- | --- | --- |
| Approve, all materials present | Green Pass | Creates a pool at its first stage | none |
| Confirm, some materials missing | Pending | Waits for the materials | created |
| Pass, some materials missing (force) | Orange Pass | Creates a pool now | created |
| Final materials received | Green Pass | Updates the pool, or creates it once if it was pending | completed |

Receiving materials again never adds quantity and never sends a piece back to Cutting.

## 6. Core concepts in the production engine

### Pool (`approvedPool`)

There is one record per **batch + piece**. It holds the stored route, `currentStage` (the furthest stage reached, which never moves backward), and **`stageBalances`**. `stageBalances` is the cumulative quantity each stage has received, for example `{ Cutting: {inputQty: 500}, Embroidery: {inputQty: 400} }`. This lets part of a batch move ahead while the rest is still in an earlier stage.

### Work assignment (one record per worker or job, stored per stage)

```js
{ id, poolId, batchId, pieceNumber, stage, storageKey,
  inputQty,      // this assignment's share
  assignedQty,   // reservation (includes its passed and damaged pieces)
  completedQty,  // good pieces finished
  damageQty,     // outstanding damaged pieces
  passedQty }    // good pieces already sent to the next stage
```

Sub-batch IDs look like `BATCH-XXX-PieceName-C1`, `C2`, and so on. Outsourced stitching uses `OS1`, `OS2`, and so on.

### Quantity rules

```
effectiveQty   = inputQty - damageQty
passableQty    = max(0, min(completedQty, effectiveQty) - passedQty)
remainingQty   = effectiveQty - passedQty
uncompletedQty = max(0, effectiveQty - completedQty)
inputQty       = passedQty + remainingQty + damageQty     (must always hold)
availableQty   = stageInputQty - sum(assignedQty)          (for new assignments)
```

- All quantities are non-negative whole numbers. An invalid change shows an error and saves nothing.
- You cannot assign more than the stage has available. Bulk assignment is checked as a whole: if any part fails, nothing is saved.
- **Pass is a separate, explicit action.** Saving progress does not pass pieces. The Pass button appears only when `passableQty > 0`. A pass sends only the new difference, so a repeated or stale click passes 0.
- Damage creates a linked record in `repairData`. Recovering damaged pieces reduces the damage count, but the recovered pieces still have to be completed and passed.
- Ironing → Packing transfers use a stable transfer ID, so `packingPool` never receives the same pieces twice.
- Assignments that are fully passed are hidden from the active tables but stay in history.

### Safety

- Every production change runs inside **one transaction** guarded by a browser **Web Lock**. The engine re-reads storage inside the lock.
- A rollback journal (`productionTransaction`) undoes partial writes. A transaction left unfinished is rolled back on the next page load.
- The code never calls `localStorage.clear()`, never deletes records to make totals fit, and never silently "fixes" old data whose meaning is unclear. Changes to such data are blocked and the reason is shown.

## 7. Production localStorage keys

| Key | Content |
| --- | --- |
| `bomMasterData` | BOM designs |
| `batchData` | Batches |
| `approvedBatchData` | Approved batches and per-piece material approval |
| `requirementData` | Missing and received materials |
| `approvedPool` | Pools: route, current stage, stage balances, audit |
| `cuttingData` / `cuttingHistory` | Cutting |
| `addWork_embroidery`, `addWork_digital_print`, `addWork_screen_print`, `addWork_hand_work`, `addWork_peco` (each also has a `_history` key) | Additional works |
| `stitchingData` / `stitchingData_history` | Stitching |
| `ironingData` / `ironingData_history` | Ironing |
| `packingPool`, `packingData` / `packingData_history` | Packing receipts and assignments |
| `repairData` | Damage and recovery |
| `productionTransaction` | Temporary rollback journal |

## 8. Rules for changing the code

1. Put all quantity and route logic in `production-engine.js`. Manager pages call the engine's API (`assign`, `edit`, `pass`, `stop`, `recoverRepair`, `transaction`, `readState`, `views`). They must not write pools or quantities directly.
2. Keep the canonical fields (`inputQty`, `assignedQty`, `completedQty`, `damageQty`, `passedQty`). The old fields `quantity`, `progress` and `damage` are kept only as display aliases.
3. Do not add auto-pass, checkbox bulk-pass, or bulk-damage controls. These were removed on purpose.
4. Keep the misspelled file names (`requirment`, `empolyee`) unless every reference is renamed too. URLs map directly to file names.
5. After changing production code, run `npm test` (engine tests) and `npm run verify` (syntax and lint checks). `npm run test:browser` runs the pages in headless Edge.
6. More detail: `PRODUCTION_FLOW.md` (full rules) and `VERIFICATION.md` (test results and known gaps).

## 9. Known gaps

- There is no database, no login, and no multi-device data.
- There is no Packing or dispatch page.
- Order Booking is not linked to Production.
- Several master pages (item list, colour, additional work, stock, product manager) do not save their data.
- The shared template scripts (ApexCharts, Simplebar) throw console errors. These do not come from production code.
