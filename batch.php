<?php require_once __DIR__ . '/includes/header.php'; ?>

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

            <button type="button" class="btn btn-primary" id="createBatchBtn">
                <i class="bx bx-plus me-1"></i>
                Create Batch
            </button>
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

    <div class="modal-dialog modal-dialog-centered">
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

                    <div class="row g-3">

                        <div class="col-md-12">
                            <label class="form-label">Batch ID</label>
                            <input type="text" id="batchIdPreview"
                                class="form-control" readonly>
                        </div>

                        <div class="col-md-12">
                            <label class="form-label" for="designNumber">
                                Design Number <span class="text-danger">*</span>
                            </label>

                            <input type="text" id="designNumber"
                                class="form-control"
                                list="designSuggestions"
                                placeholder="Search design number"
                                autocomplete="off" required>

                            <datalist id="designSuggestions"></datalist>

                            <small class="text-muted">
                                Select a design number from BOM Master.
                            </small>
                        </div>

                        <div class="col-md-6">
                            <label class="form-label">Brand</label>
                            <input type="text" id="brandSelect"
                                class="form-control" readonly required>
                        </div>

                        <div class="col-md-6">
                            <label class="form-label">Color</label>
                            <input type="text" id="colorSelect"
                                class="form-control" readonly required>
                        </div>

                        <div class="col-md-6">
                            <label class="form-label">Quantity</label>
                            <input type="number" id="quantityInput"
                                class="form-control"
                                min="1"
                                placeholder="Enter quantity" required>
                        </div>

                        <div class="col-md-6">
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

                    <!-- Hidden containers for internal data (not shown to user) -->
                    <div id="batchPiecesContainer" style="display:none;"></div>
                    <img id="batchPhotoPreview" src="assets/images/default.jpg" alt="" style="display:none;">

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

                <!-- Hidden view containers (data still saved) -->
                <img id="viewBatchPhoto" src="assets/images/default.jpg" alt="" style="display:none;">
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

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/batch.js"></script>
</body>

</html>