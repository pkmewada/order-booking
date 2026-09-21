$(document).ready(function () {
    "use strict";

    const REQUIREMENT_STORAGE_KEY = "requirementData";
    const BATCH_STORAGE_KEY = "batchData";
    const APPROVED_BATCH_STORAGE_KEY = "approvedBatchData";
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

    /* ============================================================
     * CORE: Build merged availability from all sources
     * Rule: "yes" is STICKY (never overwritten by "no")
     * ============================================================ */
    function buildMergedAvailability(pieceAvailability, batchId, pieceNumber, fullMaterials, extraOverrides) {
        const merged = {};

        // From piece's current stored availability
        Object.entries(pieceAvailability || {}).forEach(([k, v]) => {
            if (v === "yes") merged[k] = "yes";
            else if (merged[k] === undefined) merged[k] = v;
        });

        // From ALL requirements (past + present)
        const allReqs = readStorage(REQUIREMENT_STORAGE_KEY).filter(r =>
            String(r.batchId) === String(batchId) &&
            Number(r.pieceNumber) === Number(pieceNumber)
        );
        allReqs.forEach(r => {
            Object.entries(r.itemAvailability || {}).forEach(([k, v]) => {
                if (v === "yes") merged[k] = "yes";
                else if (v === "no" && merged[k] !== "yes") merged[k] = "no";
            });
        });

        // Overrides
        Object.entries(extraOverrides || {}).forEach(([k, v]) => {
            if (v === "yes") merged[k] = "yes";
            else if (merged[k] !== "yes") merged[k] = "no";
        });

        // Fill missing with "no"
        fullMaterials.forEach(m => {
            if (merged[m] === undefined) merged[m] = "no";
        });

        return merged;
    }

    function getPieceFullMaterials(batchId, pieceNumber, reqMaterials) {
        let full = [];
        const approvedBatchData = readStorage(APPROVED_BATCH_STORAGE_KEY);
        const bIdx = approvedBatchData.findIndex(b => String(b.batchId) === String(batchId));
        if (bIdx !== -1) {
            const batch = approvedBatchData[bIdx];
            const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];
            const pieceIdx = pieces.findIndex(p => Number(p.number) === Number(pieceNumber));
            if (pieceIdx !== -1 && Array.isArray(pieces[pieceIdx].materials) && pieces[pieceIdx].materials.length) {
                full = [...pieces[pieceIdx].materials];
            }
        }
        if (!full.length && Array.isArray(reqMaterials)) full = [...reqMaterials];
        return full;
    }

    /**
     * Apply merged availability to the piece in both storages.
     * Recompute status: all yes → pass; some yes → in_progress; none → pending.
     */
    function applyMergedToPiece(batchId, pieceNumber, mergedAvailability, fullMaterials) {
        const yesCount = fullMaterials.filter(m => mergedAvailability[m] === "yes").length;

        let newStatus;
        if (fullMaterials.length > 0 && yesCount === fullMaterials.length) newStatus = "pass";
        else if (yesCount > 0) newStatus = "in_progress";
        else newStatus = "pending";

        [APPROVED_BATCH_STORAGE_KEY, BATCH_STORAGE_KEY].forEach(key => {
            const batchData = readStorage(key);
            const bIdx = batchData.findIndex(b => String(b.batchId) === String(batchId));
            if (bIdx === -1) return;

            const batch = batchData[bIdx];
            const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];
            const pieceIdx = pieces.findIndex(p => Number(p.number) === Number(pieceNumber));
            if (pieceIdx === -1) return;

            const piece = pieces[pieceIdx];
            const approval = piece.approval || {};

            const finalMaterials = fullMaterials.length
                ? fullMaterials
                : (Array.isArray(piece.materials) && piece.materials.length ? piece.materials : []);

            pieces[pieceIdx] = {
                ...piece,
                materials: finalMaterials,
                approval: {
                    ...approval,
                    status: newStatus,
                    itemAvailability: mergedAvailability,
                    availableItems: finalMaterials.filter(m => mergedAvailability[m] === "yes"),
                    missingItems: finalMaterials.filter(m => mergedAvailability[m] !== "yes"),
                    syncedAt: new Date().toLocaleString("en-GB")
                }
            };

            batchData[bIdx] = { ...batch, pieces };
            saveStorage(key, batchData);
        });
    }

    function syncRequirementTickToBatch(req, item, checked) {
        const fullMaterials = getPieceFullMaterials(req.batchId, req.pieceNumber, req.materials);

        const merged = buildMergedAvailability(
            null, // Don't pass piece availability directly — buildMerged reads from storage if needed
            req.batchId,
            req.pieceNumber,
            fullMaterials,
            { [item]: checked ? "yes" : "no" }
        );

        // Also merge from piece's own stored availability
        const approvedBatchData = readStorage(APPROVED_BATCH_STORAGE_KEY);
        const bIdx = approvedBatchData.findIndex(b => String(b.batchId) === String(req.batchId));
        if (bIdx !== -1) {
            const batch = approvedBatchData[bIdx];
            const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];
            const pieceIdx = pieces.findIndex(p => Number(p.number) === Number(req.pieceNumber));
            if (pieceIdx !== -1) {
                const pieceAvail = pieces[pieceIdx].approval?.itemAvailability || {};
                Object.entries(pieceAvail).forEach(([k, v]) => {
                    if (v === "yes") merged[k] = "yes";
                    else if (merged[k] !== "yes" && merged[k] === undefined) merged[k] = v;
                });
            }
        }

        // Ensure full materials all have a value
        fullMaterials.forEach(m => {
            if (merged[m] === undefined) merged[m] = "no";
        });

        applyMergedToPiece(req.batchId, req.pieceNumber, merged, fullMaterials);
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

    /* ============== CHECKBOX TOGGLE ============== */
    $(document).on("change", ".req-item-check", function () {
        const reqId = Number($(this).data("req-id"));
        const item = $(this).data("item");
        const checked = $(this).is(":checked");

        const req = requirements.find(r => Number(r.id) === reqId);
        if (!req) return;

        if (!req.itemAvailability) req.itemAvailability = {};
        req.itemAvailability[item] = checked ? "yes" : "no";

        const missing = Array.isArray(req.missingItems) ? req.missingItems : [];
        const receivedCount = missing.filter(m => req.itemAvailability[m] === "yes").length;

        if (receivedCount === missing.length && missing.length > 0) {
            req.status = "pending";
        } else if (receivedCount > 0) {
            req.status = "partial";
        } else {
            req.status = "pending";
        }

        saveStorage(REQUIREMENT_STORAGE_KEY, requirements);

        // Sync to piece
        syncRequirementTickToBatch(req, item, checked);

        const $row = $(this).closest(".req-item-row");
        $row.toggleClass("received", checked);
        $row.find(".req-missing-badge, .req-received-badge").remove();
        if (checked) {
            $row.append('<span class="req-received-badge ms-auto">Received</span>');
        } else {
            $row.append('<span class="req-missing-badge ms-auto">Missing</span>');
        }

        const $card = $(`.requirement-card[data-req-id="${reqId}"]`);
        $card.find(".badge").replaceWith(getStatusBadge(req.status));

        checkMergeButton(reqId);
    });

    /* ============== MERGE AND PASS ============== */
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

            /* ---- STEP 1: Full material list ---- */
            const trueFullMaterials = getPieceFullMaterials(req.batchId, req.pieceNumber, req.materials);

            /* ---- STEP 2: Build merged availability with overrides ---- */
            const overrides = {};
            receivedItems.forEach(m => { overrides[m] = "yes"; });
            remainingItems.forEach(m => { overrides[m] = "no"; });

            // Read piece's current availability
            const approvedBatchData = readStorage(APPROVED_BATCH_STORAGE_KEY);
            const bIdx = approvedBatchData.findIndex(b => String(b.batchId) === String(req.batchId));
            let pieceAvailability = {};
            if (bIdx !== -1) {
                const batch = approvedBatchData[bIdx];
                const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];
                const pieceIdx = pieces.findIndex(p => Number(p.number) === Number(req.pieceNumber));
                if (pieceIdx !== -1) pieceAvailability = pieces[pieceIdx].approval?.itemAvailability || {};
            }

            const finalAvailability = buildMergedAvailability(
                pieceAvailability,
                req.batchId,
                req.pieceNumber,
                trueFullMaterials,
                overrides
            );

            const availableItems = trueFullMaterials.filter(m => finalAvailability[m] === "yes");

            /* ---- STEP 3: Push to Cutting pool ---- */
            const pool = readStorage(APPROVED_POOL_KEY);
            const existingIdx = pool.findIndex(p =>
                String(p.batchId) === String(req.batchId) &&
                Number(p.pieceNumber) === Number(req.pieceNumber)
            );

            if (existingIdx !== -1) {
                const prev = pool[existingIdx];
                const mergedAvail = { ...(prev.itemAvailability || {}) };
                Object.entries(finalAvailability).forEach(([k, v]) => {
                    if (v === "yes") mergedAvail[k] = "yes";
                    else if (mergedAvail[k] !== "yes") mergedAvail[k] = "no";
                });
                const mergedMaterials = [...new Set([...(prev.materials || []), ...trueFullMaterials])];
                const mergedAvailable = mergedMaterials.filter(m => mergedAvail[m] === "yes");

                pool[existingIdx] = {
                    ...prev,
                    materials: mergedMaterials,
                    itemAvailability: mergedAvail,
                    availableItems: mergedAvailable,
                    mode: "pass",
                    status: "pending_cutting",
                    updatedAt: new Date().toLocaleString("en-GB")
                };
            } else {
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
                    availableItems: availableItems,
                    materials: trueFullMaterials,
                    itemAvailability: finalAvailability,
                    additionalWorks: req.additionalWorks || [],
                    fromRequirement: req.requirementId,
                    mode: "pass",
                    status: "pending_cutting",
                    createdAt: new Date().toLocaleString("en-GB")
                });
            }
            saveStorage(APPROVED_POOL_KEY, pool);

            /* ---- STEP 4: Update requirement ---- */
            if (isPartial) {
                // Keep partial requirement active with remaining items
                requirements[reqIndex] = {
                    ...req,
                    missingItems: remainingItems,
                    itemAvailability: remainingItems.reduce((acc, m) => {
                        acc[m] = finalAvailability[m] || "no";
                        return acc;
                    }, {}),
                    status: "in_progress",
                    updatedAt: new Date().toLocaleString("en-GB")
                };
            } else {
                // CRITICAL: DO NOT DELETE - keep in storage so its history
                // is available for future merges. Just mark completed.
                requirements[reqIndex] = {
                    ...req,
                    // Keep the ORIGINAL missingItems list so merge logic can use it
                    missingItems: [...missing],
                    itemAvailability: { ...finalAvailability },
                    status: "completed",
                    completedAt: new Date().toLocaleString("en-GB")
                };
            }
            saveStorage(REQUIREMENT_STORAGE_KEY, requirements);

            /* ---- STEP 5: Apply merged state to piece ---- */
            applyMergedToPiece(req.batchId, req.pieceNumber, finalAvailability, trueFullMaterials);

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

    $("#refreshReqBtn").on("click", function () {
        loadRequirements();
        renderRequirements();
        Swal.fire({ icon: "success", title: "Refreshed", timer: 1000, showConfirmButton: false });
    });

    window.addEventListener("focus", function () {
        loadRequirements();
        renderRequirements();
    });

    setInterval(function () {
        const prev = JSON.stringify(requirements);
        loadRequirements();
        const now = JSON.stringify(requirements);
        if (prev !== now) renderRequirements();
    }, 1500);

    loadRequirements();
    renderRequirements();
});