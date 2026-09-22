<?php require_once __DIR__ . '/includes/header.php'; ?>

<style>
    #refreshBatchBtn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
        box-shadow: none !important;
    }

    #refreshBatchBtn:hover,
    #refreshBatchBtn:focus {
        background-color: #2b2b2d !important;
        border-color: #2b2b2d !important;
        color: #fff !important;
    }

    #refreshBatchBtn.spinning i {
        animation: spinRefresh 0.8s linear infinite;
        display: inline-block;
    }

    @keyframes spinRefresh {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    #createBatchBtn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
    }

    #createBatchBtn:hover,
    #createBatchBtn:focus {
        background-color: #2b2b2d !important;
        border-color: #2b2b2d !important;
        color: #fff !important;
    }

    .view-batch-btn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
    }

    .view-batch-btn:hover,
    .view-batch-btn:focus {
        background-color: #2b2b2d !important;
        border-color: #2b2b2d !important;
        color: #fff !important;
    }

    .edit-batch-btn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
    }

    .edit-batch-btn:hover,
    .edit-batch-btn:focus {
        background-color: #2b2b2d !important;
        border-color: #2b2b2d !important;
        color: #fff !important;
    }

    .delete-batch-btn {
        background-color: #dc3545 !important;
        border-color: #dc3545 !important;
        color: #fff !important;
    }

    .delete-batch-btn:hover,
    .delete-batch-btn:focus {
        background-color: #bb2d3b !important;
        border-color: #bb2d3b !important;
        color: #fff !important;
    }

    .pass-batch-btn {
        background-color: #198754 !important;
        border-color: #198754 !important;
        color: #fff !important;
    }

    .pass-batch-btn:hover,
    .pass-batch-btn:focus {
        background-color: #157347 !important;
        border-color: #157347 !important;
        color: #fff !important;
    }

    #batchForm .btn-primary {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
    }

    #batchForm .btn-primary:hover,
    #batchForm .btn-primary:focus {
        background-color: #2b2b2d !important;
        border-color: #2b2b2d !important;
        color: #fff !important;
    }

    /* ---------- Design Number Search + Dropdown ---------- */
    .design-search-wrap {
        position: relative;
    }

    .design-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 2000;
        max-height: 240px;
        overflow-y: auto;
        display: none;
        background: #fff;
        border: 1px solid #dfe5f1;
        border-top: none;
        border-radius: 0 0 7px 7px;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
    }

    .design-dropdown .design-option {
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f1f3f9;
        font-size: 14px;
    }

    .design-dropdown .design-option:last-child {
        border-bottom: none;
    }

    .design-dropdown .design-option:hover,
    .design-dropdown .design-option.active {
        background: #f4f5f9;
    }

    .design-dropdown .design-option .design-meta {
        font-size: 12px;
        color: #6c7a92;
        margin-top: 2px;
    }

    /* ---------- Photo in modal ---------- */
    .batch-photo-box {
        width: 100%;
        aspect-ratio: 1 / 1;
        border: 1px solid #dfe5f1;
        border-radius: 8px;
        background: #f8f9fc;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }

    .batch-photo-box img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    /* ---------- Photo in table (clickable) ---------- */
    .batch-table-photo {
        width: 55px;
        height: 55px;
        object-fit: cover;
        border-radius: 7px;
        border: 1px solid #e9edf5;
        cursor: pointer;
        transition: transform .15s ease;
    }

    .batch-table-photo:hover {
        transform: scale(1.06);
    }

    /* ---------- Photo zoom modal ---------- */
    #photoZoomModal .modal-content {
        background: transparent;
        border: none;
    }

    #photoZoomModal .modal-body {
        padding: 0;
        text-align: center;
    }

    #photoZoomModal img {
        max-width: 100%;
        max-height: 85vh;
        border-radius: 10px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    }

    #photoZoomModal .btn-close {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 10;
        filter: invert(1);
        opacity: 1;
    }

    /* ---------- Color badge (same as BOM Master) ---------- */
    .color-badge {
        display: inline-block;
        padding: 5px 12px;
        border-radius: 6px;
        color: #fff !important;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.3px;
        border: 1px solid rgba(0, 0, 0, 0.08);
    }

    .color-badge[style*="#fdd835"],
    .color-badge[style*="#ffffff"] {
        color: #161617 !important;
        border: 1px solid #cfd6e4;
    }

    /* ---------- Priority badge ---------- */
    .priority-badge {
        display: inline-block;
        padding: 5px 12px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.3px;
        color: #fff !important;
    }

    .priority-badge.priority-high {
        background: #dc3545;
    }

    .priority-badge.priority-medium {
        background: #1e88e5;
    }

    .priority-badge.priority-low {
        background: #fdd835;
        color: #161617 !important;
    }
</style>

<div class="main-content app-content">
    <div class="container-fluid">

        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Batch Management</h1>
                <nav>
                    <ol class="breadcrumb mb-0">
                        <li class="breadcrumb-item">
                            <a href="javascript:void(0);">Masters</a>
                        </li>
                        <li class="breadcrumb-item active">Batch Management</li>
                    </ol>
                </nav>
            </div>

            <div class="d-flex gap-2">
                

                <button type="button" class="btn btn-primary" id="createBatchBtn">
                    <i class="bx bx-plus me-1"></i>
                    Create Batch
                </button>

                <button type="button" class="btn" id="refreshBatchBtn" title="Refresh">
                    <i class="bx bx-refresh align-middle"></i>
                </button>
                
            </div>
        </div>

        <div class="card custom-card">
            <div class="card-header">
                <div class="card-title">Batch List</div>
            </div>

            <div class="card-body">

                <div class="row mb-3">
                    <div class="col-md-3 mb-3 mb-md-0">
                        <label class="form-label" for="brandFilter">Brand</label>
                        <select id="brandFilter" class="form-select">
                            <option value="">All Brands</option>
                        </select>
                    </div>

                    <div class="col-md-3 mb-3 mb-md-0">
                        <label class="form-label" for="priorityFilter">Priority</label>
                        <select id="priorityFilter" class="form-select">
                            <option value="">All Priority</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>

                    <div class="col-md-3 mb-3 mb-md-0">
                        <label class="form-label" for="colorFilter">Color</label>
                        <select id="colorFilter" class="form-select">
                            <option value="">All Colors</option>
                        </select>
                    </div>

                    <div class="col-md-3">
                        <label class="form-label" for="batchSearch">Search</label>
                        <div class="input-group">
                            <span class="input-group-text">
                                <i class="bx bx-search"></i>
                            </span>
                            <input
                                type="text"
                                id="batchSearch"
                                class="form-control"
                                placeholder="Batch ID, design number...">
                        </div>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-bordered text-nowrap align-middle w-100">
                        <thead>
                            <tr>
                                <th>Batch ID</th>
                                <th>Photo</th>
                                <th>Brand</th>
                                <th>Design Number</th>
                                <th>Color</th>
                                <th>Quantity</th>
                                <th>Priority</th>
                                <th>Action</th>
                            </tr>
                        </thead>

                        <tbody id="batchTableBody"></tbody>
                    </table>
                </div>

            </div>
        </div>

    </div>
</div>

<!-- CREATE / EDIT BATCH MODAL -->
<div class="modal fade" id="batchModal" tabindex="-1"
    aria-labelledby="batchModalLabel" aria-hidden="true">

    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">

            <div class="modal-header">
                <h5 class="modal-title" id="batchModalLabel">
                    Create Batch
                </h5>

                <button type="button" class="btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"></button>
            </div>

            <form id="batchForm">

                <div class="modal-body">

                    <input type="hidden" id="editBatchId">

                    <!-- Line 1: Batch ID + Design Number -->
                    <div class="row g-3 mb-3">

                        <div class="col-md-6">
                            <label class="form-label">Batch ID</label>
                            <input type="text" id="batchIdPreview"
                                class="form-control" readonly>
                        </div>

                        <div class="col-md-6">
                            <label class="form-label" for="designNumber">
                                Design Number <span class="text-danger">*</span>
                            </label>

                            <div class="design-search-wrap">
                                <input type="text" id="designNumber"
                                    class="form-control"
                                    placeholder="Search design number"
                                    autocomplete="off" required>

                                <div id="designDropdown" class="design-dropdown"></div>
                            </div>

                            <small class="text-muted">
                                Type to search. Select from dropdown.
                            </small>
                        </div>

                    </div>

                    <!-- Line 2: Photo (left) + Quantity (right) -->
                    <div class="row g-3">

                        <div class="col-md-6">
                            <label class="form-label">Design Photo</label>

                            <div class="batch-photo-box">
                                <img id="batchPhotoPreview"
                                    src="assets/images/default.jpg"
                                    alt="Design Photo">
                            </div>
                        </div>

                        <div class="col-md-6">

                            <div class="mb-3">
                                <label class="form-label">Brand</label>
                                <input type="text" id="brandSelect"
                                    class="form-control" readonly>
                            </div>

                            <div class="mb-3">
                                <label class="form-label">Color</label>
                                <input type="text" id="colorSelect"
                                    class="form-control" readonly>
                            </div>

                            <div class="mb-3">
                                <label class="form-label">Quantity</label>
                                <input type="number" id="quantityInput"
                                    class="form-control"
                                    min="1"
                                    placeholder="Enter quantity" required>
                            </div>

                            <div>
                                <label class="form-label">Priority</label>
                                <select id="prioritySelect"
                                    class="form-select" required>
                                    <option value="">Select Priority</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>

                        </div>

                    </div>

                    <!-- Hidden containers -->
                    <div id="batchPiecesContainer" style="display:none;"></div>

                    <div id="batchFormMessage"
                        class="alert mt-3"
                        style="display:none;"></div>

                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-light"
                        data-bs-dismiss="modal">
                        Cancel
                    </button>

                    <button type="submit" class="btn btn-primary">
                        <i class="bx bx-save me-1"></i>
                        Save Batch
                    </button>
                </div>

            </form>

        </div>
    </div>
</div>

<!-- VIEW BATCH MODAL -->
<div class="modal fade" id="viewBatchModal" tabindex="-1"
    aria-labelledby="viewBatchModalLabel" aria-hidden="true">

    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">

            <div class="modal-header">
                <h5 class="modal-title" id="viewBatchModalLabel">
                    Batch Details
                </h5>

                <button type="button" class="btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"></button>
            </div>

            <div class="modal-body">

                <div class="table-responsive">
                    <table class="table table-bordered">
                        <tbody>
                            <tr>
                                <th>Batch ID</th>
                                <td id="viewBatchId">-</td>
                            </tr>
                            <tr>
                                <th>Brand</th>
                                <td id="viewBatchBrand">-</td>
                            </tr>
                            <tr>
                                <th>Design Number</th>
                                <td id="viewBatchDesign">-</td>
                            </tr>
                            <tr>
                                <th>Color</th>
                                <td id="viewBatchColor">-</td>
                            </tr>
                            <tr>
                                <th>Quantity</th>
                                <td id="viewBatchQuantity">-</td>
                            </tr>
                            <tr>
                                <th>Priority</th>
                                <td id="viewBatchPriority">-</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Hidden -->
                <div id="viewBatchItems" style="display:none;"></div>

            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-light"
                    data-bs-dismiss="modal">
                    Close
                </button>
            </div>

        </div>
    </div>
</div>

<!-- PHOTO ZOOM MODAL -->
<div class="modal fade" id="photoZoomModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            <div class="modal-body">
                <img id="photoZoomImg" src="" alt="Zoomed Photo">
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/batch.js"></script>
</body>

</html>