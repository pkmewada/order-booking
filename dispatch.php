<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Dispatch</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Order Booking</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Dispatch</li>
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
                            Dispatch Orders
                        </div>
                    </div>

                    <div class="card-body">
                        <div class="row mb-3">
                            <div class="col-md-3">
                                <label class="form-label">Status</label>
                                <select id="statusFilter" class="form-select">
                                    <option value="all">All</option>
                                    <option value="Pending">Pending</option>
                                    <option value="In Progress">In Progress</option><option value="Completed">Completed</option>
                                </select>
                            </div>
                            <div class="col-md-4 ms-auto">
                                <label class="form-label">Search</label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="bx bx-search"></i></span>
                                    <input type="text" id="searchInput" class="form-control" placeholder="Search by order id, customer or shop">
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table id="orderTable" class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Order ID</th>
                                        <th>Customer</th>
                                        <th>Shop Name</th>
                                        <th>Delivery Date</th>
                                        <th>Ordered</th><th>Scanned</th><th>Passed</th><th>Remaining</th><th>Ready to Pass</th>
                                        <th>Status</th>
                                        <th class="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="orderTableBody">
                                    <!-- Data will be loaded here -->
                                </tbody>
                            </table>
                        </div>

                        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3">
                            <div class="text-muted fs-13" id="paginationInfo"></div>
                            <nav>
                                <ul class="pagination pagination-sm mb-0" id="paginationControls"></ul>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="dispatchModal" tabindex="-1" aria-labelledby="dispatchModalTitle" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title" id="dispatchModalTitle">Dispatch Order</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
        <div class="modal-body">
            <div id="dispatchCustomer" class="mb-3"></div><div id="dispatchSummary" class="alert alert-light fw-semibold"></div>
            <form id="dispatchScanForm" class="mb-3">
                <label for="dispatchScanInput" class="form-label">Scan product barcode</label>
                <div class="input-group"><input id="dispatchScanInput" class="form-control" autocomplete="off" placeholder="Scan or enter barcode"><button class="btn btn-primary" type="submit">Scan 1 Piece</button><button id="dispatchCameraBtn" class="btn btn-outline-primary" type="button">Camera Scan</button></div>
            </form>
            <div id="dispatchReader" style="max-width:400px" class="mb-3"></div>
            <div id="dispatchScanMessage" class="mb-3" role="status" aria-live="polite"></div>
            <div class="table-responsive"><table class="table table-bordered"><thead><tr><th>Status</th><th>Barcode</th><th>Item Description</th><th>Brand</th><th>Size</th><th>Pieces / Set</th><th>Ordered</th><th>Scanned</th><th>Passed</th><th>Remaining</th><th>Ready to Pass</th><th>Action</th></tr></thead><tbody id="dispatchItems"></tbody></table></div>
            <div id="dispatchProgress" class="fw-semibold" role="status" aria-live="polite"></div>
        </div>
        <div class="modal-footer"><span class="text-muted me-auto">Each scan counts 1 piece and saves automatically.</span><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="button" id="dispatchConfirmBtn" class="btn btn-success">Pass Sets</button></div>
    </div></div>
</div>
<div class="modal fade" id="partialDeliveryModal" tabindex="-1" aria-labelledby="partialDeliveryTitle" aria-hidden="true" style="z-index:1065">
    <div class="modal-dialog modal-xl modal-dialog-centered"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title" id="partialDeliveryTitle">Pass Sets to Delivery</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
        <div class="modal-body">
            <p>Choose complete sets to pass to Delivery. Extra scanned pieces stay in Dispatch until a full set is ready.</p>
            <div class="table-responsive"><table class="table table-bordered"><thead><tr><th>Item</th><th>Brand / Size</th><th>1 Set</th><th>Ordered</th><th>Already Passed</th><th>Available</th><th>Pass Sets</th></tr></thead><tbody id="partialDeliveryItems"></tbody></table></div>
            <div id="partialDeliverySummary" class="fw-semibold mb-2"></div><div id="partialDeliveryMessage" class="text-danger" role="status"></div>
        </div>
        <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="button" id="partialDeliveryConfirmBtn" class="btn btn-success">Confirm Pass</button></div>
    </div></div>
</div>
<div class="modal fade" id="replaceDesignModal" tabindex="-1" aria-labelledby="replaceDesignTitle" aria-hidden="true" style="z-index:1065">
<div class="modal-dialog modal-lg modal-dialog-centered"><div class="modal-content">
<div class="modal-header"><h5 class="modal-title" id="replaceDesignTitle">Replace Design</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
<div class="modal-body"><label for="replacementDesign" class="form-label">Design Number</label><input id="replacementDesign" class="form-control" autocomplete="off" placeholder="Enter design number"><div id="replacementResults" class="list-group mt-2"></div><div id="replacementPreview" class="alert alert-light mt-3 d-none"></div><div id="replacementMessage" class="text-danger" role="status"></div></div>
<div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="button" id="replaceDesignSave" class="btn btn-dark" disabled>Replace</button></div>
</div></div></div>
<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/order-quantities.js?v=<?= filemtime(__DIR__ . '/assets/js/order-quantities.js') ?>"></script>
<script src="assets/js/dispatch-flow.js?v=<?= filemtime(__DIR__ . '/assets/js/dispatch-flow.js') ?>"></script>
<script src="assets/js/dispatch.js?v=<?= filemtime(__DIR__ . '/assets/js/dispatch.js') ?>"></script>

