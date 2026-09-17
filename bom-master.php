<?php
/*
|--------------------------------------------------------------------------
| BOM MASTER
|--------------------------------------------------------------------------
| Local Storage based BOM Master
|--------------------------------------------------------------------------
*/

include __DIR__ . "/includes/header.php";
?>

<style>
    /* Page title + breadcrumb — black */
    .page-title,
    .page-header-breadcrumb .breadcrumb-item,
    .page-header-breadcrumb .breadcrumb-item a,
    .page-header-breadcrumb .breadcrumb-item.active {
        color: #161617 !important;
    }

    .page-header-breadcrumb .breadcrumb-item a:hover {
        color: #000 !important;
    }

    .page-header-breadcrumb .breadcrumb-item + .breadcrumb-item::before {
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
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
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
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 12px 14px;
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
        white-space: nowrap;
    }

    .piece-work-container {
        width: 100%;
        padding: 0;
    }

    .piece-work-container > .additional-work-row:first-child {
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
        gap: 6px;
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
        font-weight: 500;
    }

    .bom-flow-connector {
        display: inline-flex;
        align-items: center;
        color: #9aa6c2;
        font-size: 14px;
        font-weight: 600;
        margin: 0 4px;
    }

    .bom-flow-connector::before {
        content: "→";
    }

    #bomModal .modal-dialog {
        max-width: 100%;
        width: 100%;
        height: 100%;
        margin: 0;
    }

    #bomModal .modal-content {
        height: 100vh;
        border-radius: 0;
        border: none;
    }

    #bomModal .modal-body {
        overflow-y: auto;
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
        .item-list-options {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }
    }

    @media (max-width: 768px) {
        #pieceConfigTable {
            min-width: 980px;
        }

        .item-list-options {
            grid-template-columns: repeat(3, minmax(105px, 1fr));
            gap: 12px;
        }

        .work-row-inner {
            grid-template-columns: 1fr;
        }

        .piece-head-row {
            flex-wrap: wrap;
        }
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

                    <div class="col-md-4 ms-auto">
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
                    <table class="table table-bordered align-middle w-100">
                        <thead>
                            <tr>
                                <th>Brand</th>
                                <th>Design Number</th>
                                <th>Color</th>
                                <th>Photo</th>
                                <th>Piece</th>
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

                    <div class="row g-3">

                        <div class="col-md-4">
                            <label class="form-label">
                                Brand Name <span class="text-danger">*</span>
                            </label>

                            <select id="brandSelect" class="form-select" required>
                                <option value="">Select Brand</option>
                                <option>NIVI BLOSSOM</option>
                                <option>AMARI</option>
                                <option>LITTLE DOLLY</option>
                            </select>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                Design Number <span class="text-danger">*</span>
                            </label>

                            <input
                                type="text"
                                id="designNumber"
                                class="form-control"
                                placeholder="Enter design number"
                                required>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                Color <span class="text-danger">*</span>
                            </label>

                            <select id="colorSelect" class="form-select" required>
                                <option value="">Select Color</option>
                                <option>Red</option>
                                <option>Blue</option>
                                <option>Green</option>
                                <option>Yellow</option>
                                <option>Black</option>
                                <option>White</option>
                                <option>Orange</option>
                                <option>Purple</option>
                                <option>Pink</option>
                                <option>Brown</option>
                            </select>
                        </div>

                        <div class="col-md-6">
                            <label class="form-label">Upload Photo</label>

                            <input
                                type="file"
                                id="photoUpload"
                                class="form-control"
                                accept="image/*">

                            <div id="photoPreview" class="mt-2"></div>
                        </div>

                    </div>

                    <hr class="my-4">

                    <!-- PIECE SELECTION -->

                    <h5 class="mb-3">Piece Selection</h5>

                    <div class="d-flex flex-wrap gap-4 mb-4">

                        <?php for ($i = 1; $i <= 5; $i++): ?>

                            <div class="form-check">
                                <input
                                    class="form-check-input piece-radio"
                                    type="radio"
                                    name="pieceCount"
                                    value="<?= $i ?>"
                                    id="pieceRadio<?= $i ?>">

                                <label
                                    class="form-check-label"
                                    for="pieceRadio<?= $i ?>">
                                    <?= $i ?> Pic
                                </label>
                            </div>

                        <?php endfor; ?>

                    </div>

                    <div class="table-responsive">

                        <table class="table align-middle" id="pieceConfigTable">

                            <thead>
                                <tr>
                                    <th class="piece-col">Piece</th>
                                    <th class="work-col">Additional Work</th>
                                </tr>
                            </thead>

                            <tbody id="pieceConfigBody">



                            </tbody>

                        </table>

                    </div>

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
                    Select design number → pura flow Create BOM form me fill ho jayega.
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

<?php include __DIR__ . "/includes/footer.php"; ?>

<script src="assets/js/bom-master.js"></script>

</body>

</html>