$(document).ready(function () {
    "use strict";

    const STORAGE_KEY = "bomMasterData";

    let MATERIALS = [], ITEMS = [], WORK_TYPES = [];

    const DEFAULT_WORK_ROWS = 0;
    const PATTERNS = [
        {name:'Frock', items:['Frock']},
        {name:'Pant Shirt 2 Piece', items:['Pant','Shirt']},
        {name:'Pant Shirt Jacket 3 Piece', items:['Pant','Shirt','Jacket']},
        {name:'Pant Shirt Cap Jacket 4 Piece', items:['Pant','Shirt','Cap','Jacket']},
        {name:'Pant Shirt Cap Jacket Tie 5 Piece', items:['Pant','Shirt','Cap','Jacket','Tie']}
    ];

    let bomData = [];
    let nextId = 1;
    let currentPhoto = "";
    let editingProductId = null;
    function loadProducts() {
        try { const rows = JSON.parse(localStorage.getItem('products') || '[]'); return Array.isArray(rows) ? rows : []; }
        catch (_) { return []; }
    }
    function tableRecords() { return bomData; }
    async function reloadCatalog() {
        $('#createBomBtn, #saveBomBtn').prop('disabled', true);
        const rows = await CatalogApi.load();
        bomData = rows.map(r => ({...r, _product: r.createdFrom === 'product' && !r.bomCompleted}));
        MATERIALS = CatalogApi.masters.items.map(r => r.name);
        ITEMS = CatalogApi.masters.pieceItems.map(r => r.name); WORK_TYPES = CatalogApi.masters.works.map(r => r.name);
        const current = $('#colorSelect').val();
        $('#colorSelect').empty().append($('<option>').val('').text('Select Color'));
        CatalogApi.masters.colors.forEach(c => $('#colorSelect').append($('<option>').val(c.name).text(c.name)));
        $('#colorSelect').val(current || '');
        const selectedPattern = $('#pattern').val();
        $('#pattern').empty().append($('<option>').val('').text('Select Pattern'));
        PATTERNS.forEach(p => $('#pattern').append($('<option>').val(p.name).text(p.name)));
        if (selectedPattern) $('#pattern').val(selectedPattern);
        $('#createBomBtn, #saveBomBtn').prop('disabled', false);
        renderTable(); return rows;
    }

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

    /* ======================================================
       LOCAL STORAGE
       ====================================================== */

    function loadData() { return bomData; }
    function getNextId() { return 1; }

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
        return Number($(".piece-radio").val()) || 0;
    }

    function patternConfig(name) { return PATTERNS.find(p => p.name === name); }

    function applyPattern(existingPieces = []) {
        const config = patternConfig($('#pattern').val());
        $('.piece-radio').val(config ? config.items.length : '');
        const pieces = config ? config.items.map((item, i) => ({...(existingPieces[i] || {}), number:i + 1, item})) : [];
        renderPieceTable(pieces);
        renderBomFlowChart();
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

        if (selected && !options.includes(selected)) {
            html += `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`;
        }

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
       PHOTO LIGHTBOX
       ====================================================== */

    function openLightbox(src) {
        if (!src) return;

        $("#lightboxImg").attr("src", src);
        $("#photoLightbox").addClass("show").attr("aria-hidden", "false");
    }

    function closeLightbox() {
        $("#photoLightbox").removeClass("show").attr("aria-hidden", "true");
        $("#lightboxImg").attr("src", "");
    }

    // Click on any thumbnail image → open lightbox
    $(document).on("click", ".bom-photo-thumb", function () {
        const src = $(this).data("src") || $(this).attr("src");
        openLightbox(src);
    });

    // Close via button
    $(document).on("click", "#lightboxClose", function (e) {
        e.stopPropagation();
        closeLightbox();
    });

    // Close via backdrop click
    $(document).on("click", "#photoLightbox", function (e) {
        if (e.target === this) {
            closeLightbox();
        }
    });

    // Close via ESC
    $(document).on("keydown", function (e) {
        if (e.key === "Escape") {
            closeLightbox();
        }
    });

    /* ======================================================
       DUPLICATE DESIGN NUMBER CHECK
       ====================================================== */

    function isDesignNumberDuplicate(designNumber, editId) {
        const number = String(designNumber).replace(/^0+(?=\d)/, '');
        return bomData.some(r => String(r.id) !== String(editId || '') && String(r.designNumber) === number);
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
                    <input type="hidden" class="work-stage" data-piece="${pieceNumber}" value="${escapeHtml(stage || (workType ? "After Cutting" : ""))}">



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
        if (!count) return;

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

            tbody.append(`
                <section class="pattern-piece-card" data-piece-row="${i}">
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

                            <div class="item-list-title d-flex justify-content-between align-items-center"><span>Item List</span></div>

                            <div class="item-list-options">

                                ${createMaterialListHtml(
                i,
                selectedMaterials
            )}

                            </div>

                        </div>
                        <div class="piece-work-container d-none" data-piece="${i}"></div>
                </section>
            `);
            const workContainer = tbody.find(`.piece-work-container[data-piece="${i}"]`);
            (oldPiece.additionalWorks || []).forEach(work => workContainer.append(createWorkRowHtml(i, work.workType || '', work.stage || 'After Cutting', false)));
        }
    }

    /* ======================================================
       ADD / DELETE ADDITIONAL WORK
       ====================================================== */

    $(document).on('click', '.flow-add-work-btn', function(){
        const pieceNumber = Number($(this).data('piece'));
        const stage = String($(this).data('stage'));
        const selectedWorks = collectPieces().find(p => p.number === pieceNumber)?.additionalWorks || [];
        const maxWorks = stage === 'After Cutting' ? 5 : 1;
        const parallelCount = selectedWorks.filter(work => work.stage === stage).length;
        if (parallelCount >= maxWorks) { alertMsg(`You can select ${stage === 'After Cutting' ? 'up to 5' : 'only 1'} additional work at ${stage}.`, 'info'); return; }
        const choices = WORK_TYPES;
        if (!choices.length) { alertMsg('All available additional work is already added for this piece.', 'info'); return; }
        const $button = $(this);
        const multi = stage === 'After Cutting';
        const $wrap = $('<span class="flow-add-work-wrap"></span>').attr({'data-piece':pieceNumber,'data-stage':stage,'data-multiple':multi ? 'true' : 'false'});
        if (multi) {
            const $dropdown = $('<div class="dropdown d-inline-block"></div>');
            const $toggle = $('<button type="button" class="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">Select additional work</button>');
            const $checkList = $('<div class="dropdown-menu p-2 flow-work-multi-choices" style="max-height:260px;overflow:auto;min-width:220px"></div>');
            choices.forEach((name, index) => {
                const id = `flow-work-${pieceNumber}-${index}`;
                const $row = $('<div class="form-check"></div>');
                $('<input type="checkbox" class="form-check-input flow-work-multi-check">').attr({id, value:name}).appendTo($row);
                $('<label class="form-check-label"></label>').attr('for', id).text(name).appendTo($row);
                $checkList.append($row);
            });
            $checkList.find('input').on('change', function(){
                const remaining = maxWorks - parallelCount;
                if ($checkList.find('input:checked').length > remaining) { this.checked = false; alertMsg(`Select up to ${remaining} more additional work(s).`, 'info'); }
            });
            $dropdown.append($toggle, $checkList);
            $wrap.append($dropdown).append('<button type="button" class="btn btn-primary btn-sm flow-confirm-work">Add selected</button>');
        } else {
            const $select = $('<select class="form-select form-select-sm flow-add-work-select" aria-label="Select production work"><option value="">Select work</option></select>');
            choices.forEach(name => $select.append($('<option>').val(name).text(name)));
            $wrap.append($select);
        }
        $wrap.append('<button type="button" class="btn btn-link btn-sm flow-cancel-work" title="Cancel"><i class="bx bx-x"></i></button>');
        $button.replaceWith($wrap);
        $wrap.find('input, select').first().trigger('focus');
    });
    $(document).on('change', '.flow-add-work-select', function(){
        if ($(this).prop('multiple')) return;
        const name = $(this).val();
        const $wrap = $(this).closest('.flow-add-work-wrap');
        if (!name) return;
        const pieceNumber = Number($wrap.data('piece'));
        $(`.piece-work-container[data-piece="${pieceNumber}"]`).append(createWorkRowHtml(pieceNumber, name, String($wrap.data('stage')), false));
        renderBomFlowChart();
    });
    $(document).on('click', '.flow-confirm-work', function(){
        const $wrap = $(this).closest('.flow-add-work-wrap');
        const names = $wrap.find('.flow-work-multi-check:checked').map(function(){ return $(this).val(); }).get();
        if (!names.length) { alertMsg('Select at least one additional work.', 'info'); return; }
        const pieceNumber = Number($wrap.data('piece'));
        const stage = String($wrap.data('stage'));
        const $container = $(`.piece-work-container[data-piece="${pieceNumber}"]`);
        names.forEach(name => $container.append(createWorkRowHtml(pieceNumber, name, stage, false)));
        renderBomFlowChart();
    });
    $(document).on('click', '.flow-cancel-work', function(){ renderBomFlowChart(); });
    $(document).on('click', '.flow-remove-work', function(){
        const pieceNumber = Number($(this).data('piece'));
        const index = Number($(this).data('index'));
        $(`.piece-work-container[data-piece="${pieceNumber}"] .additional-work-row`).eq(index).remove();
        renderBomFlowChart();
    });

    /* ======================================================
       PIECE RADIO CHANGE
       ====================================================== */

    $(document).on('change', '#pattern', function(){ applyPattern(collectPieces()); });
    function openMasterEntryEditor(button, kind) {
        const $button = $(button);
        const $panel = kind === 'color' ? $button.closest('.input-group') : $button.closest('.item-list-title');
        $('.bom-master-entry-editor').remove();
        const $editor = $(`<div class="bom-master-entry-editor"><input type="text" class="form-control master-entry-name" maxlength="150" placeholder="Enter ${kind === 'color' ? 'color' : 'item'} name"><button type="button" class="btn btn-primary btn-sm master-entry-save">Save</button><button type="button" class="btn btn-light btn-sm master-entry-cancel" aria-label="Cancel">Cancel</button><small class="text-danger master-entry-error"></small></div>`);
        $editor.data({kind, piece: $button.data('piece')});
        $panel.after($editor);
        $editor.find('.master-entry-name').trigger('focus');
    }
    $(document).on('click', '#addBomColorBtn', function(){ openMasterEntryEditor(this, 'color'); });
    $(document).on('click', '.add-material-btn', function(){ openMasterEntryEditor(this, 'item'); });
    $(document).on('click', '.master-entry-cancel', function(){ $(this).closest('.bom-master-entry-editor').remove(); });
    $(document).on('keydown', '.master-entry-name', function(event){
        if (event.key === 'Enter') { event.preventDefault(); $(this).closest('.bom-master-entry-editor').find('.master-entry-save').trigger('click'); }
        if (event.key === 'Escape') $(this).closest('.bom-master-entry-editor').remove();
    });
    $(document).on('click', '.master-entry-save', async function(){
        const $editor = $(this).closest('.bom-master-entry-editor');
        const name = String($editor.find('.master-entry-name').val() || '').trim();
        const kind = $editor.data('kind');
        if (!name) { $editor.find('.master-entry-error').text('Enter a name.'); $editor.find('.master-entry-name').trigger('focus'); return; }
        $(this).prop('disabled', true);
        try {
            if (kind === 'color') {
                await CatalogApi.request('colour', {name});
                await reloadCatalog();
                $('#colorSelect').val(name);
                $editor.remove();
            } else {
                const piece = Number($editor.data('piece'));
                const pieces = collectPieces();
                await CatalogApi.request('item-list', {name});
                await reloadCatalog();
                renderPieceTable(pieces);
                $(`.material-check[data-piece="${piece}"]`).filter(function(){ return $(this).val() === name; }).prop('checked', true);
            }
        } catch (error) {
            $editor.find('.master-entry-error').text(error.message || 'Could not save this entry.');
            $(this).prop('disabled', false);
        }
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

                    const stage = $(this).find(".work-stage").val();

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
                class="bom-photo-thumb"
                data-src="${escapeHtml(photo)}"
                title="Click to view large"
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
       LIVE DUPLICATE CHECK ON DESIGN NUMBER
       ====================================================== */

    $(document).on("input blur", "#designNumber", function () {

        const value = $(this).val().trim();
        const editId = $("#editId").val();

        // Remove existing warning
        $(this).removeClass("is-invalid");
        $("#designNumberError").remove();

        if (!value) return;

        if (isDesignNumberDuplicate(value, editId)) {

            $(this).addClass("is-invalid");

            $(this).after(`
                <div id="designNumberError" class="text-danger small mt-1">
                    <i class="bx bx-error-circle"></i>
                    Design Number "${escapeHtml(value)}" already exists.
                </div>
            `);
        }
    });

    /* ======================================================
       RESET FORM
       ====================================================== */

    function resetForm() {
        editingProductId = null;

        $("#bomForm")[0].reset();

        $("#editId").val("");

        $("#bomModalLabel").text(
            "Create BOM Master"
        );

        currentPhoto = "";

        $("#photoUpload").val("");

        $("#photoPreview").empty();

        // Clear duplicate warning
        $("#designNumber").removeClass("is-invalid");
        $("#designNumberError").remove();

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

    $('#refreshBomBtn').on('click', async function(){try { await reloadCatalog(); alertMsg('BOM list refreshed.', 'success'); } catch(e) { alertMsg(e.message,'error'); }});

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

        const editId = $("#editId").val();

        if (!brand || !design || !color) {

            alertMsg(
                "Please fill Brand, Design Number and Color.",
                "warning"
            );

            return false;
        }

        // 🔴 DUPLICATE DESIGN NUMBER CHECK
        if (isDesignNumberDuplicate(design, editId)) {

            alertMsg(
                `Design Number "${design}" already exists. Please use a unique Design Number.`,
                "error"
            );

            $("#designNumber")
                .addClass("is-invalid")
                .focus();

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
                "Please select a garment piece for every row from the Piece Items list.",
                "warning"
            );

            return false;
        }

        let invalidWork = false;

        $(".additional-work-row").each(function () {

            const type = $(this)
                .find(".work-type")
                .val();

            const stage = $(this).find(".work-stage").val();

            if (
                (type && !stage) ||
                (!type && stage)
            ) {
                invalidWork = true;
            }
        });

        if (invalidWork) {

            alertMsg(
                "Please select an Additional Work.",
                "warning"
            );

            return false;
        }

        return true;
    }

    /* ======================================================
       SAVE BOM
       ====================================================== */

    $('#saveBomBtn').on('click',async function(){
        const button=$(this);if(button.prop('disabled')||button.data('saving'))return;
        if(!validateForm())return;
        const designNumber=$('#designNumber').val().trim(),pattern=$('#pattern').val().trim();
        if(!/^[0-9]{1,18}$/.test(designNumber)){alertMsg('Design number must contain 1?18 digits.','warning');return;}
        if(!patternConfig(pattern)){alertMsg('Select a pattern.','warning');return;}
        if(!document.getElementById('mrp').reportValidity())return;
        button.data('saving',true).prop('disabled',true);
        try{
            const data=CatalogApi.details({id:$('#editId').val()||null,brand:$('#brandSelect').val(),designNumber,color:$('#colorSelect').val(),pattern,mrp:$('#mrp').val(),pieces:collectPieces()});
            await CatalogApi.request('bom',data,document.getElementById('photoUpload').files[0]);
            await reloadCatalog();$('#bomModal').modal('hide');alertMsg('BOM saved successfully.','success');
        }catch(e){alertMsg(e.message,'error');}finally{button.data('saving',false).prop('disabled',false);}
    });

    /* ======================================================
       EDIT BOM
       ====================================================== */

    $(document).on(
        "click",
        ".edit-bom-btn, .edit-product-bom-btn",
        function () {

            const isProduct = $(this).hasClass('edit-product-bom-btn') || $(this).attr('data-product') === 'true';
            const id = String($(this).attr('data-id'));
            const bom = isProduct ? loadProducts().find(item => String(item.id) === id) : bomData.find(item => Number(item.id) === Number(id));
            editingProductId = isProduct && bom ? id : null;

            if (!bom) return;

            // Safety: inactive records cannot be edited
            if ((bom.status || "active") === "inactive") {
                alertMsg(
                    "Inactive BOM cannot be edited. Please activate it first.",
                    "warning"
                );
                return;
            }

            $("#editId").val(bom.id);

            $("#brandSelect").val(bom.brand);
            $("#pattern").val(bom.pattern || "");
            $("#mrp").val(bom.mrp ?? "");

            $("#designNumber").val(
                bom.designNumber
            );

            $("#colorSelect").val(bom.color);

            currentPhoto = bom.photo || "";

            renderPhotoPreview(currentPhoto);

            // Clear any stale duplicate warning
            $("#designNumber").removeClass("is-invalid");
            $("#designNumberError").remove();

            applyPattern(bom.pieces || []);

            $("#bomModalLabel").text(
                isProduct ? "Product-edit - BOM Master" : "Edit BOM Master"
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
                <div class="view-photo-wrap">
                    <img
                        src="${escapeHtml(bom.photo)}"
                        alt="BOM Photo"
                        class="bom-photo-thumb"
                        data-src="${escapeHtml(bom.photo)}"
                        title="Click to view large"
                    >
                </div>
            `

            : `<div class="text-center text-muted">No Photo</div>`;

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
                        ${escapeHtml(work.workType)} <small class="text-muted">(${escapeHtml(work.stage || "After Cutting")})</small>

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

        const statusBadge = (bom.status === "inactive")
            ? `<span class="badge bg-secondary">Inactive</span>`
            : `<span class="badge bg-success">Active</span>`;

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
                            <th>Status</th>
                            <td>${statusBadge}</td>
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

            const id = String($(this).attr('data-id'));
            const isProduct = $(this).attr('data-product') === 'true';
            const bom = isProduct ? loadProducts().find(item => String(item.id) === id) : bomData.find(item => Number(item.id) === Number(id));

            if (!bom) return;

            // Safety: inactive records cannot be viewed
            if ((bom.status || "active") === "inactive") {
                alertMsg(
                    "Inactive BOM cannot be viewed. Please activate it first.",
                    "warning"
                );
                return;
            }

            renderViewBom(bom);
        }
    );

    /* ======================================================
       ACTIVE / INACTIVE TOGGLE (inside Action column)
       ====================================================== */

    $(document).on('change','.bom-status-switch',async function(){
        const checkbox=$(this),status=this.checked?'active':'inactive';checkbox.prop('disabled',true);
        try{await CatalogApi.request('bom',{action:'status',id:this.dataset.id,status});await reloadCatalog();}
        catch(e){checkbox.prop('checked',status!=='active');alertMsg(e.message,'error');}finally{checkbox.prop('disabled',false);}
    });
    $(document).on('click','.delete-bom-record',async function(){
        const result=await Swal.fire({title:'Delete record?',text:'This also removes the product and uploaded photo.',icon:'warning',showCancelButton:true});if(!result.isConfirmed)return;
        try{await CatalogApi.request('bom',{id:this.dataset.id},null,'DELETE');await reloadCatalog();alertMsg('Record deleted.','success');}catch(e){alertMsg(e.message,'error');}
    });

    /* ======================================================
    RENDER BOM TABLE
    ====================================================== */

    function renderTable() {

        const tbody = $("#bomTableBody");

        tbody.empty();

        const brandFilter = $("#brandFilter").val();

        const pieceFilter = $("#pieceFilter").val();

        const statusFilter = $("#statusFilter").val();

        const search = $("#searchInput")
            .val()
            .toLowerCase()
            .trim();

        const filtered = tableRecords().filter(bom => {

            const brandMatch =
                !brandFilter ||
                bom.brand === brandFilter;

            const pieceMatch =
                !pieceFilter ||
                Number(bom.pieceCount) === Number(pieceFilter);

            const statusMatch =
                !statusFilter ||
                (bom.status || "active") === statusFilter;

            const searchable = [
                bom.bomId,
                bom.brand,
                bom.designNumber,
                bom.color,
                bom.pieceCount
            ].join(" ").toLowerCase();

            return brandMatch &&
                pieceMatch &&
                statusMatch &&
                (!search || searchable.includes(search));
        });

        if (!filtered.length) {

            tbody.html(`
            <tr>
                <td
                    colspan="7"
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

            const isActive = (bom.status || "active") === "active";

            const photoHtml = bom.photo

                ? `
                <img
                    src="${escapeHtml(bom.photo)}"
                    alt="BOM Photo"
                    class="bom-photo-thumb"
                    data-src="${escapeHtml(bom.photo)}"
                    title="Click to view large"
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

            <tr class="${isActive ? "" : "inactive-row"}">

                <td>${escapeHtml(bom.brand)}</td>

                <td>${escapeHtml(bom.designNumber)}</td>

                <td>
                    <span class="color-text">${escapeHtml(bom.color)}</span>
                </td>

                <td>${photoHtml}</td>

                <td>
                    <span class="piece-bold">
                        ${bom.pieceCount} Pic
                    </span>
                </td>

                <td>
                    <span class="badge ${bom._product && !bom.bomCompleted ? 'bg-warning text-dark' : 'bg-success'}">
                        ${bom._product && !bom.bomCompleted ? 'In Progress' : 'Completed'}
                    </span>
                </td>

                <td>

                    <div class="action-cell"><button type="button" class="btn btn-sm btn-dark delete-bom-record" data-id="${escapeHtml(bom.id)}" title="Delete"><i class="bx bx-trash"></i></button>
                        ${bom._product && !bom.bomCompleted ? `<button type="button" class="btn btn-sm btn-primary edit-product-bom-btn" data-id="${escapeHtml(bom.id)}"><i class="bx bx-edit me-1"></i></button>` : `

                        <button
                            type="button"
                            class="btn btn-sm btn-info view-bom-btn"
                            data-product="${Boolean(bom._product)}"
                            data-id="${escapeHtml(bom.id)}"
                            title="${isActive ? "View" : "Activate to view"}"
                            ${isActive ? "" : "disabled"}
                        >
                            <i class="bx bx-show"></i>
                        </button>

                        <button
                            type="button"
                            class="btn btn-sm btn-primary edit-bom-btn"
                            data-product="${Boolean(bom._product)}"
                            data-id="${escapeHtml(bom.id)}"
                            title="${isActive ? "Edit" : "Activate to edit"}"
                            ${isActive ? "" : "disabled"}
                        >
                            <i class="bx bx-edit"></i>
                        </button>

                        <div class="form-check form-switch status-toggle">
                            <input
                                class="form-check-input bom-status-switch"
                                type="checkbox"
                                role="switch"
                                data-product="${Boolean(bom._product)}"
                                data-id="${escapeHtml(bom.id)}"
                                id="statusSwitch-${bom.id}"
                                ${isActive ? "checked" : ""}
                            >
                            <label
                                class="status-label ${isActive ? "active" : "inactive"}"
                                for="statusSwitch-${bom.id}"
                            >
                                ${isActive ? "Active" : "Inactive"}
                            </label>
                        </div>

                        `}
                    </div>

                </td>

            </tr>
        `);
        });

        updateBrandFilter();
    }

    /* ======================================================
       BRAND FILTER
       ====================================================== */

    function updateBrandFilter() {

        const select = $("#brandFilter");

        const currentValue = select.val();

        const brands = [
            ...new Set(
                tableRecords()
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

    $("#brandFilter, #pieceFilter, #statusFilter").on(
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
        return Production.buildRoute({ additionalWorks: works || [] }).map((r, order) => ({
            type: r.type === "additional_work" ? "work" : "fixed", label: r.stage, branch: r.branch || "", parallelGroup: r.parallelGroup || "", workIndex: r.workIndex, sub: "", order
        }));
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

            for (let index = 0; index < nodes.length; index++) {
                const node = nodes[index];
                if (node.branch) {
                    const branchNodes = [];
                    const group = node.parallelGroup;
                    while (index < nodes.length && nodes[index].parallelGroup === group) branchNodes.push(nodes[index++]);
                    index--;
                    const branchGate = branchNodes[0].parallelGroup === 'stitching-to-ironing' ? 'Stitching' : branchNodes[0].parallelGroup === 'ironing-to-packing' ? 'Ironing' : 'Cutting';
                    html += `<span class="bom-flow-connector" aria-hidden="true"></span><div class="bom-flow-branch-group border rounded bg-light p-2"><small class="d-block text-muted mb-1">Parallel work after ${branchGate}</small><div class="d-flex flex-column gap-1">`;
                    branchNodes.forEach(branch => {
                        html += `<div class="bom-flow-extra"><strong>${escapeHtml(branch.label)} (${escapeHtml(branch.branch)})</strong><button type="button" class="btn btn-link btn-sm flow-remove-work" data-piece="${piece.number}" data-index="${branch.workIndex}" title="Remove work"><i class="bx bx-x"></i></button></div>`;
                    });
                    html += `</div></div>`;
                    continue;
                }
                if (index > 0) html += `<span class="bom-flow-connector" aria-hidden="true"></span>`;
                if (node.type === "fixed") {
                    html += `<span class="bom-flow-node bom-fixed-node"><strong>${escapeHtml(node.label)}</strong></span>`;
                } else {
                    html += `<span class="bom-flow-extra"><strong>${escapeHtml(node.label)}</strong><button type="button" class="btn btn-link btn-sm flow-remove-work" data-piece="${piece.number}" data-index="${node.workIndex}" title="Remove work"><i class="bx bx-x"></i></button></span>`;
                }
                const addAfter = { Cutting: 'After Cutting', Stitching: 'After Stitching', Ironing: 'After Ironing' }[node.label];
                const maxWorks = addAfter === 'After Cutting' ? 5 : 1;
                if (node.type === 'fixed' && addAfter && works.filter(work => work.stage === addAfter).length < maxWorks) {
                    const mode = addAfter === 'After Cutting' ? 'parallel' : 'sequential';
                    html += `<button type="button" class="flow-add-work-btn" data-piece="${piece.number}" data-stage="${addAfter}" title="Add ${mode} work after ${node.label}" aria-label="Add ${mode} work after ${node.label}"><i class="bx bx-plus"></i></button>`;
                }
            }

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

        $("#sameBomModal").modal("show");
        buildSameDropdown("");
    });

    // Build dropdown matches by design number (also shows bomId, brand, color)
    function buildSameDropdown(query) {
        const dropdown = $("#sameDesignDropdown");
        const q = String(query || "").toLowerCase().trim();

        const sortedBoms = [...bomData].sort((a, b) => {
            const aTime = Date.parse(a.createdAt || '') || Number(a.id) || 0;
            const bTime = Date.parse(b.createdAt || '') || Number(b.id) || 0;
            return bTime - aTime;
        });
        const matches = sortedBoms.filter(function (bom) {
            const design = String(bom.designNumber || "").toLowerCase();
            const bomId = String(bom.bomId || "").toLowerCase();
            const brand = String(bom.brand || '').toLowerCase();
            const color = String(bom.color || '').toLowerCase();
            return !q || design.includes(q) || bomId.includes(q) || brand.includes(q) || color.includes(q);
        }).slice(0, q ? undefined : 5);

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
        if (!$(e.target).closest("#sameDesignSearch, #sameDesignDropdown, #sameBomBtn, #sameBomModal").length) {
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
        $("#pattern").val(source.pattern || "");
        $("#mrp").val(source.mrp ?? "");

        // Design Number kept EMPTY for user to type NEW unique value
        $("#designNumber").val("");

        // Color kept EMPTY for user to pick new
        $("#colorSelect").val("");

        // Photo kept EMPTY for user to upload new
        currentPhoto = "";
        $("#photoUpload").val("");
        $("#photoPreview").empty();

        // Clear any stale duplicate warning
        $("#designNumber").removeClass("is-invalid");
        $("#designNumberError").remove();

        // Pattern determines the piece count and garment rows.
        applyPattern(clonedPieces);

        // Render production flow chart from same data
        setTimeout(function () {
            renderBomFlowChart();
        }, 50);

        // Modal title change
        $("#bomModalLabel").text("Create BOM Master (Same Flow)");

        // Close the small modal
        $("#sameBomModal").modal("hide");

        alertMsg(
            "Flow copied successfully. Please enter a NEW unique Design Number, Color and Photo.",
            "success"
        );

        // Focus design number field for quick entry
        setTimeout(function () {
            $("#designNumber").focus();
        }, 400);
    });

    /* ======================================================
       INITIAL LOAD
       ====================================================== */

    reloadCatalog().catch(e=>alertMsg(e.message,'error'));
});
