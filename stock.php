<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Stock Manager</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Production</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Stock Manager</li>
                        </ol>
                    </nav>
                </div>
            </div>
            <div class="btn-list">
                <button class="btn btn-primary btn-wave me-2" id="receiveStockBtn">
                    <i class="bx bx-plus align-middle"></i> Receive Stock
                </button>
            </div>
        </div>
        <!-- Page Header Close -->

        <!-- Phase 9: In-Stock Team -->
        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-box text-success me-2"></i> PHASE 9: IN-STOCK TEAM
                            <span class="badge bg-success ms-2">Process Complete</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="alert alert-success">
                            <i class="bx bx-check-circle me-2"></i>
                            <strong>Notification:</strong> Receive complete garments, verify quantity, enter into inventory, and generate stock code.
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Stock Summary Cards -->
        <div class="row">
            <div class="col-xl-3">
                <div class="card custom-card">
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <div class="me-3">
                                <span class="avatar avatar-lg bg-primary-transparent">
                                    <i class="bx bx-package fs-3 text-primary"></i>
                                </span>
                            </div>
                            <div>
                                <p class="mb-1 fs-12 text-muted">Total Products</p>
                                <h4 class="mb-0" id="totalProducts">0</h4>
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
                                <p class="mb-1 fs-12 text-muted">Total Pairs</p>
                                <h4 class="mb-0" id="totalPairs">0</h4>
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
                                    <i class="bx bx-time fs-3 text-warning"></i>
                                </span>
                            </div>
                            <div>
                                <p class="mb-1 fs-12 text-muted">Pending Receive</p>
                                <h4 class="mb-0" id="pendingReceive">0</h4>
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
                                    <i class="bx bx-check-shield fs-3 text-danger"></i>
                                </span>
                            </div>
                            <div>
                                <p class="mb-1 fs-12 text-muted">In Stock</p>
                                <h4 class="mb-0" id="inStockCount">0</h4>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Stock Table -->
        <div class="row mt-3">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-list-ul text-primary me-2"></i> Inventory List
                            <span class="badge bg-primary ms-2" id="stockCount">0</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table text-nowrap">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Stock Code</th>
                                        <th>Product Name</th>
                                        <th>Upper Qty</th>
                                        <th>Lower Qty</th>
                                        <th>Total Pairs</th>
                                        <th>Received Date</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="stockList">
                                    <!-- Data will be loaded here -->
                                </tbody>
                            </table>
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
                            <i class="bx bx-bell text-danger me-2"></i> NOTIFICATION - Client
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

        <!-- Process Complete Banner -->
        <div class="row mt-3">
            <div class="col-xl-12">
                <div class="card custom-card border-success">
                    <div class="card-body text-center py-4">
                        <i class="bx bx-check-circle fs-1 text-success mb-2"></i>
                        <h3 class="text-success">PROCESS COMPLETE!</h3>
                        <p class="text-muted">All garments have been received and entered into inventory.</p>
                    </div>
                </div>
            </div>
        </div>

    </div>
</div>

<!-- Receive Stock Modal -->
<div class="modal fade" id="stockModal" tabindex="-1" aria-labelledby="stockModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="stockModalLabel">Receive Stock</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="stockForm">
                    <input type="hidden" id="editId">
                    <input type="hidden" id="stockCode">
                    
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

                    <div class="alert alert-info">
                        <i class="bx bx-calculator me-2"></i>
                        <strong>Total Pairs:</strong> <span id="totalPairsDisplay">0</span>
                    </div>

                    <div class="alert alert-success">
                        <i class="bx bx-barcode me-2"></i>
                        <strong>Stock Code:</strong> <span id="generatedStockCode">-</span>
                        <br>
                        <small class="text-muted">Auto-generated unique stock code</small>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-success" id="saveStockBtn">Receive Stock</button>
            </div>
        </div>
    </div>
</div>

<!-- Verify & Enter Inventory Modal -->
<div class="modal fade" id="verifyModal" tabindex="-1" aria-labelledby="verifyModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="verifyModalLabel">Verify & Enter Inventory</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="alert alert-warning">
                    <i class="bx bx-shield me-2"></i>
                    <strong>Verify Quantity:</strong> Please confirm the quantity before entering into inventory.
                </div>
                <p><strong>Product:</strong> <span id="verifyProductName"></span></p>
                <p><strong>Stock Code:</strong> <span id="verifyStockCode"></span></p>
                <p><strong>Upper Qty:</strong> <span id="verifyUpper"></span></p>
                <p><strong>Lower Qty:</strong> <span id="verifyLower"></span></p>
                <p><strong>Total Pairs:</strong> <span id="verifyPairs"></span></p>
                <input type="hidden" id="verifyStockId">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-success" id="confirmVerifyBtn">Verify & Enter Inventory</button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/stock.js"></script>

