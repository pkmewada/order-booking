<?php require_once __DIR__ . '/includes/header2.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Additional Work Management</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Settings</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Additional Work</li>
                        </ol>
                    </nav>
                </div>
            </div>
            <div class="btn-list">
                <button class="btn btn-primary btn-wave me-2" id="addWorkBtn">
                    <i class="bx bx-plus align-middle"></i> Add Additional Work
                </button>
            </div>
        </div>
        <!-- Page Header Close -->

        <!-- Additional Work List Table -->
        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-brush text-primary me-2"></i> Additional Work List
                        </div>
                    </div>
                    <div class="card-body">
                        <!-- Search -->
                        <div class="row mb-3">
                            <div class="col-md-4 ms-auto">
                                <label class="form-label">Search</label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="bx bx-search"></i></span>
                                    <input type="text" id="searchWorkInput" class="form-control" placeholder="Search additional work">
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap" id="additionalWorkTable">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Work Name</th>
                                        <th class="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="workTableBody">
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

<!-- Add/Edit Additional Work Modal -->
<div class="modal fade" id="workModal" tabindex="-1" aria-labelledby="workModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="workModalLabel">Add Additional Work</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="workForm">
                    <div class="mb-3">
                        <label class="form-label">Work Name</label>
                        <input type="text" class="form-control" id="workName" name="workName" required placeholder="Enter work name (e.g., Screen Print, Digital Print, Peco)">
                    </div>
                    <input type="hidden" id="editWorkId" value="">
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveWorkBtn">
                    <i class="bx bx-save me-1"></i> Save
                </button>
            </div>
        </div>
    </div>
</div>

<!-- Delete Confirmation Modal -->
<div class="modal fade" id="deleteWorkModal" tabindex="-1" aria-labelledby="deleteWorkModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="deleteWorkModalLabel">Confirm Delete</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete this additional work?</p>
                <p><strong>Work:</strong> <span id="deleteWorkName"></span></p>
                <input type="hidden" id="deleteWorkId">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-danger" id="confirmDeleteWorkBtn">Delete</button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/additional-work.js"></script>