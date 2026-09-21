$(document).ready(function () {
    "use strict";

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

    const FIXED_FLOW_STAGES = ["Cutting", "Stitching", "Ironing"];
    const FLOW_STAGE_ORDER = [
        "Before Cutting", "Cutting", "After Cutting",
        "Before Stitching", "Stitching", "After Stitching",
        "Before Ironing", "Ironing", "After Ironing"
    ];

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

    function statusText(status) {
        const map = {
            pending: { label: "Pending", cls: "pending" },
            in_progress: { label: "In Progress", cls: "in_progress" },
            pass: { label: "Pass", cls: "pass" }
        };
        const s = map[status] || map.pending;
        return `<span class="status-text ${s.cls}">${s.label}</span>`;
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

    /* ============================================================
     * CRITICAL: Build the MERGED availability for a piece from:
     *   1) piece.approval.itemAvailability (current stored state)
     *   2) ALL requirements (completed AND active) for this piece
     *   3) extra overrides
     * Rule: "yes" is STICKY — NEVER overwritten by "no"
     * ============================================================ */
    function buildMergedAvailability(pieceAvailability, batchId, pieceNumber, fullMaterials, extraOverrides) {
        const merged = {};

        // ---- 1) From piece's current stored availability ----
        Object.entries(pieceAvailability || {}).forEach(([k, v]) => {
            if (v === "yes") merged[k] = "yes";
            else if (merged[k] === undefined) merged[k] = v;
        });

        // ---- 2) From ALL requirements (past + present, completed included) ----
        const allReqs = readStorage(REQUIREMENT_STORAGE_KEY).filter(r =>
            String(r.batchId) === String(batchId) &&
            Number(r.pieceNumber) === Number(pieceNumber)
        );
        allReqs.forEach(r => {
            Object.entries(r.itemAvailability || {}).forEach(([k, v]) => {
                if (v === "yes") merged[k] = "yes";
                else if (v === "no" && merged[k] !== "yes") merged[k] = "no";
            });
            // Also process the missingItems list to ensure they're marked
            (r.missingItems || []).forEach(m => {
                if (merged[m] === undefined) merged[m] = "no";
            });
        });

        // ---- 3) Extra overrides (highest priority, but never downgrade yes→no) ----
        Object.entries(extraOverrides || {}).forEach(([k, v]) => {
            if (v === "yes") merged[k] = "yes";
            else if (merged[k] !== "yes") merged[k] = "no";
        });

        // ---- 4) Fill missing materials with "no" ----
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

    /**
     * Recompute piece state from merged availability.
     * Applied to every loaded piece to ensure consistency.
     */
    function normalizeBatchPieces() {
        batchData = batchData.map(batch => {
            const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];
            const newPieces = pieces.map((piece, index) => {
                const pieceNumber = getPieceNumber(piece, index);
                const allMaterials = getPieceMaterials(piece);
                if (!allMaterials.length) return piece;

                const mode = piece.approval?.mode;
                if (mode !== "confirm" && mode !== "pass") return piece;

                const merged = buildMergedAvailability(
                    piece.approval?.itemAvailability,
                    batch.batchId,
                    pieceNumber,
                    allMaterials
                );
                const newStatus = deriveStatus(merged, allMaterials);

                return {
                    ...piece,
                    materials: allMaterials,
                    approval: {
                        ...piece.approval,
                        status: newStatus,
                        itemAvailability: merged,
                        availableItems: allMaterials.filter(m => merged[m] === "yes"),
                        missingItems: allMaterials.filter(m => merged[m] !== "yes")
                    }
                };
            });
            return { ...batch, pieces: newPieces };
        });
        saveStorage(APPROVED_BATCH_STORAGE_KEY, batchData);
    }

    /* ================= LOAD ================= */
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
                const anyMatch = pieces.some(p => normalize(getPieceStatus(p)) === statusFilter);
                if (!anyMatch) return false;
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

            let pieceTypeHtml = "";
            let statusHtml = "";

            pieces.forEach((piece, index) => {
                const pieceNumber = getPieceNumber(piece, index);
                const itemName = getPieceItem(piece);
                const pieceStatus = getPieceStatus(piece);

                pieceTypeHtml += `
                    <div class="piece-line">
                        <span class="piece-num">${escapeHtml(pieceNumber)} Piece</span>
                        ${itemName ? `<span class="piece-item-text"> (${escapeHtml(itemName)})</span>` : ""}
                    </div>
                `;
                statusHtml += `<div class="status-line">${statusText(pieceStatus)}</div>`;
            });

            tbody.append(`
                <tr>
                    <td><strong>${escapeHtml(batch.batchId || "-")}</strong></td>
                    <td><img src="${photoSrc}" alt="Batch" style="width:55px;height:55px;object-fit:cover;border-radius:6px;" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';"></td>
                    <td>${escapeHtml(batch.brand || "-")}</td>
                    <td>${escapeHtml(batch.designNumber || "-")}</td>
                    <td>${escapeHtml(batch.color || "-")}</td>
                    <td><div class="piece-cell-lines">${pieceTypeHtml}</div></td>
                    <td>${escapeHtml(batch.quantity || "0")}</td>
                    <td>${escapeHtml(batch.priority || "-")}</td>
                    <td><div class="status-cell-lines">${statusHtml}</div></td>
                    <td>
                        <button type="button" class="btn btn-sm btn-primary open-approval-btn" data-id="${escapeHtml(batch.id)}">
                            <i class="bx bx-show me-1"></i> View
                        </button>
                    </td>
                </tr>
            `);
        });
    }

    function getCurrentBatch() {
        return batchData.find(b => String(b.id) === String(currentBatchId));
    }

    /* ================= FLOW CHART ================= */
    function buildFlowNodes(works) {
        const flowItems = [];
        FIXED_FLOW_STAGES.forEach(function (stageName) {
            flowItems.push({ type: "fixed", label: stageName, order: FLOW_STAGE_ORDER.indexOf(stageName) });
        });
        (works || []).forEach(function (work) {
            const stage = work.stage || "";
            const order = FLOW_STAGE_ORDER.indexOf(stage);
            flowItems.push({ type: "work", label: work.workType || "Work", order: order === -1 ? 99 : order });
        });
        flowItems.sort((a, b) => a.order - b.order);
        return flowItems;
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

            let html = `
                <div class="mb-3">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <span class="badge bg-primary">Piece ${escapeHtml(pieceNumber)}</span>
                        ${itemName ? `<span class="fw-semibold">${escapeHtml(itemName)}</span>` : ""}
                    </div>
                    <div class="batch-flow-track">
            `;
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

            let itemRows = "";
            if (materials.length) {
                materials.forEach((mat, matIndex) => {
                    const isChecked = availability[mat] === "yes";
                    const chkId = `chk_${pieceNumber}_${matIndex}`;
                    itemRows += `
                        <label class="item-list-row ${isChecked ? "checked-row" : ""}"
                               data-piece="${pieceNumber}" data-item="${escapeHtml(mat)}" for="${chkId}">
                            <input type="checkbox" class="piece-item-checkbox"
                                id="${chkId}" data-piece="${pieceNumber}" data-item="${escapeHtml(mat)}"
                                ${isChecked ? "checked" : ""} ${locked ? "disabled" : ""}>
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
                <div class="piece-card ${locked ? 'locked' : ''}" data-piece="${pieceNumber}">
                    <div class="piece-card-header">
                        <div>
                            <div class="piece-card-title">Piece ${escapeHtml(pieceNumber)}</div>
                            ${itemName ? `<div class="piece-card-item">${escapeHtml(itemName)}</div>` : ""}
                        </div>
                        <div class="piece-card-status">${statusText(pieceStatus)}</div>
                    </div>

                    <div>
                        <div class="small text-muted mb-1" style="font-size:11px;">Additional Work</div>
                        <div class="work-text">${worksHtml}</div>
                    </div>

                    <div>
                        <div class="item-list-top">
                            <span class="item-list-label">Item List</span>
                            <div class="all-toggle" ${(locked || allYesChecked) ? 'style="display:none;"' : ""}>
                                <input type="radio" name="${toggleName}" id="allYes_${pieceNumber}" class="all-toggle-radio" value="yes" data-piece="${pieceNumber}" ${allYesChecked ? "checked" : ""}>
                                <label for="allYes_${pieceNumber}" class="all-yes-label">All Yes</label>
                                <input type="radio" name="${toggleName}" id="allNo_${pieceNumber}" class="all-toggle-radio" value="no" data-piece="${pieceNumber}" ${allNoChecked ? "checked" : ""}>
                                <label for="allNo_${pieceNumber}" class="all-no-label">All No</label>
                            </div>
                        </div>
                        <div class="item-list-rows">${itemRows}</div>
                    </div>

                    <textarea class="form-control piece-remarks" rows="1" data-piece="${pieceNumber}" placeholder="Remarks..." ${locked ? "readonly" : ""}>${escapeHtml(remarks)}</textarea>

                    <div class="piece-card-actions" data-piece="${pieceNumber}"></div>
                </div>
            `);

            renderPieceActions(pieceNumber, locked, allYesChecked);
        });

        updateApproveAllState();
    }

    function renderPieceActions(pieceNumber, locked, allYesChecked) {
        const $actions = $(`.piece-card-actions[data-piece="${pieceNumber}"]`);
        $actions.empty();

        if (locked) return;

        if (allYesChecked) {
            $actions.html(`
                <button type="button" class="btn btn-success approve-piece-btn" data-piece="${pieceNumber}">
                    <i class="bx bx-check-circle me-1"></i> Approve
                </button>
            `);
        } else {
            $actions.html(`
                <button type="button" class="btn btn-success approve-piece-btn" data-piece="${pieceNumber}" disabled>
                    <i class="bx bx-check-circle me-1"></i> Approve
                </button>
                <button type="button" class="btn btn-info confirm-piece-btn" data-piece="${pieceNumber}">
                    <i class="bx bx-time-five me-1"></i> Confirm
                </button>
                <button type="button" class="btn btn-warning pass-piece-btn" data-piece="${pieceNumber}">
                    <i class="bx bx-right-arrow-alt me-1"></i> Pass
                </button>
            `);
        }
    }

    /* ================= APPROVE ALL STATE ================= */
    function updateApproveAllState() {
        const batch = getCurrentBatch();
        if (!batch) { $("#approveAllBtn").prop("disabled", true); return; }

        const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];
        let allReady = pieces.length > 0;

        pieces.forEach((piece, index) => {
            if (isPieceLocked(piece)) { allReady = false; return; }
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

    /* ================= OPEN MODAL ================= */
    function openApprovalModal(batchId) {
        currentBatchId = batchId;
        loadData();
        const batch = getCurrentBatch();
        if (!batch) return;

        const $photo = $("#approvalPhoto");
        $photo.off("error").on("error", function () {
            this.onerror = null;
            this.src = PLACEHOLDER_IMG;
        });

        $photo.attr("src", batch.photo || PLACEHOLDER_IMG);
        $photo.css("display", "");

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

        if (checked === total && total > 0) {
            $card.find(".all-toggle-radio[value='yes']").prop("checked", true);
        } else if (checked === 0) {
            $card.find(".all-toggle-radio[value='no']").prop("checked", true);
        } else {
            $card.find(".all-toggle-radio").prop("checked", false);
        }

        const allYesChecked = total > 0 && checked === total;
        renderPieceActions(pieceNumber, false, allYesChecked);
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
        const allYesChecked = val === "yes";
        renderPieceActions(pieceNumber, false, allYesChecked);
        updateApproveAllState();
    });

    /* ================= PROCESS PIECE ================= */
    function processPiece(pieceNumber, mode) {
        const batch = getCurrentBatch();
        if (!batch) return;

        const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];
        const pieceIndex = pieces.findIndex((p, i) => getPieceNumber(p, i) === pieceNumber);
        if (pieceIndex === -1) return;

        const piece = pieces[pieceIndex];

        if (isPieceLocked(piece)) {
            showMessage("info", "This piece is already locked.");
            return;
        }

        const materials = getPieceMaterials(piece);
        if (!materials.length) { showMessage("warning", "This piece has no item list."); return; }

        const availability = computeAvailability(pieceNumber, materials, piece);
        const availableItems = materials.filter(m => availability[m] === "yes");
        const missingItems = materials.filter(m => availability[m] === "no");
        const remarks = $(`.piece-remarks[data-piece="${pieceNumber}"]`).val().trim();

        if (mode === "approve" && missingItems.length) {
            showMessage("warning", "Approve requires all items present.");
            return;
        }
        if (mode === "confirm") {
            if (!availableItems.length) { showMessage("warning", "At least one item must be present."); return; }
            if (!missingItems.length) { showMessage("info", "All items present — use Approve."); return; }
        }
        if (mode === "pass" && !availableItems.length) {
            showMessage("warning", "At least one item must be present to Pass.");
            return;
        }

        let titleText = "", htmlText = "", confirmText = "", confirmColor = "#198754";

        if (mode === "approve") {
            titleText = `Approve Piece ${pieceNumber}?`;
            htmlText = `<div class="text-start"><p><strong>All ${availableItems.length} items present ✅</strong></p><p class="text-success">Pass to Cutting (Status: <b>Pass</b>)</p></div>`;
            confirmText = "Yes, Approve & Pass";
        } else if (mode === "confirm") {
            titleText = `Confirm Piece ${pieceNumber}?`;
            htmlText = `<div class="text-start"><p><strong>${availableItems.length} items present</strong></p><p><strong>${missingItems.length} items missing</strong> → Requirement</p><hr><p class="text-muted mb-0">Status <b>Pending</b>. Nothing goes to Cutting.</p></div>`;
            confirmText = "Yes, Confirm";
        } else {
            titleText = `Force Pass Piece ${pieceNumber}?`;
            htmlText = `<div class="text-start"><p><strong>${availableItems.length} items present</strong> → Cutting (In Progress)</p><p><strong>${missingItems.length} items missing</strong> → Requirement</p><hr><p class="mb-1"><strong>Missing:</strong></p><ul>${missingItems.map(m => `<li>${escapeHtml(m)}</li>`).join("") || "<li>None</li>"}</ul></div>`;
            confirmText = "Yes, Pass Anyway";
            confirmColor = "#dc3545";
        }

        Swal.fire({
            title: titleText, html: htmlText, icon: "question",
            showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: "Cancel",
            confirmButtonColor: confirmColor
        }).then(function (result) {
            if (!result.isConfirmed) return;

            let newStatus;
            if (mode === "approve") newStatus = "pass";
            else if (mode === "confirm") newStatus = "pending";
            else newStatus = "in_progress";

            const updatedPieces = [...pieces];
            updatedPieces[pieceIndex] = {
                ...piece,
                materials: materials,
                approval: {
                    status: newStatus,
                    itemAvailability: availability,
                    availableItems: availableItems,
                    missingItems: missingItems,
                    remarks: remarks,
                    mode: mode,
                    locked: true,
                    updatedAt: new Date().toLocaleString("en-GB")
                }
            };

            updateBatchPieces(batch, updatedPieces);

            if (mode === "approve") {
                pushToApprovedPool(batch, updatedPieces[pieceIndex], pieceNumber, availableItems, "pass", availability, materials);
            } else if (mode === "pass") {
                pushToApprovedPool(batch, updatedPieces[pieceIndex], pieceNumber, availableItems, "in_progress", availability, materials);
                if (missingItems.length) {
                    createRequirement(batch, updatedPieces[pieceIndex], pieceNumber, missingItems, availability, materials);
                }
            } else if (mode === "confirm") {
                createRequirement(batch, updatedPieces[pieceIndex], pieceNumber, missingItems, availability, materials);
            }

            loadData();
            const freshBatch = getCurrentBatch();
            if (freshBatch) renderApprovalPieces(freshBatch);
            renderTable();

            if (mode === "confirm") {
                Swal.fire({ icon: "info", title: "Confirmed — Pending", text: "Requirement created. Nothing passed to Cutting.", timer: 2500, showConfirmButton: false });
            } else if (mode === "pass" && missingItems.length) {
                Swal.fire({
                    icon: "success", title: "Passed (In Progress)",
                    html: `<p><strong>${availableItems.length}</strong> items → Cutting Manager</p><p><strong>${missingItems.length}</strong> items → Requirement</p>`,
                    showCancelButton: true, confirmButtonText: "Open Requirement", cancelButtonText: "Close"
                }).then(function (r) { if (r.isConfirmed) window.location.href = "requirment.php"; });
            } else {
                Swal.fire({ icon: "success", title: "Approved & Passed", text: `Piece ${pieceNumber} passed to Cutting Manager.`, timer: 1800, showConfirmButton: false });
            }
        });
    }

    $(document).on("click", ".approve-piece-btn", function () {
        if ($(this).prop("disabled")) return;
        processPiece(Number($(this).data("piece")), "approve");
    });
    $(document).on("click", ".confirm-piece-btn", function () { processPiece(Number($(this).data("piece")), "confirm"); });
    $(document).on("click", ".pass-piece-btn", function () { processPiece(Number($(this).data("piece")), "pass"); });

    /* ================= APPROVE ALL ================= */
    $(document).on("click", "#approveAllBtn", function () {
        const batch = getCurrentBatch();
        if (!batch) return;

        const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];
        const readyPieces = [];

        pieces.forEach((piece, index) => {
            if (isPieceLocked(piece)) return;
            const pieceNumber = getPieceNumber(piece, index);
            const materials = getPieceMaterials(piece);
            if (!materials.length) return;

            const availability = computeAvailability(pieceNumber, materials, piece);
            const allYes = materials.every(m => availability[m] === "yes");
            if (allYes) readyPieces.push({ piece, index, materials, availability });
        });

        if (!readyPieces.length) {
            showMessage("warning", "No pieces are ready to approve.");
            return;
        }

        Swal.fire({
            title: "Approve All Ready Pieces?",
            html: `<div class="text-start"><p><strong>${readyPieces.length}</strong> pieces will be approved and passed to Cutting.</p></div>`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Yes, Approve All",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#198754"
        }).then(function (result) {
            if (!result.isConfirmed) return;

            const updatedPieces = [...pieces];

            readyPieces.forEach(({ piece, index, materials, availability }) => {
                const pieceNumber = getPieceNumber(piece, index);
                const availableItems = materials.filter(m => availability[m] === "yes");

                updatedPieces[index] = {
                    ...piece,
                    materials: materials,
                    approval: {
                        status: "pass",
                        itemAvailability: availability,
                        availableItems: availableItems,
                        missingItems: [],
                        remarks: piece.approval?.remarks || "",
                        mode: "approve",
                        locked: true,
                        updatedAt: new Date().toLocaleString("en-GB")
                    }
                };

                pushToApprovedPool(batch, updatedPieces[index], pieceNumber, availableItems, "pass", availability, materials);
            });

            updateBatchPieces(batch, updatedPieces);

            loadData();
            const freshBatch = getCurrentBatch();
            if (freshBatch) renderApprovalPieces(freshBatch);
            renderTable();

            Swal.fire({ icon: "success", title: "Approved", text: `${readyPieces.length} pieces approved & passed.`, timer: 2000, showConfirmButton: false });
        });
    });

    /* ================= UPDATE BATCH ================= */
    function updateBatchPieces(batch, updatedPieces) {
        const index = batchData.findIndex(b => String(b.id) === String(batch.id));
        if (index === -1) return;
        batchData[index] = {
            ...batchData[index],
            pieces: updatedPieces,
            updatedAt: new Date().toLocaleString("en-GB")
        };
        saveStorage(APPROVED_BATCH_STORAGE_KEY, batchData);
    }

    /* ================= PUSH TO APPROVED POOL ================= */
    function pushToApprovedPool(batch, piece, pieceNumber, availableItems, mode, availability, allMaterials) {
        const pool = readStorage(APPROVED_POOL_KEY);
        const materials = allMaterials || getPieceMaterials(piece);

        const existingIdx = pool.findIndex(p =>
            String(p.batchId) === String(batch.batchId) &&
            Number(p.pieceNumber) === Number(pieceNumber)
        );

        if (existingIdx !== -1) {
            // MERGE: never lose previously passed items ("yes" sticky)
            const prev = pool[existingIdx];
            const mergedAvailability = { ...(prev.itemAvailability || {}) };
            Object.entries(availability).forEach(([k, v]) => {
                if (v === "yes") mergedAvailability[k] = "yes";
                else if (mergedAvailability[k] !== "yes") mergedAvailability[k] = "no";
            });
            const mergedMaterials = [...new Set([...(prev.materials || []), ...materials])];
            const mergedAvailable = mergedMaterials.filter(m => mergedAvailability[m] === "yes");

            pool[existingIdx] = {
                ...prev,
                materials: mergedMaterials,
                itemAvailability: mergedAvailability,
                availableItems: mergedAvailable,
                mode: mode,
                status: "pending_cutting",
                updatedAt: new Date().toLocaleString("en-GB")
            };
            saveStorage(APPROVED_POOL_KEY, pool);
            return pool[existingIdx];
        }

        const nextId = pool.length ? Math.max(...pool.map(p => Number(p.id) || 0)) + 1 : 1;

        const entry = {
            id: nextId,
            batchId: batch.batchId,
            bomId: batch.bomId || "",
            brand: batch.brand || "",
            designNumber: batch.designNumber || "",
            color: batch.color || "",
            pieceNumber: pieceNumber,
            pieceItem: getPieceItem(piece),
            quantity: batch.quantity || 0,
            priority: batch.priority || "Medium",
            photo: batch.photo || "",
            availableItems: [...availableItems],
            materials: materials,
            itemAvailability: { ...availability },
            additionalWorks: getPieceWorks(piece),
            mode: mode,
            status: "pending_cutting",
            createdAt: new Date().toLocaleString("en-GB")
        };

        pool.push(entry);
        saveStorage(APPROVED_POOL_KEY, pool);
        return entry;
    }

    /* ================= CREATE REQUIREMENT ================= */
    function createRequirement(batch, piece, pieceNumber, missingItems, availability, allMaterials) {
        const requirementData = readStorage(REQUIREMENT_STORAGE_KEY);
        const materials = allMaterials || getPieceMaterials(piece);

        const existingIdx = requirementData.findIndex(r =>
            String(r.batchId) === String(batch.batchId) &&
            Number(r.pieceNumber) === Number(pieceNumber) &&
            r.status !== "completed"
        );

        if (existingIdx !== -1) {
            const existing = requirementData[existingIdx];
            const mergedMissing = [...new Set([...(existing.missingItems || []), ...missingItems])];
            requirementData[existingIdx] = {
                ...existing,
                missingItems: mergedMissing,
                itemAvailability: { ...(existing.itemAvailability || {}), ...availability },
                materials: materials,
                remarks: piece?.approval?.remarks || existing.remarks,
                status: "pending",
                updatedAt: new Date().toLocaleString("en-GB")
            };
            saveStorage(REQUIREMENT_STORAGE_KEY, requirementData);
            return requirementData[existingIdx];
        }

        const nextId = requirementData.length ? Math.max(...requirementData.map(r => Number(r.id) || 0)) + 1 : 1;

        const requirement = {
            id: nextId,
            requirementId: `REQ-${String(nextId).padStart(3, "0")}`,
            batchId: batch.batchId,
            bomId: batch.bomId || "",
            brand: batch.brand || "",
            designNumber: batch.designNumber || "",
            color: batch.color || "",
            pieceNumber: pieceNumber,
            pieceItem: getPieceItem(piece),
            quantity: batch.quantity || 0,
            priority: batch.priority || "Medium",
            photo: batch.photo || "",
            materials: materials,
            additionalWorks: getPieceWorks(piece),
            missingItems: [...missingItems],
            itemAvailability: { ...availability },
            remarks: piece?.approval?.remarks || "",
            status: "pending",
            createdAt: new Date().toLocaleString("en-GB")
        };

        requirementData.push(requirement);
        saveStorage(REQUIREMENT_STORAGE_KEY, requirementData);
        return requirement;
    }

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