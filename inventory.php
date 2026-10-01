<?php require_once __DIR__ . '/includes/header.php'; ?>
<style>
    .stock-table th,
    .stock-table td {
        vertical-align: middle;
        text-align: center
    }

    .stock-table .ready-heading {
        background: #b9e6a5;
        color: #172c16
    }

    .stock-table .progress-heading {
        background: #ffd59a;
        color: #46231c
    }

    .stock-table thead th {
        padding: 14px 12px
    }

    .stock-table tbody td {
        padding: 12px
    }
</style>
<div class="main-content app-content">
    <div class="container-fluid">
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between">
            <h1 class="page-title fw-medium fs-18 mb-0">Inventory</h1><button class="btn btn-dark" id="refreshStock" title="Refresh" aria-label="Refresh"><i class="bx bx-refresh" aria-hidden="true"></i></button>
        </div>
        <div class="card custom-card">
            <div class="card-body">
                <label for="stockDesign" class="form-label">Brand / Design Number</label><input id="stockDesign" class="form-control mb-3" placeholder="Search brand or design">
                <p class="text-muted small">One row per design. Production shows total / inventory received quantity. A garment with multiple pieces counts as one quantity. Sets follow the brand's size assortment.</p>
                <div class="table-responsive">
                    <table class="table table-bordered text-nowrap stock-table">
                        <thead>
                            <tr>
                                <th colspan="6" class="ready-heading">Ready Stock</th>
                                <th colspan="3" class="progress-heading">Progress Stock</th>
                            </tr>
                            <tr>
                                <th>Brand</th>
                                <th>Design</th>
                                <th>Pattern</th>
                                <th>MRP</th>
                                <th>Qty</th>
                                <th>Set</th>
                                <th>Production</th>
                                <th>Damage</th>
                                <th>Detail</th>
                            </tr>
                        </thead>
                        <tbody id="stockRows"></tbody>
                    </table>
                </div>
                <div id="stockError" class="text-danger" role="alert"></div>
            </div>
        </div>
    </div>
</div>
<div class="modal fade" id="stockFlowModal" tabindex="-1" aria-labelledby="stockFlowTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="stockFlowTitle">Production Flow</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="stockFlowBody"></div>
        </div>
    </div>
</div>
<?php require_once __DIR__ . '/includes/footer.php'; ?>
<script src="assets/js/production-engine.js?v=<?= filemtime(__DIR__ . '/assets/js/production-engine.js') ?>"></script>
<script src="assets/js/inventory-stock.js?v=<?= filemtime(__DIR__ . '/assets/js/inventory-stock.js') ?>"></script>
<link rel="stylesheet" href="assets/css/inventory-flow.css?v=<?= filemtime(__DIR__ . '/assets/css/inventory-flow.css') ?>">
<script src="assets/js/inventory-flow.js?v=<?= filemtime(__DIR__ . '/assets/js/inventory-flow.js') ?>"></script>