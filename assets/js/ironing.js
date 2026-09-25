$(document).ready(function () {
    "use strict";

    const APPROVED_POOL_KEY = "approvedPool";
    const IRONING_DATA_KEY = "ironingData";
    const IRONING_NEXT_ID_KEY = "ironingNextId";
    const IRONING_HISTORY_KEY = "ironingHistory";

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

    let approvedPool = [];
    let ironingData = [];
    let nextId = 1;
    let currentEditingId = null;
    let currentViewingId = null;

    let availablePage = 1;
    let ironingPage = 1;

    /* ================= HELPERS ================= */
    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    function readStorage(key) {
        try {
            const value = localStorage.getItem(key);
            if (!value) return [];
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }
    function saveStorage(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; }
        catch (e) { return false; }
    }
    function loadData() {
        // 🆕 Only pieces with currentStage.type === "ironing"
        approvedPool = readStorage(APPROVED_POOL_KEY).filter(p =>
            p.currentStage && p.currentStage.type === "ironing"
        );
        ironingData = readStorage(IRONING_DATA_KEY);
        nextId = Number(localStorage.getItem(IRONING_NEXT_ID_KEY)) || 1;
    }
    function saveData() {
        saveStorage(IRONING_DATA_KEY, ironingData);
        localStorage.setItem(IRONING_NEXT_ID_KEY, String(nextId));
    }

    /* ============================================================
       HISTORY
       ============================================================ */
    function pushHistory(entry) {
        try {
            const history = readStorage(IRONING_HISTORY_KEY);
            history.push({
                id: Date.now() + Math.floor(Math.random() * 1000),
                at: new Date().toLocaleString("en-GB"),
                ...entry
            });
            saveStorage(IRONING_HISTORY_KEY, history);
        } catch (e) {}
    }

    function getHistoryForAssignment(ironId) {
        return readStorage(IRONING_HISTORY_KEY)
            .filter(h => Number(h.ironId) === Number(ironId))
            .sort((a, b) => String(a.at).localeCompare(String(b.at)));
    }

    function sanitizePieceName(name) {
        return String(name || "").trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Piece";
    }

    function peekNextSubBatchId(batchId, pieceName, splitIndex) {
        let formatted = String(batchId || "");
        if (!formatted.includes("BATCH-")) formatted = `BATCH-${String(batchId).padStart(3, "0")}`;
        const safePiece = sanitizePieceName(pieceName);
        const iNumber = Number(splitIndex || 0) + 1;
        return `${formatted}-${safePiece}-IR${iNumber}`;
    }

    function formatDateDisplay(dateString) {
        if (!dateString) return 'Not Set';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return 'Not Set';
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    function getDeliveryStatusClass(deliveryDate) {
        if (!deliveryDate) return 'delivery-badge-secondary';
        const today = new Date(); today.setHours(0,0,0,0);
        const d = new Date(deliveryDate); d.setHours(0,0,0,0);
        const diff = Math.ceil((d - today) / (1000*60*60*24));
        if (diff < 0) return 'delivery-overdue';
        if (diff === 0) return 'delivery-due-today';
        return 'delivery-ontrack';
    }

    function defaultDeliveryDate() {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d.toISOString().split('T')[0];
    }

    function splitQuantity(totalQty, splitCount) {
        const total = Number(totalQty) || 0;
        const n = Math.max(1, Number(splitCount) || 1);
        if (n === 1) return [total];
        const base = Math.floor(total / n);
        const remainder = total - (base * n);
        const result = [];
        for (let i = 0; i < n; i++) {
            const extra = (i >= (n - remainder)) ? 1 : 0;
            result.push(base + extra);
        }
        return result;
    }

    function getPriorityClass(priority) {
        const p = String(priority || "").trim().toLowerCase();
        if (p === "high") return "priority-high";
        if (p === "medium") return "priority-medium";
        if (p === "low") return "priority-low";
        return "";
    }

    function computeIroningStatus(item) {
        if (item.stopped) return "stopped";
        const qty = item.quantity || 0, damage = item.damage || 0;
        const progress = item.progress || 0, passedQty = item.passedQty || 0;
        const effectiveTotal = Math.max(0, qty - damage);
        if (progress === 0) return "pending";
        if (effectiveTotal > 0 && progress >= effectiveTotal && passedQty >= progress) return "passed";
        return "in_progress";
    }

    function isFullyPassed(item) {
        const qty = item.quantity || 0, damage = item.damage || 0;
        const progress = item.progress || 0, passedQty = item.passedQty || 0;
        const effectiveTotal = Math.max(0, qty - damage);
        return effectiveTotal > 0 && progress >= effectiveTotal && passedQty >= progress;
    }

    function isUntouched(item) {
        return (item.progress || 0) === 0 && (item.damage || 0) === 0 && (item.passedQty || 0) === 0;
    }

    function buildPager($container, currentPage, totalPages, totalItems, pageSize, onPageChange, label) {
        $container.empty();
        if (totalItems === 0) return;
        const startItem = (currentPage - 1) * pageSize + 1;
        const endItem = Math.min(currentPage * pageSize, totalItems);
        $container.append(`<div class="info-text">Showing <strong>${startItem}-${endItem}</strong> of <strong>${totalItems}</strong> ${label}</div>`);
        const $pager = $('<div class="pager"></div>');
        const $prev = $(`<button class="page-btn" ${currentPage === 1 ? "disabled" : ""}><i class="bx bx-chevron-left"></i></button>`);
        $prev.on("click", () => currentPage > 1 && onPageChange(currentPage - 1));
        $pager.append($prev);
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
        for (let p = startPage; p <= endPage; p++) {
            const $btn = $(`<button class="page-btn ${p === currentPage ? "active" : ""}">${p}</button>`);
            $btn.on("click", () => onPageChange(p));
            $pager.append($btn);
        }
        const $next = $(`<button class="page-btn" ${currentPage === totalPages ? "disabled" : ""}><i class="bx bx-chevron-right"></i></button>`);
        $next.on("click", () => currentPage < totalPages && onPageChange(currentPage + 1));
        $pager.append($next);
        $container.append($pager);
    }

    function getBusyWorkersExcluding(poolId) {
        const busy = new Set();
        ironingData.forEach(row => {
            if (Number(row.poolId) !== Number(poolId)) {
                if (!isFullyPassed(row) && !row.stopped) busy.add(row.worker);
            }
        });
        return busy;
    }

    function getPoolTotal(item) { return Number(item.quantity) || 0; }
    function getPoolAssigned(item) {
        return ironingData
            .filter(d => Number(d.poolId) === Number(item.id))
            .reduce((s, d) => s + (Number(d.quantity) || 0), 0);
    }
    function getPoolRemaining(item) {
        return Math.max(0, getPoolTotal(item) - getPoolAssigned(item));
    }

    /* ================= TABLE 1: AVAILABLE ================= */
    function renderAvailableTable() {
        const tbody = $("#availableList");
        tbody.empty();
        const available = approvedPool.filter(p => getPoolRemaining(p) > 0);

        if (!available.length) {
            tbody.html(`<tr><td colspan="11" class="text-center text-muted py-4"><i class="bx bx-info-circle me-1"></i> No approved items available for ironing.</td></tr>`);
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
            const key = String(item.batchId);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });

        Object.keys(grouped).forEach(batchId => {
            const items = grouped[batchId].slice().sort((a, b) => Number(a.pieceNumber) - Number(b.pieceNumber));
            const first = items[0];
            const rowspan = items.length;
            const photoSrc = first.photo ? escapeHtml(first.photo) : PLACEHOLDER_IMG;
            const priorityClass = getPriorityClass(first.priority);

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
                const pieceLine = `<div class="piece-line"><span class="piece-num">${escapeHtml(it.pieceNumber)} Piece</span></div>`;
                const itemLine = `<div class="piece-line">${escapeHtml(it.pieceItem || "-")}</div>`;
                const qtyHtml = `<span class="qty-pair"><span class="qty-total">${total}</span><span class="qty-sep">/</span><span class="qty-assigned ${assigned === 0 ? "zero" : ""}">${assigned}</span></span>`;
                const priorityHtml = `<span class="priority-badge ${priorityClass}">${escapeHtml(it.priority || "-")}</span>`;

                let statusHtml = "";
                if (assigned === 0) statusHtml = `<span class="status-badge not_assigned">Not Assigned</span>`;
                else if (remaining > 0) statusHtml = `<span class="status-badge assign_progress">Assign In Progress</span>`;

                const actionHtml = remaining > 0
                    ? `<button class="btn btn-sm btn-primary assign-single-btn" data-pool-id="${it.id}"><i class="bx bx-plus"></i> Assign</button>`
                    : "";

                tbody.append(`
                    <tr>
                        ${idx === 0 ? batchCols : ""}
                        <td>${pieceLine}</td>
                        <td>${itemLine}</td>
                        <td>${qtyHtml}</td>
                        <td>${priorityHtml}</td>
                        <td>${statusHtml}</td>
                        <td>${actionHtml}</td>
                    </tr>
                `);
            });
        });

        buildPager($("#availablePagination"), availablePage, totalPages, totalItems, ROWS_PER_PAGE,
            (p) => { availablePage = p; renderAvailableTable(); }, "items");
    }

    /* ================= TABLE 2: IRONING ASSIGNMENTS ================= */
    function renderIroningTable() {
        const tbody = $("#ironingList");
        tbody.empty();
        const visibleRows = ironingData.filter(item => !isFullyPassed(item));

        if (!visibleRows.length) {
            tbody.html(`<tr><td colspan="14" class="text-center text-muted py-4"><i class="bx bx-info-circle me-1"></i> No ironing assignments yet.</td></tr>`);
            $("#ironingPagination").empty();
            return;
        }

        const totalItems = visibleRows.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / ROWS_PER_PAGE));
        if (ironingPage > totalPages) ironingPage = totalPages;
        const startIdx = (ironingPage - 1) * ROWS_PER_PAGE;
        const pageItems = visibleRows.slice(startIdx, startIdx + ROWS_PER_PAGE);

        const grouped = {};
        pageItems.forEach(item => {
            const key = String(item.batchId);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });

        let serial = startIdx;
        Object.keys(grouped).forEach(batchId => {
            const items = grouped[batchId];
            const firstOfBatch = (startIdx === 0 || visibleRows[startIdx - 1]?.batchId !== batchId);
            if (firstOfBatch) serial++;

            items.forEach((item, idx) => {
                const qty = item.quantity || 0;
                const damage = item.damage || 0;
                const progress = item.progress || 0;
                const passedQty = item.passedQty || 0;
                const effectiveTotal = Math.max(0, qty - damage);
                const remaining = Math.max(0, effectiveTotal - progress);
                const progressPct = effectiveTotal > 0 ? Math.min(100, Math.round((progress / effectiveTotal) * 100)) : 0;
                const priorityClass = getPriorityClass(item.priority);

                let deliveryHtml = `<span class="text-muted">Not Set</span>`;
                if (item.deliveryDate) {
                    const cls = getDeliveryStatusClass(item.deliveryDate);
                    deliveryHtml = `<span class="badge ${cls} delivery-date-badge">${formatDateDisplay(item.deliveryDate)}</span>`;
                }

                const statusKey = computeIroningStatus(item);
                let statusHtml = "";
                if (statusKey === "stopped") statusHtml = `<span class="status-badge stopped">Stopped</span>`;
                else if (statusKey === "pending") statusHtml = `<span class="status-badge pending">Pending</span>`;
                else if (statusKey === "passed") statusHtml = `<span class="status-badge passed">Passed</span>`;
                else statusHtml = `<span class="status-badge in_progress">In Progress</span>`;

                const isFirst = idx === 0;
                const damageHtml = damage > 0 ? `<span class="damage-badge">${damage}</span>` : `<span class="damage-empty">-</span>`;
                const qtyHtml = `<span class="qty-pair"><span class="qty-total">${qty}</span><span class="qty-sep">/</span><span class="qty-assigned ${progress === 0 ? "zero" : ""}">${progress}</span></span>`;

                const isStopped = !!item.stopped;
                const canPass = !isStopped && progress > passedQty;

                const editBtnHtml = `<button class="btn btn-sm btn-primary progress-btn" data-id="${item.id}" title="Edit / Update Progress" ${isStopped ? "disabled" : ""}><i class="bx bx-edit"></i></button>`;
                const passBtnHtml = progress > 0
                    ? `<button class="btn btn-sm pass-row-btn pass-row-action-btn" data-id="${item.id}" title="Pass to Packing" ${canPass ? "" : "disabled"}><i class="bx bx-right-arrow-alt"></i></button>`
                    : "";
                const stopBtnHtml = isUntouched(item)
                    ? `<button class="btn btn-sm stop-row-btn stop-row-action-btn" data-id="${item.id}" title="Stop"><i class="bx bx-stop"></i></button>`
                    : "";
                const viewBtnHtml = `<button class="btn btn-sm view-row-btn view-row-action-btn" data-id="${item.id}" title="View"><i class="bx bx-show"></i></button>`;

                tbody.append(`
                    <tr>
                        <td>${isFirst ? serial : ""}</td>
                        <td>${isFirst ? escapeHtml(item.batchId) : ""}</td>
                        <td><span class="fw-semibold text-primary">${escapeHtml(item.subBatch || "-")}</span></td>
                        <td>${escapeHtml(item.brand || "-")}</td>
                        <td>${escapeHtml(item.pieceType || "-")}</td>
                        <td>${escapeHtml(item.worker || "-")}</td>
                        <td>${qtyHtml}</td>
                        <td><div class="d-flex align-items-center gap-2"><span>${progress}</span><div class="progress-bar-container"><div class="progress-bar-fill" style="width:${progressPct}%;"></div></div></div></td>
                        <td>${damageHtml}</td>
                        <td>${remaining}</td>
                        <td><span class="priority-badge ${priorityClass}">${escapeHtml(item.priority || "-")}</span></td>
                        <td>${deliveryHtml}</td>
                        <td>${statusHtml}</td>
                        <td>
                            <div class="d-flex gap-1">
                                ${editBtnHtml}
                                ${passBtnHtml}
                                ${stopBtnHtml}
                                ${viewBtnHtml}
                            </div>
                        </td>
                    </tr>
                `);
            });
        });

        buildPager($("#ironingPagination"), ironingPage, totalPages, totalItems, ROWS_PER_PAGE,
            (p) => { ironingPage = p; renderIroningTable(); }, "assignments");
    }

    /* ================= ASSIGN MODAL ================= */
    function populateBatchSelect() {
        const select = $("#batchSelect");
        select.empty();
        select.append('<option value="">Choose Batch</option>');
        const available = approvedPool.filter(p => getPoolRemaining(p) > 0);
        if (!available.length) {
            select.append('<option value="" disabled>No approved items available</option>');
            return;
        }
        available.forEach(item => {
            const remaining = getPoolRemaining(item);
            select.append(`<option value="${item.id}">${escapeHtml(item.batchId)} - ${escapeHtml(item.brand)} - Piece ${item.pieceNumber} (${escapeHtml(item.pieceItem)}) - Remaining ${remaining}/${item.quantity}</option>`);
        });
    }

    function generateTableRows(poolItem, remaining) {
        const container = $("#rowsContainer");
        container.empty();
        const total = getPoolTotal(poolItem);
        const assigned = getPoolAssigned(poolItem);
        const designNumber = poolItem.designNumber || "-";

        const workersInPool = new Set();
        ironingData.forEach(row => {
            if (Number(row.poolId) === Number(poolItem.id) && row.worker) workersInPool.add(row.worker);
        });

        const busyWorkers = getBusyWorkersExcluding(poolItem.id);

        let workerOpts = "";
        WORKERS.forEach(w => {
            if (workersInPool.has(w)) workerOpts += `<option value="${escapeHtml(w)}" data-in-pool="1">${escapeHtml(w)} (continuing)</option>`;
        });
        WORKERS.forEach(w => {
            if (!workersInPool.has(w) && !busyWorkers.has(w)) workerOpts += `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`;
        });
        WORKERS.forEach(w => {
            if (!workersInPool.has(w) && busyWorkers.has(w)) workerOpts += `<option value="${escapeHtml(w)}" disabled>${escapeHtml(w)} (busy)</option>`;
        });

        const defaultWorker = workersInPool.size === 1 ? Array.from(workersInPool)[0] : "";

        container.append(`
            <div class="alert alert-primary mb-3">
                <div class="row align-items-center">
                    <div class="col-md-7">
                        <i class="bx bx-layer me-2"></i>
                        <strong>${escapeHtml(poolItem.batchId)}</strong> — Piece ${poolItem.pieceNumber} (${escapeHtml(poolItem.pieceItem)})
                        <div class="small text-muted mt-1">
                            <strong>Design:</strong> ${escapeHtml(designNumber)} •
                            <strong>Total:</strong> ${total} •
                            <strong>Assigned:</strong> <span class="text-success">${assigned}</span> •
                            <strong>Remaining:</strong> <span class="text-warning">${remaining}</span>
                        </div>
                    </div>
                    <div class="col-md-5">
                        <label class="form-label mb-0">Split Count (Rows)</label>
                        <div class="input-group">
                            <input type="number" class="form-control" id="splitCount" value="1" min="1" max="20">
                            <button class="btn btn-success" id="applySplitBtn" type="button"><i class="bx bx-check"></i> Apply Split</button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        function renderRows(count) {
            container.find('.table-responsive').remove();
            if (count < 1) count = 1;
            const autoQtys = splitQuantity(remaining, count);

            container.append(`
                <div class="table-responsive">
                    <table class="table table-bordered table-sm mb-0">
                        <thead>
                            <tr>
                                <th style="width:18%;">Sub-Batch ID</th>
                                <th style="width:22%;">Worker Name</th>
                                <th style="width:12%;">Quantity</th>
                                <th style="width:14%;">Priority</th>
                                <th style="width:34%;">Delivery Date</th>
                            </tr>
                        </thead>
                        <tbody id="assignmentTableBody"></tbody>
                    </table>
                </div>
            `);

            const tbody = $("#assignmentTableBody");
            const defaultDateStr = defaultDeliveryDate();

            for (let i = 0; i < count; i++) {
                const subBatch = peekNextSubBatchId(poolItem.batchId, poolItem.pieceItem, i);
                const autoQty = autoQtys[i];
                tbody.append(`
                    <tr class="assignment-row">
                        <td><span class="sub-batch-label fw-semibold text-primary">${escapeHtml(subBatch)}</span><input type="hidden" class="sub-batch-input" value="${escapeHtml(subBatch)}"></td>
                        <td><select class="form-select form-select-sm worker-select" required><option value="">Select Worker</option>${workerOpts}</select></td>
                        <td><input type="number" class="form-control form-control-sm quantity-input" value="${autoQty}" min="1" max="${remaining}"></td>
                        <td>
                            <select class="form-select form-select-sm priority-select">
                                <option value="Low">Low</option>
                                <option value="Medium" selected>Medium</option>
                                <option value="High">High</option>
                            </select>
                        </td>
                        <td><input type="date" class="form-control form-control-sm delivery-date-input" value="${defaultDateStr}"></td>
                    </tr>
                `);
            }

            if (defaultWorker) tbody.find(".worker-select").val(defaultWorker);
        }

        renderRows(1);
        $("#applySplitBtn").click(function () {
            const c = parseInt($("#splitCount").val()) || 1;
            renderRows(c);
        });
    }

    $(document).on("click", ".assign-single-btn", function () {
        const poolId = Number($(this).data("pool-id"));
        const item = approvedPool.find(p => Number(p.id) === poolId);
        if (!item) return;
        const remaining = getPoolRemaining(item);
        if (remaining <= 0) { Swal.fire({ icon: 'info', title: 'Fully Assigned' }); return; }
        populateBatchSelect();
        $("#batchSelect").val(item.id).trigger("change");
        $("#assignModal").modal("show");
    });

    $("#batchSelect").change(function () {
        const poolId = Number($(this).val());
        if (!poolId) { $("#rowsContainer").empty(); return; }
        const item = approvedPool.find(p => Number(p.id) === poolId);
        if (!item) return;
        const remaining = getPoolRemaining(item);
        generateTableRows(item, remaining);
    });

    $("#saveAssignBtn").click(function () {
        const poolId = Number($("#batchSelect").val());
        if (!poolId) { Swal.fire({ icon: 'warning', title: 'Select Batch' }); return; }
        const poolItem = approvedPool.find(p => Number(p.id) === poolId);
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

        if (!valid) { Swal.fire({ icon: 'warning', title: 'Incomplete', text: 'Fill all fields.' }); return; }
        if (!rows.length) { Swal.fire({ icon: 'warning', title: 'No Rows' }); return; }

        const totalAssigned = rows.reduce((s, r) => s + r.quantity, 0);
        const remaining = getPoolRemaining(poolItem);
        if (totalAssigned > remaining) { Swal.fire({ icon: 'warning', title: 'Over Quantity' }); return; }

        let addedNew = 0, mergedExisting = 0;

        rows.forEach(row => {
            const existingIdx = ironingData.findIndex(d =>
                Number(d.poolId) === Number(poolItem.id) && d.worker === row.worker
            );

            if (existingIdx !== -1) {
                ironingData[existingIdx].quantity += row.quantity;
                mergedExisting++;
                pushHistory({
                    ironId: ironingData[existingIdx].id,
                    batchId: poolItem.batchId,
                    subBatch: ironingData[existingIdx].subBatch,
                    action: `Additional ${row.quantity} pcs to ${row.worker}`,
                    by: "Manager"
                });
            } else {
                const newId = nextId++;
                ironingData.push({
                    id: newId,
                    poolId: poolItem.id,
                    batchId: poolItem.batchId,
                    brand: poolItem.brand,
                    designNumber: poolItem.designNumber,
                    color: poolItem.color,
                    pieceType: `Piece ${poolItem.pieceNumber} (${poolItem.pieceItem})`,
                    pieceNumber: poolItem.pieceNumber,
                    worker: row.worker,
                    quantity: row.quantity,
                    priority: row.priority,
                    subBatch: row.subBatch,
                    progress: 0,
                    damage: 0,
                    passedQty: 0,
                    deliveryDate: row.deliveryDate,
                    approvedItems: poolItem.availableItems || [],
                    photo: poolItem.photo || ""
                });
                pushHistory({
                    ironId: newId,
                    batchId: poolItem.batchId,
                    subBatch: row.subBatch,
                    action: `Assigned ${row.quantity} pcs to ${row.worker}`,
                    by: "Manager"
                });
                addedNew++;
            }
        });

        saveData();
        renderAvailableTable();
        renderIroningTable();
        $("#assignModal").modal("hide");

        let msg = "";
        if (addedNew > 0 && mergedExisting > 0) msg = `${addedNew} new + ${mergedExisting} merged.`;
        else if (mergedExisting > 0) msg = `${mergedExisting} merged.`;
        else msg = `${addedNew} assigned.`;
        Swal.fire({ icon: "success", title: "Assigned Successfully", text: msg, timer: 2200, showConfirmButton: false });
    });

    /* ================= UPDATE PROGRESS ================= */
    function refreshProgressNumbers(item) {
        const progress = item.progress || 0, damage = item.damage || 0;
        const passed = item.passedQty || 0, qty = item.quantity || 0;
        const eff = Math.max(0, qty - damage);
        const remaining = Math.max(0, eff - progress);
        $("#progressTotal").val(qty);
        $("#progressPassed").val(passed);
        $("#progressRemaining").val(remaining);
        $("#progressMax").text(remaining);
        $("#progressLivePreview").html(`
            <div class="d-flex justify-content-between">
                <span><strong>Effective Total:</strong> ${eff}</span>
                <span><strong>Progress:</strong> ${progress}</span>
                <span><strong>Passed:</strong> ${passed}</span>
                <span><strong>Remaining:</strong> ${remaining}</span>
            </div>
        `);
    }

    $(document).on("click", ".progress-btn", function () {
        if ($(this).prop("disabled")) return;
        const id = Number($(this).data("id"));
        const item = ironingData.find(d => Number(d.id) === id);
        if (!item) return;
        if (isFullyPassed(item)) { Swal.fire({ icon: 'info', title: 'Fully Passed' }); return; }

        currentEditingId = id;
        $("#progressSubBatch").val(item.subBatch);
        $("#progressWorker").val(item.worker);
        $("#progressTypeSelect").val("completed");
        $("#progressQty").val(0);
        refreshProgressNumbers(item);
        $("#progressModal").modal("show");
    });

    $(document).on("input change", "#progressQty, #progressTypeSelect", function () {
        const item = ironingData.find(d => Number(d.id) === currentEditingId);
        if (!item) return;
        const type = $("#progressTypeSelect").val();
        const addQty = parseInt($("#progressQty").val()) || 0;
        const progress = item.progress || 0, damage = item.damage || 0;
        const passed = item.passedQty || 0, qty = item.quantity || 0;
        const previewProgress = type === "completed" ? progress + addQty : progress;
        const previewDamage = type === "damage" ? damage + addQty : damage;
        const eff = Math.max(0, qty - previewDamage);
        const remaining = Math.max(0, eff - previewProgress);
        $("#progressLivePreview").html(`
            <div class="d-flex justify-content-between">
                <span><strong>Effective Total:</strong> ${eff}</span>
                <span><strong>Progress:</strong> ${previewProgress}</span>
                <span><strong>Passed:</strong> ${passed}</span>
                <span><strong>Remaining:</strong> ${remaining}</span>
            </div>
        `);
    });

    $("#updateProgressBtn").click(function () {
        const item = ironingData.find(d => Number(d.id) === currentEditingId);
        if (!item) return;
        const type = $("#progressTypeSelect").val();
        const addQty = parseInt($("#progressQty").val()) || 0;
        const qty = item.quantity || 0;
        const existingProgress = item.progress || 0;
        const existingDamage = item.damage || 0;
        const eff = Math.max(0, qty - existingDamage);
        const remainingBefore = Math.max(0, eff - existingProgress);

        if (addQty < 0) { Swal.fire({ icon: 'warning', title: 'Invalid' }); return; }
        if (addQty > remainingBefore) { Swal.fire({ icon: 'warning', title: 'Too Much', text: `Max ${remainingBefore}` }); return; }

        if (type === "completed") {
            item.progress = existingProgress + addQty;
            pushHistory({ ironId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Progress +${addQty} (total ${item.progress})`, by: "Manager" });
        } else {
            item.damage = existingDamage + addQty;
            pushHistory({ ironId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Damage +${addQty} (total ${item.damage})`, by: "Manager" });
        }

        const finalEff = Math.max(0, item.quantity - (item.damage || 0));
        const finalProgress = item.progress || 0;
        const finalPassed = item.passedQty || 0;

        if (finalEff > 0 && finalProgress >= finalEff && finalPassed < finalProgress) {
            const autoPassQty = finalProgress - finalPassed;
            pushRowToPacking(item, autoPassQty);
            item.passedQty = finalProgress;
            pushHistory({ ironId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Auto-passed ${autoPassQty} pcs to Packing`, by: "System" });
            saveData();
            renderIroningTable();
            $("#progressModal").modal("hide");
            Swal.fire({ icon: 'success', title: 'Auto-Passed to Packing', text: `${finalProgress} pcs completed & auto-passed.`, timer: 2200, showConfirmButton: false });
            return;
        }

        saveData();
        renderIroningTable();
        $("#progressModal").modal("hide");
        Swal.fire({ icon: 'success', title: 'Updated', timer: 1200, showConfirmButton: false });
    });

    /* ================= PASS TO PACKING ================= */
    function pushRowToPacking(item, qty) {
        // Ironing is usually the last stage. Push to packing_pool.
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

        // Also update approvedPool to packing stage (for consistency)
        const pool = readStorage(APPROVED_POOL_KEY);
        const idx = pool.findIndex(p => String(p.batchId) === String(item.batchId) && Number(p.pieceNumber) === Number(item.pieceNumber));
        if (idx !== -1) {
            pool[idx] = {
                ...pool[idx],
                currentStage: { type: "packing", stage: "Packing" },
                quantity: qty,
                stageHistory: [
                    ...(pool[idx].stageHistory || []),
                    { at: new Date().toLocaleString("en-GB"), stage: "Packing", type: "packing", action: "entered", fromQty: qty }
                ],
                updatedAt: new Date().toLocaleString("en-GB")
            };
            saveStorage(APPROVED_POOL_KEY, pool);
        }
    }

    $(document).on("click", ".pass-row-action-btn", function () {
        if ($(this).prop("disabled")) return;
        const id = Number($(this).data("id"));
        const item = ironingData.find(d => Number(d.id) === id);
        if (!item) return;
        if (isFullyPassed(item)) { Swal.fire({ icon: 'info', title: 'Already Passed' }); return; }

        const progress = item.progress || 0;
        const passedQty = item.passedQty || 0;
        const passableQty = progress - passedQty;
        if (passableQty <= 0) { Swal.fire({ icon: 'info', title: 'Nothing to Pass' }); return; }

        Swal.fire({
            title: 'Pass to Packing?',
            html: `<div class="text-start">
                    <p><strong>Sub-Batch:</strong> ${escapeHtml(item.subBatch)}</p>
                    <p><strong>Worker:</strong> ${escapeHtml(item.worker)}</p>
                    <p><strong>Completed:</strong> ${progress} pcs</p>
                    <p><strong>Already Passed:</strong> ${passedQty} pcs</p>
                    <hr>
                    <p><strong>Pass now:</strong> <span class="text-success fw-bold">${passableQty} pcs</span></p>
                   </div>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#198754',
            confirmButtonText: 'Yes, Pass to Packing',
            cancelButtonText: 'Cancel'
        }).then((r) => {
            if (!r.isConfirmed) return;
            pushRowToPacking(item, passableQty);
            item.passedQty = progress;
            pushHistory({ ironId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Passed ${passableQty} pcs to Packing`, by: "Manager" });
            saveData();
            renderIroningTable();
            Swal.fire({ icon: 'success', title: 'Passed to Packing', text: `${passableQty} pcs passed.`, timer: 1800, showConfirmButton: false });
        });
    });

    /* ================= STOP ROW ================= */
    $(document).on("click", ".stop-row-action-btn", function () {
        const id = Number($(this).data("id"));
        const item = ironingData.find(d => Number(d.id) === id);
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
            const idx = ironingData.findIndex(d => Number(d.id) === id);
            if (idx === -1) return;
            ironingData[idx].stopped = true;
            ironingData[idx].stoppedAt = new Date().toLocaleString("en-GB");
            pushHistory({ ironId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: "Stopped / Frozen", by: "Manager" });
            saveData();
            renderIroningTable();
            Swal.fire({ icon: "success", title: "Stopped", timer: 1800, showConfirmButton: false });
        });
    });

    /* ================= VIEW ================= */
    $(document).on("click", ".view-row-action-btn", function () {
        const id = Number($(this).data("id"));
        const item = ironingData.find(d => Number(d.id) === id);
        if (!item) return;

        const photoSrc = item.photo ? escapeHtml(item.photo) : PLACEHOLDER_IMG;
        const history = getHistoryForAssignment(id);
        const historyHtml = history.length
            ? history.map(h => `<div style="font-size:12px; padding:4px 0; border-bottom:1px dashed #eef1f7;">• <strong>${escapeHtml(h.at)}</strong> — ${escapeHtml(h.action || "")}</div>`).join("")
            : `<div class="text-muted small">No history yet.</div>`;

        $("#viewDetailBody").html(`
            <div style="padding:20px;">
                <h4 style="text-align:center;font-weight:700;color:#161617;">IRONING DETAILS</h4>
                <hr>
                <div style="display:grid;grid-template-columns:1fr 220px;gap:20px;">
                    <div>
                        <table class="table table-bordered mb-3">
                            <tr><th style="width:35%;">Batch ID</th><td>${escapeHtml(item.batchId)}</td></tr>
                            <tr><th>Sub-Batch</th><td>${escapeHtml(item.subBatch)}</td></tr>
                            <tr><th>Worker</th><td>${escapeHtml(item.worker || "-")}</td></tr>
                            <tr><th>Brand</th><td>${escapeHtml(item.brand || "-")}</td></tr>
                            <tr><th>Design</th><td>${escapeHtml(item.designNumber || "-")}</td></tr>
                            <tr><th>Color</th><td>${escapeHtml(item.color || "-")}</td></tr>
                            <tr><th>Piece Type</th><td>${escapeHtml(item.pieceType || "-")}</td></tr>
                            <tr><th>Quantity</th><td>${item.quantity}</td></tr>
                            <tr><th>Progress</th><td>${item.progress || 0}</td></tr>
                            <tr><th>Damage</th><td>${item.damage || 0}</td></tr>
                            <tr><th>Passed</th><td>${item.passedQty || 0}</td></tr>
                            <tr><th>Priority</th><td>${escapeHtml(item.priority || "-")}</td></tr>
                            <tr><th>Delivery</th><td>${escapeHtml(formatDateDisplay(item.deliveryDate))}</td></tr>
                        </table>
                        <h6 style="color:#161617;font-weight:700;">History</h6>
                        <div style="max-height:200px;overflow-y:auto;background:#fafbfd;padding:10px;border-radius:6px;">${historyHtml}</div>
                    </div>
                    <div><img src="${photoSrc}" style="width:100%;border-radius:8px;border:1px solid #dfe5f1;" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';"></div>
                </div>
            </div>
        `);
        const modal = new bootstrap.Modal(document.getElementById("viewDetailModal"));
        modal.show();
    });

    /* ================= REFRESH ================= */
    $("#refreshIroningBtn").click(function () {
        loadData();
        renderAvailableTable();
        renderIroningTable();
        Swal.fire({ icon: "success", title: "Refreshed", timer: 1000, showConfirmButton: false });
    });

    /* ================= INIT ================= */
    loadData();
    renderAvailableTable();
    renderIroningTable();

    window.addEventListener("focus", function () {
        loadData();
        renderAvailableTable();
        renderIroningTable();
    });

    setInterval(function () {
        const prevPool = JSON.stringify(approvedPool);
        const prevData = JSON.stringify(ironingData);
        loadData();
        if (JSON.stringify(approvedPool) !== prevPool || JSON.stringify(ironingData) !== prevData) {
            renderAvailableTable();
            renderIroningTable();
        }
    }, 2000);
});