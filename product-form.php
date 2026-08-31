<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2" id="formTitle">Create Product</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="product-creation">Product Creation</a></li>
                            <li class="breadcrumb-item active" aria-current="page" id="formBreadcrumb">Create Product</li>
                        </ol>
                    </nav>
                </div>
            </div>
        </div>
        <!-- Page Header Close -->

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-body">
                        <h6 class="fw-medium mb-4">Product Details</h6>

                        <form id="productForm">
                            <input type="hidden" id="productId">

                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Item Description</label>
                                    <input type="text" class="form-control" id="itemDescription" placeholder="Enter Item Description" required>
                                </div>

                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Barcode No</label>
                                    <input type="text" class="form-control" id="barcodeNo" placeholder="Enter Barcode No" required>
                                </div>

                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Brand</label>
                                    <select class="form-select" id="productBrand" required>
                                        <option value="">Select Brand</option>
                                        <option value="LITTLE DOLLY">LITTLE DOLLY</option>
                                        <option value="AMARI">AMARI</option>
                                        <option value="NIVI BLOSSOM">NIVI BLOSSOM</option>
                                    </select>
                                </div>

                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Size</label>
                                    <select class="form-select" id="productSize" required disabled>
                                        <option value="">Select Size</option>
                                    </select>
                                </div>
                            </div>

                            <button type="button" class="btn btn-teal btn-wave me-2" id="saveProductBtn">
                                Save Product
                            </button>
                            <a href="product-creation" class="btn btn-secondary btn-wave">
                                Back
                            </a>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/product-form.js"></script>
