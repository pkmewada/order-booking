/* ============================================================
   ADDITIONAL WORK — SHARED TEMPLATE
   Config via: window.ADDITIONAL_WORK_CONFIG = { workType, storageKey }
   ============================================================ */

$(document).ready(function () {
    "use strict";

    const CFG = window.ADDITIONAL_WORK_CONFIG || {};
    const WORK_TYPE = CFG.workType || "Additional Work";
    const STORAGE_KEY = CFG.storageKey || ("addWork_" + WORK_TYPE.toLowerCase().replace(/\s+/g, "_"));
    const APPROVED_POOL_KEY = "approvedPool";
    const HISTORY_KEY = STORAGE_KEY + "_history";

    const ROWS_PER_PAGE = 10;

    const WORKERS = [
        "Ahmad Khan", "Bilal Ahmed", "Danish Ali", "Faisal Khan",
        "Usman Malik", "Ali Ahmed", "Imran Khan", "Saeed Ahmad",
        "Zafar Iqbal", "Rashid Mahmood"
    ];

    let pool = [];
    let workData = [];
    let nextId = 1;
    let availablePage = 1;
    let assignedPage = 1;

    /* ============ HELPERS ============ */
    function escapeHtml(v) {
        return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    function readStorage(k) {
        try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : []; }
        catch { return []; }
    }
    function saveStorage(k, v) {
        try { localStorage.setItem(k, JSON.stringify(v)); return true; }
        catch { return false; }
    }
    function normalize(v) { return String(v ?? "").trim().toLowerCase(); }

    function loadData() {
        pool = readStorage(APPROVED_POOL_KEY).filter(p =>
            p.currentStage &&
            p.currentStage.type === "additional_work" &&
            Array.isArray(p.currentStage.works) &&
            p.currentStage.works.map(normalize).includes(normalize(WORK_TYPE))
        );
        workData = readStorage(STORAGE_KEY);
        nextId = Number(localStorage.getItem(STORAGE_KEY + "_nextId")) || 1;
    }
    function saveData() {
        saveStorage(STORAGE_KEY, workData);
        localStorage.setItem(STORAGE_KEY + "_nextId", String(nextId));
    }

    function pushHistory(entry) {
        const h = readStorage(HISTORY_KEY);
        h.push({ id: Date.now() + Math.floor(Math.random() * 1000), at: new Date().toLocaleString("en-GB"), ...entry });
        saveStorage(HISTORY_KEY, h);
    }

    function getPoolTotal(p) { return Number(p.quantity) || 0; }
    function getPoolAssigned(p) {
        return workData.filter(d => Number(d.poolId) === Number(p.id))
            .reduce((s, d) => s + (Number(d.quantity) || 0), 0);
    }
    function getPoolRemaining(p) { return Math.max(0, getPoolTotal(p) - getPoolAssigned(p)); }

    function computeStatus(item) {
        if (item.stopped) return "stopped";
        const qty = item.quantity || 0, damage = item.damage || 0;
        const progress = item.progress || 0, passed = item.passedQty || 0;
        const eff = Math.max(0, qty - damage);
        if (progress === 0) return "pending";
        if (eff > 0 && progress >= eff && passed >= progress) return "passed";
        return "in_progress";
    }
    function isFullyPassed(item) {
        const qty = item.quantity || 0, damage = item.damage || 0;
        const progress = item.progress || 0, passed = item.passedQty || 0;
        const eff = Math.max(0, qty - damage);
        return eff > 0 && progress >= eff && passed >= progress;
    }

    function getPriorityClass(p) {
        p = normalize(p);
        if (p === "high") return "priority-high";
        if (p === "medium") return "priority-medium";
        if (p === "low") return "priority-low";
        return "";
    }

    function formatDate(ds) {
        if (!ds) return "Not Set";
        const d = new Date(ds);
        if (isNaN(d.getTime())) return "Not Set";
        return d.getDate() + " " + d.toLocaleString("en", { month: "long" }) + " " + d.getFullYear();
    }
    function getDeliveryClass(ds) {
        if (!ds) return "delivery-badge-secondary";
        const t = new Date(); t.setHours(0,0,0,0);
        const d = new Date(ds); d.setHours(0,0,0,0);
        const diff = Math.ceil((d - t) / 86400000);
        if (diff < 0) return "delivery-overdue";
        if (diff === 0) return "delivery-due-today";
        return "delivery-ontrack";
    }
    function defaultDeliveryDate(days) {
        const d = new Date(); d.setDate(d.getDate() + (days || 10));
        return d.toISOString().split("T")[0];
    }
    function splitQuantity(total, count) {
        total = Number(total) || 0;
        count = Math.max(1, Number(count) || 1);
        if (count === 1) return [total];
        const base = Math.floor(total / count);
        const rem = total - base * count;
        const r = [];
        for (let i = 0; i < count; i++) r.push(base + (i >= count - rem ? 1 : 0));
        return r;
    }
    function sanitizeName(n) {
        return String(n || "").trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Piece";
    }

    function buildPager($c, cur, tot, items, size, onChange, label) {
        $c.empty();
        if (!items) return;
        const s = (cur - 1) * size + 1, e = Math.min(cur * size, items);
        $c.append(`<div class="info-text">Showing <strong>${s}-${e}</strong> of <strong>${items}</strong> ${label}</div>`);
        const $p = $('<div class="pager"></div>');
        const $prev = $(`<button class="page-btn" ${cur === 1 ? "disabled" : ""}><i class="bx bx-chevron-left"></i></button>`);
        $prev.on("click", () => cur > 1 && onChange(cur - 1));
        $p.append($prev);
        let sp = Math.max(1, cur - 2), ep = Math.min(tot, sp + 4);
        if (ep - sp < 4) sp = Math.max(1, ep - 4);
        for (let i = sp; i <= ep; i++) {
            const $b = $(`<button class="page-btn ${i === cur ? "active" : ""}">${i}</button>`);
            $b.on("click", () => onChange(i));
            $p.append($b);
        }
        const $next = $(`<button class="page-btn" ${cur === tot ? "disabled" : ""}><i class="bx bx-chevron-right"></i></button>`);
        $next.on("click", () => cur < tot && onChange(cur + 1));
        $p.append($next);
        $c.append($p);
    }

    /* ============================================================
       TABLE 1 — AVAILABLE
       ============================================================ */
    function renderAvailableTable() {
        const tbody = $("#availableList");
        tbody.empty();
        const available = pool.filter(p => getPoolRemaining(p) > 0);

        if (!available.length) {
            tbody.html(`<tr><td colspan="11" class="text-center text-muted py-4"><i class="bx bx-info-circle me-1"></i> No available work for ${escapeHtml(WORK_TYPE)}.</td></tr>`);
            $("#availablePagination").empty();
            return;
        }

        const totalItems = available.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / ROWS_PER_PAGE));
        if (availablePage > totalPages) availablePage = totalPages;
        const startIdx = (availablePage - 1) * ROWS_PER_PAGE;
        const pageItems = available.slice(startIdx, startIdx + ROWS_PER_PAGE);

        pageItems.forEach(it => {
            const total = getPoolTotal(it);
            const assigned = getPoolAssigned(it);
            const remaining = Math.max(0, total - assigned);
            const pc = getPriorityClass(it.priority);
            const statusHtml = assigned === 0
                ? `<span class="status-badge not_assigned">Not Assigned</span>`
                : (remaining > 0 ? `<span class="status-badge assign_progress">In Progress</span>` : "");
            const photoSrc = it.photo || "assets/images/default.jpg";

            tbody.append(`
                <tr>
                    <td><strong>${escapeHtml(it.batchId || "-")}</strong></td>
                    <td><img src="${escapeHtml(photoSrc)}" style="width:55px;height:55px;object-fit:cover;border-radius:6px;" onerror="this.style.display='none';"></td>
                    <td>${escapeHtml(it.brand || "-")}</td>
                    <td>${escapeHtml(it.designNumber || "-")}</td>
                    <td><span class="color-text">${escapeHtml(it.color || "-")}</span></td>
                    <td><span class="piece-num">Piece ${escapeHtml(it.pieceNumber)}</span></td>
                    <td>${escapeHtml(it.pieceItem || "-")}</td>
                    <td>
                        <span class="qty-pair">
                            <span class="qty-total">${total}</span>
                            <span class="qty-sep">/</span>
                            <span class="qty-assigned ${assigned === 0 ? "zero" : ""}">${assigned}</span>
                        </span>
                    </td>
                    <td><span class="priority-badge ${pc}">${escapeHtml(it.priority || "-")}</span></td>
                    <td>${statusHtml}</td>
                    <td>
                        ${remaining > 0 ? `
                            <button class="btn btn-sm btn-primary assign-single-btn" data-pool-id="${it.id}">
                                <i class="bx bx-plus"></i> Assign
                            </button>
                        ` : ""}
                    </td>
                </tr>
            `);
        });

        buildPager($("#availablePagination"), availablePage, totalPages, totalItems, ROWS_PER_PAGE,
            p => { availablePage = p; renderAvailableTable(); }, "items");
    }

    /* ============================================================
       TABLE 2 — ASSIGNED
       ============================================================ */
    function renderAssignedTable() {
        const tbody = $("#assignedList");
        tbody.empty();
        const visible = workData.filter(w => !isFullyPassed(w));

        if (!visible.length) {
            tbody.html(`<tr><td colspan="14" class="text-center text-muted py-4"><i class="bx bx-info-circle me-1"></i> No ${escapeHtml(WORK_TYPE)} assignments yet.</td></tr>`);
            $("#assignedPagination").empty();
            return;
        }

        const totalItems = visible.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / ROWS_PER_PAGE));
        if (assignedPage > totalPages) assignedPage = totalPages;
        const startIdx = (assignedPage - 1) * ROWS_PER_PAGE;
        const pageItems = visible.slice(startIdx, startIdx + ROWS_PER_PAGE);

        let serial = startIdx;
        const grouped = {};
        pageItems.forEach(item => {
            const k = String(item.batchId);
            if (!grouped[k]) grouped[k] = [];
            grouped[k].push(item);
        });

        Object.keys(grouped).forEach(batchId => {
            const items = grouped[batchId];
            serial++;
            items.forEach((item, idx) => {
                const qty = item.quantity || 0, damage = item.damage || 0;
                const progress = item.progress || 0, passed = item.passedQty || 0;
                const eff = Math.max(0, qty - damage);
                const remaining = Math.max(0, eff - progress);
                const pct = eff > 0 ? Math.min(100, Math.round((progress / eff) * 100)) : 0;
                const pc = getPriorityClass(item.priority);
                const statusKey = computeStatus(item);
                let statusHtml = "";
                if (statusKey === "stopped") statusHtml = `<span class="status-badge stopped">Stopped</span>`;
                else if (statusKey === "pending") statusHtml = `<span class="status-badge pending">Pending</span>`;
                else if (statusKey === "passed") statusHtml = `<span class="status-badge passed">Passed</span>`;
                else statusHtml = `<span class="status-badge in_progress">In Progress</span>`;

                let deliveryHtml = `<span class="text-muted">Not Set</span>`;
                if (item.deliveryDate) {
                    const cls = getDeliveryClass(item.deliveryDate);
                    deliveryHtml = `<span class="badge ${cls} delivery-date-badge">${formatDate(item.deliveryDate)}</span>`;
                }

                const isFirst = idx === 0;
                const damageHtml = damage > 0 ? `<span class="damage-badge">${damage}</span>` : `<span class="damage-empty">-</span>`;
                const isStopped = !!item.stopped;
                const canPass = !isStopped && progress > passed;

                tbody.append(`
                    <tr>
                        <td>${isFirst ? serial : ""}</td>
                        <td>${isFirst ? escapeHtml(item.batchId) : ""}</td>
                        <td><span class="fw-semibold text-primary">${escapeHtml(item.subBatch || "-")}</span></td>
                        <td>${escapeHtml(item.brand || "-")}</td>
                        <td>${escapeHtml(item.pieceType || "-")}</td>
                        <td>${escapeHtml(item.worker || "-")}</td>
                        <td>
                            <span class="qty-pair">
                                <span class="qty-total">${qty}</span>
                                <span class="qty-sep">/</span>
                                <span class="qty-assigned ${progress === 0 ? "zero" : ""}">${progress}</span>
                            </span>
                        </td>
                        <td>
                            <div class="d-flex align-items-center gap-2">
                                <span>${progress}</span>
                                <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${pct}%;"></div></div>
                            </div>
                        </td>
                        <td>${damageHtml}</td>
                        <td>${remaining}</td>
                        <td><span class="priority-badge ${pc}">${escapeHtml(item.priority || "-")}</span></td>
                        <td>${deliveryHtml}</td>
                        <td>${statusHtml}</td>
                        <td>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-primary progress-btn" data-id="${item.id}" title="Edit" ${isStopped ? "disabled" : ""}><i class="bx bx-edit"></i></button>
                                ${progress > 0 ? `<button class="btn btn-sm pass-row-btn pass-row-action-btn" data-id="${item.id}" title="Pass" ${canPass ? "" : "disabled"}><i class="bx bx-right-arrow-alt"></i></button>` : ""}
                                ${(progress === 0 && damage === 0 && passed === 0) ? `<button class="btn btn-sm stop-row-btn stop-row-action-btn" data-id="${item.id}" title="Stop"><i class="bx bx-stop"></i></button>` : ""}
                                <button class="btn btn-sm view-row-btn view-row-action-btn" data-id="${item.id}" title="View"><i class="bx bx-show"></i></button>
                            </div>
                        </td>
                    </tr>
                `);
            });
        });

        buildPager($("#assignedPagination"), assignedPage, totalPages, totalItems, ROWS_PER_PAGE,
            p => { assignedPage = p; renderAssignedTable(); }, "assignments");
    }

    /* ============ ASSIGN MODAL ============ */
    function populateBatchSelect() {
        const select = $("#batchSelect");
        select.empty();
        select.append('<option value="">Choose Batch</option>');
        const available = pool.filter(p => getPoolRemaining(p) > 0);
        available.forEach(item => {
            const rem = getPoolRemaining(item);
            select.append(`<option value="${item.id}">${escapeHtml(item.batchId)} - ${escapeHtml(item.brand)} - Piece ${item.pieceNumber} (${escapeHtml(item.pieceItem)}) - Remaining ${rem}/${item.quantity}</option>`);
        });
    }

    function generateAssignRows(poolItem, remaining) {
        const container = $("#assignRowsContainer");
        container.empty();
        const total = getPoolTotal(poolItem);
        const assigned = getPoolAssigned(poolItem);

        const workerOptsBase = WORKERS.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("");

        container.append(`
            <div class="alert alert-primary mb-3">
                <div class="row align-items-center">
                    <div class="col-md-7">
                        <strong>${escapeHtml(poolItem.batchId)}</strong> — Piece ${poolItem.pieceNumber} (${escapeHtml(poolItem.pieceItem)})
                        <div class="small text-muted mt-1">
                            <strong>Design:</strong> ${escapeHtml(poolItem.designNumber || "-")} •
                            <strong>Total:</strong> ${total} •
                            <strong>Assigned:</strong> <span class="text-success">${assigned}</span> •
                            <strong>Remaining:</strong> <span class="text-warning">${remaining}</span>
                        </div>
                    </div>
                    <div class="col-md-5">
                        <label class="form-label mb-0">Split Count (Rows)</label>
                        <div class="input-group">
                            <input type="number" class="form-control" id="splitCount" value="1" min="1" max="20">
                            <button class="btn btn-success" id="applySplitBtn" type="button"><i class="bx bx-check"></i> Apply</button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        function renderRows(count) {
            container.find(".table-responsive").remove();
            if (count < 1) count = 1;
            const autoQtys = splitQuantity(remaining, count);

            container.append(`
                <div class="table-responsive">
                    <table class="table table-bordered table-sm mb-0">
                        <thead>
                            <tr>
                                <th>Sub-Batch</th>
                                <th>Worker</th>
                                <th>Quantity</th>
                                <th>Priority</th>
                                <th>Delivery Date</th>
                            </tr>
                        </thead>
                        <tbody id="assignTableBody"></tbody>
                    </table>
                </div>
            `);

            const tbody = $("#assignTableBody");
            const defDate = defaultDeliveryDate(10);
            const prefix = WORK_TYPE.substring(0, 3).toUpperCase();

            for (let i = 0; i < count; i++) {
                const subBatch = `${poolItem.batchId}-${sanitizeName(poolItem.pieceItem)}-${prefix}${i+1}`;
                tbody.append(`
                    <tr class="assignment-row">
                        <td><span class="sub-batch-label fw-semibold text-primary">${escapeHtml(subBatch)}</span><input type="hidden" class="sub-batch-input" value="${escapeHtml(subBatch)}"></td>
                        <td><select class="form-select form-select-sm worker-select"><option value="">Select Worker</option>${workerOptsBase}</select></td>
                        <td><input type="number" class="form-control form-control-sm quantity-input" value="${autoQtys[i]}" min="1" max="${remaining}"></td>
                        <td>
                            <select class="form-select form-select-sm priority-select">
                                <option value="Low">Low</option>
                                <option value="Medium" selected>Medium</option>
                                <option value="High">High</option>
                            </select>
                        </td>
                        <td><input type="date" class="form-control form-control-sm delivery-date-input" value="${defDate}"></td>
                    </tr>
                `);
            }
        }

        renderRows(1);
        $("#applySplitBtn").off("click").on("click", function () {
            const c = parseInt($("#splitCount").val()) || 1;
            renderRows(c);
        });
    }

    $(document).on("click", ".assign-single-btn", function () {
        const poolId = Number($(this).data("pool-id"));
        const item = pool.find(p => Number(p.id) === poolId);
        if (!item) return;
        const rem = getPoolRemaining(item);
        if (rem <= 0) { Swal.fire({ icon: "info", title: "Fully Assigned" }); return; }
        populateBatchSelect();
        $("#batchSelect").val(item.id).trigger("change");
        $("#assignModal").modal("show");
    });

    $("#batchSelect").on("change", function () {
        const poolId = Number($(this).val());
        if (!poolId) { $("#assignRowsContainer").empty(); return; }
        const item = pool.find(p => Number(p.id) === poolId);
        if (!item) return;
        generateAssignRows(item, getPoolRemaining(item));
    });

    $("#saveAssignBtn").on("click", function () {
        const poolId = Number($("#batchSelect").val());
        if (!poolId) { Swal.fire({ icon: "warning", title: "Select Batch" }); return; }
        const poolItem = pool.find(p => Number(p.id) === poolId);
        if (!poolItem) return;

        const rows = [];
        let valid = true;
        $(".assignment-row").each(function () {
            const subBatch = $(this).find(".sub-batch-input").val();
            const worker = $(this).find(".worker-select").val();
            const quantity = parseInt($(this).find(".quantity-input").val()) || 0;
            const priority = $(this).find(".priority-select").val();
            const deliveryDate = $(this).find(".delivery-date-input").val();
            if (!worker || quantity < 1 || !deliveryDate) { valid = false; return false; }
            rows.push({ subBatch, worker, quantity, priority, deliveryDate });
        });

        if (!valid || !rows.length) { Swal.fire({ icon: "warning", title: "Incomplete" }); return; }
        const totalAssigned = rows.reduce((s, r) => s + r.quantity, 0);
        const remaining = getPoolRemaining(poolItem);
        if (totalAssigned > remaining) { Swal.fire({ icon: "warning", title: "Over Quantity" }); return; }

        rows.forEach(row => {
            const newId = nextId++;
            workData.push({
                id: newId,
                poolId: poolItem.id,
                batchId: poolItem.batchId,
                brand: poolItem.brand,
                designNumber: poolItem.designNumber,
                color: poolItem.color,
                pieceType: `Piece ${poolItem.pieceNumber} (${poolItem.pieceItem})`,
                pieceNumber: poolItem.pieceNumber,
                subBatch: row.subBatch,
                worker: row.worker,
                quantity: row.quantity,
                priority: row.priority,
                deliveryDate: row.deliveryDate,
                progress: 0,
                damage: 0,
                passedQty: 0,
                photo: poolItem.photo || "",
                workType: WORK_TYPE
            });
            pushHistory({ workId: newId, batchId: poolItem.batchId, subBatch: row.subBatch, action: `Assigned ${row.quantity} pcs to ${row.worker}`, by: "Manager" });
        });

        saveData();
        renderAvailableTable();
        renderAssignedTable();
        $("#assignModal").modal("hide");
        Swal.fire({ icon: "success", title: "Assigned", timer: 1800, showConfirmButton: false });
    });

    /* ============ UPDATE PROGRESS MODAL ============ */
    let currentEditingId = null;

    function refreshProgressNumbers(item) {
        const progress = item.progress || 0, damage = item.damage || 0;
        const passed = item.passedQty || 0, qty = item.quantity || 0;
        const eff = Math.max(0, qty - damage);
        const remaining = Math.max(0, eff - progress);
        $("#progressTotal").val(qty);
        $("#progressPassed").val(passed);
        $("#progressRemaining").val(remaining);
        $("#progressMax").text(remaining);
        $("#progressLivePreview").html(`<div class="d-flex justify-content-between"><span><strong>Eff:</strong> ${eff}</span><span><strong>Progress:</strong> ${progress}</span><span><strong>Passed:</strong> ${passed}</span><span><strong>Remaining:</strong> ${remaining}</span></div>`);
    }

    $(document).on("click", ".progress-btn", function () {
        if ($(this).prop("disabled")) return;
        const id = Number($(this).data("id"));
        const item = workData.find(d => Number(d.id) === id);
        if (!item) return;
        if (isFullyPassed(item)) { Swal.fire({ icon: "info", title: "Fully Passed" }); return; }
        currentEditingId = id;
        $("#progressSubBatch").val(item.subBatch);
        $("#progressWorker").val(item.worker);
        $("#progressTypeSelect").val("completed");
        $("#progressQty").val(0);
        refreshProgressNumbers(item);
        $("#progressModal").modal("show");
    });

    $(document).on("input change", "#progressQty, #progressTypeSelect", function () {
        const item = workData.find(d => Number(d.id) === currentEditingId);
        if (!item) return;
        const type = $("#progressTypeSelect").val();
        const addQty = parseInt($("#progressQty").val()) || 0;
        const progress = item.progress || 0, damage = item.damage || 0;
        const passed = item.passedQty || 0, qty = item.quantity || 0;
        const previewProgress = type === "completed" ? progress + addQty : progress;
        const previewDamage = type === "damage" ? damage + addQty : damage;
        const eff = Math.max(0, qty - previewDamage);
        const remaining = Math.max(0, eff - previewProgress);
        $("#progressLivePreview").html(`<div class="d-flex justify-content-between"><span><strong>Eff:</strong> ${eff}</span><span><strong>Progress:</strong> ${previewProgress}</span><span><strong>Passed:</strong> ${passed}</span><span><strong>Remaining:</strong> ${remaining}</span></div>`);
    });

    $("#updateProgressBtn").on("click", function () {
        const item = workData.find(d => Number(d.id) === currentEditingId);
        if (!item) return;
        const type = $("#progressTypeSelect").val();
        const addQty = parseInt($("#progressQty").val()) || 0;
        const qty = item.quantity || 0;
        const existingProgress = item.progress || 0;
        const existingDamage = item.damage || 0;
        const eff = Math.max(0, qty - existingDamage);
        const remainingBefore = Math.max(0, eff - existingProgress);
        if (addQty < 0) { Swal.fire({ icon: "warning", title: "Invalid" }); return; }
        if (addQty > remainingBefore) { Swal.fire({ icon: "warning", title: "Too Much", text: `Max ${remainingBefore}` }); return; }

        if (type === "completed") {
            item.progress = existingProgress + addQty;
            pushHistory({ workId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Progress +${addQty} (total ${item.progress})`, by: "Manager" });
        } else {
            item.damage = existingDamage + addQty;
            pushHistory({ workId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Damage +${addQty} (total ${item.damage})`, by: "Manager" });
        }

        const finalEff = Math.max(0, item.quantity - (item.damage || 0));
        const finalProgress = item.progress || 0;
        const finalPassed = item.passedQty || 0;

        if (finalEff > 0 && finalProgress >= finalEff && finalPassed < finalProgress) {
            const autoPassQty = finalProgress - finalPassed;
            pushToNextStage(item, autoPassQty);
            item.passedQty = finalProgress;
            pushHistory({ workId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Auto-passed ${autoPassQty} pcs to next stage`, by: "System" });
            saveData();
            renderAssignedTable();
            $("#progressModal").modal("hide");
            Swal.fire({ icon: "success", title: "Auto-Passed", text: `${finalProgress} pcs completed & auto-passed.`, timer: 2000, showConfirmButton: false });
            return;
        }

        saveData();
        renderAssignedTable();
        $("#progressModal").modal("hide");
        Swal.fire({ icon: "success", title: "Updated", timer: 1200, showConfirmButton: false });
    });

    /* ============ PASS TO NEXT STAGE ============ */
    function pushToNextStage(item, qty) {
        const pool = readStorage(APPROVED_POOL_KEY);
        const idx = pool.findIndex(p => String(p.batchId) === String(item.batchId) && Number(p.pieceNumber) === Number(item.pieceNumber));
        if (idx === -1) return;
        const entry = pool[idx];
        const route = entry.route || [];
        const currentStage = entry.currentStage || {};
        const curIdx = route.findIndex(r => r.stage === currentStage.stage && r.type === currentStage.type);
        const nextStage = (curIdx !== -1 && curIdx + 1 < route.length) ? route[curIdx + 1] : { type: "packing", stage: "Packing" };

        pool[idx] = {
            ...entry,
            currentStage: nextStage,
            quantity: qty,
            stageHistory: [
                ...(entry.stageHistory || []),
                { at: new Date().toLocaleString("en-GB"), stage: nextStage.stage, type: nextStage.type, action: "entered", fromQty: qty }
            ],
            updatedAt: new Date().toLocaleString("en-GB")
        };
        saveStorage(APPROVED_POOL_KEY, pool);
    }

    $(document).on("click", ".pass-row-action-btn", function () {
        if ($(this).prop("disabled")) return;
        const id = Number($(this).data("id"));
        const item = workData.find(d => Number(d.id) === id);
        if (!item) return;
        if (isFullyPassed(item)) { Swal.fire({ icon: "info", title: "Already Passed" }); return; }

        const progress = item.progress || 0, passed = item.passedQty || 0;
        const passable = progress - passed;
        if (passable <= 0) { Swal.fire({ icon: "info", title: "Nothing to Pass" }); return; }

        Swal.fire({
            title: "Pass to Next Stage?",
            html: `<div class="text-start"><p><strong>Sub-Batch:</strong> ${escapeHtml(item.subBatch)}</p><p><strong>Worker:</strong> ${escapeHtml(item.worker)}</p><p><strong>Completed:</strong> ${progress}</p><p><strong>Already Passed:</strong> ${passed}</p><hr><p><strong>Pass now:</strong> <span class="text-success fw-bold">${passable}</span></p></div>`,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#198754",
            confirmButtonText: "Yes, Pass",
            cancelButtonText: "Cancel"
        }).then(r => {
            if (!r.isConfirmed) return;
            pushToNextStage(item, passable);
            item.passedQty = progress;
            pushHistory({ workId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Passed ${passable} pcs to next stage`, by: "Manager" });
            saveData();
            renderAssignedTable();
            Swal.fire({ icon: "success", title: "Passed", timer: 1800, showConfirmButton: false });
        });
    });

    /* ============ STOP ROW ============ */
    $(document).on("click", ".stop-row-action-btn", function () {
        const id = Number($(this).data("id"));
        const item = workData.find(d => Number(d.id) === id);
        if (!item) return;

        Swal.fire({
            title: "Stop this Assignment?",
            html: `<div class="text-start"><p><strong>Sub-Batch:</strong> ${escapeHtml(item.subBatch)}</p><p><strong>Worker:</strong> ${escapeHtml(item.worker)}</p><p class="text-danger mb-0">This assignment will be frozen.</p></div>`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, Stop it",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#dc3545"
        }).then(r => {
            if (!r.isConfirmed) return;
            item.stopped = true;
            item.stoppedAt = new Date().toLocaleString("en-GB");
            pushHistory({ workId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: "Stopped / Frozen", by: "Manager" });
            saveData();
            renderAssignedTable();
            Swal.fire({ icon: "success", title: "Stopped", timer: 1800, showConfirmButton: false });
        });
    });

    /* ============ VIEW ============ */
    $(document).on("click", ".view-row-action-btn", function () {
        const id = Number($(this).data("id"));
        const item = workData.find(d => Number(d.id) === id);
        if (!item) return;

        Swal.fire({
            title: "Assignment Details",
            html: `<div class="text-start">
                <p><strong>Batch:</strong> ${escapeHtml(item.batchId)}</p>
                <p><strong>Sub-Batch:</strong> ${escapeHtml(item.subBatch)}</p>
                <p><strong>Piece:</strong> ${escapeHtml(item.pieceType || "-")}</p>
                <p><strong>Worker:</strong> ${escapeHtml(item.worker)}</p>
                <p><strong>Quantity:</strong> ${item.quantity}</p>
                <p><strong>Progress:</strong> ${item.progress || 0}</p>
                <p><strong>Damage:</strong> ${item.damage || 0}</p>
                <p><strong>Passed:</strong> ${item.passedQty || 0}</p>
                <p><strong>Delivery:</strong> ${formatDate(item.deliveryDate)}</p>
            </div>`,
            confirmButtonColor: "#161617"
        });
    });

    /* ============ REFRESH ============ */
    $("#refreshBtn").on("click", function () {
        loadData();
        renderAvailableTable();
        renderAssignedTable();
        Swal.fire({ icon: "success", title: "Refreshed", timer: 1000, showConfirmButton: false });
    });

    /* ============ INIT ============ */
    loadData();
    renderAvailableTable();
    renderAssignedTable();

    window.addEventListener("focus", function () {
        loadData();
        renderAvailableTable();
        renderAssignedTable();
    });

    setInterval(function () {
        const prevPool = JSON.stringify(pool);
        const prevWork = JSON.stringify(workData);
        loadData();
        if (JSON.stringify(pool) !== prevPool || JSON.stringify(workData) !== prevWork) {
            renderAvailableTable();
            renderAssignedTable();
        }
    }, 2000);
});