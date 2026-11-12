<?php require_once __DIR__ . '/../includes/header2.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <!-- Page Header -->
        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">Users</h1>
                <div class="">
                    <nav>
                        <ol class="breadcrumb mb-0">
                            <li class="breadcrumb-item"><a href="javascript:void(0);">Settings</a></li>
                            <li class="breadcrumb-item active" aria-current="page">Users</li>
                        </ol>
                    </nav>
                </div>
            </div>
            <div class="btn-list">
                <button class="btn btn-primary btn-wave me-2" id="addUserBtn">
                    <i class="bx bx-plus align-middle"></i> Add User
                </button>
            </div>
        </div>
        <!-- Page Header Close -->

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="bx bx-user text-primary me-2"></i> Sign-in Accounts
                        </div>
                    </div>
                    <div class="card-body">
                        <p class="text-muted fs-12 mb-3">Admin: every page. Employee: Order Booking and Manufacturing; Settings and order import are admin-only.
                            Changing a role, disabling an account or resetting a password signs that user out.</p>
                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Username</th>
                                        <th>Name</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Last Sign-in</th>
                                        <th class="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="userTableBody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </div>
</div>

<!-- Add / Edit User Modal -->
<div class="modal fade" id="userModal" tabindex="-1" aria-labelledby="userModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="userModalLabel">Add User</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="userForm" autocomplete="off">
                    <input type="hidden" id="userId">
                    <div class="mb-3">
                        <label class="form-label" for="userUsername">Username</label>
                        <input type="text" class="form-control" id="userUsername" maxlength="64" required placeholder="e.g. ramesh.sales">
                    </div>
                    <div class="mb-3">
                        <label class="form-label" for="userDisplayName">Name</label>
                        <input type="text" class="form-control" id="userDisplayName" maxlength="150" placeholder="Full name (optional)">
                    </div>
                    <div class="mb-3">
                        <label class="form-label" for="userRole">Role</label>
                        <select class="form-select" id="userRole">
                            <option value="employee">Employee</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div class="mb-3" id="userPasswordGroup">
                        <label class="form-label" for="userPassword">Password</label>
                        <input type="password" class="form-control" id="userPassword" maxlength="200" autocomplete="new-password" placeholder="At least 8 characters">
                    </div>
                    <div class="form-check form-switch" id="userActiveGroup">
                        <input class="form-check-input" type="checkbox" role="switch" id="userActive">
                        <label class="form-check-label" for="userActive">Account enabled</label>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="saveUserBtn"><i class="bx bx-save me-1"></i> Save</button>
            </div>
        </div>
    </div>
</div>

<!-- Reset Password Modal -->
<div class="modal fade" id="passwordModal" tabindex="-1" aria-labelledby="passwordModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="passwordModalLabel">Reset Password</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="passwordUserId">
                <p class="mb-2">New password for <strong id="passwordUserName"></strong>:</p>
                <input type="password" class="form-control" id="newPassword" maxlength="200" autocomplete="new-password" placeholder="At least 8 characters">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="savePasswordBtn">Save Password</button>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>

<script src="assets/js/users.js?v=<?= filemtime(__DIR__ . '/../assets/js/users.js') ?>"></script>
