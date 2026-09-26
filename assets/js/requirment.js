$(document).ready(async function () {
    "use strict";
    try { await Production.initialize(); } catch(error) { Swal.fire({icon:"error",title:"Recovery required",text:error.message}); return; }

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
     * MERGED availability — "yes" is sticky
     * ============================================================ */
    function buildMergedAvailability(pieceAvailability, batchId, pieceNumber, fullMaterials, extraOverrides) {
        const merged = {};
        Object.entries(pieceAvailability || {}).forEach(([k, v]) => {
            if (v === "yes") merged[k] = "yes";
            else if (merged[k] === undefined) merged[k] = v;
        });
        const allReqs = readStorage(REQUIREMENT_STORAGE_KEY).filter(r =>
            String(r.batchId) === String(batchId) &&
            Number(r.pieceNumber) === Number(pieceNumber)
        );
        allReqs.forEach(r => {
            Object.entries(r.itemAvailability || {}).forEach(([k, v]) => {
                if (v === "yes") merged[k] = "yes";
                else if (v === "no" && merged[k] !== "yes") merged[k] = "no";
            });
            (r.missingItems || []).forEach(m => {
                if (merged[m] === undefined) merged[m] = "no";
            });
        });
        Object.entries(extraOverrides || {}).forEach(([k, v]) => {
            if (v === "yes") merged[k] = "yes";
            else if (merged[k] !== "yes") merged[k] = "no";
        });
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
                                    <i class="bx bx-check-circle me-1"></i> Pass to Next Stage
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
            $btn.html('<i class="bx bx-check-circle me-1"></i> Pass to Next Stage (All Received)');
        } else if (atLeastOne) {
            $btn.html('<i class="bx bx-right-arrow-alt me-1"></i> Pass Received & Keep Remaining');
        } else {
            $btn.html('<i class="bx bx-check-circle me-1"></i> Pass to Next Stage');
        }
    }

    /* ============== CHECKBOX TOGGLE ============== */
    $(document).on("change", ".req-item-check", async function () {
        const id=Number($(this).data("req-id")), material=$(this).data("item"), checked=$(this).is(":checked");
        try { await Production.tickRequirement(id,material,checked); loadRequirements(); renderRequirements(); }
        catch(error) { Swal.fire({icon:"error",title:"Requirement update cancelled",text:error.message}); loadRequirements(); renderRequirements(); }
    });

    /* ============== MERGE AND PASS ============== */
    $(document).on("click", ".req-merge-pass-btn", function () {
        const reqId = Number($(this).data("req-id"));
        mergeAndPass(reqId);
    });

    function mergeAndPass(reqId) {
        Swal.fire({ title: "Confirm received materials?", icon: "question", showCancelButton: true }).then(async result => {
            if (!result.isConfirmed) return;
            try { await Production.receiveRequirement(reqId); loadRequirements(); renderRequirements(); }
            catch(error) { Swal.fire({icon:"error",title:"Requirement update cancelled",text:error.message}); }
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