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
                            <input type="hidden" id="productId" value="<?php echo isset($_GET['id']) ? $_GET['id'] : ''; ?>">
                            
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Item Description <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="description" placeholder="Enter item description" required>
                                </div>
                                
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Barcode No <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="barcode" placeholder="Enter barcode number" required>
                                </div>
                            </div>

                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Brand <span class="text-danger">*</span></label>
                                    <select class="form-select" id="brand" required>
                                        <option value="">Select Brand</option>
                                        <option value="NIVI BLOSSOM" selected>NIVI BLOSSOM (28-34)</option>
                                        <option value="AMARI">AMARI (S-L)</option>
                                        <option value="LITTLE DOLLY">LITTLE DOLLY (18-26)</option>
                                    </select>
                                </div>
                                
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Size</label>
                                    <input type="text" class="form-control" id="sizeDisplay" readonly disabled style="background-color: #f8f9fa;">
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

<script src="assets/js/product-form.js"></script>
