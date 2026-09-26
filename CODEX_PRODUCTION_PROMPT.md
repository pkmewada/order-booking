# Follow-up Codex task prompt

```text
You are working in this existing PHP + JavaScript localStorage garment ERP.
Read claude.md / PRODUCTION_FLOW.md, VERIFICATION.md, production-engine.js,
production-controls.js, and every affected manager before changing behavior.
Do not redesign CSS, tables, navigation, fonts, or existing modals.

The shared Production engine owns quantity validation, assignment availability,
bulk atomicity, edits, repair recovery, routing, passes and packing receipts.
Managers are UI adapters. Never add independent manager-specific formulas or
route builders. Never add automatic pass on progress updates.

Keep one approvedPool identity per batchId + pieceNumber. Partial flow uses
stageBalances inside that pool. Each receipt is the actual pass delta. A late
upstream pass must not rewind the currentStage pointer or overwrite earlier
receipts. History is audit-only.

Use canonical inputQty, assignedQty, completedQty, damageQty, passedQty.
Preserve already passed quantity during edits. Never allow completed below
passed, negative values, completed + damage above input, or overassignment.
Lifetime assigned quantity already contains passed/damaged portions; do not
subtract those portions twice when calculating available quantity.

Every mutation must read fresh state under the shared Web Lock and commit via
the rollback journal. Bulk validation failure must save nothing. Repeated pass
or requirement fulfilment must be idempotent. Preserve sub-batch conventions.

Orange Pass means production was released while materials remain outstanding.
Green Pass means receipt is confirmed. Requirement completion must only update
materials on an existing pool; it must never send that pool back to Cutting.

Do not clear storage or delete legacy records. Preserve and report ambiguous
legacy state. Any reconciliation must show evidence and preserve original data.
There is currently no Packing manager page: packingPool is the receipt handoff.

Run node --test tests/production-engine.test.cjs and the browser integration
test. Add regression tests for behavior you change. Check all eight managers,
including outsource stitching, reload, bulk rejection, damage, print/history,
and 700 -> repeated pass -> Packing still 700.

Report exactly what changed, what was verified, and what remains unverified.
Do not claim historical user data was repaired without inspecting and safely
reconciling that data.
```
