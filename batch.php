<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Batch Management</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Tables</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Batch Management</li>
                        </ol>
                    </nav>
                </div>
            </div>
            <div class="btn-list">
                <button class="btn btn-primary btn-wave me-2" id="createBatchBtn">
                    <i class="bx bx-plus align-middle"></i> Create Batch
                </button>
            </div>
        </div>
        <!-- Page Header Close -->

        <!-- Start::row-1 -->
        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            Batch List
                        </div>
                    </div>

                    <div class="card-body">
                        <!-- Filters -->
                        <div class="row mb-3">
                            <div class="col-md-2">
                                <label class="form-label">Brand Filter</label>
                                <select id="brandFilter" class="form-select">
                                    <option value="">All Brands</option>
                                    <option value="NIVI BLOSSOM">NIVI BLOSSOM</option>
                                    <option value="AMARI">AMARI</option>
                                    <option value="LITTLE DOLLY">LITTLE DOLLY</option>
                                </select>
                            </div>
                            <div class="col-md-2">
                                <label class="form-label">Priority Filter</label>
                                <select id="priorityFilter" class="form-select">
                                    <option value="">All Priorities</option>
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                </select>
                            </div>
                            <div class="col-md-2">
                                <label class="form-label">Color Filter</label>
                                <select id="colorFilter" class="form-select">
                                    <option value="">All Colors</option>
                                    <option value="Red">Red</option>
                                    <option value="Blue">Blue</option>
                                    <option value="Green">Green</option>
                                    <option value="Yellow">Yellow</option>
                                    <option value="Black">Black</option>
                                    <option value="White">White</option>
                                    <option value="Orange">Orange</option>
                                    <option value="Purple">Purple</option>
                                    <option value="Pink">Pink</option>
                                    <option value="Brown">Brown</option>
                                </select>
                            </div>

                            <div class="col-md-2 ms-auto">
                                <label class="form-label">Search</label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="bx bx-search"></i></span>
                                    <input type="text" id="searchInput" class="form-control" placeholder="Search">
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table id="batchTable" class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>Batch ID</th>
                                        <th>Photo</th>
                                        <th>Brand</th>
                                        <th>Design Number</th>
                                        <th>Color</th>
                                        <th>Quantity</th>
                                        <th>Priority</th>
                                        <th>Created At</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="batchTableBody">
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

<!-- Create/Edit Batch Modal -->
<div class="modal fade" id="batchModal" tabindex="-1" aria-labelledby="batchModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="batchModalLabel">Create Batch</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="batchForm">
                    <input type="hidden" id="editId" name="editId">

                    <div class="mb-3">
                        <label class="form-label">Upload Photo</label>
                        <input type="file" class="form-control" id="photoUpload" accept="image/*">
                        <div id="photoPreview" class="mt-2"></div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Brand Name</label>
                        <select class="form-select" id="brandSelect" name="brand" required>
                            <option value="">Select Brand</option>
                            <option value="NIVI BLOSSOM">NIVI BLOSSOM</option>
                            <option value="AMARI">AMARI</option>
                            <option value="LITTLE DOLLY">LITTLE DOLLY</option>
                        </select>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Design Number</label>
                        <input type="text" class="form-control" id="designNumber" name="designNumber" required>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Color</label>
                        <select class="form-select" id="colorSelect" name="color" required>
                            <option value="">Select Color</option>
                            <option value="Red">Red</option>
                            <option value="Blue">Blue</option>
                            <option value="Green">Green</option>
                            <option value="Yellow">Yellow</option>
                            <option value="Black">Black</option>
                            <option value="White">White</option>
                            <option value="Orange">Orange</option>
                            <option value="Purple">Purple</option>
                            <option value="Pink">Pink</option>
                            <option value="Brown">Brown</option>
                        </select>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Quantity</label>
                        <input type="number" class="form-control" id="quantity" name="quantity" required min="1">
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Priority</label>
                        <select class="form-select" id="prioritySelect" name="priority" required>
                            <option value="">Select Priority</option>
                            <option value="Low">Low</option>
                            <option value="Medium" selected>Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveBatchBtn">
                    <i class="bx bx-save me-1"></i> Save
                </button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/batch.js"></script>