<?php require_once __DIR__ . '/includes/header.php'; ?>

<style>
    #refreshDigitalBtn { background-color: #161617 !important; border-color: #161617 !important; color: #fff !important; }
    #refreshDigitalBtn:hover { background-color: #2b2b2d !important; border-color: #2b2b2d !important; }

    #listAllBtn, #bulkAssignBtn {
        background-color: #161617 !important; border-color: #161617 !important;
        color: #fff !important;
    }
    #listAllBtn:hover, #bulkAssignBtn:hover { background-color: #2b2b2d !important; border-color: #2b2b2d !important; }

    #availableList td, #availableList th,
    #assignedList td, #assignedList th { vertical-align: middle !important; }

    .progress-bar-container { width: 80px; height: 6px; background-color: #e9ecef; border-radius: 3px; overflow: hidden; display: inline-block; vertical-align: middle; }
    .progress-bar-fill { height: 100%; background-color: #28a745; transition: width 0.5s ease; }

    .delivery-date-badge { font-size: 12px; padding: 4px 8px; border-radius: 4px; white-space: nowrap; display: inline-block; }
    .delivery-ontrack { background-color: #d4edda; color: #155724; }
    .delivery-due-today { background-color: #fff3cd; color: #856404; }
    .delivery-overdue { background-color: #f8d7da; color: #721c24; }
    .delivery-badge-secondary { background-color: #e9ecef; color: #6c757d; }

    .damage-badge { display: inline-block; background: #fce4e4; color: #b91c1c; font-size: 12px; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
    .damage-empty { color: #9ca3af; font-size: 12px; }

    .pagination-wrap { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; flex-wrap: wrap; gap: 8px; }
    .pagination-wrap .info-text { font-size: 13px; color: #6c757d; }
    .pagination-wrap .pager { display: flex; gap: 4px; }
    .pagination-wrap .pager .page-btn { min-width: 34px; height: 34px; padding: 0 10px; border: 1px solid #dfe5f1; background: #fff; color: #18243d; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all .15s ease; display: inline-flex; align-items: center; justify-content: center; }
    .pagination-wrap .pager .page-btn:hover:not(:disabled):not(.active) { background: #f4f5f9; border-color: #c9d2e3; }
    .pagination-wrap .pager .page-btn.active { background: #161617; color: #fff; border-color: #161617; }
    .pagination-wrap .pager .page-btn:disabled { opacity: .5; cursor: not-allowed; }

    .assignment-row td { vertical-align: middle; padding: 6px 8px; }
    #assignRowsContainer .table th { background: #f8f9fa; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; border-bottom: 2px solid #dee2e6; }
    #assignRowsContainer .table td { padding: 6px 8px; vertical-align: middle; }

    .color-text { font-size: 13px; font-weight: 600; color: #18243d; }

    .priority-badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.3px; color: #fff !important; }
    .priority-badge.priority-high   { background: #dc3545; }
    .priority-badge.priority-medium { background: #1e88e5; }
    .priority-badge.priority-low    { background: #fdd835; color: #161617 !important; }

    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.3px; color: #fff !important; }
    .status-badge.pending     { background: #fdd835; color: #161617 !important; }
    .status-badge.in_progress { background: #1e88e5; }
    .status-badge.passed      { background: #198754; }
    .status-badge.stopped     { background: #dc3545; color: #fff !important; }
    .status-badge.not_assigned   { background: #dc3545; color: #fff !important; }
    .status-badge.assign_progress { background: #198754; color: #fff !important; }

    .pass-row-btn { background-color: #198754 !important; border-color: #198754 !important; color: #fff !important; }
    .pass-row-btn:hover:not(:disabled) { background-color: #157347 !important; border-color: #157347 !important; }
    .pass-row-btn:disabled { opacity: .5; cursor: not-allowed; }

    .stop-row-btn { background-color: #dc3545 !important; border-color: #dc3545 !important; color: #fff !important; }
    .stop-row-btn:hover:not(:disabled) { background-color: #b02a37 !important; border-color: #b02a37 !important; }
    .stop-row-btn:disabled { opacity: .5; cursor: not-allowed; }

    .view-row-btn { background-color: #161617 !important; border-color: #161617 !important; color: #fff !important; }
    .view-row-btn:hover { background-color: #2b2b2d !important; border-color: #2b2b2d !important; }

    .qty-pair { font-size: 13px; font-weight: 600; color: #18243d; white-space: nowrap; }
    .qty-pair .qty-total { color: #6b7280; font-weight: 500; }
    .qty-pair .qty-sep { color: #9ca3af; margin: 0 2px; }
    .qty-pair .qty-assigned { color: #15803d; font-weight: 700; }
    .qty-pair .qty-assigned.zero { color: #9ca3af; font-weight: 500; }

    .piece-num { font-weight: 700; color: #161617; }
    .piece-line { font-size: 13px; color: #18243d; line-height: 1.8; white-space: nowrap; }

    /* Detail modal */
    .detail-print-wrap { background: #fff; padding: 10px 0; }
    .detail-header-line { text-align: center; margin-bottom: 4px; }
    .detail-header-line h4 { margin: 0; font-weight: 700; color: #161617; letter-spacing: 1px; font-size: 22px; }
    .detail-header-line small { display: block; color: #9ca3af; font-size: 11px; margin-top: 4px; }
    .detail-divider { border-top: 1px solid #e2e7f1; margin: 14px 0 18px; }
    .detail-split-layout { display: grid; grid-template-columns: 1fr 240px; gap: 24px; align-items: start; margin-bottom: 20px; }
    .detail-highlight-grid { display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 14px; }
    .detail-highlight-item { padding: 8px 14px; background: #f8f9fa; border-left: 3px solid #161617; border-radius: 4px; }
    .detail-highlight-item .lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; margin-bottom: 2px; display: block; }
    .detail-highlight-item .val { font-size: 14px; color: #161617; font-weight: 700; word-break: break-word; line-height: 1.3; }
    .detail-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border: 1px solid #e2e7f1; border-radius: 6px; overflow: hidden; background: #fff; }
    .detail-info-cell { padding: 8px 12px; border-right: 1px solid #e2e7f1; border-bottom: 1px solid #e2e7f1; background: #fff; }
    .detail-info-cell:nth-child(3n) { border-right: none; }
    .detail-info-cell .lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700; margin-bottom: 2px; display: block; }
    .detail-info-cell .val { font-size: 12px; color: #18243d; font-weight: 600; word-break: break-word; line-height: 1.3; }
    .detail-photo-box { width: 100%; height: 360px; aspect-ratio: 3 / 4; border: 1px solid #dfe5f1; border-radius: 8px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .detail-photo-box img { width: 100%; height: 100%; object-fit: cover; }
    .detail-signature { margin-top: 30px; text-align: right; padding-top: 10px; }
    .detail-signature .sig-line { display: inline-block; border-top: 1px solid #161617; padding-top: 6px; min-width: 220px; text-align: center; font-size: 12px; color: #161617; font-weight: 600; letter-spacing: 0.5px; }

    /* Multi-select */
    .multi-select-wrap { position: relative; }
    .multi-select-box { min-height: 38px; padding: 5px 10px; border: 1px solid #dfe5f1; border-radius: 8px; background: #fff; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; cursor: pointer; }
    .multi-select-box:hover { border-color: #c9d2e3; }
    .multi-select-box .placeholder { color: #9aa6c2; font-size: 13px; }
    .multi-select-chip { display: inline-flex; align-items: center; gap: 4px; background: #eef2ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .multi-select-chip .chip-x { cursor: pointer; font-weight: 700; margin-left: 2px; opacity: .6; }
    .multi-select-chip .chip-x:hover { opacity: 1; }
    .multi-select-dropdown { position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; max-height: 300px; overflow-y: auto; background: #fff; border: 1px solid #dfe5f1; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 1000; display: none; }
    .multi-select-dropdown.open { display: block; }
    .multi-select-option { display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; font-size: 13px; border-bottom: 1px solid #f1f3f9; }
    .multi-select-option:hover { background: #f4f5f9; }
    .multi-select-option.selected { background: #f0f7ff; }
    .multi-select-option input { width: 16px; height: 16px; margin: 0; accent-color: #161617; }
</style>

<div class="main-content app-content">
    <div class="container-fluid">

        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Digital Print Manager</h1>
                <nav>
                    <ol class="breadcrumb mb-0">
                        <li class="breadcrumb-item"><a href="javascript:void(0);">Additional Work</a></li>
                        <li class="breadcrumb-item active">Digital Print</li>
                    </ol>
                </nav>
            </div>
            <div class="d-flex gap-2">
                <button class="btn" id="listAllBtn">
                    <i class="bx bx-list-ul align-middle me-1"></i> List
                </button>
                <button class="btn" id="bulkAssignBtn">
                    <i class="bx bx-layer-plus align-middle me-1"></i> Bulk Assign Digital Print
                </button>
                <button class="btn" id="refreshDigitalBtn">
                    <i class="bx bx-refresh align-middle"></i>
                </button>
            </div>
        </div>

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-check-circle text-success me-2"></i>
                            Approved Items — Ready for Digital Print
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>Batch ID</th><th>Photo</th><th>Brand</th><th>Design</th><th>Color</th>
                                        <th>Piece</th><th>Item</th><th>Quantity</th><th>Priority</th><th>Status</th><th>Action</th>
                                    </tr>
                                </thead>
                                <tbody id="availableList"></tbody>
                            </table>
                        </div>
                        <div class="pagination-wrap" id="availablePagination"></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-cut text-primary me-2"></i>
                            Digital Print Assignments
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>#</th><th>Batch ID</th><th>Sub-Batch</th><th>Brand</th><th>Piece Type</th><th>Worker</th>
                                        <th>Quantity</th><th>Progress</th><th>Damage</th><th>Remaining</th>
                                        <th>Priority</th><th>Delivery Date</th><th>Status</th><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="assignedList"></tbody>
                            </table>
                        </div>
                        <div class="pagination-wrap" id="assignedPagination"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- ASSIGN MODAL -->
<div class="modal fade" id="assignModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Assign Digital Print Worker</h5>
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
                    <div id="assignRowsContainer"></div>
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
<div class="modal fade" id="bulkAssignModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title"><i class="bx bx-layer-plus me-1"></i> Bulk Assign Digital Print</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div style="background:#fff; border-bottom:1px solid #e2e7f1; padding:8px 0; margin-bottom:10px;">
                    <label class="fw-semibold me-2">Select Batches:</label>
                    <div class="multi-select-wrap d-inline-block" style="min-width:400px;">
                        <div class="multi-select-box" id="multiSelectBox">
                            <span class="placeholder" id="multiSelectPlaceholder">Click to choose batches...</span>
                        </div>
                        <div class="multi-select-dropdown" id="multiSelectDropdown"></div>
                    </div>
                    <span class="ms-3 badge bg-primary" id="selectedCountBadge">0 batch(es) selected</span>
                </div>
                <div id="bulkItemsContainer"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveBulkAssignBtn">
                    <i class="bx bx-save"></i> Assign Selected
                </button>
            </div>
        </div>
    </div>
</div>

<!-- UPDATE PROGRESS MODAL -->
<div class="modal fade" id="progressModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Update Progress</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="mb-3"><label class="form-label">Sub-Batch</label><input type="text" class="form-control" id="progressSubBatch" readonly></div>
                <div class="mb-3"><label class="form-label">Worker</label><input type="text" class="form-control" id="progressWorker" readonly></div>
                <div class="row">
                    <div class="col-md-4 mb-3"><label class="form-label">Total Assigned</label><input type="text" class="form-control" id="progressTotal" readonly></div>
                    <div class="col-md-4 mb-3"><label class="form-label">Already Passed</label><input type="text" class="form-control" id="progressPassed" readonly></div>
                    <div class="col-md-4 mb-3"><label class="form-label">Remaining</label><input type="text" class="form-control" id="progressRemaining" readonly></div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Update Type</label>
                        <select class="form-select" id="progressTypeSelect">
                            <option value="completed" selected>Completed (+)</option>
                            <option value="damage">Damage (+)</option>
                        </select>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Add Quantity (+)</label>
                        <input type="number" class="form-control" id="progressQty" min="0" value="0">
                        <small class="text-muted">Max addable: <span id="progressMax">0</span></small>
                    </div>
                </div>
                <div class="alert alert-info mb-0" id="progressLivePreview" style="font-size:13px;"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="updateProgressBtn">
                    <i class="bx bx-save"></i> Update
                </button>
            </div>
        </div>
    </div>
</div>

<!-- VIEW DETAIL MODAL -->
<div class="modal fade" id="viewDetailModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Assignment Details</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="viewDetailBody"></div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-dark" id="printDetailBtn">
                    <i class="bx bx-printer me-1"></i> Print / Download
                </button>
            </div>
        </div>
    </div>
</div>

<!-- LIST ALL MODAL -->
<div class="modal fade" id="listAllModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" style="max-width:99vw; width:99vw;">
        <div class="modal-content" style="height:96vh;">
            <div class="modal-header">
                <h5 class="modal-title"><i class="bx bx-list-ul me-1"></i> All Passed Digital Print Assignments</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="listAllBody" style="overflow-y:auto;"></div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-dark" id="printListAllBtn">
                    <i class="bx bx-printer me-1"></i> Print / Download
                </button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/digital-print.js"></script>
</body>
</html>