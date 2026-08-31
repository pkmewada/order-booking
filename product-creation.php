<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Product Creation</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Order Booking</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Product Creation</li>
                        </ol>
                    </nav>
                </div>
            </div>
            <div class="btn-list">
                <button class="btn btn-secondary btn-wave me-2" id="importProductBtn">
                    <i class="bx bx-import align-middle"></i> Import
                </button>
                <a href="product-form" class="btn btn-teal btn-wave me-2">
                    <i class="bx bx-plus align-middle"></i> Add Product
                </a>
            </div>
        </div>
        <!-- Page Header Close -->

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            Product List
                        </div>
                    </div>

                    <div class="card-body">
                        <div class="row mb-3">
                            <div class="col-md-4 ms-auto">
                                <label class="form-label">Search</label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="bx bx-search"></i></span>
                                    <input type="text" id="searchInput" class="form-control" placeholder="Search by item or barcode">
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table id="productTable" class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>Photo</th>
                                        <th>#</th>
                                        <th>Item Description</th>
                                        <th>Barcode No</th>
                                        <th>Size</th>
                                        <th>Brand</th>
                                        <th class="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="productTableBody">
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

<!-- Import Products Modal -->
<div class="modal fade" id="importModal" tabindex="-1" aria-labelledby="importModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="importModalLabel">Import Products</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <p class="text-muted fs-13">
                    Download the sample Excel template, fill in your products, then upload it here.
                    Columns required: <strong>Item Description, Barcode No, Size, Brand</strong>.
                </p>

                <button type="button" class="btn btn-outline-primary btn-sm mb-3" id="downloadTemplateBtn">
                    <i class="bx bx-download me-1"></i> Download Sample Template
                </button>

                <div class="mb-2">
                    <label class="form-label">Upload Excel File</label>
                    <input type="file" class="form-control" id="importFileInput" accept=".xlsx,.xls,.csv">
                </div>
                <div class="fs-12 text-muted" id="importFileHint"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="uploadImportBtn">
                    <i class="bx bx-upload me-1"></i> Upload &amp; Import
                </button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/product-creation.js"></script>
