<?php require_once __DIR__ . '/includes/header2.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Item List Management</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Settings</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Item List</li>
                        </ol>
                    </nav>
                </div>
            </div>
            <div class="btn-list">
                <button class="btn btn-primary btn-wave me-2" id="addItemBtn">
                    <i class="bx bx-plus align-middle"></i> Add Item
                </button>
            </div>
        </div>
        <!-- Page Header Close -->

        <!-- Item List Table -->
        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-list-ul text-primary me-2"></i> Item List
                        </div>
                    </div>
                    <div class="card-body">
                        <!-- Search -->
                        <div class="row mb-3">
                            <div class="col-md-4 ms-auto">
                                <label class="form-label">Search</label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="bx bx-search"></i></span>
                                    <input type="text" id="searchItemInput" class="form-control" placeholder="Search item name">
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap" id="itemListTable">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Item Name</th>
                                        <th class="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="itemTableBody">
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

<!-- Add/Edit Item Modal -->
<div class="modal fade" id="itemModal" tabindex="-1" aria-labelledby="itemModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="itemModalLabel">Add Item</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="itemForm">
                    <div class="mb-3">
                        <label class="form-label">Item Name</label>
                        <input type="text" class="form-control" id="itemName" name="itemName" required placeholder="Enter item name (e.g., Main Fabric, Cotton, Zip, Label, Elastic)">
                    </div>
                    <input type="hidden" id="editItemId" value="">
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveItemBtn">
                    <i class="bx bx-save me-1"></i> Save
                </button>
            </div>
        </div>
    </div>
</div>

<!-- Delete Confirmation Modal -->
<div class="modal fade" id="deleteItemModal" tabindex="-1" aria-labelledby="deleteItemModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="deleteItemModalLabel">Confirm Delete</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete this item?</p>
                <p><strong>Item:</strong> <span id="deleteItemName"></span></p>
                <input type="hidden" id="deleteItemId">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-danger" id="confirmDeleteItemBtn">Delete</button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/item-list.js"></script>