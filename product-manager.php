<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Product Manager</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Production</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Product Manager</li>
                        </ol>
                    </nav>
                </div>
            </div>
            <div class="btn-list">
                <button class="btn btn-primary btn-wave me-2" id="addProductBtn">
                    <i class="bx bx-plus align-middle"></i> Add Product
                </button>
            </div>
        </div>
        <!-- Page Header Close -->

        <!-- Phase 8: Pairing - Upper + Lower -->
        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-layer text-success me-2"></i> PHASE 8: PAIRING - UPPER + LOWER
                            <span class="badge bg-success ms-2">Complete Garments Ready</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="alert alert-info">
                            <i class="bx bx-info-circle me-2"></i>
                            <strong>Notification:</strong> Combine upper and lower pieces to create complete garments. 
                            Total Pairs = MIN(Upper Qty, Lower Qty)
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Products Table -->
        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-package text-primary me-2"></i> Complete Garments
                            <span class="badge bg-primary ms-2" id="productCount">0</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table text-nowrap">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Product Name</th>
                                        <th>Upper Qty</th>
                                        <th>Lower Qty</th>
                                        <th>Total Pairs</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="productsList">
                                    <!-- Data will be loaded here -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="row mt-3">
            <div class="col-xl-3">
                <div class="card custom-card">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <div class="me-3">
                                <span class="avatar avatar-lg bg-primary-transparent">
                                    <i class="bx bx-layer fs-3 text-primary"></i>
                                </span>
                            </div>
                            <div>
                                <p class="mb-1 fs-12 text-muted">Total Products</p>
                                <h4 class="mb-0" id="summaryTotalProducts">0</h4>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3">
                <div class="card custom-card">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <div class="me-3">
                                <span class="avatar avatar-lg bg-success-transparent">
                                    <i class="bx bx-check-circle fs-3 text-success"></i>
                                </span>
                            </div>
                            <div>
                                <p class="mb-1 fs-12 text-muted">Ready Products</p>
                                <h4 class="mb-0" id="summaryReadyProducts">0</h4>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3">
                <div class="card custom-card">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <div class="me-3">
                                <span class="avatar avatar-lg bg-warning-transparent">
                                    <i class="bx bx-loader-circle fs-3 text-warning"></i>
                                </span>
                            </div>
                            <div>
                                <p class="mb-1 fs-12 text-muted">In Progress</p>
                                <h4 class="mb-0" id="summaryInProgress">0</h4>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-3">
                <div class="card custom-card">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <div class="me-3">
                                <span class="avatar avatar-lg bg-danger-transparent">
                                    <i class="bx bx-hourglass fs-3 text-danger"></i>
                                </span>
                            </div>
                            <div>
                                <p class="mb-1 fs-12 text-muted">Pending</p>
                                <h4 class="mb-0" id="summaryPending">0</h4>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Notification Panel -->
        <div class="row mt-3">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-bell text-danger me-2"></i> NOTIFICATION - Stock Manager
                        </div>
                    </div>
                    <div class="card-body">
                        <div id="notificationList" class="d-flex flex-wrap gap-2">
                            <!-- Notifications will appear here -->
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </div>
</div>

<!-- Add/Edit Product Modal -->
<div class="modal fade" id="productModal" tabindex="-1" aria-labelledby="productModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="productModalLabel">Add Product</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="productForm">
                    <input type="hidden" id="editId">
                    
                    <div class="mb-3">
                        <label class="form-label">Product Name</label>
                        <input type="text" class="form-control" id="productName" placeholder="Enter product name" required>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Upper Quantity</label>
                        <input type="number" class="form-control" id="upperQty" placeholder="Enter upper pieces" min="0" required>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Lower Quantity</label>
                        <input type="number" class="form-control" id="lowerQty" placeholder="Enter lower pieces" min="0" required>
                    </div>

                    <div class="alert alert-success">
                        <i class="bx bx-calculator me-2"></i>
                        <strong>Total Pairs:</strong> <span id="totalPairsDisplay">0</span> 
                        <small class="text-muted">(MIN of Upper and Lower)</small>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveProductBtn">Save Product</button>
            </div>
        </div>
    </div>
</div>

<!-- Complete Product Modal -->
<div class="modal fade" id="completeModal" tabindex="-1" aria-labelledby="completeModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="completeModalLabel">Complete Product</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="alert alert-success">
                    <i class="bx bx-check-circle me-2"></i>
                    <strong>Product Ready!</strong> This product is now complete and ready for stock.
                </div>
                <p><strong>Product:</strong> <span id="completeProductName"></span></p>
                <p><strong>Upper Qty:</strong> <span id="completeUpper"></span></p>
                <p><strong>Lower Qty:</strong> <span id="completeLower"></span></p>
                <p><strong>Total Pairs:</strong> <span id="completePairs"></span></p>
                <input type="hidden" id="completeProductId">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-success" id="confirmCompleteBtn">Mark as Complete</button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/product-manager.js"></script>