$(document).ready(function () {
    "use strict";

    const APPROVED_POOL_KEY = "approvedPool";
    const CUTTING_DATA_KEY = "cuttingData";
    const CUTTING_NEXT_ID_KEY = "cuttingNextId";
    const SUB_BATCH_COUNTERS_KEY = "cuttingSubBatchCounters";
    const STITCHING_POOL_KEY = "stitchingPool";
    const REPAIR_STORAGE_KEY = "repairData";

    const ROWS_PER_PAGE = 10;

    const PLACEHOLDER_IMG =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
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
    let subBatchCounters = {};
    let currentEditingId = null;

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
        approvedPool = readStorage(APPROVED_POOL_KEY);
        cuttingData = readStorage(CUTTING_DATA_KEY);
        nextId = Number(localStorage.getItem(CUTTING_NEXT_ID_KEY)) || 1;
        try {
            subBatchCounters = JSON.parse(localStorage.getItem(SUB_BATCH_COUNTERS_KEY) || "{}");
        } catch (e) { subBatchCounters = {}; }
    }

    function saveData() {
        saveStorage(CUTTING_DATA_KEY, cuttingData);
        saveStorage(APPROVED_POOL_KEY, approvedPool);
        localStorage.setItem(CUTTING_NEXT_ID_KEY, String(nextId));
        localStorage.setItem(SUB_BATCH_COUNTERS_KEY, JSON.stringify(subBatchCounters));
    }

    function sanitizePieceName(name) {
        return String(name || "")
            .trim()
            .replace(/[^A-Za-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            || "Piece";
    }

    function getSubBatchCounterKey(batchId, pieceName) {
        return `${batchId}::${sanitizePieceName(pieceName)}`;
    }

    function peekNextSubBatchId(batchId, pieceName, offset) {
        const off = offset || 0;
        let formatted = String(batchId || "");
        if (!formatted.includes("BATCH-")) {
            formatted = `BATCH-${String(batchId).padStart(3, "0")}`;
        }
        const safePiece = sanitizePieceName(pieceName);
        const startCounter = (subBatchCounters[getSubBatchCounterKey(batchId, safePiece)] || 0) + 1;
        const n = startCounter + off;
        return `${formatted}-${safePiece}-C${n}`;
    }

    function bumpSubBatchCounter(batchId, pieceName, by) {
        const safePiece = sanitizePieceName(pieceName);
        const key = getSubBatchCounterKey(batchId, safePiece);
        subBatchCounters[key] = (subBatchCounters[key] || 0) + (by || 1);
    }

    function getStatusBadgeHtml(item) {
        if (item.status === "assigned") {
            return `<span class="badge bg-primary">Assigned</span>`;
        }
        if (item.mode === "in_progress") {
            return `<span class="badge bg-warning text-dark">In Progress</span>`;
        }
        return `<span class="badge bg-success">Pass</span>`;
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

    /* ================= PAGINATION ================= */
    function buildPager($container, currentPage, totalPages, totalItems, pageSize, onPageChange, label) {
        $container.empty();
        if (totalItems === 0) return;

        const startItem = (currentPage - 1) * pageSize + 1;
        const endItem = Math.min(currentPage * pageSize, totalItems);

        $container.append(`
            <div class="info-text">
                Showing <strong>${startItem}-${endItem}</strong> of <strong>${totalItems}</strong> ${label}
            </div>
        `);

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

    /* ================= TABLE 1 ================= */
    function renderApprovedTable() {
        const tbody = $("#approvedItemsList");
        tbody.empty();

        const available = approvedPool.filter(p => p.status !== "assigned");

        if (!available.length) {
            tbody.html(`
                <tr>
                    <td colspan="11" class="text-center text-muted py-4">
                        <i class="bx bx-info-circle me-1"></i> No approved items available.
                    </td>
                </tr>
            `);
            $("#approvedPagination").empty();
            return;
        }

        available.sort((a, b) => {
            if (String(a.batchId) !== String(b.batchId)) {
                return String(a.batchId).localeCompare(String(b.batchId));
            }
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

            const batchCols = `
                <td rowspan="${rowspan}"><strong>${escapeHtml(first.batchId || "-")}</strong></td>
                <td rowspan="${rowspan}">
                    <img src="${photoSrc}" alt="Batch" style="width:55px;height:55px;object-fit:cover;border-radius:6px;" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';">
                </td>
                <td rowspan="${rowspan}">${escapeHtml(first.brand || "-")}</td>
                <td rowspan="${rowspan}">${escapeHtml(first.designNumber || "-")}</td>
                <td rowspan="${rowspan}">${escapeHtml(first.color || "-")}</td>
            `;

            const qtyPriorityCols = `
                <td rowspan="${rowspan}">${escapeHtml(first.quantity || 0)}</td>
                <td rowspan="${rowspan}">${escapeHtml(first.priority || "-")}</td>
            `;

            items.forEach((it, idx) => {
                const pieceLine = `<div class="piece-line"><span class="piece-num">${escapeHtml(it.pieceNumber)} Piece</span></div>`;
                const itemLine = `<div class="piece-line">${escapeHtml(it.pieceItem || "-")}</div>`;
                const statusLine = `<div class="status-line">${getStatusBadgeHtml(it)}</div>`;
                const actionLine = `
                    <button class="btn btn-sm btn-primary assign-single-btn"
                            data-pool-id="${it.id}"
                            title="Assign Piece ${escapeHtml(it.pieceNumber)}">
                        <i class="bx bx-plus"></i> Assign
                    </button>
                `;

                tbody.append(`
                    <tr>
                        ${idx === 0 ? batchCols : ""}
                        <td>${pieceLine}</td>
                        <td>${itemLine}</td>
                        ${idx === 0 ? qtyPriorityCols : ""}
                        <td>${statusLine}</td>
                        <td>${actionLine}</td>
                    </tr>
                `);
            });
        });

        buildPager(
            $("#approvedPagination"),
            approvedPage, totalPages, totalItems, ROWS_PER_PAGE,
            (p) => { approvedPage = p; renderApprovedTable(); },
            "items"
        );
    }

    /* ================= TABLE 2 ================= */
    function renderCuttingTable() {
        const tbody = $("#cuttingMastersList");
        tbody.empty();

        if (!cuttingData.length) {
            tbody.html(`
                <tr>
                    <td colspan="14" class="text-center text-muted py-4">
                        <i class="bx bx-info-circle me-1"></i> No cutting assignments yet.
                    </td>
                </tr>
            `);
            $("#cuttingPagination").empty();
            return;
        }

        const totalItems = cuttingData.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / ROWS_PER_PAGE));
        if (cuttingPage > totalPages) cuttingPage = totalPages;

        const startIdx = (cuttingPage - 1) * ROWS_PER_PAGE;
        const pageItems = cuttingData.slice(startIdx, startIdx + ROWS_PER_PAGE);

        const grouped = {};
        pageItems.forEach(item => {
            const key = String(item.batchId);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });

        let serial = startIdx;
        Object.keys(grouped).forEach(batchId => {
            const items = grouped[batchId];
            const firstOfBatch = (startIdx === 0 || cuttingData[startIdx - 1]?.batchId !== batchId);
            if (firstOfBatch) serial++;

            items.forEach((item, idx) => {
                const progress = item.progress || 0;
                const damage = item.damage || 0;
                const progressPct = item.quantity > 0 ? Math.round((progress / item.quantity) * 100) : 0;
                const remaining = Math.max(0, item.quantity - progress - damage);

                const priorityClass = item.priority === 'High' ? 'text-danger'
                                    : item.priority === 'Medium' ? 'text-warning'
                                    : 'text-secondary';

                let deliveryHtml = `<span class="text-muted">Not Set</span>`;
                if (item.deliveryDate) {
                    const cls = getDeliveryStatusClass(item.deliveryDate);
                    deliveryHtml = `<span class="badge ${cls} delivery-date-badge">${formatDateDisplay(item.deliveryDate)}</span>`;
                }

                let statusText = "Pending";
                let statusClass = "text-warning";
                if (item.passedToStitching) {
                    statusText = "Passed ✅";
                    statusClass = "text-success";
                } else if (progress >= item.quantity && item.quantity > 0) {
                    statusText = "Complete ✅";
                    statusClass = "text-success";
                } else if (progress > 0 || damage > 0) {
                    statusText = "In Progress";
                    statusClass = "text-primary";
                }

                const isFirst = idx === 0;

                const damageHtml = damage > 0
                    ? `<span class="damage-badge">${damage}</span>`
                    : `<span class="damage-empty">-</span>`;

                tbody.append(`
                    <tr>
                        <td>${isFirst ? serial : ""}</td>
                        <td>${isFirst ? escapeHtml(item.batchId) : ""}</td>
                        <td><span class="fw-semibold text-primary">${escapeHtml(item.subBatch || "-")}</span></td>
                        <td>${escapeHtml(item.brand || "-")}</td>
                        <td>${escapeHtml(item.pieceType || "-")}</td>
                        <td>${escapeHtml(item.worker || "-")}</td>
                        <td>${escapeHtml(item.quantity || 0)}</td>
                        <td>
                            <div class="d-flex align-items-center gap-2">
                                <span>${progress}</span>
                                <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${progressPct}%;"></div></div>
                            </div>
                        </td>
                        <td>${damageHtml}</td>
                        <td>${remaining}</td>
                        <td><span class="${priorityClass} fw-semibold">${escapeHtml(item.priority || "-")}</span></td>
                        <td>${deliveryHtml}</td>
                        <td><span class="${statusClass} fw-semibold">${statusText}</span></td>
                        <td>
                            <button class="btn btn-sm btn-primary progress-btn" data-id="${item.id}" title="Update Progress / Edit"><i class="bx bx-edit"></i></button>
                            <button class="btn btn-sm btn-danger delete-cutting-btn" data-id="${item.id}" title="Delete"><i class="bx bx-trash"></i></button>
                        </td>
                    </tr>
                `);
            });
        });

        buildPager(
            $("#cuttingPagination"),
            cuttingPage, totalPages, totalItems, ROWS_PER_PAGE,
            (p) => { cuttingPage = p; renderCuttingTable(); },
            "assignments"
        );
    }

    /* ================= SINGLE ASSIGN MODAL ================= */
    function populateBatchSelect() {
        const select = $("#batchSelect");
        select.empty();
        select.append('<option value="">Choose Batch</option>');

        const available = approvedPool.filter(p => p.status !== "assigned");

        if (!available.length) {
            select.append('<option value="" disabled>No approved items available</option>');
            return;
        }

        available.forEach(item => {
            select.append(`
                <option value="${item.id}">
                    ${escapeHtml(item.batchId)} - ${escapeHtml(item.brand)} - Piece ${item.pieceNumber} (${escapeHtml(item.pieceItem)}) - Qty ${item.quantity}
                </option>
            `);
        });
    }

    function generateTableRows(poolItem, remaining) {
        const container = $("#rowsContainer");
        container.empty();

        const baseRows = 1;

        container.append(`
            <div class="alert alert-primary mb-3">
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <i class="bx bx-layer me-2"></i>
                        <strong>${escapeHtml(poolItem.batchId)}</strong> — Piece ${poolItem.pieceNumber} (${escapeHtml(poolItem.pieceItem)})
                        <div class="small text-muted mt-1">Available: <strong>${remaining}</strong></div>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label mb-0">Split Count (Rows)</label>
                        <div class="input-group">
                            <input type="number" class="form-control" id="splitCount" value="${baseRows}" min="1" max="20">
                            <button class="btn btn-success" id="applySplitBtn" type="button">
                                <i class="bx bx-check"></i> Apply Split
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        function renderRows(count) {
            container.find('.table-responsive').remove();

            if (count < 1) count = 1;

            container.append(`
                <div class="table-responsive">
                    <table class="table table-bordered table-sm mb-0">
                        <thead>
                            <tr>
                                <th style="width:18%;">Sub-Batch ID</th>
                                <th style="width:20%;">Worker Name</th>
                                <th style="width:12%;">Quantity</th>
                                <th style="width:12%;">Size</th>
                                <th style="width:14%;">Priority</th>
                                <th style="width:24%;">Delivery Date</th>
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
                const workerOpts = WORKERS.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("");
                const defaultQty = i === 0 ? poolItem.quantity : "";

                tbody.append(`
                    <tr class="assignment-row">
                        <td>
                            <span class="sub-batch-label fw-semibold text-primary">${escapeHtml(subBatch)}</span>
                            <input type="hidden" class="sub-batch-input" value="${escapeHtml(subBatch)}">
                        </td>
                        <td>
                            <select class="form-select form-select-sm worker-select" required>
                                <option value="">Select Worker</option>
                                ${workerOpts}
                            </select>
                        </td>
                        <td><input type="number" class="form-control form-control-sm quantity-input" value="${defaultQty}" placeholder="Qty" min="1" max="${poolItem.quantity}"></td>
                        <td>
                            <select class="form-select form-select-sm size-select">
                                <option value="S">S</option>
                                <option value="M" selected>M</option>
                                <option value="L">L</option>
                                <option value="XL">XL</option>
                            </select>
                        </td>
                        <td>
                            <select class="form-select form-select-sm priority-select">
                                <option value="Low">Low</option>
                                <option value="Medium" selected>Medium</option>
                                <option value="High">High</option>
                            </select>
                        </td>
                        <td>
                            <input type="date" class="form-control form-control-sm delivery-date-input" value="${defaultDateStr}">
                        </td>
                    </tr>
                `);
            }
        }

        renderRows(baseRows);

        $("#applySplitBtn").click(function () {
            const c = parseInt($("#splitCount").val()) || 1;
            renderRows(c);
        });
    }

    $(document).on("click", ".assign-single-btn", function () {
        const poolId = Number($(this).data("pool-id"));
        const item = approvedPool.find(p => Number(p.id) === poolId);
        if (!item) return;

        if (item.status === "assigned") {
            Swal.fire({ icon: 'info', title: 'Already Assigned', text: 'This item has already been assigned.' });
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
        generateTableRows(item, item.quantity || 0);
    });

    $("#saveAssignBtn").click(function () {
        const poolId = Number($("#batchSelect").val());
        if (!poolId) {
            Swal.fire({ icon: 'warning', title: 'Select Batch', text: 'Please select an item first.' });
            return;
        }

        const poolItem = approvedPool.find(p => Number(p.id) === poolId);
        if (!poolItem) return;

        const rows = [];
        let valid = true;

        $(".assignment-row").each(function () {
            const subBatch = $(this).find(".sub-batch-input").val();
            const worker = $(this).find(".worker-select").val();
            const quantity = parseInt($(this).find(".quantity-input").val()) || 0;
            const size = $(this).find(".size-select").val();
            const priority = $(this).find(".priority-select").val();
            const deliveryDate = $(this).find(".delivery-date-input").val();

            if (!worker || quantity < 1 || !deliveryDate) { valid = false; return false; }
            rows.push({ subBatch, worker, quantity, size, priority, deliveryDate });
        });

        if (!valid) { Swal.fire({ icon: 'warning', title: 'Incomplete', text: 'Please fill all fields.' }); return; }
        if (!rows.length) { Swal.fire({ icon: 'warning', title: 'No Rows', text: 'Please add at least one assignment row.' }); return; }

        const totalAssigned = rows.reduce((s, r) => s + r.quantity, 0);
        if (totalAssigned > poolItem.quantity) {
            Swal.fire({ icon: 'warning', title: 'Over Quantity', text: `Total assigned (${totalAssigned}) exceeds available (${poolItem.quantity}).` });
            return;
        }

        rows.forEach(row => {
            cuttingData.push({
                id: nextId++,
                batchId: poolItem.batchId,
                brand: poolItem.brand,
                designNumber: poolItem.designNumber,
                color: poolItem.color,
                pieceType: `Piece ${poolItem.pieceNumber} (${poolItem.pieceItem})`,
                worker: row.worker,
                quantity: row.quantity,
                size: row.size,
                priority: row.priority,
                subBatch: row.subBatch,
                progress: 0,
                damage: 0,
                passedQty: 0,
                deliveryDate: row.deliveryDate,
                approvedItems: poolItem.availableItems || []
            });
        });

        const idx = approvedPool.findIndex(p => Number(p.id) === poolId);
        if (idx !== -1) {
            approvedPool[idx].status = "assigned";
            approvedPool[idx].assignedAt = new Date().toLocaleString("en-GB");
        }

        bumpSubBatchCounter(poolItem.batchId, poolItem.pieceItem, rows.length);

        saveData();
        renderApprovedTable();
        renderCuttingTable();
        $("#assignModal").modal("hide");

        Swal.fire({
            icon: "success",
            title: "Assigned Successfully",
            text: `${rows.length} row(s) assigned.`,
            timer: 2000,
            showConfirmButton: false
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

        const available = approvedPool.filter(p => p.status !== "assigned");
        const byBatch = {};
        available.forEach(item => {
            const key = String(item.batchId);
            if (!byBatch[key]) byBatch[key] = [];
            byBatch[key].push(item);
        });

        const searchTerm = String($("#multiSelectSearch").val() || "").trim().toLowerCase();

        let batchList = Object.keys(byBatch).map(batchId => {
            const items = byBatch[batchId].slice().sort((a, b) => Number(a.pieceNumber) - Number(b.pieceNumber));
            return { batchId: batchId, items: items, first: items[0] };
        });

        if (searchTerm) {
            batchList = batchList.filter(b => {
                const text = [
                    b.first.batchId, b.first.brand, b.first.designNumber, b.first.color,
                    ...b.items.map(i => `${i.pieceNumber} ${i.pieceItem}`)
                ].join(" ").toLowerCase();
                return text.includes(searchTerm);
            });
        }

        batchList.sort((a, b) => String(a.batchId).localeCompare(String(b.batchId)));

        if (!batchList.length) {
            container.html(`<div class="empty-msg">No batches found</div>`);
            return;
        }

        batchList.forEach(b => {
            const isSelected = bulkSelectedBatchIds.has(String(b.batchId));
            const pieceCount = b.items.length;
            const totalQty = b.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);

            container.append(`
                <label class="multi-select-option ${isSelected ? 'selected' : ''}" data-batch-id="${escapeHtml(b.batchId)}">
                    <input type="checkbox" class="multi-select-checkbox" data-batch-id="${escapeHtml(b.batchId)}" ${isSelected ? "checked" : ""}>
                    <div class="flex-grow-1">
                        <div class="opt-title">${escapeHtml(b.first.batchId)}</div>
                        <div class="opt-sub">
                            <strong>Design:</strong> ${escapeHtml(b.first.designNumber || "-")} •
                            <strong>Pieces:</strong> ${pieceCount} •
                            <strong>Total Qty:</strong> ${totalQty} •
                            <strong>Brand:</strong> ${escapeHtml(b.first.brand || "-")}
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
            container.html(`
                <div class="text-center text-muted py-5">
                    <i class="bx bx-info-circle fs-2 d-block mb-2"></i>
                    No batch selected yet. Use the dropdown above to choose batches.
                </div>
            `);
            return;
        }

        const available = approvedPool.filter(p => p.status !== "assigned");

        const selectedBatches = Array.from(bulkSelectedBatchIds).map(batchId => {
            const items = available
                .filter(p => String(p.batchId) === String(batchId))
                .sort((a, b) => Number(a.pieceNumber) - Number(b.pieceNumber));
            return { batchId: batchId, items: items };
        }).filter(b => b.items.length > 0);

        selectedBatches.sort((a, b) => String(a.batchId).localeCompare(String(b.batchId)));

        selectedBatches.forEach(batch => {
            const first = batch.items[0];
            const photoSrc = first.photo ? escapeHtml(first.photo) : PLACEHOLDER_IMG;
            const primaryQty = Number(first.quantity) || 0;

            container.append(`
                <div class="bulk-item-card" data-batch-id="${escapeHtml(batch.batchId)}">
                    <div class="bulk-item-header">
                        <img src="${photoSrc}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';">
                        <div class="flex-grow-1">
                            <div class="bulk-item-title">
                                ${escapeHtml(batch.batchId)} — Design: ${escapeHtml(first.designNumber || "-")}
                            </div>
                            <div class="bulk-item-sub">
                                <strong>Brand:</strong> ${escapeHtml(first.brand || "-")} •
                                <strong>Color:</strong> ${escapeHtml(first.color || "-")} •
                                <strong>Pieces:</strong> ${batch.items.length} •
                                <strong>Priority:</strong> ${escapeHtml(first.priority || "-")}
                            </div>
                            <div class="bulk-qty-summary" data-batch-id="${escapeHtml(batch.batchId)}">
                                <span class="bulk-qty-pill total">
                                    <i class="bx bx-package"></i> Total: <span class="total-qty-val">${primaryQty}</span>
                                </span>
                                <span class="bulk-qty-pill assigned">
                                    <i class="bx bx-check"></i> Assigned: <span class="assigned-qty-val">0</span>
                                </span>
                                <span class="bulk-qty-pill remaining">
                                    <i class="bx bx-time"></i> Remaining: <span class="remaining-qty-val">${primaryQty}</span>
                                </span>
                            </div>
                        </div>
                        <div class="text-end">
                            <label class="small text-muted d-block mb-1">Split each piece into:</label>
                            <div class="input-group input-group-sm" style="width:150px;">
                                <input type="number" class="form-control form-control-sm bulk-global-split"
                                       data-batch-id="${escapeHtml(batch.batchId)}"
                                       value="1" min="1" max="50">
                                <button type="button" class="btn btn-success bulk-apply-split-btn"
                                        data-batch-id="${escapeHtml(batch.batchId)}">
                                    <i class="bx bx-check"></i> Split
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="split-row-table">
                            <thead>
                                <tr>
                                    <th style="width:12%;">Sub-Batch</th>
                                    <th style="width:8%;">Piece</th>
                                    <th style="width:14%;">Worker</th>
                                    <th style="width:10%;">Qty</th>
                                    <th style="width:10%;">Brand</th>
                                    <th style="width:10%;">Priority</th>
                                    <th style="width:16%;">Delivery Date</th>
                                    <th class="copy-header-cell"></th>
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

        let totalRows = 0;
        batch.items.forEach(item => {
            const splitCount = Number(bulkPieceSplits[item.id] || 1);
            totalRows += splitCount;
        });

        let rowCounter = 0;
        let copyButtonPlaced = false;

        batch.items.forEach(item => {
            const splitCount = Number(bulkPieceSplits[item.id] || 1);
            const totalQty = Number(item.quantity) || 0;
            const defaultDateStr = defaultDeliveryDate();
            const workerOpts = WORKERS.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("");

            for (let i = 0; i < splitCount; i++) {
                const subBatch = peekNextSubBatchId(item.batchId, item.pieceItem, i);
                const defaultQty = i === 0 ? totalQty : "";
                rowCounter++;

                const isFirstRowOfBatch = (rowCounter === 1);

                let copyCell = "";
                if (!copyButtonPlaced) {
                    copyCell = `
                        <td class="copy-col-cell" rowspan="${totalRows}">
                            <button type="button"
                                    class="btn copy-row-side-btn bulk-copy-batch-btn"
                                    data-batch-id="${escapeHtml(batch.batchId)}"
                                    title="Copy first row values to all rows"
                                    disabled>
                                <i class="bx bx-copy"></i>
                            </button>
                        </td>
                    `;
                    copyButtonPlaced = true;
                }

                $tbody.append(`
                    <tr class="bulk-assignment-row"
                        data-pool-id="${item.id}"
                        data-batch-id="${escapeHtml(item.batchId)}"
                        data-piece-number="${item.pieceNumber}"
                        data-piece-qty="${totalQty}">
                        <td>
                            <span class="sub-batch-label fw-semibold text-primary" style="font-size:11px;">${escapeHtml(subBatch)}</span>
                            <input type="hidden" class="sub-batch-input" value="${escapeHtml(subBatch)}">
                        </td>
                        <td>
                            ${i === 0
                                ? `<div class="fw-semibold" style="font-size:12px;">Piece ${escapeHtml(item.pieceNumber)}</div>
                                   <div class="text-muted" style="font-size:11px;">${escapeHtml(item.pieceItem || "-")}</div>`
                                : `<div class="text-muted" style="font-size:11px;">—</div>`
                            }
                        </td>
                        <td>
                            <select class="form-select form-select-sm worker-select" required>
                                <option value="">Select Worker</option>
                                ${workerOpts}
                            </select>
                        </td>
                        <td>
                            <input type="number" class="form-control form-control-sm quantity-input"
                                   value="${defaultQty}" placeholder="Qty" min="1"
                                   max="${totalQty}" style="width:80px;">
                        </td>
                        <td>
                            <span style="font-size:12px;color:#4b5563;font-weight:500;">
                                ${escapeHtml(item.brand || "-")}
                            </span>
                        </td>
                        <td>
                            <select class="form-select form-select-sm priority-select">
                                <option value="Low">Low</option>
                                <option value="Medium" ${item.priority === "Medium" ? "selected" : ""}>Medium</option>
                                <option value="High" ${item.priority === "High" ? "selected" : ""}>High</option>
                            </select>
                        </td>
                        <td>
                            <input type="date" class="form-control form-control-sm delivery-date-input" value="${defaultDateStr}">
                        </td>
                        ${isFirstRowOfBatch ? copyCell : ""}
                    </tr>
                `);
            }
        });

        updateBulkCopyButtonState(batch.batchId);
        updateBatchQtySummary(batch.batchId);
    }

    function updateBatchQtySummary(batchId) {
        const $card = $(`.bulk-item-card[data-batch-id="${batchId}"]`);
        if (!$card.length) return;

        const $summary = $card.find(`.bulk-qty-summary[data-batch-id="${batchId}"]`);
        const $firstRow = $card.find(".bulk-assignment-row").first();
        const primaryQty = Number($firstRow.data("piece-qty")) || 0;

        let assigned = 0;
        $card.find(".bulk-assignment-row").each(function () {
            assigned += parseInt($(this).find(".quantity-input").val()) || 0;
        });

        const remaining = Math.max(0, primaryQty - assigned);

        $summary.find(".total-qty-val").text(primaryQty);
        $summary.find(".assigned-qty-val").text(assigned);
        $summary.find(".remaining-qty-val").text(remaining);
    }

    function updateBulkCopyButtonState(batchId) {
        const $card = $(`.bulk-item-card[data-batch-id="${batchId}"]`);
        if (!$card.length) return;

        const $firstRow = $card.find(".bulk-assignment-row").first();
        if (!$firstRow.length) {
            $card.find(".bulk-copy-batch-btn").prop("disabled", true);
            return;
        }

        const worker = $firstRow.find(".worker-select").val();
        const qty = parseInt($firstRow.find(".quantity-input").val()) || 0;
        const date = $firstRow.find(".delivery-date-input").val();

        const valid = !!(worker && qty >= 1 && date);
        $card.find(".bulk-copy-batch-btn").prop("disabled", !valid);
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
            chipsWrap.append(`
                <span class="multi-select-chip">
                    ${escapeHtml(batchId)}
                    <span class="chip-x" data-remove-batch="${escapeHtml(batchId)}">×</span>
                </span>
            `);
        });
        if (bulkSelectedBatchIds.size > 4) {
            chipsWrap.append(`<span class="multi-select-chip">+${bulkSelectedBatchIds.size - 4} more</span>`);
        }

        $box.prepend(chipsWrap);
    }

    /* ================= BULK MODAL EVENTS ================= */
    $("#bulkAssignBtn").on("click", openBulkModal);

    $("#multiSelectBox").on("click", function (e) {
        e.stopPropagation();
        $(this).toggleClass("open");
        $("#multiSelectDropdown").toggleClass("open");
    });

    $("#multiSelectDropdown").on("click", function (e) {
        e.stopPropagation();
    });

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

        if (count < 1) {
            $(`.bulk-global-split[data-batch-id="${batchId}"]`).val(1);
            return;
        }

        const available = approvedPool.filter(p => p.status !== "assigned");
        const batchItems = available
            .filter(p => String(p.batchId) === String(batchId))
            .sort((a, b) => Number(a.pieceNumber) - Number(b.pieceNumber));

        batchItems.forEach(item => { bulkPieceSplits[item.id] = count; });

        generateBatchRows({ batchId: batchId, items: batchItems });

        Swal.fire({
            icon: "success",
            title: "Split Applied",
            text: `Each piece split into ${count} row(s).`,
            timer: 1200,
            showConfirmButton: false
        });
    });

    $(document).on("input change", ".bulk-assignment-row .worker-select, .bulk-assignment-row .quantity-input, .bulk-assignment-row .delivery-date-input", function () {
        const batchId = $(this).closest(".bulk-assignment-row").data("batch-id");
        updateBulkCopyButtonState(batchId);
        updateBatchQtySummary(batchId);
    });

    $(document).on("click", ".bulk-copy-batch-btn", function () {
        const batchId = String($(this).data("batch-id"));
        const $card = $(`.bulk-item-card[data-batch-id="${batchId}"]`);
        if (!$card.length) return;

        const $allRows = $card.find(".bulk-assignment-row");
        if ($allRows.length < 2) return;

        const $first = $allRows.first();
        const worker = $first.find(".worker-select").val();
        const qty = $first.find(".quantity-input").val();
        const priority = $first.find(".priority-select").val();
        const deliveryDate = $first.find(".delivery-date-input").val();

        $allRows.each(function (i) {
            if (i === 0) return;
            const $row = $(this);
            $row.find(".worker-select").val(worker);
            $row.find(".quantity-input").val(qty);
            $row.find(".priority-select").val(priority);
            $row.find(".delivery-date-input").val(deliveryDate);
        });

        updateBatchQtySummary(batchId);

        Swal.fire({
            icon: "success",
            title: "Copied",
            text: `Row 1 values copied to ${$allRows.length - 1} row(s).`,
            timer: 1500,
            showConfirmButton: false
        });
    });

    /* ================= SAVE BULK ASSIGNMENT ================= */
    $("#saveBulkAssignBtn").on("click", function () {
        if (!bulkSelectedBatchIds.size) {
            Swal.fire({ icon: 'warning', title: 'No Selection', text: 'Please select at least one batch.' });
            return;
        }

        const allAssignments = [];
        let valid = true;
        let errorMsg = "";

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

                if (!worker || quantity < 1 || !deliveryDate) {
                    valid = false;
                    errorMsg = `Please fill all fields for sub-batch ${subBatch}.`;
                    return false;
                }

                rowsByPiece[poolId].push({ subBatch, worker, quantity, priority, deliveryDate });
            });

            if (!valid) return;

            Object.keys(rowsByPiece).forEach(poolId => {
                const item = approvedPool.find(p => Number(p.id) === Number(poolId));
                if (!item) return;

                const rows = rowsByPiece[poolId];
                const totalAssigned = rows.reduce((s, r) => s + r.quantity, 0);
                if (totalAssigned > item.quantity) {
                    valid = false;
                    errorMsg = `${item.batchId} Piece ${item.pieceNumber}: Total assigned (${totalAssigned}) exceeds available (${item.quantity}).`;
                    return;
                }

                allAssignments.push({ item, rows, totalAssigned });
            });

            if (!valid) return;
        });

        if (!valid) {
            Swal.fire({ icon: 'warning', title: 'Incomplete', text: errorMsg });
            return;
        }

        let fullyPassedCount = 0;

        allAssignments.forEach(({ item, rows, totalAssigned }) => {
            rows.forEach(row => {
                cuttingData.push({
                    id: nextId++,
                    batchId: item.batchId,
                    brand: item.brand,
                    designNumber: item.designNumber,
                    color: item.color,
                    pieceType: `Piece ${item.pieceNumber} (${item.pieceItem})`,
                    worker: row.worker,
                    quantity: row.quantity,
                    size: "M",
                    priority: row.priority,
                    subBatch: row.subBatch,
                    progress: 0,
                    damage: 0,
                    passedQty: 0,
                    deliveryDate: row.deliveryDate,
                    approvedItems: item.availableItems || []
                });
            });

            if (totalAssigned >= item.quantity) {
                // Auto pass full batch to stitching
                fullyPassedCount++;
            }

            const idx = approvedPool.findIndex(p => Number(p.id) === Number(item.id));
            if (idx !== -1) {
                approvedPool[idx].status = "assigned";
                approvedPool[idx].assignedAt = new Date().toLocaleString("en-GB");
            }

            bumpSubBatchCounter(item.batchId, item.pieceItem, rows.length);
        });

        saveData();
        renderApprovedTable();
        renderCuttingTable();

        const modalEl = document.getElementById("bulkAssignModal");
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        Swal.fire({
            icon: "success",
            title: "Assigned Successfully",
            text: `${allAssignments.length} piece(s) assigned.`,
            timer: 2000,
            showConfirmButton: false
        });
    });

    /* ================= UPDATE PROGRESS MODAL ================= */
    $(document).on("click", ".progress-btn", function () {
        const id = Number($(this).data("id"));
        const item = cuttingData.find(d => Number(d.id) === id);
        if (!item) return;

        currentEditingId = id;
        $("#progressSubBatch").val(item.subBatch);
        $("#progressWorker").val(item.worker);
        $("#progressTotal").val(item.quantity);
        $("#progressMax").text(item.quantity - (item.damage || 0));
        $("#progressTypeSelect").val("completed");
        $("#progressQty").val(item.progress || 0);

        updatePassModalButtonVisibility(item);
        $("#progressModal").modal("show");
    });

    /**
     * Show "Pass to Stitching" in the modal:
     *  - Visible only when progress >= quantity (i.e. fully complete)
     *  - Or partial completion — user wants the option
     * Rule from user: pass button should appear in edit modal.
     */
    function updatePassModalButtonVisibility(item) {
        const progress = item.progress || 0;
        const damage = item.damage || 0;
        const qty = item.quantity || 0;

        // Show Pass button if there's ANY completed qty
        // Also allow if fully complete
        if (progress > 0 || (progress + damage >= qty)) {
            $("#passStitchingFromModalBtn").show();
        } else {
            $("#passStitchingFromModalBtn").hide();
        }
    }

    // Live toggle Pass button as user types
    $(document).on("input change", "#progressQty", function () {
        const item = cuttingData.find(d => Number(d.id) === currentEditingId);
        if (!item) return;

        const qty = parseInt($(this).val()) || 0;
        const damage = item.damage || 0;
        const total = item.quantity || 0;

        if (qty > 0 || (qty + damage >= total)) {
            $("#passStitchingFromModalBtn").show();
        } else {
            $("#passStitchingFromModalBtn").hide();
        }
    });

    $("#updateProgressBtn").click(function () {
        const item = cuttingData.find(d => Number(d.id) === currentEditingId);
        if (!item) return;

        const type = $("#progressTypeSelect").val(); // "completed" | "damage"
        const qty = parseInt($("#progressQty").val()) || 0;
        const damage = item.damage || 0;
        const max = parseInt($("#progressMax").text()) || 0;

        const totalAccounted = (type === "completed" ? qty : item.progress || 0) + (type === "damage" ? qty : damage);

        if (qty < 0 || qty > max) {
            Swal.fire({ icon: 'warning', title: 'Invalid', text: `Quantity must be 0-${max}.` });
            return;
        }

        if (type === "completed") {
            item.progress = qty;
        } else {
            item.damage = qty;

            const repairData = readStorage(REPAIR_STORAGE_KEY);
            const existingIdx = repairData.findIndex(r => Number(r.cuttingId) === Number(item.id));

            const repairRecord = {
                cuttingId: item.id,
                batchId: item.batchId,
                brand: item.brand,
                designNumber: item.designNumber,
                color: item.color,
                pieceType: item.pieceType,
                subBatch: item.subBatch,
                worker: item.worker,
                damageQty: qty,
                priority: item.priority,
                deliveryDate: item.deliveryDate,
                status: "pending_repair",
                updatedAt: new Date().toLocaleString("en-GB")
            };

            if (existingIdx !== -1) {
                repairData[existingIdx] = repairRecord;
            } else {
                repairData.push(repairRecord);
            }
            saveStorage(REPAIR_STORAGE_KEY, repairData);
        }

        // Auto-pass if fully completed
        const totalQty = item.quantity || 0;
        const effectiveProgress = item.progress || 0;

        if (effectiveProgress >= totalQty && !item.passedToStitching) {
            pushRowToStitching(item, effectiveProgress);
            item.passedToStitching = true;
            item.passedQty = effectiveProgress;
        }

        saveData();
        renderCuttingTable();
        $("#progressModal").modal("hide");
        Swal.fire({ icon: 'success', title: 'Updated', timer: 1200, showConfirmButton: false });
    });

    /* ================= PASS TO STITCHING (from modal) ================= */
    $("#passStitchingFromModalBtn").click(function () {
        const item = cuttingData.find(d => Number(d.id) === currentEditingId);
        if (!item) return;

        const progress = item.progress || 0;
        const damage = item.damage || 0;
        const qty = item.quantity || 0;

        if (progress <= 0) {
            Swal.fire({ icon: 'warning', title: 'Nothing to Pass', text: 'Completed quantity is 0.' });
            return;
        }

        Swal.fire({
            title: 'Pass to Stitching?',
            html: `<div class="text-start">
                    <p><strong>Sub-Batch:</strong> ${escapeHtml(item.subBatch)}</p>
                    <p><strong>Worker:</strong> ${escapeHtml(item.worker)}</p>
                    <p><strong>Completed:</strong> ${progress} pcs</p>
                    <p><strong>Damage:</strong> ${damage} pcs</p>
                   </div>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#198754',
            confirmButtonText: 'Yes, Pass to Stitching',
            cancelButtonText: 'Cancel'
        }).then((r) => {
            if (!r.isConfirmed) return;

            pushRowToStitching(item, progress);
            item.passedToStitching = true;
            item.passedQty = progress;

            saveData();
            renderCuttingTable();
            $("#progressModal").modal("hide");

            Swal.fire({
                icon: 'success',
                title: 'Passed to Stitching',
                text: `${progress} pcs passed.`,
                timer: 1800,
                showConfirmButton: false
            });
        });
    });

    function pushRowToStitching(item, qty) {
        const pool = readStorage(STITCHING_POOL_KEY);

        pool.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            source: "cutting-manager",
            batchId: item.batchId,
            brand: item.brand,
            designNumber: item.designNumber,
            color: item.color,
            pieceType: item.pieceType,
            subBatch: item.subBatch,
            worker: item.worker,
            quantity: qty,
            size: item.size || "M",
            priority: item.priority,
            deliveryDate: item.deliveryDate,
            status: "pending_stitching",
            createdAt: new Date().toLocaleString("en-GB")
        });

        saveStorage(STITCHING_POOL_KEY, pool);
    }

    /* ================= DELETE ================= */
    $(document).on("click", ".delete-cutting-btn", function () {
        const id = Number($(this).data("id"));
        const item = cuttingData.find(d => Number(d.id) === id);
        if (!item) return;

        Swal.fire({
            title: 'Delete?',
            text: `${item.subBatch} — ${item.worker}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Delete'
        }).then(r => {
            if (!r.isConfirmed) return;
            cuttingData = cuttingData.filter(d => Number(d.id) !== id);
            saveData();
            renderCuttingTable();
            Swal.fire({ icon: 'success', title: 'Deleted', timer: 1200, showConfirmButton: false });
        });
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
        const prevApproved = JSON.stringify(approvedPool);
        const prevCutting = JSON.stringify(cuttingData);
        loadData();
        if (JSON.stringify(approvedPool) !== prevApproved || JSON.stringify(cuttingData) !== prevCutting) {
            renderApprovedTable();
            renderCuttingTable();
        }
    }, 2000);
});