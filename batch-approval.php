<?php require_once __DIR__ . '/includes/header.php'; ?>

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
                                <th>Piece</th>
                                <th>Quantity</th>
                                <th>Priority</th>
                                <th>Available Items</th>
                                <th>Missing Items</th>
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

<!-- Approval Modal -->
<div
    class="modal fade"
    id="approvalModal"
    tabindex="-1"
    aria-labelledby="approvalModalLabel"
    aria-hidden="true"
>
    <div class="modal-dialog modal-dialog-centered modal-xl">
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

                    <div class="col-lg-5">
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

                    <div class="col-lg-7">

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
                                        <th>Piece</th>
                                        <td id="approvalPiece">-</td>
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

                        <hr>

                        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <h5 class="mb-0">
                                Item Availability
                            </h5>

                            <div>
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-primary"
                                    id="allItemsYesBtn"
                                >
                                    All Yes
                                </button>

                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-danger"
                                    id="allItemsNoBtn"
                                >
                                    All No
                                </button>
                            </div>
                        </div>

                        <p class="text-muted small mt-2">
                            Select Yes if the item is available.
                            Select No if the item is missing.
                        </p>

                        <div
                            id="approvalItemList"
                            class="border rounded p-3"
                            style="max-height:350px; overflow-y:auto;"
                        >
                            <!-- Item availability list -->
                        </div>

                        <div class="mt-3">
                            <label for="approvalRemarks" class="form-label">
                                Remarks
                            </label>

                            <textarea
                                id="approvalRemarks"
                                class="form-control"
                                rows="3"
                                placeholder="Enter remarks..."
                            ></textarea>
                        </div>

                        <div
                            id="approvalMessage"
                            class="alert mt-3"
                            style="display:none;"
                        ></div>

                        <div class="d-flex gap-2 mt-3">

                            <button
                                type="button"
                                class="btn btn-success flex-fill"
                                id="approveAvailableBtn"
                            >
                                <i class="bx bx-check-circle me-1"></i>
                                Approve
                            </button>

                            <button
                                type="button"
                                class="btn btn-warning flex-fill"
                                id="approveMissingBtn"
                            >
                                <i class="bx bx-error-circle me-1"></i>
                                Approve Missing Item
                            </button>

                        </div>

                    </div>

                </div>

            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/batch-approval.js"></script>