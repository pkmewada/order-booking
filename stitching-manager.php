<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Stitching Manager</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Production</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Stitching Manager</li>
                        </ol>
                    </nav>
                </div>
            </div>
            <div class="btn-list">
                <button class="btn btn-primary btn-wave me-2" id="addStitchingBtn">
                    <i class="bx bx-plus align-middle"></i> Assign Stitching
                </button>
            </div>
        </div>
        <!-- Page Header Close -->

        <!-- OPTION A: OUTSOURCE -->
        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-building text-danger me-2"></i> OPTION A: OUTSOURCE
                            <span class="badge bg-danger ms-2" id="outsourceCount">0</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Batch</th>
                                        <th>Sub-Batch</th>
                                        <th>Part</th>
                                        <th>Firm Name</th>
                                        <th>Assigned Qty</th>
                                        <th>Completed</th>
                                        <th>Remaining</th>
                                        <th>Progress</th>
                                        <th>Delivery Date</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="outsourceList">
                                    <!-- Data will be loaded here -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- OPTION B: IN-HOUSE -->
        <div class="row mt-3">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-home text-success me-2"></i> OPTION B: IN-HOUSE
                            <span class="badge bg-success ms-2" id="inhouseCount">0</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Batch</th>
                                        <th>Sub-Batch</th>
                                        <th>Part</th>
                                        <th>Worker Name</th>
                                        <th>Size</th>
                                        <th>Assigned Qty</th>
                                        <th>Completed</th>
                                        <th>Remaining</th>
                                        <th>Progress</th>
                                        <th>Delivery Date</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="inhouseList">
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

<!-- Assign Stitching Modal -->
<div class="modal fade" id="stitchingModal" tabindex="-1" aria-labelledby="stitchingModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="stitchingModalLabel">Assign Stitching Work</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="stitchingForm">
                    <div class="mb-3">
                        <label class="form-label">Select Batch</label>
                        <select class="form-select" id="batchSelect" required>
                            <option value="">Choose Batch</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Select Part</label>
                        <select class="form-select" id="partSelect" required>
                            <option value="">Choose Part</option>
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
                <form id="progressForm">
                    <input type="hidden" id="progressId">
                    <input type="hidden" id="progressType">

                    <div class="mb-3">
                        <label class="form-label">Sub-Batch / Name</label>
                        <input type="text" class="form-control" id="progressName" readonly>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Current Progress</label>
                        <div class="d-flex align-items-center gap-3">
                            <span id="progressCurrentDisplay">0</span>
                            <span>/</span>
                            <span id="progressTotalDisplay">0</span>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Add Completed Pieces</label>
                        <div class="input-group">
                            <input type="number" class="form-control" id="progressAddQty" min="1" value="5">
                            <button type="button" class="btn btn-primary" id="addProgressBtn">Add</button>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Or set exact completed</label>
                        <div class="input-group">
                            <input type="number" class="form-control" id="progressExactQty" min="0" placeholder="Exact quantity">
                            <button type="button" class="btn btn-success" id="setProgressBtn">Set</button>
                        </div>
                    </div>

                    <div class="mb-3" id="passSection" style="display: none;">
                        <hr>
                        <label class="form-label text-success">Pass to Next Stage (Ironing)</label>
                        <p class="text-muted small">You can pass completed pieces to the next stage.</p>
                        <div class="input-group">
                            <input type="number" class="form-control" id="passQty" min="1" placeholder="Quantity to pass">
                            <button type="button" class="btn btn-success" id="passToNextBtn">Pass to Next Stage</button>
                        </div>
                        <small class="text-muted">Max pass: <span id="maxPassQty">0</span></small>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
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
    .btn-pass {
        background-color: #17a2b8;
        color: white;
    }
    .btn-pass:hover {
        background-color: #138496;
        color: white;
    }
    .btn-sm {
        padding: 4px 8px;
        font-size: 12px;
    }
    .sub-batch-label {
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
    .assignment-row .form-select-sm,
    .assignment-row .form-control-sm {
        font-size: 13px;
        padding: 4px 8px;
        height: 32px;
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
    .delivery-badge-secondary {
        background-color: #e9ecef;
        color: #6c757d;
    }
</style>

<script src="assets/js/stitching-manager.js"></script>