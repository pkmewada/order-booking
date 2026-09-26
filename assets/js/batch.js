$(document).ready(function () {
    "use strict";

    const BATCH_STORAGE_KEY = "batchData";
    const BOM_STORAGE_KEY = "bomMasterData";
    const APPROVED_BATCH_STORAGE_KEY = "approvedBatchData";

    let batchData = [];
    let bomData = [];
    let selectedBom = null;

    const batchModal = new bootstrap.Modal(
        document.getElementById("batchModal")
    );

    const viewBatchModal = new bootstrap.Modal(
        document.getElementById("viewBatchModal")
    );

    const photoZoomModal = new bootstrap.Modal(
        document.getElementById("photoZoomModal")
    );

    // --------------------------------------------------
    // HELPERS
    // --------------------------------------------------

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalize(value) {
        return String(value ?? "").trim().toLowerCase();
    }

    function readStorage(key) {
        try {
            const value = localStorage.getItem(key);
            if (!value) return [];
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("Storage read error:", error);
            return [];
        }
    }

    function saveStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error("Storage save error:", error);
            Swal.fire("Storage Error", "Could not save data.", "error");
            return false;
        }
    }

    function getDesignNumber(bom) {
        return String(
            bom?.designNumber || bom?.designNo || bom?.design || ""
        ).trim();
    }

    function getBrand(bom) {
        return String(bom?.brand || bom?.brandName || "").trim();
    }

    function getColor(bom) {
        return String(bom?.color || bom?.colour || "").trim();
    }

    function getPhoto(bom) {
        return bom?.photo || bom?.image || bom?.designPhoto ||
            "assets/images/default.jpg";
    }

    function getPieces(bom) {
        if (!bom) return [];
        const pieces = bom.pieces || bom.pieceConfigurations || bom.pieceConfig || bom.pieceConfiguration || [];
        return Array.isArray(pieces) ? pieces : [];
    }

    function getPieceNumber(piece, index) {
        return Number(piece?.number) || index + 1;
    }

    function getPieceItem(piece) {
        return String(piece?.item || piece?.selectItem || piece?.selectedItem || piece?.product || "").trim();
    }

    function getMaterials(piece) {
        let materials = piece?.materials || piece?.itemList || piece?.items || [];
        if (typeof materials === "string") materials = materials.split(",").map(item => item.trim()).filter(Boolean);
        if (!Array.isArray(materials)) return [];
        return [...new Set(materials.map(item => {
            if (typeof item === "string") return item.trim();
            return String(item?.itemName || item?.name || item?.materialName || item?.label || "").trim();
        }).filter(Boolean))];
    }

    function getAdditionalWorks(piece) {
        let works = piece?.additionalWorks || piece?.additionalWork || piece?.additional_work || piece?.work || [];
        if (!Array.isArray(works)) {
            if (typeof works === "string" && works.trim()) return [{ workType: works.trim(), stage: "" }];
            return [];
        }
        return works.map(work => {
            if (typeof work === "string") return { workType: work, stage: "" };
            return {
                workType: String(work?.workType || work?.type || "").trim(),
                stage: String(work?.stage || "").trim()
            };
        }).filter(work => work.workType || work.stage);
    }

    function getNextBatchId() {
        if (!batchData.length) return "BATCH-001";
        const numbers = batchData.map(batch => {
            const match = String(batch.batchId || "").match(/(\d+)$/);
            return match ? Number(match[1]) : 0;
        });
        return `BATCH-${String(Math.max(...numbers, 0) + 1).padStart(3, "0")}`;
    }

    function getNextNumericId() {
        if (!batchData.length) return 1;
        return Math.max(...batchData.map(batch => Number(batch.id) || 0)) + 1;
    }

    function getPriorityClass(priority) {
        const p = normalize(priority);
        if (p === "high") return "priority-high";
        if (p === "medium") return "priority-medium";
        if (p === "low") return "priority-low";
        return "";
    }

    /* ======================================================
       PASSED DATE/TIME FORMAT
       ====================================================== */

    function formatPassedDateTime(isoString) {
        if (!isoString) return { date: "-", time: "-" };

        const d = new Date(isoString);
        if (isNaN(d.getTime())) return { date: "-", time: "-" };

        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();

        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        if (hours === 0) hours = 12;
        const hourStr = String(hours).padStart(2, "0");

        return {
            date: `${day}/${month}/${year}`,
            time: `${hourStr}:${minutes} ${ampm}`
        };
    }

    /* ======================================================
       DESIGN NUMBER UNIQUENESS
       ====================================================== */

    function isDesignUsedInBatch(designNumber, ignoreBatchId) {
        const target = normalize(designNumber);
        if (!target) return false;

        return batchData.some(function (batch) {
            if (ignoreBatchId && String(batch.id) === String(ignoreBatchId)) {
                return false;
            }
            return normalize(batch.designNumber) === target;
        });
    }

    /* ======================================================
       GET AVAILABLE BOMs (design not used)
       ====================================================== */

    function getAvailableBoms(ignoreBatchId) {
        return bomData.filter(function (bom) {
            const design = getDesignNumber(bom);
            if (!design) return false;
            return !isDesignUsedInBatch(design, ignoreBatchId);
        });
    }

    // --------------------------------------------------
    // DATA LOAD
    // --------------------------------------------------

    function loadData() {
        batchData = readStorage(BATCH_STORAGE_KEY);
        bomData = readStorage(BOM_STORAGE_KEY);
    }

    // --------------------------------------------------
    // FILTERS
    // --------------------------------------------------

    function renderFilters() {
        const brands = [...new Set(batchData.map(batch => batch.brand).filter(Boolean))];
        const colors = [...new Set(batchData.map(batch => batch.color).filter(Boolean))];

        const brandFilter = $("#brandFilter");
        const colorFilter = $("#colorFilter");
        const currentBrand = brandFilter.val();
        const currentColor = colorFilter.val();

        brandFilter.find("option:not(:first)").remove();
        colorFilter.find("option:not(:first)").remove();

        brands.forEach(brand => {
            brandFilter.append(`<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`);
        });
        colors.forEach(color => {
            colorFilter.append(`<option value="${escapeHtml(color)}">${escapeHtml(color)}</option>`);
        });

        if (currentBrand) brandFilter.val(currentBrand);
        if (currentColor) colorFilter.val(currentColor);
    }

    // --------------------------------------------------
    // DESIGN NUMBER SEARCH + DROPDOWN
    // --------------------------------------------------

    function buildDesignDropdown(query) {
        const dropdown = $("#designDropdown");
        const q = normalize(query);
        const editId = $("#editBatchId").val();

        let matches = getAvailableBoms(editId);

        // If editing, keep the current design visible
        if (editId) {
            const currentDesign = normalize($("#designNumber").val());
            if (currentDesign) {
                const selfBom = bomData.find(bom => normalize(getDesignNumber(bom)) === currentDesign);
                if (selfBom && !matches.some(b => String(b.id) === String(selfBom.id))) {
                    matches.push(selfBom);
                }
            }
        }

        if (q) {
            matches = matches.filter(bom => {
                const design = normalize(getDesignNumber(bom));
                const brand = normalize(getBrand(bom));
                const color = normalize(getColor(bom));
                return design.includes(q) || brand.includes(q) || color.includes(q);
            });
        }

        if (!matches.length) {
            dropdown.html(`<div class="design-option text-muted">No available design found.</div>`).show();
            return;
        }

        dropdown.empty();
        matches.forEach(bom => {
            const design = getDesignNumber(bom);
            const brand = getBrand(bom);
            const color = getColor(bom);
            dropdown.append(`
                <div class="design-option" data-design="${escapeHtml(design)}">
                    <div class="fw-semibold">${escapeHtml(design)}</div>
                    <div class="design-meta">${escapeHtml(brand || "-")} • ${escapeHtml(color || "-")}</div>
                </div>
            `);
        });
        dropdown.show();
    }

    $("#designNumber").on("focus", function () {
        buildDesignDropdown($(this).val());
    });

    $("#designNumber").on("input", function () {
        buildDesignDropdown($(this).val());
        fillDesignData();
    });

    $(document).on("click", "#designDropdown .design-option", function () {
        const design = $(this).data("design");
        if (!design) return;
        $("#designNumber").val(design);
        $("#designDropdown").hide();
        fillDesignData();
    });

    $(document).on("click", function (e) {
        if (!$(e.target).closest("#designNumber, #designDropdown").length) {
            $("#designDropdown").hide();
        }
    });

    // --------------------------------------------------
    // FILL DESIGN DATA
    // --------------------------------------------------

    function fillDesignData() {
        const designNumber = normalize($("#designNumber").val());
        selectedBom = bomData.find(bom => normalize(getDesignNumber(bom)) === designNumber);

        if (!selectedBom) {
            $("#brandSelect").val("");
            $("#colorSelect").val("");
            $("#batchPhotoPreview").attr("src", "assets/images/default.jpg");
            $("#batchPiecesContainer").html("");
            return;
        }

        $("#brandSelect").val(getBrand(selectedBom));
        $("#colorSelect").val(getColor(selectedBom));
        $("#batchPhotoPreview").attr("src", getPhoto(selectedBom));

        const pieces = getPieces(selectedBom);
        let html = "";
        pieces.forEach((piece, index) => {
            html += `
                <div data-piece-index="${index}">
                    <span data-piece-number="${getPieceNumber(piece, index)}"></span>
                    <span data-piece-item="${escapeHtml(getPieceItem(piece))}"></span>
                </div>
            `;
        });
        $("#batchPiecesContainer").html(html);
    }

    // --------------------------------------------------
    // RESET
    // --------------------------------------------------

    function resetForm() {
        $("#batchForm")[0].reset();
        $("#editBatchId").val("");
        $("#batchIdPreview").val(getNextBatchId());
        $("#batchPhotoPreview").attr("src", "assets/images/default.jpg");
        $("#batchPiecesContainer").html("");
        $("#designDropdown").hide().empty();
        $("#batchModalLabel").text("Create Batch");
        $("#batchFormMessage").hide().html("");
        selectedBom = null;
    }

    // --------------------------------------------------
    // FORM MESSAGE
    // --------------------------------------------------

    function showFormMessage(type, message) {
        $("#batchFormMessage")
            .removeClass("alert-warning alert-danger alert-success")
            .addClass(`alert-${type}`)
            .html(message)
            .show();
    }

    // --------------------------------------------------
    // CREATE BATCH
    // --------------------------------------------------

    $("#createBatchBtn").on("click", function () {
        resetForm();
        batchModal.show();
    });

    // --------------------------------------------------
    // REFRESH
    // --------------------------------------------------

    $("#refreshBatchBtn").on("click", function () {
        const btn = $(this);
        btn.addClass("spinning");
        loadData();
        $("#brandFilter").val("");
        $("#priorityFilter").val("");
        $("#colorFilter").val("");
        $("#batchSearch").val("");
        renderFilters();
        renderTable();
        setTimeout(function () { btn.removeClass("spinning"); }, 800);
        Swal.fire({
            icon: "success",
            title: "Refreshed",
            text: "Batch list reloaded successfully.",
            timer: 1200,
            showConfirmButton: false
        });
    });

    // --------------------------------------------------
    // SAVE BATCH
    // --------------------------------------------------

    $("#batchForm").on("submit", function (event) {
        event.preventDefault();

        const designNumber = $("#designNumber").val().trim();
        const quantity = Number($("#quantityInput").val());
        const priority = $("#prioritySelect").val();
        const editId = $("#editBatchId").val();

        if (!selectedBom) {
            showFormMessage("warning", "Please select a valid design number from BOM Master.");
            return;
        }

        // 🔴 DUPLICATE DESIGN NUMBER CHECK (only for new batch)
        if (!editId && isDesignUsedInBatch(designNumber)) {
            showFormMessage(
                "danger",
                `Design Number <b>${escapeHtml(designNumber)}</b> is already used in another batch. Please select a different design number.`
            );
            return;
        }

        const pieces = getPieces(selectedBom);
        if (!pieces.length) {
            showFormMessage("warning", "No pieces found for this BOM design.");
            return;
        }

        if (!quantity || quantity < 1) {
            showFormMessage("warning", "Please enter a valid quantity.");
            return;
        }

        if (!priority) {
            showFormMessage("warning", "Please select priority.");
            return;
        }

        const oldBatch = editId
            ? batchData.find(batch => String(batch.id) === String(editId))
            : null;

        const batchRecord = {
            id: editId ? Number(editId) : getNextNumericId(),
            batchId: oldBatch ? oldBatch.batchId : getNextBatchId(),
            bomId: selectedBom.id || selectedBom.bomId || "",
            brand: getBrand(selectedBom),
            designNumber: designNumber,
            color: getColor(selectedBom),
            photo: getPhoto(selectedBom),
            quantity: quantity,
            priority: priority,
            status: oldBatch ? oldBatch.status : "pending",
            // Preserve passedAt when editing an already-approved batch
            passedAt: oldBatch ? (oldBatch.passedAt || "") : "",
            pieces: pieces.map((piece, index) => ({
                number: getPieceNumber(piece, index),
                item: getPieceItem(piece),
                materials: getMaterials(piece),
                additionalWorks: getAdditionalWorks(piece)
            }))
        };

        if (editId) {
            const index = batchData.findIndex(batch => String(batch.id) === String(editId));
            if (index === -1) return;
            batchData[index] = batchRecord;
        } else {
            batchData.push(batchRecord);
        }

        if (!saveStorage(BATCH_STORAGE_KEY, batchData)) return;

        batchModal.hide();
        renderFilters();
        renderTable();

        Swal.fire({
            icon: "success",
            title: editId ? "Batch Updated" : "Batch Created",
            text: `${batchRecord.batchId} saved successfully.`,
            timer: 1800,
            showConfirmButton: false
        });
    });

    // --------------------------------------------------
    // TABLE
    // --------------------------------------------------

    function renderTable() {
        const tbody = $("#batchTableBody");
        tbody.empty();

        const brandFilter = normalize($("#brandFilter").val());
        const priorityFilter = normalize($("#priorityFilter").val());
        const colorFilter = normalize($("#colorFilter").val());
        const searchTerm = normalize($("#batchSearch").val());

        const filteredBatches = batchData.filter(batch => {
            const searchableText = [
                batch.batchId, batch.brand, batch.designNumber, batch.color,
                batch.quantity, batch.priority,
                ...(batch.pieces || []).map(piece => [
                    piece.item,
                    ...(piece.materials || []),
                    ...(piece.additionalWorks || []).map(work => `${work.workType} ${work.stage}`)
                ].join(" "))
            ].join(" ");

            return (
                (!brandFilter || normalize(batch.brand) === brandFilter) &&
                (!priorityFilter || normalize(batch.priority) === priorityFilter) &&
                (!colorFilter || normalize(batch.color) === colorFilter) &&
                (!searchTerm || normalize(searchableText).includes(searchTerm))
            );
        });

        if (!filteredBatches.length) {
            tbody.html(`<tr><td colspan="8" class="text-center text-muted py-4"><i class="bx bx-info-circle me-1"></i> No batch found.</td></tr>`);
            return;
        }

        filteredBatches.forEach(batch => {
            const photo = batch.photo || "assets/images/default.jpg";
            const priorityClass = getPriorityClass(batch.priority);
            const isApproved = batch.status === "approved";

            let actionHtml = "";

            if (isApproved) {
                // After Pass → show only Passed Date + Time chip
                const passed = formatPassedDateTime(batch.passedAt);

                actionHtml = `
                    <div class="passed-chip" title="Approved on ${escapeHtml(passed.date)} at ${escapeHtml(passed.time)}">
                        <span class="passed-line">
                            <i class="bx bx-check-circle"></i>
                            Passed: ${escapeHtml(passed.date)}
                        </span>
                        <span class="passed-time">${escapeHtml(passed.time)}</span>
                    </div>
                `;
            } else {
                actionHtml = `
                    <div class="d-flex gap-1 flex-wrap">
                        <button type="button" class="btn btn-sm btn-primary view-batch-btn" data-id="${escapeHtml(batch.id)}" title="View"><i class="bx bx-show"></i></button>
                        <button type="button" class="btn btn-sm btn-primary edit-batch-btn" data-id="${escapeHtml(batch.id)}" title="Edit"><i class="bx bx-edit"></i></button>
                        <button type="button" class="btn btn-sm btn-success pass-batch-btn" data-id="${escapeHtml(batch.id)}" title="Pass"><i class="bx bx-right-arrow-alt"></i></button>
                        <button type="button" class="btn btn-sm btn-danger delete-batch-btn" data-id="${escapeHtml(batch.id)}" title="Delete"><i class="bx bx-trash"></i></button>
                    </div>
                `;
            }

            tbody.append(`
                <tr>
                    <td><strong>${escapeHtml(batch.batchId)}</strong></td>
                    <td><img src="${escapeHtml(photo)}" alt="Photo" class="batch-table-photo view-photo-btn" data-photo="${escapeHtml(photo)}" title="Click to view"></td>
                    <td>${escapeHtml(batch.brand || "-")}</td>
                    <td>${escapeHtml(batch.designNumber || "-")}</td>
                    <td><span class="color-text">${escapeHtml(batch.color || "-")}</span></td>
                    <td>${escapeHtml(batch.quantity || "0")}</td>
                    <td><span class="priority-badge ${priorityClass}">${escapeHtml(batch.priority || "-")}</span></td>
                    <td>${actionHtml}</td>
                </tr>
            `);
        });
    }

    // --------------------------------------------------
    // PHOTO ZOOM
    // --------------------------------------------------

    $(document).on("click", ".view-photo-btn", function () {
        const photo = $(this).data("photo");
        if (!photo) return;
        $("#photoZoomImg").attr("src", photo);
        photoZoomModal.show();
    });

    // --------------------------------------------------
    // EDIT BATCH
    // --------------------------------------------------

    $(document).on("click", ".edit-batch-btn", function () {
        const id = Number($(this).data("id"));
        const batch = batchData.find(item => Number(item.id) === id);
        if (!batch) return;

        $("#batchModalLabel").text("Edit Batch");
        $("#editBatchId").val(batch.id);
        $("#batchIdPreview").val(batch.batchId);
        $("#designNumber").val(batch.designNumber);
        $("#quantityInput").val(batch.quantity);
        $("#prioritySelect").val(batch.priority);

        fillDesignData();
        batchModal.show();
    });

    // --------------------------------------------------
    // PASS (APPROVE) BATCH
    // --------------------------------------------------

    $(document).on("click", ".pass-batch-btn", function () {
        const id = Number($(this).data("id"));
        const batch = batchData.find(item => Number(item.id) === id);
        if (!batch) return;

        if (batch.status === "approved") {
            Swal.fire({
                icon: "info",
                title: "Already Approved",
                text: `${batch.batchId} is already approved.`,
                timer: 1500,
                showConfirmButton: false
            });
            return;
        }

        Swal.fire({
            title: "Approve Batch?",
            text: `${batch.batchId} will be moved to Batch Approval.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Yes, Pass",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#198754"
        }).then(function (result) {
            if (!result.isConfirmed) return;

            // Mark approved + record current date/time
            batch.status = "approved";
            batch.passedAt = new Date().toISOString();

            let approvedBatches = readStorage(APPROVED_BATCH_STORAGE_KEY);
            const alreadyApproved = approvedBatches.some(item => Number(item.id) === id);

            if (alreadyApproved) {
                const idx = approvedBatches.findIndex(item => Number(item.id) === id);
                approvedBatches[idx] = { ...batch };
            } else {
                approvedBatches.push({ ...batch });
            }

            if (!saveStorage(APPROVED_BATCH_STORAGE_KEY, approvedBatches)) return;
            if (!saveStorage(BATCH_STORAGE_KEY, batchData)) return;

            renderTable();

            Swal.fire({
                icon: "success",
                title: "Batch Approved",
                text: `${batch.batchId} has been sent to Batch Approval.`,
                timer: 1800,
                showConfirmButton: false
            });
        });
    });

    // --------------------------------------------------
    // DELETE BATCH
    // --------------------------------------------------

    $(document).on("click", ".delete-batch-btn", function () {
        const id = Number($(this).data("id"));
        const batch = batchData.find(item => Number(item.id) === id);
        if (!batch) return;

        Swal.fire({
            title: "Delete Batch?",
            text: `${batch.batchId} will be deleted. Design number will become available again.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, Delete",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#dc3545"
        }).then(function (result) {
            if (!result.isConfirmed) return;

            batchData = batchData.filter(item => Number(item.id) !== id);
            if (!saveStorage(BATCH_STORAGE_KEY, batchData)) return;

            renderFilters();
            renderTable();

            Swal.fire({
                icon: "success",
                title: "Deleted",
                text: "Batch deleted. Design number is now available again.",
                timer: 1500,
                showConfirmButton: false
            });
        });
    });

    // --------------------------------------------------
    // VIEW BATCH
    // --------------------------------------------------

    $(document).on("click", ".view-batch-btn", function () {
        const id = Number($(this).data("id"));
        const batch = batchData.find(item => Number(item.id) === id);
        if (!batch) return;

        $("#viewBatchId").text(batch.batchId || "-");
        $("#viewBatchBrand").text(batch.brand || "-");
        $("#viewBatchDesign").text(batch.designNumber || "-");
        $("#viewBatchColor").text(batch.color || "-");
        $("#viewBatchQuantity").text(batch.quantity || "-");
        $("#viewBatchPriority").text(batch.priority || "-");

        viewBatchModal.show();
    });

    // --------------------------------------------------
    // FILTERS
    // --------------------------------------------------

    $("#brandFilter, #priorityFilter, #colorFilter").on("change", renderTable);
    $("#batchSearch").on("keyup", renderTable);

    $("#batchModal").on("hidden.bs.modal", function () {
        resetForm();
    });

    // --------------------------------------------------
    // INITIAL LOAD
    // --------------------------------------------------

    loadData();
    renderFilters();
    renderTable();
});