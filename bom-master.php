
<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="main-content app-content">
    <div class="container-fluid">

        <div class="my-4 page-header-breadcrumb d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h1 class="page-title fw-medium fs-18 mb-2">BOM Master</h1>
                <nav>
                    <ol class="breadcrumb mb-0">
                        <li class="breadcrumb-item">
                            <a href="javascript:void(0);">Masters</a>
                        </li>
                        <li class="breadcrumb-item active">BOM Master</li>
                    </ol>
                </nav>
            </div>

            <button class="btn btn-primary btn-wave" id="createBomBtn">
                <i class="bx bx-plus align-middle"></i>
                Create BOM Master
            </button>
        </div>

        <div class="row">
            <div class="col-xl-12">
                <div class="card custom-card">
                    <div class="card-header">
                        <div class="card-title">BOM Master List</div>
                    </div>

                    <div class="card-body">

                        <div class="row mb-3 g-3">
                            <div class="col-md-3">
                                <label class="form-label">Brand Filter</label>
                                <select id="brandFilter" class="form-select">
                                    <option value="">All Brands</option>
                                    <option>NIVI BLOSSOM</option>
                                    <option>AMARI</option>
                                    <option>LITTLE DOLLY</option>
                                </select>
                            </div>

                            <div class="col-md-3">
                                <label class="form-label">Piece Filter</label>
                                <select id="pieceFilter" class="form-select">
                                    <option value="">All Pieces</option>
                                    <option value="1">1 Piece</option>
                                    <option value="2">2 Pieces</option>
                                    <option value="3">3 Pieces</option>
                                    <option value="4">4 Pieces</option>
                                    <option value="5">5 Pieces</option>
                                </select>
                            </div>

                            <div class="col-md-3 ms-auto">
                                <label class="form-label">Search</label>
                                <div class="input-group">
                                    <span class="input-group-text">
                                        <i class="bx bx-search"></i>
                                    </span>
                                    <input type="text" id="searchInput"
                                           class="form-control"
                                           placeholder="Search BOM, brand, design...">
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive">
                            <table class="table table-bordered text-nowrap w-100 align-middle">
                                <thead>
                                    <tr>
                                        <th>BOM ID</th>
                                        <th>Brand</th>
                                        <th>Photo</th>
                                        <th>Color</th>
                                        <th>Design Number</th>
                                        <th>Piece</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody id="bomTableBody"></tbody>
                            </table>
                        </div>

                    </div>
                </div>
            </div>
        </div>

    </div>
</div>

<!-- CREATE / EDIT BOM -->
<div class="modal fade" id="bomModal" tabindex="-1"
     aria-labelledby="bomModalLabel" aria-hidden="true">

    <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">

            <div class="modal-header">
                <h5 class="modal-title" id="bomModalLabel">
                    Create BOM Master
                </h5>
                <button type="button" class="btn-close"
                        data-bs-dismiss="modal"></button>
            </div>

            <div class="modal-body">

                <form id="bomForm">

                    <input type="hidden" id="editId">

                    <!-- BASIC DETAILS -->
                    <h5 class="mb-3">Basic Details</h5>

                    <div class="row g-3">

                        <div class="col-md-4">
                            <label class="form-label">
                                Brand Name <span class="text-danger">*</span>
                            </label>
                            <select id="brandSelect" class="form-select" required>
                                <option value="">Select Brand</option>
                                <option>NIVI BLOSSOM</option>
                                <option>AMARI</option>
                                <option>LITTLE DOLLY</option>
                            </select>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                Design Number <span class="text-danger">*</span>
                            </label>
                            <input type="text" id="designNumber"
                                   class="form-control"
                                   placeholder="Enter design number" required>
                        </div>

                        <div class="col-md-4">
                            <label class="form-label">
                                Color <span class="text-danger">*</span>
                            </label>
                            <select id="colorSelect" class="form-select" required>
                                <option value="">Select Color</option>
                                <option>Red</option>
                                <option>Blue</option>
                                <option>Green</option>
                                <option>Yellow</option>
                                <option>Black</option>
                                <option>White</option>
                                <option>Orange</option>
                                <option>Purple</option>
                                <option>Pink</option>
                                <option>Brown</option>
                            </select>
                        </div>

                        <div class="col-md-6">
                            <label class="form-label">Upload Photo</label>
                            <input type="file" id="photoUpload"
                                   class="form-control" accept="image/*">
                            <div id="photoPreview" class="mt-2"></div>
                        </div>

                    </div>

                    <hr class="my-4">

                    <!-- PIECE RADIO SELECTION -->
                    <h5 class="mb-3">Piece Selection</h5>

                    <div class="d-flex flex-wrap gap-4 mb-3">

                        <div class="form-check">
                            <input class="form-check-input piece-radio"
                                   type="radio" name="pieceCount"
                                   value="1" id="pieceRadio1">
                            <label class="form-check-label" for="pieceRadio1">
                                1 Pic
                            </label>
                        </div>

                        <div class="form-check">
                            <input class="form-check-input piece-radio"
                                   type="radio" name="pieceCount"
                                   value="2" id="pieceRadio2">
                            <label class="form-check-label" for="pieceRadio2">
                                2 Pic
                            </label>
                        </div>

                        <div class="form-check">
                            <input class="form-check-input piece-radio"
                                   type="radio" name="pieceCount"
                                   value="3" id="pieceRadio3">
                            <label class="form-check-label" for="pieceRadio3">
                                3 Pic
                            </label>
                        </div>

                        <div class="form-check">
                            <input class="form-check-input piece-radio"
                                   type="radio" name="pieceCount"
                                   value="4" id="pieceRadio4">
                            <label class="form-check-label" for="pieceRadio4">
                                4 Pic
                            </label>
                        </div>

                        <div class="form-check">
                            <input class="form-check-input piece-radio"
                                   type="radio" name="pieceCount"
                                   value="5" id="pieceRadio5">
                            <label class="form-check-label" for="pieceRadio5">
                                5 Pic
                            </label>
                        </div>

                    </div>

                    <div class="table-responsive">
                        <table class="table table-bordered align-middle"
                               id="pieceConfigTable">

                            <thead class="table-light">
                                <tr>
                                    <th style="min-width:110px;">Piece</th>
                                    <th style="min-width:170px;">Select Item</th>
                                    <th style="min-width:250px;">Item List</th>
                                    <th style="min-width:430px;">Additional Work</th>
                                </tr>
                            </thead>

                            <tbody id="pieceConfigBody">
                                <tr>
                                    <td colspan="4"
                                        class="text-center text-muted py-4">
                                        Select 1–5 Pic to configure pieces.
                                    </td>
                                </tr>
                            </tbody>

                        </table>
                    </div>

                </form>

            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-secondary"
                        data-bs-dismiss="modal">
                    Cancel
                </button>

                <button type="button" class="btn btn-primary" id="saveBomBtn">
                    <i class="bx bx-save me-1"></i>
                    Save BOM
                </button>
            </div>

        </div>
    </div>
</div>

<!-- VIEW BOM -->
<div class="modal fade" id="viewBomModal" tabindex="-1"
     aria-labelledby="viewBomModalLabel" aria-hidden="true">

    <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">

            <div class="modal-header">
                <h5 class="modal-title" id="viewBomModalLabel">
                    BOM Details
                </h5>
                <button type="button" class="btn-close"
                        data-bs-dismiss="modal"></button>
            </div>

            <div class="modal-body" id="viewBomBody"></div>

            <div class="modal-footer">
                <button type="button" class="btn btn-secondary"
                        data-bs-dismiss="modal">
                    Close
                </button>
            </div>

        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>

<script src="assets/js/bom-master.js"></script>