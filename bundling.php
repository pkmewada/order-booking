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
<link rel="stylesheet" href="assets/css/set-assignments.css?v=<?= filemtime(__DIR__ . '/assets/css/set-assignments.css') ?>">
<div class="main-content app-content">
    <div class="container-fluid finishing-table" data-finishing-page="bundling">
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between">
            <h1 class="page-title fw-medium fs-18 mb-0">Bundling</h1><button class="btn btn-dark me-2" id="bulkAssignBundlingBtn"><i class="bx bx-plus"></i> Bulk Assign Bundling</button><button class="btn btn-dark" id="refreshFinishingBtn" title="Refresh" aria-label="Refresh"><i class="bx bx-refresh" aria-hidden="true"></i></button>
        </div>
        <div class="card custom-card">
            <div class="card-header">
                <div class="card-title">Received Items &mdash; Ready for Bundling</div>
            </div>
            <div class="card-body table-responsive">
                <table class="table table-bordered text-nowrap">
                    <thead>
                        <tr>
                            <th>Batch ID</th>
                            <th>Packing Lot</th>
                            <th>Brand</th>
                            <th>Design / Pattern</th>
                            <th>MRP</th>
                            <th>Pieces</th>
                            <th>Quantity</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="bundlingReady"></tbody>
                </table>
            </div>
        </div>
        <div class="card custom-card">
            <div class="card-header">
                <div class="card-title">Bundling Assignments</div>
            </div>
            <div class="card-body table-responsive">
                <table class="table table-bordered text-nowrap">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Batch ID</th>
                            <th>Bundling Lot</th>
                            <th>Brand</th>
                            <th>Design / Pattern</th>
                            <th>MRP</th>
                            <th>Pieces</th>
                            <th>Worker</th>
                            <th>Quantity / Sets</th>
                            <th>Delivery Date</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="bundlingAssigned"></tbody>
                </table>
            </div>
        </div>
        <div class="modal fade" id="bundlingModal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Assign Bundling Worker</h5><button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <form id="bundlingForm">
                        <div class="modal-body">
                            <div id="bundlingSummary"></div>
                            <div class="row g-3 mb-3">
                                <div class="col-md-6"><label for="bundlingWorker" class="form-label">Worker</label><select id="bundlingWorker" class="form-select" required></select></div>
                                <div class="col-md-6"><label for="bundlingDate" class="form-label">Delivery Date</label><input id="bundlingDate" type="date" class="form-control" required></div>
                            </div>
                            <div id="bundlingSizes"></div>
                        </div>
                        <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-dark" id="assignBundlingBtn" type="submit">Assign</button></div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
<div class="modal fade" id="bundlingListModal" tabindex="-1" aria-labelledby="bundlingListTitle" aria-hidden="true">
    <div class="modal-dialog modal-fullscreen"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title" id="bundlingListTitle"><i class="bx bx-list-ul me-1"></i> All Passed Bundling Assignments</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
        <div class="modal-body"><div class="alert alert-success" id="bundlingListSummary"></div><div class="table-responsive">
            <table class="table table-bordered text-nowrap finishing-table"><thead><tr><th>#</th><th>Batch ID</th><th>Sub-Batch / Lot</th><th>Brand</th><th>Design / Pattern</th><th>MRP</th><th>Pieces</th><th>Worker</th><th>Qty</th><th>Progress</th><th>Remaining</th><th>Delivery</th><th>Status</th><th>Action</th></tr></thead><tbody id="bundlingPassedBody"></tbody></table>
        </div></div>
    </div></div>
</div>
<div class="modal fade" id="batchHistoryModal" tabindex="-1" aria-labelledby="batchHistoryModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" style="max-width:1000px"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title" id="batchHistoryModalLabel"><i class="bx bx-history me-1"></i> Batch History</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
        <div class="modal-body" id="batchHistoryBody"></div>
    </div></div>
</div>
<?php require_once __DIR__ . '/includes/footer.php'; ?>
<link rel="stylesheet" href="assets/css/assignment-details.css?v=<?= filemtime(__DIR__ . '/assets/css/assignment-details.css') ?>">
<script src="assets/js/batch-history-pdf.js?v=<?= filemtime(__DIR__ . '/assets/js/batch-history-pdf.js') ?>"></script>
<script src="assets/js/production-engine.js?v=<?= filemtime(__DIR__ . '/assets/js/production-engine.js') ?>"></script>
<script src="assets/js/set-assignments.js?v=<?= filemtime(__DIR__ . '/assets/js/set-assignments.js') ?>"></script>
<script src="assets/js/bundling-progress.js?v=<?= filemtime(__DIR__ . '/assets/js/bundling-progress.js') ?>"></script>
<script src="assets/js/finishing.js?v=<?= filemtime(__DIR__ . '/assets/js/finishing.js') ?>"></script>
