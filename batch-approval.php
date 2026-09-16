<?php require_once __DIR__ . '/includes/header.php'; ?>

<style>
    /* Full-page approval modal */
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
    }

    /* Item availability — 3 per row */
    .item-availability-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
    }

    .item-availability-card {
        border: 1px solid #e2e7f1;
        border-radius: 8px;
        padding: 10px 12px;
        background: #fff;
    }

    .item-availability-card .item-name {
        font-weight: 600;
        color: #18243d;
        margin-bottom: 8px;
        display: block;
        word-break: break-word;
    }

    @media (max-width: 768px) {
        .item-availability-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }

    @media (max-width: 480px) {
        .item-availability-grid {
            grid-template-columns: 1fr;
        }
    }
</style>

<div class="main-content app-content">
    <div class="container-fluid">

        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">
                    Batch Approval
                </h1>

                <nav>
                    <ol class="breadcrumb mb-0">
                        <li class="breadcrumb-item">
                            <a href="javascript:void(0);">Production</a>
                        </li>
                        <li class="breadcrumb-item active">
                            Batch Approval
                        </li>
                    </ol>
                </nav>
            </div>

            <button
                type="button"
                class="btn btn-primary"
                id="refreshApprovalBtn"
            >
                <i class="bx bx-refresh me-1"></i>
                Refresh
            </button>
        </div>

        <div class="card custom-card">
            <div class="card-header">
                <div class="card-title">
                    Batch Approval List
                </div>
            </div>

            <div class="card-body">

                <div class="row mb-3">
                    <div class="col-md-3">
                        <label class="form-label" for="approvalStatusFilter">
                            Status
                        </label>

                        <select
                            id="approvalStatusFilter"
                            class="form-select"
                        >
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="progress">Progress</option>
                            <option value="approved">Approved</option>
                            <option value="missing">Missing Item</option>
                        </select>
                    </div>

                    <div class="col-md-4 ms-auto">
                        <label class="form-label" for="approvalSearchInput">
                            Search
                        </label>

                        <div class="input-group">
                            <span class="input-group-text">
                                <i class="bx bx-search"></i>
                            </span>

                            <input
                                type="text"
                                id="approvalSearchInput"
                                class="form-control"
                                placeholder="Search batch, design, brand..."
                            >
                        </div>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-bordered text-nowrap align-middle w-100">
                        <thead>
                            <tr>
                                <th>Batch ID</th>
                                <th>Photo</th>
                                <th>Brand</th>
                                <th>Design Number</th>
                                <th>Color</th>
                                <th>Piece Type</th>
                                <th>Item List</th>
                                <th>Additional Work</th>
                                <th>Quantity</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>

                        <tbody id="approvalTableBody">
                            <!-- Loaded by JavaScript -->
                        </tbody>
                    </table>
                </div>

            </div>
        </div>

    </div>
</div>

<!-- Approval Modal — FULL PAGE -->
<div
    class="modal fade"
    id="approvalModal"
    tabindex="-1"
    aria-labelledby="approvalModalLabel"
    aria-hidden="true"
>
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">

            <div class="modal-header">
                <h5 class="modal-title" id="approvalModalLabel">
                    Batch Approval
                </h5>

                <button
                    type="button"
                    class="btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"
                ></button>
            </div>

            <div class="modal-body">

                <div class="row g-4">

                    <!-- LEFT: Photo -->
                    <div class="col-lg-4">
                        <div
                            class="border rounded p-3 text-center"
                            style="
                                min-height:400px;
                                display:flex;
                                align-items:center;
                                justify-content:center;
                                background:#f8f9fa;
                            "
                        >
                            <img
                                id="approvalPhoto"
                                src="assets/images/default.jpg"
                                alt="Batch Photo"
                                class="img-fluid rounded"
                                style="max-height:430px; object-fit:contain;"
                            >
                        </div>
                    </div>

                    <!-- RIGHT: Info + Pieces -->
                    <div class="col-lg-8">

                        <h5 class="mb-3">
                            Batch Information
                        </h5>

                        <div class="table-responsive">
                            <table class="table table-bordered">
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
                                    <tr>
                                        <th>Status</th>
                                        <td id="approvalStatus">-</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <hr>

                        <h5 class="mb-3">
                            Piece-wise Item Availability
                        </h5>

                        <p class="text-muted small">
                            Har piece ke items check karein. Agar sab items hain toh Approve karein.
                            Agar koi missing hai toh "Missing" button se requirement create karein.
                        </p>

                        <div id="approvalPiecesContainer">
                            <!-- Piece-wise cards -->
                        </div>

                    </div>

                </div>

            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/batch-approval.js"></script>