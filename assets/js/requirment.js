$(document).ready(function () {
    "use strict";

    const REQUIREMENT_STORAGE_KEY = "requirementData";
    const BATCH_STORAGE_KEY = "batchData";
    const APPROVED_POOL_KEY = "approvedPool";

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
        } catch (error) { return []; }
    }

    function saveStorage(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; }
        catch (error) { return false; }
    }

    let requirements = [];

    function loadRequirements() {
        requirements = readStorage(REQUIREMENT_STORAGE_KEY);
    }

    function getStatusBadge(status) {
        const map = {
            pending: { label: "Pending", cls: "bg-warning text-dark" },
            completed: { label: "Completed", cls: "bg-success" },
            partial: { label: "Partial", cls: "bg-info" }
        };
        const s = map[status] || map.pending;
        return `<span class="badge ${s.cls}">${s.label}</span>`;
    }

    function renderRequirements() {
        const container = $("#requirementCardsContainer");
        container.empty();

        const activeReqs = requirements.filter(r => r.status !== "completed");

        if (!activeReqs.length) {
            container.html(`
                <div class="col-12">
                    <div class="card custom-card">
                        <div class="card-body text-center text-muted py-5">
                            <i class="bx bx-info-circle fs-2 d-block mb-2"></i>
                            No pending requirements.
                        </div>
                    </div>
                </div>
            `);
            return;
        }

        activeReqs.forEach(req => {
            const photo = req.photo || "";
            const missingItems = Array.isArray(req.missingItems) ? req.missingItems : [];
            const itemAvailability = req.itemAvailability || {};

            let itemsHtml = "";
            missingItems.forEach((item) => {
                const isReceived = itemAvailability[item] === "yes";
                itemsHtml += `
                    <label class="req-item-row ${isReceived ? 'received' : ''}"
                           data-req-id="${req.id}"
                           data-item="${escapeHtml(item)}">
                        <input type="checkbox" class="req-item-check"
                               ${isReceived ? "checked" : ""}
                               data-req-id="${req.id}"
                               data-item="${escapeHtml(item)}">
                        <span class="req-item-name">${escapeHtml(item)}</span>
                        ${isReceived
                            ? `<span class="req-received-badge ms-auto">Received</span>`
                            : `<span class="req-missing-badge ms-auto">Missing</span>`}
                    </label>
                `;
            });

            const photoHtml = photo
                ? `<img src="${escapeHtml(photo)}" alt="Photo" class="req-photo" onerror="this.style.display='none';">`
                : `<div class="req-photo bg-light d-flex align-items-center justify-content-center"><i class="bx bx-image text-muted"></i></div>`;

            container.append(`
                <div class="col-xl-6 col-lg-6 col-md-12 mb-3">
                    <div class="card custom-card h-100 requirement-card" data-req-id="${req.id}">
                        <div class="card-body">

                            <div class="d-flex gap-3 mb-3">
                                ${photoHtml}
                                <div class="flex-grow-1">
                                    <div class="d-flex justify-content-between align-items-start mb-1">
                                        <h6 class="mb-0">${escapeHtml(req.requirementId || "-")}</h6>
                                        ${getStatusBadge(req.status)}
                                    </div>
                                    <div class="small text-muted">
                                        <div><strong>Batch ID:</strong> <span class="text-dark fw-semibold">${escapeHtml(req.batchId || "-")}</span></div>
                                        <div><strong>Brand:</strong> ${escapeHtml(req.brand || "-")}</div>
                                        <div><strong>Design:</strong> ${escapeHtml(req.designNumber || "-")} • <strong>Color:</strong> ${escapeHtml(req.color || "-")}</div>
                                        <div><strong>Piece:</strong> ${escapeHtml(req.pieceNumber || "-")} (${escapeHtml(req.pieceItem || "-")})</div>
                                    </div>
                                </div>
                            </div>

                            <div class="mb-2">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="fw-semibold small">Missing Items (${missingItems.length})</span>
                                    <small class="text-muted">Tick when received</small>
                                </div>
                                <div class="border rounded" style="max-height: 220px; overflow-y: auto;">
                                    ${itemsHtml || '<div class="text-muted small p-2">No items</div>'}
                                </div>
                            </div>

                            <div class="d-flex gap-2 mt-3">
                                <button class="btn btn-success btn-sm flex-fill req-merge-pass-btn" data-req-id="${req.id}" disabled>
                                    <i class="bx bx-check-circle me-1"></i> Merge & Pass to Cutting
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            `);
        });

        // Check merge buttons on load
        activeReqs.forEach(r => checkMergeButton(r.id));
    }

    function checkMergeButton(reqId) {
        const req = requirements.find(r => Number(r.id) === Number(reqId));
        if (!req) return;

        const missing = Array.isArray(req.missingItems) ? req.missingItems : [];
        const availability = req.itemAvailability || {};

        const allReceived = missing.length > 0 && missing.every(item => availability[item] === "yes");

        const $btn = $(`.req-merge-pass-btn[data-req-id="${reqId}"]`);
        $btn.prop("disabled", !allReceived);
    }

    /* EVENT: Item check toggle */
    $(document).on("change", ".req-item-check", function () {
        const reqId = Number($(this).data("req-id"));
        const item = $(this).data("item");
        const checked = $(this).is(":checked");

        const req = requirements.find(r => Number(r.id) === reqId);
        if (!req) return;

        if (!req.itemAvailability) req.itemAvailability = {};
        req.itemAvailability[item] = checked ? "yes" : "no";

        saveStorage(REQUIREMENT_STORAGE_KEY, requirements);

        const $row = $(this).closest(".req-item-row");
        $row.toggleClass("received", checked);
        $row.find(".req-missing-badge, .req-received-badge").remove();
        if (checked) {
            $row.append('<span class="req-received-badge ms-auto">Received</span>');
        } else {
            $row.append('<span class="req-missing-badge ms-auto">Missing</span>');
        }

        checkMergeButton(reqId);
    });

    /* EVENT: Merge & Pass */
    $(document).on("click", ".req-merge-pass-btn", function () {
        const reqId = Number($(this).data("req-id"));
        mergeAndPass(reqId);
    });

    function mergeAndPass(reqId) {
        const reqIndex = requirements.findIndex(r => Number(r.id) === reqId);
        if (reqIndex === -1) return;

        const req = requirements[reqIndex];
        const missing = Array.isArray(req.missingItems) ? req.missingItems : [];

        if (!missing.length) return;

        Swal.fire({
            title: "Merge & Pass?",
            html: `
                <div class="text-start">
                    <p><strong>Batch:</strong> ${escapeHtml(req.batchId)}</p>
                    <p><strong>Piece:</strong> ${escapeHtml(req.pieceNumber)} (${escapeHtml(req.pieceItem)})</p>
                    <p>All <strong>${missing.length}</strong> items are now received.</p>
                    <p class="text-success">These will merge with batch piece and pass to <strong>Cutting Manager</strong>.</p>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Yes, Merge & Pass",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#198754"
        }).then(function (result) {
            if (!result.isConfirmed) return;

            // Combine materials + missing items
            const baseMaterials = Array.isArray(req.materials) ? req.materials : [];
            const allItems = [...new Set([...baseMaterials, ...missing])];

            // Push to approvedPool
            const pool = readStorage(APPROVED_POOL_KEY);
            const nextId = pool.length ? Math.max(...pool.map(p => Number(p.id) || 0)) + 1 : 1;

            const entry = {
                id: nextId,
                batchId: req.batchId,
                bomId: req.bomId || "",
                brand: req.brand,
                designNumber: req.designNumber,
                color: req.color,
                pieceNumber: req.pieceNumber,
                pieceItem: req.pieceItem,
                quantity: req.quantity,
                priority: req.priority || "Medium",
                photo: req.photo || "",
                availableItems: allItems,
                materials: allItems,
                additionalWorks: req.additionalWorks || [],
                fromRequirement: req.requirementId,
                mode: "merged",
                status: "pending_cutting",
                createdAt: new Date().toLocaleString("en-GB")
            };

            pool.push(entry);
            saveStorage(APPROVED_POOL_KEY, pool);

            // Mark requirement completed
            requirements[reqIndex] = {
                ...req,
                status: "completed",
                completedAt: new Date().toLocaleString("en-GB")
            };
            saveStorage(REQUIREMENT_STORAGE_KEY, requirements);

            // Update batch piece status
            updateBatchPieceStatus(req);

            renderRequirements();

            Swal.fire({
                icon: "success",
                title: "Merged & Passed",
                html: `
                    <p>All items received and passed to <strong>Cutting Manager</strong>.</p>
                    <p class="small text-muted">Batch: ${escapeHtml(req.batchId)} • Piece: ${escapeHtml(req.pieceNumber)}</p>
                `,
                showCancelButton: true,
                confirmButtonText: "Open Cutting Manager",
                cancelButtonText: "Close"
            }).then(function (r) {
                if (r.isConfirmed) window.location.href = "cutting-manager";
            });
        });
    }

    function updateBatchPieceStatus(req) {
        const batchData = readStorage(BATCH_STORAGE_KEY);
        const bIdx = batchData.findIndex(b => String(b.batchId) === String(req.batchId));
        if (bIdx === -1) return;

        const batch = batchData[bIdx];
        const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];
        const pieceIdx = pieces.findIndex(p => Number(p.number) === Number(req.pieceNumber));
        if (pieceIdx === -1) return;

        const piece = pieces[pieceIdx];
        const availability = req.itemAvailability || {};

        pieces[pieceIdx] = {
            ...piece,
            approval: {
                ...(piece.approval || {}),
                status: "approved",
                itemAvailability: availability,
                missingItems: [],
                mergedAt: new Date().toLocaleString("en-GB")
            }
        };

        batchData[bIdx] = { ...batch, pieces };
        saveStorage(BATCH_STORAGE_KEY, batchData);
    }

    $("#refreshReqBtn").on("click", function () {
        loadRequirements();
        renderRequirements();
        Swal.fire({ icon: "success", title: "Refreshed", timer: 1000, showConfirmButton: false });
    });

    loadRequirements();
    renderRequirements();
});