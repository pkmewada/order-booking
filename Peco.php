<?php require_once __DIR__ . '/includes/header.php'; ?>

<style>
    #refreshBtn { background-color: #161617 !important; border-color: #161617 !important; color: #fff !important; }
    #refreshBtn:hover { background-color: #2b2b2d !important; border-color: #2b2b2d !important; }

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
</style>

<div class="main-content app-content">
    <div class="container-fluid">

        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Peco Manager</h1>
                <nav>
                    <ol class="breadcrumb mb-0">
                        <li class="breadcrumb-item"><a href="javascript:void(0);">Additional Work</a></li>
                        <li class="breadcrumb-item active">Peco</li>
                    </ol>
                </nav>
            </div>
            <button type="button" class="btn btn-primary" id="refreshBtn">
                <i class="bx bx-refresh me-1"></i>
            </button>
        </div>

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-check-circle text-success me-2"></i>
                            Approved Items — Ready for Peco
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
                            Peco Assignments
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

<div class="modal fade" id="assignModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Assign Peco Worker</h5>
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

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/additional-work-template.js"></script>
<script>
    window.ADDITIONAL_WORK_CONFIG = {
        workType: "Peco",
        storageKey: "addWork_peco"
    };
</script>
</body>
</html>