<?php require_once __DIR__ . '/../includes/header2.php'; ?>
<div class="main-content app-content">
    <div class="container-fluid">
        <div class="my-4 page-header-breadcrumb">
            <h1 class="page-title fw-medium fs-18">Pattern Settings</h1>
            <p class="text-muted">Create patterns from Piece Items. BOM Master will use these saved pieces in order.</p>
        </div>
        <div class="card custom-card">
            <div class="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div class="card-title">Available Patterns</div>
                <button type="button" class="btn btn-primary" id="addPatternBtn">
                    <i class="bx bx-plus align-middle me-1"></i> Add Pattern
                </button>
            </div>
            <div class="card-body">
                <div id="patternPageMessage" class="alert alert-danger d-none" role="alert"></div>
                <div class="table-responsive">
                    <table class="table table-bordered align-middle">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Pattern</th>
                                <th>Pieces</th>
                            </tr>
                        </thead>
                        <tbody id="patternTableBody">
                            <tr><td colspan="3" class="text-center text-muted">Loading patterns...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="patternModal" tabindex="-1" aria-labelledby="patternModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="patternModalLabel">Add Pattern</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <p class="text-muted mb-3">Select Piece Items in the order they should appear. The pattern name is generated from your selection and can be edited.</p>
                <div id="pieceItemChoices" class="row g-2"></div>
                <div class="mt-3">
                    <label class="form-label" for="patternName">Pattern Name</label>
                    <input type="text" class="form-control" id="patternName" maxlength="150" required>
                </div>
                <div id="patternSelectionSummary" class="mt-2 fw-medium">Select at least one Piece Item.</div>
                <div id="patternModalMessage" class="text-danger small mt-2" role="alert"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="savePatternBtn" disabled>
                    <i class="bx bx-save me-1"></i> Save Pattern
                </button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
<script src="assets/js/catalogApi.js?v=<?= filemtime(__DIR__ . '/../assets/js/catalogApi.js') ?>"></script>
<script src="assets/js/pattern.js?v=<?= filemtime(__DIR__ . '/../assets/js/pattern.js') ?>"></script>
