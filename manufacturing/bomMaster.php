<?php
/*
|--------------------------------------------------------------------------
| BOM MASTER
|--------------------------------------------------------------------------
| Local Storage based BOM Master
|--------------------------------------------------------------------------
*/

include __DIR__ . "/../includes/header.php";
?>

<style>
    /* Page title + breadcrumb Ã¢â‚¬â€ black */
    .page-title,
    .page-header-breadcrumb .breadcrumb-item,
    .page-header-breadcrumb .breadcrumb-item a,
    .page-header-breadcrumb .breadcrumb-item.active {
        color: #161617 !important;
    }

    .page-header-breadcrumb .breadcrumb-item a:hover {
        color: #000 !important;
    }

    .page-header-breadcrumb .breadcrumb-item+.breadcrumb-item::before {
        color: #161617 !important;
    }

    .form-check-input:checked {
        background-color: #161617 !important;
        border-color: #161617 !important;
    }

    .form-check-input:focus {
        border-color: #161617 !important;
        box-shadow: 0 0 0 0.2rem rgba(22, 22, 23, 0.15) !important;
    }

    .btn-primary {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
    }

    .btn-primary:hover,
    .btn-primary:focus,
    .btn-primary:active {
        background-color: #2b2b2d !important;
        border-color: #2b2b2d !important;
        color: #fff !important;
        box-shadow: none !important;
    }

    .btn-info {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
    }

    .btn-info:hover,
    .btn-info:focus {
        background-color: #2b2b2d !important;
        border-color: #2b2b2d !important;
        color: #fff !important;
    }

    #refreshBomBtn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
        box-shadow: none !important;
    }

    #refreshBomBtn.spinning i {
        animation: spinRefresh 0.8s linear infinite;
        display: inline-block;
    }

    @keyframes spinRefresh {
        from {
            transform: rotate(0deg);
        }

        to {
            transform: rotate(360deg);
        }
    }

    #pieceConfigTable th {
        background: #f8f9fc;
        color: #18243d;
        font-weight: 600;
        padding: 17px 14px;
        border: 1px solid #e9edf5;
        white-space: nowrap;
    }

    #pieceConfigTable td {
        padding: 20px 14px;
        border: 1px solid #e9edf5;
        vertical-align: top;
    }

    #pieceConfigTable .piece-col {
        width: 60%;
        vertical-align: top;
    }

    #pieceConfigTable .work-col {
        width: 40%;
        vertical-align: top;
    }

    .pattern-piece-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .pattern-piece-card { min-width:0; padding:14px; border:1px solid #e2e8f0; border-radius:10px; background:#fff; box-shadow:0 2px 8px rgba(20,30,50,.04); }
    .pattern-piece-card .piece-head-row { margin-bottom:14px; }
    .bom-master-entry-editor { display:flex; align-items:center; gap:8px; margin-top:8px; }
    .bom-master-entry-editor .form-control { min-width:0; }
    .flow-add-work-btn { width:28px; height:28px; padding:0; border:1px solid #161617; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:#fff; color:#161617; }
    .flow-add-work-btn:hover { background:#161617; color:#fff; }
    .flow-add-work-wrap { display:inline-flex; align-items:center; gap:4px; width:220px; }
    .flow-add-work-wrap .flow-add-work-select { min-width:0; }
    .bom-flow-track { flex-wrap:nowrap; overflow-x:auto; overflow-y:hidden; white-space:nowrap; scrollbar-width:thin; padding:4px 0 8px; }
    .bom-flow-track > * { flex:0 0 auto; }
    .flow-add-work-wrap { width:max-content; flex:0 0 auto; gap:8px; }
    .flow-work-multi-choices { display:none; min-width:220px; padding:8px 12px !important; border-color:#dfe5f1 !important; border-radius:8px !important; box-shadow:0 2px 8px rgba(20,30,50,.06); }
    .flow-work-multi-choices.show { display:block; }
    .flow-work-multi-choices .form-check { display:inline-flex; align-items:center; gap:5px; flex:0 0 auto; min-height:0; margin:0; padding:0; white-space:nowrap; }
    .flow-work-multi-choices .form-check-input { float:none; flex:0 0 auto; margin:0; }
    .flow-work-multi-choices .form-check-label { white-space:nowrap; line-height:1.2; }
    .flow-confirm-work { flex:0 0 auto; white-space:nowrap; border-radius:7px; }
    .flow-add-work-wrap .flow-add-work-select { width:auto; min-width:150px; }
    .bom-flow-extra { display:inline-flex; align-items:center; gap:5px; padding:5px 8px; border:1px solid #dfe5f1; border-radius:7px; background:#f8f9fc; }
    .bom-flow-extra .flow-remove-work { padding:0; color:#dc3545; }

    .piece-head-row {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        margin-bottom: 10px;
    }

    .piece-number-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 108px;
        height: 42px;
        padding: 0 14px;
        border-radius: 7px;
        background: #161617;
        color: #fff;
        white-space: nowrap;
        flex: 0 0 auto;
    }

    .piece-item {
        width: 100%;
        height: 42px;
        border: 1px solid #dfe5f1;
        border-radius: 7px;
        padding: 7px 10px;
        color: #26334c;
        background: #fff;
        flex: 1 1 auto;
        min-width: 0;
    }

    .item-list-box {
        width: 100%;
        padding: 16px 20px;
        border: 1px solid #dfe5f1;
        border-radius: 9px;
        background: #fff;
    }

    .item-list-title {
        margin-bottom: 14px;
        color: #1e293b;
    }

    .item-list-options {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 12px 14px;
        align-items: start;
    }

    .item-list-options .form-check {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 0;
        min-width: 0;
    }

    .item-list-options .form-check-input {
        width: 20px;
        height: 20px;
        margin: 0;
        flex: 0 0 auto;
        cursor: pointer;
    }

    .item-list-options .form-check-label {
        margin: 0;
        color: #29364e;
        cursor: pointer;
        white-space: normal;
        overflow-wrap: anywhere;
    }

    .piece-work-container {
        width: 100%;
        padding: 0;
    }

    .piece-work-container>.additional-work-row:first-child {
        margin-top: 0;
    }

    .additional-work-row {
        width: 100%;
        padding: 10px;
        margin-bottom: 10px;
        border: 1px solid #e2e7f1;
        border-radius: 8px;
        background: #fff;
    }

    .additional-work-row:last-child {
        margin-bottom: 0;
    }

    .work-row-inner {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 42px;
        align-items: center;
        gap: 10px;
    }

    .additional-work-row .work-type,
    .additional-work-row .work-stage {
        width: 100%;
        min-width: 0;
        height: 42px;
        border: 1px solid #dfe5f1;
        border-radius: 7px;
        padding: 7px 10px;
        background: #fff;
    }

    .work-action-btn {
        width: 40px;
        height: 40px;
        padding: 0;
        border: none;
        border-radius: 7px;
        display: inline-flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        transition: .2s ease;
    }

    .work-action-btn.add {
        background: #161617;
        color: #fff;
    }

    .work-action-btn.delete {
        background: #ff4d5e;
        color: #fff;
    }

    .work-action-btn:hover {
        opacity: .86;
        transform: translateY(-1px);
    }

    #bomFlowChart {
        margin-top: 20px;
    }

    .bom-piece-flow-card {
        padding: 10px 0;
        min-height: 56px;
        height: auto;
        overflow: visible;
    }

    .bom-piece-flow-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
        flex-wrap: wrap;
    }

    .bom-flow-track {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        align-content: flex-start;
        gap: 8px 6px;
        width: 100%;
        min-height: 34px;
        height: auto;
        overflow: visible;
        font-size: 14px;
        color: #18243d;
    }

    .bom-flow-node {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 0;
        border: none;
        background: transparent;
        color: #18243d;
        font-size: 14px;
        font-weight: 500;
    }

    .bom-flow-node.bom-fixed-node {
        color: #161617;
        font-weight: 700;
    }

    .bom-flow-connector {
        display: inline-flex;
        align-items: center;
        color: #9aa6c2;
        font-size: 14px;
        font-weight: 600;
        margin: 0 4px;
        flex: 0 0 auto;
    }

    .bom-flow-connector::before {
        content: "→";
    }

    #bomModal .modal-dialog {
        max-width: 100%;
        width: 100%;
        min-height: 100vh;
        height: auto;
        margin: 0;
    }

    #bomModal .modal-content {
        min-height: 100vh;
        height: auto;
        border-radius: 0;
        border: none;
    }

    #bomModal .modal-body {
        overflow: visible;
    }

    .bom-basic-layout { align-items:stretch; }
    .bom-basic-fields { display:flex; flex-direction:column; flex:0 0 70%; max-width:70%; min-height:0; }
    .bom-photo-column { flex:0 0 30%; max-width:30%; margin-left:auto; }
    .bom-photo-panel { display:flex; align-items:center; height:100%; min-height:0; padding:12px; border:1px solid #e2e8f0; border-radius:10px; background:#fbfcff; }
    .bom-photo-panel #photoPreview { width:100%; min-height:400px; height:100%; display:flex; align-items:center; justify-content:center; margin-top:0 !important; padding:18px; border:1px dashed #cbd5e1; border-radius:8px; background:#fff; }
    .bom-photo-panel #photoPreview:empty::before { content:"Photo preview"; color:#94a3b8; font-size:14px; }
    .bom-photo-panel #photoPreview .bom-photo-thumb { width:min(100%, 320px) !important; height:380px !important; min-height:0; max-height:calc(100% - 24px); object-fit:contain !important; border:0 !important; border-radius:8px !important; }
    @media (max-width: 991.98px) {
        .bom-basic-fields { flex:0 0 50%; max-width:50%; }
        .bom-photo-column { flex:0 0 50%; max-width:50%; }
        .bom-photo-panel #photoPreview { min-height:360px; }
        .bom-photo-panel #photoPreview .bom-photo-thumb { height:340px !important; max-height:calc(100% - 20px); }
    }
    @media (max-width: 767.98px) {
        .bom-basic-fields { flex:0 0 100%; max-width:100%; min-height:0; }
        .bom-photo-column { flex:0 0 100%; max-width:100%; }
        .bom-photo-panel #photoPreview { min-height:320px; }
        .bom-photo-panel #photoPreview .bom-photo-thumb { height:300px !important; max-height:calc(100% - 20px); }
    }

    .bom-piece-flow-header .badge.bg-primary {
        background-color: #161617 !important;
    }

    .badge.bg-primary {
        background-color: #161617 !important;
    }

    #sameBomBtn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
        white-space: nowrap;
    }

    #sameBomBtn:hover {
        background-color: #2b2b2d !important;
        border-color: #2b2b2d !important;
    }

    @media (max-width: 992px) {
        .pattern-piece-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
    }

    @media (max-width: 768px) {
        .pattern-piece-grid { grid-template-columns:1fr; }

        .item-list-options { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px; }

        .work-row-inner {
            grid-template-columns: 1fr;
        }

        .piece-head-row {
            flex-wrap: wrap;
        }
    }

    /* Color Ã¢â‚¬â€ plain bold text */
    .color-text {
        font-size: 14px;
        font-weight: 600;
        color: #18243d;
    }

    /* Piece Ã¢â‚¬â€ simple bold */
    .piece-bold {
        font-weight: 600;
        color: #161617;
        font-size: 14px;
    }

    /* ======================================================
       PHOTO LIGHTBOX
       ====================================================== */

    .bom-photo-thumb {
        cursor: zoom-in;
        transition: transform .18s ease, box-shadow .18s ease;
    }

    .bom-photo-thumb:hover {
        transform: scale(1.04);
        box-shadow: 0 6px 18px rgba(0, 0, 0, .18);
    }

    #photoLightbox {
        position: fixed;
        inset: 0;
        z-index: 3000;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, .78);
        backdrop-filter: blur(3px);
        padding: 30px;
    }

    #photoLightbox.show {
        display: flex;
    }

    #photoLightbox .lightbox-img {
        max-width: 92vw;
        max-height: 92vh;
        border-radius: 10px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, .5);
        background: #fff;
        object-fit: contain;
    }

    #photoLightbox .lightbox-close {
        position: absolute;
        top: 18px;
        right: 22px;
        width: 44px;
        height: 44px;
        border: none;
        border-radius: 50%;
        background: #fff;
        color: #161617;
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: .2s ease;
    }

    #photoLightbox .lightbox-close:hover {
        background: #e9e9ec;
        transform: rotate(90deg);
    }

    /* ======================================================
       STATUS TOGGLE (inside Action column)
       ====================================================== */

    .action-cell {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: nowrap;
    }

    .action-cell .btn {
        width: 34px;
        height: 34px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 7px;
    }

    .action-cell .btn:disabled,
    .action-cell .btn.disabled-look {
        opacity: .35;
        cursor: not-allowed;
        pointer-events: none;
    }

    .status-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        user-select: none;
        margin-left: 4px;
    }

    .status-toggle .status-label {
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        min-width: 48px;
    }

    .status-toggle .status-label.active {
        color: #16a34a;
    }

    .status-toggle .status-label.inactive {
        color: #9ca3af;
    }

    .form-switch .form-check-input.bom-status-switch {
        width: 2.6em;
        height: 1.4em;
        cursor: pointer;
        margin: 0;
        background-color: #cbd2dc;
        border-color: #cbd2dc;
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23fff'/%3e%3c/svg%3e");
    }

    .form-switch .form-check-input.bom-status-switch:checked {
        background-color: #16a34a;
        border-color: #16a34a;
    }

    .form-switch .form-check-input.bom-status-switch:focus {
        box-shadow: 0 0 0 0.2rem rgba(22, 163, 74, 0.18);
        border-color: #16a34a;
    }

    .inactive-row {
        opacity: .7;
    }

    /* ======================================================
       VIEW MODAL PHOTO (fixed height, auto width)
       ====================================================== */

    #viewBomBody .view-photo-wrap {
        display: flex;
        justify-content: center;
        align-items: flex-start;
    }

    #viewBomBody .view-photo-wrap img {
        height: 220px;
        width: auto;
        max-width: 100%;
        object-fit: contain;
        border-radius: 8px;
        border: 1px solid #e9edf5;
        background: #fff;
    }
</style>

<div class="main-content app-content">
    <div class="container-fluid">

        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">
                    BOM Master
                </h1>

                <nav>
                    <ol class="breadcrumb mb-0">
                        <li class="breadcrumb-item">
                            <a href="javascript:void(0);">Masters</a>
                        </li>
                        <li class="breadcrumb-item active">
                            BOM Master
                        </li>
                    </ol>
                </nav>
            </div>

            <div class="d-flex gap-2">


                <button type="button" class="btn btn-primary" id="createBomBtn">
                    <i class="bx bx-plus align-middle"></i>
                    Create BOM Master
                </button>

                <button type="button" class="btn" id="refreshBomBtn" title="Refresh">
                    <i class="bx bx-refresh align-middle"></i>
                </button>

            </div>
        </div>

        <div class="card custom-card">
            <div class="card-header">
                <div class="card-title">BOM Master List</div>
            </div>

            <div class="card-body">

                <div class="row g-3 mb-4">

                    <div class="col-md-3">
                        <label class="form-label">Brand</label>
                        <select id="brandFilter" class="form-select">
                            <option value="">All Brands</option>
                        </select>
                    </div>

                    <div class="col-md-3">
                        <label class="form-label">Piece</label>
                        <select id="pieceFilter" class="form-select">
                            <option value="">All Pieces</option>
                            <option value="1">1 Pic</option>
                            <option value="2">2 Pic</option>
                            <option value="3">3 Pic</option>
                            <option value="4">4 Pic</option>
                            <option value="5">5 Pic</option>
                        </select>
                    </div>

                    <div class="col-md-3">
                        <label class="form-label">Status</label>
                        <select id="statusFilter" class="form-select">
                            <option value="">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>

                    <div class="col-md-3 ms-auto">
                        <label class="form-label">Search</label>

                        <div class="input-group">
                            <span class="input-group-text">
                                <i class="bx bx-search"></i>
                            </span>

                            <input
                                type="text"
                                id="searchInput"
                                class="form-control"
                                placeholder="Search BOM, brand, design...">
                        </div>
                    </div>

                </div>

                <div class="table-responsive">
                    <table class="table table-bordered align-middle w-90">
                        <thead>
                            <tr>
                                <th>Brand</th>
                                <th>Design Number</th>
                                <th>Color</th>
                                <th>Photo</th>
                                <th>Piece</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>

                        <tbody id="bomTableBody"></tbody>
                    </table>
                </div>

            </div>
        </div>

    </div>
</div>

<!-- CREATE / EDIT BOM MODAL -->

<div class="modal fade" id="bomModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">

            <div class="modal-header">
                <h5 class="modal-title" id="bomModalLabel">
                    Create BOM Master
                </h5>

                <button
                    type="button"
                    class="btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"></button>
            </div>

            <div class="modal-body">

                <form id="bomForm">

                    <input type="hidden" id="editId">

                    <!-- BASIC DETAILS -->

                    <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                        <h5 class="mb-0">Basic Details</h5>

                        <button
                            type="button"
                            class="btn btn-sm"
                            id="sameBomBtn"
                            title="Same BOM Master">
                            <i class="bx bx-copy align-middle"></i>
                            Same BOM Master
                        </button>
                    </div>

                    <div class="row g-4 bom-basic-layout">
                        <div class="col-lg-7 bom-basic-fields">
                            <div class="row g-3">
                                <div class="col-12">
                                    <label class="form-label" for="brandSelect">Brand Name <span class="text-danger">*</span></label>
                                    <select id="brandSelect" class="form-select" required>
                                        <option value="">Select Brand</option>
                                        <option>NIVI BLOSSOM</option>
                                        <option>AMARI</option>
                                        <option>LITTLE DOLLY</option>
                                    </select>
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="designNumber">Design Number <span class="text-danger">*</span></label>
                                    <input type="text" id="designNumber" inputmode="numeric" pattern="[0-9]{1,18}" maxlength="18" class="form-control" placeholder="Enter design number" required>
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="colorSelect">Color <span class="text-danger">*</span></label>
                                    <div class="input-group"><select id="colorSelect" class="form-select" required><option value="">Select Color</option></select><button type="button" class="btn btn-outline-secondary" id="addBomColorBtn" title="Add color"><i class="bx bx-plus"></i></button></div>
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="mrp">MRP</label>
                                    <input id="mrp" class="form-control" type="number" min="0" step="0.01">
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="photoUpload">Choose Photo</label>
                                    <input type="file" id="photoUpload" class="form-control" accept="image/*">
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="pattern">Pattern <a href="pattern.php" target="_blank" class="small ms-2">Manage patterns</a></label>
                                    <select id="pattern" class="form-select" required><option value="">Select Pattern</option></select>
                                </div>
                            </div>
                        </div>
                        <div class="bom-photo-column">
                            <div class="bom-photo-panel">
                                <div id="photoPreview"></div>
                            </div>
                        </div>
                    </div>
                    <hr class="my-4">

                    <!-- PIECE SELECTION -->

                    <h5 class="mb-3">Pattern Pieces</h5>
                    <input type="hidden" class="piece-radio" name="pieceCount" value="">

                    <div id="pieceConfigBody" class="pattern-piece-grid"></div>

                    <hr class="my-4">

                    <!-- PRODUCTION FLOW CHART -->

                    <h5 class="mb-3">Production Flow Chart</h5>

                    <div id="bomFlowChart"></div>

                </form>

            </div>

            <div class="modal-footer">

                <button
                    type="button"
                    class="btn btn-secondary"
                    data-bs-dismiss="modal">
                    Cancel
                </button>

                <button
                    type="button"
                    class="btn btn-primary"
                    id="saveBomBtn">
                    <i class="bx bx-save me-1"></i>
                    Save BOM
                </button>

            </div>

        </div>
    </div>
</div>

<!-- SAME BOM MODAL (only Design Number search + dropdown) -->

<div class="modal fade" id="sameBomModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">

            <div class="modal-header">
                <h5 class="modal-title">Same BOM Master</h5>

                <button
                    type="button"
                    class="btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"></button>
            </div>

            <div class="modal-body">

                <label class="form-label">
                    Search Design Number <span class="text-danger">*</span>
                </label>

                <div class="position-relative">
                    <input
                        type="text"
                        id="sameDesignSearch"
                        class="form-control"
                        placeholder="Type design number..."
                        autocomplete="off">

                    <div
                        id="sameDesignDropdown"
                        class="list-group position-absolute w-100"
                        style="
                            z-index: 2000;
                            max-height: 240px;
                            overflow-y: auto;
                            display: none;
                            box-shadow: 0 4px 14px rgba(0,0,0,0.1);
                        ">
                    </div>
                </div>

                <small class="text-muted d-block mt-2">
                    Select design number Ã¢â€ â€™ pura flow Create BOM form me fill ho jayega.
                </small>

            </div>

            <div class="modal-footer">

                <button
                    type="button"
                    class="btn btn-secondary"
                    data-bs-dismiss="modal">
                    Cancel
                </button>

            </div>

        </div>
    </div>
</div>

<!-- VIEW MODAL -->

<div class="modal fade" id="viewBomModal" tabindex="-1" aria-hidden="true">

    <div class="modal-dialog modal-dialog-centered modal-xl">

        <div class="modal-content">

            <div class="modal-header">

                <h5 class="modal-title">BOM Details</h5>

                <button
                    type="button"
                    class="btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"></button>

            </div>

            <div class="modal-body" id="viewBomBody"></div>

        </div>

    </div>

</div>

<!-- PHOTO LIGHTBOX -->

<div id="photoLightbox" aria-hidden="true">
    <button type="button" class="lightbox-close" id="lightboxClose" aria-label="Close">
        <i class="bx bx-x"></i>
    </button>
    <img src="" alt="BOM Photo Large" class="lightbox-img" id="lightboxImg">
</div>

<?php include __DIR__ . "/../includes/footer.php"; ?>

<script src="assets/js/productionEngine.js?v=<?= filemtime(__DIR__ . '/../assets/js/productionEngine.js') ?>"></script>
<script src="assets/js/catalogApi.js?v=<?= filemtime(__DIR__ . '/../assets/js/catalogApi.js') ?>"></script>
<script src="assets/js/productCodes.js?v=<?= filemtime(__DIR__ . '/../assets/js/productCodes.js') ?>"></script>
<script src="assets/js/bomMaster.js?v=<?= filemtime(__DIR__ . '/../assets/js/bomMaster.js') ?>"></script>

</body>

</html>
