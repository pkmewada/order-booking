# Verification record

Date: 2026-09-26. Tests used synthetic data and an isolated Edge profile. No existing user browser storage was inspected, reset, or repaired.

## Completed

- **71 automated regression tests passed**, using `node --test tests/production-engine.test.cjs`.
- **189 JavaScript files parsed** and **32 PHP pages linted**, using `node tests/verify-source.cjs`.
- Static integration checks passed for all eight production managers: shared engine and controls load order, central assign/edit/pass/stop/availability calls, no direct pool writes, no legacy auto-pass logic, and no storage clearing.
- A real PHP + headless Edge run passed the following sequence on Cutting, Embroidery, Digital Print, Screen Print, Hand Work, Peco, Stitching and Ironing: assign 500 through the page; set completed 400; pass 400; verify Pass disappears; set completed 500; verify Pass reappears; pass only 100; reload and verify Pass stays absent.
- That browser run exercised assignment detail/history/list controls and verified bulk controls were installed. It reported zero exceptions attributed to the production scripts. It also reported 72 exceptions from unrelated shared template scripts; those were not repaired as part of the production-flow task.
- BOM page browser check confirmed no manual Additional Work stage-position select remained.

The automated suite covers atomic assignment overflow rejection, multiple assignments, partial/full/duplicate passes, concurrent engine instances sharing a lock, edit-after-pass, assignment editing, damage validation, bulk damage rollback, bulk pass, stage receipts, packing deduplication, explicit recovery, outage/quota rollback, crash-journal recovery, legacy numeric fields, outsource identities, linked legacy repair records, batch stop/resume, requirement fulfilment and atomic multi-piece approval.

## Limits

- The later expanded browser run for clicking bulk assignment/damage/pass controls was declined. These extra browser cases are present in `tests/browser-production.cjs` but **have not been run successfully**. Their underlying engine operations passed the automated suite.
- Batch Approval/Requirement semantics were tested through the engine. The orange/green CSS and full approval/requirement click flow were not verified in the browser.
- Small later cleanup changes, batch stop integration and compatibility-template replacement were syntax/static-tested; the earlier successful browser run preceded those changes.
- The browser harness automatically confirms SweetAlert prompts; it does not visually inspect confirmation dialogs or print output. Shared template exceptions remain outside this task.
- Tests simulate reload by recreating the engine and also perform real page reloads. Cross-tab serialization was tested with shared-lock engine instances, not two independently driven browser tabs.
- No Packing manager PHP page exists in this repository. The verified deliverable is the protected `packingPool` handoff and engine support, not a new packing/dispatch interface.
- Ambiguous existing duplicate pools, incompatible active legacy routes and already-corrupted historical quantities are preserved and blocked for reconciliation. They cannot safely be guessed away. The user's historical `700 â†’ 1400` records were not altered; the repeated-pass regression is prevented for transactions through the corrected engine.

## Run again

```sh
npm test
npm run verify
npm run test:browser
```

The first two require Node and the configured XAMPP PHP path. The browser test additionally launches headless Edge and a temporary PHP server, uses a separate temporary profile, and needs the existing site's CDN dependencies. It does not use the user's normal Edge profile. Browser-test launch approval may be required in managed environments.


## Requested production fixes ? 2026-09-28

- Engine: 75 tests passed, including approval through Packing for each of the four additional-work timing choices.
- Source checks: 189 JavaScript files parsed and 32 PHP pages linted.
- Isolated Edge browser: all eight managers passed assignment, partial/full pass, reload, completed-row hiding, bulk overflow rejection and default 250+250 splitting of 500 available pieces. Selection checkboxes and bulk pass/damage controls are absent.
- BOM browser checks passed: four timing options, Before Cutting route preview, active-only batch choices and live exclusion after a BOM becomes inactive.
- Existing unrelated ApexCharts and Simplebar template errors still occur; no production-script exceptions were detected.
- Existing approved production routes remain stored snapshots. Timing changes apply to newly approved production.


## Packing two-table workflow

80 engine tests passed (75 existing, 5 packing). Source checks passed: 190 JavaScript files and 33 PHP pages. Isolated Edge checks passed for real Ironing-to-Packing receipts, batch grouping, one Assign button, no bulk button, minimum paired quantity, shared lot rows, Hold/Restore across reload, lot progress and Stitching engine loading. Packing screenshot was visually reviewed. Existing unrelated theme-script exceptions remain outside this change.


## Assignment View / Print layout

All eight manager View buttons now use the shared assignment-details renderer and scoped stylesheet. The reference layout uses a narrow summary panel, a roughly 70% image panel, a full-width six-cell details grid and a signature line. Outsourced stitching retains Firm Name. Images use contain sizing. Print / Download prints an isolated A4 sheet for browser Save as PDF, excluding modal chrome and underlying tables.

Validation: source syntax/PHP checks passed; tests/browser-assignment-details.cjs exercised View and print in Cutting, Stitching, Embroidery, Digital Print, Screen Print, Hand Work, Peco and Ironing. The generated PDF contains one A4 page; screen and print-layout screenshots were visually reviewed. No production quantities, routing or assignment actions were changed.

## Packing labels and lot pass — 2026-09-29

BOM add/edit/copy supports Pattern and MRP without adding either to BOM tables or other production managers. Packing fetches them directly by BOM design number. Assignment displays total/available piece balances and still reserves paired sets atomically. Each assignment appears as one lot row. Explicit paired lot Pass records terminal Packing completion under the shared lock without another receipt; fully passed lots move to the top List dialog and remain stored.

The Packing QR Code control produces sample-style Code 128 barcode labels, with a main section and a detachable duplicate section. Design number fetches BOM details; brand controls size choices. Assignment downloads a self-contained printable HTML label sheet, with a Print / Save PDF button. The local pinned JsBarcode library does not send label data to an external service. Missing BOM/unsupported size is reported separately after a successful assignment, with retry through QR Code.

Validation: 82 automated engine/packing tests passed; 192 JavaScript files parsed and 33 PHP pages linted. Isolated Edge Packing tests passed one-row lot rendering, 600-label automatic download, explicit lot pass/list/reload, paired balances, hold/restore, brand size options, two barcode sections, BOM Pattern/MRP edit loading and negative MRP rejection. Desktop label preview was visually inspected. Actual printer dimensions and physical scanner decoding were not tested.

The full production browser run passed the assign/edit/partial-pass/reload and bulk cases for all eight managers, then failed its existing BOM timing assertion: HEAD already offers three timing options while the test expects After Ironing as a fourth. This unrelated option was not changed. Existing unrelated theme exceptions remain. Tests used isolated profiles; user browser records were not altered.
