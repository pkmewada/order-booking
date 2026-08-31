<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Order List</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Order Booking</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Order List</li>
                        </ol>
                    </nav>
                </div>
            </div>
            <div class="btn-list">
                <a href="order-punch" class="btn btn-primary btn-wave me-2">
                    <i class="bx bx-plus align-middle"></i> New Order
                </a>
            </div>
        </div>
        <!-- Page Header Close -->

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            Orders
                        </div>
                    </div>

                    <div class="card-body">
                        <div class="row mb-3">
                            <div class="col-md-3">
                                <label class="form-label">Status</label>
                                <select id="statusFilter" class="form-select">
                                    <option value="all">All</option>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                            <div class="col-md-4 ms-auto">
                                <label class="form-label">Search</label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="bx bx-search"></i></span>
                                    <input type="text" id="searchInput" class="form-control" placeholder="Search by order id, customer or shop">
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table id="orderTable" class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Order ID</th>
                                        <th>Customer</th>
                                        <th>Shop Name</th>
                                        <th>Delivery Date</th>
                                        <th>Sets</th>
                                        <th>Pcs</th>
                                        <th>Status</th>
                                        <th class="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="orderTableBody">
                                    <!-- Data will be loaded here -->
                                </tbody>
                            </table>
                        </div>

                        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3">
                            <div class="text-muted fs-13" id="paginationInfo"></div>
                            <nav>
                                <ul class="pagination pagination-sm mb-0" id="paginationControls"></ul>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/order-list.js"></script>
