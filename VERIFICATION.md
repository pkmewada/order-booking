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
- Ambiguous existing duplicate pools, incompatible active legacy routes and already-corrupted historical quantities are preserved and blocked for reconciliation. They cannot safely be guessed away. The user's historical `700 → 1400` records were not altered; the repeated-pass regression is prevented for transactions through the corrected engine.

## Run again

```sh
npm test
npm run verify
npm run test:browser
```

The first two require Node and the configured XAMPP PHP path. The browser test additionally launches headless Edge and a temporary PHP server, uses a separate temporary profile, and needs the existing site's CDN dependencies. It does not use the user's normal Edge profile. Browser-test launch approval may be required in managed environments.
