$(document).ready(function () {
    "use strict";

    const BATCH_STORAGE_KEY = "batchData";
    const REQUIREMENT_STORAGE_KEY = "requirementData";

    let batchData = [];
    let currentBatchId = null;

    const approvalModalElement = document.getElementById("approvalModal");
    const approvalModal = new bootstrap.Modal(approvalModalElement);

    /* ======================================================
       HELPERS
       ====================================================== */

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
        } catch (error) {
            console.error("Storage error:", error);
            return [];
        }
    }

    function saveStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error("Storage save error:", error);
            return false;
        }
    }

    function normalize(value) {
        return String(value ?? "").trim().toLowerCase();
    }

    function getStatusBadge(status) {
        const statuses = {
            pending:  { label: "Pending",      className: "bg-warning text-dark" },
            progress: { label: "Progress",     className: "bg-info text-dark" },
            approved: { label: "Approved",     className: "bg-success" },
            missing:  { label: "Missing Item", className: "bg-danger" }
        };

        const data = statuses[status] || statuses.pending;

        return `<span class="badge ${data.className}">${data.label}</span>`;
    }

    function showMessage(type, message) {
        Swal.fire({
            icon: type === "danger" ? "error" : type,
            text: message,
            confirmButtonColor: "#161617"
        });
    }

    function getPieceNumber(piece, index) {
        return Number(piece?.number) || index + 1;
    }

    function getPieceItem(piece) {
        return String(piece?.item || "").trim();
    }

    function getPieceMaterials(piece) {
        let materials = piece?.materials || [];
        if (typeof materials === "string") {
            materials = materials.split(",").map(s => s.trim()).filter(Boolean);
        }
        if (!Array.isArray(materials)) return [];
        return [...new Set(materials.map(m => String(m).trim()).filter(Boolean))];
    }

    function getPieceWorks(piece) {
        let works = piece?.additionalWorks || [];
        if (!Array.isArray(works)) return [];
        return works
            .map(w => ({
                workType: String(w?.workType || "").trim(),
                stage: String(w?.stage || "").trim()
            }))
            .filter(w => w.workType || w.stage);
    }

    /* ======================================================
       AUTO STATUS — based on pieces
       ====================================================== */

    function computeBatchStatus(pieces) {

        if (!Array.isArray(pieces) || !pieces.length) {
            return "pending";
        }

        let anyApproved = false;
        let anyMissing = false;
        let anyPending = false;
        let totalApproved = 0;

        pieces.forEach(p => {
            const s = p?.approval?.status || "pending";
            if (s === "approved") {
                anyApproved = true;
                totalApproved++;
            } else if (s === "missing") {
                anyMissing = true;
            } else {
                anyPending = true;
            }
        });

        // All approved
        if (totalApproved === pieces.length) {
            return "approved";
        }

        // Any missing → progress (mixed) OR missing
        if (anyMissing) {
            // If some are approved and some missing → progress
            if (anyApproved) return "progress";
            return "missing";
        }

        // If nothing approved yet → pending
        if (anyPending && !anyApproved) return "pending";

        // Partial approval without missing → progress
        if (anyApproved) return "progress";

        return "pending";
    }

    /* ======================================================
       LOAD DATA
       ====================================================== */

    function loadData() {
        batchData = readStorage(BATCH_STORAGE_KEY);
    }

    /* ======================================================
       TABLE RENDER
       ====================================================== */

    function renderTable() {
        const tbody = $("#approvalTableBody");
        tbody.empty();

        const statusFilter = normalize($("#approvalStatusFilter").val());
        const searchTerm = normalize($("#approvalSearchInput").val());

        const filtered = batchData.filter(batch => {

            const pieces = Array.isArray(batch.pieces) ? batch.pieces : [];

            const searchable = [
                batch.batchId,
                batch.brand,
                batch.designNumber,
                batch.color,
                batch.quantity,
                batch.priority,
                ...pieces.map(p => [
                    p.item,
                    ...(p.materials || []),
                    ...((p.additionalWorks || []).map(w => `${w.workType} ${w.stage}`))
                ].join(" "))
            ].filter(Boolean).join(" ");

            const status = batch.status || "pending";

            return (
                (!statusFilter || normalize(status) === statusFilter) &&
                (!searchTerm || normalize(searchable).includes(searchTerm))
            );
        });

        if (!filtered.length) {
            tbody.html(`
                <tr>
                    <td colspan="12" class="text-center text-muted py-4">
                        <i class="bx bx-info-circle me-1"></i>
                        No batches found.
                    </td>
                </tr>
            `);
            return;
        }

        filtered.forEach(batch => {

            const pieces = Array.isArray(batch.pieces) && batch.pieces.length
                ? batch.pieces
                : [{
                    number: 1,
                    item: batch.piece || "",
                    materials: batch.itemList || [],
                    additionalWorks: batch.additionalWork
                        ? [{ workType: batch.additionalWork, stage: "" }]
                        : []
                }];

            const totalPieces = pieces.length;
            const batchStatus = batch.status || "pending";

            pieces.forEach((piece, index) => {

                const pieceNumber = getPieceNumber(piece, index);
                const itemName = getPieceItem(piece);
                const materials = getPieceMaterials(piece);
                const works = getPieceWorks(piece);

                const materialsHtml = materials.length
                    ? materials.map(m => `
                        <span class="badge bg-light text-dark border me-1 mb-1">
                            ${escapeHtml(m)}
                        </span>
                    `).join("")
                    : `<span class="text-muted">-</span>`;

                const worksHtml = works.length
                    ? works.map(w => `
                        <div>
                            ${escapeHtml(w.workType || "-")}
                            ${w.stage ? `<span class="text-muted"> — ${escapeHtml(w.stage)}</span>` : ""}
                        </div>
                    `).join("")
                    : `<span class="text-muted">-</span>`;

                const commonColumns = index === 0 ? `
                    <td rowspan="${totalPieces}" class="align-middle">
                        <strong>${escapeHtml(batch.batchId || "-")}</strong>
                    </td>
                    <td rowspan="${totalPieces}" class="align-middle">
                        <img
                            src="${escapeHtml(batch.photo || "assets/images/default.jpg")}"
                            alt="Batch"
                            style="width:55px;height:55px;object-fit:cover;border-radius:6px;"
                            onerror="this.src='assets/images/default.jpg';"
                        >
                    </td>
                    <td rowspan="${totalPieces}" class="align-middle">
                        ${escapeHtml(batch.brand || "-")}
                    </td>
                    <td rowspan="${totalPieces}" class="align-middle">
                        ${escapeHtml(batch.designNumber || "-")}
                    </td>
                    <td rowspan="${totalPieces}" class="align-middle">
                        ${escapeHtml(batch.color || "-")}
                    </td>
                ` : "";

                const bottomColumns = index === 0 ? `
                    <td rowspan="${totalPieces}" class="align-middle">
                        ${escapeHtml(batch.quantity || "0")}
                    </td>
                    <td rowspan="${totalPieces}" class="align-middle">
                        ${escapeHtml(batch.priority || "-")}
                    </td>
                    <td rowspan="${totalPieces}" class="align-middle">
                        ${getStatusBadge(batchStatus)}
                    </td>
                    <td rowspan="${totalPieces}" class="align-middle">
                        <button
                            type="button"
                            class="btn btn-sm btn-primary open-approval-btn"
                            data-id="${escapeHtml(batch.id)}"
                        >
                            <i class="bx bx-show me-1"></i>
                            View
                        </button>
                    </td>
                ` : "";

                tbody.append(`
                    <tr>
                        ${commonColumns}

                        <td class="align-middle">
                            <span class="badge bg-primary">
                                Piece ${escapeHtml(pieceNumber)}
                            </span>
                            ${itemName ? `<div class="small text-muted mt-1">${escapeHtml(itemName)}</div>` : ""}
                        </td>

                        <td style="white-space:normal;min-width:180px;">
                            ${materialsHtml}
                        </td>

                        <td style="white-space:normal;min-width:180px;">
                            ${worksHtml}
                        </td>

                        ${bottomColumns}
                    </tr>
                `);
            });
        });
    }

    /* ======================================================
       CURRENT BATCH
       ====================================================== */

    function getCurrentBatch() {
        return batchData.find(b => String(b.id) === String(currentBatchId));
    }

    /* ======================================================
       MODAL — render piece-wise cards
       ====================================================== */

    function renderApprovalPieces(batch) {

        const container = $("#approvalPiecesContainer");
        container.empty();

        const pieces = Array.isArray(batch.pieces) && batch.pieces.length
            ? batch.pieces
            : [{
                number: 1,
                item: batch.piece || "",
                materials: batch.itemList || [],
                additionalWorks: batch.additionalWork
                    ? [{ workType: batch.additionalWork, stage: "" }]
                    : []
            }];

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

            // Item availability — 3 per row (grid)
            let itemCards = "";

            if (materials.length) {
                materials.forEach((mat, matIndex) => {
                    const currentValue = availability[mat] || "";
                    const yesId = `mat_yes_${pieceNumber}_${matIndex}`;
                    const noId = `mat_no_${pieceNumber}_${matIndex}`;

                    itemCards += `
                        <div class="item-availability-card">
                            <span class="item-name">${escapeHtml(mat)}</span>

                            <div class="d-flex gap-3">
                                <div class="form-check">
                                    <input
                                        class="form-check-input piece-availability-radio"
                                        type="radio"
                                        name="availability_${pieceNumber}_${matIndex}"
                                        id="${yesId}"
                                        value="yes"
                                        data-piece="${pieceNumber}"
                                        data-item="${escapeHtml(mat)}"
                                        ${currentValue === "yes" ? "checked" : ""}
                                    >
                                    <label class="form-check-label text-success" for="${yesId}">Yes</label>
                                </div>
                                <div class="form-check">
                                    <input
                                        class="form-check-input piece-availability-radio"
                                        type="radio"
                                        name="availability_${pieceNumber}_${matIndex}"
                                        id="${noId}"
                                        value="no"
                                        data-piece="${pieceNumber}"
                                        data-item="${escapeHtml(mat)}"
                                        ${currentValue === "no" ? "checked" : ""}
                                    >
                                    <label class="form-check-label text-danger" for="${noId}">No</label>
                                </div>
                            </div>
                        </div>
                    `;
                });
            } else {
                itemCards = `
                    <div class="alert alert-warning mb-0" style="grid-column:1 / -1;">
                        No item list for this piece.
                    </div>
                `;
            }

            const worksHtml = works.length
                ? works.map(w => `
                    <div>
                        ${escapeHtml(w.workType || "-")}
                        ${w.stage ? `<span class="text-muted"> — ${escapeHtml(w.stage)}</span>` : ""}
                    </div>
                `).join("")
                : `<span class="text-muted">None</span>`;

            const statusHtml = getStatusBadge(pieceStatus);

            const isApproved = pieceStatus === "approved";
            const isMissing = pieceStatus === "missing";

            container.append(`
                <div class="card border mb-3 piece-approval-card" data-piece="${pieceNumber}">
                    <div class="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div>
                            <strong>Piece ${escapeHtml(pieceNumber)}</strong>
                            ${itemName ? `<span class="badge bg-primary ms-2">${escapeHtml(itemName)}</span>` : ""}
                        </div>
                        <div>${statusHtml}</div>
                    </div>

                    <div class="card-body">

                        <div class="row g-3 mb-3">
                            <div class="col-md-6">
                                <label class="form-label">Additional Work</label>
                                <div class="border rounded p-2" style="min-height:42px;">
                                    ${worksHtml}
                                </div>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label d-block">Quick Select</label>
                                <div class="d-flex gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        class="btn btn-sm btn-outline-primary all-yes-piece-btn"
                                        data-piece="${pieceNumber}"
                                        ${isApproved ? "disabled" : ""}
                                    >
                                        All Yes
                                    </button>
                                    <button
                                        type="button"
                                        class="btn btn-sm btn-outline-danger all-no-piece-btn"
                                        data-piece="${pieceNumber}"
                                        ${isApproved ? "disabled" : ""}
                                    >
                                        All No
                                    </button>
                                </div>
                            </div>
                        </div>

                        <label class="form-label">Item List (Availability)</label>
                        <div class="item-availability-grid mb-3">
                            ${itemCards}
                        </div>

                        <div class="row g-2">
                            <div class="col-md-6">
                                <label class="form-label">Remarks</label>
                                <textarea
                                    class="form-control piece-remarks"
                                    rows="2"
                                    data-piece="${pieceNumber}"
                                    placeholder="Optional remarks..."
                                >${escapeHtml(remarks)}</textarea>
                            </div>

                            <div class="col-md-6 d-flex align-items-end">
                                <div class="d-flex gap-2 flex-fill">
                                    <button
                                        type="button"
                                        class="btn btn-success flex-fill approve-piece-btn"
                                        data-piece="${pieceNumber}"
                                        ${isApproved || isMissing ? "disabled" : ""}
                                    >
                                        <i class="bx bx-check-circle me-1"></i> Approve
                                    </button>

                                    <button
                                        type="button"
                                        class="btn btn-warning flex-fill missing-piece-btn"
                                        data-piece="${pieceNumber}"
                                        ${isApproved || isMissing ? "disabled" : ""}
                                    >
                                        <i class="bx bx-error-circle me-1"></i> Missing
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            `);
        });
    }

    /* ======================================================
       OPEN MODAL
       ====================================================== */

    function openApprovalModal(batchId) {
        currentBatchId = batchId;

        const batch = getCurrentBatch();
        if (!batch) return;

        $("#approvalPhoto").attr("src", batch.photo || "assets/images/default.jpg");
        $("#approvalBatchId").text(batch.batchId || "-");
        $("#approvalBrand").text(batch.brand || "-");
        $("#approvalDesignNumber").text(batch.designNumber || "-");
        $("#approvalColor").text(batch.color || "-");
        $("#approvalQuantity").text(batch.quantity || "-");
        $("#approvalPriority").text(batch.priority || "-");
        $("#approvalStatus").html(getStatusBadge(batch.status || "pending"));

        renderApprovalPieces(batch);

        approvalModal.show();
    }

    /* ======================================================
       ALL YES / ALL NO per piece
       ====================================================== */

    $(document).on("click", ".all-yes-piece-btn", function () {
        const pieceNumber = $(this).data("piece");
        $(`.piece-availability-radio[data-piece="${pieceNumber}"][value="yes"]`).prop("checked", true);
    });

    $(document).on("click", ".all-no-piece-btn", function () {
        const pieceNumber = $(this).data("piece");
        $(`.piece-availability-radio[data-piece="${pieceNumber}"][value="no"]`).prop("checked", true);
    });

    /* ======================================================
       PIECE-WISE APPROVE
       ====================================================== */

    $(document).on("click", ".approve-piece-btn", function () {
        const pieceNumber = Number($(this).data("piece"));
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

        const availability = {};
        $(`.piece-availability-radio[data-piece="${pieceNumber}"]:checked`).each(function () {
            const item = $(this).data("item");
            availability[item] = $(this).val();
        });

        const unanswered = materials.filter(m => !availability[m]);
        if (unanswered.length) {
            showMessage("warning", `Please select Yes or No for: ${unanswered.join(", ")}`);
            return;
        }

        const missing = materials.filter(m => availability[m] === "no");
        if (missing.length) {
            showMessage("warning", `Some items are marked No. Use "Missing" button instead.`);
            return;
        }

        const remarks = $(`.piece-remarks[data-piece="${pieceNumber}"]`).val().trim();

        Swal.fire({
            title: `Approve Piece ${pieceNumber}?`,
            text: "All items will be marked available.",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Yes, Approve",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#198754"
        }).then(function (result) {
            if (!result.isConfirmed) return;

            const updatedPieces = [...pieces];
            updatedPieces[pieceIndex] = {
                ...piece,
                approval: {
                    status: "approved",
                    itemAvailability: availability,
                    missingItems: [],
                    remarks: remarks,
                    approvedAt: new Date().toLocaleString("en-GB")
                }
            };

            updateBatchPieces(batch, updatedPieces);

            approvalModal.hide();
            renderTable();

            Swal.fire({
                icon: "success",
                title: "Approved",
                text: `Piece ${pieceNumber} approved successfully.`,
                timer: 1500,
                showConfirmButton: false
            });
        });
    });

    /* ======================================================
       PIECE-WISE MISSING → CREATE REQUIREMENT
       ====================================================== */

    $(document).on("click", ".missing-piece-btn", function () {
        const pieceNumber = Number($(this).data("piece"));
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

        const availability = {};
        $(`.piece-availability-radio[data-piece="${pieceNumber}"]:checked`).each(function () {
            const item = $(this).data("item");
            availability[item] = $(this).val();
        });

        const unanswered = materials.filter(m => !availability[m]);
        if (unanswered.length) {
            showMessage("warning", `Please select Yes or No for: ${unanswered.join(", ")}`);
            return;
        }

        const missing = materials.filter(m => availability[m] === "no");
        if (!missing.length) {
            showMessage("warning", "No missing items selected.");
            return;
        }

        const remarks = $(`.piece-remarks[data-piece="${pieceNumber}"]`).val().trim();

        Swal.fire({
            title: `Missing Items — Piece ${pieceNumber}?`,
            html: `
                <div class="text-start">
                    <p><strong>Missing:</strong></p>
                    <ul>${missing.map(m => `<li>${escapeHtml(m)}</li>`).join("")}</ul>
                    <p class="mb-0">These items will be added to Requirements.</p>
                </div>
            `,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Create Requirement",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#dc3545"
        }).then(function (result) {
            if (!result.isConfirmed) return;

            const updatedPieces = [...pieces];
            updatedPieces[pieceIndex] = {
                ...piece,
                approval: {
                    status: "missing",
                    itemAvailability: availability,
                    missingItems: missing,
                    remarks: remarks,
                    missingMarkedAt: new Date().toLocaleString("en-GB")
                }
            };

            updateBatchPieces(batch, updatedPieces);

            createRequirement(batch, updatedPieces[pieceIndex], pieceNumber, missing);

            approvalModal.hide();
            renderTable();

            Swal.fire({
                icon: "success",
                title: "Requirement Created",
                text: `Missing items for Piece ${pieceNumber} saved.`,
                showCancelButton: true,
                confirmButtonText: "Open Requirement",
                cancelButtonText: "Close"
            }).then(function (r) {
                if (r.isConfirmed) {
                    window.location.href = "requirment.php";
                }
            });
        });
    });

    /* ======================================================
       UPDATE BATCH PIECES + AUTO STATUS
       ====================================================== */

    function updateBatchPieces(batch, updatedPieces) {

        const overallStatus = computeBatchStatus(updatedPieces);

        const index = batchData.findIndex(b => String(b.id) === String(batch.id));
        if (index === -1) return;

        batchData[index] = {
            ...batchData[index],
            pieces: updatedPieces,
            status: overallStatus,
            updatedAt: new Date().toLocaleString("en-GB")
        };

        saveStorage(BATCH_STORAGE_KEY, batchData);
    }

    /* ======================================================
       CREATE REQUIREMENT (piece-wise)
       ====================================================== */

    function createRequirement(batch, piece, pieceNumber, missingItems) {

        const requirementData = readStorage(REQUIREMENT_STORAGE_KEY);

        const existing = requirementData.find(r =>
            String(r.batchId) === String(batch.batchId) &&
            Number(r.pieceNumber) === Number(pieceNumber) &&
            r.status !== "completed"
        );

        if (existing) return existing;

        const nextId = requirementData.length
            ? Math.max(...requirementData.map(r => Number(r.id) || 0)) + 1
            : 1;

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

    /* ======================================================
       VIEW BUTTON
       ====================================================== */

    $(document).on("click", ".open-approval-btn", function () {
        const id = $(this).data("id");
        openApprovalModal(id);
    });

    /* ======================================================
       FILTERS
       ====================================================== */

    $("#approvalStatusFilter").on("change", renderTable);
    $("#approvalSearchInput").on("keyup", renderTable);

    /* ======================================================
       REFRESH
       ====================================================== */

    $("#refreshApprovalBtn").on("click", function () {
        loadData();
        renderTable();

        Swal.fire({
            icon: "success",
            title: "Refreshed",
            text: "Batch data loaded from localStorage.",
            timer: 1200,
            showConfirmButton: false
        });
    });

    /* ======================================================
       MODAL RESET
       ====================================================== */

    $("#approvalModal").on("hidden.bs.modal", function () {
        currentBatchId = null;
        $("#approvalPiecesContainer").empty();
    });

    /* ======================================================
       INITIAL LOAD
       ====================================================== */

    loadData();
    renderTable();
});