<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Delivery</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Order Booking</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Delivery</li>
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
                            Deliveries
                        </div>
                    </div>

                    <div class="card-body">
                        <div class="row mb-3">

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
<tr><th>Delivery ID</th><th>Order ID</th><th>Customer / Shop</th><th>Passed At</th><th>Sets</th><th>Status</th><th>Action</th></tr>
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

<?php require_once __DIR__ . '/includes/footer.php'; ?>
<script src="assets/js/order-quantities.js?v=<?= filemtime(__DIR__ . '/assets/js/order-quantities.js') ?>"></script>
<script src="assets/js/dispatch-flow.js?v=<?= filemtime(__DIR__ . '/assets/js/dispatch-flow.js') ?>"></script>
<script src="assets/libs/html2pdf/html2pdf.bundle.min.js"></script>
<script src="assets/js/order-pdf.js?v=<?= filemtime(__DIR__ . '/assets/js/order-pdf.js') ?>"></script>
<script src="assets/js/order-details.js?v=<?= filemtime(__DIR__ . '/assets/js/order-details.js') ?>"></script>
<script src="assets/js/delivery-records.js?v=<?= filemtime(__DIR__ . '/assets/js/delivery-records.js') ?>"></script>
<script src="assets/js/delivery.js?v=<?= filemtime(__DIR__ . '/assets/js/delivery.js') ?>"></script>
