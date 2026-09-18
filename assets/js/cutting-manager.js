$(document).ready(function () {
    "use strict";

    const APPROVED_POOL_KEY = "approvedPool";
    const CUTTING_DATA_KEY = "cuttingData";
    const CUTTING_NEXT_ID_KEY = "cuttingNextId";
    const SUB_BATCH_COUNTERS_KEY = "cuttingSubBatchCounters";

    const PLACEHOLDER_IMG =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
            '<rect width="100%" height="100%" fill="#f1f3f8"/>' +
            '<text x="50%" y="55%" font-family="Arial" font-size="11" fill="#9aa6c2" text-anchor="middle">No Image</text>' +
            '</svg>'
        );

    let approvedPool = [];
    let cuttingData = [];
    let nextId = 1;
    let subBatchCounters = {};
    let currentEditingId = null;

    /* ================= HELPERS ================= */
    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) { return false; }
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

    function generateSubBatchId(batchId, pieceCount, index) {
        let formatted = batchId;
        if (!formatted.toString().includes("BATCH-")) {
            formatted = `BATCH-${String(batchId).padStart(4, "0")}`;
        }
        const num = index + 1;
        if (pieceCount === 1) return `${formatted}-C${num}`;
        if (pieceCount === 2) {
            return num % 2 === 1
                ? `${formatted}-U${Math.ceil(num / 2)}`
                : `${formatted}-L${num / 2}`;
        }
        if (pieceCount === 3) {
            const group = Math.ceil(num / 3);
            const pos = ((num - 1) % 3) + 1;
            if (pos === 1) return `${formatted}-U${group}`;
            if (pos === 2) return `${formatted}-J${group}`;
            return `${formatted}-L${group}`;
        }
        return `${formatted}-C${num}`;
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

    /* ================= TABLE 1: APPROVED ITEMS (MERGED) ================= */
    function renderApprovedTable() {
        const tbody = $("#approvedItemsList");
        tbody.empty();

        if (!approvedPool.length) {
            tbody.html(`
                <tr>
                    <td colspan="12" class="text-center text-muted py-4">
                        <i class="bx bx-info-circle me-1"></i> No approved items yet.
                    </td>
                </tr>
            `);
            return;
        }

        // Group by batchId
        const grouped = {};
        approvedPool.forEach(item => {
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
                // Build ✅/❌ list — use itemAvailability as source of truth
                const materials = Array.isArray(it.materials) && it.materials.length
                    ? it.materials
                    : (Array.isArray(it.availableItems) ? it.availableItems : []);
                const availability = it.itemAvailability || {};

                const availHtml = materials.length
                    ? materials.map(m => {
                        // ✅ only if explicitly marked yes
                        const isYes = availability[m] === "yes";
                        return `<div class="avail-line"><span class="avail-item ${isYes ? 'avail-yes' : 'avail-no'}">${escapeHtml(m)} ${isYes ? "✅" : "❌"}</span></div>`;
                    }).join("")
                    : `<div class="avail-line text-muted">-</div>`;

                const pieceLine = `<div class="piece-line"><span class="piece-num">${escapeHtml(it.pieceNumber)} Piece</span></div>`;
                const itemLine = `<div class="piece-line">${escapeHtml(it.pieceItem || "-")}</div>`;
                const statusLine = `<div class="status-line">${getStatusBadgeHtml(it)}</div>`;
                const actionLine = `
                    <div class="action-line">
                        <button class="btn btn-sm btn-primary assign-from-pool-btn"
                                data-pool-id="${it.id}"
                                title="Assign Piece ${escapeHtml(it.pieceNumber)}"
                                ${it.status === "assigned" ? "disabled" : ""}>
                            <i class="bx bx-plus"></i> Assign
                        </button>
                    </div>
                `;

                tbody.append(`
                    <tr>
                        ${idx === 0 ? batchCols : ""}
                        <td>${pieceLine}</td>
                        <td>${itemLine}</td>
                        <td>${availHtml}</td>
                        ${idx === 0 ? qtyPriorityCols : ""}
                        <td>${statusLine}</td>
                        <td>${actionLine}</td>
                    </tr>
                `);
            });
        });
    }

    /* ================= TABLE 2: CUTTING ASSIGNMENTS ================= */
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
            return;
        }

        const grouped = {};
        cuttingData.forEach(item => {
            const key = String(item.batchId);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });

        let serial = 0;
        Object.keys(grouped).forEach(batchId => {
            const items = grouped[batchId];
            serial++;

            items.forEach((item, idx) => {
                const progress = item.progress || 0;
                const progressPct = item.quantity > 0 ? Math.round((progress / item.quantity) * 100) : 0;
                const remaining = item.quantity - progress;

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
                if (progress === item.quantity && item.quantity > 0) {
                    statusText = "Complete ✅";
                    statusClass = "text-success";
                } else if (progress > 0) {
                    statusText = "In Progress";
                    statusClass = "text-primary";
                }

                tbody.append(`
                    <tr>
                        <td>${idx === 0 ? serial : ""}</td>
                        <td>${idx === 0 ? escapeHtml(item.batchId) : ""}</td>
                        <td><span class="fw-semibold text-primary">${escapeHtml(item.subBatch || "-")}</span></td>
                        <td>${idx === 0 ? escapeHtml(item.brand || "") : ""}</td>
                        <td>${escapeHtml(item.pieceType || "-")}</td>
                        <td>${escapeHtml(item.worker || "-")}</td>
                        <td>${escapeHtml(item.quantity || 0)}</td>
                        <td>
                            <div class="d-flex align-items-center gap-2">
                                <span>${progress}</span>
                                <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${progressPct}%;"></div></div>
                            </div>
                        </td>
                        <td>${remaining}</td>
                        <td>${escapeHtml(item.size || "N/A")}</td>
                        <td><span class="${priorityClass} fw-semibold">${escapeHtml(item.priority || "-")}</span></td>
                        <td>${deliveryHtml}</td>
                        <td><span class="${statusClass} fw-semibold">${statusText}</span></td>
                        <td>
                            <button class="btn btn-sm btn-primary progress-btn" data-id="${item.id}" title="Update Progress"><i class="bx bx-edit"></i></button>
                            <button class="btn btn-sm btn-danger delete-cutting-btn" data-id="${item.id}" title="Delete"><i class="bx bx-trash"></i></button>
                        </td>
                    </tr>
                `);
            });
        });
    }

    /* ================= POPULATE BATCH SELECT ================= */
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
                <option value="${item.id}"
                    data-batch-id="${escapeHtml(item.batchId)}"
                    data-brand="${escapeHtml(item.brand)}"
                    data-piece-num="${item.pieceNumber}"
                    data-piece-item="${escapeHtml(item.pieceItem)}"
                    data-quantity="${item.quantity}"
                    data-priority="${escapeHtml(item.priority)}">
                    ${escapeHtml(item.batchId)} - ${escapeHtml(item.brand)} - Piece ${item.pieceNumber} (${escapeHtml(item.pieceItem)}) - Qty ${item.quantity}
                </option>
            `);
        });
    }

    /* ================= GENERATE MODAL ROWS ================= */
    function generateTableRows(poolItem, remaining) {
        const container = $("#rowsContainer");
        container.empty();

        const baseRows = poolItem.pieceNumber || 1;
        const defaultDelivery = new Date();
        defaultDelivery.setDate(defaultDelivery.getDate() + 17);
        const defaultDateStr = defaultDelivery.toISOString().split('T')[0];

        container.append(`
            <div class="alert alert-primary mb-3">
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <i class="bx bx-layer me-2"></i>
                        <strong>${escapeHtml(poolItem.batchId)}</strong> — Piece ${poolItem.pieceNumber} (${escapeHtml(poolItem.pieceItem)})
                        <br>
                        <small class="text-muted">Available Items: ${(poolItem.availableItems || []).join(", ") || "-"}</small>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label mb-0">Split Count (Rows)</label>
                        <div class="input-group">
                            <input type="number" class="form-control" id="splitCount" value="${baseRows}" min="1" max="20">
                            <button class="btn btn-success" id="applySplitBtn" type="button">
                                <i class="bx bx-check"></i> Apply Split
                            </button>
                        </div>
                        <small class="text-muted">Remaining: ${remaining}</small>
                    </div>
                </div>
            </div>
        `);

        function renderRows(count) {
            container.find('.table-responsive').remove();

            if (count < 1) count = 1;
            if (count > remaining) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Too Many Rows',
                    text: `Cannot create ${count} rows for only ${remaining} remaining pieces.`
                });
                return;
            }

            const startOffset = subBatchCounters[poolItem.batchId] || 0;
            const baseQty = Math.floor(remaining / count);
            const extra = remaining % count;

            container.append(`
                <div class="table-responsive">
                    <table class="table table-bordered table-sm mb-0">
                        <thead>
                            <tr>
                                <th style="width:15%;">Sub-Batch ID</th>
                                <th style="width:20%;">Worker Name</th>
                                <th style="width:12%;">Quantity</th>
                                <th style="width:12%;">Size</th>
                                <th style="width:16%;">Priority</th>
                                <th style="width:25%;">Delivery Date</th>
                            </tr>
                        </thead>
                        <tbody id="assignmentTableBody"></tbody>
                    </table>
                </div>
            `);

            const tbody = $("#assignmentTableBody");

            for (let i = 0; i < count; i++) {
                let qty = baseQty;
                if (i < extra) qty += 1;
                const subBatch = generateSubBatchId(poolItem.batchId, poolItem.pieceNumber, startOffset + i);

                tbody.append(`
                    <tr class="assignment-row">
                        <td>
                            <span class="sub-batch-label fw-semibold text-primary">${escapeHtml(subBatch)}</span>
                            <input type="hidden" class="sub-batch-input" value="${escapeHtml(subBatch)}">
                        </td>
                        <td>
                            <select class="form-select form-select-sm worker-select" required>
                                <option value="">Select Worker</option>
                                <option>Ahmad Khan</option>
                                <option>Bilal Ahmed</option>
                                <option>Danish Ali</option>
                                <option>Faisal Khan</option>
                                <option>Usman Malik</option>
                                <option>Ali Ahmed</option>
                                <option>Imran Khan</option>
                                <option>Saeed Ahmad</option>
                                <option>Zafar Iqbal</option>
                                <option>Rashid Mahmood</option>
                            </select>
                        </td>
                        <td><input type="number" class="form-control form-control-sm quantity-input" value="${qty}" min="1"></td>
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

    /* ================= EVENT: Assign from row ================= */
    $(document).on("click", ".assign-from-pool-btn", function () {
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

    /* ================= EVENT: Open Assign Modal (top button) ================= */
    $("#assignCuttingBtn").click(function () {
        populateBatchSelect();
        $("#rowsContainer").empty();
        $("#assignModal").modal("show");
    });

    /* ================= EVENT: Batch Select Change ================= */
    $("#batchSelect").change(function () {
        const poolId = Number($(this).val());
        if (!poolId) {
            $("#rowsContainer").empty();
            return;
        }

        const item = approvedPool.find(p => Number(p.id) === poolId);
        if (!item) return;

        generateTableRows(item, item.quantity || 0);
    });

    /* ================= SAVE ASSIGNMENT ================= */
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

            if (!worker || quantity < 1 || !deliveryDate) {
                valid = false;
                return false;
            }

            rows.push({ subBatch, worker, quantity, size, priority, deliveryDate });
        });

        if (!valid) {
            Swal.fire({ icon: 'warning', title: 'Incomplete', text: 'Please fill all fields.' });
            return;
        }

        if (!rows.length) {
            Swal.fire({ icon: 'warning', title: 'No Rows', text: 'Please add at least one assignment row.' });
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

        subBatchCounters[poolItem.batchId] = (subBatchCounters[poolItem.batchId] || 0) + rows.length;

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

    /* ================= UPDATE PROGRESS ================= */
    $(document).on("click", ".progress-btn", function () {
        const id = Number($(this).data("id"));
        const item = cuttingData.find(d => Number(d.id) === id);
        if (!item) return;

        currentEditingId = id;
        $("#progressSubBatch").val(item.subBatch);
        $("#progressWorker").val(item.worker);
        $("#progressTotal").val(item.quantity);
        $("#progressMax").text(item.quantity);
        $("#progressCompleted").val(item.progress || 0);
        $("#progressModal").modal("show");
    });

    $("#updateProgressBtn").click(function () {
        const item = cuttingData.find(d => Number(d.id) === currentEditingId);
        if (!item) return;

        const completed = parseInt($("#progressCompleted").val()) || 0;
        const max = parseInt($("#progressMax").text()) || 0;

        if (completed < 0 || completed > max) {
            Swal.fire({ icon: 'warning', title: 'Invalid', text: `Enter 0-${max}.` });
            return;
        }

        item.progress = completed;
        saveData();
        renderCuttingTable();
        $("#progressModal").modal("hide");
        Swal.fire({ icon: 'success', title: 'Updated', timer: 1200, showConfirmButton: false });
    });

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
});