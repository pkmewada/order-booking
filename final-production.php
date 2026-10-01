<?php require_once __DIR__ . '/includes/header.php'; ?>
<style>
    .finishing-table td,
    .finishing-table th {
        vertical-align: middle
    }

    .batch-document summary {
        cursor: pointer;
        font-weight: 600;
        padding: 14px;
        background: #f8f9fa
    }

    .batch-document {
        border: 1px solid #e2e7f1;
        border-radius: 6px;
        margin-top: 16px
    }

    .batch-document .document-content {
        padding: 16px
    }

    .finishing-photo {
        width: 65px;
        height: 80px;
        object-fit: contain
    }
</style>
<div class="main-content app-content">
    <div class="container-fluid finishing-table" data-finishing-page="inventory">
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between">
            <h1 class="page-title fw-medium fs-18 mb-0">Inventory</h1><button class="btn btn-dark" id="refreshFinishingBtn" title="Refresh" aria-label="Refresh"><i class="bx bx-refresh" aria-hidden="true"></i></button>
        </div>
        <div class="card custom-card">
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-3"><label for="inventoryBatch" class="form-label">Batch ID</label><input id="inventoryBatch" class="form-control" placeholder="Filter batch ID"></div>
                    <div class="col-md-3"><label for="inventoryDesign" class="form-label">Design Number</label><input id="inventoryDesign" class="form-control" placeholder="Filter design number"></div>
                    <div class="col-md-3"><label for="inventoryFrom" class="form-label">Received From</label><input id="inventoryFrom" type="date" class="form-control"></div>
                    <div class="col-md-3"><label for="inventoryTo" class="form-label">Received To</label><input id="inventoryTo" type="date" class="form-control"></div>
                </div>
            </div>
        </div>
        <div id="inventorySummary" class="mb-3"></div>
        <div id="inventoryList"></div>
    </div>
</div>
<?php require_once __DIR__ . '/includes/footer.php'; ?>
<script src="assets/js/production-engine.js?v=<?= filemtime(__DIR__ . '/assets/js/production-engine.js') ?>"></script>
<script src="assets/js/finishing.js?v=<?= filemtime(__DIR__ . '/assets/js/finishing.js') ?>"></script>