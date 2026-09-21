<?php require_once __DIR__ . '/includes/header.php'; ?>

<style>
    #refreshCuttingBtn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
    }
    #refreshCuttingBtn:hover { background-color: #2b2b2d !important; border-color: #2b2b2d !important; }
    #bulkAssignBtn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
    }
    #bulkAssignBtn:hover { background-color: #2b2b2d !important; border-color: #2b2b2d !important; }

    #approvedItemsList td, #approvedItemsList th { vertical-align: middle !important; }
    #approvedItemsList .piece-line {
        font-size: 13px; color: #18243d; line-height: 1.8; white-space: nowrap;
    }
    #approvedItemsList .piece-line .piece-num { font-weight: 700; }

    .progress-bar-container {
        width: 80px; height: 6px; background-color: #e9ecef;
        border-radius: 3px; overflow: hidden; display: inline-block; vertical-align: middle;
    }
    .progress-bar-fill {
        height: 100%; background-color: #28a745; transition: width 0.5s ease;
    }
    #cuttingMastersList td { vertical-align: middle !important; }

    .delivery-date-badge { font-size: 12px; padding: 4px 8px; border-radius: 4px; white-space: nowrap; display: inline-block; }
    .delivery-ontrack { background-color: #d4edda; color: #155724; }
    .delivery-due-today { background-color: #fff3cd; color: #856404; }
    .delivery-overdue { background-color: #f8d7da; color: #721c24; }
    .delivery-badge-secondary { background-color: #e9ecef; color: #6c757d; }

    .damage-badge {
        display: inline-block;
        background: #fce4e4;
        color: #b91c1c;
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
    }
    .damage-empty { color: #9ca3af; font-size: 12px; }

    .pagination-wrap {
        display: flex; justify-content: space-between; align-items: center;
        margin-top: 12px; flex-wrap: wrap; gap: 8px;
    }
    .pagination-wrap .info-text { font-size: 13px; color: #6c757d; }
    .pagination-wrap .pager { display: flex; gap: 4px; }
    .pagination-wrap .pager .page-btn {
        min-width: 34px; height: 34px; padding: 0 10px;
        border: 1px solid #dfe5f1; background: #fff; color: #18243d;
        border-radius: 6px; font-size: 13px; font-weight: 500;
        cursor: pointer; transition: all .15s ease;
        display: inline-flex; align-items: center; justify-content: center;
    }
    .pagination-wrap .pager .page-btn:hover:not(:disabled):not(.active) { background: #f4f5f9; border-color: #c9d2e3; }
    .pagination-wrap .pager .page-btn.active { background: #161617; color: #fff; border-color: #161617; }
    .pagination-wrap .pager .page-btn:disabled { opacity: .5; cursor: not-allowed; }

    .assignment-row td { vertical-align: middle; padding: 6px 8px; }
    #rowsContainer .table th {
        background: #f8f9fa; font-weight: 600; font-size: 12px;
        text-transform: uppercase; letter-spacing: 0.5px;
        padding: 8px 10px; border-bottom: 2px solid #dee2e6;
    }
    #rowsContainer .table td { padding: 6px 8px; vertical-align: middle; }

    /* Bulk modal */
    #bulkAssignModal .modal-dialog { max-width: 100%; width: 100%; height: 100%; margin: 0; }
    #bulkAssignModal .modal-content { height: 100vh; border-radius: 0; border: none; }
    #bulkAssignModal .modal-body { overflow-y: auto; padding: 16px 20px; }

    .bulk-toolbar {
        position: sticky; top: 0; z-index: 10;
        background: #fff; border-bottom: 1px solid #e2e7f1;
        padding: 12px 0; margin-bottom: 16px;
        display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    }

    .bulk-item-card {
        border: 1px solid #e2e7f1; border-radius: 10px; background: #fff;
        padding: 12px; margin-bottom: 16px;
    }
    .bulk-item-header {
        display: flex; align-items: flex-start; gap: 12px;
        border-bottom: 1px dashed #eef1f7; padding-bottom: 12px; margin-bottom: 12px;
    }
    .bulk-item-title { font-weight: 600; font-size: 14px; color: #18243d; }
    .bulk-item-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }

    .bulk-qty-summary {
        display: flex; gap: 10px; margin-top: 6px;
    }
    .bulk-qty-pill {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 3px 10px; border-radius: 999px;
        font-size: 11px; font-weight: 600;
    }
    .bulk-qty-pill.total { background: #eef2ff; color: #3730a3; }
    .bulk-qty-pill.assigned { background: #d1fae5; color: #065f46; }
    .bulk-qty-pill.remaining { background: #fef3c7; color: #92400e; }

    /* Fixed layout — Copy column tight */
    .split-row-table { width: 100%; font-size: 13px; margin-bottom: 0; table-layout: fixed; }
    .split-row-table th {
        background: #f8f9fa; font-weight: 600; font-size: 11px;
        text-transform: uppercase; letter-spacing: 0.4px;
        padding: 6px 8px; border-bottom: 1px solid #e9edf5;
        color: #4b5563;
    }
    .split-row-table td {
        padding: 5px 8px; vertical-align: middle;
        border-bottom: 1px solid #f1f3f9;
    }
    .split-row-table tr:last-child td { border-bottom: none; }
    .split-row-table input, .split-row-table select { font-size: 12px; padding: 4px 6px; height: auto; }

    /* Copy column at far right — tight 50px */
    .split-row-table th.copy-header-cell {
        width: 50px;
    }
    .split-row-table td.copy-col-cell {
        padding: 0 !important;
        vertical-align: middle !important;
        border-bottom: 1px solid #f1f3f9 !important;
        width: 50px;
        text-align: center;
    }

    .copy-row-side-btn {
        background-color: #198754 !important;
        border: 1px solid #198754 !important;
        color: #fff !important;
        font-size: 12px !important;
        padding: 4px 8px !important;
        font-weight: 600;
        border-radius: 6px;
        white-space: nowrap;
        min-width: 34px;
    }
    .copy-row-side-btn:disabled {
        background-color: #f3f4f6 !important;
        border-color: #e5e7eb !important;
        color: #9ca3af !important;
        cursor: not-allowed;
    }
    .copy-row-side-btn:not(:disabled):hover {
        background-color: #157347 !important;
        border-color: #157347 !important;
    }

    .multi-select-wrap { position: relative; flex: 1 1 420px; max-width: 560px; }
    .multi-select-box {
        min-height: 42px; padding: 6px 10px;
        border: 1px solid #dfe5f1; border-radius: 8px; background: #fff;
        display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
        cursor: pointer; transition: all .15s ease;
    }
    .multi-select-box:hover { border-color: #c9d2e3; }
    .multi-select-box.open { border-color: #161617; box-shadow: 0 0 0 3px rgba(22,22,23,0.08); }
    .multi-select-box .placeholder { color: #9aa6c2; font-size: 13px; }
    .multi-select-chip {
        display: inline-flex; align-items: center; gap: 4px;
        background: #eef2ff; color: #3730a3; padding: 2px 8px;
        border-radius: 4px; font-size: 12px; font-weight: 500;
    }
    .multi-select-chip .chip-x { cursor: pointer; font-weight: 700; margin-left: 2px; opacity: .6; }
    .multi-select-chip .chip-x:hover { opacity: 1; }
    .multi-select-box .caret { margin-left: auto; color: #6b7280; transition: transform .2s ease; }
    .multi-select-box.open .caret { transform: rotate(180deg); }

    .multi-select-dropdown {
        position: absolute; top: 100%; left: 0; right: 0;
        margin-top: 4px; max-height: 340px; overflow-y: auto;
        background: #fff; border: 1px solid #dfe5f1; border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        z-index: 1000; display: none;
    }
    .multi-select-dropdown.open { display: block; }
    .multi-select-dropdown .search-row {
        padding: 8px 10px; border-bottom: 1px solid #eef1f7;
        position: sticky; top: 0; background: #fff; z-index: 2;
    }
    .multi-select-dropdown .search-row input { font-size: 13px; padding: 6px 10px; }
    .multi-select-option {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; cursor: pointer; font-size: 13px;
        border-bottom: 1px solid #f1f3f9;
        transition: background .12s ease;
    }
    .multi-select-option:last-child { border-bottom: none; }
    .multi-select-option:hover { background: #f4f5f9; }
    .multi-select-option.selected { background: #f0f7ff; }
    .multi-select-option input[type="checkbox"] {
        width: 16px; height: 16px; margin: 0;
        accent-color: #161617; cursor: pointer; flex-shrink: 0;
    }
    .multi-select-option .opt-title { font-weight: 500; color: #18243d; }
    .multi-select-option .opt-sub { font-size: 11px; color: #6b7280; margin-top: 1px; }
    .multi-select-dropdown .empty-msg { padding: 14px; text-align: center; color: #9aa6c2; font-size: 13px; }

    .bulk-apply-split-btn {
        font-size: 11px !important;
        padding: 3px 8px !important;
    }
    .bulk-global-split { font-size: 12px !important; }

    /* Pass-to-stitching button in modal */
    .pass-stitching-modal-btn {
        background-color: #198754 !important;
        border-color: #198754 !important;
        color: #fff !important;
    }
    .pass-stitching-modal-btn:hover {
        background-color: #157347 !important;
        border-color: #157347 !important;
    }
</style>

<div class="main-content app-content">
    <div class="container-fluid">

        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Cutting Manager</h1>
                <nav>
                    <ol class="breadcrumb mb-0">
                        <li class="breadcrumb-item"><a href="javascript:void(0);">Production</a></li>
                        <li class="breadcrumb-item active">Cutting Manager</li>
                    </ol>
                </nav>
            </div>
            <div class="d-flex gap-2">
                <button class="btn" id="bulkAssignBtn">
                    <i class="bx bx-layer-plus align-middle me-1"></i> Bulk Assign Cutting Master
                </button>
                <button class="btn btn-primary" id="refreshCuttingBtn">
                    <i class="bx bx-refresh me-1"></i>
                </button>
            </div>
        </div>

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-check-circle text-success me-2"></i> Approved Items — Ready for Cutting
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>Batch ID</th>
                                        <th>Photo</th>
                                        <th>Brand</th>
                                        <th>Design</th>
                                        <th>Color</th>
                                        <th>Piece</th>
                                        <th>Item</th>
                                        <th>Quantity</th>
                                        <th>Priority</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody id="approvedItemsList"></tbody>
                            </table>
                        </div>
                        <div class="pagination-wrap" id="approvedPagination"></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-cut text-primary me-2"></i> Cutting Assignments
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Batch ID</th>
                                        <th>Sub-Batch</th>
                                        <th>Brand</th>
                                        <th>Piece Type</th>
                                        <th>Worker</th>
                                        <th>Quantity</th>
                                        <th>Progress</th>
                                        <th>Damage</th>
                                        <th>Remaining</th>
                                        <th>Priority</th>
                                        <th>Delivery Date</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="cuttingMastersList"></tbody>
                            </table>
                        </div>
                        <div class="pagination-wrap" id="cuttingPagination"></div>
                    </div>
                </div>
            </div>
        </div>

    </div>
</div>

<!-- SINGLE ASSIGN MODAL -->
<div class="modal fade" id="assignModal" tabindex="-1" aria-labelledby="assignModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="assignModalLabel">Assign Cutting Master</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="assignForm">
                    <div class="mb-3">
                        <label class="form-label">Select Batch (From Approved Pool)</label>
                        <select class="form-select" id="batchSelect" required>
                            <option value="">Choose Batch</option>
                        </select>
                    </div>
                    <div id="rowsContainer"></div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveAssignBtn">
                    <i class="bx bx-save"></i> Assign
                </button>
            </div>
        </div>
    </div>
</div>

<!-- BULK ASSIGN MODAL -->
<div class="modal fade" id="bulkAssignModal" tabindex="-1" aria-labelledby="bulkAssignModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="bulkAssignModalLabel">
                    <i class="bx bx-layer-plus me-1"></i> Bulk Assign Cutting Master
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="bulk-toolbar">
                    <label class="mb-0 fw-semibold" style="font-size:13px;">Select Batches:</label>
                    <div class="multi-select-wrap" id="multiSelectWrap">
                        <div class="multi-select-box" id="multiSelectBox">
                            <span class="placeholder" id="multiSelectPlaceholder">Click to choose batches...</span>
                            <i class="bx bx-chevron-down caret"></i>
                        </div>
                        <div class="multi-select-dropdown" id="multiSelectDropdown">
                            <div class="search-row">
                                <input type="text" class="form-control form-control-sm" id="multiSelectSearch" placeholder="Search batch, brand, design...">
                            </div>
                            <div id="multiSelectOptions"></div>
                        </div>
                    </div>
                    <span class="ms-auto badge bg-primary" id="selectedCountBadge">0 batch(es) selected</span>
                </div>

                <div id="bulkItemsContainer"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveBulkAssignBtn">
                    <i class="bx bx-save me-1"></i> Assign Selected
                </button>
            </div>
        </div>
    </div>
</div>

<!-- Update Progress Modal -->
<div class="modal fade" id="progressModal" tabindex="-1" aria-labelledby="progressModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="progressModalLabel">Update Progress</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="mb-3"><label class="form-label">Sub-Batch</label><input type="text" class="form-control" id="progressSubBatch" readonly></div>
                <div class="mb-3"><label class="form-label">Worker</label><input type="text" class="form-control" id="progressWorker" readonly></div>
                <div class="mb-3"><label class="form-label">Total Quantity</label><input type="text" class="form-control" id="progressTotal" readonly></div>

                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Status</label>
                        <select class="form-select" id="progressTypeSelect">
                            <option value="completed" selected>Completed</option>
                            <option value="damage">Damage</option>
                        </select>
                        <small class="text-muted">Damage qty moves to Repair</small>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Quantity</label>
                        <input type="number" class="form-control" id="progressQty" min="0">
                        <small class="text-muted">Max: <span id="progressMax">0</span></small>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn pass-stitching-modal-btn" id="passStitchingFromModalBtn" style="display:none;">
                    <i class="bx bx-right-arrow-alt"></i> Pass to Stitching
                </button>
                <button type="button" class="btn btn-primary" id="updateProgressBtn">
                    <i class="bx bx-save"></i> Update
                </button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/cutting-manager.js"></script>
</body>
</html>