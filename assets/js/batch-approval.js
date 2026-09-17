$(document).ready(function () {
    "use strict";

    const BATCH_STORAGE_KEY = "batchData";
    const REQUIREMENT_STORAGE_KEY = "requirementData";
    const APPROVED_POOL_KEY = "approvedPool";

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

    /* HELPERS */
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

    function getStatusBadge(status) {
        const statuses = {
            pending: { label: "Pending", className: "bg-warning text-dark" },
            approved: { label: "Approved", className: "bg-success" },
            missing: { label: "Missing Item", className: "bg-danger" },
            partial: { label: "Partial", className: "bg-info text-dark" }
        };
        const data = statuses[status] || statuses.pending;
        return `<span class="badge ${data.className}">${data.label}</span>`;
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

    function getPieceStatus(piece) {
        return piece?.approval?.status || "pending";
    }

    function loadData() { batchData = readStorage(BATCH_STORAGE_KEY); }

    /* TABLE RENDER */
    function renderTable() {
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
            tbody.html(`<tr><td colspan="10" class="text-center text-muted py-4"><i class="bx bx-info-circle me-1"></i> No batches found.</td></tr>`);
            return;
        }

        filtered.forEach(batch => {
            const pieces = Array.isArray(batch.pieces) && batch.pieces.length
                ? batch.pieces
                : [{ number: 1, item: batch.piece || "", materials: batch.itemList || [], additionalWorks: [] }];

            const totalPieces = pieces.length;

            pieces.forEach((piece, index) => {
                const pieceNumber = getPieceNumber(piece, index);
                const itemName = getPieceItem(piece);
                const pieceStatus = getPieceStatus(piece);
                const photoSrc = batch.photo ? escapeHtml(batch.photo) : PLACEHOLDER_IMG;

                const commonColumns = index === 0 ? `
                    <td rowspan="${totalPieces}"><strong>${escapeHtml(batch.batchId || "-")}</strong></td>
                    <td rowspan="${totalPieces}">
                        <img src="${photoSrc}" alt="Batch" style="width:55px;height:55px;object-fit:cover;border-radius:6px;" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';">
                    </td>
                    <td rowspan="${totalPieces}">${escapeHtml(batch.brand || "-")}</td>
                    <td rowspan="${totalPieces}">${escapeHtml(batch.designNumber || "-")}</td>
                    <td rowspan="${totalPieces}">${escapeHtml(batch.color || "-")}</td>
                ` : "";

                const bottomColumns = index === 0 ? `
                    <td rowspan="${totalPieces}">${escapeHtml(batch.quantity || "0")}</td>
                    <td rowspan="${totalPieces}">${escapeHtml(batch.priority || "-")}</td>
                    <td>${getStatusBadge(pieceStatus)}</td>
                    <td rowspan="${totalPieces}">
                        <button type="button" class="btn btn-sm btn-primary open-approval-btn" data-id="${escapeHtml(batch.id)}">
                            <i class="bx bx-show me-1"></i> View
                        </button>
                    </td>
                ` : "";

                const pieceStatusCell = index > 0 ? `<td>${getStatusBadge(pieceStatus)}</td>` : "";

                const pieceTypeCell = `
                    <td>
                        <div class="piece-type-cell">
                            <span class="piece-num">${escapeHtml(pieceNumber)} Piece</span>
                            ${itemName ? `<span class="piece-item-text"> (${escapeHtml(itemName)})</span>` : ""}
                        </div>
                    </td>
                `;

                tbody.append(`
                    <tr>
                        ${commonColumns}
                        ${pieceTypeCell}
                        ${index === 0 ? bottomColumns : pieceStatusCell}
                    </tr>
                `);
            });
        });
    }

    function getCurrentBatch() {
        return batchData.find(b => String(b.id) === String(currentBatchId));
    }

    /* FLOW CHART */
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

    /* PIECE CARDS */
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

            let itemRows = "";
            if (materials.length) {
                materials.forEach((mat, matIndex) => {
                    const isChecked = availability[mat] === "yes";
                    const chkId = `chk_${pieceNumber}_${matIndex}`;
                    itemRows += `
                        <label class="item-list-row ${isChecked ? "checked-row" : ""}"
                               data-piece="${pieceNumber}"
                               data-item="${escapeHtml(mat)}"
                               for="${chkId}">
                            <input type="checkbox" class="piece-item-checkbox"
                                id="${chkId}" data-piece="${pieceNumber}"
                                data-item="${escapeHtml(mat)}" ${isChecked ? "checked" : ""}>
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

            const statusHtml = getStatusBadge(pieceStatus);
            const isApproved = pieceStatus === "approved";
            const isMissing = pieceStatus === "missing";
            const isPartial = pieceStatus === "partial";
            const isDone = isApproved || isMissing || isPartial;

            const totalMats = materials.length;
            const yesCount = materials.filter(m => availability[m] === "yes").length;
            const noCount = materials.filter(m => availability[m] === "no").length;
            const allYesChecked = totalMats > 0 && yesCount === totalMats;
            const allNoChecked = totalMats > 0 && noCount === totalMats;
            const toggleName = `toggle_${pieceNumber}`;

            const approveDisabled = (!allYesChecked || isDone) ? "disabled" : "";

            container.append(`
                <div class="piece-card" data-piece="${pieceNumber}">
                    <div class="piece-card-header">
                        <div>
                            <div class="piece-card-title">Piece ${escapeHtml(pieceNumber)}</div>
                            ${itemName ? `<div class="piece-card-item">${escapeHtml(itemName)}</div>` : ""}
                        </div>
                        <div class="piece-card-status">${statusHtml}</div>
                    </div>

                    <div>
                        <div class="small text-muted mb-1" style="font-size:11px;">Additional Work</div>
                        <div class="work-text">${worksHtml}</div>
                    </div>

                    <div>
                        <div class="item-list-top">
                            <span class="item-list-label">Item List</span>
                            <div class="all-toggle" ${isDone ? 'style="opacity:.5;pointer-events:none;"' : ""}>
                                <input type="radio" name="${toggleName}" id="allYes_${pieceNumber}" class="all-toggle-radio" value="yes" data-piece="${pieceNumber}" ${allYesChecked ? "checked" : ""}>
                                <label for="allYes_${pieceNumber}" class="all-yes-label">All Yes</label>
                                <input type="radio" name="${toggleName}" id="allNo_${pieceNumber}" class="all-toggle-radio" value="no" data-piece="${pieceNumber}" ${allNoChecked ? "checked" : ""}>
                                <label for="allNo_${pieceNumber}" class="all-no-label">All No</label>
                            </div>
                        </div>
                        <div class="item-list-rows">${itemRows}</div>
                    </div>

                    <textarea class="form-control piece-remarks" rows="1" data-piece="${pieceNumber}" placeholder="Remarks..." ${isDone ? "readonly" : ""}>${escapeHtml(remarks)}</textarea>

                    <div class="piece-card-actions">
                        <button type="button" class="btn btn-success approve-piece-btn" data-piece="${pieceNumber}" ${approveDisabled}>
                            <i class="bx bx-check-circle me-1"></i> Approve
                        </button>
                        <button type="button" class="btn btn-info confirm-piece-btn" data-piece="${pieceNumber}" ${isDone ? "disabled" : ""}>
                            <i class="bx bx-time-five me-1"></i> Confirm
                        </button>
                        <button type="button" class="btn btn-warning pass-piece-btn" data-piece="${pieceNumber}" ${isDone ? "disabled" : ""}>
                            <i class="bx bx-right-arrow-alt me-1"></i> Pass
                        </button>
                    </div>
                </div>
            `);
        });
    }

    /* OPEN MODAL */
    function openApprovalModal(batchId) {
        currentBatchId = batchId;
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

    /* CHECKBOX & TOGGLE */
    $(document).on("change", ".piece-item-checkbox", function () {
        const $row = $(this).closest(".item-list-row");
        if ($(this).is(":checked")) $row.addClass("checked-row");
        else $row.removeClass("checked-row");

        const pieceNumber = $(this).data("piece");
        const $card = $(`.piece-card[data-piece="${pieceNumber}"]`);
        const total = $card.find(".piece-item-checkbox").length;
        const checked = $card.find(".piece-item-checkbox:checked").length;

        if (checked === total && total > 0) {
            $card.find(".all-toggle-radio[value='yes']").prop("checked", true);
        } else if (checked === 0) {
            $card.find(".all-toggle-radio[value='no']").prop("checked", true);
        } else {
            $card.find(".all-toggle-radio").prop("checked", false);
        }

        // Enable/Disable Approve button
        const allChecked = total > 0 && checked === total;
        const $approveBtn = $card.find(".approve-piece-btn");
        const isDone = $card.find(".piece-card-status .badge").hasClass("bg-success") ||
                       $card.find(".piece-card-status .badge").hasClass("bg-danger") ||
                       $card.find(".piece-card-status .badge").hasClass("bg-info");

        if (!isDone) {
            $approveBtn.prop("disabled", !allChecked);
        }
    });

    $(document).on("change", ".all-toggle-radio", function () {
        const pieceNumber = $(this).data("piece");
        const val = $(this).val();
        $(`.item-list-row[data-piece="${pieceNumber}"]`).each(function () {
            const $row = $(this);
            const $chk = $row.find(".piece-item-checkbox");
            if (val === "yes") {
                $chk.prop("checked", true);
                $row.addClass("checked-row");
            } else {
                $chk.prop("checked", false);
                $row.removeClass("checked-row");
            }
        });

        // Update Approve button state
        const $card = $(`.piece-card[data-piece="${pieceNumber}"]`);
        const total = $card.find(".piece-item-checkbox").length;
        const checked = $card.find(".piece-item-checkbox:checked").length;
        const $approveBtn = $card.find(".approve-piece-btn");
        const isDone = $card.find(".piece-card-status .badge").hasClass("bg-success") ||
                       $card.find(".piece-card-status .badge").hasClass("bg-danger") ||
                       $card.find(".piece-card-status .badge").hasClass("bg-info");

        if (!isDone) {
            $approveBtn.prop("disabled", !(total > 0 && checked === total));
        }
    });

    /* COLLECT AVAILABILITY */
    function collectAvailability(pieceNumber, materials) {
        const availability = {};
        materials.forEach(mat => {
            const $row = $(`.item-list-row[data-piece="${pieceNumber}"][data-item="${mat}"]`);
            const checked = $row.find(".piece-item-checkbox").is(":checked");
            availability[mat] = checked ? "yes" : "no";
        });
        return availability;
    }

    /* COMMON: Process Piece (used by all 3 buttons) */
    function processPiece(pieceNumber, mode) {
        // mode: "approve" | "confirm" | "pass"
        const batch = getCurrentBatch();
        if (!batch) return;

        const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];
        const pieceIndex = pieces.findIndex((p, i) => getPieceNumber(p, i) === pieceNumber);
        if (pieceIndex === -1) return;

        const piece = pieces[pieceIndex];
        const materials = getPieceMaterials(piece);

        if (!materials.length) {
            showMessage("warning", "This piece has no item list.");
            return;
        }

        const availability = collectAvailability(pieceNumber, materials);
        const availableItems = materials.filter(m => availability[m] === "yes");
        const missingItems = materials.filter(m => availability[m] === "no");
        const remarks = $(`.piece-remarks[data-piece="${pieceNumber}"]`).val().trim();

        // Validate
        if (mode === "approve") {
            if (missingItems.length) {
                showMessage("warning", "Approve ke liye saare items present hone chahiye. Confirm ya Pass use karein.");
                return;
            }
        }

        if (mode === "confirm") {
            if (!availableItems.length) {
                showMessage("warning", "Kam se kam ek item present hona chahiye.");
                return;
            }
            if (!missingItems.length) {
                showMessage("info", "Sab items present hain — Approve use karein.");
                return;
            }
        }

        if (mode === "pass") {
            if (!availableItems.length) {
                showMessage("warning", "Kam se kam ek item present hona chahiye pass karne ke liye.");
                return;
            }
        }

        // Confirmation dialog content
        let titleText = "", htmlText = "", confirmText = "", confirmColor = "#198754";

        if (mode === "approve") {
            titleText = `Approve Piece ${pieceNumber}?`;
            htmlText = `
                <div class="text-start">
                    <p><strong>All ${availableItems.length} items present ✅</strong></p>
                    <p class="text-success">Direct <strong>Pass</strong> to Cutting Manager.</p>
                </div>
            `;
            confirmText = "Yes, Approve & Pass";
        } else if (mode === "confirm") {
            titleText = `Confirm Piece ${pieceNumber}?`;
            htmlText = `
                <div class="text-start">
                    <p><strong>${availableItems.length} items present</strong> → Pass to Cutting</p>
                    <p><strong>${missingItems.length} items pending</strong> → Requirement</p>
                    <hr>
                    <p class="mb-1"><strong>Pending (will go to Requirement):</strong></p>
                    <ul>${missingItems.map(m => `<li>${escapeHtml(m)}</li>`).join("")}</ul>
                    <p class="text-muted mb-0">Jab items aa jayenge, Requirement page se merge karke pass kar sakte hain.</p>
                </div>
            `;
            confirmText = "Yes, Confirm";
        } else {
            titleText = `Force Pass Piece ${pieceNumber}?`;
            htmlText = `
                <div class="text-start">
                    <p><strong>${availableItems.length} items present</strong> → Pass to Cutting</p>
                    <p><strong>${missingItems.length} items missing</strong> → Requirement</p>
                    <hr>
                    <p class="mb-1"><strong>Missing (will go to Requirement):</strong></p>
                    <ul>${missingItems.map(m => `<li>${escapeHtml(m)}</li>`).join("") || "<li>None</li>"}</ul>
                    <p class="text-warning mb-0"><strong>Warning:</strong> Missing items ke bina bhi pass ho raha hai.</p>
                </div>
            `;
            confirmText = "Yes, Pass Anyway";
            confirmColor = "#dc3545";
        }

        Swal.fire({
            title: titleText,
            html: htmlText,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: confirmText,
            cancelButtonText: "Cancel",
            confirmButtonColor: confirmColor
        }).then(function (result) {
            if (!result.isConfirmed) return;

            const newStatus = missingItems.length === 0
                ? "approved"
                : (mode === "confirm" ? "partial" : "missing");

            const updatedPieces = [...pieces];
            updatedPieces[pieceIndex] = {
                ...piece,
                approval: {
                    status: newStatus,
                    itemAvailability: availability,
                    availableItems: availableItems,
                    missingItems: missingItems,
                    remarks: remarks,
                    mode: mode,
                    approvedAt: new Date().toLocaleString("en-GB")
                }
            };

            updateBatchPieces(batch, updatedPieces);

            // Push available items to approvedPool
            if (availableItems.length) {
                pushToApprovedPool(batch, updatedPieces[pieceIndex], pieceNumber, availableItems, mode);
            }

            // Push missing items to requirement
            if (missingItems.length) {
                createRequirement(batch, updatedPieces[pieceIndex], pieceNumber, missingItems);
            }

            approvalModal.hide();
            renderTable();

            // Success message
            if (missingItems.length && availableItems.length) {
                Swal.fire({
                    icon: "success",
                    title: mode === "confirm" ? "Confirmed" : "Passed",
                    html: `
                        <p><strong>${availableItems.length}</strong> items → Cutting Manager</p>
                        <p><strong>${missingItems.length}</strong> items → Requirement</p>
                    `,
                    showCancelButton: true,
                    confirmButtonText: "Open Requirement",
                    cancelButtonText: "Close"
                }).then(function (r) {
                    if (r.isConfirmed) window.location.href = "requirment.php";
                });
            } else if (missingItems.length) {
                Swal.fire({
                    icon: "success",
                    title: "Sent to Requirement",
                    text: `${missingItems.length} missing items saved.`,
                    showCancelButton: true,
                    confirmButtonText: "Open Requirement",
                    cancelButtonText: "Close"
                }).then(function (r) {
                    if (r.isConfirmed) window.location.href = "requirment.php";
                });
            } else {
                Swal.fire({
                    icon: "success",
                    title: "Approved & Passed",
                    text: `Piece ${pieceNumber} passed to Cutting Manager.`,
                    timer: 1800,
                    showConfirmButton: false
                });
            }
        });
    }

    /* BUTTON HANDLERS */
    $(document).on("click", ".approve-piece-btn", function () {
        processPiece(Number($(this).data("piece")), "approve");
    });

    $(document).on("click", ".confirm-piece-btn", function () {
        processPiece(Number($(this).data("piece")), "confirm");
    });

    $(document).on("click", ".pass-piece-btn", function () {
        processPiece(Number($(this).data("piece")), "pass");
    });

    /* UPDATE BATCH */
    function updateBatchPieces(batch, updatedPieces) {
        const index = batchData.findIndex(b => String(b.id) === String(batch.id));
        if (index === -1) return;
        batchData[index] = {
            ...batchData[index],
            pieces: updatedPieces,
            updatedAt: new Date().toLocaleString("en-GB")
        };
        saveStorage(BATCH_STORAGE_KEY, batchData);
    }

    /* PUSH TO APPROVED POOL */
    function pushToApprovedPool(batch, piece, pieceNumber, availableItems, mode) {
        const pool = readStorage(APPROVED_POOL_KEY);
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
            materials: [...availableItems],
            additionalWorks: getPieceWorks(piece),
            mode: mode,
            status: "pending_cutting",
            createdAt: new Date().toLocaleString("en-GB")
        };

        pool.push(entry);
        saveStorage(APPROVED_POOL_KEY, pool);
        return entry;
    }

    /* CREATE REQUIREMENT — with batchId */
    function createRequirement(batch, piece, pieceNumber, missingItems) {
        const requirementData = readStorage(REQUIREMENT_STORAGE_KEY);

        const existing = requirementData.find(r =>
            String(r.batchId) === String(batch.batchId) &&
            Number(r.pieceNumber) === Number(pieceNumber) &&
            r.status !== "completed"
        );

        if (existing) {
            existing.missingItems = [...new Set([...(existing.missingItems || []), ...missingItems])];
            existing.remarks = piece?.approval?.remarks || existing.remarks;
            existing.updatedAt = new Date().toLocaleString("en-GB");
            saveStorage(REQUIREMENT_STORAGE_KEY, requirementData);
            return existing;
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
            materials: getPieceMaterials(piece),
            additionalWorks: getPieceWorks(piece),
            missingItems: [...missingItems],
            itemAvailability: piece?.approval?.itemAvailability || {},
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
        Swal.fire({ icon: "success", title: "Refreshed", timer: 1200, showConfirmButton: false });
    });

    $("#approvalModal").on("hidden.bs.modal", function () {
        currentBatchId = null;
        $("#approvalPiecesContainer").empty();
        $("#batchFlowChart").empty();
        $("#batchFlowBox").hide();
    });

    loadData();
    renderTable();
});