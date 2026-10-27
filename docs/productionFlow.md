# Production flow and quantity rules

This document describes the production engine in `assets/js/productionEngine.js` and the manager integrations. The application remains PHP pages with browser localStorage; this is not a database-backed or multi-device backend.

## Route

`Batch Approval → Cutting → Additional Works → Stitching → Ironing → Packing`

In the BOM flow editor, up to five additional work instances can be selected between Cutting and Stitching. The same catalog work may be selected more than once; each selection is a separate ordered BOM work instance and branch letter. Those instances form parallel branches; with no selected work, Cutting goes directly to Stitching. Existing work timings before Cutting, after Stitching, and after Ironing retain their sequential behavior. Production managers still have fixed integrations for the five built-in work types; arbitrary catalog names currently display and save in the BOM route but do not yet have a dedicated production manager.

`Production.buildRoute(piece)` is the only route builder. Each BOM work instance has an order and one of four legacy timing values: Before Cutting, After Cutting, After Stitching, After Ironing. Legacy works without timing default to After Cutting. Up to five After Cutting instances receive a shared `parallelGroup` and stable A–E branch labels. BOM and Batch Approval previews use the same builder. Approval credits the first selected route stage. Only active BOMs are selectable for batches.

The route is stored in `approvedPool` at approval. Managers read this stored route. A later BOM edit does not reroute existing production.

## Batch Approval and Requirement

| Action | Approval display | Production | Requirement |
| --- | --- | --- | --- |
| Approve, all materials present | Green Pass | Creates one Cutting pool | None |
| Confirm, some materials missing | Pending | Waits for all missing materials | Created |
| Pass, some materials missing | Orange Pass | Creates one Cutting pool | Created |
| Confirm receipt, some still missing | Orange Pass for force-pass; Pending for Confirm | Existing pool stays at its production stage | Remaining items stay open |
| Confirm final receipt | Green Pass | Updates existing pool metadata, or creates Cutting once for Confirm | Completed |

Ticking a material checkbox records a selection. Confirming received materials commits fulfilment. Repeating fulfilment does not add production or send an existing item back to Cutting.

Approval, requirement, work, pool, repair and packing changes use a shared transaction and browser Web Lock. Save operations reread current storage inside the lock.

## Storage map

| Key | Purpose |
| --- | --- |
| `bomMasterData` | BOM definitions |
| `batchData` | Batch management records |
| `approvedBatchData` | Approved batches and piece material approvals |
| `requirementData` | Missing/received materials |
| `approvedPool` | Production identity, route, current stage, stage balances and audit history |
| `cuttingData` / `cuttingHistory` | Cutting work and display history |
| `addWork_embroidery` / `_history` | Embroidery |
| `addWork_digital_print` / `_history` | Digital Print |
| `addWork_screen_print` / `_history` | Screen Print |
| `addWork_hand_work` / `_history` | Hand Work |
| `addWork_peco` / `_history` | Peco |
| `stitchingData` / `stitchingData_history` | In-house and outsourced stitching |
| `ironingData` / `ironingData_history` | Ironing |
| `packingPool` | Exactly-once receipts from Ironing |
| `packingData` / `packingData_history` | Packing worker assignments shown in packing.php |
| `repairData` | Linked outstanding damage and recovery |
| `productionTransaction` | Temporary rollback journal; removed after successful commit |

Existing next-ID keys remain readable by old code but the engine allocates assignment IDs from fresh records inside the lock. Sub-batch identities retain `BATCH-XXX-PieceName-C1`, `C2`, etc.; outsource uses `OS1`, `OS2`.

## Work quantities

```js
{
  id, poolId, batchId, pieceNumber, stage, storageKey,
  inputQty,       // quantity reserved for this assignment
  assignedQty,    // assignment reservation, including its passed/damaged pieces
  completedQty,   // successfully processed good pieces
  damageQty,      // outstanding damaged pieces
  passedQty      // cumulative good pieces sent onward
}
```

At work-record level, `inputQty` is that assignment's received share, not the whole pool repeated for each worker. The whole stage input is in `pool.stageBalances[stage].inputQty`. Parallel work assignments also retain `branch` and `branchLabel`; branch queue totals render as `100 A`, `100 B`, etc.

Legacy `quantity`, `progress`, and `damage` are normalized into the canonical fields. Compatibility aliases are maintained for old display consumers. New mutations use canonical fields.

The shared calculator returns:

```text
effectiveQty  = inputQty - damageQty
passableQty   = max(0, min(completedQty, effectiveQty) - passedQty)
remainingQty  = effectiveQty - passedQty
uncompletedQty = max(0, effectiveQty - completedQty)
```

All values must be non-negative whole numbers. Completed good quantity plus damage cannot exceed input. Completed cannot be lower than already passed. Damage cannot reduce effective quantity below already passed. Invalid changes show an error and save nothing.

The conservation rule is:

```text
inputQty = passedQty + remainingQty + damageQty
```

The existing progress tables show **uncompleted** work in their Remaining column. The engine's `remainingQty` includes completed-but-not-yet-passed good pieces; these are deliberately different measures.

## Assignment availability

Passed pieces must never become available for reassignment. A lifetime assignment already contains its passed and damaged portions. Therefore the requested formula uses **outstanding reservations**, not lifetime assigned quantity:

```text
outstandingReserved = sum(assignedQty - damageQty - passedQty)
availableQty = stageInputQty - outstandingReserved - sum(damageQty) - sum(passedQty)
             = stageInputQty - sum(assignedQty)
```

Subtracting damage and passes again from lifetime assignments would count them twice.

Editing an assignment excludes its old reservation before validating the replacement. Example: stage 500, existing assignment 300, unassigned 200 → edit may set that assignment to 500. Another 1-piece assignment then fails.

Bulk assignment is prepared in memory and validated cumulatively. For 500 available, 300 + 300 fails with no work, audit, pool or repair writes. Stopped assignments retain their reservation; stopping does not manufacture availability.

## Partial passes and one pool identity

One pool represents a `batchId + pieceNumber`. Assignments reference its exact `poolId`.

A single stage pointer alone cannot represent a partial pass while upstream work remains. The same pool therefore contains current **stage balances**:

```js
{
  id: 1,
  quantity: 400, // quantity of the latest transition advancing the pointer
  currentStage: { type: "additional_work", stage: "Embroidery", works: ["Embroidery"] },
  stageBalances: {
    Cutting: { inputQty: 500 },
    Embroidery: { inputQty: 400 }
  }
}
```

Stage inputs are cumulative actual receipts. Each pass credits exactly its delta. The second legitimate pass of 100 changes Embroidery's received total from 400 to 500. It does not overwrite the first 400 or credit the original 500 again.

`currentStage` indicates the furthest entered route step. A late upstream receipt never moves this pointer backward. Managers display projections of balances from the same pool; these projections are not extra stored pool records. History is audit-only, not the primary quantity source.

For the Cutting-to-Stitching parallel group, every pass from Cutting adds the passed delta to every selected branch balance. Stitching has no received balance while any branch remains incomplete. It becomes available only after each branch's cumulative passed quantity reaches the full Cutting input quantity. The final branch pass writes the one-time `stitchingReleased` marker, credits Stitching once with the full batch quantity, and records a convergence audit entry. The assignment API also checks this gate, so a stale or forged UI request cannot assign Stitching early. Its availability view shows the missing branch names and A–E labels. A pool's route snapshot is preserved across BOM edits and legacy migration.

## Pass and edit

Progress updates save progress; they no longer automatically pass. Pass is explicit.

The row Pass control appears only when shared `passableQty > 0` and the assignment is not stopped. For 500 assigned, set completed 400, then pass: 400 transfers and Pass disappears. Set completed total to 500: Pass reappears for 100.

The existing progress modal supports additive completion/damage, setting completed/damage totals, editing assigned total, and explicitly recovering linked repair quantity. Decreasing damage through a normal edit is rejected; use recovery.

At pass time the engine locks, rereads pool and work, validates, calculates the fresh delta, records one transition, increments `passedQty`, and commits. A queued or repeated pass sees zero available. A stale button cannot pass twice.

Assignment selection checkboxes and Pass selected / Damage selected controls are removed from all managers. Use individual row actions. Fully passed assignments are hidden from active tables and retained in history. Bulk assignment defaults and splits use the remaining available stage quantity.

## Packing and repair

Each transfer has a stable ID containing pool, source key, work ID, previous passed total and new passed total. `packingPool` checks this ID before insertion. Two legitimate partial receipts may have two packing entries; repeating the same receipt creates none.

For Ironing 700 completed and 700 passed, a repeated Pass returns zero. Packing remains 700.

Damage is linked to `poolId`, `batchId`, `pieceNumber`, `stage`, `sourceKey`, and `sourceWorkId`. Recovery reduces outstanding damage and records recovered quantity. Recovery alone does not mark work completed or pass it; good completion and a new explicit pass are still required.

Transition history includes `fromStage`, `fromType`, `toStage`, `toType`, `qty`, `action`, and ISO `at`. Assignment and damage records include stage, quantity and source work. Existing manager history keys mirror audit events for their current history modals.

## Persistence and migration

Use the app on `localhost` or HTTPS in a browser with Web Locks. Mutations refuse an unsafe unlocked fallback. A rollback journal protects multi-key localStorage writes; quota/storage errors roll back rather than reporting success. An unfinished transaction is rolled back on page initialization under the same lock.

No `localStorage.clear()` is used. No production records are deleted to make totals appear correct. Ordinary legacy quantities are normalized lazily and persisted during a successful transaction. Original legacy routes are retained in `legacyRoute`.

**Ambiguous old data is not silently repaired.** Duplicate pool records, incompatible active legacy routes, overassigned stages, or invalid previously-passed quantities can require reconciliation. Mutations affecting such data are blocked with a reason. Previously duplicated historical packing quantities cannot reliably be inferred away without inspecting the user's actual storage. The automated tests use isolated fixtures; they do not alter the user's browser records.

## Verification

Run from `order-booking`:

```sh
node --test tests/production-engine.test.cjs
node tests/browser-production.cjs
```

The engine suite covers each of the eight managers: single/multiple/bulk assignment, partial/full completion, damage, partial/full/duplicate pass, edit after pass, damage after partial pass, atomic bulk damage/pass, reload through a new engine instance, assignment editing, and stage transitions. It also tests packing protection, write-failure rollback, explicit repair recovery, requirements and legacy normalization.

The browser test launches PHP and headless Edge using a temporary profile. It exercises existing page controls and reloads. It requires the local PHP/Edge paths in the test and access to the site's existing CDN dependencies. See `VERIFICATION.md` for the actual recorded results and remaining limitations.


## Packing table workflow

packing.php uses the existing production table/modal style with Received Items and Packing Assignments tables. There is one Assign action per batch and no bulk assignment. Packing receipts continue to come from the existing stage engine; Ironing UI and routing are unchanged.

Paired-set availability is the minimum unassigned Packing balance across all required batch pieces. Missing pieces have zero availability. A 600-set assignment from 700/600/650 receipts atomically reserves 600 of each piece, preserving 100/0/50 unassigned balances. Rows share a packingLotId and are grouped under one batch/lot in the lower table. Existing size metadata is displayed where available.

Packing holds are recorded in packingHolds under the shared transaction lock. Hold moves only the unassigned batch balance out of the received table; Restore brings it back. New receipts do not clear a hold. Packing progress updates remain per-piece totals under one lot edit action. Completion is terminal and does not create another production transfer.

Verification: node --test tests/production-engine.test.cjs tests/packing.test.cjs and node tests/browser-packing.cjs.

## Parallel Cutting-to-Stitching state

The SQL table `manufacturingState` continues to store each application collection as JSON in `stateData`; no parallel-path state table is required. The `approvedPool` JSON record carries the routing snapshot (`route[].parallelGroup`, `route[].branch`), stage receipts (`stageBalances`), and convergence marker (`stitchingReleased`). Branch assignment rows use the existing additional-work collection with `branch`, `branchLabel`, and a branch-qualified sub-batch identifier. BOM work instances are normalized in `productWorkSteps(productId, pieceNumber, workOrder, workId, stage)`, whose key allows the same catalog work to appear multiple times. State writes still use the existing `manufacturingStateMeta.revision` transaction check.

The BOM API rejects more than five `After Cutting` work instances. The browser editor limits selection to five before save and permits adding the same work type again. Branches use their quantity delta from Cutting, so 100 passed pieces create 100 A, 100 B, and 100 C. Repeated instances of one work type share that manager's queue and require the combined branch quantity to pass. Partial branch completion cannot release Stitching; damage must be recovered and the branch quantity successfully passed until every selected instance reaches the full Cutting quantity.

## Packing labels and explicit lot pass

Pattern and MRP are stored on BOM definitions and read directly only by Packing. Assignment shows total/available balances; reservation remains the minimum available across required pieces. Packing displays a single row per packingLotId. passPackingLot locks and re-reads all lot pieces, passes only the minimum completed-good delta across the lot and audits terminal completion without crediting another stage. Repeat Pass returns zero. Fully passed lots appear in List; stored records and reservations remain intact. Progress saves remain separate from Pass.

QR Code opens the two-part, sample-style barcode label generator. Brand size options are Little Dolly 18/20/22/24/26, Amari S/M/L and Nivi Blossom 28/30/32/34. Labels download as a self-contained printable HTML sheet with a cut line and duplicated product details. Assignment attempts the download automatically using the selected label size; missing label metadata does not undo a committed production assignment.
# Item type compatibility

The MySQL Item List stores nullable `itemType` (`Cutting` / `Non-Cutting`). NULL marks a legacy item and is never inferred from its name. The production engine stores pools, route snapshots, stage balances, branch assignments and audit history in the existing manufacturing state JSON. Up to five After Cutting branches receive A–E quantity labels; Stitching stays locked until every selected branch has passed the full Cutting quantity. Approved pools retain their stored route snapshots; editing a master item does not rewrite those routes. Item-level Cutting components remain separate from branch convergence.
