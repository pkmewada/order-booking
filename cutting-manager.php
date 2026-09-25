<?php require_once __DIR__ . '/includes/header.php'; ?>

<style>
    #refreshCuttingBtn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
    }
    #refreshCuttingBtn:hover { background-color: #2b2b2d !important; border-color: #2b2b2d !important; }

    #bulkAssignBtn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
    }
    #bulkAssignBtn:hover { background-color: #2b2b2d !important; border-color: #2b2b2d !important; }

    #listAllBtn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
    }
    #listAllBtn:hover { background-color: #2b2b2d !important; border-color: #2b2b2d !important; }

    #approvedItemsList td, #approvedItemsList th { vertical-align: middle !important; }
    #approvedItemsList .piece-line {
        font-size: 13px; color: #18243d; line-height: 1.8; white-space: nowrap;
    }
    #approvedItemsList .piece-line .piece-num { font-weight: 700; }

    .progress-bar-container {
        width: 80px; height: 6px; background-color: #e9ecef;
        border-radius: 3px; overflow: hidden; display: inline-block; vertical-align: middle;
    }
    .progress-bar-fill {
        height: 100%; background-color: #28a745; transition: width 0.5s ease;
    }
    #cuttingMastersList td { vertical-align: middle !important; }

    .delivery-date-badge { font-size: 12px; padding: 4px 8px; border-radius: 4px; white-space: nowrap; display: inline-block; }
    .delivery-ontrack { background-color: #d4edda; color: #155724; }
    .delivery-due-today { background-color: #fff3cd; color: #856404; }
    .delivery-overdue { background-color: #f8d7da; color: #721c24; }
    .delivery-badge-secondary { background-color: #e9ecef; color: #6c757d; }

    .damage-badge {
        display: inline-block;
        background: #fce4e4;
        color: #b91c1c;
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
    }
    .damage-empty { color: #9ca3af; font-size: 12px; }

    .pagination-wrap {
        display: flex; justify-content: space-between; align-items: center;
        margin-top: 12px; flex-wrap: wrap; gap: 8px;
    }
    .pagination-wrap .info-text { font-size: 13px; color: #6c757d; }
    .pagination-wrap .pager { display: flex; gap: 4px; }
    .pagination-wrap .pager .page-btn {
        min-width: 34px; height: 34px; padding: 0 10px;
        border: 1px solid #dfe5f1; background: #fff; color: #18243d;
        border-radius: 6px; font-size: 13px; font-weight: 500;
        cursor: pointer; transition: all .15s ease;
        display: inline-flex; align-items: center; justify-content: center;
    }
    .pagination-wrap .pager .page-btn:hover:not(:disabled):not(.active) { background: #f4f5f9; border-color: #c9d2e3; }
    .pagination-wrap .pager .page-btn.active { background: #161617; color: #fff; border-color: #161617; }
    .pagination-wrap .pager .page-btn:disabled { opacity: .5; cursor: not-allowed; }

    .assignment-row td { vertical-align: middle; padding: 6px 8px; }
    #rowsContainer .table th {
        background: #f8f9fa; font-weight: 600; font-size: 12px;
        text-transform: uppercase; letter-spacing: 0.5px;
        padding: 8px 10px; border-bottom: 2px solid #dee2e6;
    }
    #rowsContainer .table td { padding: 6px 8px; vertical-align: middle; }

    .color-text {
        font-size: 13px;
        font-weight: 600;
        color: #18243d;
    }

    .priority-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.3px;
        color: #fff !important;
    }
    .priority-badge.priority-high   { background: #dc3545; }
    .priority-badge.priority-medium { background: #1e88e5; }
    .priority-badge.priority-low    { background: #fdd835; color: #161617 !important; }

    .status-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.3px;
        color: #fff !important;
    }
    .status-badge.pending     { background: #fdd835; color: #161617 !important; }
    .status-badge.in_progress { background: #1e88e5; }
    .status-badge.passed      { background: #198754; }
    .status-badge.stopped     { background: #dc3545; color: #fff !important; }
    .status-badge.not_assigned   { background: #dc3545; color: #fff !important; }
    .status-badge.assign_progress { background: #198754; color: #fff !important; }

    .pass-row-btn {
        background-color: #198754 !important;
        border-color: #198754 !important;
        color: #fff !important;
    }
    .pass-row-btn:hover:not(:disabled) {
        background-color: #157347 !important;
        border-color: #157347 !important;
    }
    .pass-row-btn:disabled { opacity: .5; cursor: not-allowed; }

    .stop-row-btn {
        background-color: #dc3545 !important;
        border-color: #dc3545 !important;
        color: #fff !important;
    }
    .stop-row-btn:hover:not(:disabled) {
        background-color: #b02a37 !important;
        border-color: #b02a37 !important;
    }
    .stop-row-btn:disabled { opacity: .5; cursor: not-allowed; }

    .view-row-btn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
    }
    .view-row-btn:hover {
        background-color: #2b2b2d !important;
        border-color: #2b2b2d !important;
    }

    .resume-row-btn {
        background-color: #1e88e5 !important;
        border-color: #1e88e5 !important;
        color: #fff !important;
    }
    .resume-row-btn:hover {
        background-color: #1565c0 !important;
        border-color: #1565c0 !important;
    }

    .list-row-btn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
        font-size: 11px !important;
        padding: 3px 10px !important;
    }
    .list-row-btn:hover {
        background-color: #2b2b2d !important;
        border-color: #2b2b2d !important;
        color: #fff !important;
    }

    .qty-pair {
        font-size: 13px; font-weight: 600; color: #18243d;
        white-space: nowrap;
    }
    .qty-pair .qty-total { color: #6b7280; font-weight: 500; }
    .qty-pair .qty-sep { color: #9ca3af; margin: 0 2px; }
    .qty-pair .qty-assigned { color: #15803d; font-weight: 700; }
    .qty-pair .qty-assigned.zero { color: #9ca3af; font-weight: 500; }

    /* ---------- BULK MODAL ---------- */
    #bulkAssignModal .modal-dialog { max-width: 100%; width: 100%; height: 100%; margin: 0; }
    #bulkAssignModal .modal-content { height: 100vh; border-radius: 0; border: none; }
    #bulkAssignModal .modal-body { overflow-y: auto; padding: 12px 20px; }

    .bulk-toolbar {
        position: sticky; top: 0; z-index: 10;
        background: #fff; border-bottom: 1px solid #e2e7f1;
        padding: 8px 0; margin-bottom: 10px;
        display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
    }
    .bulk-toolbar label { font-size: 12px; }

    .bulk-item-card {
        border: 1px solid #e2e7f1; border-radius: 10px; background: #fff;
        padding: 10px; margin-bottom: 12px;
    }
    .bulk-item-header {
        display: flex; align-items: center; gap: 10px;
        border-bottom: 1px dashed #eef1f7; padding-bottom: 8px; margin-bottom: 8px;
        flex-wrap: wrap;
    }
    .bulk-item-title { font-weight: 600; font-size: 13px; color: #18243d; }
    .bulk-item-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }

    .bulk-qty-summary {
        display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap;
    }
    .bulk-qty-pill {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 2px 8px; border-radius: 999px;
        font-size: 10px; font-weight: 600;
    }
    .bulk-qty-pill.total { background: #eef2ff; color: #3730a3; }
    .bulk-qty-pill.assigned { background: #d1fae5; color: #065f46; }
    .bulk-qty-pill.remaining { background: #fef3c7; color: #92400e; }
    .bulk-qty-pill.helper { background: #f1f5f9; color: #475569; font-weight: 500; }

    .split-row-table {
        width: 100%;
        font-size: 12px;
        margin-bottom: 0;
        table-layout: fixed;
        border-collapse: collapse;
    }
    .split-row-table th {
        background: #f8f9fa; font-weight: 600; font-size: 10px;
        text-transform: uppercase; letter-spacing: 0.4px;
        padding: 8px 8px; border-bottom: 1px solid #e9edf5;
        color: #4b5563;
        vertical-align: middle;
    }
    .split-row-table td {
        padding: 6px 8px; vertical-align: middle;
        border-bottom: 1px solid #f1f3f9;
        overflow: hidden;
    }
    .split-row-table tr:last-child td { border-bottom: none; }
    .split-row-table input, .split-row-table select {
        font-size: 12px; padding: 4px 8px; height: auto;
        max-width: 100%;
    }

    .split-row-table col.col-sub { width: 13%; }
    .split-row-table col.col-piece { width: 11%; }
    .split-row-table col.col-worker { width: 24%; }
    .split-row-table col.col-qty { width: 10%; }
    .split-row-table col.col-priority { width: 13%; }
    .split-row-table col.col-date { width: 24%; }
    .split-row-table col.col-copy { width: 5%; }

    .split-row-table th.copy-header-cell {
        text-align: center;
        padding: 8px 4px;
        font-size: 10px;
        color: #4b5563;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        vertical-align: middle;
        background: #f8f9fa;
    }

    .split-row-table td.copy-col-cell {
        width: 5%;
        text-align: center;
        vertical-align: top;
        padding: 6px 4px;
        background: #fff;
        border-left: 1px solid #f1f3f9;
    }
    .copy-body-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        gap: 4px;
        padding-top: 2px;
    }

    .copy-row-side-btn {
        background-color: #198754 !important;
        border: 1px solid #198754 !important;
        color: #fff !important;
        font-size: 11px !important;
        padding: 0 !important;
        font-weight: 700;
        border-radius: 5px;
        white-space: nowrap;
        line-height: 1;
        box-shadow: 0 1px 3px rgba(25,135,84,0.25);
        transition: background-color .12s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 26px;
    }
    .copy-row-side-btn i { font-size: 14px; }
    .copy-row-side-btn:disabled {
        background-color: #f3f4f6 !important;
        border-color: #e5e7eb !important;
        color: #9ca3af !important;
        cursor: not-allowed;
        box-shadow: none;
    }
    .copy-row-side-btn:not(:disabled):hover {
        background-color: #157347 !important;
        border-color: #157347 !important;
    }

    .multi-select-wrap { position: relative; flex: 1 1 420px; max-width: 640px; }
    .multi-select-box {
        min-height: 38px; padding: 5px 10px;
        border: 1px solid #dfe5f1; border-radius: 8px; background: #fff;
        display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
        cursor: pointer; transition: all .15s ease;
    }
    .multi-select-box:hover { border-color: #c9d2e3; }
    .multi-select-box.open { border-color: #161617; box-shadow: 0 0 0 3px rgba(22,22,23,0.08); }
    .multi-select-box .placeholder { color: #9aa6c2; font-size: 13px; }
    .multi-select-chip {
        display: inline-flex; align-items: center; gap: 4px;
        background: #eef2ff; color: #3730a3; padding: 2px 8px;
        border-radius: 4px; font-size: 12px; font-weight: 500;
    }
    .multi-select-chip .chip-x { cursor: pointer; font-weight: 700; margin-left: 2px; opacity: .6; }
    .multi-select-chip .chip-x:hover { opacity: 1; }
    .multi-select-box .caret { margin-left: auto; color: #6b7280; transition: transform .2s ease; }
    .multi-select-box.open .caret { transform: rotate(180deg); }

    .multi-select-dropdown {
        position: absolute; top: 100%; left: 0; right: 0;
        margin-top: 4px; max-height: 340px; overflow-y: auto;
        background: #fff; border: 1px solid #dfe5f1; border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        z-index: 1000; display: none;
    }
    .multi-select-dropdown.open { display: block; }
    .multi-select-dropdown .search-row {
        padding: 8px 10px; border-bottom: 1px solid #eef1f7;
        position: sticky; top: 0; background: #fff; z-index: 2;
    }
    .multi-select-dropdown .search-row input { font-size: 13px; padding: 6px 10px; }
    .multi-select-option {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; cursor: pointer; font-size: 13px;
        border-bottom: 1px solid #f1f3f9;
        transition: background .12s ease;
    }
    .multi-select-option:last-child { border-bottom: none; }
    .multi-select-option:hover { background: #f4f5f9; }
    .multi-select-option.selected { background: #f0f7ff; }
    .multi-select-option input[type="checkbox"] {
        width: 16px; height: 16px; margin: 0;
        accent-color: #161617; cursor: pointer; flex-shrink: 0;
    }
    .multi-select-option .opt-title { font-weight: 500; color: #18243d; }
    .multi-select-option .opt-sub { font-size: 11px; color: #6b7280; margin-top: 1px; }
    .multi-select-dropdown .empty-msg { padding: 14px; text-align: center; color: #9aa6c2; font-size: 13px; }

    .bulk-apply-split-btn {
        font-size: 11px !important;
        padding: 3px 8px !important;
    }
    .bulk-global-split { font-size: 12px !important; }

    /* ---------- View Detail Modal ---------- */
    #viewDetailModal .modal-dialog { max-width: 900px; }
    #viewDetailModal .modal-body { padding: 24px 28px; }
    .detail-print-wrap { background: #fff; }

    .detail-header-line { text-align: center; margin-bottom: 4px; }
    .detail-header-line h4 {
        margin: 0;
        font-weight: 700;
        color: #161617;
        letter-spacing: 1px;
        font-size: 22px;
    }
    .detail-header-line small {
        display: block;
        color: #9ca3af;
        font-size: 11px;
        margin-top: 4px;
    }
    .detail-divider {
        border-top: 1px solid #e2e7f1;
        margin: 14px 0 18px;
    }

    .detail-split-layout {
        display: grid;
        grid-template-columns: 1fr 240px;
        gap: 24px;
        align-items: start;
        margin-bottom: 20px;
    }

    .detail-highlight-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        margin-bottom: 14px;
    }
    .detail-highlight-item {
        padding: 8px 14px;
        background: #f8f9fa;
        border-left: 3px solid #161617;
        border-radius: 4px;
    }
    .detail-highlight-item .lbl {
        font-size: 10px;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 700;
        margin-bottom: 2px;
        display: block;
    }
    .detail-highlight-item .val {
        font-size: 14px;
        color: #161617;
        font-weight: 700;
        word-break: break-word;
        line-height: 1.3;
    }

    .detail-info-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0;
        border: 1px solid #e2e7f1;
        border-radius: 6px;
        overflow: hidden;
        background: #fff;
    }
    .detail-info-cell {
        padding: 8px 12px;
        border-right: 1px solid #e2e7f1;
        border-bottom: 1px solid #e2e7f1;
        background: #fff;
    }
    .detail-info-cell:nth-child(3n) { border-right: none; }
    .detail-info-cell:nth-child(n+4) { border-bottom: none; }
    .detail-info-cell .lbl {
        font-size: 10px;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        font-weight: 700;
        margin-bottom: 2px;
        display: block;
    }
    .detail-info-cell .val {
        font-size: 12px;
        color: #18243d;
        font-weight: 600;
        word-break: break-word;
        line-height: 1.3;
    }

    .detail-photo-box {
        width: 100%;
        height: 360px;
        aspect-ratio: 3 / 4;
        border: 1px solid #dfe5f1;
        border-radius: 8px;
        background: #f8f9fa;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }
    .detail-photo-box img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .detail-signature {
        margin-top: 40px;
        text-align: right;
        padding-top: 10px;
    }
    .detail-signature .sig-line {
        display: inline-block;
        border-top: 1px solid #161617;
        padding-top: 6px;
        min-width: 220px;
        text-align: center;
        font-size: 12px;
        color: #161617;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    /* List modal */
    #listDetailModal .modal-dialog { max-width: 1200px; }
    #listDetailModal .modal-body { padding: 20px; }

    /* ---------- LIST ALL MODAL — FULL WIDTH ---------- */
    #listAllModal .modal-dialog {
        max-width: 99vw;
        width: 99vw;
        margin: 0.5rem auto;
    }
    #listAllModal .modal-content {
        height: 96vh;
    }
    #listAllModal .modal-body {
        padding: 20px;
        max-height: calc(96vh - 130px);
        overflow-y: auto;
    }

    /* ✅ View button 70% width in List table */
    #listAllBody .batch-history-btn {
        width: 70% !important;
        display: inline-flex !important;
        justify-content: center !important;
        align-items: center !important;
    }

    /* Nested History modal */
    #batchHistoryModal .modal-dialog { max-width: 1000px; }
    #batchHistoryModal .modal-body { padding: 20px; }

    .list-detail-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .list-detail-table th, .list-detail-table td {
        border: 1px solid #e2e7f1;
        padding: 8px 10px;
        vertical-align: middle;
    }
    .list-detail-table th {
        background: #f8f9fa;
        font-weight: 600;
        color: #18243d;
        text-align: left;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
    }
    .list-detail-table td { color: #333; }
    .list-detail-table tr:nth-child(even) td { background: #fafbfd; }

    .history-block {
        background: #fafbfd;
        border-left: 3px solid #1e88e5;
        padding: 8px 12px;
        font-size: 11px;
        color: #4b5563;
        margin-top: 4px;
        border-radius: 3px;
    }
    .history-block strong { color: #161617; }

    @media print {
        body * { visibility: hidden; }
        #viewDetailModal, #viewDetailModal *,
        #listDetailModal, #listDetailModal *,
        #listAllModal, #listAllModal *,
        #batchHistoryModal, #batchHistoryModal * { visibility: visible; }
        #viewDetailModal, #listDetailModal, #listAllModal, #batchHistoryModal {
            position: absolute; left: 0; top: 0; width: 100%;
        }
        .modal-footer, .btn-close { display: none !important; }
        .modal-dialog { max-width: 100% !important; margin: 0 !important; }
        .modal-content { box-shadow: none !important; border: none !important; }
    }
</style>

<div class="main-content app-content">
    <div class="container-fluid">

        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Cutting Manager</h1>
                <nav>
                    <ol class="breadcrumb mb-0">
                        <li class="breadcrumb-item"><a href="javascript:void(0);">Production</a></li>
                        <li class="breadcrumb-item active">Cutting Manager</li>
                    </ol>
                </nav>
            </div>
            <div class="d-flex gap-2">
                <button class="btn" id="listAllBtn">
                    <i class="bx bx-list-ul align-middle me-1"></i> List
                </button>
                <button class="btn" id="bulkAssignBtn">
                    <i class="bx bx-layer-plus align-middle me-1"></i> Bulk Assign Cutting Master
                </button>
                <button class="btn btn-primary" id="refreshCuttingBtn">
                    <i class="bx bx-refresh me-1"></i>
                </button>
            </div>
        </div>

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-check-circle text-success me-2"></i> Approved Items — Ready for Cutting
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>Batch ID</th>
                                        <th>Photo</th>
                                        <th>Brand</th>
                                        <th>Design</th>
                                        <th>Color</th>
                                        <th>Piece</th>
                                        <th>Item</th>
                                        <th>Quantity</th>
                                        <th>Priority</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody id="approvedItemsList"></tbody>
                            </table>
                        </div>
                        <div class="pagination-wrap" id="approvedPagination"></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-cut text-primary me-2"></i> Cutting Assignments
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Batch ID</th>
                                        <th>Sub-Batch</th>
                                        <th>Brand</th>
                                        <th>Piece Type</th>
                                        <th>Worker</th>
                                        <th>Quantity</th>
                                        <th>Progress</th>
                                        <th>Damage</th>
                                        <th>Remaining</th>
                                        <th>Priority</th>
                                        <th>Delivery Date</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="cuttingMastersList"></tbody>
                            </table>
                        </div>
                        <div class="pagination-wrap" id="cuttingPagination"></div>
                    </div>
                </div>
            </div>
        </div>

    </div>
</div>

<!-- SINGLE ASSIGN MODAL -->
<div class="modal fade" id="assignModal" tabindex="-1" aria-labelledby="assignModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="assignModalLabel">Assign Cutting Master</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="assignForm">
                    <div class="mb-3">
                        <label class="form-label">Select Batch (From Approved Pool)</label>
                        <select class="form-select" id="batchSelect" required>
                            <option value="">Choose Batch</option>
                        </select>
                    </div>
                    <div id="rowsContainer"></div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveAssignBtn">
                    <i class="bx bx-save"></i> Assign
                </button>
            </div>
        </div>
    </div>
</div>

<!-- BULK ASSIGN MODAL -->
<div class="modal fade" id="bulkAssignModal" tabindex="-1" aria-labelledby="bulkAssignModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header py-2">
                <h5 class="modal-title" id="bulkAssignModalLabel">
                    <i class="bx bx-layer-plus me-1"></i> Bulk Assign Cutting Master
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="bulk-toolbar">
                    <label class="mb-0 fw-semibold">Select Batches:</label>
                    <div class="multi-select-wrap" id="multiSelectWrap">
                        <div class="multi-select-box" id="multiSelectBox">
                            <span class="placeholder" id="multiSelectPlaceholder">Click to choose batches...</span>
                            <i class="bx bx-chevron-down caret"></i>
                        </div>
                        <div class="multi-select-dropdown" id="multiSelectDropdown">
                            <div class="search-row">
                                <input type="text" class="form-control form-control-sm" id="multiSelectSearch" placeholder="Search batch, brand, design...">
                            </div>
                            <div id="multiSelectOptions"></div>
                        </div>
                    </div>
                    <span class="ms-auto badge bg-primary" id="selectedCountBadge">0 batch(es) selected</span>
                </div>

                <div id="bulkItemsContainer"></div>
            </div>
            <div class="modal-footer py-2">
                <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" id="saveBulkAssignBtn">
                    <i class="bx bx-save me-1"></i> Assign Selected
                </button>
            </div>
        </div>
    </div>
</div>

<!-- Update Progress Modal -->
<div class="modal fade" id="progressModal" tabindex="-1" aria-labelledby="progressModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="progressModalLabel">Update Progress</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="mb-3"><label class="form-label">Sub-Batch</label><input type="text" class="form-control" id="progressSubBatch" readonly></div>
                <div class="mb-3"><label class="form-label">Worker</label><input type="text" class="form-control" id="progressWorker" readonly></div>
                <div class="row">
                    <div class="col-md-4 mb-3">
                        <label class="form-label">Total Assigned</label>
                        <input type="text" class="form-control" id="progressTotal" readonly>
                    </div>
                    <div class="col-md-4 mb-3">
                        <label class="form-label">Already Passed</label>
                        <input type="text" class="form-control" id="progressPassed" readonly>
                    </div>
                    <div class="col-md-4 mb-3">
                        <label class="form-label">Remaining</label>
                        <input type="text" class="form-control" id="progressRemaining" readonly>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Update Type</label>
                        <select class="form-select" id="progressTypeSelect">
                            <option value="completed" selected>Completed (+)</option>
                            <option value="damage">Damage (+)</option>
                        </select>
                        <small class="text-muted">Damage moves to Repair &amp; reduces total</small>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Add Quantity (+)</label>
                        <input type="number" class="form-control" id="progressQty" min="0" value="0">
                        <small class="text-muted">Max addable: <span id="progressMax">0</span></small>
                    </div>
                </div>

                <div class="alert alert-info mb-0" id="progressLivePreview" style="font-size:13px;"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="updateProgressBtn">
                    <i class="bx bx-save"></i> Update
                </button>
            </div>
        </div>
    </div>
</div>

<!-- VIEW DETAIL MODAL -->
<div class="modal fade" id="viewDetailModal" tabindex="-1" aria-labelledby="viewDetailModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="viewDetailModalLabel">
                    <i class="bx bx-detail me-1"></i> Assignment Details
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="viewDetailBody"></div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-dark" id="printDetailBtn">
                    <i class="bx bx-printer me-1"></i> Print / Download
                </button>
            </div>
        </div>
    </div>
</div>

<!-- LIST DETAIL MODAL (per-batch from Bulk card) -->
<div class="modal fade" id="listDetailModal" tabindex="-1" aria-labelledby="listDetailModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="listDetailModalLabel">
                    <i class="bx bx-list-ul me-1"></i> Batch Assignment List
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="listDetailBody"></div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-dark" id="printListDetailBtn">
                    <i class="bx bx-printer me-1"></i> Print / Download
                </button>
            </div>
        </div>
    </div>
</div>

<!-- ✅ LIST ALL MODAL (Top-level List button) — FULL WIDTH -->
<div class="modal fade" id="listAllModal" tabindex="-1" aria-labelledby="listAllModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="listAllModalLabel">
                    <i class="bx bx-list-ul me-1"></i> All Passed Cutting Assignments
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="listAllBody"></div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-dark" id="printListAllBtn">
                    <i class="bx bx-printer me-1"></i> Print / Download
                </button>
            </div>
        </div>
    </div>
</div>

<!-- ✅ NESTED BATCH HISTORY MODAL (opens on top of List) -->
<div class="modal fade" id="batchHistoryModal" tabindex="-1" aria-labelledby="batchHistoryModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" style="max-width:1000px;">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="batchHistoryModalLabel">
                    <i class="bx bx-history me-1"></i> Batch History
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="batchHistoryBody"></div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-dark" id="printBatchHistoryBtn">
                    <i class="bx bx-printer me-1"></i> Print / Download
                </button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/cutting-manager.js"></script>
</body>
</html>