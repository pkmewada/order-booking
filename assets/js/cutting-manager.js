$(document).ready(function () {
    "use strict";

    const APPROVED_POOL_KEY = "approvedPool";
    const CUTTING_DATA_KEY = "cuttingData";
    const CUTTING_NEXT_ID_KEY = "cuttingNextId";
    const REPAIR_STORAGE_KEY = "repairData";
    const CUTTING_HISTORY_KEY = "cuttingHistory";

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
    let cuttingData = [];
    let nextId = 1;
    let currentEditingId = null;
    let currentViewingId = null;

    let approvedPage = 1;
    let cuttingPage = 1;

    let bulkSelectedBatchIds = new Set();
    let bulkPieceSplits = {};

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
        approvedPool = readStorage(APPROVED_POOL_KEY).filter(p =>
            p.currentStage && p.currentStage.type === "cutting"
        );
        cuttingData = readStorage(CUTTING_DATA_KEY);
        nextId = Number(localStorage.getItem(CUTTING_NEXT_ID_KEY)) || 1;
    }
    function saveData() {
        saveStorage(CUTTING_DATA_KEY, cuttingData);
        localStorage.setItem(CUTTING_NEXT_ID_KEY, String(nextId));
    }

    /* ============================================================
       HISTORY LOG
       ============================================================ */
    function pushHistory(entry) {
        try {
            const history = readStorage(CUTTING_HISTORY_KEY);
            history.push({
                id: Date.now() + Math.floor(Math.random() * 1000),
                at: new Date().toLocaleString("en-GB"),
                ...entry
            });
            saveStorage(CUTTING_HISTORY_KEY, history);
        } catch (e) { /* silent */ }
    }

    function parseHistoryTime(str) {
        const m = String(str).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})/);
        if (!m) return 0;
        const [, d, mo, y, h, mi, se] = m;
        return new Date(
            `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:${se}`
        ).getTime();
    }

    function getHistoryForAssignment(cuttingId) {
        return readStorage(CUTTING_HISTORY_KEY)
            .filter(h => Number(h.cuttingId) === Number(cuttingId))
            .sort((a, b) => parseHistoryTime(a.at) - parseHistoryTime(b.at));
    }

    function sanitizePieceName(name) {
        return String(name || "")
            .trim()
            .replace(/[^A-Za-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            || "Piece";
    }

    function peekNextSubBatchId(batchId, pieceName, splitIndex) {
        let formatted = String(batchId || "");
        if (!formatted.includes("BATCH-")) {
            formatted = `BATCH-${String(batchId).padStart(3, "0")}`;
        }
        const safePiece = sanitizePieceName(pieceName);
        const cNumber = Number(splitIndex || 0) + 1;
        return `${formatted}-${safePiece}-C${cNumber}`;
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
        d.setDate(d.getDate() + 17);
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

    function computeCuttingStatus(item) {
        if (item.stopped) return "stopped";
        const qty = item.quantity || 0;
        const damage = item.damage || 0;
        const progress = item.progress || 0;
        const passedQty = item.passedQty || 0;
        const effectiveTotal = Math.max(0, qty - damage);
        if (progress === 0) return "pending";
        if (effectiveTotal > 0 && progress >= effectiveTotal && passedQty >= progress) return "passed";
        return "in_progress";
    }

    function isFullyPassed(item) {
        const qty = item.quantity || 0;
        const damage = item.damage || 0;
        const progress = item.progress || 0;
        const passedQty = item.passedQty || 0;
        const effectiveTotal = Math.max(0, qty - damage);
        return effectiveTotal > 0 && progress >= effectiveTotal && passedQty >= progress;
    }

    function isUntouched(item) {
        return (item.progress || 0) === 0 &&
               (item.damage || 0) === 0 &&
               (item.passedQty || 0) === 0;
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
        cuttingData.forEach(row => {
            if (Number(row.poolId) !== Number(poolId)) {
                if (!isFullyPassed(row) && !row.stopped) busy.add(row.worker);
            }
        });
        return busy;
    }
    function getWorkersInPool(poolId) {
        const workers = new Set();
        cuttingData.forEach(row => {
            if (Number(row.poolId) === Number(poolId) && row.worker) workers.add(row.worker);
        });
        return workers;
    }

    function getPoolTotal(item) { return Number(item.quantity) || 0; }
    function getPoolAssigned(item) {
        return cuttingData
            .filter(d => Number(d.poolId) === Number(item.id))
            .reduce((s, d) => s + (Number(d.quantity) || 0), 0);
    }
    function getPoolRemaining(item) {
        return Math.max(0, getPoolTotal(item) - getPoolAssigned(item));
    }

    /* ============================================================
       MANUAL SPLIT — auto-distribute remaining qty
       ============================================================ */
    function redistributeQuantities($tbody, totalRemaining, changedRowIdx) {
        const $rows = $tbody.find(".assignment-row, .bulk-assignment-row");
        if (!$rows.length) return;

        const rowCount = $rows.length;
        if (rowCount === 1) {
            $rows.eq(0).find(".quantity-input").val(totalRemaining);
            return;
        }

        const manualVal = parseInt($rows.eq(changedRowIdx).find(".quantity-input").val()) || 0;

        // Remaining to distribute among the other rows
        const remainingForOthers = Math.max(0, totalRemaining - manualVal);
        const otherRowsCount = rowCount - 1;

        if (otherRowsCount === 1) {
            $rows.each(function (i) {
                if (i === changedRowIdx) return;
                $(this).find(".quantity-input").val(remainingForOthers);
            });
            return;
        }

        // Distribute evenly among other rows (last gets remainder)
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

    /* ================= TABLE 1: APPROVED POOL ================= */
    function renderApprovedTable() {
        const tbody = $("#approvedItemsList");
        tbody.empty();
        const available = approvedPool.filter(p => getPoolRemaining(p) > 0);

        if (!available.length) {
            tbody.html(`<tr><td colspan="11" class="text-center text-muted py-4"><i class="bx bx-info-circle me-1"></i> No approved items available.</td></tr>`);
            $("#approvedPagination").empty();
            return;
        }

        available.sort((a, b) => {
            if (String(a.batchId) !== String(b.batchId)) return String(a.batchId).localeCompare(String(b.batchId));
            return Number(a.pieceNumber) - Number(b.pieceNumber);
        });

        const totalItems = available.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / ROWS_PER_PAGE));
        if (approvedPage > totalPages) approvedPage = totalPages;
        const startIdx = (approvedPage - 1) * ROWS_PER_PAGE;
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
            const photo = first.photo || "";
            const photoSrc = photo ? escapeHtml(photo) : PLACEHOLDER_IMG;
            const priorityClass = getPriorityClass(first.priority);

            const batchCols = `
                <td rowspan="${rowspan}"><strong>${escapeHtml(first.batchId || "-")}</strong></td>
                <td rowspan="${rowspan}"><img src="${photoSrc}" alt="Batch" style="width:55px;height:55px;object-fit:cover;border-radius:6px;" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';"></td>
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
                const qtyHtml = `
                    <span class="qty-pair">
                        <span class="qty-total">${total}</span>
                        <span class="qty-sep">/</span>
                        <span class="qty-assigned ${assigned === 0 ? "zero" : ""}">${assigned}</span>
                    </span>
                `;
                const priorityHtml = `<span class="priority-badge ${priorityClass}">${escapeHtml(it.priority || "-")}</span>`;
                let statusHtml = "";
                if (assigned === 0) statusHtml = `<span class="status-badge not_assigned">Not Assigned</span>`;
                else if (remaining > 0) statusHtml = `<span class="status-badge assign_progress">Assign In Progress</span>`;

                const actionHtml = remaining > 0
                    ? `<button class="btn btn-sm btn-primary assign-single-btn" data-pool-id="${it.id}" title="Assign Piece ${escapeHtml(it.pieceNumber)}"><i class="bx bx-plus"></i> Assign</button>`
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

        buildPager($("#approvedPagination"), approvedPage, totalPages, totalItems, ROWS_PER_PAGE,
            (p) => { approvedPage = p; renderApprovedTable(); }, "items");
    }

    /* ================= TABLE 2: CUTTING ASSIGNMENTS ================= */
    function renderCuttingTable() {
        const tbody = $("#cuttingMastersList");
        tbody.empty();
        const visibleRows = cuttingData.filter(item => !isFullyPassed(item));

        if (!visibleRows.length) {
            tbody.html(`<tr><td colspan="14" class="text-center text-muted py-4"><i class="bx bx-info-circle me-1"></i> No cutting assignments yet.</td></tr>`);
            $("#cuttingPagination").empty();
            return;
        }

        const totalItems = visibleRows.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / ROWS_PER_PAGE));
        if (cuttingPage > totalPages) cuttingPage = totalPages;
        const startIdx = (cuttingPage - 1) * ROWS_PER_PAGE;
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

                const statusKey = computeCuttingStatus(item);
                let statusHtml = "";
                if (statusKey === "stopped") statusHtml = `<span class="status-badge stopped">Stopped</span>`;
                else if (statusKey === "pending") statusHtml = `<span class="status-badge pending">Pending</span>`;
                else if (statusKey === "passed") statusHtml = `<span class="status-badge passed">Passed</span>`;
                else statusHtml = `<span class="status-badge in_progress">In Progress</span>`;

                const isFirst = idx === 0;
                const damageHtml = damage > 0 ? `<span class="damage-badge">${damage}</span>` : `<span class="damage-empty">-</span>`;
                const qtyHtml = `
                    <span class="qty-pair">
                        <span class="qty-total">${qty}</span>
                        <span class="qty-sep">/</span>
                        <span class="qty-assigned ${progress === 0 ? "zero" : ""}">${progress}</span>
                    </span>
                `;

                const isStopped = !!item.stopped;
                const canPass = !isStopped && progress > passedQty;
                const editBtnHtml = `<button class="btn btn-sm btn-primary progress-btn" data-id="${item.id}" title="Edit / Update Progress" ${isStopped ? "disabled" : ""}><i class="bx bx-edit"></i></button>`;
                const passBtnHtml = progress > 0
                    ? `<button class="btn btn-sm pass-row-btn pass-row-action-btn" data-id="${item.id}" title="Pass to Next Stage" ${canPass ? "" : "disabled"}><i class="bx bx-right-arrow-alt"></i></button>`
                    : "";
                const stopBtnHtml = isUntouched(item)
                    ? `<button class="btn btn-sm stop-row-btn stop-row-action-btn" data-id="${item.id}" title="Stop (freeze)"><i class="bx bx-stop"></i></button>`
                    : "";
                const viewBtnHtml = `<button class="btn btn-sm view-row-btn view-row-action-btn" data-id="${item.id}" title="View Details"><i class="bx bx-show"></i></button>`;

                tbody.append(`
                    <tr>
                        <td>${isFirst ? serial : ""}</td>
                        <td>${isFirst ? escapeHtml(item.batchId) : ""}</td>
                        <td><span class="fw-semibold text-primary">${escapeHtml(item.subBatch || "-")}</span></td>
                        <td>${escapeHtml(item.brand || "-")}</td>
                        <td>${escapeHtml(item.pieceType || "-")}</td>
                        <td>${escapeHtml(item.worker || "-")}</td>
                        <td>${qtyHtml}</td>
                        <td>
                            <div class="d-flex align-items-center gap-2">
                                <span>${progress}</span>
                                <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${progressPct}%;"></div></div>
                            </div>
                        </td>
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

        buildPager($("#cuttingPagination"), cuttingPage, totalPages, totalItems, ROWS_PER_PAGE,
            (p) => { cuttingPage = p; renderCuttingTable(); }, "assignments");
    }

    /* ============================================================
       VIEW DETAIL MODAL
       ============================================================ */
    function buildDetailHtml(item) {
        const photo = item.photo || "";
        const photoSrc = photo ? escapeHtml(photo) : PLACEHOLDER_IMG;
        const qty = item.quantity || 0;
        const now = new Date();
        const dateStr = now.toLocaleDateString("en-GB") + ", " + now.toLocaleTimeString("en-GB", { hour12: false });

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
                            <div class="detail-info-cell"><span class="lbl">Delivery Date</span><span class="val">${escapeHtml(formatDateDisplay(item.deliveryDate))}</span></div>
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
        const item = cuttingData.find(d => Number(d.id) === id);
        if (!item) return;
        currentViewingId = id;
        $("#viewDetailBody").html(buildDetailHtml(item));
        const modal = new bootstrap.Modal(document.getElementById("viewDetailModal"));
        modal.show();
    });

    $("#printDetailBtn").on("click", function () { window.print(); });

    /* ============================================================
       LIST DETAIL MODAL
       ============================================================ */
    function buildListDetailHtml(batchId) {
        const allRows = cuttingData.filter(d => String(d.batchId) === String(batchId));
        const fullyPassed = allRows.length > 0 && allRows.every(r => isFullyPassed(r));
        if (!fullyPassed) {
            return `<div class="text-center text-muted py-5"><i class="bx bx-lock-alt fs-2 d-block mb-3" style="color:#dc3545;"></i><h6 style="color:#dc3545;font-weight:700;">Batch Not Fully Passed</h6><p class="mb-0">Kuch pieces abhi bhi pending / in-progress hain.</p></div>`;
        }

        const rows = allRows.slice().sort((a, b) => {
            const pa = Number(a.pieceNumber) || 0, pb = Number(b.pieceNumber) || 0;
            if (pa !== pb) return pa - pb;
            return String(a.subBatch || "").localeCompare(String(b.subBatch || ""));
        });

        const first = rows[0] || {};
        const photo = first.photo || "";
        const photoSrc = photo ? escapeHtml(photo) : PLACEHOLDER_IMG;
        const now = new Date();
        const dateStr = now.toLocaleDateString("en-GB") + ", " + now.toLocaleTimeString("en-GB", { hour12: false });

        let totalQty = 0, totalProgress = 0, totalPassed = 0, totalDamage = 0;
        rows.forEach(r => {
            totalQty += Number(r.quantity) || 0;
            totalProgress += Number(r.progress) || 0;
            totalPassed += Number(r.passedQty) || 0;
            totalDamage += Number(r.damage) || 0;
        });

        let tableRows = "";
        rows.forEach((r, i) => {
            const qty = r.quantity || 0, progress = r.progress || 0;
            const passedQty = r.passedQty || 0, damage = r.damage || 0;
            const effectiveTotal = Math.max(0, qty - damage);
            const remaining = Math.max(0, effectiveTotal - progress);
            const history = getHistoryForAssignment(r.id);
            const historyText = history.length
                ? history.map(h => `<div>• <strong>${escapeHtml(h.at)}</strong> — ${escapeHtml(h.action || "")}</div>`).join("")
                : `<span class="text-muted">No history</span>`;

            tableRows += `
                <tr>
                    <td>${i + 1}</td>
                    <td>${escapeHtml(r.subBatch || "-")}</td>
                    <td>Piece ${escapeHtml(r.pieceNumber || "-")}</td>
                    <td>${escapeHtml(r.worker || "-")}</td>
                    <td>${qty}</td>
                    <td>${progress}</td>
                    <td>${damage > 0 ? damage : "-"}</td>
                    <td>${passedQty}</td>
                    <td>${remaining}</td>
                    <td><button class="btn btn-sm view-row-btn view-row-action-btn" data-id="${r.id}"><i class="bx bx-show"></i></button></td>
                </tr>
                <tr>
                    <td colspan="10" style="padding:0;border:none;">
                        <div class="history-block"><strong>History:</strong> ${historyText}</div>
                    </td>
                </tr>
            `;
        });

        return `
            <div class="detail-print-wrap">
                <div class="detail-header-line"><h4>BATCH ASSIGNMENT LIST</h4><small>${escapeHtml(dateStr)}</small></div>
                <div class="detail-divider"></div>
                <div class="detail-split-layout">
                    <div>
                        <div class="detail-highlight-grid">
                            <div class="detail-highlight-item"><span class="lbl">Batch ID</span><span class="val">${escapeHtml(first.batchId || batchId)}</span></div>
                            <div class="detail-highlight-item"><span class="lbl">Design Number</span><span class="val">${escapeHtml(first.designNumber || "-")}</span></div>
                            <div class="detail-highlight-item"><span class="lbl">Brand</span><span class="val">${escapeHtml(first.brand || "-")}</span></div>
                            <div class="detail-highlight-item"><span class="lbl">Total Assignments</span><span class="val">${rows.length}</span></div>
                        </div>
                        <div class="detail-info-grid">
                            <div class="detail-info-cell"><span class="lbl">Total Qty</span><span class="val">${totalQty}</span></div>
                            <div class="detail-info-cell"><span class="lbl">Total Progress</span><span class="val">${totalProgress}</span></div>
                            <div class="detail-info-cell"><span class="lbl">Total Passed</span><span class="val">${totalPassed}</span></div>
                            <div class="detail-info-cell"><span class="lbl">Total Damage</span><span class="val">${totalDamage}</span></div>
                            <div class="detail-info-cell"><span class="lbl">Color</span><span class="val">${escapeHtml(first.color || "-")}</span></div>
                            <div class="detail-info-cell"><span class="lbl">Priority</span><span class="val">${escapeHtml(first.priority || "-")}</span></div>
                        </div>
                    </div>
                    <div><div class="detail-photo-box"><img src="${photoSrc}" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';"></div></div>
                </div>
                <h6 class="mt-4 mb-2" style="color:#161617;font-weight:700;">All Assignments — Full History</h6>
                <div class="table-responsive">
                    <table class="list-detail-table">
                        <thead><tr><th>#</th><th>Sub-Batch</th><th>Piece</th><th>Worker</th><th>Qty</th><th>Progress</th><th>Damage</th><th>Passed</th><th>Remaining</th><th>View</th></tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
                <div class="detail-signature"><span class="sig-line">Signature .....</span></div>
            </div>
        `;
    }

    $(document).on("click", ".bulk-list-btn", function () {
        const batchId = String($(this).data("batch-id"));
        if (!batchId) return;
        $("#listDetailBody").html(buildListDetailHtml(batchId));
        const modal = new bootstrap.Modal(document.getElementById("listDetailModal"));
        modal.show();
    });

    $("#printListDetailBtn").on("click", function () { window.print(); });

    /* ============================================================
       LIST ALL MODAL — only ONE view button per row
       ============================================================ */
    function buildListAllHtml() {
        const byBatch = {};
        cuttingData.forEach(row => {
            const key = String(row.batchId);
            if (!byBatch[key]) byBatch[key] = [];
            byBatch[key].push(row);
        });

        const passedBatchIds = Object.keys(byBatch).filter(batchId => {
            const rows = byBatch[batchId];
            return rows.length > 0 && rows.every(r => isFullyPassed(r));
        });

        if (!passedBatchIds.length) {
            return `<div class="text-center text-muted py-5"><i class="bx bx-info-circle fs-2 d-block mb-2"></i><h6 style="color:#6b7280;font-weight:700;">No Fully Passed Batches Yet</h6></div>`;
        }

        const passedRows = [];
        passedBatchIds.forEach(batchId => {
            byBatch[batchId].forEach(r => passedRows.push(r));
        });

        passedRows.sort((a, b) => {
            const ba = String(a.batchId || ""), bb = String(b.batchId || "");
            if (ba !== bb) return ba.localeCompare(bb);
            const pa = Number(a.pieceNumber) || 0, pb = Number(b.pieceNumber) || 0;
            if (pa !== pb) return pa - pb;
            return String(a.subBatch || "").localeCompare(String(b.subBatch || ""));
        });

        let serial = 0, lastBatchId = null, tableRows = "";
        passedRows.forEach((item) => {
            const batchId = String(item.batchId || "");
            const isFirstOfBatch = batchId !== lastBatchId;
            if (isFirstOfBatch) serial++;
            lastBatchId = batchId;

            const qty = item.quantity || 0, damage = item.damage || 0;
            const progress = item.progress || 0;
            const effectiveTotal = Math.max(0, qty - damage);
            const remaining = Math.max(0, effectiveTotal - progress);
            const progressPct = effectiveTotal > 0 ? Math.min(100, Math.round((progress / effectiveTotal) * 100)) : 0;
            const priorityClass = getPriorityClass(item.priority);

            let deliveryHtml = `<span class="text-muted">Not Set</span>`;
            if (item.deliveryDate) {
                const cls = getDeliveryStatusClass(item.deliveryDate);
                deliveryHtml = `<span class="badge ${cls} delivery-date-badge">${formatDateDisplay(item.deliveryDate)}</span>`;
            }

            const damageHtml = damage > 0 ? `<span class="damage-badge">${damage}</span>` : `<span class="damage-empty">-</span>`;
            const qtyHtml = `<span class="qty-pair"><span class="qty-total">${qty}</span><span class="qty-sep">/</span><span class="qty-assigned ${progress === 0 ? "zero" : ""}">${progress}</span></span>`;

            tableRows += `
                <tr>
                    <td>${isFirstOfBatch ? serial : ""}</td>
                    <td>${isFirstOfBatch ? escapeHtml(batchId) : ""}</td>
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
                    <td><span class="status-badge passed">Passed</span></td>
                    <td><button class="btn btn-sm view-row-btn batch-history-btn" data-batch-id="${escapeHtml(batchId)}" title="View Batch History"><i class="bx bx-show"></i></button></td>
                </tr>
            `;
        });

        return `
            <div style="margin-bottom:12px;padding:8px 12px;background:#d1fae5;border-left:3px solid #198754;border-radius:4px;font-size:12px;color:#065f46;">
                <strong>${passedBatchIds.length}</strong> fully-passed batch(es) found.
            </div>
            <div class="table-responsive" style="width:100%;">
                <table class="table table-bordered text-nowrap w-100" style="font-size:13px; width:100%;">
                    <thead><tr><th>#</th><th>Batch ID</th><th>Sub-Batch</th><th>Brand</th><th>Piece Type</th><th>Worker</th><th>Quantity</th><th>Progress</th><th>Damage</th><th>Remaining</th><th>Priority</th><th>Delivery Date</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;
    }

    $("#listAllBtn").on("click", function () {
        $("#listAllBody").html(buildListAllHtml());
        const modal = new bootstrap.Modal(document.getElementById("listAllModal"));
        modal.show();
    });

    $("#printListAllBtn").on("click", function () { window.print(); });

    /* ============================================================
       BATCH HISTORY MODAL
       ============================================================ */
    function buildBatchHistoryHtml(batchId) {
        const history = readStorage(CUTTING_HISTORY_KEY);
        const batchRows = cuttingData.filter(d => String(d.batchId) === String(batchId));
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
            const allEvents = history.filter(h => itemIds.includes(Number(h.cuttingId)))
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
        const modal = new bootstrap.Modal(document.getElementById("batchHistoryModal"));
        modal.show();
    });

    $("#printBatchHistoryBtn").on("click", function () { window.print(); });

    /* ================= SINGLE ASSIGN MODAL ================= */
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
        const baseRows = 1;
        const total = getPoolTotal(poolItem);
        const assigned = getPoolAssigned(poolItem);
        const designNumber = poolItem.designNumber || "-";

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
                            <input type="number" class="form-control" id="splitCount" value="${baseRows}" min="1" max="20">
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
                        <thead><tr><th style="width:18%;">Sub-Batch ID</th><th style="width:20%;">Worker Name</th><th style="width:12%;">Quantity</th><th style="width:14%;">Brand</th><th style="width:14%;">Priority</th><th style="width:22%;">Delivery Date</th></tr></thead>
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
                    <tr class="assignment-row" data-row-index="${i}">
                        <td><span class="sub-batch-label fw-semibold text-primary">${escapeHtml(subBatch)}</span><input type="hidden" class="sub-batch-input" value="${escapeHtml(subBatch)}"></td>
                        <td><select class="form-select form-select-sm worker-select" required><option value="">Select Worker</option>${workerOpts}</select></td>
                        <td><input type="number" class="form-control form-control-sm quantity-input" value="${autoQty}" placeholder="Qty" min="1" max="${remaining}" data-max="${remaining}"></td>
                        <td><span style="font-size:12px;color:#4b5563;font-weight:500;">${escapeHtml(poolItem.brand || "-")}</span></td>
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

            // ✅ Manual qty edit → redistribute remaining rows
            tbody.off("input", ".quantity-input").on("input", ".quantity-input", function () {
                const $input = $(this);
                const $row = $input.closest(".assignment-row");
                const rowIdx = Number($row.data("row-index"));

                // Clamp manual value to total remaining
                let manualVal = parseInt($input.val()) || 0;
                if (manualVal < 0) manualVal = 0;
                if (manualVal > remaining) {
                    manualVal = remaining;
                    $input.val(manualVal);
                }

                // Mark as manually edited
                $input.addClass("manually-edited");

                // If there's only one row → nothing to redistribute
                if (tbody.find(".assignment-row").length > 1) {
                    redistributeQuantities(tbody, remaining, rowIdx);
                    // Keep the manually edited value intact & re-mark
                    $input.val(manualVal).addClass("manually-edited");
                }
            });

            // Remove manual-edited flag when user clears and re-splits
            $("#applySplitBtn").off("click").on("click", function () {
                const c = parseInt($("#splitCount").val()) || 1;
                renderRows(c);
            });
        }

        renderRows(baseRows);
        $("#applySplitBtn").off("click").on("click", function () {
            const c = parseInt($("#splitCount").val()) || 1;
            renderRows(c);
        });
    }

    $(document).on("click", ".assign-single-btn", function () {
        const poolId = Number($(this).data("pool-id"));
        const item = approvedPool.find(p => Number(p.id) === poolId);
        if (!item) return;
        const remaining = getPoolRemaining(item);
        if (remaining <= 0) {
            Swal.fire({ icon: 'info', title: 'Fully Assigned' });
            return;
        }
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
            const existingIdx = cuttingData.findIndex(d =>
                Number(d.poolId) === Number(poolItem.id) && d.worker === row.worker
            );

            if (existingIdx !== -1) {
                cuttingData[existingIdx].quantity += row.quantity;
                mergedExisting++;
                pushHistory({
                    cuttingId: cuttingData[existingIdx].id,
                    batchId: poolItem.batchId,
                    subBatch: cuttingData[existingIdx].subBatch,
                    action: `Additional ${row.quantity} pcs assigned to ${row.worker}`,
                    by: "Manager"
                });
            } else {
                const newId = nextId++;
                cuttingData.push({
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
                    cuttingId: newId,
                    batchId: poolItem.batchId,
                    subBatch: row.subBatch,
                    action: `Assigned ${row.quantity} pcs to ${row.worker}`,
                    by: "Manager"
                });
                addedNew++;
            }
        });

        saveData();
        renderApprovedTable();
        renderCuttingTable();
        $("#assignModal").modal("hide");

        let msg = "";
        if (addedNew > 0 && mergedExisting > 0) msg = `${addedNew} new + ${mergedExisting} merged.`;
        else if (mergedExisting > 0) msg = `${mergedExisting} merged.`;
        else msg = `${addedNew} assigned.`;

        Swal.fire({ icon: "success", title: "Assigned Successfully", text: msg, timer: 2200, showConfirmButton: false });
    });

    /* ================= UPDATE PROGRESS MODAL ================= */
    function refreshProgressModalNumbers(item) {
        const progress = item.progress || 0, damage = item.damage || 0;
        const passedQty = item.passedQty || 0, qty = item.quantity || 0;
        const effectiveTotal = Math.max(0, qty - damage);
        const remaining = Math.max(0, effectiveTotal - progress);
        $("#progressTotal").val(qty);
        $("#progressPassed").val(passedQty);
        $("#progressRemaining").val(remaining);
        $("#progressMax").text(remaining);
        $("#progressLivePreview").html(`
            <div class="d-flex justify-content-between">
                <span><strong>Effective Total:</strong> ${effectiveTotal}</span>
                <span><strong>Progress:</strong> ${progress}</span>
                <span><strong>Passed:</strong> ${passedQty}</span>
                <span><strong>Remaining:</strong> ${remaining}</span>
            </div>
        `);
    }

    /* ✅ NEW: Render assignment history into the modal */
    function renderProgressHistory(cuttingId) {
        const $list = $("#progressHistoryList");
        if (!$list.length) return;
        $list.empty();

        const history = getHistoryForAssignment(cuttingId);
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
        const item = cuttingData.find(d => Number(d.id) === id);
        if (!item) return;
        if (isFullyPassed(item)) { Swal.fire({ icon: 'info', title: 'Fully Passed' }); return; }

        currentEditingId = id;
        $("#progressSubBatch").val(item.subBatch);
        $("#progressWorker").val(item.worker);
        $("#progressTypeSelect").val("completed");
        $("#progressQty").val(0);
        refreshProgressModalNumbers(item);

        // ✅ NEW: Render history inside the modal
        renderProgressHistory(id);

        $("#progressModal").modal("show");
    });

    $(document).on("input change", "#progressQty, #progressTypeSelect", function () {
        const item = cuttingData.find(d => Number(d.id) === currentEditingId);
        if (!item) return;
        const type = $("#progressTypeSelect").val();
        const addQty = parseInt($("#progressQty").val()) || 0;
        const progress = item.progress || 0, damage = item.damage || 0;
        const passedQty = item.passedQty || 0, qty = item.quantity || 0;
        const previewProgress = type === "completed" ? progress + addQty : progress;
        const previewDamage = type === "damage" ? damage + addQty : damage;
        const effectiveTotal = Math.max(0, qty - previewDamage);
        const remaining = Math.max(0, effectiveTotal - previewProgress);
        $("#progressLivePreview").html(`
            <div class="d-flex justify-content-between">
                <span><strong>Effective Total:</strong> ${effectiveTotal}</span>
                <span><strong>Progress:</strong> ${previewProgress}</span>
                <span><strong>Passed:</strong> ${passedQty}</span>
                <span><strong>Remaining:</strong> ${remaining}</span>
            </div>
        `);
    });

    $("#updateProgressBtn").click(function () {
        const item = cuttingData.find(d => Number(d.id) === currentEditingId);
        if (!item) return;
        const type = $("#progressTypeSelect").val();
        const addQty = parseInt($("#progressQty").val()) || 0;
        const qty = item.quantity || 0;
        const existingProgress = item.progress || 0;
        const existingDamage = item.damage || 0;
        const effectiveTotal = Math.max(0, qty - existingDamage);
        const remainingBefore = Math.max(0, effectiveTotal - existingProgress);

        if (addQty < 0) { Swal.fire({ icon: 'warning', title: 'Invalid' }); return; }
        if (addQty > remainingBefore) { Swal.fire({ icon: 'warning', title: 'Too Much', text: `Max ${remainingBefore}` }); return; }

        if (type === "completed") {
            item.progress = existingProgress + addQty;
            pushHistory({ cuttingId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Progress +${addQty} (total ${item.progress})`, by: "Manager" });
        } else {
            item.damage = existingDamage + addQty;
            pushHistory({ cuttingId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Damage +${addQty} (total ${item.damage})`, by: "Manager" });

            const repairData = readStorage(REPAIR_STORAGE_KEY);
            const existingIdx = repairData.findIndex(r => Number(r.cuttingId) === Number(item.id));
            const repairRecord = {
                cuttingId: item.id, batchId: item.batchId, brand: item.brand,
                designNumber: item.designNumber, color: item.color,
                pieceType: item.pieceType, subBatch: item.subBatch, worker: item.worker,
                damageQty: item.damage, priority: item.priority,
                deliveryDate: item.deliveryDate, status: "pending_repair",
                updatedAt: new Date().toLocaleString("en-GB")
            };
            if (existingIdx !== -1) repairData[existingIdx] = repairRecord;
            else repairData.push(repairRecord);
            saveStorage(REPAIR_STORAGE_KEY, repairData);
        }

        const finalEff = Math.max(0, item.quantity - (item.damage || 0));
        const finalProgress = item.progress || 0;
        const finalPassed = item.passedQty || 0;

        if (finalEff > 0 && finalProgress >= finalEff && finalPassed < finalProgress) {
            const autoPassQty = finalProgress - finalPassed;
            pushRowToNextStage(item, autoPassQty);
            item.passedQty = finalProgress;
            pushHistory({ cuttingId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Auto-passed ${autoPassQty} pcs to next stage`, by: "System" });
            saveData();
            renderCuttingTable();
            $("#progressModal").modal("hide");
            Swal.fire({ icon: 'success', title: 'Auto-Passed', text: `${finalProgress} pcs completed & auto-passed.`, timer: 2200, showConfirmButton: false });
            return;
        }

        saveData();
        renderCuttingTable();
        $("#progressModal").modal("hide");
        Swal.fire({ icon: 'success', title: 'Updated', timer: 1200, showConfirmButton: false });
    });

    /* ================= PASS TO NEXT STAGE ================= */
    function pushRowToNextStage(item, qty) {
        const pool = readStorage(APPROVED_POOL_KEY);
        const idx = pool.findIndex(p => String(p.batchId) === String(item.batchId) && Number(p.pieceNumber) === Number(item.pieceNumber));
        if (idx === -1) return;

        const entry = pool[idx];
        const route = entry.route || [];
        const currentStage = entry.currentStage || {};
        const curIdx = route.findIndex(r => r.stage === currentStage.stage && r.type === currentStage.type);
        const nextStage = (curIdx !== -1 && curIdx + 1 < route.length)
            ? route[curIdx + 1]
            : { type: "packing", stage: "Packing" };

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
        const item = cuttingData.find(d => Number(d.id) === id);
        if (!item) return;
        if (isFullyPassed(item)) {
            Swal.fire({ icon: 'info', title: 'Already Passed', timer: 1400, showConfirmButton: false });
            return;
        }

        const progress = item.progress || 0;
        const passedQty = item.passedQty || 0;
        const passableQty = progress - passedQty;
        if (passableQty <= 0) { Swal.fire({ icon: 'info', title: 'Nothing to Pass' }); return; }

        Swal.fire({
            title: 'Pass to Next Stage?',
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
            confirmButtonText: 'Yes, Pass',
            cancelButtonText: 'Cancel'
        }).then((r) => {
            if (!r.isConfirmed) return;
            pushRowToNextStage(item, passableQty);
            item.passedQty = progress;
            pushHistory({ cuttingId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Passed ${passableQty} pcs to next stage`, by: "Manager" });
            saveData();
            renderCuttingTable();
            Swal.fire({ icon: 'success', title: 'Passed', text: `${passableQty} pcs passed.`, timer: 1800, showConfirmButton: false });
        });
    });

    /* ================= STOP ROW ================= */
    $(document).on("click", ".stop-row-action-btn", function () {
        const id = Number($(this).data("id"));
        const item = cuttingData.find(d => Number(d.id) === id);
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
            const idx = cuttingData.findIndex(d => Number(d.id) === id);
            if (idx === -1) return;
            cuttingData[idx].stopped = true;
            cuttingData[idx].stoppedAt = new Date().toLocaleString("en-GB");
            pushHistory({ cuttingId: item.id, batchId: item.batchId, subBatch: item.subBatch, action: `Stopped / Frozen`, by: "Manager" });
            saveData();
            renderCuttingTable();
            Swal.fire({ icon: "success", title: "Stopped", timer: 1800, showConfirmButton: false });
        });
    });

    /* ================= BULK ASSIGN MODAL ================= */
    function openBulkModal() {
        bulkSelectedBatchIds = new Set();
        bulkPieceSplits = {};
        $("#multiSelectSearch").val("");
        renderMultiSelectOptions();
        renderBulkSelectedCards();
        updateBulkSelectedCount();
        const modal = new bootstrap.Modal(document.getElementById("bulkAssignModal"));
        modal.show();
    }

    function renderMultiSelectOptions() {
        const container = $("#multiSelectOptions");
        container.empty();
        const available = approvedPool.filter(p => getPoolRemaining(p) > 0);
        const byBatch = {};
        available.forEach(item => {
            const key = String(item.batchId);
            if (!byBatch[key]) byBatch[key] = [];
            byBatch[key].push(item);
        });

        const searchTerm = String($("#multiSelectSearch").val() || "").trim().toLowerCase();
        let batchList = Object.keys(byBatch).map(batchId => {
            const items = byBatch[batchId].slice().sort((a, b) => Number(a.pieceNumber) - Number(b.pieceNumber));
            return { batchId, items, first: items[0] };
        });

        if (searchTerm) {
            batchList = batchList.filter(b => {
                const text = [b.first.batchId, b.first.brand, b.first.designNumber, b.first.color,
                    ...b.items.map(i => `${i.pieceNumber} ${i.pieceItem}`)].join(" ").toLowerCase();
                return text.includes(searchTerm);
            });
        }
        batchList.sort((a, b) => String(a.batchId).localeCompare(String(b.batchId)));

        if (!batchList.length) { container.html(`<div class="empty-msg">No batches found</div>`); return; }

        batchList.forEach(b => {
            const isSelected = bulkSelectedBatchIds.has(String(b.batchId));
            const pieceCount = b.items.length;
            const perPieceQty = Number(b.items[0].quantity) || 0;
            container.append(`
                <label class="multi-select-option ${isSelected ? 'selected' : ''}" data-batch-id="${escapeHtml(b.batchId)}">
                    <input type="checkbox" class="multi-select-checkbox" data-batch-id="${escapeHtml(b.batchId)}" ${isSelected ? "checked" : ""}>
                    <div class="flex-grow-1">
                        <div class="opt-title">${escapeHtml(b.first.batchId)}</div>
                        <div class="opt-sub"><strong>Design:</strong> ${escapeHtml(b.first.designNumber || "-")} • <strong>Pieces:</strong> ${pieceCount} • <strong>Per-Piece Qty:</strong> ${perPieceQty} • <strong>Brand:</strong> ${escapeHtml(b.first.brand || "-")}</div>
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

        const available = approvedPool.filter(p => getPoolRemaining(p) > 0);
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
        const defaultDateStr = defaultDeliveryDate();

        const maxSplit = Math.max(...batch.items.map(i => Number(bulkPieceSplits[i.id] || 1)), 1);

        for (let s = 0; s < maxSplit; s++) {
            const splitGroupRows = [];

            batch.items.forEach(item => {
                const splitCount = Number(bulkPieceSplits[item.id] || 1);
                if (s >= splitCount) return;
                const totalQty = Number(item.quantity) || 0;
                const autoQtys = splitQuantity(totalQty, splitCount);
                const workerOpts = WORKERS.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("");
                const subBatch = peekNextSubBatchId(item.batchId, item.pieceItem, s);
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
                        <td><input type="date" class="form-control form-control-sm delivery-date-input" value="${defaultDateStr}"></td>
                        ${copyCellHtml}
                    </tr>
                `);
            });
        }

        // ✅ Manual qty edit → redistribute remaining rows within same piece group
        $tbody.off("input", ".quantity-input").on("input", ".quantity-input", function () {
            const $input = $(this);
            const $row = $input.closest(".bulk-assignment-row");
            const poolId = Number($row.data("pool-id"));
            const splitIndex = Number($row.data("split-index"));
            const pieceTotal = Number($row.data("piece-total")) || 0;

            // Clamp value
            let manualVal = parseInt($input.val()) || 0;
            if (manualVal < 0) manualVal = 0;
            if (manualVal > pieceTotal) {
                manualVal = pieceTotal;
                $input.val(manualVal);
            }

            $input.addClass("manually-edited");

            // Only one row for this piece? nothing to redistribute
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
        const chipsWrap = $('<div class="d-flex flex-wrap gap-1" style="flex:1;"></div>');
        Array.from(bulkSelectedBatchIds).slice(0, 4).forEach(batchId => {
            chipsWrap.append(`<span class="multi-select-chip">${escapeHtml(batchId)}<span class="chip-x" data-remove-batch="${escapeHtml(batchId)}">×</span></span>`);
        });
        if (bulkSelectedBatchIds.size > 4) chipsWrap.append(`<span class="multi-select-chip">+${bulkSelectedBatchIds.size - 4} more</span>`);
        $box.prepend(chipsWrap);
    }

    $("#bulkAssignBtn").on("click", openBulkModal);
    $("#multiSelectBox").on("click", function (e) {
        e.stopPropagation();
        $(this).toggleClass("open");
        $("#multiSelectDropdown").toggleClass("open");
    });
    $("#multiSelectDropdown").on("click", function (e) { e.stopPropagation(); });
    $(document).on("click", function () {
        $("#multiSelectBox").removeClass("open");
        $("#multiSelectDropdown").removeClass("open");
    });
    $("#multiSelectSearch").on("keyup", renderMultiSelectOptions);

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
        const batchId = String($(this).data("remove-batch"));
        bulkSelectedBatchIds.delete(batchId);
        updateBulkSelectedCount();
        renderBulkSelectedCards();
        renderMultiSelectOptions();
    });

    $(document).on("click", ".bulk-apply-split-btn", function () {
        const batchId = String($(this).data("batch-id"));
        const count = parseInt($(`.bulk-global-split[data-batch-id="${batchId}"]`).val()) || 1;
        if (count < 1) { $(`.bulk-global-split[data-batch-id="${batchId}"]`).val(1); return; }
        const available = approvedPool.filter(p => getPoolRemaining(p) > 0);
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
        if (!bulkSelectedBatchIds.size) { Swal.fire({ icon: 'warning', title: 'No Selection' }); return; }

        const allAssignments = [];
        let valid = true, errorMsg = "";

        Array.from(bulkSelectedBatchIds).forEach(batchId => {
            const $card = $(`.bulk-item-card[data-batch-id="${batchId}"]`);
            if (!$card.length) return;
            const rowsByPiece = {};

            $card.find(".bulk-assignment-row").each(function () {
                const poolId = Number($(this).data("pool-id"));
                if (!rowsByPiece[poolId]) rowsByPiece[poolId] = [];
                const subBatch = $(this).find(".sub-batch-input").val();
                const worker = $(this).find(".worker-select").val();
                const quantity = parseInt($(this).find(".quantity-input").val()) || 0;
                const priority = $(this).find(".priority-select").val();
                const deliveryDate = $(this).find(".delivery-date-input").val();
                if (!worker || quantity < 1 || !deliveryDate) { valid = false; errorMsg = `Fill all fields for ${subBatch}.`; return false; }
                rowsByPiece[poolId].push({ subBatch, worker, quantity, priority, deliveryDate });
            });

            if (!valid) return;

            Object.keys(rowsByPiece).forEach(poolId => {
                const item = approvedPool.find(p => Number(p.id) === Number(poolId));
                if (!item) return;
                const rows = rowsByPiece[poolId];
                const totalAssigned = rows.reduce((s, r) => s + r.quantity, 0);
                const remaining = getPoolRemaining(item);
                if (totalAssigned > remaining) { valid = false; errorMsg = `${item.batchId} Piece ${item.pieceNumber}: Over.`; return; }
                allAssignments.push({ item, rows, totalAssigned });
            });

            if (!valid) return;
        });

        if (!valid) { Swal.fire({ icon: 'warning', title: 'Incomplete', text: errorMsg }); return; }

        let addedNew = 0, mergedExisting = 0;

        allAssignments.forEach(({ item, rows }) => {
            rows.forEach(row => {
                const existingIdx = cuttingData.findIndex(d => Number(d.poolId) === Number(item.id) && d.worker === row.worker);
                if (existingIdx !== -1) {
                    cuttingData[existingIdx].quantity += row.quantity;
                    mergedExisting++;
                    pushHistory({ cuttingId: cuttingData[existingIdx].id, batchId: item.batchId, subBatch: cuttingData[existingIdx].subBatch, action: `Additional ${row.quantity} pcs to ${row.worker}`, by: "Manager" });
                } else {
                    const newId = nextId++;
                    cuttingData.push({
                        id: newId, poolId: item.id, batchId: item.batchId,
                        brand: item.brand, designNumber: item.designNumber, color: item.color,
                        pieceType: `Piece ${item.pieceNumber} (${item.pieceItem})`, pieceNumber: item.pieceNumber,
                        worker: row.worker, quantity: row.quantity, priority: row.priority,
                        subBatch: row.subBatch, progress: 0, damage: 0, passedQty: 0,
                        deliveryDate: row.deliveryDate,
                        approvedItems: item.availableItems || [],
                        photo: item.photo || ""
                    });
                    pushHistory({ cuttingId: newId, batchId: item.batchId, subBatch: row.subBatch, action: `Assigned ${row.quantity} pcs to ${row.worker}`, by: "Manager" });
                    addedNew++;
                }
            });
        });

        saveData();
        renderApprovedTable();
        renderCuttingTable();

        const modalEl = document.getElementById("bulkAssignModal");
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        let msg = "";
        if (addedNew > 0 && mergedExisting > 0) msg = `${addedNew} new + ${mergedExisting} merged.`;
        else if (mergedExisting > 0) msg = `${mergedExisting} merged.`;
        else msg = `${addedNew} created.`;

        Swal.fire({ icon: "success", title: "Assigned Successfully", text: msg, timer: 2200, showConfirmButton: false });
    });

    /* ================= REFRESH ================= */
    $("#refreshCuttingBtn").click(function () {
        loadData();
        renderApprovedTable();
        renderCuttingTable();
        Swal.fire({ icon: "success", title: "Refreshed", timer: 1000, showConfirmButton: false });
    });

    /* ================= INIT ================= */
    loadData();
    renderApprovedTable();
    renderCuttingTable();

    window.addEventListener("focus", function () {
        loadData();
        renderApprovedTable();
        renderCuttingTable();
    });

    setInterval(function () {
        const prevPool = JSON.stringify(approvedPool);
        const prevCutting = JSON.stringify(cuttingData);
        loadData();
        if (JSON.stringify(approvedPool) !== prevPool || JSON.stringify(cuttingData) !== prevCutting) {
            renderApprovedTable();
            renderCuttingTable();
        }
    }, 2000);
});