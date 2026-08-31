<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Employee Management</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Tables</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Employee Management</li>
                        </ol>
                    </nav>
                </div>
            </div>
            <div class="btn-list">
                <button class="btn btn-primary btn-wave me-2" id="addEmployeeBtn">
                    <i class="bx bx-plus align-middle"></i> Add Employee
                </button>
            </div>
        </div>
        <!-- Page Header Close -->

        <!-- Start::row-1 -->
        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            Employee List
                        </div>
                    </div>

                    <div class="card-body">
                        <!-- Filters -->
                        <div class="row mb-3">
                            <div class="col-md-2">
                                <label class="form-label">Category Filter</label>
                                <select id="categoryFilter" class="form-select">
                                    <option value="all">All Categories</option>
                                    <option value="cutting">Cutting</option>
                                    <option value="stitching">Stitching</option>
                                    <option value="ironing">Ironing</option>
                                </select>
                            </div>
                            
                            <div class="col-md-2">
                                <label class="form-label">Employee Type Filter</label>
                                <select id="typeFilter" class="form-select">
                                    <option value="all">All Types</option>
                                    <option value="housein">House In</option>
                                    <option value="outsource">Outsource</option>
                                </select>
                            </div>

                            <div class="col-md-3 ms-auto">
                                <label class="form-label">Search</label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="bx bx-search"></i></span>
                                    <input type="text" id="searchInput" class="form-control" placeholder="Search by name">
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table id="employeeTable" class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Worker Name</th>
                                        <th>Category</th>
                                        <th>Employee Type</th>
                                        <th class="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="employeeTableBody">
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

<!-- Add/Edit Employee Modal -->
<div class="modal fade" id="employeeModal" tabindex="-1" aria-labelledby="employeeModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="employeeModalLabel">Add Employee</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="employeeForm">
                    <input type="hidden" id="editId" name="editId">

                    <div class="mb-3">
                        <label class="form-label">Worker Name</label>
                        <input type="text" class="form-control" id="workerName" name="workerName" required placeholder="Enter worker name">
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Category</label>
                        <select class="form-select" id="categorySelect" name="category" required>
                            <option value="">Select Category</option>
                            <option value="cutting">Cutting</option>
                            <option value="stitching">Stitching</option>
                            <option value="ironing">Ironing</option>
                        </select>
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Employee Type</label>
                        <select class="form-select" id="employeeTypeSelect" name="employeeType" required>
                            <option value="">Select Employee Type</option>
                            <option value="housein">House In</option>
                            <option value="outsource">Outsource</option>
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveEmployeeBtn">
                    <i class="bx bx-save me-1"></i> Save
                </button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/empolyee.js"></script>