🏭 BOM Master → Production Flow — Complete Documentation
Purpose: Yeh document poore production flow ko explain karta hai — BOM Master se lekar Ironing tak, har manager ka role, data structure, aur storage keys. Isko padh ke koi bhi developer ya AI (Copilot / Claude) samajh sakta hai ki system kaise kaam karta hai.

📋 Table of Contents
System Overview

Data Flow Diagram

Storage Keys Reference

Data Structures

Manager Details

Stage Transition Logic

End-to-End Example

Common Patterns

Important Notes

1. System Overview
Yeh ek local-storage based manufacturing ERP hai jisme garments ka production flow track hota hai. Har stage ka apna Manager page hai jo:

Approved Pool se items uthata hai (jinke currentStage.type us stage se match karta hai)

Workers ko assign karta hai (split, bulk, or single)

Progress track karta hai (Completed / Damage)

Next stage pe pass karta hai (via pushToNextStage())

History maintain karta hai (localStorage me)

Stages Order
text
BOM Master → Batch Management → Approved Pool
    ↓
Cutting → [Additional Work (5 types)] → Stitching → Ironing → Packing
Additional Work types:

Embroidery

Digital Print

Screen Print

Hand Work

Peco

2. Data Flow Diagram
text
┌──────────────────────────────────────────────────────────────────────┐
│                    COMPLETE PRODUCTION FLOW                          │
└──────────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────┐
   │  1. BOM MASTER              │
   │  (BOM-001)                  │
   │  ─────────────              │
   │  • Brand, Design, Color     │
   │  • Photo                    │
   │  • Pieces (1-5)             │
   │  • Materials per piece      │
   │  • Additional Works         │
   │  • Production Flow Chart    │
   │    (route array)            │
   └──────────────┬──────────────┘
                  │
                  │  bomMasterData (localStorage)
                  ▼
   ┌─────────────────────────────┐
   │  2. BATCH MANAGEMENT        │
   │  (BATCH-001)                │
   │  ─────────────              │
   │  • Selected from BOM        │
   │  • Quantity (e.g. 500)      │
   │  • Priority (High/Med/Low)  │
   │  • Photo                    │
   │  • status: "active"         │
   │  • passedAt (when approved) │
   └──────────────┬──────────────┘
                  │
                  │ Pass / Approve
                  ▼
   ┌─────────────────────────────┐
   │  3. APPROVED POOL           │
   │  approvedPool (array)       │
   │  ─────────────              │
   │  • batchId, pieceNumber     │
   │  • quantity                 │
   │  • route[]  ← from BOM      │
   │  • currentStage             │
   │  • stageHistory[]           │
   └──────────────┬──────────────┘
                  │
                  │ filter by currentStage.type
                  │
   ┌──────────────┼──────────────────────────────────┐
   │              │              │                    │
   ▼              ▼              ▼                    ▼
┌──────┐   ┌──────────┐   ┌────────────┐   ┌──────────────────┐
│CUTTING│  │ADDITIONAL│   │ STITCHING  │   │   IRONING        │
│       │  │  WORK    │   │            │   │                  │
│type:  │  │ (5 types)│   │ type:      │   │ type:            │
│cutting│  │          │   │ stitching  │   │ ironing          │
└───┬───┘  └────┬─────┘   └──────┬─────┘   └────────┬─────────┘
    │           │                │                   │
    │  ┌────────┴────────┐       │                   │
    │  ▼                 ▼       │                   │
    │ ┌─────────┐  ┌──────────┐  │                   │
    │ │Embroidery│ │ Digital  │  │                   │
    │ └─────────┘  │  Print   │  │                   │
    │ ┌─────────┐  └──────────┘  │                   │
    │ │ Screen  │  ┌──────────┐  │                   │
    │ │  Print  │  │  Peco    │  │                   │
    │ └─────────┘  └──────────┘  │                   │
    │ ┌─────────┐                │                   │
    │ │Hand Work│                │                   │
    │ └─────────┘                │                   │
    │                            │                   │
    ▼                            ▼                   ▼
   ┌─────────────────────────────────────────────────────┐
   │              PROGRESS TRACKING                       │
   │  (per sub-batch assignment)                          │
   │  • progress (completed)                              │
   │  • damage (moved to Repair)                          │
   │  • passedQty (pushed to next stage)                  │
   │  • status: pending → in_progress → passed/stopped    │
   └─────────────────────┬───────────────────────────────┘
                         │
                         │ 100% passed
                         ▼
              ┌──────────────────────┐
              │  IRONING             │
              │  (final stage)       │
              │  Auto-pass to        │
              │  PACKING             │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  PACKING POOL        │
              │  (packingPool)       │
              │  • batchId, piece    │
              │  • quantity          │
              │  • status: pending_  │
              │    packing           │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  DISPATCH / DELIVERY │
              └──────────────────────┘
3. Storage Keys Reference
Sab data localStorage me store hota hai. Yeh table har key ka purpose batata hai:

Key	Content	Set By	Read By
bomMasterData	All BOM records	BOM Master	Batch Mgmt, Same BOM
batchData	All batches	Batch Management	Batch List
approvedBatchData	Approved batches (history)	Batch Management	Batch Mgmt
approvedPool	CORE — Pieces ready for stages	Batch → passed → pooled	All Managers
repairData	Damage records	Any manager (damage entry)	Repair Module
cuttingData	Cutting assignments	Cutting Manager	Cutting Manager
cuttingHistory	Cutting logs	Cutting Manager	Cutting Manager
addWork_embroidery	Embroidery assignments	Embroidery	Embroidery
addWork_embroidery_history	Embroidery logs	Embroidery	Embroidery
addWork_digital_print	Digital Print	Digital Print	Digital Print
addWork_digital_print_history	Digital Print logs	Digital Print	Digital Print
addWork_screen_print	Screen Print	Screen Print	Screen Print
addWork_screen_print_history	Screen Print logs	Screen Print	Screen Print
addWork_hand_work	Hand Work	Hand Work	Hand Work
addWork_hand_work_history	Hand Work logs	Hand Work	Hand Work
addWork_peco	Peco	Peco	Peco
addWork_peco_history	Peco logs	Peco	Peco
stitchingData	Stitching assignments	Stitching	Stitching
stitchingData_history	Stitching logs	Stitching	Stitching
ironingData	Ironing assignments	Ironing	Ironing
ironingData_history	Ironing logs	Ironing	Ironing
packingPool	Ready for packing	Ironing (final push)	Packing Manager
4. Data Structures
4.1 BOM Record (bomMasterData)
javascript
{
  id: 1,
  bomId: "BOM-001",
  brand: "AMARI",
  designNumber: "A2",
  color: "Green",
  photo: "data:image/png;base64,...",
  pieceCount: 2,
  pieces: [
    {
      number: 1,
      item: "Jacket",
      materials: ["Main Fabric", "Cotton", "Net"],
      additionalWorks: [
        { workType: "Embroidery", stage: "Before Stitching" },
        { workType: "Hand Work", stage: "After Stitching" }
      ]
    },
    {
      number: 2,
      item: "Cap",
      materials: ["Main Fabric", "Net"],
      additionalWorks: []
    }
  ],
  status: "active",       // or "inactive"
  createdAt: "26/09/2026",
  updatedAt: "26/09/2026"
}
Production Flow Chart BOM ke pieces ke additionalWorks se build hoti hai:

text
Fixed stages:  [Cutting, Stitching, Ironing]
Work stages:   [Before Cutting, After Cutting, Before Stitching, 
                After Stitching, Before Ironing, After Ironing]

Order:  Before Cutting → Cutting → After Cutting → Before Stitching
        → Stitching → After Stitching → Before Ironing → Ironing → After Ironing
4.2 Batch Record (batchData)
javascript
{
  id: 1,
  batchId: "BATCH-001",
  bomId: 1,
  brand: "AMARI",
  designNumber: "A2",
  color: "Green",
  photo: "data:image/png;base64,...",
  quantity: 500,
  priority: "High",
  status: "active",       // or "inactive"
  passedAt: "2026-09-26T13:15:00.000Z",
  pieces: [ /* copied from BOM */ ],
  createdAt: "26/09/2026"
}
4.3 Approved Pool Entry (approvedPool) ⭐
Yeh CORE object hai jo har manager use karta hai:

javascript
{
  id: 12345,                          // unique pool id
  batchId: "BATCH-002",
  brand: "AMARI",
  designNumber: "A2",
  color: "Green",
  photo: "data:image/...",

  pieceNumber: 1,
  pieceItem: "Jacket",
  quantity: 500,

  priority: "High",
  deliveryDate: "2026-10-13",

  // ⭐ Production route — generated from BOM
  route: [
    { type: "cutting",         stage: "Cutting" },
    { type: "additional_work", stage: "Before Stitching", works: ["Embroidery"] },
    { type: "stitching",       stage: "Stitching" },
    { type: "additional_work", stage: "After Stitching",  works: ["Hand Work"] },
    { type: "ironing",         stage: "Ironing" },
    { type: "packing",         stage: "Packing" }
  ],

  currentStage: { type: "cutting", stage: "Cutting" },  // pointer

  stageHistory: [
    {
      at: "26/09/2026, 10:00:00",
      stage: "Cutting",
      type: "cutting",
      action: "entered",
      fromQty: 500
    }
  ],

  createdAt: "26/09/2026",
  updatedAt: "26/09/2026"
}
Filters by manager:

javascript
// Cutting Manager
pool = approvedPool.filter(p => p.currentStage?.type === "cutting");

// Embroidery
pool = approvedPool.filter(p =>
  p.currentStage?.type === "additional_work" &&
  p.currentStage.works?.includes("Embroidery")
);

// Stitching
pool = approvedPool.filter(p => p.currentStage?.type === "stitching");

// Ironing
pool = approvedPool.filter(p => p.currentStage?.type === "ironing");
4.4 Work Assignment Entry (per manager)
Yeh cutting/stitching/ironing/etc ke apne workData me save hota hai:

javascript
{
  id: 1,
  poolId: 12345,                       // ref to approvedPool.id
  batchId: "BATCH-002",
  brand: "AMARI",
  designNumber: "A2",
  color: "Green",
  photo: "data:image/...",

  pieceType: "Piece 1 (Jacket)",
  pieceNumber: 1,
  subBatch: "BATCH-002-Jacket-C1",
  worker: "Danish Ali",                // or firm for outsource
  quantity: 500,
  priority: "High",
  deliveryDate: "2026-10-13",

  progress: 0,                         // completed qty
  damage: 0,                           // damaged qty
  passedQty: 0,                        // passed to next stage

  workType: "Cutting",                 // or "Ironing" etc
  stopped: false,                      // if stopped

  createdAt: "26/09/2026"
}
Stitching (outsource-specific):

javascript
{
  ...
  type: "inhouse" | "outsource",
  worker: "Ahmad Khan",       // if inhouse
  firm: "Ahmad Tailors",      // if outsource
  ...
}
4.5 History Entry (*_history)
javascript
{
  id: 123456789,
  at: "26/09/2026, 13:15:00",
  ironId: 1,                  // or cuttingId, workId, stitchId
  batchId: "BATCH-002",
  subBatch: "BATCH-002-Jacket-C1",
  action: "Progress +100 (total 300)",
  by: "Manager"
}
4.6 Packing Pool Entry (packingPool)
javascript
{
  id: 1234567890,
  batchId: "BATCH-002",
  brand: "AMARI",
  designNumber: "A2",
  color: "Green",
  pieceType: "Piece 1 (Jacket)",
  pieceNumber: 1,
  subBatch: "BATCH-002-Jacket-C1",
  worker: "Bilal Ahmed",
  quantity: 500,
  priority: "High",
  deliveryDate: "2026-10-13",
  photo: "data:image/...",
  status: "pending_packing",
  createdAt: "26/09/2026, 13:15:00"
}
5. Manager Details
#	Manager	Storage Key	Filters by	Final Stage
1	Cutting	cuttingData + cuttingHistory	currentStage.type === "cutting"	→ next route stage
2	Embroidery	addWork_embroidery + _history	additional_work + works.includes("Embroidery")	→ next route stage
3	Digital Print	addWork_digital_print + _history	additional_work + works.includes("Digital Print")	→ next route stage
4	Screen Print	addWork_screen_print + _history	additional_work + works.includes("Screen Print")	→ next route stage
5	Hand Work	addWork_hand_work + _history	additional_work + works.includes("Hand Work")	→ next route stage
6	Peco	addWork_peco + _history	additional_work + works.includes("Peco")	→ next route stage
7	Stitching	stitchingData + _history	currentStage.type === "stitching"	→ next route stage
8	Ironing	ironingData + _history	currentStage.type === "ironing"	→ Packing (explicit)
6. Stage Transition Logic
6.1 pushToNextStage() — Universal function
Har manager me yeh same hai (sirf history key alag):

javascript
function pushToNextStage(item, qty) {
    // 1. Get fresh approvedPool
    const poolData = readStorage("approvedPool");
    const idx = poolData.findIndex(p =>
        String(p.batchId) === String(item.batchId) &&
        Number(p.pieceNumber) === Number(item.pieceNumber)
    );
    if (idx === -1) return;

    const entry = poolData[idx];
    const route = entry.route || [];
    const currentStage = entry.currentStage || {};

    // 2. Find next stage in route
    const curIdx = route.findIndex(r =>
        r.stage === currentStage.stage && r.type === currentStage.type
    );
    const nextStage = (curIdx !== -1 && curIdx + 1 < route.length)
        ? route[curIdx + 1]
        : { type: "packing", stage: "Packing" };

    // 3. Update pool entry
    poolData[idx] = {
        ...entry,
        currentStage: nextStage,
        quantity: qty,
        stageHistory: [
            ...(entry.stageHistory || []),
            {
                at: new Date().toLocaleString("en-GB"),
                stage: nextStage.stage,
                type: nextStage.type,
                action: "entered",
                fromQty: qty
            }
        ],
        updatedAt: new Date().toLocaleString("en-GB")
    };
    saveStorage("approvedPool", poolData);

    // 4. If next is packing → push to packingPool (Ironing only)
    if (nextStage.type === "packing") {
        const packingPool = readStorage("packingPool");
        packingPool.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            batchId: item.batchId,
            brand: item.brand,
            designNumber: item.designNumber,
            color: item.color,
            pieceType: item.pieceType,
            pieceNumber: item.pieceNumber,
            subBatch: item.subBatch,
            worker: item.worker,
            quantity: qty,
            priority: item.priority,
            deliveryDate: item.deliveryDate,
            photo: item.photo || "",
            status: "pending_packing",
            createdAt: new Date().toLocaleString("en-GB")
        });
        saveStorage("packingPool", packingPool);
    }
}
6.2 Auto-Pass Rule
Jab worker progress 100% complete karta hai aur progress > passedQty:

javascript
if (finalEff > 0 && finalProgress >= finalEff && finalPassed < finalProgress) {
    const autoPassQty = finalProgress - finalPassed;
    pushToNextStage(item, autoPassQty);  // ⭐ Auto push
    item.passedQty = finalProgress;
    pushHistory({ ..., action: `Auto-passed ${autoPassQty} pcs`, by: "System" });
}
7. End-to-End Example
Scenario: Batch BATCH-002 (500 pcs), route = [Cutting] → [Embroidery] → [Stitching] → [Ironing] → [Packing]

Step 1: BOM Created
text
BOM-002:
  Brand: AMARI, Design: A2, Color: Green
  Piece 1 (Jacket), Qty: 500
  Additional Works: Embroidery (Before Stitching)
Step 2: Batch Created + Passed
text
BATCH-002 created with 500 pcs → Passed
  → approvedPool gets 1 entry:
      {
        batchId: "BATCH-002", pieceNumber: 1, quantity: 500,
        currentStage: { type: "cutting", stage: "Cutting" },
        route: [
          { type: "cutting", stage: "Cutting" },
          { type: "additional_work", stage: "Before Stitching", works: ["Embroidery"] },
          { type: "stitching", stage: "Stitching" },
          { type: "ironing", stage: "Ironing" },
          { type: "packing", stage: "Packing" }
        ]
      }
Step 3: Cutting Manager
Sees: BATCH-002 / Piece 1 / Jacket / Qty 500

Assigns: Worker "Danish Ali" / Sub-batch: BATCH-002-Jacket-C1 / Qty 500

Worker completes 500 → clicks Pass

currentStage moves to { type: "additional_work", stage: "Before Stitching", works: ["Embroidery"] }

Step 4: Embroidery Manager
Sees: BATCH-002 / Piece 1 / Jacket / Qty 500 (only embroidery works)

Assigns: Worker "Saeed Ahmad" / Sub-batch: BATCH-002-Jacket-C1 / Qty 500

Worker completes 500 → clicks Pass

currentStage moves to { type: "stitching", stage: "Stitching" }

Step 5: Stitching Manager
Sees: BATCH-002 / Piece 1 / Jacket / Qty 500

Assigns: Worker "Ahmad Khan" / Sub-batch: BATCH-002-Jacket-C1 / Qty 500

Worker completes 500 → clicks Pass

currentStage moves to { type: "ironing", stage: "Ironing" }

Step 6: Ironing Manager
Sees: BATCH-002 / Piece 1 / Jacket / Qty 500

Assigns: Worker "Bilal Ahmed" / Sub-batch: BATCH-002-Jacket-C1 / Qty 500

Worker completes 500 → clicks Pass to Packing

currentStage moves to { type: "packing", stage: "Packing" }

NEW: Also pushes to packingPool with status pending_packing

Step 7: Packing Pool
Entry exists waiting for Packing Manager

8. Common Patterns
Har manager follow karta hai yeh pattern:

javascript
// ─────────────────────────────────────────────────
// 1. LOAD pool filtered by its stage
// ─────────────────────────────────────────────────
function loadData() {
    pool = readStorage(APPROVED_POOL_KEY).filter(p =>
        p.currentStage && p.currentStage.type === "X"  // ← changes per manager
    );
    workData = readStorage(WORK_STORAGE_KEY);
    nextId = Number(localStorage.getItem(WORK_NEXT_ID_KEY)) || 1;
}

// ─────────────────────────────────────────────────
// 2. RENDER available table (grouped by batch)
// ─────────────────────────────────────────────────
function renderAvailableTable() {
    // Group by batchId, show pieces with quantities
    // "Assign" button per piece
}

// ─────────────────────────────────────────────────
// 3. RENDER assigned table (grouped by batch)
// ─────────────────────────────────────────────────
function renderAssignedTable() {
    // Show progress, damage, remaining, status
    // Actions: Edit, Pass, Stop, View
}

// ─────────────────────────────────────────────────
// 4. SINGLE / BULK ASSIGN
// ─────────────────────────────────────────────────
// Assign creates workData entry with:
{
    id: nextId++,
    poolId: poolItem.id,
    batchId, brand, designNumber, color,
    pieceType, pieceNumber, subBatch,
    worker, quantity, priority, deliveryDate,
    progress: 0, damage: 0, passedQty: 0,
    photo, workType: "X"
}
pushHistory({ [idKey]: newId, batchId, subBatch, action: "...", by: "Manager" });

// ─────────────────────────────────────────────────
// 5. PROGRESS UPDATE
// ─────────────────────────────────────────────────
// User enters qty → progress increases
// If progress == effectiveTotal → auto-pass to next stage

// ─────────────────────────────────────────────────
// 6. PASS TO NEXT STAGE
// ─────────────────────────────────────────────────
pushToNextStage(item, qty);

// ─────────────────────────────────────────────────
// 7. STOP / VIEW / LIST
// ─────────────────────────────────────────────────
// Standard UI for all managers
Sub-batch Naming Convention
Har manager sub-batch generate karta hai:

text
Format:  BATCH-XXX-PieceName-CN
Example: BATCH-002-Jacket-C1
         BATCH-002-Jacket-C2

Stitching me Outsource ke liye:
         BATCH-002-Jacket-OS1
Uniform: SUB_BATCH_SUFFIX = "C" across all managers (except Stitching Outsource uses "OS").

Worker Grouping
Sab managers me worker dropdown aise group hota hai:

text
1. "continuing" — same pool me already assigned
2. Normal workers — available, not busy
3. "busy elsewhere" — disabled, can't select
9. Important Notes
⚠️ Critical Points
BOM must have Production Flow Chart

Warna route empty hoga

pushToNextStage() fallback { type: "packing" } dega

Route BOM ke additionalWorks se generate hoti hai

Sub-batch naming

Har manager -C1, -C2 etc generate karta hai (uniform suffix)

Stitching Outsource ke liye -OS1, -OS2

Worker/Firm distinction

Stitching me type: "inhouse" ya "outsource"

In-house = worker, Outsource = firm

Damage handling

Damage qty repairData me chali jaati hai

effectiveTotal = quantity - damage

Progress/Passed calculations effectiveTotal se hote hain

Auto-pass

Jab progress >= effectiveTotal aur passedQty < progress → auto-pass

Ironing last stage

BOM route me uske baad usually "Packing" hota hai

Ya fallback Packing hi milega

pushToNextStage() me special check: if (nextStage.type === "packing") → push to packingPool

Batch status (Active/Inactive)

Inactive batches ko Edit/View disabled hai

Sirf toggle kar sakte hain (Active/Inactive)

Photo storage

Base64 me localStorage me store

localStorage full ho sakta hai → error handling zaroori

History sorting

Timestamp parse karke sort karo (parseHistoryTime())

dd/mm/yyyy, hh:mm:ss format

Refresh pattern

Every 2 sec, approvedPool aur workData check karta hai

Agar change hua toh re-render karta hai

window.focus pe bhi reload

10. Module Map (File Structure)
text
project/
├── bom-master.php                    → BOM Master page
├── assets/js/bom-master.js
│
├── batch-management.php              → Batch Management
├── assets/js/batch.js
│
├── cutting-manager.php               → Cutting Manager
├── assets/js/cutting-manager.js
│
├── embroidery.php                    → Embroidery
├── assets/js/embroidery.js
│
├── digital-print.php                 → Digital Print
├── assets/js/digital-print.js
│
├── screen-print.php                  → Screen Print
├── assets/js/screen-print.js
│
├── handwork.php                      → Hand Work
├── assets/js/handwork.js
│
├── peco.php                          → Peco
├── assets/js/peco.js
│
├── stitching-manager.php             → Stitching
├── assets/js/stitching-manager.js
│
├── ironing.php                       → Ironing
├── assets/js/ironing.js
│
├── includes/
│   ├── header.php
│   └── footer.php
11. Quick Reference — localStorage Inspect
Browser console me yeh chala ke data dekh sakte ho:

javascript
// BOM Master
JSON.parse(localStorage.getItem("bomMasterData"))

// Batches
JSON.parse(localStorage.getItem("batchData"))

// ⭐ Approved Pool (CORE)
JSON.parse(localStorage.getItem("approvedPool"))

// Cutting
JSON.parse(localStorage.getItem("cuttingData"))
JSON.parse(localStorage.getItem("cuttingHistory"))

// Ironing
JSON.parse(localStorage.getItem("ironingData"))
JSON.parse(localStorage.getItem("ironingData_history"))

// Packing
JSON.parse(localStorage.getItem("packingPool"))
12. TL;DR — 60-Second Summary
BOM Master → defines product + route (stages)

Batch Management → picks BOM, sets quantity, passes to pool

Approved Pool = central array of pieces ready for stages

Each Manager filters pool by currentStage.type

Assign → workData entry → track progress → pass to next stage

pushToNextStage() updates currentStage pointer

Ironing is final → auto-pushes to packingPool

All data in localStorage with consistent key pattern