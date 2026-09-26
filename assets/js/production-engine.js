/* Shared production quantities and transactions. No UI or manager-specific routing. */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.Production = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    const managers = {
        cuttingData: "Cutting", addWork_embroidery: "Embroidery",
        addWork_digital_print: "Digital Print", addWork_screen_print: "Screen Print",
        addWork_hand_work: "Hand Work", addWork_peco: "Peco",
        stitchingData: "Stitching", ironingData: "Ironing", packingData: "Packing"
    };
    const additional = ["Embroidery", "Digital Print", "Screen Print", "Hand Work", "Peco"];
    const historyKeys = Object.fromEntries(Object.keys(managers).map(k => [k, k === "cuttingData" ? "cuttingHistory" : `${k}_history`]));
    const keys = ["approvedPool", ...Object.keys(managers), ...Object.values(historyKeys), "repairData", "packingPool", "approvedBatchData", "batchData", "requirementData"];
    const journalKey = "productionTransaction";
    const copy = value => JSON.parse(JSON.stringify(value));
    const same = (a, b) => String(a) === String(b);
    const time = () => new Date().toISOString();
    function number(value, label) {
        const n = Number(value);
        if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${label} must be a non-negative whole number.`);
        return n;
    }
    function calculateProductionMath(work) {
        const inputQty = Math.max(0, Number(work.inputQty) || 0);
        const assignedQty = Math.max(0, Number(work.assignedQty) || 0);
        const completedQty = Math.max(0, Number(work.completedQty) || 0);
        const damageQty = Math.max(0, Number(work.damageQty) || 0);
        const passedQty = Math.max(0, Number(work.passedQty) || 0);
        const effectiveQty = Math.max(0, inputQty - damageQty);
        const passableQty = Math.max(0, Math.min(completedQty, effectiveQty) - passedQty);
        const remainingQty = Math.max(0, effectiveQty - passedQty);
        return { inputQty, assignedQty, completedQty, damageQty, passedQty, effectiveQty, passableQty, remainingQty,
            uncompletedQty: Math.max(0, effectiveQty - completedQty) };
    }
    function normalizeWork(work, key) {
        return { ...work, inputQty: Number(work.inputQty ?? work.quantity ?? 0),
            assignedQty: Number(work.assignedQty ?? work.quantity ?? 0),
            completedQty: Number(work.completedQty ?? work.progress ?? 0),
            damageQty: Number(work.damageQty ?? work.damage ?? 0), passedQty: Number(work.passedQty ?? 0),
            stage: work.stage || managers[key], storageKey: key };
    }
    function validateWork(work) {
        for (const field of ["inputQty", "assignedQty", "completedQty", "damageQty", "passedQty"]) number(work[field], field);
        const m = calculateProductionMath(work);
        if (m.assignedQty > m.inputQty) throw new Error("Assigned quantity cannot exceed input quantity.");
        if (m.completedQty > m.inputQty) throw new Error("Completed quantity cannot exceed input quantity.");
        if (m.damageQty > m.inputQty) throw new Error("Damage quantity cannot exceed input quantity.");
        if (m.completedQty < m.passedQty) throw new Error(`Completed quantity cannot be lower than already passed quantity.\nAlready passed: ${m.passedQty}\nRequested completed: ${m.completedQty}`);
        if (m.passedQty > m.effectiveQty) throw new Error(`Damage leaves fewer good pieces than the ${m.passedQty} already passed.`);
        if (m.completedQty > m.effectiveQty) throw new Error("Completed good quantity plus damage cannot exceed input quantity.");
        return m;
    }
    function validateDamage(work, qty) { return validateWork({ ...work, damageQty: number(qty, "Damage") }); }
    function validatePass(work, qty) {
        const m = validateWork(work);
        number(qty, "Pass quantity");
        if (qty <= 0 || qty > m.passableQty) throw new Error(`Nothing to pass or quantity exceeds available progress. Passable: ${m.passableQty}.`);
        return m;
    }
    function status(work) {
        const m = calculateProductionMath(work);
        if (m.inputQty > 0 && m.passedQty >= m.effectiveQty) return "passed";
        if (m.passableQty > 0) return "ready_to_pass";
        if (m.completedQty > 0) return "partial";
        return m.assignedQty > 0 ? "assigned" : "pending";
    }
    function aliases(work) {
        work.quantity = work.assignedQty; work.progress = work.completedQty; work.damage = work.damageQty;
        work.status = status(work); return work;
    }
    function buildRoute(piece) {
        const wanted = (piece.additionalWorks || []).map(w => String(w.workType || w).trim().toLowerCase());
        const unknown = wanted.filter(w => w && !additional.some(name => name.toLowerCase() === w));
        if (unknown.length) throw new Error(`Unknown additional work: ${unknown.join(", ")}`);
        return [{ type: "cutting", stage: "Cutting" },
            ...additional.filter(name => wanted.includes(name.toLowerCase())).map(name => ({ type: "additional_work", stage: name, works: [name] })),
            { type: "stitching", stage: "Stitching" }, { type: "ironing", stage: "Ironing" }, { type: "packing", stage: "Packing" }];
    }
    function createEngine(storage, locks) {
        function read(key) {
            const raw = storage.getItem(key);
            if (raw === null) return [];
            const value = JSON.parse(raw);
            if (!Array.isArray(value)) throw new Error(`Invalid ${key} data. Existing data was not changed.`);
            return value;
        }
        function recover() {
            const raw = storage.getItem(journalKey);
            if (!raw) return;
            const journal = JSON.parse(raw);
            for (const [key, value] of Object.entries(journal.before)) {
                if (value === null) storage.removeItem(key); else storage.setItem(key, value);
            }
            storage.removeItem(journalKey);
        }
        function commit(state) {
            const changes = Object.fromEntries(Object.entries(state).filter(([key, value]) => storage.getItem(key) !== JSON.stringify(value)));
            if (!Object.keys(changes).length) return;
            const before = Object.fromEntries(Object.keys(changes).map(key => [key, storage.getItem(key)]));
            storage.setItem(journalKey, JSON.stringify({ before }));
            try {
                for (const [key, value] of Object.entries(changes)) storage.setItem(key, JSON.stringify(value));
                storage.removeItem(journalKey);
            } catch (error) {
                recover();
                throw new Error(`Production save failed; transaction rolled back. ${error.message}`);
            }
        }
        function readState() {
            if (storage.getItem(journalKey)) throw new Error("Production recovery is pending. Reload this page before continuing.");
            const s = Object.fromEntries(keys.map(key => [key, read(key)]));
            for (const key of Object.keys(managers)) s[key] = s[key].map(w => aliases(normalizeWork(w, key)));
            for (const p of s.approvedPool) {
                if (p.stageBalances) continue;
                // Legacy snapshots remain intact until the first successful transaction.
                p.legacyRoute = copy(p.route || []);
                const works = p.additionalWorks?.length ? p.additionalWorks : (p.route || []).flatMap(r => (r.works || []).map(workType => ({ workType })));
                p.route = buildRoute({ additionalWorks: works || [] });
                const current = p.currentStage?.type === "additional_work" ? p.currentStage.works?.[0] : p.currentStage?.stage;
                const currentIndex = p.route.findIndex(r => r.stage === current);
                p.stageBalances = {};
                p.migrationIssues = [];
                for (let i = 0; i < p.route.length; i++) {
                    const stage = p.route[i].stage;
                    const key = Object.keys(managers).find(k => managers[k] === stage);
                    const rows = (s[key] || []).filter(w => same(w.poolId, p.id));
                    const assigned = rows.reduce((n, w) => n + Number(w.assignedQty), 0);
                    const previousKey = Object.keys(managers).find(k => managers[k] === p.route[i - 1]?.stage);
                    const batch = [...s.approvedBatchData, ...s.batchData].find(b => same(b.batchId, p.batchId));
                    const received = i === 0 ? Math.max(Number(batch?.quantity) || 0, Number(p.quantity) || 0, assigned) :
                        (s[previousKey] || []).filter(w => same(w.poolId, p.id)).reduce((n, w) => n + Number(w.passedQty), 0);
                    // A legacy current-stage snapshot is evidence of its received quantity, not a new receipt.
                    const inputQty = i === currentIndex ? Math.max(received, Number(p.quantity) || 0, assigned) : received;
                    p.stageBalances[stage] = { inputQty };
                    if (assigned > inputQty) p.migrationIssues.push(`${stage}: assignments exceed evidenced input.`);
                }
                const oldOrder = p.legacyRoute.flatMap(r => r.type === "additional_work" ? (r.works || []) : [r.stage]).filter(n => n !== "Packing");
                const newOrder = p.route.map(r => r.stage).filter(n => n !== "Packing");
                const active = Object.keys(managers).some(k => s[k].some(w => same(w.poolId, p.id)));
                if (active && JSON.stringify(oldOrder) !== JSON.stringify(newOrder)) p.migrationIssues.push("Active legacy route differs from the central route; review required.");
                p.schemaVersion = 2;
            }
            return s;
        }
        function getPool(s, id) {
            const p = s.approvedPool.find(p => same(p.id, id));
            if (!p) throw new Error(`Pool ${id} was not found.`);
            const batch = s.approvedBatchData.find(b => same(b.batchId, p.batchId));
            if (batch?.stopped || batch?.pieces?.find(piece => same(piece.number, p.pieceNumber))?.approval?.stopped)
                throw new Error("This batch or piece is stopped. Resume it before changing production.");
            if (s.approvedPool.some(other => other !== p && same(other.batchId, p.batchId) && same(other.pieceNumber, p.pieceNumber)))
                throw new Error(`Legacy duplicate pool records for ${p.batchId}, piece ${p.pieceNumber}. Reconciliation is required; no quantities were changed.`);
            if (p.migrationIssues?.length) throw new Error(p.migrationIssues.join("\n"));
            return p;
        }
        function stageInput(p, stage) { return Number(p.stageBalances?.[stage]?.inputQty) || 0; }
        function calculateAvailableQty(p, rows, stage, excludeId) {
            const relevant = rows.filter(w => same(w.poolId, p.id) && !same(w.id, excludeId));
            // Outstanding reservations + their damage + their passes = total assigned.
            // Subtracting damage/pass again from lifetime assigned would double-count them.
            const totals = relevant.reduce((t, w) => {
                const m = validateWork(w);
                t.reserved += m.assignedQty - m.damageQty - m.passedQty;
                t.damage += m.damageQty; t.passed += m.passedQty; return t;
            }, { reserved: 0, damage: 0, passed: 0 });
            return Math.max(0, stageInput(p, stage) - totals.reserved - totals.damage - totals.passed);
        }
        function validateAssignment(p, rows, stage, qty, excludeId) {
            number(qty, "Assignment quantity");
            const available = calculateAvailableQty(p, rows, stage, excludeId);
            if (qty <= 0 || qty > available) throw new Error(`Assignment exceeds available quantity for ${p.batchId} / ${stage}. Available: ${available}; requested: ${qty}.`);
        }
        function audit(p, entry) { (p.stageHistory ||= []).push({ ...entry, at: time() }); }
        function syncRepair(s, p, work, key) {
            const id = `${key}:${work.id}`;
            let repair = s.repairData.find(r => r.sourceKey === key && same(r.sourceWorkId, work.id));
            if (!repair) {
                const legacyField = key === "cuttingData" ? "cuttingId" : key === "stitchingData" ? "stitchId" : key === "ironingData" ? "ironId" : null;
                repair = legacyField ? s.repairData.find(r => same(r[legacyField], work.id) && !r.sourceKey) : null;
                if (repair) Object.assign(repair, { sourceKey: key, sourceWorkId: work.id, poolId: p.id,
                    batchId: p.batchId, pieceNumber: p.pieceNumber, stage: work.stage });
            }
            if (!repair && work.damageQty > 0) {
                repair = { id, sourceKey: key, sourceWorkId: work.id, poolId: p.id,
                    batchId: p.batchId, pieceNumber: p.pieceNumber, stage: work.stage, recoveredQty: 0, status: "pending_repair" };
                s.repairData.push(repair);
            }
            if (repair) { repair.damageQty = work.damageQty; repair.totalDamagedQty = work.damageQty + (repair.recoveredQty || 0); repair.updatedAt = time(); }
        }
        function validateState(s) {
            for (const p of s.approvedPool) {
                for (const [key, stage] of Object.entries(managers)) {
                    const rows = s[key].filter(w => same(w.poolId, p.id));
                    if (!rows.length) continue;
                    rows.forEach(validateWork);
                    const assigned = rows.reduce((n, w) => n + w.assignedQty, 0);
                    if (assigned > stageInput(p, stage)) throw new Error(`${p.batchId} / ${stage}: assigned ${assigned} exceeds stage input ${stageInput(p, stage)}.`);
                }
            }
        }
        async function transaction(action) {
            if (!locks?.request) throw new Error("Production writes require browser Web Locks. Open this app on localhost or HTTPS in a current browser.");
            return locks.request("garment-production", { mode: "exclusive" }, () => {
                recover();
                const s = readState();
                const result = action(s);
                validateState(s);
                // Mirror new audit events into existing manager history keys for existing modals.
                for (const p of s.approvedPool) for (const h of p.stageHistory || []) {
                    const key = h.sourceKey || h.after?.storageKey;
                    if (!historyKeys[key] || h.sourceWorkId === undefined) continue;
                    const history = s[historyKeys[key]];
                    const auditId = h.transitionId || `${p.id}:${key}:${h.sourceWorkId}:${h.at}:${h.action}:${(p.stageHistory || []).indexOf(h)}`;
                    if (history.some(event => event.auditId === auditId)) continue;
                    const w = s[key].find(w => same(w.id, h.sourceWorkId));
                    const idField = key === "cuttingData" ? "cuttingId" : key === "stitchingData" ? "stitchId" : key === "ironingData" ? "ironId" : "workId";
                    history.push({ id: auditId, auditId, [idField]: h.sourceWorkId, batchId: p.batchId,
                        subBatch: w?.subBatch, at: h.at, action: `${h.action}: ${h.qty} pcs`, by: "Manager" });
                }
                commit(s);
                return copy(result ?? null);
            });
        }
        function views(key) {
            const s = readState(), stage = managers[key];
            return { works: s[key], pool: s.approvedPool.filter(p => stageInput(p, stage) > 0).map(p => ({ ...p,
                quantity: stageInput(p, stage), currentStage: p.route.find(r => r.stage === stage) })) };
        }
        async function assign(key, requests) {
            return transaction(s => {
                if (!requests.length) throw new Error("No assignment rows.");
                const stage = managers[key], rows = s[key], results = [];
                for (const request of requests) {
                    const p = getPool(s, request.poolId);
                    const qty = number(request.quantity, "Assignment quantity");
                    if (!(request.worker || request.firm) || !request.deliveryDate) throw new Error("Worker/firm and delivery date are required for every assignment.");
                    if (!p.route.some(r => r.stage === stage)) throw new Error(`${stage} is not in this pool's route.`);
                    validateAssignment(p, rows, stage, qty);
                    const id = Math.max(0, ...rows.map(w => Number(w.id) || 0)) + 1;
                    const count = rows.filter(w => same(w.poolId, p.id) && (w.type === "outsource") === (request.type === "outsource")).length + 1;
                    const suffix = request.type === "outsource" ? "OS" : "C";
                    const piece = String(p.pieceItem || "Piece").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
                    const work = aliases({ ...request, id, poolId: p.id, batchId: p.batchId,
                        brand: p.brand, designNumber: p.designNumber, color: p.color, pieceNumber: p.pieceNumber,
                        pieceType: `Piece ${p.pieceNumber} (${p.pieceItem})`, photo: p.photo || "",
                        subBatch: `${p.batchId}-${piece}-${suffix}${count}`, stage, storageKey: key,
                        inputQty: qty, assignedQty: qty, completedQty: 0, damageQty: 0, passedQty: 0, createdAt: time() });
                    rows.push(work); results.push(work);
                    audit(p, { stage, qty, action: "assigned", sourceWorkId: id, sourceKey: key });
                }
                return results;
            });
        }
        async function edit(key, requests) {
            if (new Set(requests.map(r => String(r.id))).size !== requests.length) throw new Error("Each assignment may appear only once in a bulk edit.");
            return transaction(s => requests.map(request => {
                const work = s[key].find(w => same(w.id, request.id));
                if (!work) throw new Error("Assignment no longer exists.");
                const p = getPool(s, work.poolId), old = copy(work);
                if (request.assignedQty !== undefined) {
                    validateAssignment(p, s[key], work.stage, request.assignedQty, work.id);
                    work.inputQty = work.assignedQty = number(request.assignedQty, "Assignment quantity");
                }
                if (request.completedQty !== undefined) work.completedQty = number(request.completedQty, "Completed quantity");
                if (request.damageQty !== undefined) work.damageQty = number(request.damageQty, "Damage quantity");
                if (request.addCompleted !== undefined) work.completedQty += number(request.addCompleted, "Completed increment");
                if (request.addDamage !== undefined) work.damageQty += number(request.addDamage, "Damage increment");
                validateDamage(work, work.damageQty);
                // Decreasing damage requires an explicit recovery, never an ordinary edit.
                if (work.damageQty < old.damageQty) throw new Error("Use explicit repair recovery to reduce recorded damage.");
                aliases(work); syncRepair(s, p, work, key);
                audit(p, { stage: work.stage, qty: work.damageQty - old.damageQty,
                    action: work.damageQty !== old.damageQty ? "damage" : "edited", sourceWorkId: work.id,
                    before: old, after: copy(work) });
                return work;
            }));
        }
        function pushToPackingPool(s, p, work, qty, transitionId) {
            if (s.packingPool.some(r => r.transitionId === transitionId)) return;
            s.packingPool.push({ ...work, id: transitionId, sourceWorkId: work.id, poolId: p.id,
                quantity: qty, inputQty: qty, assignedQty: 0, completedQty: 0, damageQty: 0, passedQty: 0, progress: 0, damage: 0,
                transitionId, stage: "Packing", status: "pending_packing", createdAt: time() });
        }
        function pushToNextStage(s, key, id, requestedQty) {
            const work = s[key].find(w => same(w.id, id));
            if (!work) throw new Error("Assignment no longer exists.");
            if (work.stopped) throw new Error("Resume the assignment before passing.");
            const p = getPool(s, work.poolId), m = validateWork(work);
            if (work.stage !== managers[key]) throw new Error("Assignment stage does not match its manager.");
            const qty = requestedQty ?? m.passableQty;
            if (qty === 0) return { qty: 0 };
            validatePass(work, qty);
            const index = p.route.findIndex(r => r.stage === work.stage);
            if (index < 0 || !p.stageBalances[work.stage]) throw new Error("Source stage is not valid for this pool.");
            const from = p.route[index], next = p.route[index + 1];
            if (!next) throw new Error("Packing is the terminal production stage.");
            const transitionId = `${p.id}:${key}:${work.id}:${work.passedQty}:${work.passedQty + qty}`;
            if ((p.stageHistory || []).some(h => h.transitionId === transitionId)) throw new Error("This transition is already recorded.");
            work.passedQty += qty; aliases(work);
            const balance = p.stageBalances[next.stage] ||= { inputQty: 0 };
            balance.inputQty += qty; // Receipts are deltas; never overwrite an earlier unconsumed receipt.
            const currentIndex = p.route.findIndex(r => r.stage === p.currentStage?.stage);
            if (index + 1 >= currentIndex) { p.currentStage = copy(next); p.quantity = qty; }
            audit(p, { fromStage: from.stage, fromType: from.type, toStage: next.stage, toType: next.type,
                qty, action: "passed", transitionId, sourceWorkId: work.id, sourceKey: key });
            if (next.type === "packing") pushToPackingPool(s, p, work, qty, transitionId);
            return { qty, transitionId, work };
        }
        async function pass(key, ids) {
            return transaction(s => [...new Set(ids.map(String))].map(id => pushToNextStage(s, key, id)));
        }
        async function stop(key, id) {
            return transaction(s => {
                const work = s[key].find(w => same(w.id, id));
                if (!work) throw new Error("Assignment no longer exists.");
                const p = getPool(s, work.poolId); validateWork(work);
                work.stopped = !work.stopped;
                audit(p, { stage: work.stage, qty: 0, action: work.stopped ? "stopped" : "resumed", sourceWorkId: id });
                return work;
            });
        }
        async function recoverRepair(key, id, qty) {
            return transaction(s => {
                number(qty, "Recovered quantity");
                const work = s[key].find(w => same(w.id, id));
                if (!work) throw new Error("Assignment no longer exists.");
                const p = getPool(s, work.poolId);
                syncRepair(s, p, work, key);
                const repair = s.repairData.find(r => r.sourceKey === key && same(r.sourceWorkId, id));
                if (!repair || qty <= 0 || qty > work.damageQty) throw new Error("Recovery exceeds outstanding damage.");
                work.damageQty -= qty; validateWork(work); aliases(work);
                repair.recoveredQty = (repair.recoveredQty || 0) + qty; repair.damageQty = work.damageQty;
                repair.status = work.damageQty ? "pending_repair" : "recovered";
                audit(p, { stage: work.stage, qty, action: "recovered", sourceWorkId: id });
                return work;
            });
        }
        function materialList(piece) {
            return Array.isArray(piece.materials) ? piece.materials : String(piece.materials || "").split(",").map(s => s.trim()).filter(Boolean);
        }
        function upsertPool(s, batch, piece) {
            const matching = s.approvedPool.filter(p => same(p.batchId, batch.batchId) && same(p.pieceNumber, piece.number));
            if (matching.length > 1) throw new Error("Duplicate legacy pools need reconciliation before requirement updates.");
            let p = matching[0];
            if (!p) {
                const route = buildRoute(piece), qty = number(batch.quantity, "Batch quantity");
                p = { id: Math.max(0, ...s.approvedPool.map(p => Number(p.id) || 0)) + 1,
                    batchId: batch.batchId, bomId: batch.bomId, brand: batch.brand, designNumber: batch.designNumber,
                    color: batch.color, photo: batch.photo || "", pieceNumber: piece.number, pieceItem: piece.item,
                    quantity: qty, priority: batch.priority, additionalWorks: copy(piece.additionalWorks || []),
                    route, currentStage: route[0], stageBalances: { Cutting: { inputQty: qty } },
                    stageHistory: [], schemaVersion: 2, createdAt: time() };
                s.approvedPool.push(p);
                audit(p, { stage: "Cutting", qty, action: "entered" });
            }
            // Receipt of materials never re-enters Cutting or changes received production quantity.
            p.materials = materialList(piece); p.itemAvailability = copy(piece.approval.itemAvailability);
            p.availableItems = p.materials.filter(m => p.itemAvailability[m] === "yes");
            p.requirementsPending = p.availableItems.length < p.materials.length;
            return p;
        }
        function syncBatch(s, batch) {
            const b = s.batchData.find(b => same(b.batchId, batch.batchId));
            if (b) b.pieces = copy(batch.pieces);
        }
        async function approve(batchId, requests) {
            return transaction(s => {
                const batch = s.approvedBatchData.find(b => same(b.batchId, batchId));
                if (!batch || batch.stopped) throw new Error("Batch is missing or stopped.");
                for (const request of requests) {
                    const piece = (batch.pieces || []).find((p,i) => same(p.number || i + 1, request.pieceNumber));
                    if (!piece || piece.approval?.stopped) throw new Error("Piece is missing or stopped.");
                    if (piece.approval?.locked) throw new Error("Piece is already approved or confirmed. Reload before continuing.");
                    piece.number = request.pieceNumber;
                    const materials = materialList(piece), availability = {};
                    for (const material of materials) availability[material] = request.availability[material] === "yes" ? "yes" : "no";
                    const available = materials.filter(m => availability[m] === "yes"), missing = materials.filter(m => availability[m] !== "yes");
                    if (!materials.length || !available.length) throw new Error("At least one material must be present.");
                    if (request.mode === "approve" && missing.length) throw new Error("Approval requires all materials.");
                    if (request.mode === "confirm" && !missing.length) throw new Error("All materials are present. Use Approve.");
                    if (!["approve", "confirm", "pass"].includes(request.mode)) throw new Error("Invalid approval action.");
                    piece.approval = { ...piece.approval, status: request.mode === "confirm" ? "pending" : missing.length ? "in_progress" : "pass",
                        itemAvailability: availability, availableItems: available, missingItems: missing,
                        remarks: request.remarks || "", mode: request.mode, locked: true, updatedAt: time() };
                    if (request.mode !== "confirm") upsertPool(s, batch, piece);
                    if (missing.length) {
                        const id = Math.max(0, ...s.requirementData.map(r => Number(r.id) || 0)) + 1;
                        s.requirementData.push({ id, requirementId: `REQ-${String(id).padStart(3,"0")}`,
                            batchId, pieceNumber: piece.number, pieceItem: piece.item, quantity: batch.quantity,
                            brand: batch.brand, designNumber: batch.designNumber, color: batch.color, photo: batch.photo,
                            materials, missingItems: missing, itemAvailability: copy(availability), status: "pending", createdAt: time() });
                    }
                }
                syncBatch(s, batch); return batch;
            });
        }
        async function tickRequirement(id, material, checked) {
            return transaction(s => {
                const req = s.requirementData.find(r => same(r.id,id));
                if (!req || req.status === "completed" || !req.missingItems.includes(material)) throw new Error("Requirement is no longer editable.");
                (req.itemAvailability ||= {})[material] = checked ? "yes" : "no";
                return req;
            });
        }
        async function setBatchStopped(id, stopped) {
            return transaction(s => {
                const batch = s.approvedBatchData.find(b => same(b.id, id));
                if (!batch) throw new Error("Batch no longer exists.");
                batch.stopped = Boolean(stopped);
                batch.updatedAt = time();
                const main = s.batchData.find(b => same(b.batchId, batch.batchId));
                if (main) main.stopped = batch.stopped;
                return batch;
            });
        }
        async function receiveRequirement(id) {
            return transaction(s => {
                const req = s.requirementData.find(r => same(r.id,id));
                if (!req) throw new Error("Requirement no longer exists.");
                if (req.status === "completed") return req;
                const batch = s.approvedBatchData.find(b => same(b.batchId,req.batchId));
                const piece = batch?.pieces.find(p => same(p.number,req.pieceNumber));
                if (!piece || batch.stopped || piece.approval?.stopped) throw new Error("Batch/piece is missing or stopped.");
                const received = req.missingItems.filter(m => req.itemAvailability?.[m] === "yes");
                if (!received.length) throw new Error("No received materials selected.");
                for (const material of received) piece.approval.itemAvailability[material] = "yes";
                const materials = materialList(piece), missing = materials.filter(m => piece.approval.itemAvailability[m] !== "yes");
                piece.approval.missingItems = missing;
                piece.approval.availableItems = materials.filter(m => !missing.includes(m));
                piece.approval.status = missing.length ? (piece.approval.mode === "confirm" ? "pending" : "in_progress") : "pass";
                req.missingItems = req.missingItems.filter(m => !received.includes(m));
                req.status = req.missingItems.length ? "in_progress" : "completed";
                req.updatedAt = time();
                // Confirm waits for all materials. Force-pass already has one pool; update its metadata only.
                if (piece.approval.mode !== "confirm" || !missing.length) upsertPool(s, batch, piece);
                syncBatch(s,batch); return req;
            });
        }
        return { views, assign, edit, pass, stop, recoverRepair, transaction, readState,
            approve, tickRequirement, receiveRequirement, setBatchStopped,
            calculateAvailableQty, validateAssignment, pushToNextStage, pushToPackingPool,
            initialize: () => locks?.request ? locks.request("garment-production", { mode: "exclusive" }, recover) : Promise.resolve() };
    }
    const api = { managers, calculateProductionMath, normalizeWork, validateWork, validateDamage, validatePass, status, buildRoute, createEngine };
    if (typeof localStorage !== "undefined") {
        const engine = createEngine(localStorage, globalThis.navigator?.locks);
        Object.assign(api, engine);
    }
    return api;
});
