<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Cutting Manager</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Production</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Cutting Manager</li>
                        </ol>
                    </nav>
                </div>
            </div>
            <div class="btn-list">
                <button class="btn btn-primary btn-wave me-2" id="assignCuttingBtn">
                    <i class="bx bx-plus align-middle"></i> Assign Cutting Master
                </button>
            </div>
        </div>
        <!-- Page Header Close -->

        <!-- Cutting Masters Table -->
        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-cut text-success me-2"></i> Cutting Assignments
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
                                <tbody id="cuttingMastersList">
                                    <!-- Data will be loaded here -->
                                </tbody>
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
                        <label class="form-label">Select Batch</label>
                        <select class="form-select" id="batchSelect" required>
                            <option value="">Choose Batch</option>
                        </select>
                    </div>
                    <div id="rowsContainer">
                        <!-- Rows will be generated dynamically -->
                    </div>
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
                <div id="progressDetails">
                    <div class="mb-3">
                        <label class="form-label">Sub-Batch</label>
                        <input type="text" class="form-control" id="progressSubBatch" readonly>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Worker</label>
                        <input type="text" class="form-control" id="progressWorker" readonly>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Total Quantity</label>
                        <input type="text" class="form-control" id="progressTotal" readonly>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Completed Quantity</label>
                        <input type="number" class="form-control" id="progressCompleted" min="0">
                        <small class="text-muted">Max: <span id="progressMax">0</span></small>
                    </div>
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

<!-- Delete Confirmation Modal -->
<div class="modal fade" id="deleteModal" tabindex="-1" aria-labelledby="deleteModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="deleteModalLabel">Confirm Delete</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete this cutting assignment?</p>
                <input type="hidden" id="deleteId">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Delete</button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<style>
    .progress-bar-container {
        width: 80px;
        height: 6px;
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
    .assignment-row td {
        vertical-align: middle;
        padding: 6px 8px;
    }
    .assignment-row .form-select-sm,
    .assignment-row .form-control-sm {
        font-size: 13px;
        padding: 4px 8px;
        height: 32px;
    }
    .assignment-row .sub-batch-label {
        font-weight: 600;
        color: #0d6efd;
        font-size: 13px;
    }
    #rowsContainer .table th {
        background: #f8f9fa;
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 8px 10px;
        border-bottom: 2px solid #dee2e6;
    }
    #rowsContainer .table td {
        padding: 6px 8px;
        vertical-align: middle;
    }
    #rowsContainer .table-sm {
        font-size: 13px;
    }
    .btn-pass {
        background-color: #17a2b8;
        color: white;
    }
    .btn-pass:hover {
        background-color: #138496;
        color: white;
    }
    .passed-sub-batch {
        opacity: 0.85;
    }
    .passed-sub-batch td {
        background-color: #f8f9fa;
    }
    .delivery-date-badge {
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 4px;
        white-space: nowrap;
        display: inline-block;
    }
    .delivery-ontrack {
        background-color: #d4edda;
        color: #155724;
    }
    .delivery-due-today {
        background-color: #fff3cd;
        color: #856404;
    }
    .delivery-overdue {
        background-color: #f8d7da;
        color: #721c24;
    }
    .delivery-completed {
        background-color: #cce5ff;
        color: #004085;
    }
    .delivery-badge-secondary {
        background-color: #e9ecef;
        color: #6c757d;
    }
</style>

<script src="assets/js/cutting-manager.js"></script>