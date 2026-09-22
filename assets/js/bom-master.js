$(document).ready(function () {
    "use strict";

    const STORAGE_KEY = "bomMasterData";

    const MATERIALS = [
        "Main Fabric",
        "Cotton",
        "Net",
        "Satin",
        "Zip",
        "Elastic"
    ];

    const ITEMS = [
        "Jacket",
        "Shirt",
        "Inner",
        "Cap",
        "Jeans"
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

    const FIXED_FLOW_STAGES = [
        "Cutting",
        "Stitching",
        "Ironing"
    ];

    const FLOW_STAGE_ORDER = [
        "Before Cutting",
        "Cutting",
        "After Cutting",
        "Before Stitching",
        "Stitching",
        "After Stitching",
        "Before Ironing",
        "Ironing",
        "After Ironing"
    ];

    const DEFAULT_WORK_ROWS = 3;

    let bomData = loadData();
    let nextId = getNextId();
    let currentPhoto = "";

    /* ======================================================
       SWEETALERT WRAPPER
       ====================================================== */

    function hasSwal() {
        return typeof Swal !== "undefined";
    }

    function alertMsg(message, type) {
        if (hasSwal()) {
            Swal.fire({
                icon: type || "info",
                text: message,
                confirmButtonColor: "#161617"
            });
        } else {
            alert(message);
        }
    }

    function confirmBox(message) {
        if (hasSwal()) {
            return Swal.fire({
                icon: "warning",
                text: message,
                showCancelButton: true,
                confirmButtonText: "Yes",
                cancelButtonText: "Cancel",
                confirmButtonColor: "#161617",
                cancelButtonColor: "#6c757d"
            }).then(function (result) {
                return !!result.isConfirmed;
            });
        }

        return Promise.resolve(confirm(message));
    }

    /* ======================================================
       LOCAL STORAGE
       ====================================================== */

    function loadData() {
        try {
            const data = JSON.parse(
                localStorage.getItem(STORAGE_KEY)
            );

            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error("BOM load error:", error);
            return [];
        }
    }

    function saveData() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(bomData)
            );

            return true;
        } catch (error) {
            console.error("BOM save error:", error);

            alertMsg(
                "BOM save nahi ho paya. Photo size chhota karke try karein.",
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

    function getToday() {
        return new Date().toLocaleDateString("en-IN");
    }

    function getPieceCount() {
        return Number(
            $(".piece-radio:checked").val()
        ) || 0;
    }

    function getExistingPiece(pieces, number) {
        if (!Array.isArray(pieces)) return {};

        return pieces.find(piece =>
            Number(piece.number) === Number(number)
        ) || {};
    }

    function optionList(
        options,
        selected = "",
        placeholder = "Select"
    ) {
        let html = `
            <option value="">
                ${escapeHtml(placeholder)}
            </option>
        `;

        options.forEach(option => {
            html += `
                <option
                    value="${escapeHtml(option)}"
                    ${option === selected ? "selected" : ""}
                >
                    ${escapeHtml(option)}
                </option>
            `;
        });

        return html;
    }

    /* ======================================================
       ITEM LIST — 6 COLUMNS (ONE ROW)
       ====================================================== */

    function createMaterialListHtml(
        pieceNumber,
        selectedMaterials = []
    ) {
        return MATERIALS.map((material, index) => {

            const checked = selectedMaterials.includes(material)
                ? "checked"
                : "";

            return `
                <div class="form-check">

                    <input
                        type="checkbox"
                        class="form-check-input material-check"
                        data-piece="${pieceNumber}"
                        id="material-${pieceNumber}-${index}"
                        value="${escapeHtml(material)}"
                        ${checked}
                    >

                    <label
                        class="form-check-label"
                        for="material-${pieceNumber}-${index}"
                    >
                        ${escapeHtml(material)}
                    </label>

                </div>
            `;

        }).join("");
    }

    /* ======================================================
       ADDITIONAL WORK ROW — 2 INPUTS + BUTTON
       ====================================================== */

    function createWorkRowHtml(
        pieceNumber,
        workType = "",
        stage = "",
        isLast = false
    ) {
        const buttonClass = isLast ? "add" : "delete";
        const buttonIcon = isLast ? "bx-plus" : "bx-trash";
        const buttonTitle = isLast ? "Add Work" : "Delete Work";

        return `
            <div
                class="additional-work-row"
                data-piece="${pieceNumber}"
            >

                <div class="work-row-inner">

                    <select
                        class="work-type"
                        data-piece="${pieceNumber}"
                    >
                        ${optionList(WORK_TYPES, workType)}
                    </select>

                    <select
                        class="work-stage"
                        data-piece="${pieceNumber}"
                    >
                        ${optionList(STAGES, stage)}
                    </select>

                    <button
                        type="button"
                        class="work-action-btn ${buttonClass}"
                        data-piece="${pieceNumber}"
                        title="${buttonTitle}"
                        aria-label="${buttonTitle}"
                    >
                        <i class="bx ${buttonIcon}"></i>
                    </button>

                </div>

            </div>
        `;
    }

    function buildDefaultWorkRows(pieceNumber) {
        let html = "";

        for (let r = 0; r < DEFAULT_WORK_ROWS; r++) {
            const isLast = (r === DEFAULT_WORK_ROWS - 1);

            html += createWorkRowHtml(
                pieceNumber,
                "",
                "",
                isLast
            );
        }

        return html;
    }

    /* ======================================================
       RENDER PIECES
       ====================================================== */

    function renderPieceTable(existingPieces = []) {

        const count = getPieceCount();
        const tbody = $("#pieceConfigBody");

        tbody.empty();

        if (!count) {
            tbody.html(`
                <tr>
                </tr>
            `);

            return;
        }

        for (let i = 1; i <= count; i++) {

            const oldPiece = getExistingPiece(
                existingPieces,
                i
            );

            const selectedMaterials = Array.isArray(
                oldPiece.materials
            )
                ? oldPiece.materials
                : [];

            const oldWorks = Array.isArray(
                oldPiece.additionalWorks
            )
                ? oldPiece.additionalWorks
                : [];

            let workHtml = "";

            if (oldWorks.length) {

                oldWorks.forEach((work, index) => {
                    const isLast = (index === oldWorks.length - 1);
                    workHtml += createWorkRowHtml(
                        i,
                        work.workType || "",
                        work.stage || "",
                        isLast
                    );
                });

                if (oldWorks.length < DEFAULT_WORK_ROWS) {

                    const padCount = DEFAULT_WORK_ROWS - oldWorks.length;

                    for (let p = 0; p < padCount; p++) {

                        const totalAfter = oldWorks.length + p + 1;
                        const isLast = (totalAfter === DEFAULT_WORK_ROWS);

                        workHtml += createWorkRowHtml(
                            i,
                            "",
                            "",
                            isLast
                        );
                    }
                }

            } else {

                workHtml = buildDefaultWorkRows(i);

            }

            tbody.append(`

                <tr data-piece-row="${i}">

                    <td class="piece-col">

                        <div class="piece-head-row">

                            <span class="piece-number-badge">
                                ${i} Piece
                            </span>

                            <select
                                class="piece-item"
                                data-piece="${i}"
                            >
                                ${optionList(
                ITEMS,
                oldPiece.item || ""
            )}
                            </select>

                        </div>

                        <div class="item-list-box">

                            <div class="item-list-title">
                                Item List
                            </div>

                            <div class="item-list-options">

                                ${createMaterialListHtml(
                i,
                selectedMaterials
            )}

                            </div>

                        </div>

                    </td>

                    <td class="work-col">

                        <div
                            class="piece-work-container"
                            data-piece="${i}"
                        >
                            ${workHtml}
                        </div>

                    </td>

                </tr>

            `);
        }
    }

    /* ======================================================
       ADD / DELETE ADDITIONAL WORK
       ====================================================== */

    $(document).on(
        "click",
        ".work-action-btn",
        function () {

            const button = $(this);

            const pieceNumber = Number(
                button.data("piece")
            );

            const row = button.closest(
                ".additional-work-row"
            );

            const container = row.closest(
                ".piece-work-container"
            );

            if (button.hasClass("add")) {

                button
                    .removeClass("add")
                    .addClass("delete")
                    .attr("title", "Delete Work")
                    .attr("aria-label", "Delete Work")
                    .html('<i class="bx bx-trash"></i>');

                container.append(
                    createWorkRowHtml(
                        pieceNumber,
                        "",
                        "",
                        true
                    )
                );

                renderBomFlowChart();

                return;
            }

            row.remove();

            const remainingRows = container.find(
                ".additional-work-row"
            );

            if (!remainingRows.length) {

                container.append(
                    createWorkRowHtml(
                        pieceNumber,
                        "",
                        "",
                        true
                    )
                );

            } else {

                remainingRows.each(function (index) {

                    const btn = $(this).find(".work-action-btn");
                    const isLast = (index === remainingRows.length - 1);

                    if (isLast) {
                        btn
                            .removeClass("delete")
                            .addClass("add")
                            .attr("title", "Add Work")
                            .attr("aria-label", "Add Work")
                            .html('<i class="bx bx-plus"></i>');
                    } else {
                        btn
                            .removeClass("add")
                            .addClass("delete")
                            .attr("title", "Delete Work")
                            .attr("aria-label", "Delete Work")
                            .html('<i class="bx bx-trash"></i>');
                    }
                });
            }

            renderBomFlowChart();
        }
    );

    /* ======================================================
       PIECE RADIO CHANGE
       ====================================================== */

    $(".piece-radio").on("change", function () {

        const previousPieces = collectPieces();

        renderPieceTable(previousPieces);

        renderBomFlowChart();
    });

    /* ======================================================
       COLLECT PIECES
       ====================================================== */

    function collectPieces() {

        const pieces = [];

        $(".piece-item").each(function () {

            const pieceNumber = Number(
                $(this).data("piece")
            );

            const item = $(this).val();

            const materials = $(
                `.material-check[data-piece="${pieceNumber}"]:checked`
            ).map(function () {
                return $(this).val();
            }).get();

            const additionalWorks = [];

            $(
                `.piece-work-container[data-piece="${pieceNumber}"]`
            )
                .find(".additional-work-row")
                .each(function () {

                    const workType = $(this)
                        .find(".work-type")
                        .val();

                    const stage = $(this)
                        .find(".work-stage")
                        .val();

                    if (workType && stage) {

                        additionalWorks.push({
                            workType: workType,
                            stage: stage
                        });
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

    /* ======================================================
       PHOTO UPLOAD
       ====================================================== */

    function renderPhotoPreview(photo) {

        if (!photo) {
            $("#photoPreview").empty();
            return;
        }

        $("#photoPreview").html(`
            <img
                src="${escapeHtml(photo)}"
                alt="BOM Photo"
                style="
                    width:120px;
                    height:120px;
                    object-fit:cover;
                    border-radius:8px;
                    border:1px solid #ddd;
                "
            >
        `);
    }

    $("#photoUpload").on("change", function () {

        const file = this.files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {

            alertMsg("Please select an image file.", "error");

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

    /* ======================================================
       RESET FORM
       ====================================================== */

    function resetForm() {

        $("#bomForm")[0].reset();

        $("#editId").val("");

        $("#bomModalLabel").text(
            "Create BOM Master"
        );

        currentPhoto = "";

        $("#photoUpload").val("");

        $("#photoPreview").empty();

        $(".piece-radio").prop(
            "checked",
            false
        );

        $("#pieceConfigBody").html(`
            <tr>
                
            </tr>
        `);

        $("#bomFlowChart").empty();
    }

    $("#createBomBtn").on("click", function () {

        resetForm();

        $("#bomModal").modal("show");
    });

    /* ======================================================
       REFRESH BUTTON
       ====================================================== */

    $("#refreshBomBtn").on("click", function () {

        const btn = $(this);

        btn.addClass("spinning");

        bomData = loadData();

        nextId = getNextId();

        $("#brandFilter").val("");

        $("#pieceFilter").val("");

        $("#searchInput").val("");

        updateBrandFilter();

        renderTable();

        setTimeout(function () {
            btn.removeClass("spinning");
        }, 800);

        alertMsg("BOM list refreshed successfully.", "success");
    });

    /* ======================================================
       VALIDATION
       ====================================================== */

    function validateForm() {

        const brand = $("#brandSelect").val();

        const design = $("#designNumber")
            .val()
            .trim();

        const color = $("#colorSelect").val();

        const pieceCount = getPieceCount();

        if (!brand || !design || !color) {

            alertMsg(
                "Please fill Brand, Design Number and Color.",
                "warning"
            );

            return false;
        }

        if (!pieceCount) {

            alertMsg("Please select 1–5 Pic.", "warning");

            return false;
        }

        let missingItem = false;

        $(".piece-item").each(function () {

            if (!$(this).val()) {
                missingItem = true;
            }
        });

        if (missingItem) {

            alertMsg(
                "Please select an item for every piece.",
                "warning"
            );

            return false;
        }

        let invalidWork = false;

        $(".additional-work-row").each(function () {

            const type = $(this)
                .find(".work-type")
                .val();

            const stage = $(this)
                .find(".work-stage")
                .val();

            if (
                (type && !stage) ||
                (!type && stage)
            ) {
                invalidWork = true;
            }
        });

        if (invalidWork) {

            alertMsg(
                "Please select both Work and Stage.",
                "warning"
            );

            return false;
        }

        return true;
    }

    /* ======================================================
       SAVE BOM
       ====================================================== */

    $("#saveBomBtn").on("click", function () {

        if (!validateForm()) return;

        const editId = $("#editId").val();

        const bomDetails = {

            brand: $("#brandSelect").val(),

            designNumber: $("#designNumber")
                .val()
                .trim(),

            color: $("#colorSelect").val(),

            pieceCount: getPieceCount(),

            pieces: collectPieces(),

            photo: currentPhoto
        };

        if (editId) {

            const index = bomData.findIndex(item =>
                Number(item.id) === Number(editId)
            );

            if (index === -1) return;

            bomData[index] = {
                ...bomData[index],
                ...bomDetails,
                updatedAt: getToday()
            };

            if (!saveData()) return;

            alertMsg("BOM updated successfully.", "success");

        } else {

            const newBom = {

                id: nextId,

                bomId: generateBomId(),

                ...bomDetails,

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

            alertMsg(
                `${newBom.bomId} created successfully.`,
                "success"
            );
        }

        renderTable();

        $("#bomModal").modal("hide");
    });

    /* ======================================================
       EDIT BOM
       ====================================================== */

    $(document).on(
        "click",
        ".edit-bom-btn",
        function () {

            const id = Number(
                $(this).data("id")
            );

            const bom = bomData.find(item =>
                Number(item.id) === id
            );

            if (!bom) return;

            $("#editId").val(bom.id);

            $("#brandSelect").val(bom.brand);

            $("#designNumber").val(
                bom.designNumber
            );

            $("#colorSelect").val(bom.color);

            currentPhoto = bom.photo || "";

            renderPhotoPreview(currentPhoto);

            $(".piece-radio").prop(
                "checked",
                false
            );

            $(
                `.piece-radio[value="${bom.pieceCount}"]`
            ).prop("checked", true);

            renderPieceTable(
                bom.pieces || []
            );

            $("#bomModalLabel").text(
                "Edit BOM Master"
            );

            $("#bomModal").modal("show");

            setTimeout(function () {
                renderBomFlowChart();
            }, 200);
        }
    );

    /* ======================================================
       VIEW BOM
       ====================================================== */

    function renderViewBom(bom) {

        const photoHtml = bom.photo

            ? `
                <img
                    src="${escapeHtml(bom.photo)}"
                    alt="BOM Photo"
                    style="
                        width:160px;
                        height:160px;
                        object-fit:cover;
                        border-radius:8px;
                    "
                >
            `

            : `<span class="text-muted">No Photo</span>`;

        const rows = (bom.pieces || []).map(piece => {

            const materials = piece.materials?.length

                ? piece.materials.map(material => `
                    <span class="badge bg-light text-dark border me-1 mb-1">
                        ${escapeHtml(material)}
                    </span>
                `).join("")

                : `<span class="text-muted">None</span>`;

            const works = piece.additionalWorks?.length

                ? piece.additionalWorks.map(work => `
                    <div>
                        ${escapeHtml(work.workType)}
                        — ${escapeHtml(work.stage)}
                    </div>
                `).join("")

                : `<span class="text-muted">None</span>`;

            return `
                <tr>
                    <td>Piece ${escapeHtml(piece.number)}</td>
                    <td>${escapeHtml(piece.item)}</td>
                    <td>${materials}</td>
                    <td>${works}</td>
                </tr>
            `;
        }).join("");

        $("#viewBomBody").html(`

            <div class="row g-4 mb-4">

                <div class="col-md-3 text-center">
                    ${photoHtml}
                </div>

                <div class="col-md-9">

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

            <div class="table-responsive">

                <table class="table table-bordered align-middle">

                    <thead>
                        <tr>
                            <th>Piece</th>
                            <th>Select Item</th>
                            <th>Item List</th>
                            <th>Additional Work</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rows}
                    </tbody>

                </table>

            </div>
        `);

        $("#viewBomModal").modal("show");
    }

    $(document).on(
        "click",
        ".view-bom-btn",
        function () {

            const id = Number(
                $(this).data("id")
            );

            const bom = bomData.find(item =>
                Number(item.id) === id
            );

            if (bom) {
                renderViewBom(bom);
            }
        }
    );

    /* ======================================================
       DELETE BOM
       ====================================================== */

    $(document).on(
        "click",
        ".delete-bom-btn",
        function () {

            const id = Number(
                $(this).data("id")
            );

            const bom = bomData.find(item =>
                Number(item.id) === id
            );

            if (!bom) return;

            confirmBox(
                `Delete ${bom.bomId}?`
            ).then(function (confirmed) {

                if (!confirmed) return;

                const oldData = [...bomData];

                bomData = bomData.filter(item =>
                    Number(item.id) !== id
                );

                if (!saveData()) {

                    bomData = oldData;

                    return;
                }

                renderTable();

                alertMsg("BOM deleted successfully.", "success");
            });
        }
    );

    /* ======================================================
    RENDER BOM TABLE
    ====================================================== */

    function renderTable() {

        const tbody = $("#bomTableBody");

        tbody.empty();

        const brandFilter = $("#brandFilter").val();

        const pieceFilter = $("#pieceFilter").val();

        const search = $("#searchInput")
            .val()
            .toLowerCase()
            .trim();

        const filtered = bomData.filter(bom => {

            const brandMatch =
                !brandFilter ||
                bom.brand === brandFilter;

            const pieceMatch =
                !pieceFilter ||
                Number(bom.pieceCount) === Number(pieceFilter);

            const searchable = [
                bom.bomId,
                bom.brand,
                bom.designNumber,
                bom.color,
                bom.pieceCount
            ].join(" ").toLowerCase();

            return brandMatch &&
                pieceMatch &&
                (!search || searchable.includes(search));
        });

        if (!filtered.length) {

            tbody.html(`
            <tr>
                <td
                    colspan="6"
                    class="text-center text-muted py-5"
                >
                    No BOM records found.
                </td>
            </tr>
        `);

            updateBrandFilter();

            return;
        }

        filtered.forEach(bom => {

            const photoHtml = bom.photo

                ? `
                <img
                    src="${escapeHtml(bom.photo)}"
                    alt="BOM Photo"
                    style="
                        width:60px;
                        height:60px;
                        object-fit:cover;
                        border-radius:7px;
                    "
                >
            `

                : `<span class="text-muted">No Photo</span>`;

            tbody.append(`

            <tr>

                <td>${escapeHtml(bom.brand)}</td>

                <td>${escapeHtml(bom.designNumber)}</td>

                <td>
                    <span
                        class="badge color-badge"
                        style="background:${getColorHex(bom.color)};"
                    >
                        ${escapeHtml(bom.color)}
                    </span>
                </td>

                <td>${photoHtml}</td>

                <td>
                    <span class="piece-bold">
                        ${bom.pieceCount} Pic
                    </span>
                </td>

                <td>

                    <div class="d-flex gap-1">

                        <button
                            type="button"
                            class="btn btn-sm btn-info view-bom-btn"
                            data-id="${bom.id}"
                            title="View"
                        >
                            <i class="bx bx-show"></i>
                        </button>

                        <button
                            type="button"
                            class="btn btn-sm btn-primary edit-bom-btn"
                            data-id="${bom.id}"
                            title="Edit"
                        >
                            <i class="bx bx-edit"></i>
                        </button>

                        <button
                            type="button"
                            class="btn btn-sm btn-danger delete-bom-btn"
                            data-id="${bom.id}"
                            title="Delete"
                        >
                            <i class="bx bx-trash"></i>
                        </button>

                    </div>

                </td>

            </tr>
        `);
        });

        updateBrandFilter();
    }

    /* ======================================================
       COLOR → HEX MAP
       ====================================================== */

    function getColorHex(colorName) {

        const map = {
            "Red": "#e53935",
            "Blue": "#1e88e5",
            "Green": "#43a047",
            "Yellow": "#fdd835",
            "Black": "#161617",
            "White": "#ffffff",
            "Orange": "#fb8c00",
            "Purple": "#8e24aa",
            "Pink": "#ec407a",
            "Brown": "#6d4c41"
        };

        return map[colorName] || "#161617";
    }

    /* ======================================================
       BRAND FILTER
       ====================================================== */

    function updateBrandFilter() {

        const select = $("#brandFilter");

        const currentValue = select.val();

        const brands = [
            ...new Set(
                bomData
                    .map(item => item.brand)
                    .filter(Boolean)
            )
        ].sort();

        select.html(
            `<option value="">All Brands</option>`
        );

        brands.forEach(brand => {

            select.append(`
                <option value="${escapeHtml(brand)}">
                    ${escapeHtml(brand)}
                </option>
            `);
        });

        select.val(currentValue);
    }

    /* ======================================================
       FILTER EVENTS
       ====================================================== */

    $("#brandFilter, #pieceFilter").on(
        "change",
        renderTable
    );

    $("#searchInput").on(
        "input",
        renderTable
    );

    $("#bomModal").on(
        "hidden.bs.modal",
        resetForm
    );

    /* ======================================================
       PRODUCTION FLOW CHART
       ====================================================== */

    function buildFlowNodes(works) {

        const flowItems = [];

        FIXED_FLOW_STAGES.forEach(function (stageName) {
            flowItems.push({
                type: "fixed",
                label: stageName,
                sub: "",
                order: FLOW_STAGE_ORDER.indexOf(stageName)
            });
        });

        (works || []).forEach(function (work) {

            const stage = work.stage || "";
            const order = FLOW_STAGE_ORDER.indexOf(stage);

            flowItems.push({
                type: "work",
                label: work.workType || "Work",
                sub: stage,
                order: order === -1 ? 99 : order
            });
        });

        flowItems.sort(function (a, b) {
            return a.order - b.order;
        });

        return flowItems;
    }

    function renderBomFlowChart() {

        const container = $("#bomFlowChart");

        if (!container.length) {
            return;
        }

        const pieceCount = getPieceCount();

        container.empty();

        if (!pieceCount) {

            container.html(`
                <div class="text-center text-muted py-4">
                    Select 1–5 Pic to generate production flow chart.
                </div>
            `);

            return;
        }

        const pieces = collectPieces();

        if (!pieces.length) {
            return;
        }

        pieces.forEach(function (piece) {

            const works = piece.additionalWorks || [];

            const nodes = buildFlowNodes(works);

            let html = `
                <div class="bom-piece-flow-card mb-3">

                    <div class="bom-piece-flow-header">

                        <span class="badge bg-primary">
                            Piece ${piece.number}
                        </span>

                        <span class="fw-semibold">
                            ${escapeHtml(piece.item || "Item not selected")}
                        </span>

                    </div>

                    <div class="bom-flow-track">
            `;

            nodes.forEach(function (node, index) {

                if (index > 0) {
                    html += `<span class="bom-flow-connector"></span>`;
                }

                if (node.type === "fixed") {
                    html += `
                        <span class="bom-flow-node bom-fixed-node">
                            <strong>${escapeHtml(node.label)}</strong>
                        </span>
                    `;
                } else {
                    html += `
                        <span class="bom-flow-node">
                            <strong>${escapeHtml(node.label)}</strong>
                        </span>
                    `;
                }
            });

            html += `
                    </div>

                </div>
            `;

            container.append(html);

        });
    }

    $(document).on(
        "change",
        ".work-type, .work-stage",
        function () {
            renderBomFlowChart();
        }
    );

    /* ======================================================
       SAME BOM MASTER — Design Number Search + Dropdown
       ====================================================== */

    // Open the small modal
    $("#sameBomBtn").on("click", function () {
        if (!bomData.length) {
            alertMsg("Pehle koi BOM Master banao.", "info");
            return;
        }

        $("#sameDesignSearch").val("");
        $("#sameDesignDropdown").hide().empty();

        $("#sameBomModal").modal("show");
    });

    // Build dropdown matches by design number (also shows bomId, brand, color)
    function buildSameDropdown(query) {
        const dropdown = $("#sameDesignDropdown");
        const q = String(query || "").toLowerCase().trim();

        if (!q) {
            dropdown.hide().empty();
            return;
        }

        const matches = bomData.filter(function (bom) {
            const design = String(bom.designNumber || "").toLowerCase();
            const bomId = String(bom.bomId || "").toLowerCase();
            return design.includes(q) || bomId.includes(q);
        });

        if (!matches.length) {
            dropdown.html(`
                <div class="list-group-item text-muted small">
                    No matching design number.
                </div>
            `).show();
            return;
        }

        dropdown.empty();

        matches.forEach(function (bom) {
            const label = [
                bom.designNumber,
                bom.bomId,
                bom.brand,
                bom.color,
                bom.pieceCount + " Pic"
            ].filter(Boolean).join(" | ");

            dropdown.append(`
                <button
                    type="button"
                    class="list-group-item list-group-item-action same-design-option"
                    data-id="${bom.id}"
                >
                    <div class="fw-semibold">
                        ${escapeHtml(bom.designNumber || "-")}
                    </div>
                    <div class="small text-muted">
                        ${escapeHtml(bom.bomId || "")}
                        ${bom.brand ? " • " + escapeHtml(bom.brand) : ""}
                        ${bom.color ? " • " + escapeHtml(bom.color) : ""}
                        ${bom.pieceCount ? " • " + bom.pieceCount + " Pic" : ""}
                    </div>
                </button>
            `);
        });

        dropdown.show();
    }

    // Live search
    $("#sameDesignSearch").on("input", function () {
        buildSameDropdown($(this).val());
    });

    // Re-open dropdown on focus if there's text
    $("#sameDesignSearch").on("focus", function () {
        if ($(this).val().trim()) {
            buildSameDropdown($(this).val());
        }
    });

    // Hide dropdown when clicking outside
    $(document).on("click", function (e) {
        if (!$(e.target).closest("#sameDesignSearch, #sameDesignDropdown").length) {
            $("#sameDesignDropdown").hide();
        }
    });

    // When user clicks a design option → fill Create BOM form
    $(document).on("click", ".same-design-option", function () {

        const id = Number($(this).data("id"));

        const source = bomData.find(item =>
            Number(item.id) === id
        );

        if (!source) return;

        // Deep clone pieces so edits don't affect source
        const clonedPieces = JSON.parse(
            JSON.stringify(source.pieces || [])
        );

        // --- Fill Create BOM form with source flow ---
        // Brand copied from source
        $("#brandSelect").val(source.brand || "");

        // Design Number kept EMPTY for user to type new
        $("#designNumber").val("");

        // Color kept EMPTY for user to pick new
        $("#colorSelect").val("");

        // Photo kept EMPTY for user to upload new
        currentPhoto = "";
        $("#photoUpload").val("");
        $("#photoPreview").empty();

        // Piece count from source
        $(".piece-radio").prop("checked", false);
        if (source.pieceCount) {
            $(
                `.piece-radio[value="${source.pieceCount}"]`
            ).prop("checked", true);
        }

        // Render pieces with the source flow data
        renderPieceTable(clonedPieces);

        // Render production flow chart from same data
        setTimeout(function () {
            renderBomFlowChart();
        }, 50);

        // Modal title change
        $("#bomModalLabel").text("Create BOM Master (Same Flow)");

        // Close the small modal
        $("#sameBomModal").modal("hide");

        alertMsg(
            "Flow copy ho gaya. Ab naya Design Number, Color aur Photo manually fill karein.",
            "success"
        );
    });

    /* ======================================================
       INITIAL LOAD
       ====================================================== */

    updateBrandFilter();

    renderTable();

});