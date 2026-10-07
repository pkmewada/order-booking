<?php require_once __DIR__ . '/includes/header2.php'; ?>

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
                <button class="btn btn-primary btn-wave me-2" id="importBomBtn">Import Bom Master</button>
                <a href="product-form" class="btn btn-dark text-white btn-wave me-2" style="background-color:#000;border-color:#000;color:#fff;">
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
                                    <input type="text" id="searchInput" class="form-control" placeholder="Search by design number or barcode">
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table id="productTable" class="table table-bordered text-nowrap w-100">
                                <thead><tr><th>Brand</th><th>Design Number</th><th>Color</th><th>Photo</th><th>Piece</th><th>Size</th><th>Action</th></tr></thead>
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




<div class="modal fade" id="bomImportModal" tabindex="-1" aria-label="Import Bom Master"><div class="modal-dialog modal-xl modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Import Bom Master</h5><button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body"><input id="bomSearch" class="form-control mb-3" placeholder="Search design or brand"><div class="table-responsive"><table class="table table-bordered text-nowrap"><thead><tr><th><input id="bomSelectAll" type="checkbox" aria-label="Select all"></th><th>Brand</th><th>Design Number</th><th>Color</th><th>Photo</th><th>Piece</th><th>Size</th><th>Barcode</th></tr></thead><tbody id="bomImportBody"></tbody></table></div><div id="bomSelectionCount"></div></div><div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button id="saveBomImport" class="btn btn-primary">Import Selected</button></div></div></div></div>
<div class="modal fade" id="productBarcodeModal" tabindex="-1" aria-label="Product Barcode"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Product Barcode</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body text-center"><div id="productBarcodeText" class="mb-3 text-break"></div><svg id="productBarcodePreview" style="max-width:100%"></svg><div id="productBarcodeQr" class="d-flex justify-content-center mt-3"></div></div></div></div></div>
<?php require_once __DIR__ . '/includes/footer.php'; ?>
<script src="assets/libs/jsbarcode/JsBarcode.all.min.js"></script>
<script src="assets/js/product-codes.js?v=<?= filemtime(__DIR__ . '/assets/js/product-codes.js') ?>"></script><script src="assets/js/product-creation.js?v=<?= filemtime(__DIR__ . '/assets/js/product-creation.js') ?>"></script>