$(document).ready(function () {
    "use strict";

    const APPROVED_POOL_KEY = "approvedPool";
    const WORK_STORAGE_KEY = "addWork_hand_work";
    const WORK_NEXT_ID_KEY = "addWork_hand_work_nextId";
    const WORK_HISTORY_KEY = "addWork_hand_work_history";

    const WORK_TYPE = "Hand Work";
    const SUB_BATCH_SUFFIX = "C";   // ✅ -C1 (matches Cutting Manager)

    const ROWS_PER_PAGE = 10;

    const PLACEHOLDER_IMG =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="133">' +
            '<rect width="100%" height="100%" fill="#f1f3f8"/>' +
            '<text x="50%" y="55%" font-family="Arial" font-size="11" fill="#9aa6c2" text-anchor="middle">No Image</text>' +
            '</svg>'
        );

    const WORKERS = [
        "Ahmad Khan", "Bilal Ahmed", "Danish Ali", "Faisal Khan",
        "Usman Malik", "Ali Ahmed", "Imran Khan", "Saeed Ahmad",
        "Zafar Iqbal", "Rashid Mahmood"
    ];

    let pool = [];
    let workData = [];
    let nextId = 1;
    let currentEditingId = null;

    let availablePage = 1;
    let assignedPage = 1;

    let bulkSelectedBatchIds = new Set();
    let bulkPieceSplits = {};

    /* ================= HELPERS ================= */
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
        workData = readStorage(WORK_STORAGE_KEY);
        nextId = Number(localStorage.getItem(WORK_NEXT_ID_KEY)) || 1;
    }
    function saveData() {
        saveStorage(WORK_STORAGE_KEY, workData);
        localStorage.setItem(WORK_NEXT_ID_KEY, String(nextId));
    }

    function pushHistory(entry) {
        const h = readStorage(WORK_HISTORY_KEY);
        h.push({ id: Date.now() + Math.floor(Math.random() * 1000), at: new Date().toLocaleString("en-GB"), ...entry });
        saveStorage(WORK_HISTORY_KEY, h);
    }

    function parseHistoryTime(str) {
        const m = String(str).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})/);
        if (!m) return 0;
        const [, d, mo, y, h, mi, se] = m;
        return new Date(`${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}T${h.padStart(2,"0")}:${mi}:${se}`).getTime();
    }

    function getHistoryFor(id) {
        return readStorage(WORK_HISTORY_KEY)
            .filter(h => Number(h.workId) === Number(id))
            .sort((a, b) => parseHistoryTime(a.at) - parseHistoryTime(b.at));
    }

    function sanitizePieceName(name) {
        return String(name || "").trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Piece";
    }
    function peekSubBatchId(batchId, pieceName, splitIndex) {
        let formatted = String(batchId || "");
        if (!formatted.includes("BATCH-")) formatted = `BATCH-${String(batchId).padStart(3, "0")}`;
        const safePiece = sanitizePieceName(pieceName);
        const num = Number(splitIndex || 0) + 1;
        return `${formatted}-${safePiece}-${SUB_BATCH_SUFFIX}${num}`;
    }

    function formatDate(ds) {
        if (!ds) return "Not Set";
        const d = new Date(ds);
        if (isNaN(d.getTime())) return "Not Set";
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
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
    function defaultDate() {
        const d = new Date(); d.setDate(d.getDate() + 10);
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
    function getPriorityClass(p) {
        p = normalize(p);
        if (p === "high") return "priority-high";
        if (p === "medium") return "priority-medium";
        if (p === "low") return "priority-low";
        return "";
    }
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
    function isUntouched(item) {
        return (item.progress || 0) === 0 && (item.damage || 0) === 0 && (item.passedQty || 0) === 0;
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

    function getPoolTotal(p) { return Number(p.quantity) || 0; }
    function getPoolAssigned(p) {
        return workData.filter(d => Number(d.poolId) === Number(p.id))
            .reduce((s, d) => s + (Number(d.quantity) || 0), 0);
    }
    function getPoolRemaining(p) { return Math.max(0, getPoolTotal(p) - getPoolAssigned(p)); }
    function getBusyWorkersExcluding(poolId) {
        const busy = new Set();
        workData.forEach(row => {
            if (Number(row.poolId) !== Number(poolId) && !isFullyPassed(row) && !row.stopped) {
                if (row.worker) busy.add(row.worker);
            }
        });
        return busy;
    }
    function getWorkersInPool(poolId) {
        const workers = new Set();
        workData.forEach(row => {
            if (Number(row.poolId) === Number(poolId) && row.worker) workers.add(row.worker);
        });
        return workers;
    }

    /* ============================================================
       MANUAL SPLIT — auto-distribute remaining qty
       ============================================================ */
    function redistributeQuantities($tbody, totalRemaining, changedRowIdx, rowSelector) {
        const $rows = $tbody.find(rowSelector);
        if (!$rows.length) return;

        const rowCount = $rows.length;
        if (rowCount === 1) {
            $rows.eq(0).find(".quantity-input").val(totalRemaining);
            return;
        }

        const manualVal = parseInt($rows.eq(changedRowIdx).find(".quantity-input").val()) || 0;
        const remainingForOthers = Math.max(0, totalRemaining - manualVal);
        const otherRowsCount = rowCount - 1;

        if (otherRowsCount === 1) {
            $rows.each(function (i) {
                if (i === changedRowIdx) return;
                $(this).find(".quantity-input").val(remainingForOthers);
            });
            return;
        }

        const base = Math.floor(remainingForOthers / otherRowsCount);
        const rem = remainingForOthers - (base * otherRowsCount);

        let otherIdx = 0;
        $rows.each(function (i) {
            if (i === changedRowIdx) return;
            const extra = (otherIdx >= (otherRowsCount - rem)) ? 1 : 0;
            $(this).find(".quantity-input").val(base + extra);
            otherIdx++;
        });
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

        available.sort((a, b) => {
            if (String(a.batchId) !== String(b.batchId)) return String(a.batchId).localeCompare(String(b.batchId));
            return Number(a.pieceNumber) - Number(b.pieceNumber);
        });

        const totalItems = available.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / ROWS_PER_PAGE));
        if (availablePage > totalPages) availablePage = totalPages;
        const startIdx = (availablePage - 1) * ROWS_PER_PAGE;
        const pageItems = available.slice(startIdx, startIdx + ROWS_PER_PAGE);

        const grouped = {};
        pageItems.forEach(item => {
            const k = String(item.batchId);
            if (!grouped[k]) grouped[k] = [];
            grouped[k].push(item);
        });

        Object.keys(grouped).forEach(batchId => {
            const items = grouped[batchId].slice().sort((a, b) => Number(a.pieceNumber) - Number(b.pieceNumber));
            const first = items[0];
            const rowspan = items.length;
            const photoSrc = first.photo ? escapeHtml(first.photo) : PLACEHOLDER_IMG;
            const pc = getPriorityClass(first.priority);

            const batchCols = `
                <td rowspan="${rowspan}"><strong>${escapeHtml(first.batchId || "-")}</strong></td>
                <td rowspan="${rowspan}"><img src="${photoSrc}" style="width:55px;height:55px;object-fit:cover;border-radius:6px;" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';"></td>
                <td rowspan="${rowspan}">${escapeHtml(first.brand || "-")}</td>
                <td rowspan="${rowspan}">${escapeHtml(first.designNumber || "-")}</td>
                <td rowspan="${rowspan}"><span class="color-text">${escapeHtml(first.color || "-")}</span></td>
            `;

            items.forEach((it, idx) => {
                const total = getPoolTotal(it);
                const assigned = getPoolAssigned(it);
                const remaining = Math.max(0, total - assigned);
                const qtyHtml = `<span class="qty-pair"><span class="qty-total">${total}</span><span class="qty-sep">/</span><span class="qty-assigned ${assigned === 0 ? "zero" : ""}">${assigned}</span></span>`;
                const statusHtml = assigned === 0
                    ? `<span class="status-badge not_assigned">Not Assigned</span>`
                    : (remaining > 0 ? `<span class="status-badge assign_progress">In Progress</span>` : "");
                const actionHtml = remaining > 0
                    ? `<button class="btn btn-sm btn-primary assign-single-btn" data-pool-id="${it.id}"><i class="bx bx-plus"></i> Assign</button>`
                    : "";

                tbody.append(`
                    <tr>
                        ${idx === 0 ? batchCols : ""}
                        <td><div class="piece-line"><span class="piece-num">${escapeHtml(it.pieceNumber)} Piece</span></div></td>
                        <td><div class="piece-line">${escapeHtml(it.pieceItem || "-")}</div></td>
                        <td>${qtyHtml}</td>
                        <td><span class="priority-badge ${pc}">${escapeHtml(it.priority || "-")}</span></td>
                        <td>${statusHtml}</td>
                        <td>${actionHtml}</td>
                    </tr>
                `);
            });
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
                        <td><span class="qty-pair"><span class="qty-total">${qty}</span><span class="qty-sep">/</span><span class="qty-assigned ${progress === 0 ? "zero" : ""}">${progress}</span></span></td>
                        <td><div class="d-flex align-items-center gap-2"><span>${progress}</span><div class="progress-bar-container"><div class="progress-bar-fill" style="width:${pct}%;"></div></div></div></td>
                        <td>${damageHtml}</td>
                        <td>${remaining}</td>
                        <td><span class="priority-badge ${pc}">${escapeHtml(item.priority || "-")}</span></td>
                        <td>${deliveryHtml}</td>
                        <td>${statusHtml}</td>
                        <td>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-primary progress-btn" data-id="${item.id}" ${isStopped ? "disabled" : ""}><i class="bx bx-edit"></i></button>
                                ${progress > 0 ? `<button class="btn btn-sm pass-row-btn pass-row-action-btn" data-id="${item.id}" ${canPass ? "" : "disabled"}><i class="bx bx-right-arrow-alt"></i></button>` : ""}
                                ${isUntouched(item) ? `<button class="btn btn-sm stop-row-btn stop-row-action-btn" data-id="${item.id}"><i class="bx bx-stop"></i></button>` : ""}
                                <button class="btn btn-sm view-row-btn view-row-action-btn" data-id="${item.id}"><i class="bx bx-show"></i></button>
                            </div>
                        </td>
                    </tr>
                `);
            });
        });

        buildPager($("#assignedPagination"), assignedPage, totalPages, totalItems, ROWS_PER_PAGE,
            p => { assignedPage = p; renderAssignedTable(); }, "assignments");
    }

    /* ============================================================
       SINGLE ASSIGN
       ============================================================ */
    function populateBatchSelect() {
        const select = $("#batchSelect");
        select.empty();
        select.append('<option value="">Choose Batch</option>');
        pool.filter(p => getPoolRemaining(p) > 0).forEach(item => {
            const rem = getPoolRemaining(item);
            select.append(`<option value="${item.id}">${escapeHtml(item.batchId)} - ${escapeHtml(item.brand)} - Piece ${item.pieceNumber} (${escapeHtml(item.pieceItem)}) - Rem ${rem}/${item.quantity}</option>`);
        });
    }

    function generateAssignRows(poolItem, remaining) {
        const container = $("#assignRowsContainer");
        container.empty();
        const total = getPoolTotal(poolItem);
        const assigned = getPoolAssigned(poolItem);

        const workersInPool = getWorkersInPool(poolItem.id);
        const busyWorkers = getBusyWorkersExcluding(poolItem.id);

        let workerOpts = "";
        WORKERS.forEach(w => {
            if (workersInPool.has(w)) workerOpts += `<option value="${escapeHtml(w)}" data-in-pool="1">${escapeHtml(w)} (continuing)</option>`;
        });
        WORKERS.forEach(w => {
            if (!workersInPool.has(w) && !busyWorkers.has(w)) workerOpts += `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`;
        });
        WORKERS.forEach(w => {
            if (!workersInPool.has(w) && busyWorkers.has(w)) workerOpts += `<option value="${escapeHtml(w)}" disabled>${escapeHtml(w)} (busy elsewhere)</option>`;
        });

        const defaultWorker = workersInPool.size === 1 ? Array.from(workersInPool)[0] : "";

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
                            <tr><th>Sub-Batch</th><th>Worker</th><th>Quantity</th><th>Priority</th><th>Delivery Date</th></tr>
                        </thead>
                        <tbody id="assignTableBody"></tbody>
                    </table>
                </div>
            `);

            const tbody = $("#assignTableBody");
            const defDate = defaultDate();

            for (let i = 0; i < count; i++) {
                const subBatch = peekSubBatchId(poolItem.batchId, poolItem.pieceItem, i);
                tbody.append(`
                    <tr class="assignment-row" data-row-index="${i}">
                        <td><span class="sub-batch-label fw-semibold text-primary">${escapeHtml(subBatch)}</span><input type="hidden" class="sub-batch-input" value="${escapeHtml(subBatch)}"></td>
                        <td><select class="form-select form-select-sm worker-select"><option value="">Select Worker</option>${workerOpts}</select></td>
                        <td><input type="number" class="form-control form-control-sm quantity-input" value="${autoQtys[i]}" min="1" max="${remaining}" data-max="${remaining}"></td>
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

            if (defaultWorker) tbody.find(".worker-select").val(defaultWorker);

            // Manual qty edit → redistribute remaining rows
            tbody.off("input", ".quantity-input").on("input", ".quantity-input", function () {
                const $input = $(this);
                const $row = $input.closest(".assignment-row");
                const rowIdx = Number($row.data("row-index"));

                let manualVal = parseInt($input.val()) || 0;
                if (manualVal < 0) manualVal = 0;
                if (manualVal > remaining) {
                    manualVal = remaining;
                    $input.val(manualVal);
                }

                $input.addClass("manually-edited");

                if (tbody.find(".assignment-row").length > 1) {
                    redistributeQuantities(tbody, remaining, rowIdx, ".assignment-row");
                    $input.val(manualVal).addClass("manually-edited");
                }
            });
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

        let addedNew = 0;
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
            addedNew++;
        });

        saveData();
        renderAvailableTable();
        renderAssignedTable();
        $("#assignModal").modal("hide");
        Swal.fire({ icon: "success", title: "Assigned", text: `${addedNew} assignments created.`, timer: 1800, showConfirmButton: false });
    });

    /* ============================================================
       BULK ASSIGN
       ============================================================ */
    function openBulkModal() {
        bulkSelectedBatchIds = new Set();
        bulkPieceSplits = {};
        renderMultiSelectOptions();
        renderBulkSelectedCards();
        updateBulkSelectedCount();
        $("#bulkAssignModal").modal("show");
    }

    function renderMultiSelectOptions() {
        const container = $("#multiSelectDropdown");
        container.empty();
        const available = pool.filter(p => getPoolRemaining(p) > 0);
        const byBatch = {};
        available.forEach(item => {
            const k = String(item.batchId);
            if (!byBatch[k]) byBatch[k] = [];
            byBatch[k].push(item);
        });

        const batchList = Object.keys(byBatch).map(batchId => {
            const items = byBatch[batchId].slice().sort((a, b) => Number(a.pieceNumber) - Number(b.pieceNumber));
            return { batchId, items, first: items[0] };
        }).sort((a, b) => String(a.batchId).localeCompare(String(b.batchId)));

        if (!batchList.length) {
            container.html(`<div class="p-3 text-center text-muted">No batches available</div>`);
            return;
        }

        batchList.forEach(b => {
            const isSelected = bulkSelectedBatchIds.has(String(b.batchId));
            container.append(`
                <label class="multi-select-option ${isSelected ? 'selected' : ''}">
                    <input type="checkbox" class="multi-select-checkbox" data-batch-id="${escapeHtml(b.batchId)}" ${isSelected ? "checked" : ""}>
                    <div>
                        <div class="fw-semibold">${escapeHtml(b.first.batchId)}</div>
                        <div class="small text-muted">
                            ${escapeHtml(b.first.designNumber || "-")} • 
                            ${escapeHtml(b.first.brand || "-")} • 
                            ${b.items.length} piece(s) • Qty ${b.first.quantity}
                        </div>
                    </div>
                </label>
            `);
        });
    }

    function renderBulkSelectedCards() {
        const container = $("#bulkItemsContainer");
        container.empty();
        if (!bulkSelectedBatchIds.size) {
            container.html(`<div class="text-center text-muted py-5"><i class="bx bx-info-circle fs-2 d-block mb-2"></i>No batch selected yet.</div>`);
            return;
        }

        const available = pool.filter(p => getPoolRemaining(p) > 0);
        const selectedBatches = Array.from(bulkSelectedBatchIds).map(batchId => {
            const items = available.filter(p => String(p.batchId) === String(batchId))
                .sort((a, b) => Number(a.pieceNumber) - Number(b.pieceNumber));
            return { batchId, items };
        }).filter(b => b.items.length > 0);

        selectedBatches.sort((a, b) => String(a.batchId).localeCompare(String(b.batchId)));

        selectedBatches.forEach(batch => {
            const first = batch.items[0];
            const photoSrc = first.photo ? escapeHtml(first.photo) : PLACEHOLDER_IMG;
            const perPieceTotal = getPoolTotal(first);
            const perPieceAssigned = getPoolAssigned(first);
            const perPieceRemaining = getPoolRemaining(first);

            container.append(`
                <div class="bulk-item-card" data-batch-id="${escapeHtml(batch.batchId)}">
                    <div class="bulk-item-header">
                        <img src="${photoSrc}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';">
                        <div class="flex-grow-1">
                            <div class="bulk-item-title">${escapeHtml(batch.batchId)} — Design: ${escapeHtml(first.designNumber || "-")}</div>
                            <div class="bulk-item-sub"><strong>Brand:</strong> ${escapeHtml(first.brand || "-")} • <strong>Color:</strong> ${escapeHtml(first.color || "-")} • <strong>Pieces:</strong> ${batch.items.length} • <strong>Priority:</strong> ${escapeHtml(first.priority || "-")}</div>
                            <div class="bulk-qty-summary">
                                <span class="bulk-qty-pill total"><i class="bx bx-package"></i> Per-Piece Total: ${perPieceTotal}</span>
                                <span class="bulk-qty-pill assigned"><i class="bx bx-check"></i> Per-Piece Assigned: ${perPieceAssigned}</span>
                                <span class="bulk-qty-pill remaining"><i class="bx bx-time"></i> Per-Piece Remaining: ${perPieceRemaining}</span>
                            </div>
                        </div>
                        <div class="text-end">
                            <label class="small text-muted d-block mb-1" style="font-size:11px;">Split each piece into:</label>
                            <div class="input-group input-group-sm" style="width:140px;">
                                <input type="number" class="form-control form-control-sm bulk-global-split" data-batch-id="${escapeHtml(batch.batchId)}" value="1" min="1" max="50">
                                <button type="button" class="btn btn-success bulk-apply-split-btn" data-batch-id="${escapeHtml(batch.batchId)}"><i class="bx bx-check"></i> Split</button>
                            </div>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="split-row-table">
                            <colgroup>
                                <col class="col-sub"><col class="col-piece"><col class="col-worker"><col class="col-qty"><col class="col-priority"><col class="col-date"><col class="col-copy">
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Sub-Batch</th><th>Piece</th><th>Worker</th><th>Qty</th><th>Priority</th><th>Delivery Date</th>
                                    <th class="copy-header-cell">Action</th>
                                </tr>
                            </thead>
                            <tbody class="bulk-rows-tbody" data-batch-id="${escapeHtml(batch.batchId)}"></tbody>
                        </table>
                    </div>
                </div>
            `);

            generateBatchRows(batch);
        });
    }

    function generateBatchRows(batch) {
        const $tbody = $(`.bulk-rows-tbody[data-batch-id="${batch.batchId}"]`);
        $tbody.empty();
        const defDate = defaultDate();

        const maxSplit = Math.max(...batch.items.map(i => Number(bulkPieceSplits[i.id] || 1)), 1);

        for (let s = 0; s < maxSplit; s++) {
            const splitGroupRows = [];

            batch.items.forEach(item => {
                const splitCount = Number(bulkPieceSplits[item.id] || 1);
                if (s >= splitCount) return;
                const totalQty = Number(item.quantity) || 0;
                const autoQtys = splitQuantity(totalQty, splitCount);
                const workerOpts = WORKERS.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("");
                const subBatch = peekSubBatchId(item.batchId, item.pieceItem, s);
                splitGroupRows.push({ item, splitIndex: s, subBatch, autoQty: autoQtys[s] || 0, workerOpts, totalQty });
            });

            if (!splitGroupRows.length) continue;
            const groupSize = splitGroupRows.length;

            splitGroupRows.forEach((row, rIdx) => {
                const item = row.item;
                let copyCellHtml = "";
                if (rIdx === 0) {
                    copyCellHtml = `
                        <td class="copy-col-cell" rowspan="${groupSize}">
                            <div class="copy-body-inner">
                                <button type="button" class="btn copy-row-side-btn bulk-copy-split-group-btn" data-batch-id="${escapeHtml(batch.batchId)}" data-split-index="${row.splitIndex}" title="Copy first row values">
                                    <i class="bx bx-copy"></i>
                                </button>
                            </div>
                        </td>
                    `;
                }

                $tbody.append(`
                    <tr class="bulk-assignment-row"
                        data-pool-id="${item.id}"
                        data-batch-id="${escapeHtml(item.batchId)}"
                        data-split-index="${row.splitIndex}"
                        data-piece-number="${item.pieceNumber}"
                        data-piece-qty="${row.autoQty}"
                        data-piece-total="${row.totalQty}">
                        <td><span class="sub-batch-label fw-semibold text-primary" style="font-size:11px;">${escapeHtml(row.subBatch)}</span><input type="hidden" class="sub-batch-input" value="${escapeHtml(row.subBatch)}"></td>
                        <td><div class="fw-semibold" style="font-size:12px;">Piece ${escapeHtml(item.pieceNumber)}</div><div class="text-muted" style="font-size:11px;">${escapeHtml(item.pieceItem || "-")}</div></td>
                        <td><select class="form-select form-select-sm worker-select" required><option value="">Select Worker</option>${row.workerOpts}</select></td>
                        <td><input type="number" class="form-control form-control-sm quantity-input" value="${row.autoQty}" placeholder="Qty" min="1" max="${row.totalQty}" data-max="${row.totalQty}" style="width:70px;"></td>
                        <td>
                            <select class="form-select form-select-sm priority-select">
                                <option value="Low">Low</option>
                                <option value="Medium" ${item.priority === "Medium" ? "selected" : ""}>Medium</option>
                                <option value="High" ${item.priority === "High" ? "selected" : ""}>High</option>
                            </select>
                        </td>
                        <td><input type="date" class="form-control form-control-sm delivery-date-input" value="${defDate}"></td>
                        ${copyCellHtml}
                    </tr>
                `);
            });
        }

        // Manual qty edit → redistribute remaining rows within same piece group
        $tbody.off("input", ".quantity-input").on("input", ".quantity-input", function () {
            const $input = $(this);
            const $row = $input.closest(".bulk-assignment-row");
            const poolId = Number($row.data("pool-id"));
            const pieceTotal = Number($row.data("piece-total")) || 0;

            let manualVal = parseInt($input.val()) || 0;
            if (manualVal < 0) manualVal = 0;
            if (manualVal > pieceTotal) {
                manualVal = pieceTotal;
                $input.val(manualVal);
            }

            $input.addClass("manually-edited");

            const $samePieceRows = $tbody.find(`.bulk-assignment-row[data-pool-id="${poolId}"]`);
            if ($samePieceRows.length <= 1) return;

            const $otherRows = $samePieceRows.not($row);
            const remainingForOthers = Math.max(0, pieceTotal - manualVal);
            const otherCount = $otherRows.length;

            if (otherCount === 1) {
                $otherRows.find(".quantity-input").val(remainingForOthers);
            } else {
                const base = Math.floor(remainingForOthers / otherCount);
                const rem = remainingForOthers - (base * otherCount);
                $otherRows.each(function (i) {
                    const extra = (i >= (otherCount - rem)) ? 1 : 0;
                    $(this).find(".quantity-input").val(base + extra);
                });
            }
        });
    }

    function updateBulkSelectedCount() {
        $("#selectedCountBadge").text(`${bulkSelectedBatchIds.size} batch(es) selected`);
        const $box = $("#multiSelectBox");
        $box.find(".multi-select-chip, .placeholder").remove();
        if (!bulkSelectedBatchIds.size) {
            $box.prepend(`<span class="placeholder" id="multiSelectPlaceholder">Click to choose batches...</span>`);
            return;
        }
        const wrap = $('<div style="display:flex;flex-wrap:wrap;gap:4px;flex:1;"></div>');
        Array.from(bulkSelectedBatchIds).slice(0, 4).forEach(batchId => {
            wrap.append(`<span class="multi-select-chip">${escapeHtml(batchId)}<span class="chip-x" data-remove-batch="${escapeHtml(batchId)}">×</span></span>`);
        });
        if (bulkSelectedBatchIds.size > 4) wrap.append(`<span class="multi-select-chip">+${bulkSelectedBatchIds.size - 4}</span>`);
        $box.prepend(wrap);
    }

    $("#bulkAssignBtn").on("click", openBulkModal);
    $("#multiSelectBox").on("click", function (e) {
        e.stopPropagation();
        $("#multiSelectDropdown").toggleClass("open");
    });
    $(document).on("click", function () {
        $("#multiSelectDropdown").removeClass("open");
    });
    $("#multiSelectDropdown").on("click", function (e) { e.stopPropagation(); });

    $(document).on("change", ".multi-select-checkbox", function () {
        const batchId = String($(this).data("batch-id"));
        if ($(this).is(":checked")) {
            bulkSelectedBatchIds.add(batchId);
            $(this).closest(".multi-select-option").addClass("selected");
        } else {
            bulkSelectedBatchIds.delete(batchId);
            $(this).closest(".multi-select-option").removeClass("selected");
        }
        updateBulkSelectedCount();
        renderBulkSelectedCards();
    });

    $(document).on("click", ".chip-x", function (e) {
        e.stopPropagation();
        bulkSelectedBatchIds.delete(String($(this).data("remove-batch")));
        updateBulkSelectedCount();
        renderBulkSelectedCards();
        renderMultiSelectOptions();
    });

    $(document).on("click", ".bulk-apply-split-btn", function () {
        const batchId = String($(this).data("batch-id"));
        const count = parseInt($(`.bulk-global-split[data-batch-id="${batchId}"]`).val()) || 1;
        if (count < 1) { $(`.bulk-global-split[data-batch-id="${batchId}"]`).val(1); return; }
        const available = pool.filter(p => getPoolRemaining(p) > 0);
        const batchItems = available.filter(p => String(p.batchId) === String(batchId))
            .sort((a, b) => Number(a.pieceNumber) - Number(b.pieceNumber));
        batchItems.forEach(item => { bulkPieceSplits[item.id] = count; });
        generateBatchRows({ batchId, items: batchItems });
        Swal.fire({ icon: "success", title: "Split Applied", text: `Each piece split into ${count} rows.`, timer: 1200, showConfirmButton: false });
    });

    $(document).on("click", ".bulk-copy-split-group-btn", function () {
        const batchId = String($(this).data("batch-id"));
        const splitIndex = Number($(this).data("split-index"));
        if (!batchId || isNaN(splitIndex)) return;

        const $card = $(`.bulk-item-card[data-batch-id="${batchId}"]`);
        if (!$card.length) return;

        const $groupRows = $card.find(`.bulk-assignment-row[data-split-index="${splitIndex}"]`);
        if (!$groupRows.length) { Swal.fire({ icon: 'info', title: `C${splitIndex + 1} has no rows.` }); return; }
        if ($groupRows.length < 2) { Swal.fire({ icon: 'info', title: `C${splitIndex + 1} only has 1 row.` }); return; }

        const $first = $groupRows.first();
        const worker = $first.find(".worker-select").val();
        const priority = $first.find(".priority-select").val();
        const deliveryDate = $first.find(".delivery-date-input").val();

        if (!worker || !deliveryDate) {
            Swal.fire({ icon: 'warning', title: 'Incomplete', text: `Fill C${splitIndex + 1} first row first.` });
            return;
        }

        $groupRows.each(function (i) {
            if (i === 0) return;
            const $row = $(this);
            $row.find(".worker-select").val(worker);
            $row.find(".priority-select").val(priority);
            $row.find(".delivery-date-input").val(deliveryDate);
        });

        Swal.fire({ icon: "success", title: "Copied", text: `C${splitIndex + 1} values copied.`, timer: 1500, showConfirmButton: false });
    });

    $("#saveBulkAssignBtn").on("click", function () {
        if (!bulkSelectedBatchIds.size) { Swal.fire({ icon: "warning", title: "No Selection" }); return; }

        const assignments = [];
        let valid = true;

        Array.from(bulkSelectedBatchIds).forEach(batchId => {
            const $card = $(`.bulk-item-card[data-batch-id="${batchId}"]`);
            if (!$card.length) return;
            $card.find(".bulk-assignment-row").each(function () {
                const poolId = Number($(this).data("pool-id"));
                const subBatch = $(this).find(".sub-batch-input").val();
                const worker = $(this).find(".worker-select").val();
                const qty = parseInt($(this).find(".quantity-input").val()) || 0;
                const priority = $(this).find(".priority-select").val();
                const date = $(this).find(".delivery-date-input").val();
                if (!worker || qty < 1 || !date) { valid = false; return; }
                assignments.push({ poolId, worker, qty, priority, date, subBatch });
            });
        });

        if (!valid || !assignments.length) { Swal.fire({ icon: "warning", title: "Incomplete form" }); return; }

        let addedCount = 0;
        assignments.forEach(a => {
            const poolItem = pool.find(p => Number(p.id) === a.poolId);
            if (!poolItem) return;
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
                subBatch: a.subBatch,
                worker: a.worker,
                quantity: a.qty,
                priority: a.priority,
                deliveryDate: a.date,
                progress: 0,
                damage: 0,
                passedQty: 0,
                photo: poolItem.photo || "",
                workType: WORK_TYPE
            });
            pushHistory({ workId: newId, batchId: poolItem.batchId, subBatch: a.subBatch, action: `Bulk assigned ${a.qty} pcs to ${a.worker}`, by: "Manager" });
            addedCount++;
        });

        saveData();
        renderAvailableTable();
        renderAssignedTable();
        $("#bulkAssignModal").modal("hide");
        Swal.fire({ icon: "success", title: "Assigned", text: `${addedCount} assignments created.`, timer: 1800, showConfirmButton: false });
    });

    /* ============================================================
       PROGRESS MODAL
       ============================================================ */
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

    function renderProgressHistory(workId) {
        const $list = $("#progressHistoryList");
        if (!$list.length) return;
        $list.empty();

        const history = getHistoryFor(workId);
        if (!history.length) {
            $list.html(`<div class="progress-history-empty">No previous assignment / progress recorded yet.</div>`);
            return;
        }

        history.forEach(h => {
            $list.append(`
                <div class="progress-history-row">
                    <div class="h-at"><i class="bx bx-time-five me-1"></i>${escapeHtml(h.at)}</div>
                    <div class="h-action">${escapeHtml(h.action || "-")}</div>
                    <div class="h-by">${escapeHtml(h.by || "")}</div>
                </div>
            `);
        });
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
        renderProgressHistory(id);
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
            pushHistory({ workId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Auto-passed ${autoPassQty} pcs`, by: "System" });
            saveData();
            renderAssignedTable();
            $("#progressModal").modal("hide");
            Swal.fire({ icon: "success", title: "Auto-Passed", text: `${finalProgress} pcs completed & auto-passed.`, timer: 2200, showConfirmButton: false });
            return;
        }

        saveData();
        renderAssignedTable();
        $("#progressModal").modal("hide");
        Swal.fire({ icon: "success", title: "Updated", timer: 1200, showConfirmButton: false });
    });

    /* ============================================================
       PASS TO NEXT STAGE
       ============================================================ */
    function pushToNextStage(item, qty) {
        const poolData = readStorage(APPROVED_POOL_KEY);
        const idx = poolData.findIndex(p => String(p.batchId) === String(item.batchId) && Number(p.pieceNumber) === Number(item.pieceNumber));
        if (idx === -1) return;
        const entry = poolData[idx];
        const route = entry.route || [];
        const currentStage = entry.currentStage || {};
        const curIdx = route.findIndex(r => r.stage === currentStage.stage && r.type === currentStage.type);
        const nextStage = (curIdx !== -1 && curIdx + 1 < route.length)
            ? route[curIdx + 1]
            : { type: "packing", stage: "Packing" };

        poolData[idx] = {
            ...entry,
            currentStage: nextStage,
            quantity: qty,
            stageHistory: [
                ...(entry.stageHistory || []),
                { at: new Date().toLocaleString("en-GB"), stage: nextStage.stage, type: nextStage.type, action: "entered", fromQty: qty }
            ],
            updatedAt: new Date().toLocaleString("en-GB")
        };
        saveStorage(APPROVED_POOL_KEY, poolData);
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
            html: `<div class="text-start">
                    <p><strong>Sub-Batch:</strong> ${escapeHtml(item.subBatch)}</p>
                    <p><strong>Worker:</strong> ${escapeHtml(item.worker)}</p>
                    <p><strong>Completed:</strong> ${progress}</p>
                    <p><strong>Already Passed:</strong> ${passed}</p>
                    <hr>
                    <p><strong>Pass now:</strong> <span class="text-success fw-bold">${passable}</span></p>
                   </div>`,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#198754",
            confirmButtonText: "Yes, Pass",
            cancelButtonText: "Cancel"
        }).then(r => {
            if (!r.isConfirmed) return;
            pushToNextStage(item, passable);
            item.passedQty = progress;
            pushHistory({ workId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Passed ${passable} pcs`, by: "Manager" });
            saveData();
            renderAssignedTable();
            Swal.fire({ icon: "success", title: "Passed", timer: 1800, showConfirmButton: false });
        });
    });

    /* ============================================================
       STOP ROW
       ============================================================ */
    $(document).on("click", ".stop-row-action-btn", function () {
        const id = Number($(this).data("id"));
        const item = workData.find(d => Number(d.id) === id);
        if (!item) return;
        Swal.fire({
            title: "Stop this Assignment?",
            html: `<div class="text-start"><p><strong>Sub-Batch:</strong> ${escapeHtml(item.subBatch)}</p><p><strong>Worker:</strong> ${escapeHtml(item.worker)}</p><p class="text-danger mb-0">Frozen.</p></div>`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, Stop",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#dc3545"
        }).then(r => {
            if (!r.isConfirmed) return;
            item.stopped = true;
            item.stoppedAt = new Date().toLocaleString("en-GB");
            pushHistory({ workId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: "Stopped", by: "Manager" });
            saveData();
            renderAssignedTable();
            Swal.fire({ icon: "success", title: "Stopped", timer: 1500, showConfirmButton: false });
        });
    });

    /* ============================================================
       VIEW DETAIL (Cutting Manager style — no history in view)
       ============================================================ */
    function buildViewHtml(item) {
        const photoSrc = item.photo ? escapeHtml(item.photo) : PLACEHOLDER_IMG;
        const now = new Date();
        const dateStr = now.toLocaleDateString("en-GB") + ", " + now.toLocaleTimeString("en-GB", { hour12: false });
        const qty = item.quantity || 0;

        return `
            <div class="detail-print-wrap">
                <div class="detail-header-line">
                    <h4>ASSIGNMENT DETAILS</h4>
                    <small>${escapeHtml(dateStr)}</small>
                </div>
                <div class="detail-divider"></div>
                <div class="detail-split-layout">
                    <div>
                        <div class="detail-highlight-grid">
                            <div class="detail-highlight-item"><span class="lbl">Worker Name</span><span class="val">${escapeHtml(item.worker || "-")}</span></div>
                            <div class="detail-highlight-item"><span class="lbl">Design Number</span><span class="val">${escapeHtml(item.designNumber || "-")}</span></div>
                            <div class="detail-highlight-item"><span class="lbl">Brand</span><span class="val">${escapeHtml(item.brand || "-")}</span></div>
                            <div class="detail-highlight-item"><span class="lbl">Total Quantity</span><span class="val">${qty}</span></div>
                        </div>
                        <div class="detail-info-grid">
                            <div class="detail-info-cell"><span class="lbl">Batch ID</span><span class="val">${escapeHtml(item.batchId || "-")}</span></div>
                            <div class="detail-info-cell"><span class="lbl">Sub-Batch</span><span class="val">${escapeHtml(item.subBatch || "-")}</span></div>
                            <div class="detail-info-cell"><span class="lbl">Color</span><span class="val">${escapeHtml(item.color || "-")}</span></div>
                            <div class="detail-info-cell"><span class="lbl">Piece Type</span><span class="val">${escapeHtml(item.pieceType || "-")}</span></div>
                            <div class="detail-info-cell"><span class="lbl">Priority</span><span class="val">${escapeHtml(item.priority || "-")}</span></div>
                            <div class="detail-info-cell"><span class="lbl">Delivery Date</span><span class="val">${escapeHtml(formatDate(item.deliveryDate))}</span></div>
                        </div>
                    </div>
                    <div>
                        <div class="detail-photo-box">
                            <img src="${photoSrc}" alt="Batch Photo" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';">
                        </div>
                    </div>
                </div>
                <div class="detail-signature"><span class="sig-line">Signature .....</span></div>
            </div>
        `;
    }

    $(document).on("click", ".view-row-action-btn", function () {
        const id = Number($(this).data("id"));
        const item = workData.find(d => Number(d.id) === id);
        if (!item) return;
        $("#viewDetailBody").html(buildViewHtml(item));
        $("#viewDetailModal").modal("show");
    });

    $("#printDetailBtn").on("click", function () { window.print(); });

    /* ============================================================
       LIST ALL MODAL
       ============================================================ */
    function buildListAllHtml() {
        const passedData = workData.filter(d => isFullyPassed(d));
        if (!passedData.length) {
            return `<div class="text-center text-muted py-5"><i class="bx bx-info-circle fs-2 d-block mb-2"></i>No fully passed assignments yet.</div>`;
        }

        const byBatch = {};
        passedData.forEach(item => {
            const k = String(item.batchId);
            if (!byBatch[k]) byBatch[k] = [];
            byBatch[k].push(item);
        });

        const batchIds = Object.keys(byBatch).sort();
        let tableRows = "";
        let serial = 0;

        batchIds.forEach(batchId => {
            const items = byBatch[batchId].sort((a, b) => Number(a.pieceNumber) - Number(b.pieceNumber));
            serial++;
            items.forEach((item, idx) => {
                const isFirst = idx === 0;
                const pc = getPriorityClass(item.priority);
                const deliveryCls = getDeliveryClass(item.deliveryDate);
                const remaining = (item.quantity || 0) - (item.progress || 0);
                tableRows += `
                    <tr>
                        <td>${isFirst ? serial : ""}</td>
                        <td>${isFirst ? `<strong>${escapeHtml(batchId)}</strong>` : ""}</td>
                        <td><span class="fw-semibold text-primary">${escapeHtml(item.subBatch || "-")}</span></td>
                        <td>${escapeHtml(item.brand || "-")}</td>
                        <td>${escapeHtml(item.pieceType || "-")}</td>
                        <td>${escapeHtml(item.worker || "-")}</td>
                        <td>${item.quantity}</td>
                        <td>${item.progress || 0}</td>
                        <td>${item.damage || 0}</td>
                        <td>${remaining}</td>
                        <td><span class="priority-badge ${pc}">${escapeHtml(item.priority || "-")}</span></td>
                        <td><span class="badge ${deliveryCls} delivery-date-badge">${formatDate(item.deliveryDate)}</span></td>
                        <td><span class="status-badge passed">Passed</span></td>
                        <td><button class="btn btn-sm view-row-btn batch-history-btn" data-batch-id="${escapeHtml(batchId)}" title="View Batch History"><i class="bx bx-show"></i></button></td>
                    </tr>
                `;
            });
        });

        return `
            <div style="margin-bottom:12px;padding:8px 12px;background:#d1fae5;border-left:3px solid #198754;border-radius:4px;font-size:12px;color:#065f46;">
                <strong>${batchIds.length}</strong> batch(es), <strong>${passedData.length}</strong> assignment(s).
            </div>
            <div class="table-responsive">
                <table class="table table-bordered text-nowrap w-100" style="font-size:13px;">
                    <thead>
                        <tr>
                            <th>#</th><th>Batch ID</th><th>Sub-Batch</th><th>Brand</th>
                            <th>Piece</th><th>Worker</th><th>Qty</th><th>Progress</th>
                            <th>Damage</th><th>Remaining</th><th>Priority</th><th>Delivery</th>
                            <th>Status</th><th>Action</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;
    }

    $("#listAllBtn").on("click", function () {
        $("#listAllBody").html(buildListAllHtml());
        $("#listAllModal").modal("show");
    });

    /* ============================================================
       NESTED BATCH HISTORY
       ============================================================ */
    function buildBatchHistoryHtml(batchId) {
        const history = readStorage(WORK_HISTORY_KEY);
        const batchRows = workData.filter(d => String(d.batchId) === String(batchId));
        if (!batchRows.length) return `<div class="text-center text-muted py-5">No assignments found for batch ${escapeHtml(batchId)}.</div>`;

        const subBatchMap = {};
        batchRows.forEach(r => {
            const key = String(r.subBatch || "");
            if (!subBatchMap[key]) subBatchMap[key] = [];
            subBatchMap[key].push(r);
        });

        const subBatchKeys = Object.keys(subBatchMap).sort();
        const now = new Date();
        const dateStr = now.toLocaleDateString("en-GB") + ", " + now.toLocaleTimeString("en-GB", { hour12: false });
        const first = batchRows[0];

        let html = `
            <div style="border-bottom: 2px solid #161617; padding-bottom: 12px; margin-bottom: 18px;">
                <h4 style="margin: 0; font-weight: 700; color: #161617; letter-spacing: 0.5px;">BATCH HISTORY</h4>
                <small style="color: #6b7280; display: block; margin-top: 4px;">Batch ID: <strong>${escapeHtml(batchId)}</strong> • Design: <strong>${escapeHtml(first.designNumber || "-")}</strong> • Brand: <strong>${escapeHtml(first.brand || "-")}</strong></small>
                <small style="color: #9ca3af; display: block; margin-top: 2px;">Generated: ${escapeHtml(dateStr)}</small>
            </div>
        `;

        subBatchKeys.forEach((subBatch, idx) => {
            const items = subBatchMap[subBatch];
            const firstItem = items[0];
            const worker = firstItem.worker || "-";
            const qty = firstItem.quantity || 0;
            const progress = firstItem.progress || 0;
            const passedQty = firstItem.passedQty || 0;
            const damage = firstItem.damage || 0;
            const effectiveTotal = Math.max(0, qty - damage);
            const remaining = Math.max(0, effectiveTotal - progress);

            const itemIds = items.map(i => i.id);
            const allEvents = history.filter(h => itemIds.includes(Number(h.workId)))
                .sort((a, b) => String(a.at).localeCompare(String(b.at)));

            let eventsHtml = "";
            if (allEvents.length) {
                allEvents.forEach(h => {
                    eventsHtml += `<tr><td style="white-space:nowrap;">${escapeHtml(h.at)}</td><td>${escapeHtml(h.action || "")}</td><td>${escapeHtml(h.by || "-")}</td></tr>`;
                });
            } else {
                eventsHtml = `<tr><td colspan="3" class="text-center text-muted">No history events</td></tr>`;
            }

            html += `
                <div style="border: 1px solid #e2e7f1; border-radius: 8px; margin-bottom: 16px; overflow: hidden;">
                    <div style="background: #f8f9fa; padding: 10px 14px; border-bottom: 1px solid #e2e7f1;">
                        <div style="font-size: 13px; font-weight: 700; color: #161617;">${idx + 1}. ${escapeHtml(subBatch)} — ${escapeHtml(worker)}</div>
                        <div style="font-size: 11px; color: #6b7280; margin-top: 3px;">
                            <strong>Piece:</strong> ${escapeHtml(firstItem.pieceType || "-")} •
                            <strong>Qty:</strong> ${qty} • <strong>Progress:</strong> ${progress} •
                            <strong>Damage:</strong> ${damage} • <strong>Passed:</strong> ${passedQty} •
                            <strong>Remaining:</strong> ${remaining}
                        </div>
                    </div>
                    <table style="width:100%; border-collapse:collapse; font-size:12px;">
                        <thead><tr style="background: #fafbfd;"><th style="padding:8px 12px; text-align:left; font-weight:600; color:#4b5563; font-size:11px; text-transform:uppercase; border-bottom:1px solid #e2e7f1;">Date & Time</th><th style="padding:8px 12px; text-align:left; font-weight:600; color:#4b5563; font-size:11px; text-transform:uppercase; border-bottom:1px solid #e2e7f1;">Action</th><th style="padding:8px 12px; text-align:left; font-weight:600; color:#4b5563; font-size:11px; text-transform:uppercase; border-bottom:1px solid #e2e7f1;">By</th></tr></thead>
                        <tbody>${eventsHtml}</tbody>
                    </table>
                </div>
            `;
        });

        return html;
    }

    $(document).on("click", ".batch-history-btn", function () {
        const batchId = String($(this).data("batch-id"));
        if (!batchId) return;
        $("#batchHistoryBody").html(buildBatchHistoryHtml(batchId));
        $("#batchHistoryModal").modal("show");
    });

    $("#printBatchHistoryBtn").on("click", function () { window.print(); });
    $("#printListAllBtn").on("click", function () { window.print(); });

    /* ============================================================
       REFRESH
       ============================================================ */
    $("#refreshHandworkBtn").on("click", function () {
        loadData();
        renderAvailableTable();
        renderAssignedTable();
        Swal.fire({ icon: "success", title: "Refreshed", timer: 1000, showConfirmButton: false });
    });

    /* ============================================================
       INIT
       ============================================================ */
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
        const prevData = JSON.stringify(workData);
        loadData();
        if (JSON.stringify(pool) !== prevPool || JSON.stringify(workData) !== prevData) {
            renderAvailableTable();
            renderAssignedTable();
        }
    }, 2000);
});