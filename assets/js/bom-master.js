
$(document).ready(function () {
    "use strict";

    const STORAGE_KEY = "bomMasterData";

    const ITEMS = ["Jacket", "Shirt", "Inner", "Cap", "Jeans"];

    const MATERIALS = [
        "Main Fabric",
        "Cotton",
        "Net",
        "Satin",
        "Zip",
        "Elastic"
    ];

    const WORK_TYPES = [
        "Digital Print",
        "Embroidery",
        "Peco",
        "Screen Print",
        "Hand Work"
    ];

    const STAGES = [
        "Before Cutting",
        "Before Stitching",
        "Before Ironing",
        "After Cutting",
        "After Stitching",
        "After Ironing"
    ];

    let bomData = loadData();
    let nextId = getNextId();
    let currentPhoto = "";
    let editPieces = null;

    // --------------------------------------------------
    // LOCAL STORAGE
    // --------------------------------------------------

    function loadData() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(bomData));
            return true;
        } catch (error) {
            Swal.fire(
                "Storage Error",
                "Could not save BOM. The photo may be too large.",
                "error"
            );
            return false;
        }
    }

    function getNextId() {
        if (!bomData.length) return 1;

        return Math.max(
            ...bomData.map(item => Number(item.id) || 0)
        ) + 1;
    }

    function generateBomId() {
        return "BOM-" + String(nextId).padStart(3, "0");
    }

    // --------------------------------------------------
    // SECURITY / HELPERS
    // --------------------------------------------------

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getToday() {
        return new Date().toLocaleDateString();
    }

    function optionList(options, selected = "") {
        let html = `<option value="">Select</option>`;

        options.forEach(option => {
            html += `
                <option value="${escapeHtml(option)}"
                    ${option === selected ? "selected" : ""}>
                    ${escapeHtml(option)}
                </option>
            `;
        });

        return html;
    }

    function getPieceCount() {
        return Number($(".piece-radio:checked").val()) || 0;
    }

    // --------------------------------------------------
    // DYNAMIC PIECE TABLE
    // --------------------------------------------------

    function renderPieceTable(existingPieces = null) {
        const count = getPieceCount();
        const tbody = $("#pieceConfigBody");

        tbody.empty();

        if (!count) {
            tbody.html(`
                <tr>
                    <td colspan="4" class="text-center text-muted py-4">
                        Select 1–5 Pic to configure pieces.
                    </td>
                </tr>
            `);
            return;
        }

        for (let i = 1; i <= count; i++) {
            const oldPiece = existingPieces?.find(
                piece => Number(piece.number) === i
            ) || {};

            const materials = oldPiece.materials || [];
            const works = oldPiece.additionalWorks || [];

            const materialHtml = MATERIALS.map((material, index) => {
                const checked = materials.includes(material)
                    ? "checked"
                    : "";

                return `
                    <div class="form-check mb-1">
                        <input class="form-check-input material-check"
                               type="checkbox"
                               value="${escapeHtml(material)}"
                               data-piece="${i}"
                               id="piece${i}material${index}"
                               ${checked}>

                        <label class="form-check-label"
                               for="piece${i}material${index}">
                            ${escapeHtml(material)}
                        </label>
                    </div>
                `;
            }).join("");

            const workHtml = works.map(work => {
                return createWorkRowHtml(
                    i,
                    work.workType || "",
                    work.stage || ""
                );
            }).join("");

            tbody.append(`
                <tr data-piece-row="${i}">

                    <td>
                        <span class="badge bg-primary fs-6">
                            ${i} Piece
                        </span>
                    </td>

                    <td>
                        <select class="form-select piece-item"
                                data-piece="${i}" required>
                            ${optionList(ITEMS, oldPiece.item || "")}
                        </select>
                    </td>

                    <td>
                        <div class="border rounded p-2">
                            ${materialHtml}
                        </div>
                    </td>

                    <td>
                        <div class="piece-work-container"
                             data-piece="${i}">
                            ${workHtml}
                        </div>

                        <button type="button"
                                class="btn btn-sm btn-primary mt-2 add-work-btn"
                                data-piece="${i}">
                            <i class="bx bx-plus"></i>
                            Add Work
                        </button>
                    </td>

                </tr>
            `);
        }
    }

    // --------------------------------------------------
    // ADDITIONAL WORK ROWS
    // --------------------------------------------------

    function createWorkRowHtml(piece, selectedType = "", selectedStage = "") {
        return `
            <div class="additional-work-row border rounded p-2 mb-2"
                 data-piece="${piece}">

                <div class="row g-2 align-items-center">

                    <div class="col-md-5">
                        <select class="form-select form-select-sm work-type"
                                required>
                            ${optionList(WORK_TYPES, selectedType)}
                        </select>
                    </div>

                    <div class="col-md-5">
                        <select class="form-select form-select-sm work-stage"
                                required>
                            ${optionList(STAGES, selectedStage)}
                        </select>
                    </div>

                    <div class="col-md-2">
                        <button type="button"
                                class="btn btn-sm btn-danger remove-work-btn"
                                title="Remove Work">
                            <i class="bx bx-trash"></i>
                        </button>
                    </div>

                </div>
            </div>
        `;
    }

    $(document).on("click", ".add-work-btn", function () {
        const piece = Number($(this).data("piece"));

        $(`.piece-work-container[data-piece="${piece}"]`).append(
            createWorkRowHtml(piece)
        );
    });

    $(document).on("click", ".remove-work-btn", function () {
        $(this).closest(".additional-work-row").remove();
    });

    // --------------------------------------------------
    // RADIO CHANGE
    // --------------------------------------------------

    $(".piece-radio").on("change", function () {
        const previousPieces = collectPieces(false);

        renderPieceTable(previousPieces);
    });

    // --------------------------------------------------
    // COLLECT PIECE DATA
    // --------------------------------------------------

    function collectPieces(showErrors = true) {
        const pieces = [];

        $(".piece-item").each(function () {
            const pieceNumber = Number($(this).data("piece"));
            const item = $(this).val();

            const materials = $(
                `.material-check[data-piece="${pieceNumber}"]:checked`
            ).map(function () {
                return $(this).val();
            }).get();

            const additionalWorks = [];

            $(`.piece-work-container[data-piece="${pieceNumber}"] 
               .additional-work-row`).each(function () {

                const workType = $(this).find(".work-type").val();
                const stage = $(this).find(".work-stage").val();

                if (workType && stage) {
                    additionalWorks.push({
                        workType: workType,
                        stage: stage
                    });
                } else if (showErrors) {
                    $(this).addClass("border-danger");
                }
            });

            pieces.push({
                number: pieceNumber,
                item: item,
                materials: materials,
                additionalWorks: additionalWorks
            });
        });

        return pieces;
    }

    // --------------------------------------------------
    // PHOTO
    // --------------------------------------------------

    function renderPhotoPreview(photo) {
        if (!photo) {
            $("#photoPreview").empty();
            return;
        }

        $("#photoPreview").html(`
            <img src="${escapeHtml(photo)}"
                 alt="BOM Photo"
                 style="
                    width:120px;
                    height:120px;
                    object-fit:cover;
                    border-radius:8px;
                    border:1px solid #ddd;
                 ">
        `);
    }

    $("#photoUpload").on("change", function () {
        const file = this.files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            Swal.fire("Invalid File", "Choose an image file.", "warning");
            this.value = "";
            return;
        }

        const reader = new FileReader();

        reader.onload = function (event) {
            currentPhoto = event.target.result;
            renderPhotoPreview(currentPhoto);
        };

        reader.readAsDataURL(file);
    });

    // --------------------------------------------------
    // RESET FORM
    // --------------------------------------------------

    function resetForm() {
        $("#bomForm")[0].reset();

        $("#editId").val("");
        $("#bomModalLabel").text("Create BOM Master");

        currentPhoto = "";
        editPieces = null;

        $("#photoUpload").val("");
        $("#photoPreview").empty();

        $(".piece-radio").prop("checked", false);

        $("#pieceConfigBody").html(`
            <tr>
                <td colspan="4" class="text-center text-muted py-4">
                    Select 1–5 Pic to configure pieces.
                </td>
            </tr>
        `);
    }

    $("#createBomBtn").on("click", function () {
        resetForm();
        $("#bomModal").modal("show");
    });

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    function validateForm() {
        const brand = $("#brandSelect").val();
        const design = $("#designNumber").val().trim();
        const color = $("#colorSelect").val();
        const pieceCount = getPieceCount();

        if (!brand || !design || !color) {
            Swal.fire(
                "Incomplete Form",
                "Please fill brand, design number and color.",
                "warning"
            );
            return false;
        }

        if (!pieceCount) {
            Swal.fire(
                "Select Pieces",
                "Please select 1–5 Pic.",
                "warning"
            );
            return false;
        }

        let missingItem = false;

        $(".piece-item").each(function () {
            if (!$(this).val()) {
                missingItem = true;
            }
        });

        if (missingItem) {
            Swal.fire(
                "Select Item",
                "Please select an item for every piece.",
                "warning"
            );
            return false;
        }

        let incompleteWork = false;

        $(".additional-work-row").each(function () {
            const type = $(this).find(".work-type").val();
            const stage = $(this).find(".work-stage").val();

            if (!type || !stage) {
                incompleteWork = true;
            }
        });

        if (incompleteWork) {
            Swal.fire(
                "Incomplete Work",
                "Please select work type and stage for every row.",
                "warning"
            );
            return false;
        }

        return true;
    }

    // --------------------------------------------------
    // SAVE / UPDATE
    // --------------------------------------------------

    $("#saveBomBtn").on("click", function () {
        if (!validateForm()) return;

        const editId = $("#editId").val();

        const bom = {
            brand: $("#brandSelect").val(),
            designNumber: $("#designNumber").val().trim(),
            color: $("#colorSelect").val(),
            pieceCount: getPieceCount(),
            pieces: collectPieces(),
            photo: currentPhoto
        };

        if (editId) {
            const index = bomData.findIndex(
                item => Number(item.id) === Number(editId)
            );

            if (index === -1) return;

            bomData[index] = {
                ...bomData[index],
                ...bom,
                updatedAt: getToday()
            };

            if (!saveData()) return;

            Swal.fire({
                icon: "success",
                title: "Updated!",
                text: "BOM updated successfully.",
                timer: 1500,
                showConfirmButton: false
            });

        } else {
            const newBom = {
                id: nextId,
                bomId: generateBomId(),
                ...bom,
                createdAt: getToday(),
                updatedAt: getToday()
            };

            bomData.push(newBom);
            nextId++;

            if (!saveData()) {
                bomData.pop();
                nextId--;
                return;
            }

            Swal.fire({
                icon: "success",
                title: "Created!",
                text: `${newBom.bomId} created successfully.`,
                timer: 1500,
                showConfirmButton: false
            });
        }

        renderTable();
        $("#bomModal").modal("hide");
    });

    // --------------------------------------------------
    // EDIT
    // --------------------------------------------------

    $(document).on("click", ".edit-bom-btn", function () {
        const id = Number($(this).data("id"));

        const bom = bomData.find(
            item => Number(item.id) === id
        );

        if (!bom) return;

        $("#editId").val(bom.id);

        $("#brandSelect").val(bom.brand);
        $("#designNumber").val(bom.designNumber);
        $("#colorSelect").val(bom.color);

        currentPhoto = bom.photo || "";
        renderPhotoPreview(currentPhoto);

        $(".piece-radio").prop("checked", false);
        $(`.piece-radio[value="${bom.pieceCount}"]`)
            .prop("checked", true);

        renderPieceTable(bom.pieces || []);

        $("#bomModalLabel").text("Edit BOM Master");
        $("#bomModal").modal("show");
    });

    // --------------------------------------------------
    // VIEW
    // --------------------------------------------------

    function renderViewBom(bom) {
        const photoHtml = bom.photo
            ? `
                <img src="${escapeHtml(bom.photo)}"
                     alt="BOM Photo"
                     style="
                        width:180px;
                        height:180px;
                        object-fit:cover;
                        border-radius:8px;
                     ">
              `
            : `<div class="text-muted">No Photo</div>`;

        const rows = (bom.pieces || []).map(piece => {
            const materials = piece.materials?.length
                ? piece.materials.map(material =>
                    `<span class="badge bg-light text-dark border me-1 mb-1">
                        ${escapeHtml(material)}
                    </span>`
                ).join("")
                : `<span class="text-muted">None</span>`;

            const works = piece.additionalWorks?.length
                ? piece.additionalWorks.map(work =>
                    `<div>
                        ${escapeHtml(work.workType)}
                        <span class="text-muted">—</span>
                        ${escapeHtml(work.stage)}
                    </div>`
                ).join("")
                : `<span class="text-muted">None</span>`;

            return `
                <tr>
                    <td>Piece ${piece.number}</td>
                    <td>${escapeHtml(piece.item)}</td>
                    <td>${materials}</td>
                    <td>${works}</td>
                </tr>
            `;
        }).join("");

        $("#viewBomBody").html(`
            <div class="row g-4 mb-4">
                <div class="col-md-4 text-center">
                    ${photoHtml}
                </div>

                <div class="col-md-8">
                    <h5>${escapeHtml(bom.bomId)}</h5>

                    <table class="table table-bordered">
                        <tr>
                            <th>Brand</th>
                            <td>${escapeHtml(bom.brand)}</td>
                        </tr>
                        <tr>
                            <th>Design Number</th>
                            <td>${escapeHtml(bom.designNumber)}</td>
                        </tr>
                        <tr>
                            <th>Color</th>
                            <td>${escapeHtml(bom.color)}</td>
                        </tr>
                        <tr>
                            <th>Piece</th>
                            <td>${bom.pieceCount} Pic</td>
                        </tr>
                        <tr>
                            <th>Created At</th>
                            <td>${escapeHtml(bom.createdAt)}</td>
                        </tr>
                    </table>
                </div>
            </div>

            <h5 class="mb-3">Piece Configuration</h5>

            <div class="table-responsive">
                <table class="table table-bordered align-middle">
                    <thead class="table-light">
                        <tr>
                            <th>Piece</th>
                            <th>Select Item</th>
                            <th>Item List</th>
                            <th>Additional Work</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `);

        $("#viewBomModal").modal("show");
    }

    $(document).on("click", ".view-bom-btn", function () {
        const id = Number($(this).data("id"));

        const bom = bomData.find(
            item => Number(item.id) === id
        );

        if (bom) renderViewBom(bom);
    });

    // --------------------------------------------------
    // DELETE
    // --------------------------------------------------

    $(document).on("click", ".delete-bom-btn", function () {
        const id = Number($(this).data("id"));

        const bom = bomData.find(
            item => Number(item.id) === id
        );

        if (!bom) return;

        Swal.fire({
            icon: "warning",
            title: "Delete BOM?",
            text: `${bom.bomId} will be permanently removed from this browser.`,
            showCancelButton: true,
            confirmButtonText: "Yes, Delete",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#d33"
        }).then(function (result) {
            if (!result.isConfirmed) return;

            const oldData = [...bomData];

            bomData = bomData.filter(
                item => Number(item.id) !== id
            );

            if (!saveData()) {
                bomData = oldData;
                return;
            }

            renderTable();

            Swal.fire({
                icon: "success",
                title: "Deleted!",
                text: "BOM deleted successfully.",
                timer: 1200,
                showConfirmButton: false
            });
        });
    });

    // --------------------------------------------------
    // TABLE
    // --------------------------------------------------

    function renderTable() {
        const tbody = $("#bomTableBody");
        tbody.empty();

        const brandFilter = $("#brandFilter").val();
        const pieceFilter = $("#pieceFilter").val();
        const search = $("#searchInput").val().toLowerCase().trim();

        const filtered = bomData.filter(bom => {
            const matchesBrand =
                !brandFilter || bom.brand === brandFilter;

            const matchesPiece =
                !pieceFilter ||
                Number(bom.pieceCount) === Number(pieceFilter);

            const searchable = [
                bom.bomId,
                bom.brand,
                bom.designNumber,
                bom.color,
                bom.pieceCount
            ].join(" ").toLowerCase();

            return matchesBrand &&
                matchesPiece &&
                (!search || searchable.includes(search));
        });

        if (!filtered.length) {
            tbody.html(`
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        No BOM records found.
                    </td>
                </tr>
            `);
            return;
        }

        filtered.forEach(bom => {
            const photo = bom.photo
                ? `
                    <img src="${escapeHtml(bom.photo)}"
                         alt="BOM Photo"
                         class="bom-thumb"
                         data-photo="${escapeHtml(bom.photo)}"
                         style="
                            width:60px;
                            height:60px;
                            object-fit:cover;
                            border-radius:6px;
                            border:1px solid #ddd;
                            cursor:pointer;
                         ">
                  `
                : `<span class="text-muted small">No Photo</span>`;

            tbody.append(`
                <tr>
                    <td>
                        <strong>${escapeHtml(bom.bomId)}</strong>
                    </td>

                    <td>${escapeHtml(bom.brand)}</td>

                    <td>${photo}</td>

                    <td>${escapeHtml(bom.color)}</td>

                    <td>${escapeHtml(bom.designNumber)}</td>

                    <td>
                        <span class="badge bg-primary">
                            ${bom.pieceCount} Pic
                        </span>
                    </td>

                    <td>
                        <div class="d-flex gap-1 flex-wrap">

                            <button class="btn btn-sm btn-info view-bom-btn"
                                    data-id="${bom.id}"
                                    title="View">
                                <i class="bx bx-show"></i>
                            </button>

                            <button class="btn btn-sm btn-primary edit-bom-btn"
                                    data-id="${bom.id}"
                                    title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>

                            <button class="btn btn-sm btn-danger delete-bom-btn"
                                    data-id="${bom.id}"
                                    title="Delete">
                                <i class="bx bx-trash"></i>
                            </button>

                        </div>
                    </td>
                </tr>
            `);
        });
    }

    // --------------------------------------------------
    // LARGE PHOTO
    // --------------------------------------------------

    $(document).on("click", ".bom-thumb", function () {
        const photo = $(this).data("photo");

        Swal.fire({
            title: "BOM Photo",
            imageUrl: photo,
            imageAlt: "BOM Photo",
            showCloseButton: true,
            showConfirmButton: false,
            width: 600
        });
    });

    // --------------------------------------------------
    // FILTERS / MODAL
    // --------------------------------------------------

    $("#brandFilter, #pieceFilter").on("change", renderTable);

    $("#searchInput").on("keyup", renderTable);

    $("#bomModal").on("hidden.bs.modal", resetForm);

    // Initial table
    renderTable();
});