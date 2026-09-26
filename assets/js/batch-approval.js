$(document).ready(async function () {
    "use strict";
    try { await Production.initialize(); } catch(error) { Swal.fire({icon:"error",title:"Recovery required",text:error.message}); return; }

    const BATCH_STORAGE_KEY = "batchData";
    const REQUIREMENT_STORAGE_KEY = "requirementData";
    const APPROVED_POOL_KEY = "approvedPool";
    const APPROVED_BATCH_STORAGE_KEY = "approvedBatchData";

    const PLACEHOLDER_IMG =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
            '<rect width="100%" height="100%" fill="#f1f3f8"/>' +
            '<text x="50%" y="55%" font-family="Arial" font-size="11" fill="#9aa6c2" text-anchor="middle">No Image</text>' +
            '</svg>'
        );



    let batchData = [];
    let currentBatchId = null;

    const approvalModalElement = document.getElementById("approvalModal");
    const approvalModal = new bootstrap.Modal(approvalModalElement);

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
        } catch (error) { return []; }
    }
    function saveStorage(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; }
        catch (error) { return false; }
    }
    function normalize(value) { return String(value ?? "").trim().toLowerCase(); }

    function getPriorityClass(priority) {
        const p = normalize(priority);
        if (p === "high") return "priority-high";
        if (p === "medium") return "priority-medium";
        if (p === "low") return "priority-low";
        return "";
    }

    function statusText(status) {
        const map = {
            pending: { label: "Pending", cls: "pending" },
            in_progress: { label: "Pass", cls: "requirements_pending" },
            pass: { label: "Pass", cls: "pass" },
            stopped: { label: "Stopped", cls: "stopped" }
        };
        const s = map[status] || map.pending;
        return `<span class="status-badge ${s.cls}">${s.label}</span>`;
    }

    function showMessage(type, message) {
        Swal.fire({ icon: type === "danger" ? "error" : type, text: message, confirmButtonColor: "#161617" });
    }

    function getPieceNumber(piece, index) { return Number(piece?.number) || index + 1; }
    function getPieceItem(piece) { return String(piece?.item || "").trim(); }

    function getPieceMaterials(piece) {
        let materials = piece?.materials || [];
        if (typeof materials === "string") materials = materials.split(",").map(s => s.trim()).filter(Boolean);
        if (!Array.isArray(materials)) return [];
        return [...new Set(materials.map(m => String(m).trim()).filter(Boolean))];
    }

    function getPieceWorks(piece) {
        let works = piece?.additionalWorks || [];
        if (!Array.isArray(works)) return [];
        return works.map(w => ({
            workType: String(w?.workType || "").trim(),
            stage: String(w?.stage || "").trim()
        })).filter(w => w.workType || w.stage);
    }

    function getPieceStatus(piece) { return piece?.approval?.status || "pending"; }
    function isPieceLocked(piece) { return !!(piece?.approval?.locked); }
    function isPieceStopped(piece) { return !!(piece?.approval?.stopped); }
    function isBatchStopped(batch) { return !!(batch?.stopped); }

    /* ============================================================
       BUILD PIECE ROUTE
       ============================================================ */
    function buildPieceRoute(piece) {
        return Production.buildRoute(piece);
    }

    /* ============================================================
       MERGED availability
       ============================================================ */
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

    function deriveStatus(mergedAvailability, fullMaterials) {
        if (!fullMaterials.length) return "pending";
        const yesCount = fullMaterials.filter(m => mergedAvailability[m] === "yes").length;
        if (yesCount === fullMaterials.length) return "pass";
        if (yesCount > 0) return "in_progress";
        return "pending";
    }

    function normalizeBatchPieces() { /* Approval status is committed with its requirement transaction. */ }

    function loadData() {
        let approved = readStorage(APPROVED_BATCH_STORAGE_KEY);
        if (approved.length) { batchData = approved; }
        else {
            const mainBatch = readStorage(BATCH_STORAGE_KEY);
            batchData = mainBatch.filter(b => b.status === "approved");
        }
        normalizeBatchPieces();
    }

    /* ================= TABLE ================= */
    function renderTable() {
        loadData();
        const tbody = $("#approvalTableBody");
        tbody.empty();
        const statusFilter = normalize($("#approvalStatusFilter").val());
        const searchTerm = normalize($("#approvalSearchInput").val());

        const filtered = batchData.filter(batch => {
            const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];
            const searchable = [
                batch.batchId, batch.brand, batch.designNumber, batch.color, batch.quantity, batch.priority,
                ...pieces.map(p => [
                    p.item, ...(p.materials || []),
                    ...((p.additionalWorks || []).map(w => `${w.workType} ${w.stage}`))
                ].join(" "))
            ].filter(Boolean).join(" ");
            if (statusFilter) {
                if (statusFilter === "stopped") {
                    if (!isBatchStopped(batch)) return false;
                } else {
                    const anyMatch = pieces.some(p => normalize(getPieceStatus(p)) === statusFilter);
                    if (!anyMatch) return false;
                }
            }
            return (!searchTerm || normalize(searchable).includes(searchTerm));
        });

        if (!filtered.length) {
            tbody.html(`<tr><td colspan="10" class="text-center text-muted py-4"><i class="bx bx-info-circle me-1"></i> No approved batches found.</td></tr>`);
            return;
        }

        filtered.forEach(batch => {
            const pieces = Array.isArray(batch.pieces) && batch.pieces.length
                ? batch.pieces
                : [{ number: 1, item: batch.piece || "", materials: batch.itemList || [], additionalWorks: [] }];
            const photoSrc = batch.photo ? escapeHtml(batch.photo) : PLACEHOLDER_IMG;
            const batchStopped = isBatchStopped(batch);
            let pieceTypeHtml = "";
            let statusHtml = "";

            pieces.forEach((piece, index) => {
                const pieceNumber = getPieceNumber(piece, index);
                const itemName = getPieceItem(piece);
                const pieceStatus = getPieceStatus(piece);
                pieceTypeHtml += `<div class="piece-line"><span class="piece-num">${escapeHtml(pieceNumber)} Piece</span>${itemName ? `<span class="piece-item-text"> (${escapeHtml(itemName)})</span>` : ""}</div>`;
                statusHtml += `<div class="status-line">${statusText(pieceStatus)}</div>`;
            });

            const priorityClass = getPriorityClass(batch.priority);
            let actionHtml = `<div class="action-row"><button type="button" class="btn btn-view-sm open-approval-btn" data-id="${escapeHtml(batch.id)}">View</button>`;
            if (batchStopped) {
                actionHtml += `<button type="button" class="btn btn-resume-icon resume-batch-btn" data-id="${escapeHtml(batch.id)}" title="Resume"><i class="bx bx-play"></i></button>`;
            } else {
                actionHtml += `<button type="button" class="btn btn-stop-icon stop-batch-btn" data-id="${escapeHtml(batch.id)}" title="Stop"><i class="bx bx-stop"></i></button>`;
            }
            actionHtml += `</div>`;

            tbody.append(`
                <tr class="${batchStopped ? 'frozen-row' : ''}">
                    <td><strong>${escapeHtml(batch.batchId || "-")}</strong></td>
                    <td><img src="${photoSrc}" alt="Batch" style="width:55px;height:55px;object-fit:cover;border-radius:6px;" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';"></td>
                    <td>${escapeHtml(batch.brand || "-")}</td>
                    <td>${escapeHtml(batch.designNumber || "-")}</td>
                    <td><span class="color-text">${escapeHtml(batch.color || "-")}</span></td>
                    <td><div class="piece-cell-lines">${pieceTypeHtml}</div></td>
                    <td>${escapeHtml(batch.quantity || "0")}</td>
                    <td><span class="priority-badge ${priorityClass}">${escapeHtml(batch.priority || "-")}</span></td>
                    <td><div class="status-cell-lines">${statusHtml}</div></td>
                    <td class="action-cell">${actionHtml}</td>
                </tr>
            `);
        });
    }

    function getCurrentBatch() {
        return batchData.find(b => String(b.id) === String(currentBatchId));
    }

    /* ================= FLOW CHART ================= */
    function buildFlowNodes(works) {
        return Production.buildRoute({additionalWorks: works || []}).map((r,order) => ({type:r.type === "additional_work" ? "work" : "fixed",label:r.stage,order}));
    }

    function renderFlowChart(batch) {
        const box = $("#batchFlowBox");
        const container = $("#batchFlowChart");
        container.empty();
        const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];
        if (!pieces.length) { box.hide(); return; }

        pieces.forEach(function (piece, index) {
            const pieceNumber = getPieceNumber(piece, index);
            const itemName = getPieceItem(piece);
            const works = getPieceWorks(piece);
            const nodes = buildFlowNodes(works);

            let html = `<div class="mb-3"><div class="d-flex align-items-center gap-2 mb-2"><span class="badge bg-primary">Piece ${escapeHtml(pieceNumber)}</span>${itemName ? `<span class="fw-semibold">${escapeHtml(itemName)}</span>` : ""}</div><div class="batch-flow-track">`;
            nodes.forEach(function (node, i) {
                if (i > 0) html += `<span class="batch-flow-connector"></span>`;
                html += node.type === "fixed"
                    ? `<span class="batch-flow-node batch-fixed-node"><strong>${escapeHtml(node.label)}</strong></span>`
                    : `<span class="batch-flow-node"><strong>${escapeHtml(node.label)}</strong></span>`;
            });
            html += `</div></div>`;
            container.append(html);
        });
        box.show();
    }

    function computeAvailability(pieceNumber, materials, piece) {
        const locked = isPieceLocked(piece);
        const stored = piece?.approval?.itemAvailability || {};
        const availability = {};
        materials.forEach(mat => {
            if (locked) {
                availability[mat] = stored[mat] || "no";
            } else {
                const $row = $(`.item-list-row[data-piece="${pieceNumber}"][data-item="${mat}"]`);
                const checked = $row.find(".piece-item-checkbox").is(":checked");
                availability[mat] = checked ? "yes" : "no";
            }
        });
        return availability;
    }

    /* ================= PIECE CARDS ================= */
    function renderApprovalPieces(batch) {
        const container = $("#approvalPiecesContainer");
        container.empty();
        const pieces = Array.isArray(batch.pieces) && batch.pieces.length
            ? batch.pieces
            : [{ number: 1, item: batch.piece || "", materials: batch.itemList || [], additionalWorks: [] }];

        if (!pieces.length) {
            container.html(`<div class="alert alert-warning">No pieces found for this batch.</div>`);
            return;
        }
        const batchStopped = isBatchStopped(batch);

        pieces.forEach((piece, index) => {
            const pieceNumber = getPieceNumber(piece, index);
            const itemName = getPieceItem(piece);
            const materials = getPieceMaterials(piece);
            const works = getPieceWorks(piece);
            const approval = piece.approval || {};
            const availability = approval.itemAvailability || {};
            const pieceStatus = approval.status || "pending";
            const remarks = approval.remarks || "";
            const locked = isPieceLocked(piece);
            const stopped = isPieceStopped(piece) || batchStopped;

            let itemRows = "";
            if (materials.length) {
                materials.forEach((mat, matIndex) => {
                    const isChecked = availability[mat] === "yes";
                    const chkId = `chk_${pieceNumber}_${matIndex}`;
                    itemRows += `
                        <label class="item-list-row ${isChecked ? "checked-row" : ""}" data-piece="${pieceNumber}" data-item="${escapeHtml(mat)}" for="${chkId}">
                            <input type="checkbox" class="piece-item-checkbox" id="${chkId}" data-piece="${pieceNumber}" data-item="${escapeHtml(mat)}" ${isChecked ? "checked" : ""} ${(locked || stopped) ? "disabled" : ""}>
                            <span class="item-name">${escapeHtml(mat)}</span>
                        </label>
                    `;
                });
            } else {
                itemRows = `<span class="text-muted small">No item list</span>`;
            }

            const worksHtml = works.length
                ? works.map(w => `<div>${escapeHtml(w.workType || "-")}${w.stage ? `<span class="text-muted"> — ${escapeHtml(w.stage)}</span>` : ""}</div>`).join("")
                : `<span class="work-empty">None</span>`;

            const totalMats = materials.length;
            const yesCount = materials.filter(m => availability[m] === "yes").length;
            const noCount = materials.filter(m => availability[m] === "no").length;
            const allYesChecked = totalMats > 0 && yesCount === totalMats;
            const allNoChecked = totalMats > 0 && noCount === totalMats;
            const toggleName = `toggle_${pieceNumber}`;

            container.append(`
                <div class="piece-card ${locked || stopped ? 'locked' : ''}" data-piece="${pieceNumber}">
                    <div class="piece-card-header">
                        <div>
                            <div class="piece-card-title">Piece ${escapeHtml(pieceNumber)}</div>
                            ${itemName ? `<div class="piece-card-item">${escapeHtml(itemName)}</div>` : ""}
                        </div>
                        <div class="piece-card-status">${statusText(stopped && !locked ? "stopped" : pieceStatus)}</div>
                    </div>
                    <div>
                        <div class="small text-muted mb-1" style="font-size:11px;">Additional Work</div>
                        <div class="work-text">${worksHtml}</div>
                    </div>
                    <div>
                        <div class="item-list-top">
                            <span class="item-list-label">Item List</span>
                            <div class="all-toggle" ${(locked || stopped || allYesChecked) ? 'style="display:none;"' : ""}>
                                <input type="radio" name="${toggleName}" id="allYes_${pieceNumber}" class="all-toggle-radio" value="yes" data-piece="${pieceNumber}" ${allYesChecked ? "checked" : ""}>
                                <label for="allYes_${pieceNumber}" class="all-yes-label">All Yes</label>
                                <input type="radio" name="${toggleName}" id="allNo_${pieceNumber}" class="all-toggle-radio" value="no" data-piece="${pieceNumber}" ${allNoChecked ? "checked" : ""}>
                                <label for="allNo_${pieceNumber}" class="all-no-label">All No</label>
                            </div>
                        </div>
                        <div class="item-list-rows">${itemRows}</div>
                    </div>
                    <textarea class="form-control piece-remarks" rows="1" data-piece="${pieceNumber}" placeholder="Remarks..." ${(locked || stopped) ? "readonly" : ""}>${escapeHtml(remarks)}</textarea>
                    <div class="piece-card-actions" data-piece="${pieceNumber}"></div>
                </div>
            `);

            renderPieceActions(pieceNumber, locked, allYesChecked, stopped);
        });

        updateApproveAllState();
    }

    function renderPieceActions(pieceNumber, locked, allYesChecked, stopped) {
        const $actions = $(`.piece-card-actions[data-piece="${pieceNumber}"]`);
        $actions.empty();
        if (locked || stopped) {
            if (stopped && !locked) {
                $actions.html(`<span class="text-muted" style="font-size:10px;"><i class="bx bx-lock-alt me-1"></i>Stopped — no action allowed</span>`);
            }
            return;
        }
        if (allYesChecked) {
            $actions.html(`<button type="button" class="btn btn-success approve-piece-btn" data-piece="${pieceNumber}"><i class="bx bx-check-circle me-1"></i> Approve</button>`);
        } else {
            $actions.html(`
                <button type="button" class="btn approve-piece-btn" data-piece="${pieceNumber}" disabled>
    <i class="bx bx-check-circle me-1"></i> Approve
</button>
                <button type="button" class="btn btn-info confirm-piece-btn" data-piece="${pieceNumber}"><i class="bx bx-time-five me-1"></i> Confirm</button>
                <button type="button" class="btn btn-warning pass-piece-btn" data-piece="${pieceNumber}"><i class="bx bx-right-arrow-alt me-1"></i> Pass</button>
            `);
        }
    }

    function updateApproveAllState() {
        const batch = getCurrentBatch();
        if (!batch) { $("#approveAllBtn").prop("disabled", true); return; }
        if (isBatchStopped(batch)) { $("#approveAllBtn").prop("disabled", true); return; }
        const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];
        let allReady = pieces.length > 0;
        pieces.forEach((piece, index) => {
            if (isPieceLocked(piece) || isPieceStopped(piece)) { allReady = false; return; }
            const pieceNumber = getPieceNumber(piece, index);
            const materials = getPieceMaterials(piece);
            if (!materials.length) { allReady = false; return; }
            const yesCount = materials.filter(m => {
                const $row = $(`.item-list-row[data-piece="${pieceNumber}"][data-item="${m}"]`);
                if ($row.length) return $row.find(".piece-item-checkbox").is(":checked");
                return false;
            }).length;
            if (yesCount !== materials.length) allReady = false;
        });
        $("#approveAllBtn").prop("disabled", !allReady);
    }

    function openApprovalModal(batchId) {
        currentBatchId = batchId;
        loadData();
        const batch = getCurrentBatch();
        if (!batch) return;
        const $photo = $("#approvalPhoto");
        $photo.off("error").on("error", function () { this.onerror = null; this.src = PLACEHOLDER_IMG; });
        $photo.attr("src", batch.photo || PLACEHOLDER_IMG).css("display", "");
        $("#approvalBatchId").text(batch.batchId || "-");
        $("#approvalBrand").text(batch.brand || "-");
        $("#approvalDesignNumber").text(batch.designNumber || "-");
        $("#approvalColor").text(batch.color || "-");
        $("#approvalQuantity").text(batch.quantity || "-");
        $("#approvalPriority").text(batch.priority || "-");
        renderFlowChart(batch);
        renderApprovalPieces(batch);
        approvalModal.show();
    }

    /* ================= CHECKBOX & TOGGLE ================= */
    $(document).on("change", ".piece-item-checkbox", function () {
        const $row = $(this).closest(".item-list-row");
        if ($(this).is(":checked")) $row.addClass("checked-row");
        else $row.removeClass("checked-row");
        const pieceNumber = $(this).data("piece");
        const $card = $(`.piece-card[data-piece="${pieceNumber}"]`);
        if ($card.hasClass("locked")) return;
        const total = $card.find(".piece-item-checkbox").length;
        const checked = $card.find(".piece-item-checkbox:checked").length;
        if (checked === total && total > 0) $card.find(".all-toggle-radio[value='yes']").prop("checked", true);
        else if (checked === 0) $card.find(".all-toggle-radio[value='no']").prop("checked", true);
        else $card.find(".all-toggle-radio").prop("checked", false);
        const allYesChecked = total > 0 && checked === total;
        renderPieceActions(pieceNumber, false, allYesChecked, false);
        updateApproveAllState();
    });

    $(document).on("change", ".all-toggle-radio", function () {
        const pieceNumber = $(this).data("piece");
        const $card = $(`.piece-card[data-piece="${pieceNumber}"]`);
        if ($card.hasClass("locked")) return;
        const val = $(this).val();
        $(`.item-list-row[data-piece="${pieceNumber}"]`).each(function () {
            const $row = $(this);
            const $chk = $row.find(".piece-item-checkbox");
            if (val === "yes") { $chk.prop("checked", true); $row.addClass("checked-row"); }
            else { $chk.prop("checked", false); $row.removeClass("checked-row"); }
        });
        renderPieceActions(pieceNumber, false, val === "yes", false);
        updateApproveAllState();
    });

    /* ================= PUSH TO APPROVED POOL ================= */


    /* ================= CREATE REQUIREMENT ================= */


    /* ================= PROCESS PIECE ================= */
    function processPiece(pieceNumber, mode) {
        const batch = getCurrentBatch();
        if (!batch) return;
        const piece = batch.pieces.find((p,i) => getPieceNumber(p,i) === pieceNumber);
        if (!piece) return;
        const availability = computeAvailability(pieceNumber, getPieceMaterials(piece), piece);
        const remarks = $(`.piece-remarks[data-piece="${pieceNumber}"]`).val() || "";
        Swal.fire({ title: mode === "confirm" ? "Confirm pending requirements?" : "Pass piece?",
            icon: "question", showCancelButton: true, confirmButtonText: "Confirm" }).then(async result => {
            if (!result.isConfirmed) return;
            try {
                await Production.approve(batch.batchId, [{ pieceNumber, mode, availability, remarks }]);
                loadData(); renderTable(); const fresh = getCurrentBatch(); if (fresh) renderApprovalPieces(fresh);
            } catch (error) { Swal.fire({ icon: "error", title: "Approval cancelled", text: error.message }); }
        });
    }

    $(document).on("click", ".approve-piece-btn", function () {
        if ($(this).prop("disabled")) return;
        processPiece(Number($(this).data("piece")), "approve");
    });
    $(document).on("click", ".confirm-piece-btn", function () { processPiece(Number($(this).data("piece")), "confirm"); });
    $(document).on("click", ".pass-piece-btn", function () { processPiece(Number($(this).data("piece")), "pass"); });

    /* ================= APPROVE ALL ================= */
    $(document).on("click", "#approveAllBtn", async function () {
        const batch = getCurrentBatch(); if (!batch) return;
        const requests = batch.pieces.map((piece,i) => ({ piece, pieceNumber: getPieceNumber(piece,i) }))
            .filter(({piece}) => !isPieceLocked(piece) && !isPieceStopped(piece))
            .map(({piece,pieceNumber}) => ({ pieceNumber, mode: "approve", availability: computeAvailability(pieceNumber,getPieceMaterials(piece),piece) }))
            .filter(request => Object.values(request.availability).length && Object.values(request.availability).every(v => v === "yes"));
        if (!requests.length) return;
        const result = await Swal.fire({ title: "Approve all ready pieces?", icon: "question", showCancelButton: true });
        if (!result.isConfirmed) return;
        try { await Production.approve(batch.batchId, requests); loadData(); renderTable(); const fresh=getCurrentBatch(); if(fresh) renderApprovalPieces(fresh); }
        catch(error) { Swal.fire({icon:"error",title:"Approval cancelled",text:error.message}); }
    });

    /* ================= STOP / RESUME BATCH ================= */
    $(document).on("click", ".stop-batch-btn", async function () {
        const id = $(this).data("id");
        const result = await Swal.fire({ title: "Stop this batch?", icon: "question", showCancelButton: true });
        if (!result.isConfirmed) return;
        try { await Production.setBatchStopped(id, true); loadData(); renderTable(); const b=getCurrentBatch(); if(b) renderApprovalPieces(b); }
        catch(error) { Swal.fire({icon:"error",title:"Batch update cancelled",text:error.message}); }
    });

    $(document).on("click", ".resume-batch-btn", async function () {
        const id = $(this).data("id");
        const result = await Swal.fire({ title: "Resume this batch?", icon: "question", showCancelButton: true });
        if (!result.isConfirmed) return;
        try { await Production.setBatchStopped(id, false); loadData(); renderTable(); const b=getCurrentBatch(); if(b) renderApprovalPieces(b); }
        catch(error) { Swal.fire({icon:"error",title:"Batch update cancelled",text:error.message}); }
    });

    /* ================= UPDATE BATCH ================= */


    $(document).on("click", ".open-approval-btn", function () {
        openApprovalModal($(this).data("id"));
    });

    $("#approvalStatusFilter").on("change", renderTable);
    $("#approvalSearchInput").on("keyup", renderTable);

    $("#refreshApprovalBtn").on("click", function () {
        loadData();
        renderTable();
        if (currentBatchId) {
            const b = getCurrentBatch();
            if (b) { renderFlowChart(b); renderApprovalPieces(b); }
        }
        Swal.fire({ icon: "success", title: "Refreshed", timer: 1200, showConfirmButton: false });
    });

    approvalModalElement.addEventListener("show.bs.modal", function () {
        if (!currentBatchId) return;
        loadData();
        const b = getCurrentBatch();
        if (b) { renderFlowChart(b); renderApprovalPieces(b); }
    });

    $("#approvalModal").on("hidden.bs.modal", function () {
        currentBatchId = null;
        $("#approvalPiecesContainer").empty();
        $("#batchFlowChart").empty();
        $("#batchFlowBox").hide();
    });

    window.addEventListener("focus", function () {
        loadData();
        if (currentBatchId) {
            const b = getCurrentBatch();
            if (b) { renderFlowChart(b); renderApprovalPieces(b); }
        }
        renderTable();
    });

    setInterval(function () {
        const prev = JSON.stringify(batchData);
        loadData();
        const now = JSON.stringify(batchData);
        if (prev !== now) {
            if (currentBatchId) {
                const b = getCurrentBatch();
                if (b) { renderFlowChart(b); renderApprovalPieces(b); }
            }
            renderTable();
        }
    }, 1500);

    loadData();
    renderTable();
});