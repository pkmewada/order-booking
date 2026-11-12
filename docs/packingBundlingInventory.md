# Packing -> Bundling -> Inventory

## Packing
- Received Items - Ready for Packing is unchanged.
- Assignment columns: Batch ID, Packing Lot, Brand, Design / Pattern, MRP, Pieces, Worker, Quantity, Progress, Damage, Remaining, Delivery Date, Status, Action.
- Quantity shows the lot quantity only; status stays Pending until passed.
- Edit has one set-level Completed / Damage input for the whole lot, regardless of the number of garment pieces. All component balances update atomically.
- All good sets must be complete before Pass appears. Damaged sets reduce the transferable total: 500 assigned minus 1 damaged = 499 good sets passed together. A fully damaged lot can close with zero transferable stock.
- Passed lots are locked against progress edits. Historical partial passes can finish their remaining work before transfer.

## Bundling
- Navigation appears immediately below Packing.
- The first table receives fully passed packing lots and keeps their unassigned balance visible. Assign supports multiple workers through set-based split rows.
- Size distribution: Little Dolly 18/20/22/24/26; AMARI (also AMARU) S/M/L; Nivi Blossom 28/30/32/34.
- 500 Little Dolly quantity displays as 100 sets in a single assignment row. Size rows and separate total columns are hidden.
- Non-divisible totals display full sets and remaining units: 499 Little Dolly quantity shows 99 sets plus 4 remaining. Internal size allocation remains recorded.
- The second table shows one row per lot and worker with a quantity-to-sets summary. Pass transfers the entire received quantity to Inventory.
- Each split has a unique assignment ID. Inventory receipts are deduplicated by that assignment ID. All split/bulk rows are saved together using the production transaction lock and rollback mechanism.

## Inventory
- Navigation appears below Bundling.
- Filters: Batch ID, Design Number, inclusive received-date range (local dates). Refresh reloads stored records.
- Each batch lists lots, brand, design/pattern, color, MRP, pieces, quantity-to-sets summary, worker, and received date.
- Expand Complete Documentation for all received lots of that batch, quantity/MRP valuation, packing records, and production history. Documentation retains the complete batch even when the visible list is filtered.
- MRP valuation is quantity multiplied by MRP, not a sales invoice or tax quotation.
- Receipt snapshots preserve source packing rows, production history, batch details, size distribution, and assignment/receipt timestamps.

## Storage and verification
- Uses the existing browser localStorage production architecture; new keys are bundlingData and inventoryData. Records are local to the browser/origin, like the existing production pages.
- Existing fully passed packing lots become available without rewriting production records.
- No tests or application/browser runs were performed, as requested.

## Split and bulk assignment
- Packing: one entered quantity represents complete garment sets, regardless of pieces per set. From 1000 available, assigning 500 creates a 500-set packing lot and leaves 500 available. Split Count 2 creates two independently tracked 500-set lots.
- Bundling: quantities entered in assignment rows are complete brand assortments. Little Dolly 1000 quantity / 5 sizes = 200 sets. Split Count 2 assigns 100 sets (500 quantity) to each worker. AMARI uses 3 and Nivi Blossom uses 4 units per assortment.
- Bulk Assign opens available batches/lots with selection checkboxes. Each selected source supports Split Count, editable quantities, Add Row, Remove Row, worker and delivery date. Packing rows also retain priority.
- Apply Worker / Date fills all rows. Split All applies a split count to selected sources; individual sources also have Apply. Split regenerates rows from the available set balance.
- Partial assignments leave stock available for another assignment. Existing assignments are included in balance calculations even after being passed.
- Remaining units that do not form an assortment stay visible. Include remaining units in one row to assign them explicitly; they are never silently dropped.
- Each bundling split passes independently to Inventory. The inventory list shows its own quantity and sets; batch documentation shows the original packing source once.
- A failed row cancels the entire bulk transaction. Concurrent submissions are checked against current balances inside the shared production lock.
- No tests were run, as requested.
