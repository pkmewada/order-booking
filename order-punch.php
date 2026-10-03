<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2" id="pageTitle">Order Punch</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Order Booking</a></li>
                            <li class="breadcrumb-item active" aria-current="page" id="breadcrumbActive">Order Punch</li>
                        </ol>
                    </nav>
                </div>
            </div>
        </div>
        <!-- Page Header Close -->

        <!-- Step 1: Scan Customer -->
        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">Select Customer</div>
                    </div>
                    <div class="card-body">
                        <label class="form-label">Customer Name / QR Code</label>
                        <div class="input-group">
                            <input type="text" class="form-control" id="customerScanInput" placeholder="Search customer name or shop name" autocomplete="off" aria-controls="customerSearchResults" aria-expanded="false">
                            <button class="btn btn-outline-primary" type="button" id="customerFindBtn">
                                <i class="bx bx-search me-1"></i> Find
                            </button>
                            <button class="btn btn-info text-white" type="button" id="customerCameraBtn">
                                <i class="bx bx-camera me-1"></i> Scan
                            </button>
                        </div>
                        <div id="customerSearchResults" class="list-group mt-2 d-none" style="max-height:260px;overflow-y:auto" aria-label="Matching customers"></div>
                        <div class="form-text">Search by customer name or shop name and select a customer. QR scanning is also available.</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Step 2: Organize (populated after customer scan) -->
        <div class="row d-none" id="organizeRow">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header d-flex align-items-center justify-content-between">
                        <div class="card-title mb-0">Organize</div>
                        <button type="button" class="btn btn-sm btn-outline-danger" id="clearCustomerBtn">
                            <i class="bx bx-x me-1"></i> Change Customer
                        </button>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Customer Name</label>
                                <input type="text" class="form-control" id="orgCustomerName" readonly>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Customer Contact</label>
                                <input type="text" class="form-control" id="orgCustomerContact" readonly>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Customer City</label>
                                <input type="text" class="form-control" id="orgCustomerCity" readonly>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Customer Shop Name</label>
                                <input type="text" class="form-control" id="orgCustomerShop" readonly>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Agent</label>
                                <input type="text" class="form-control" id="orgAgent" readonly>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Transport</label>
                                <input type="text" class="form-control" id="orgTransport" readonly>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Existing Customer</label>
                                <select class="form-select" id="orgExistingCustomer">
                                    <option value="Yes">Yes</option>
                                    <option value="No" selected>No</option>
                                </select>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Distributor Name</label>
                                <input type="text" class="form-control" id="orgDistributor" readonly>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Delivery Date</label>
                                <input type="date" class="form-control" id="orgDeliveryDate" required>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Step 3: Scan Products -->
        <div class="row d-none" id="productRow">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">Scan Products</div>
                    </div>
                    <div class="card-body">
                        <label class="form-label">Scan Products</label>
                        <div class="input-group">
                            <input type="text" class="form-control" id="productScanInput" placeholder="Search design number or scan product barcode" autocomplete="off" aria-controls="productSearchResults" aria-expanded="false">
                            <button class="btn btn-outline-primary" type="button" id="productFindBtn">
                                <i class="bx bx-search me-1"></i> Find
                            </button>
                            <button class="btn btn-info text-white" type="button" id="productCameraBtn">
                                <i class="bx bx-camera me-1"></i> Scan
                            </button>
                        </div>
                        <div id="productSearchResults" class="list-group mt-2 d-none" style="max-height:260px;overflow-y:auto" aria-label="Matching designs"></div>
                        <div class="form-text mb-3">Search by design number and select a product, or scan its QR code / enter its barcode.</div>

                        <div class="card border mb-3 d-none" id="productPreviewCard">
                            <div class="card-body py-2 px-3">
                                <h6 class="mb-1" id="previewItemCode"></h6>
                                <div class="text-muted fs-13">
                                    Barcode: <span id="previewBarcode"></span> |
                                    Size: <span id="previewSize"></span> |
                                    Brand: <span id="previewBrand"></span>
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th style="width:160px;">Qty (Sets)</th><th>Pieces / Set</th><th>Total Pieces</th>
                                        <th>Size</th>
                                        <th>Barcode</th>
                                        <th>Brand</th>
                                        <th class="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="orderItemsBody">
                                    <tr id="noItemsRow">
                                        <td colspan="8" class="text-center text-muted py-4">
                                            <i class="bx bx-package fs-2 d-block mb-2"></i>
                                            No products scanned yet
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr class="table-light fw-medium">
                                        <td>Total</td>
                                        <td id="totalSets">0 Set</td>
                                        <td colspan="2" id="totalPcs">0 Pcs</td>
                                        <td colspan="4"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Submit -->
        <div class="row d-none" id="submitRow">
            <div class="col-xl-12 mb-4">
                <div class="d-flex justify-content-end gap-2">
                    <a href="order-list" class="btn btn-secondary btn-wave d-none" id="backToListBtn">
                        Back to Order List
                    </a>
                    <button type="button" class="btn btn-primary btn-wave" id="submitOrderBtn">
                        <i class="bx bx-save me-1"></i> Submit Order
                    </button>
                </div>
            </div>
        </div>

    </div>
</div>

<!-- Camera Scanner Modal -->
<div class="modal fade" id="scannerModal" tabindex="-1" aria-labelledby="scannerModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="scannerModalLabel">Scan QR Code</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div id="scannerViewport" style="width:100%;"></div>
                <div class="text-muted fs-13 mt-2" id="scannerStatus">Requesting camera access...</div>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/order-quantities.js?v=<?= filemtime(__DIR__ . '/assets/js/order-quantities.js') ?>"></script>
<script src="assets/js/order-punch.js?v=<?= filemtime(__DIR__ . '/assets/js/order-punch.js') ?>"></script>
