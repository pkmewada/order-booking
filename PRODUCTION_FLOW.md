# Production flow and quantity rules

This document describes the production engine in `assets/js/production-engine.js` and the manager integrations. The application remains PHP pages with browser localStorage; this is not a database-backed or multi-device backend.

## Route

`Batch Approval → Cutting → Additional Works → Stitching → Ironing → Packing`

Additional works use this fixed order when selected: **Embroidery → Digital Print → Screen Print → Hand Work → Peco**. Each selected work is a separate route step. Duplicate selections are collapsed. With no additional work, Cutting goes directly to Stitching.

`Production.buildRoute(piece)` is the only route builder. BOM's manual position dropdown is removed. Compatibility metadata may still say `After Cutting`; it never controls routing. BOM and Batch Approval previews use the same builder.

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
| `packingData` / `packingData_history` | Engine-supported packing assignments; no Packing manager page currently exists |
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

At work-record level, `inputQty` is that assignment's received share, not the whole pool repeated for each worker. The whole stage input is in `pool.stageBalances[stage].inputQty`.

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

## Pass and edit

Progress updates save progress; they no longer automatically pass. Pass is explicit.

The row Pass control appears only when shared `passableQty > 0` and the assignment is not stopped. For 500 assigned, set completed 400, then pass: 400 transfers and Pass disappears. Set completed total to 500: Pass reappears for 100.

The existing progress modal supports additive completion/damage, setting completed/damage totals, editing assigned total, and explicitly recovering linked repair quantity. Decreasing damage through a normal edit is rejected; use recovery.

At pass time the engine locks, rereads pool and work, validates, calculates the fresh delta, records one transition, increments `passedQty`, and commits. A queued or repeated pass sees zero available. A stale button cannot pass twice.

Selected assignments can be passed with **Pass selected**. **Damage selected** accepts one `assignment ID: additional damage` line per selection. All lines are validated before any save. Zero-passable records are skipped during bulk pass.

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
