<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Distributor Management</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Order Booking</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Distributor Management</li>
                        </ol>
                    </nav>
                </div>
            </div>
            <div class="btn-list">
                <button class="btn btn-primary btn-wave me-2" id="addDistributorBtn">
                    <i class="bx bx-plus align-middle"></i> Add Distributor
                </button>
            </div>
        </div>
        <!-- Page Header Close -->

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            Distributor List
                        </div>
                    </div>

                    <div class="card-body">
                        <div class="row mb-3">
                            <div class="col-md-4 ms-auto">
                                <label class="form-label">Search</label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="bx bx-search"></i></span>
                                    <input type="text" id="searchInput" class="form-control" placeholder="Search by name">
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table id="distributorTable" class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Name</th>
                                        <th>Contact</th>
                                        <th>Email</th>
                                        <th>City</th>
                                        <th>State</th>
                                        <th class="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="distributorTableBody">
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

<!-- Add/Edit Distributor Modal -->
<div class="modal fade" id="distributorModal" tabindex="-1" aria-labelledby="distributorModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="distributorModalLabel">Add Distributor</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="distributorForm">
                    <input type="hidden" id="editId" name="editId">

                    <div class="mb-3">
                        <label class="form-label">Name</label>
                        <input type="text" class="form-control" id="distributorName" name="name" required placeholder="Enter name">
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Contact</label>
                        <input type="text" class="form-control" id="distributorContact" name="contact" required placeholder="Enter contact number">
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-control" id="distributorEmail" name="email" required placeholder="Enter email">
                    </div>

                    <div class="mb-3">
                        <label class="form-label">State</label>
                        <select class="form-control" id="distributorState" name="state" required>
                            <option value="">Select State</option>
                        </select>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">City</label>
                        <select class="form-control" id="distributorCity" name="city" required>
                            <option value="">Select City</option>
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveDistributorBtn">
                    <i class="bx bx-save me-1"></i> Save
                </button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/state-city.js"></script>
<script src="assets/js/distributor.js"></script>
