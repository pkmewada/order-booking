<?php require_once __DIR__ . '/includes/header.php'; ?>

<style>
    #refreshCuttingBtn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
    }
    #refreshCuttingBtn:hover { background-color: #2b2b2d !important; border-color: #2b2b2d !important; }

    /* ========== TABLE 1: Approved Items ========== */
    #approvedItemsList td, #approvedItemsList th {
        vertical-align: middle !important;
    }
    #approvedItemsList .piece-line {
        font-size: 13px;
        color: #18243d;
        line-height: 1.8;
        white-space: nowrap;
    }
    #approvedItemsList .piece-line .piece-num { font-weight: 700; }

    #approvedItemsList .avail-line {
        font-size: 12px;
        line-height: 1.9;
        white-space: nowrap;
    }
    #approvedItemsList .avail-line .avail-item { font-weight: 600; }
    #approvedItemsList .avail-line .avail-yes { color: #065f46; }
    #approvedItemsList .avail-line .avail-no  { color: #b91c1c; }

    #approvedItemsList .status-line { margin-bottom: 4px; }
    #approvedItemsList .status-line:last-child { margin-bottom: 0; }

    #approvedItemsList .action-line { margin-bottom: 6px; }
    #approvedItemsList .action-line:last-child { margin-bottom: 0; }

    /* ========== TABLE 2: Cutting Assignments ========== */
    .progress-bar-container {
        width: 80px; height: 6px;
        background-color: #e9ecef;
        border-radius: 3px;
        overflow: hidden;
        display: inline-block;
        vertical-align: middle;
    }
    .progress-bar-fill {
        height: 100%;
        background-color: #28a745;
        transition: width 0.5s ease;
    }
    #cuttingMastersList td { vertical-align: middle !important; }

    .delivery-date-badge { font-size: 12px; padding: 4px 8px; border-radius: 4px; white-space: nowrap; display: inline-block; }
    .delivery-ontrack { background-color: #d4edda; color: #155724; }
    .delivery-due-today { background-color: #fff3cd; color: #856404; }
    .delivery-overdue { background-color: #f8d7da; color: #721c24; }
    .delivery-badge-secondary { background-color: #e9ecef; color: #6c757d; }

    /* ========== Assign modal ========== */
    .assignment-row td { vertical-align: middle; padding: 6px 8px; }
    #rowsContainer .table th {
        background: #f8f9fa; font-weight: 600; font-size: 12px;
        text-transform: uppercase; letter-spacing: 0.5px;
        padding: 8px 10px; border-bottom: 2px solid #dee2e6;
    }
    #rowsContainer .table td { padding: 6px 8px; vertical-align: middle; }
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
                
                <button class="btn btn-dark" id="assignCuttingBtn">
                    <i class="bx bx-plus align-middle me-1"></i> Assign Cutting Master
                </button>
                <button class="btn btn-primary" id="refreshCuttingBtn">
                    <i class="bx bx-refresh me-1"></i>
                </button>
            </div>
        </div>

        <!-- ============ TABLE 1: APPROVED ITEMS (READY FOR CUTTING) ============ -->
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
                                        <th>Available Items</th>
                                        <th>Quantity</th>
                                        <th>Priority</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody id="approvedItemsList"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ============ TABLE 2: CUTTING ASSIGNMENTS ============ -->
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
                                        <th>Remaining</th>
                                        <th>Size</th>
                                        <th>Priority</th>
                                        <th>Delivery Date</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="cuttingMastersList"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </div>
</div>

<!-- Assign Cutting Master Modal -->
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
                <div class="mb-3">
                    <label class="form-label">Completed Quantity</label>
                    <input type="number" class="form-control" id="progressCompleted" min="0">
                    <small class="text-muted">Max: <span id="progressMax">0</span></small>
                </div>
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

<script src="assets/js/cutting-manager.js"></script>
</body>
</html>