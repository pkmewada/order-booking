<?php require_once __DIR__ . '/includes/header.php'; ?>

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
            <button class="btn btn-primary" id="assignCuttingBtn">
                <i class="bx bx-plus align-middle"></i> Assign Cutting Master
            </button>
        </div>

        <!-- TABLE 1: Approved Items from Batch Approval -->
        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-check-circle text-success me-2"></i> Approved Items (Ready for Cutting)
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Photo</th>
                                        <th>Batch ID</th>
                                        <th>Brand</th>
                                        <th>Design</th>
                                        <th>Color</th>
                                        <th>Piece</th>
                                        <th>Item</th>
                                        <th>Available Items</th>
                                        <th>Qty</th>
                                        <th>Priority</th>
                                        <th>Source</th>
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

        <!-- TABLE 2: Cutting Assignments -->
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
                            <table class="table table-bordered text-nowrap">
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

<style>
    .progress-bar-container { width: 80px; height: 6px; background-color: #e9ecef; border-radius: 3px; overflow: hidden; display: inline-block; vertical-align: middle; }
    .progress-bar-fill { height: 100%; background-color: #28a745; transition: width 0.5s ease; }
    .assignment-row td { vertical-align: middle; padding: 6px 8px; }
    #rowsContainer .table th { background: #f8f9fa; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; border-bottom: 2px solid #dee2e6; }
    #rowsContainer .table td { padding: 6px 8px; vertical-align: middle; }
    .btn-pass { background-color: #17a2b8; color: white; }
    .btn-pass:hover { background-color: #138496; color: white; }
    .delivery-date-badge { font-size: 12px; padding: 4px 8px; border-radius: 4px; white-space: nowrap; display: inline-block; }
    .delivery-ontrack { background-color: #d4edda; color: #155724; }
    .delivery-due-today { background-color: #fff3cd; color: #856404; }
    .delivery-overdue { background-color: #f8d7da; color: #721c24; }
    .delivery-badge-secondary { background-color: #e9ecef; color: #6c757d; }
    .item-chip { display: inline-block; background: #f1f5fb; color: #18243d; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin: 2px 2px 0 0; }
</style>

<script src="assets/js/cutting-manager.js"></script>
</body>
</html>