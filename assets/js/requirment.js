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
            partial: { label: "Partial", cls: "bg-info" },
            in_progress: { label: "In Progress", cls: "bg-primary" }
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
                                    <i class="bx bx-check-circle me-1"></i> Pass to Cutting
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            `);
        });

        activeReqs.forEach(r => checkMergeButton(r.id));
    }

    function checkMergeButton(reqId) {
        const req = requirements.find(r => Number(r.id) === Number(reqId));
        if (!req) return;

        const missing = Array.isArray(req.missingItems) ? req.missingItems : [];
        const availability = req.itemAvailability || {};

        const receivedCount = missing.filter(item => availability[item] === "yes").length;
        const atLeastOne = receivedCount > 0;

        const $btn = $(`.req-merge-pass-btn[data-req-id="${reqId}"]`);
        $btn.prop("disabled", !atLeastOne);

        if (receivedCount === missing.length && missing.length > 0) {
            $btn.html('<i class="bx bx-check-circle me-1"></i> Pass to Cutting (All Received)');
        } else if (atLeastOne) {
            $btn.html('<i class="bx bx-right-arrow-alt me-1"></i> Pass Received & Keep Remaining');
        } else {
            $btn.html('<i class="bx bx-check-circle me-1"></i> Pass to Cutting');
        }
    }

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

    $(document).on("click", ".req-merge-pass-btn", function () {
        const reqId = Number($(this).data("req-id"));
        mergeAndPass(reqId);
    });

    function mergeAndPass(reqId) {
        const reqIndex = requirements.findIndex(r => Number(r.id) === reqId);
        if (reqIndex === -1) return;

        const req = requirements[reqIndex];
        const missing = Array.isArray(req.missingItems) ? req.missingItems : [];
        const availability = req.itemAvailability || {};

        const receivedItems = missing.filter(i => availability[i] === "yes");
        const remainingItems = missing.filter(i => availability[i] !== "yes");
        const isPartial = remainingItems.length > 0;

        if (!receivedItems.length) return;

        let htmlText = `
            <div class="text-start">
                <p><strong>Batch:</strong> ${escapeHtml(req.batchId)}</p>
                <p><strong>Piece:</strong> ${escapeHtml(req.pieceNumber)} (${escapeHtml(req.pieceItem)})</p>
                <hr>
                <p class="text-success"><strong>${receivedItems.length} items received</strong> → Pass to Cutting</p>
        `;
        if (isPartial) {
            htmlText += `<p class="text-warning"><strong>${remainingItems.length} items still missing</strong> → Stay in Requirement</p>`;
        } else {
            htmlText += `<p class="text-success">All items received! Full pass.</p>`;
        }
        htmlText += `</div>`;

        Swal.fire({
            title: isPartial ? "Pass Partial?" : "Pass All?",
            html: htmlText,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: isPartial ? "Yes, Pass Partial" : "Yes, Pass All",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#198754"
        }).then(function (result) {
            if (!result.isConfirmed) return;

            const baseMaterials = Array.isArray(req.materials) ? req.materials : [];

            // ---- Build the FINAL full availability map for this piece ----
            // Start with what's saved (checked = yes, unchecked = no)
            // Then override: every receivedItem → yes; every remainingItem → no
            const finalAvailability = { ...(req.itemAvailability || {}) };
            receivedItems.forEach(m => { finalAvailability[m] = "yes"; });
            remainingItems.forEach(m => { finalAvailability[m] = "no"; });

            // Available = every material where availability == yes
            const finalAvailableItems = baseMaterials.filter(m => finalAvailability[m] === "yes");

            const pool = readStorage(APPROVED_POOL_KEY);

            // Find existing pool entry for THIS piece only
            const existingIdx = pool.findIndex(p =>
                String(p.batchId) === String(req.batchId) &&
                Number(p.pieceNumber) === Number(req.pieceNumber)
            );

            if (existingIdx !== -1) {
                // Merge into existing pool entry for this piece
                const existingEntry = pool[existingIdx];
                const mergedMaterials = [...new Set([...(existingEntry.materials || []), ...baseMaterials])];
                const mergedAvailability = { ...(existingEntry.itemAvailability || {}), ...finalAvailability };
                const mergedAvailable = mergedMaterials.filter(m => mergedAvailability[m] === "yes");

                pool[existingIdx] = {
                    ...existingEntry,
                    materials: mergedMaterials,
                    itemAvailability: mergedAvailability,
                    availableItems: mergedAvailable,
                    mode: "pass",
                    status: "pending_cutting",
                    updatedAt: new Date().toLocaleString("en-GB")
                };
            } else {
                // Create new pool entry for this piece
                const nextId = pool.length ? Math.max(...pool.map(p => Number(p.id) || 0)) + 1 : 1;

                pool.push({
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
                    availableItems: finalAvailableItems,
                    materials: baseMaterials.length ? baseMaterials : finalAvailableItems,
                    itemAvailability: finalAvailability,
                    additionalWorks: req.additionalWorks || [],
                    fromRequirement: req.requirementId,
                    mode: "pass",
                    status: "pending_cutting",
                    createdAt: new Date().toLocaleString("en-GB")
                });
            }

            saveStorage(APPROVED_POOL_KEY, pool);

            // ---- Update requirement ----
            if (isPartial) {
                // Remove received items from requirement, keep remaining
                requirements[reqIndex] = {
                    ...req,
                    missingItems: remainingItems,
                    // Keep availability map for remaining items only
                    itemAvailability: remainingItems.reduce((acc, m) => {
                        acc[m] = finalAvailability[m] || "no";
                        return acc;
                    }, {}),
                    status: "in_progress",
                    updatedAt: new Date().toLocaleString("en-GB")
                };
            } else {
                requirements[reqIndex] = {
                    ...req,
                    status: "completed",
                    completedAt: new Date().toLocaleString("en-GB")
                };
            }
            saveStorage(REQUIREMENT_STORAGE_KEY, requirements);

            // ---- Update batch piece status ----
            updateBatchPieceStatus(req, isPartial, remainingItems, finalAvailability);

            renderRequirements();

            Swal.fire({
                icon: "success",
                title: isPartial ? "Partial Passed" : "Passed",
                html: isPartial
                    ? `<p><strong>${receivedItems.length}</strong> items passed to Cutting.</p><p><strong>${remainingItems.length}</strong> items still in Requirement.</p>`
                    : `<p>All items received and passed to <strong>Cutting Manager</strong>.</p>`,
                showCancelButton: true,
                confirmButtonText: "Open Cutting Manager",
                cancelButtonText: "Close"
            }).then(function (r) { if (r.isConfirmed) window.location.href = "cutting-manager"; });
        });
    }

    function updateBatchPieceStatus(req, isPartial, remainingItems, finalAvailability) {
        const batchData = readStorage(BATCH_STORAGE_KEY);
        const bIdx = batchData.findIndex(b => String(b.batchId) === String(req.batchId));
        if (bIdx === -1) return;

        const batch = batchData[bIdx];
        const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];
        const pieceIdx = pieces.findIndex(p => Number(p.number) === Number(req.pieceNumber));
        if (pieceIdx === -1) return;

        const piece = pieces[pieceIdx];

        pieces[pieceIdx] = {
            ...piece,
            approval: {
                ...(piece.approval || {}),
                status: isPartial ? "in_progress" : "pass",
                itemAvailability: finalAvailability,
                missingItems: isPartial ? remainingItems : [],
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