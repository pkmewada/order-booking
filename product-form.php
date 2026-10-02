<?php require_once __DIR__ . '/includes/header2.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2"><?php echo isset($_GET['id']) ? 'Edit Product' : 'Add Product'; ?></h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Order Booking</a></li>
                            <li class="breadcrumb-item"><a href="product-creation">Product Creation</a></li>
                            <li class="breadcrumb-item active" aria-current="page"><?php echo isset($_GET['id']) ? 'Edit' : 'Add'; ?></li>
                        </ol>
                    </nav>
                </div>
            </div>
        </div>
        <!-- Page Header Close -->

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <?php echo isset($_GET['id']) ? 'Edit Product' : 'Add New Product'; ?>
                        </div>
                    </div>
                    <div class="card-body">
                        <form id="productForm">
                            <input type="hidden" id="productId" value="<?php echo isset($_GET['id']) ? htmlspecialchars((string) $_GET['id'], ENT_QUOTES, 'UTF-8') : ''; ?>">
                            
                            <div class="row">
                                <div class="col-md-4 mb-3">
                                    <label class="form-label" for="productDesign">Design Number <span class="text-danger">*</span></label>
                                    <input type="text" id="productDesign" class="form-control" placeholder="Enter design number" required>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label class="form-label" for="color">Colour <span class="text-danger">*</span></label>
                                    <input type="text" id="color" class="form-control" placeholder="Enter colour" required>
                                </div>
                                <div class="col-md-4 mb-3">
                                    <label class="form-label" for="brand">Brand <span class="text-danger">*</span></label>
                                    <select id="brand" class="form-select" required>
                                        <option value="">Select Brand</option>
                                        <option value="LITTLE DOLLY">LITTLE DOLLY</option>
                                        <option value="AMARI">AMARI</option>
                                        <option value="NIVI BLOSSOM">NIVI BLOSSOM</option>
                                    </select>
                                    <div id="brandSizeHint" class="small text-muted mt-1"></div>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-12">
                                    <button type="submit" class="btn btn-primary">
                                        <i class="bx bx-save me-1"></i> Save Product
                                    </button>
                                    <a href="product-creation" class="btn btn-secondary">
                                        <i class="bx bx-x me-1"></i> Cancel
                                    </a>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/product-codes.js?v=<?= filemtime(__DIR__ . '/assets/js/product-codes.js') ?>"></script><script src="assets/js/product-form.js?v=<?= filemtime(__DIR__ . '/assets/js/product-form.js') ?>"></script>
