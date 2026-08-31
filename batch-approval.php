<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Batch Approval</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Tables</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Batch Approval</li>
                        </ol>
                    </nav>
                </div>
            </div>
        </div>
        <!-- Page Header Close -->

        <!-- Start::row-1 -->
        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            Batches Pending Approval
                        </div>
                    </div>

                    <div class="card-body">
                        <!-- Filters -->
                        <div class="row mb-3">
                            <div class="col-md-3">
                                <label class="form-label">Status Filter</label>
                                <select id="statusFilter" class="form-select">
                                    <option value="">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                </select>
                            </div>
                            <div class="col-md-3 ms-auto">
                                <label class="form-label">Search</label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="bx bx-search"></i></span>
                                    <input type="text" id="searchInput" class="form-control" placeholder="Search">
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>Batch ID</th>
                                        <th>Brand</th>
                                        <th>Photo</th>
                                        <th>Status</th>
                                        <th>Checks</th>
                                        <th>Remarks</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody id="batchTableBody">
                                    <!-- Data will be loaded here -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- View Batch Modal -->
<div class="modal fade" id="viewModal" tabindex="-1" aria-labelledby="viewModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="viewModalLabel">Batch Details</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="row">
                    <!-- Left Side - Image -->
                    <div class="col-md-6">
                        <div id="viewImageContainer" class="text-center p-3" style="background: #f8f9fa; border-radius: 8px; min-height: 400px; display: flex; align-items: center; justify-content: center;">
                            <img id="viewImage" src="" alt="Batch Image" class="img-fluid rounded" style="max-height: 450px; object-fit: contain;">
                        </div>
                    </div>
                    
                    <!-- Right Side - Details -->
                    <div class="col-md-6">
                        <h4 class="mb-3">Batch Information</h4>
                        
                        <div class="row mb-2">
                            <div class="col-4"><strong>Batch ID:</strong></div>
                            <div class="col-8" id="viewBatchId">-</div>
                        </div>
                        <div class="row mb-2">
                            <div class="col-4"><strong>Brand:</strong></div>
                            <div class="col-8" id="viewBrand">-</div>
                        </div>
                        <div class="row mb-2">
                            <div class="col-4"><strong>Design Number:</strong></div>
                            <div class="col-8" id="viewDesignNumber">-</div>
                        </div>
                        <div class="row mb-2">
                            <div class="col-4"><strong>Color:</strong></div>
                            <div class="col-8" id="viewColor">-</div>
                        </div>
                        <div class="row mb-2">
                            <div class="col-4"><strong>Quantity:</strong></div>
                            <div class="col-8" id="viewQuantity">-</div>
                        </div>
                        <div class="row mb-2">
                            <div class="col-4"><strong>Priority:</strong></div>
                            <div class="col-8" id="viewPriority">-</div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-4"><strong>Created Date:</strong></div>
                            <div class="col-8" id="viewCreatedDate">-</div>
                        </div>
                        
                        <hr>
                        
                        <h6 class="mb-3">Quality Checklist</h6>
                        
                        <!-- Radio Buttons for Piece Selection -->
                        <div class="mb-3">
                            <label class="form-label fw-bold">Select Pieces</label>
                            <div class="mt-2">
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="pieceType" id="pieceType1" value="1 Piece" checked>
                                    <label class="form-check-label" for="pieceType1">1 Piece</label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="pieceType" id="pieceType2" value="2 Piece">
                                    <label class="form-check-label" for="pieceType2">2 Piece</label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="pieceType" id="pieceType3" value="3 Piece">
                                    <label class="form-check-label" for="pieceType3">3 Piece</label>
                                </div>
                            </div>
                            <small class="text-muted">Select piece type</small>
                        </div>

                        <!-- Checkbox Items -->
                        <div class="form-check mb-2">
                            <input class="form-check-input checklist-item" type="checkbox" id="check1" value="fabric_availability">
                            <label class="form-check-label" for="check1">
                                Check Frame/Pattern Availability
                            </label>
                        </div>
                        <div class="form-check mb-2">
                            <input class="form-check-input checklist-item" type="checkbox" id="check2" value="main_fabric">
                            <label class="form-check-label" for="check2">
                                Check Main Fabric Stock
                            </label>
                        </div>
                        <div class="form-check mb-2">
                            <input class="form-check-input checklist-item" type="checkbox" id="check3" value="additional_fabric">
                            <label class="form-check-label" for="check3">
                                Check Additional Fabric (Cotton/Net/Satin/Liagra)
                            </label>
                        </div>
                        <div class="form-check mb-3">
                            <input class="form-check-input checklist-item" type="checkbox" id="check4" value="zip_stock">
                            <label class="form-check-label" for="check4">
                                Check Zip Stock
                            </label>
                        </div>
                        
                        <!-- Remarks Field -->
                        <div class="mb-3">
                            <label class="form-label fw-bold">Remarks</label>
                            <textarea class="form-control" id="remarksInput" rows="3" placeholder="Enter remarks here..."></textarea>
                        </div>
                        
                        <div id="statusMessage" class="alert mb-3" style="display: none;"></div>
                        
                        <div class="d-flex gap-2" id="actionButtons">
                            <button class="btn btn-success flex-fill" id="approveBtn">
                                <i class="bx bx-check-circle"></i> Approve
                            </button>
                            <button class="btn btn-warning flex-fill" id="pendingBtn">
                                <i class="bx bx-time"></i> Pending
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