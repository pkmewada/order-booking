
$(document).ready(function () {
    "use strict";

    const BATCH_STORAGE_KEY = "batchData";
    const BOM_STORAGE_KEY = "bomMasterData";

    let batchData = [];
    let bomData = [];
    let selectedBom = null;

    const batchModal = new bootstrap.Modal(
        document.getElementById("batchModal")
    );

    const viewBatchModal = new bootstrap.Modal(
        document.getElementById("viewBatchModal")
    );

    // --------------------------------------------------
    // HELPERS
    // --------------------------------------------------

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalize(value) {
        return String(value ?? "").trim().toLowerCase();
    }

    function readStorage(key) {
        try {
            const value = localStorage.getItem(key);

            if (!value) return [];

            const parsed = JSON.parse(value);

            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("Storage read error:", error);
            return [];
        }
    }

    function saveStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error("Storage save error:", error);

            Swal.fire(
                "Storage Error",
                "Could not save data. The photo may be too large.",
                "error"
            );

            return false;
        }
    }

    function getDesignNumber(bom) {
        return String(
            bom?.designNumber ||
            bom?.designNo ||
            bom?.design ||
            ""
        ).trim();
    }

    function getBrand(bom) {
        return String(
            bom?.brand ||
            bom?.brandName ||
            ""
        ).trim();
    }

    function getColor(bom) {
        return String(
            bom?.color ||
            bom?.colour ||
            ""
        ).trim();
    }

    function getPhoto(bom) {
        return bom?.photo ||
            bom?.image ||
            bom?.designPhoto ||
            "assets/images/default.jpg";
    }

    function getToday() {
        return new Date().toLocaleDateString("en-GB");
    }

    function getNow() {
        return new Date().toLocaleString("en-GB");
    }

    function getPieces(bom) {
        if (!bom) return [];

        const pieces =
            bom.pieces ||
            bom.pieceConfigurations ||
            bom.pieceConfig ||
            bom.pieceConfiguration ||
            [];

        return Array.isArray(pieces) ? pieces : [];
    }

    function getPieceNumber(piece, index) {
        return Number(piece?.number) || index + 1;
    }

    function getPieceItem(piece) {
        return String(
            piece?.item ||
            piece?.selectItem ||
            piece?.selectedItem ||
            piece?.product ||
            ""
        ).trim();
    }

    function getMaterials(piece) {
        let materials =
            piece?.materials ||
            piece?.itemList ||
            piece?.items ||
            [];

        if (typeof materials === "string") {
            materials = materials
                .split(",")
                .map(item => item.trim())
                .filter(Boolean);
        }

        if (!Array.isArray(materials)) return [];

        return [
            ...new Set(
                materials
                    .map(item => {
                        if (typeof item === "string") {
                            return item.trim();
                        }

                        return String(
                            item?.itemName ||
                            item?.name ||
                            item?.materialName ||
                            item?.label ||
                            ""
                        ).trim();
                    })
                    .filter(Boolean)
            )
        ];
    }

    function getAdditionalWorks(piece) {
        let works =
            piece?.additionalWorks ||
            piece?.additionalWork ||
            piece?.additional_work ||
            piece?.work ||
            [];

        if (!Array.isArray(works)) {
            if (typeof works === "string" && works.trim()) {
                return [{
                    workType: works.trim(),
                    stage: ""
                }];
            }

            return [];
        }

        return works.map(work => {
            if (typeof work === "string") {
                return {
                    workType: work,
                    stage: ""
                };
            }

            return {
                workType: String(
                    work?.workType ||
                    work?.type ||
                    ""
                ).trim(),

                stage: String(
                    work?.stage ||
                    ""
                ).trim()
            };
        }).filter(work => work.workType || work.stage);
    }

    function getNextBatchId() {
        if (!batchData.length) return "BATCH-001";

        const numbers = batchData.map(batch => {
            const match = String(batch.batchId || "")
                .match(/(\d+)$/);

            return match ? Number(match[1]) : 0;
        });

        return `BATCH-${String(Math.max(...numbers, 0) + 1)
            .padStart(3, "0")}`;
    }

    function getNextNumericId() {
        if (!batchData.length) return 1;

        return Math.max(
            ...batchData.map(batch => Number(batch.id) || 0)
        ) + 1;
    }

    // --------------------------------------------------
    // BOM DATA
    // --------------------------------------------------

    function loadData() {
        batchData = readStorage(BATCH_STORAGE_KEY);
        bomData = readStorage(BOM_STORAGE_KEY);
    }

    function renderDesignSuggestions() {
        const datalist = $("#designSuggestions");

        datalist.empty();

        const designNumbers = [
            ...new Set(
                bomData
                    .map(getDesignNumber)
                    .filter(Boolean)
            )
        ];

        designNumbers.forEach(designNumber => {
            datalist.append(`
                <option value="${escapeHtml(designNumber)}"></option>
            `);
        });
    }

    // --------------------------------------------------
    // FILTERS
    // --------------------------------------------------

    function renderFilters() {
        const brands = [
            ...new Set(
                batchData
                    .map(batch => batch.brand)
                    .filter(Boolean)
            )
        ];

        const colors = [
            ...new Set(
                batchData
                    .map(batch => batch.color)
                    .filter(Boolean)
            )
        ];

        const brandFilter = $("#brandFilter");
        const colorFilter = $("#colorFilter");

        brandFilter.find("option:not(:first)").remove();
        colorFilter.find("option:not(:first)").remove();

        brands.forEach(brand => {
            brandFilter.append(`
                <option value="${escapeHtml(brand)}">
                    ${escapeHtml(brand)}
                </option>
            `);
        });

        colors.forEach(color => {
            colorFilter.append(`
                <option value="${escapeHtml(color)}">
                    ${escapeHtml(color)}
                </option>
            `);
        });
    }

    // --------------------------------------------------
    // STATUS
    // --------------------------------------------------

    function statusBadge(status) {
        const details = {
            pending: {
                className: "bg-warning text-dark",
                label: "Pending"
            },

            approved: {
                className: "bg-success",
                label: "Approved"
            },

            missing: {
                className: "bg-danger",
                label: "Missing Item"
            }
        };

        const current = details[status] || details.pending;

        return `
            <span class="badge ${current.className}">
                ${current.label}
            </span>
        `;
    }

    // --------------------------------------------------
    // PIECE HTML
    // --------------------------------------------------

    function renderMaterials(materials) {
        if (!materials.length) {
            return `<span class="text-muted">None</span>`;
        }

        return materials.map(material => `
            <span class="badge bg-light text-dark border me-1 mb-1">
                ${escapeHtml(material)}
            </span>
        `).join("");
    }

    function renderWorks(works) {
        if (!works.length) {
            return `<span class="text-muted">None</span>`;
        }

        return works.map(work => `
            <div>
                ${escapeHtml(work.workType || "-")}
                ${
                    work.stage
                        ? `<span class="text-muted"> — </span>
                           ${escapeHtml(work.stage)}`
                        : ""
                }
            </div>
        `).join("");
    }

    function renderPieceCards(pieces) {
        const container = $("#batchPiecesContainer");

        container.empty();

        if (!pieces.length) {
            container.html(`
                <div class="alert alert-warning">
                    No piece configuration found in this BOM.
                </div>
            `);

            return;
        }

        pieces.forEach((piece, index) => {
            const number = getPieceNumber(piece, index);
            const item = getPieceItem(piece);
            const materials = getMaterials(piece);
            const works = getAdditionalWorks(piece);

            container.append(`
                <div class="card border mb-3">
                    <div class="card-header d-flex
                                align-items-center
                                justify-content-between">

                        <strong>Piece ${number}</strong>

                        <span class="badge bg-primary">
                            ${escapeHtml(item || "No Item")}
                        </span>
                    </div>

                    <div class="card-body">
                        <div class="row g-3">

                            <div class="col-md-4">
                                <label class="form-label">
                                    Select Item
                                </label>

                                <input type="text"
                                       class="form-control"
                                       value="${escapeHtml(item || "-")}"
                                       readonly>
                            </div>

                            <div class="col-md-4">
                                <label class="form-label">
                                    Item List
                                </label>

                                <div class="border rounded p-2"
                                     style="min-height:42px;">
                                    ${renderMaterials(materials)}
                                </div>
                            </div>

                            <div class="col-md-4">
                                <label class="form-label">
                                    Additional Work
                                </label>

                                <div class="border rounded p-2"
                                     style="min-height:42px;">
                                    ${renderWorks(works)}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            `);
        });
    }

    // --------------------------------------------------
    // DESIGN SELECTION
    // --------------------------------------------------

    function fillDesignData() {
        const designNumber = normalize(
            $("#designNumber").val()
        );

        selectedBom = bomData.find(bom => {
            return normalize(getDesignNumber(bom)) === designNumber;
        });

        if (!selectedBom) {
            $("#brandSelect").val("");
            $("#colorSelect").val("");

            $("#batchPhotoPreview").attr(
                "src",
                "assets/images/default.jpg"
            );

            $("#batchPiecesContainer").html(`
                <div class="alert alert-warning">
                    Design number not found in BOM Master.
                </div>
            `);

            return;
        }

        $("#brandSelect").val(getBrand(selectedBom));
        $("#colorSelect").val(getColor(selectedBom));

        $("#batchPhotoPreview").attr(
            "src",
            getPhoto(selectedBom)
        );

        renderPieceCards(getPieces(selectedBom));
    }

    // --------------------------------------------------
    // RESET
    // --------------------------------------------------

    function resetForm() {
        $("#batchForm")[0].reset();

        $("#editBatchId").val("");

        $("#batchIdPreview").val(getNextBatchId());

        $("#createdAtPreview").val(getToday());

        $("#batchPhotoPreview").attr(
            "src",
            "assets/images/default.jpg"
        );

        $("#batchPiecesContainer").html(`
            <div class="text-muted border rounded p-4 text-center">
                Select a design number to load all BOM pieces.
            </div>
        `);

        $("#batchModalLabel").text("Create Batch");

        $("#batchFormMessage").hide().html("");

        selectedBom = null;
    }

    // --------------------------------------------------
    // FORM MESSAGE
    // --------------------------------------------------

    function showFormMessage(type, message) {
        $("#batchFormMessage")
            .removeClass(
                "alert-warning alert-danger alert-success"
            )
            .addClass(`alert-${type}`)
            .html(message)
            .show();
    }

    // --------------------------------------------------
    // CREATE BATCH
    // --------------------------------------------------

    $("#createBatchBtn").on("click", function () {
        resetForm();
        batchModal.show();
    });

    $("#designNumber").on("input change", function () {
        fillDesignData();
    });

    // --------------------------------------------------
    // SAVE BATCH
    // --------------------------------------------------

    $("#batchForm").on("submit", function (event) {
        event.preventDefault();

        const designNumber = $("#designNumber")
            .val()
            .trim();

        const quantity = Number(
            $("#quantityInput").val()
        );

        const priority = $("#prioritySelect").val();

        if (!selectedBom) {
            showFormMessage(
                "warning",
                "Please select a valid design number from BOM Master."
            );

            return;
        }

        const pieces = getPieces(selectedBom);

        if (!pieces.length) {
            showFormMessage(
                "warning",
                "No pieces found for this BOM design."
            );

            return;
        }

        if (!quantity || quantity < 1) {
            showFormMessage(
                "warning",
                "Please enter a valid quantity."
            );

            return;
        }

        if (!priority) {
            showFormMessage(
                "warning",
                "Please select priority."
            );

            return;
        }

        const editId = $("#editBatchId").val();

        const oldBatch = editId
            ? batchData.find(batch =>
                String(batch.id) === String(editId)
            )
            : null;

        const now = getNow();

        const batchRecord = {
            id: editId
                ? Number(editId)
                : getNextNumericId(),

            batchId: oldBatch
                ? oldBatch.batchId
                : getNextBatchId(),

            bomId: selectedBom.id ||
                selectedBom.bomId ||
                "",

            brand: getBrand(selectedBom),

            designNumber: designNumber,

            color: getColor(selectedBom),

            photo: getPhoto(selectedBom),

            quantity: quantity,

            priority: priority,

            status: oldBatch?.status || "pending",

            pieces: pieces.map((piece, index) => ({
                number: getPieceNumber(piece, index),
                item: getPieceItem(piece),
                materials: getMaterials(piece),
                additionalWorks: getAdditionalWorks(piece)
            })),

            createdAt: oldBatch?.createdAt || now,

            updatedAt: now
        };

        if (editId) {
            const index = batchData.findIndex(batch =>
                String(batch.id) === String(editId)
            );

            if (index === -1) return;

            batchData[index] = batchRecord;
        } else {
            batchData.push(batchRecord);
        }

        if (!saveStorage(BATCH_STORAGE_KEY, batchData)) {
            return;
        }

        batchModal.hide();

        renderFilters();
        renderTable();

        Swal.fire({
            icon: "success",
            title: editId ? "Batch Updated" : "Batch Created",
            text: `${batchRecord.batchId} saved successfully.`,
            timer: 1800,
            showConfirmButton: false
        });
    });

    // --------------------------------------------------
    // TABLE
    // --------------------------------------------------
function renderTable() {
    const tbody = $("#batchTableBody");

    tbody.empty();

    const brandFilter = normalize($("#brandFilter").val());
    const priorityFilter = normalize($("#priorityFilter").val());
    const colorFilter = normalize($("#colorFilter").val());
    const searchTerm = normalize($("#batchSearch").val());

    const filteredBatches = batchData.filter(batch => {
        const searchableText = [
            batch.batchId,
            batch.brand,
            batch.designNumber,
            batch.color,
            batch.quantity,
            batch.priority,
            ...(batch.pieces || []).map(piece => [
                piece.item,
                ...(piece.materials || []),
                ...(piece.additionalWorks || []).map(
                    work => `${work.workType} ${work.stage}`
                )
            ].join(" "))
        ].join(" ");

        return (
            (!brandFilter ||
                normalize(batch.brand) === brandFilter) &&

            (!priorityFilter ||
                normalize(batch.priority) === priorityFilter) &&

            (!colorFilter ||
                normalize(batch.color) === colorFilter) &&

            (!searchTerm ||
                normalize(searchableText).includes(searchTerm))
        );
    });

    if (!filteredBatches.length) {
        tbody.html(`
            <tr>
                <td colspan="13" class="text-center text-muted py-4">
                    <i class="bx bx-info-circle me-1"></i>
                    No batch found.
                </td>
            </tr>
        `);

        return;
    }

    filteredBatches.forEach(batch => {

        const pieces = Array.isArray(batch.pieces) &&
            batch.pieces.length
            ? batch.pieces
            : [{
                number: 1,
                item: batch.piece || "",
                materials: batch.itemList || [],
                additionalWorks: batch.additionalWork
                    ? [{
                        workType: batch.additionalWork,
                        stage: ""
                    }]
                    : []
            }];

        const totalPieces = pieces.length;

        pieces.forEach((piece, index) => {

            const pieceNumber = piece.number || index + 1;

            // Common batch columns — only first row
            const commonColumns = index === 0 ? `

                <td rowspan="${totalPieces}" class="align-middle">
                    <strong>${escapeHtml(batch.batchId)}</strong>
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

                <td rowspan="${totalPieces}" class="align-middle">
                    <img
                        src="${escapeHtml(
                            batch.photo || "assets/images/default.jpg"
                        )}"
                        alt="Batch Photo"
                        style="
                            width:55px;
                            height:55px;
                            object-fit:cover;
                            border-radius:6px;
                        "
                        onerror="
                            this.src='assets/images/default.jpg';
                        "
                    >
                </td>

            ` : "";

            const commonBottomColumns = index === 0 ? `

                <td rowspan="${totalPieces}" class="align-middle">
                    ${escapeHtml(batch.quantity || "0")}
                </td>

                <td rowspan="${totalPieces}" class="align-middle">
                    ${escapeHtml(batch.priority || "-")}
                </td>

                <td rowspan="${totalPieces}" class="align-middle">
                    ${statusBadge(batch.status || "pending")}
                </td>

                <td rowspan="${totalPieces}" class="align-middle">
                    ${escapeHtml(batch.createdAt || "-")}
                </td>

                <td rowspan="${totalPieces}" class="align-middle">
                    <div class="d-flex gap-1 flex-wrap">

                        <button
                            type="button"
                            class="btn btn-sm btn-info view-batch-btn"
                            data-id="${escapeHtml(batch.id)}"
                            title="View">
                            <i class="bx bx-show"></i>
                        </button>

                        <button
                            type="button"
                            class="btn btn-sm btn-primary edit-batch-btn"
                            data-id="${escapeHtml(batch.id)}"
                            title="Edit">
                            <i class="bx bx-edit"></i>
                        </button>

                        <button
                            type="button"
                            class="btn btn-sm btn-danger delete-batch-btn"
                            data-id="${escapeHtml(batch.id)}"
                            title="Delete">
                            <i class="bx bx-trash"></i>
                        </button>

                    </div>
                </td>

            ` : "";

            tbody.append(`

                <tr>

                    ${commonColumns}

                    <!-- Piece-specific columns -->
                    <td class="align-middle">
                        <span class="badge bg-primary">
                            Piece ${escapeHtml(pieceNumber)}
                        </span>
                    </td>

                    <td class="align-middle">
                        ${renderMaterials(piece.materials || [])}
                    </td>

                    <td class="align-middle">
                        ${renderWorks(piece.additionalWorks || [])}
                    </td>

                    ${commonBottomColumns}

                </tr>

            `);
        });
    });
}

    // --------------------------------------------------
    // EDIT BATCH
    // --------------------------------------------------

    $(document).on("click", ".edit-batch-btn", function () {
        const id = Number($(this).data("id"));

        const batch = batchData.find(item =>
            Number(item.id) === id
        );

        if (!batch) return;

        $("#batchModalLabel").text("Edit Batch");

        $("#editBatchId").val(batch.id);

        $("#batchIdPreview").val(batch.batchId);

        $("#designNumber").val(batch.designNumber);

        $("#quantityInput").val(batch.quantity);

        $("#prioritySelect").val(batch.priority);

        $("#createdAtPreview").val(batch.createdAt);

        fillDesignData();

        batchModal.show();
    });

    // --------------------------------------------------
    // DELETE BATCH
    // --------------------------------------------------

    $(document).on("click", ".delete-batch-btn", function () {
        const id = Number($(this).data("id"));

        const batch = batchData.find(item =>
            Number(item.id) === id
        );

        if (!batch) return;

        Swal.fire({
            title: "Delete Batch?",
            text: `${batch.batchId} will be deleted.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, Delete",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#dc3545"
        }).then(function (result) {
            if (!result.isConfirmed) return;

            batchData = batchData.filter(item =>
                Number(item.id) !== id
            );

            if (!saveStorage(BATCH_STORAGE_KEY, batchData)) {
                return;
            }

            renderFilters();
            renderTable();

            Swal.fire({
                icon: "success",
                title: "Deleted",
                text: "Batch deleted successfully.",
                timer: 1500,
                showConfirmButton: false
            });
        });
    });

    // --------------------------------------------------
    // VIEW BATCH
    // --------------------------------------------------

    $(document).on("click", ".view-batch-btn", function () {
        const id = Number($(this).data("id"));

        const batch = batchData.find(item =>
            Number(item.id) === id
        );

        if (!batch) return;

        $("#viewBatchPhoto").attr(
            "src",
            batch.photo || "assets/images/default.jpg"
        );

        $("#viewBatchId").text(batch.batchId || "-");

        $("#viewBatchBrand").text(batch.brand || "-");

        $("#viewBatchDesign").text(batch.designNumber || "-");

        $("#viewBatchColor").text(batch.color || "-");

        $("#viewBatchPiece").text(
            `${(batch.pieces || []).length} Pieces`
        );

        $("#viewBatchQuantity").text(batch.quantity || "-");

        $("#viewBatchPriority").text(batch.priority || "-");

        $("#viewBatchCreatedAt").text(batch.createdAt || "-");

        $("#viewBatchStatus").html(
            statusBadge(batch.status || "pending")
        );

        const container = $("#viewBatchItems");

        container.empty();

        const pieces = batch.pieces || [];

        if (!pieces.length) {
            container.html(`
                <span class="text-muted">
                    No piece details found.
                </span>
            `);
        } else {
            pieces.forEach((piece, index) => {
                container.append(`
                    <div class="card border mb-3">

                        <div class="card-header">
                            <strong>
                                Piece ${escapeHtml(
                                    piece.number || index + 1
                                )}
                            </strong>
                        </div>

                        <div class="card-body">

                            <div class="row g-3">

                                <div class="col-md-4">
                                    <strong>Select Item:</strong>
                                    <div class="mt-2">
                                        ${escapeHtml(
                                            piece.item || "-"
                                        )}
                                    </div>
                                </div>

                                <div class="col-md-4">
                                    <strong>Item List:</strong>
                                    <div class="mt-2">
                                        ${renderMaterials(
                                            piece.materials || []
                                        )}
                                    </div>
                                </div>

                                <div class="col-md-4">
                                    <strong>Additional Work:</strong>
                                    <div class="mt-2">
                                        ${renderWorks(
                                            piece.additionalWorks || []
                                        )}
                                    </div>
                                </div>

                            </div>

                        </div>
                    </div>
                `);
            });
        }

        viewBatchModal.show();
    });

    // --------------------------------------------------
    // FILTERS
    // --------------------------------------------------

    $("#brandFilter, #priorityFilter, #colorFilter").on(
        "change",
        renderTable
    );

    $("#batchSearch").on("keyup", renderTable);

    $("#batchModal").on("hidden.bs.modal", function () {
        resetForm();
    });

    // --------------------------------------------------
    // INITIAL LOAD
    // --------------------------------------------------

    loadData();
    renderDesignSuggestions();
    renderFilters();
    renderTable();

});