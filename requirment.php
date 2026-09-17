<?php require_once __DIR__ . '/includes/header.php'; ?>

<style>
    #refreshReqBtn {
        background-color: #161617 !important;
        border-color: #161617 !important;
        color: #fff !important;
    }
    #refreshReqBtn:hover { background-color: #2b2b2d !important; border-color: #2b2b2d !important; }

    .req-item-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-bottom: 1px solid #eef1f7;
        font-size: 13px;
    }
    .req-item-row:last-child { border-bottom: none; }
    .req-item-row input[type="checkbox"] {
        width: 16px; height: 16px;
        cursor: pointer;
        accent-color: #161617;
        flex-shrink: 0;
    }
    .req-item-row.received .req-item-name {
        color: #1b5e20;
        font-weight: 600;
        text-decoration: line-through;
    }
    .req-item-name {
        font-weight: 500;
        color: #18243d;
    }
    .req-missing-badge {
        background: #fce4e4;
        color: #b91c1c;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
    }
    .req-received-badge {
        background: #d1fae5;
        color: #065f46;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
    }
    .req-photo { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; }
</style>

<div class="main-content app-content">
    <div class="container-fluid">

        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Requirement</h1>
                <nav>
                    <ol class="breadcrumb mb-0">
                        <li class="breadcrumb-item"><a href="javascript:void(0);">Production</a></li>
                        <li class="breadcrumb-item active">Requirement</li>
                    </ol>
                </nav>
            </div>
            <button type="button" class="btn btn-primary" id="refreshReqBtn">
                <i class="bx bx-refresh me-1"></i> Refresh
            </button>
        </div>

        <div class="row" id="requirementCardsContainer"></div>

    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/requirment.js"></script>
</body>
</html>