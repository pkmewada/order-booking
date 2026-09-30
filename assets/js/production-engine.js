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
    const keys = ["approvedPool", ...Object.keys(managers), ...Object.values(historyKeys), "repairData", "packingPool", "approvedBatchData", "batchData", "requirementData", "packingHolds", "bundlingData", "inventoryData"];
    const brandSizes = brand => ({'LITTLE DOLLY':['18','20','22','24','26'],'AMARI':['S','M','L'],'AMARU':['S','M','L'],'NIVI BLOSSOM':['28','30','32','34']}[String(brand || '').trim().toUpperCase()] || []);
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
        const positions = ["Before Cutting", "After Cutting", "After Stitching", "After Ironing"];
        const selected = new Map();
        for (const work of piece.additionalWorks || []) {
            const raw = String(work.workType || work).trim();
            if (!raw) continue;
            const name = additional.find(n => n.toLowerCase() === raw.toLowerCase());
            if (!name) throw new Error(`Unknown additional work: ${raw}`);
            const position = work.stage || "After Cutting";
            if (!positions.includes(position)) throw new Error(`Unknown additional work timing: ${position}`);
            if (!selected.has(name)) selected.set(name, position);
        }
        const at = position => additional.filter(name => selected.get(name) === position)
            .map(name => ({ type: "additional_work", stage: name, works: [name] }));
        return [...at("Before Cutting"), { type: "cutting", stage: "Cutting" }, ...at("After Cutting"),
            { type: "stitching", stage: "Stitching" }, ...at("After Stitching"),
            { type: "ironing", stage: "Ironing" }, ...at("After Ironing"), { type: "packing", stage: "Packing" }];
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
        function assignInState(s, key, requests) {
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
        }
        async function assign(key, requests) { return transaction(s => assignInState(s, key, requests)); }
        async function edit(key, requests) {
            if (new Set(requests.map(r => String(r.id))).size !== requests.length) throw new Error("Each assignment may appear only once in a bulk edit.");
            return transaction(s => requests.map(request => {
                const work = s[key].find(w => same(w.id, request.id));
                if (!work) throw new Error("Assignment no longer exists.");
                const p = getPool(s, work.poolId), old = copy(work);
                if (key === 'packingData' && (work.packingClosed || (work.passedQty > 0 && work.passedQty === work.inputQty-work.damageQty))) throw new Error('Passed packing quantities are locked.');
                if (key === 'packingData' && request.assignedQty !== undefined && request.assignedQty !== work.assignedQty) throw new Error('Packing lot quantity is fixed; update completion using Edit.');
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
                audit(p, { stage: work.stage, qty: key === 'packingData' && work.damageQty === old.damageQty ? work.completedQty - old.completedQty : work.damageQty - old.damageQty,
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
            if (key === 'packingData') throw new Error('Pass the complete packing lot using passPackingLot.');
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
                if (key === 'packingData' && (work.packingClosed || s.bundlingData.some(b => b.packingLotId === work.packingLotId))) throw new Error('Passed packing sets are locked; their damage cannot change after transfer.');
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
                    route, currentStage: route[0], stageBalances: { [route[0].stage]: { inputQty: qty } },
                    stageHistory: [], schemaVersion: 2, createdAt: time() };
                s.approvedPool.push(p);
                audit(p, { stage: route[0].stage, qty, action: "entered" });
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

        function packingBatches(s = readState()) {
            const ids = [...new Set(s.approvedPool.filter(p => stageInput(p, 'Packing') > 0).map(p => String(p.batchId)))];
            return ids.map(batchId => {
                const pools = s.approvedPool.filter(p => same(p.batchId, batchId));
                const batch = [...s.approvedBatchData, ...s.batchData].find(b => same(b.batchId, batchId));
                const required = batch?.pieces?.length ? batch.pieces : pools.map(p => ({ number: p.pieceNumber, item: p.pieceItem, size: p.size }));
                const pieces = required.map(piece => {
                    const pool = pools.find(p => same(p.pieceNumber, piece.number));
                    const received = pool ? stageInput(pool, 'Packing') : 0;
                    const available = pool ? calculateAvailableQty(pool, s.packingData, 'Packing') : 0;
                    return { number: piece.number, item: piece.item || pool?.pieceItem || 'Piece', size: piece.size || pool?.size || '',
                        poolId: pool?.id, total: Number(batch?.quantity) || Math.max(received, ...Object.values(pool?.stageBalances || {}).map(b => Number(b.inputQty) || 0)), received, available, assigned: received - available };
                });
                return { ...pools[0], batchId, pieces, available: Math.min(...pieces.map(p => p.available)),
                    held: s.packingHolds.some(h => same(h.batchId, batchId)) };
            });
        }
        function assignPackingInState(s, request) {
            const batch = packingBatches(s).find(b => same(b.batchId, request.batchId));
            if (!batch || batch.held) throw new Error('Batch is unavailable or on hold.');
            const qty = number(request.quantity, 'Packing sets');
            if (!qty || qty > batch.available) throw new Error('Only ' + batch.available + ' packing sets are available.');
            const lotId = batch.batchId + '-PK' + (Math.max(0, ...s.packingData.map(w => Number(w.id) || 0)) + 1);
            return assignInState(s, 'packingData', batch.pieces.map(p => ({ ...request, poolId:p.poolId, size:p.size, packingLotId:lotId })));
        }
        async function assignPacking(request) { return transaction(s => assignPackingInState(s,request)); }
        async function assignPackingBulk(requests) {
            if (!Array.isArray(requests) || !requests.length) throw new Error('Add at least one assignment.');
            return transaction(s => requests.map(request => assignPackingInState(s,request)));
        }
        function packingLotMath(rows) {
            const inputQty = Math.min(...rows.map(w => w.inputQty));
            const damageQty = Math.max(...rows.map(w => w.damageQty));
            const completedQty = Math.min(...rows.map(w => w.completedQty));
            const passedQty = Math.min(...rows.map(w => w.passedQty));
            const effectiveQty = inputQty - damageQty;
            return {inputQty, assignedQty:inputQty, damageQty, completedQty, passedQty, effectiveQty,
                uncompletedQty:Math.max(0,effectiveQty-completedQty), remainingQty:Math.max(0,effectiveQty-passedQty)};
        }
        async function editPackingLot(lotId, type, quantity) {
            return transaction(s => {
                const rows=s.packingData.filter(w=>(w.packingLotId || `legacy-${w.id}`)===lotId);
                if (!rows.length) throw new Error('Packing lot not found.');
                const m=packingLotMath(rows), qty=number(quantity,'Set quantity');
                if (!['completed','damage'].includes(type) || !qty) throw new Error('Choose an update type and positive set quantity.');
                if (rows.some(w=>w.packingClosed) || s.bundlingData.some(b=>b.packingLotId===lotId) || (m.effectiveQty>0 && m.passedQty===m.effectiveQty)) throw new Error('Passed packing lots are locked.');
                if (qty>m.uncompletedQty) throw new Error('Quantity exceeds remaining sets: '+m.uncompletedQty);
                const damage=m.damageQty+(type==='damage'?qty:0), completed=m.completedQty+(type==='completed'?qty:0);
                rows.forEach(w=>{
                    const p=getPool(s,w.poolId), old=copy(w);
                    if(w.stopped || w.inputQty!==m.inputQty) throw new Error('Packing lot is stopped or has unequal assigned quantities.');
                    w.damageQty=damage; w.completedQty=Math.max(w.completedQty,completed);
                    validateWork(w); aliases(w); syncRepair(s,p,w,'packingData');
                    audit(p,{stage:'Packing',action:type==='damage'?'damaged sets':'completed sets',qty,sourceKey:'packingData',sourceWorkId:w.id,before:old,after:copy(w)});
                });
                return packingLotMath(rows);
            });
        }
        async function passPackingLot(lotId) {
            return transaction(s => {
                const rows = s.packingData.filter(w => (w.packingLotId || `legacy-${w.id}`) === lotId);
                if (!rows.length) throw new Error('Packing lot not found.');
                rows.forEach(w => { getPool(s, w.poolId); validateWork(w); if(w.stopped) throw new Error('Resume this lot before passing.'); });
                if (rows.every(w => w.packingClosed || (w.passedQty > 0 && w.passedQty === w.inputQty-w.damageQty))) return {qty: 0};
                const m=packingLotMath(rows), qty=m.effectiveQty;
                if (rows.some(w => w.inputQty !== m.inputQty || w.damageQty !== m.damageQty || w.completedQty !== qty)) throw new Error('Complete all remaining good sets before passing the lot.');
                rows.forEach(w => {
                    const remaining = qty - w.passedQty;
                    w.passedQty = qty; w.passedAt = time(); w.packingClosed = true; aliases(w);
                    audit(getPool(s,w.poolId), {stage:'Packing', action:'packed', qty:remaining, sourceKey:'packingData', sourceWorkId:w.id});
                });
                return {qty};
            });
        }
        async function setPackingHold(batchId, held) {
            return transaction(s => {
                if (!packingBatches(s).some(b => same(b.batchId, batchId))) throw new Error('Batch not found.');
                s.packingHolds = s.packingHolds.filter(h => !same(h.batchId, batchId));
                if (held) s.packingHolds.push({ batchId, at: time() });
            });
        }
        function bundlingReady(s = readState()) {
            const groups = new Map();
            s.packingData.forEach(w => { const id=w.packingLotId || `legacy-${w.id}`; if(!groups.has(id))groups.set(id,[]); groups.get(id).push(w); });
            return [...groups].filter(([,rows])=>rows.every(w=>w.passedQty>0 && w.passedQty===w.inputQty-w.damageQty && w.passedQty===rows[0].passedQty && !w.stopped))
                .map(([id,rows])=>{
                    const total=rows[0].passedQty, sizes=brandSizes(rows[0].brand), assigned=s.bundlingData.filter(b=>b.packingLotId===id);
                    const availableSizes=sizes.map((size,i)=>({size,quantity:Math.max(0,Math.floor(total/sizes.length)+(i<total%sizes.length?1:0)-assigned.reduce((n,r)=>n+(r.sizes||[]).filter(v=>v.size===size).reduce((t,v)=>t+Number(v.quantity),0),0))}));
                    const quantity=total-assigned.reduce((n,r)=>n+Number(r.quantity),0);
                    const availableSets=availableSizes.length?Math.min(...availableSizes.map(r=>r.quantity)):0;
                    return {...rows[0],packingLotId:id,quantity,totalQuantity:total,assignedQuantity:total-quantity,availableSizes,availableSets,
                        remainderQuantity:quantity-availableSets*sizes.length,pieces:rows.map(w=>w.pieceType),sourceWorkIds:rows.map(w=>w.id)};
                }).filter(l=>l.quantity>0);
        }
        function assignBundlingInState(s,request) {
            const lot=bundlingReady(s).find(l=>l.packingLotId===request.packingLotId);
            if(!lot)throw new Error('This lot has no available quantity.');
            lot.sourceWorkIds.forEach(id=>getPool(s,s.packingData.find(w=>w.id===id).poolId));
            if(!String(request.worker||'').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(request.deliveryDate||''))throw new Error('Choose a worker and delivery date.');
            if(!lot.availableSizes.length)throw new Error('No sizes are configured for this brand.');
            const sets=number(request.setQuantity ?? lot.availableSets,'Bundling sets');
            if(sets>lot.availableSets)throw new Error('Only '+lot.availableSets+' bundling sets are available.');
            const includeRemainder=request.includeRemainder===true || request.setQuantity===undefined;
            const sizes=lot.availableSizes.map(r=>({size:r.size,quantity:sets+(includeRemainder?r.quantity-lot.availableSets:0)}));
            const qty=sizes.reduce((n,r)=>n+r.quantity,0);
            if(!qty || qty>lot.quantity)throw new Error('Enter a positive set quantity or include the remaining units.');
            const bom=read('bomMasterData').find(b=>String(b.designNumber).trim().toLowerCase()===String(lot.designNumber).trim().toLowerCase());
            let suffix=1, id;
            do {id=lot.packingLotId+'-BD'+suffix++;} while(s.bundlingData.some(r=>r.id===id));
            const row={id,packingLotId:lot.packingLotId,batchId:lot.batchId,brand:lot.brand,designNumber:lot.designNumber,
                color:lot.color,photo:lot.photo||bom?.photo||'',pattern:bom?.pattern||'',mrp:bom?.mrp??'',pieces:lot.pieces,
                quantity:qty,setQuantity:sets,remainderQuantity:qty-sets*sizes.length,sizes,
                worker:String(request.worker).trim(),deliveryDate:request.deliveryDate,status:'pending',assignedAt:time()};
            s.bundlingData.push(row); return row;
        }
        async function assignBundling(request) {return transaction(s=>assignBundlingInState(s,request));}
        async function assignBundlingBulk(requests) {
            if(!Array.isArray(requests)||!requests.length)throw new Error('Add at least one assignment.');
            return transaction(s=>requests.map(request=>assignBundlingInState(s,request)));
        }
        async function passBundling(id) {
            return transaction(s => {
                const row = s.bundlingData.find(b => b.id === id);
                if (!row) throw new Error('Bundling assignment not found.');
                if (row.status === 'passed') return row;
                if (row.sizes.reduce((n,r) => n + number(r.quantity,'Size quantity'),0) !== row.quantity) throw new Error('Size quantities must equal the full lot quantity.');
                const sources = s.packingData.filter(w => (w.packingLotId || `legacy-${w.id}`) === row.packingLotId);
                if (!sources.length || sources.some(w => w.stopped || w.passedQty !== w.inputQty-w.damageQty || w.passedQty < row.quantity)) throw new Error('The source packing lot is not fully passed.');
                const reserved=s.bundlingData.filter(b=>b.packingLotId===row.packingLotId).reduce((n,b)=>n+number(b.quantity,'Assigned quantity'),0);
                if(reserved>Math.min(...sources.map(w=>w.passedQty)))throw new Error('Bundling reservations exceed the received quantity.');
                sources.forEach(w => getPool(s,w.poolId));
                row.status = 'passed'; row.passedAt = time();
                if (!s.inventoryData.some(r => r.bundlingId === id)) s.inventoryData.push({...copy(row), id:id + '-INV', bundlingId:id, receivedAt:row.passedAt,
                    packingHistory:copy(sources), productionHistory:copy(s.approvedPool.filter(p => same(p.batchId,row.batchId))),
                    batchDocument:copy([...s.approvedBatchData,...s.batchData].find(b => same(b.batchId,row.batchId)) || {})});
                return row;
            });
        }
        return { views, assign, edit, pass, stop, recoverRepair, transaction, readState,
            packingBatches, assignPacking, assignPackingBulk, assignBundlingBulk, setPackingHold, passPackingLot, packingLotMath, editPackingLot, bundlingReady, assignBundling, passBundling, brandSizes,
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
