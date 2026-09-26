<?php require_once __DIR__ . '/includes/header.php'; ?>

<style>
    #approvalModal .modal-dialog {
        max-width: 100%;
        width: 100%;
        height: 100%;
        margin: 0;
    }

    #approvalModal .modal-content {
        height: 100vh;
        border-radius: 0;
        border: none;
    }

    #approvalModal .modal-body {
        overflow-y: auto;
        padding: 16px 20px;
    }

    .batch-top-row {
        display: grid;
        grid-template-columns: 25% 25% 50%;
        gap: 12px;
        align-items: start;
        margin-bottom: 16px;
    }

    @media (max-width: 992px) {
        .batch-top-row {
            grid-template-columns: 1fr;
        }
    }

    .batch-photo-box {
        border: 1px solid #e2e7f1;
        border-radius: 8px;
        background: #f8f9fa;
        padding: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        aspect-ratio: 4 / 5;
        width: 100%;
    }

    .batch-photo-box img {
        width: 100%;
        height: 100%;
        display: block;
        border-radius: 6px;
        object-fit: cover;
    }

    .batch-info-box {
        border: 1px solid #e2e7f1;
        border-radius: 8px;
        padding: 12px 14px;
        height: 100%;
        overflow-y: auto;
    }

    .batch-info-box h6 {
        margin-bottom: 10px;
        color: #18243d;
        font-size: 15px;
        font-weight: 700;
    }

    .batch-info-box .table {
        margin-bottom: 0;
        background: #fff;
    }

    .batch-info-box .table th {
        font-size: 13px;
        width: 42%;
        vertical-align: middle;
        padding: 8px 10px;
        font-weight: 600;
        color: #18243d;
    }

    .batch-info-box .table td {
        font-size: 13px;
        vertical-align: middle;
        padding: 8px 10px;
        color: #333;
    }

    .batch-flow-box {
        border: 1px solid #e2e7f1;
        border-radius: 8px;
        background: #fff;
        padding: 12px 14px;
        height: 100%;
        overflow-y: auto;
    }

    .batch-flow-box h6 {
        margin-bottom: 10px;
        color: #18243d;
        font-size: 15px;
        font-weight: 700;
    }

    #batchFlowChart>div {
        margin-bottom: 10px !important;
    }

    #batchFlowChart>div:last-child {
        margin-bottom: 0 !important;
    }

    #batchFlowChart .badge {
        font-size: 11px !important;
        padding: 4px 9px !important;
    }

    #batchFlowChart .fw-semibold {
        font-size: 13px !important;
    }

    .batch-flow-track {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 5px;
        font-size: 13px;
        color: #18243d;
        line-height: 1.6;
    }

    .batch-flow-node {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 0;
        color: #18243d;
        font-size: 13px;
        font-weight: 500;
    }

    .batch-flow-node strong {
        font-size: 13px;
    }

    .batch-flow-node.batch-fixed-node {
        color: #161617;
        font-weight: 700;
    }

    .batch-flow-connector {
        display: inline-flex;
        align-items: center;
        color: #9aa6c2;
        font-size: 13px;
        font-weight: 600;
        margin: 0 3px;
    }

    .batch-flow-connector::before {
        content: "→";
    }

    .piece-cards-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
    }

    @media (max-width: 1200px) {
        .piece-cards-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }

    @media (max-width: 768px) {
        .piece-cards-grid {
            grid-template-columns: 1fr;
        }
    }

    .piece-card {
        border: 1px solid #e2e7f1;
        border-radius: 10px;
        background: #fff;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        transition: box-shadow .15s ease;
    }

    .piece-card:hover {
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.07);
    }

    .piece-card.locked {
        background: #f9fafb;
        opacity: 0.9;
    }

    .piece-card .piece-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        border-bottom: 1px dashed #eef1f7;
        padding-bottom: 8px;
    }

    .piece-card .piece-card-title {
        font-weight: 600;
        font-size: 14px;
        color: #18243d;
    }

    .piece-card .piece-card-item {
        font-size: 12px;
        color: #6b7280;
        margin-top: 2px;
    }

    /* ---------- Status badges (UNCHANGED — original style) ---------- */
    .status-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.3px;
        color: #fff !important;
    }

    .status-badge.pending {
        background: #fdd835;
        color: #161617 !important;
    }

    .status-badge.requirements_pending {
        background: #fd7e14;
    }

    .status-badge.in_progress {
        background: #1e88e5;
    }

    .status-badge.pass {
        background: #198754;
    }

    .status-badge.stopped {
        background: #0a0a0a;
        color: #fff !important;
    }

    .work-text {
        font-size: 12px;
        color: #333;
        line-height: 1.5;
    }

    .work-text .work-empty {
        color: #9ca3af;
        font-size: 11px;
    }

    .item-list-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
    }

    .item-list-top .item-list-label {
        font-size: 12px;
        color: #6b7280;
        font-weight: 600;
    }

    .all-toggle {
        display: inline-flex;
        border: 1px solid #e2e7f1;
        border-radius: 999px;
        overflow: hidden;
        background: #f9fafb;
    }

    .all-toggle input[type="radio"] {
        display: none;
    }

    .all-toggle label {
        font-size: 11px;
        padding: 3px 12px;
        cursor: pointer;
        color: #6b7280;
        user-select: none;
        transition: all .15s ease;
        margin: 0;
        line-height: 1.5;
    }

    .all-toggle label:hover {
        background: #f1f5fb;
    }

    .all-toggle input[type="radio"]:checked+label.all-yes-label {
        background: #198754;
        color: #fff;
    }

    .all-toggle input[type="radio"]:checked+label.all-no-label {
        background: #dc3545;
        color: #fff;
    }

    .item-list-rows {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px 10px;
        max-height: 220px;
        overflow-y: auto;
        padding-right: 2px;
    }

    @media (max-width: 1200px) {
        .item-list-rows {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }

    @media (max-width: 500px) {
        .item-list-rows {
            grid-template-columns: 1fr;
        }
    }

    .item-list-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #18243d;
        cursor: pointer;
        padding: 2px 0;
        user-select: none;
        transition: color .12s ease;
    }

    .item-list-row:hover {
        color: #000;
    }

    .item-list-row input[type="checkbox"] {
        width: 14px;
        height: 14px;
        margin: 0;
        cursor: pointer;
        accent-color: #161617;
        flex-shrink: 0;
    }

    .item-list-row .item-name {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .item-list-row.checked-row .item-name {
        color: #1b5e20;
        font-weight: 600;
    }

    .piece-card .piece-card-actions {
        display: flex;
        gap: 6px;
        margin-top: auto;
        padding-top: 8px;
        border-top: 1px dashed #eef1f7;
        flex-wrap: wrap;
    }

    .piece-card .piece-card-actions .btn {
        font-size: 11px;
        padding: 4px 8px;
        flex: 1 1 calc(33.33% - 4px);
        min-width: 70px;
    }

    .piece-card .piece-remarks {
        font-size: 11px;
        padding: 4px 6px;
        border-radius: 6px;
    }

    .approve-all-wrap {
        margin-top: 18px;
        display: flex;
        justify-content: flex-end;
    }

    .approve-all-btn {
        background-color: #198754 !important;
        border-color: #198754 !important;
        color: #fff !important;
        font-weight: 600;
        padding: 8px 22px;
    }

    .approve-all-btn:disabled {
        background-color: #cbd5e1 !important;
        border-color: #cbd5e1 !important;
        color: #64748b !important;
        cursor: not-allowed;
    }

    .approve-piece-btn,
.btn-approve-piece {
    background-color: #cbd5e1 !important;
    border-color: #cbd5e1 !important;
    color: #64748b !important;
    font-weight: 500;
    cursor: not-allowed;
    opacity: 1;
    box-shadow: none !important;
}

/* Keep same look on hover/focus (since disabled) */
.approve-piece-btn:hover,
.approve-piece-btn:focus,
.approve-piece-btn:active,
.btn-approve-piece:hover,
.btn-approve-piece:focus,
.btn-approve-piece:active {
    background-color: #cbd5e1 !important;
    border-color: #cbd5e1 !important;
    color: #64748b !important;
    box-shadow: none !important;
}

/* When enabled (not disabled) — green approve style */
.approve-piece-btn:not(:disabled),
.btn-approve-piece:not(:disabled) {
    background-color: #16a34a !important;
    border-color: #16a34a !important;
    color: #fff !important;
    cursor: pointer;
    box-shadow: none !important;
}

.approve-piece-btn:not(:disabled):hover,
.approve-piece-btn:not(:disabled):focus,
.btn-approve-piece:not(:disabled):hover,
.btn-approve-piece:not(:disabled):focus {
    background-color: #15803d !important;
    border-color: #15803d !important;
    color: #fff !important;
}

    .approve-all-btn:not(:disabled):hover {
        background-color: #157347 !important;
        border-color: #157347 !important;
    }

    #approvalTableBody td,
    #approvalTableBody th {
        vertical-align: middle !important;
        padding: 8px 12px;
    }

    .piece-cell-lines {
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .piece-line {
        font-size: 13px;
        color: #18243d;
        line-height: 1.6;
        white-space: nowrap;
        padding: 6px 0;
        border-bottom: 1px dashed #eef1f7;
    }

    .piece-line:first-child {
        padding-top: 0;
    }

    .piece-line:last-child {
        padding-bottom: 0;
        border-bottom: none;
    }

    .piece-line .piece-num {
        font-weight: 700;
        color: #161617;
    }

    .piece-line .piece-item-text {
        font-weight: 400;
        color: #333;
    }

    .status-cell-lines {
        display: flex;
        flex-direction: column;
        gap: 0;
        align-items: flex-start;
    }

    .status-line {
        line-height: 1.6;
        padding: 6px 0;
        border-bottom: 1px dashed #eef1f7;
        display: flex;
        align-items: center;
        min-height: 24px;
    }

    .status-line:first-child {
        padding-top: 0;
    }

    .status-line:last-child {
        padding-bottom: 0;
        border-bottom: none;
    }

    /* ---------- Color TEXT (plain, no badge — only colour column changed) ---------- */
    .color-text {
        font-size: 13px;
        font-weight: 600;
        color: #18243d;
    }

    /* ---------- Priority badge (UNCHANGED — same as batch.php) ---------- */
    .priority-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.3px;
        color: #fff !important;
    }

    .priority-badge.priority-high {
        background: #dc3545;
    }

    .priority-badge.priority-medium {
        background: #1e88e5;
    }

    .priority-badge.priority-low {
        background: #fdd835;
        color: #161617 !important;
    }

    /* ---------- Action cell: one row, small ---------- */
    .action-cell {
        white-space: nowrap;
    }

    .action-row {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .btn-view-sm {
        background: #161617 !important;
        border: 1px solid #161617 !important;
        color: #fff !important;
        font-size: 11px !important;
        font-weight: 600;
        padding: 3px 12px !important;
        line-height: 1.5 !important;
        border-radius: 6px !important;
    }

    .btn-view-sm:hover {
        background: #2b2b2b !important;
        border-color: #2b2b2b !important;
        color: #fff !important;
    }

    .btn-stop-icon {
        background: #dc3545 !important;
        border: 1px solid #dc3545 !important;
        color: #fff !important;
        font-size: 14px !important;
        width: 28px;
        height: 28px;
        padding: 0 !important;
        line-height: 26px !important;
        border-radius: 6px !important;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .btn-stop-icon:hover {
        background: #b02a37 !important;
        border-color: #b02a37 !important;
        color: #fff !important;
    }

    .btn-resume-icon {
        background: #1e88e5 !important;
        border: 1px solid #1e88e5 !important;
        color: #fff !important;
        font-size: 14px !important;
        width: 28px;
        height: 28px;
        padding: 0 !important;
        line-height: 26px !important;
        border-radius: 6px !important;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .btn-resume-icon:hover {
        background: #1565c0 !important;
        border-color: #1565c0 !important;
        color: #fff !important;
    }

    tr.frozen-row {
        background: #f8f9fa !important;
        opacity: 0.9;
    }
</style>

<div class="main-content app-content">
    <div class="container-fluid">

        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Batch Approval</h1>
                <nav>
                    <ol class="breadcrumb mb-0">
                        <li class="breadcrumb-item"><a href="javascript:void(0);">Production</a></li>
                        <li class="breadcrumb-item active">Batch Approval</li>
                    </ol>
                </nav>
            </div>
            <button type="button" class="btn btn-primary" id="refreshApprovalBtn">
                <i class="bx bx-refresh me-1"></i>
            </button>
        </div>

        <div class="card custom-card">
            <div class="card-header">
                <div class="card-title">Batch Approval List</div>
            </div>
            <div class="card-body">
                <div class="row mb-3">
                    <div class="col-md-3">
                        <label class="form-label" for="approvalStatusFilter">Status</label>
                        <select id="approvalStatusFilter" class="form-select">
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="pass">Pass</option>
                            <option value="stopped">Stopped</option>
                        </select>
                    </div>
                    <div class="col-md-4 ms-auto">
                        <label class="form-label" for="approvalSearchInput">Search</label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bx bx-search"></i></span>
                            <input type="text" id="approvalSearchInput" class="form-control" placeholder="Search batch, design, brand...">
                        </div>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-bordered text-nowrap w-100">
                        <thead>
                            <tr>
                                <th>Batch ID</th>
                                <th>Photo</th>
                                <th>Brand</th>
                                <th>Design Number</th>
                                <th>Color</th>
                                <th>Piece Type</th>
                                <th>Quantity</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="approvalTableBody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="approvalModal" tabindex="-1" aria-labelledby="approvalModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="approvalModalLabel">Batch Approval</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="batch-top-row">
                    <div class="batch-photo-box">
                        <img id="approvalPhoto" src="" alt="Batch Photo" onerror="this.onerror=null;this.style.display='none';">
                    </div>
                    <div class="batch-info-box">
                        <h6>Batch Information</h6>
                        <div class="table-responsive">
                            <table class="table table-bordered mb-0">
                                <tbody>
                                    <tr>
                                        <th>Batch ID</th>
                                        <td id="approvalBatchId">-</td>
                                    </tr>
                                    <tr>
                                        <th>Brand</th>
                                        <td id="approvalBrand">-</td>
                                    </tr>
                                    <tr>
                                        <th>Design Number</th>
                                        <td id="approvalDesignNumber">-</td>
                                    </tr>
                                    <tr>
                                        <th>Color</th>
                                        <td id="approvalColor">-</td>
                                    </tr>
                                    <tr>
                                        <th>Quantity</th>
                                        <td id="approvalQuantity">-</td>
                                    </tr>
                                    <tr>
                                        <th>Priority</th>
                                        <td id="approvalPriority">-</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="batch-flow-box" id="batchFlowBox" style="display:none;">
                        <h6>Production Flow Chart</h6>
                        <div id="batchFlowChart"></div>
                    </div>
                </div>

                <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                    <h6 class="mb-0">Piece-wise Item Availability</h6>
                    <small class="text-muted" style="font-size:11px;">
                        <b>Approve</b> = all items present → Pass to Cutting |
                        <b>Confirm</b> = partial → Requirement (Pending) |
                        <b>Pass</b> = partial → Cutting + Requirement (In Progress)
                    </small>
                </div>

                <div id="approvalPiecesContainer" class="piece-cards-grid"></div>

                <div class="approve-all-wrap">
                    <button type="button" class="btn approve-all-btn" id="approveAllBtn" disabled>
                        <i class="bx bx-check-double me-1"></i> Approve All Pieces
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/production-engine.js"></script>
<script src="assets/js/batch-approval.js"></script>
</body>

</html>