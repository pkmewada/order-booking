<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Customer Creation</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Order Booking</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Customer Creation</li>
                        </ol>
                    </nav>
                </div>
            </div>
            <div class="btn-list">
                <button class="btn btn-primary btn-wave me-2" id="addCustomerBtn">
                    <i class="bx bx-plus align-middle"></i> Add Customer
                </button>
            </div>
        </div>
        <!-- Page Header Close -->

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            Customer List
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
                            <table id="customerTable" class="table table-bordered text-nowrap w-100">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Name</th>
                                        <th>Shop Name</th>
                                        <th>Contact</th>
                                        <th>Email</th>
                                        <th>City</th>
                                        <th>State</th>
                                        <th>Agent</th>
                                        <th>Transporter</th>
                                        <th>Distributor</th>
                                        <th class="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="customerTableBody">
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

<!-- Customer QR Code Modal -->
<div class="modal fade" id="qrModal" tabindex="-1" aria-labelledby="qrModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="qrModalLabel">Customer QR Code</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body text-center">
                <h6 class="mb-0" id="qrCustomerName"></h6>
                <p class="text-muted mb-3" id="qrCustomerShop"></p>
                <div id="qrCodeContainer" class="d-flex justify-content-center mb-3"></div>
                <div class="d-flex flex-wrap justify-content-center gap-2">
                    <button type="button" class="btn btn-secondary btn-sm" id="qrDownloadBtn">
                        <i class="bx bx-download me-1"></i> Download
                    </button>
                    <button type="button" class="btn btn-success btn-sm" id="qrWhatsappBtn">
                        <i class="bx bxl-whatsapp me-1"></i> Share via WhatsApp
                    </button>
                    <button type="button" class="btn btn-primary btn-sm" id="qrEmailBtn">
                        <i class="bx bx-envelope me-1"></i> Share via Email
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Add/Edit Customer Modal -->
<div class="modal fade" id="customerModal" tabindex="-1" aria-labelledby="customerModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="customerModalLabel">Add Customer</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="customerForm">
                    <input type="hidden" id="editId" name="editId">

                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label class="form-label">Name</label>
                            <input type="text" class="form-control" id="customerName" name="name" required placeholder="Enter customer name">
                        </div>

                        <div class="col-md-6 mb-3">
                            <label class="form-label">Shop Name</label>
                            <input type="text" class="form-control" id="customerShopName" name="shopName" required placeholder="Enter shop name">
                        </div>

                        <div class="col-md-6 mb-3">
                            <label class="form-label">Contact</label>
                            <input type="text" class="form-control" id="customerContact" name="contact" required placeholder="Enter contact number">
                        </div>

                        <div class="col-md-6 mb-3">
                            <label class="form-label">Email</label>
                            <input type="email" class="form-control" id="customerEmail" name="email" required placeholder="Enter email">
                        </div>

                        <div class="col-md-6 mb-3">
                            <label class="form-label">City</label>
                            <input type="text" class="form-control" id="customerCity" name="city" required placeholder="Enter city">
                        </div>

                        <div class="col-md-6 mb-3">
                            <label class="form-label">State</label>
                            <input type="text" class="form-control" id="customerState" name="state" required placeholder="Enter state">
                        </div>

                        <div class="col-md-4 mb-3">
                            <label class="form-label">Agent</label>
                            <select class="form-select" id="customerAgent" name="agentId" required>
                                <option value="">Select Agent</option>
                            </select>
                        </div>

                        <div class="col-md-4 mb-3">
                            <label class="form-label">Transporter</label>
                            <select class="form-select" id="customerTransporter" name="transporterId" required>
                                <option value="">Select Transporter</option>
                            </select>
                        </div>

                        <div class="col-md-4 mb-3">
                            <label class="form-label">Distributor</label>
                            <select class="form-select" id="customerDistributor" name="distributorId" required>
                                <option value="">Select Distributor</option>
                            </select>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveCustomerBtn">
                    <i class="bx bx-save me-1"></i> Save
                </button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/customer-creation.js"></script>
