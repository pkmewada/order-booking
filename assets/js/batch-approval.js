$(document).ready(function () {
    "use strict";

    const BATCH_STORAGE_KEY = "batchData";
    const REQUIREMENT_STORAGE_KEY = "requirementData";

    let batchData = [];
    let currentBatchId = null;

    const approvalModalElement = document.getElementById("approvalModal");
    const approvalModal = new bootstrap.Modal(approvalModalElement);

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function readStorage(key) {
        try {
            const value = localStorage.getItem(key);

            if (!value) {
                return [];
            }

            const parsed = JSON.parse(value);

            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error("Storage error:", error);
            return [];
        }
    }

    function saveStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function normalize(value) {
        return String(value ?? "").trim().toLowerCase();
    }

    function getStatusBadge(status) {
        const statuses = {
            pending: {
                label: "Pending",
                className: "bg-warning text-dark"
            },
            approved: {
                label: "Approved",
                className: "bg-success"
            },
            missing: {
                label: "Missing Item",
                className: "bg-danger"
            }
        };

        const statusData = statuses[status] || statuses.pending;

        return `
            <span class="badge ${statusData.className}">
                ${statusData.label}
            </span>
        `;
    }

    function showMessage(type, message) {
        $("#approvalMessage")
            .removeClass("alert-success alert-warning alert-danger")
            .addClass(`alert-${type}`)
            .html(message)
            .show();
    }

    /*
    |--------------------------------------------------------------------------
    | Load Data
    |--------------------------------------------------------------------------
    */

    function loadData() {
        batchData = readStorage(BATCH_STORAGE_KEY);
    }

    /*
    |--------------------------------------------------------------------------
    | Render Table
    |--------------------------------------------------------------------------
    */

    function renderTable() {
        const tbody = $("#approvalTableBody");

        tbody.empty();

        const statusFilter = normalize($("#approvalStatusFilter").val());
        const searchTerm = normalize($("#approvalSearchInput").val());

        let filteredBatches = batchData.filter(batch => {
            const searchText = [
                batch.batchId,
                batch.brand,
                batch.designNumber,
                batch.color,
                batch.piece
            ]
                .filter(Boolean)
                .join(" ");

            return (
                (!statusFilter ||
                    normalize(batch.status || "pending") === statusFilter) &&
                (!searchTerm ||
                    normalize(searchText).includes(searchTerm))
            );
        });

        if (!filteredBatches.length) {
            tbody.html(`
                <tr>
                    <td colspan="11" class="text-center text-muted py-4">
                        <i class="bx bx-info-circle me-1"></i>
                        No batches found.
                    </td>
                </tr>
            `);

            return;
        }

        filteredBatches.forEach(batch => {
            const itemList = Array.isArray(batch.itemList)
                ? batch.itemList
                : [];

            const itemAvailability = batch.itemAvailability || {};

            const availableItems = itemList.filter(item => {
                return itemAvailability[item] === "yes";
            });

            const missingItems = Array.isArray(batch.missingItems)
                ? batch.missingItems
                : [];

            const availableHtml = availableItems.length
                ? availableItems.map(item => `
                    <span class="badge bg-success me-1 mb-1">
                        ${escapeHtml(item)}
                    </span>
                `).join("")
                : `<span class="text-muted">-</span>`;

            const missingHtml = missingItems.length
                ? missingItems.map(item => `
                    <span class="badge bg-danger me-1 mb-1">
                        ${escapeHtml(item)}
                    </span>
                `).join("")
                : `<span class="text-muted">-</span>`;

            tbody.append(`
                <tr>
                    <td>
                        <strong>
                            ${escapeHtml(batch.batchId || "-")}
                        </strong>
                    </td>

                    <td>
                        <img
                            src="${escapeHtml(batch.photo || "assets/images/default.jpg")}"
                            alt="Batch"
                            style="
                                width:55px;
                                height:55px;
                                object-fit:cover;
                                border-radius:6px;
                            "
                            onerror="this.src='assets/images/default.jpg';"
                        >
                    </td>

                    <td>
                        ${escapeHtml(batch.brand || "-")}
                    </td>

                    <td>
                        ${escapeHtml(batch.designNumber || "-")}
                    </td>

                    <td>
                        ${escapeHtml(batch.piece || "-")}
                    </td>

                    <td>
                        ${escapeHtml(batch.quantity || "0")}
                    </td>

                    <td>
                        ${escapeHtml(batch.priority || "-")}
                    </td>

                    <td style="white-space:normal; min-width:170px;">
                        ${availableHtml}
                    </td>

                    <td style="white-space:normal; min-width:170px;">
                        ${missingHtml}
                    </td>

                    <td>
                        ${getStatusBadge(batch.status || "pending")}
                    </td>

                    <td>
                        <button
                            type="button"
                            class="btn btn-sm btn-primary open-approval-btn"
                            data-id="${escapeHtml(batch.id)}"
                        >
                            <i class="bx bx-show me-1"></i>
                            View
                        </button>
                    </td>
                </tr>
            `);
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Get Current Batch
    |--------------------------------------------------------------------------
    */

    function getCurrentBatch() {
        return batchData.find(batch => {
            return String(batch.id) === String(currentBatchId);
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Render Item Availability
    |--------------------------------------------------------------------------
    */

    function renderItemAvailability(batch) {
        const container = $("#approvalItemList");

        container.empty();

        const items = Array.isArray(batch.itemList)
            ? batch.itemList
            : [];

        if (!items.length) {
            container.html(`
                <div class="alert alert-warning mb-0">
                    No item list found for this batch.
                </div>
            `);

            return;
        }

        const itemAvailability = batch.itemAvailability || {};

        items.forEach((item, index) => {
            const currentValue = itemAvailability[item] || "";

            const yesId = `available_yes_${index}`;
            const noId = `available_no_${index}`;

            container.append(`
                <div class="border-bottom pb-3 mb-3">
                    <div class="row align-items-center g-2">

                        <div class="col-md-7">
                            <strong>
                                ${escapeHtml(item)}
                            </strong>
                        </div>

                        <div class="col-md-5">
                            <div class="d-flex gap-3">

                                <div class="form-check">
                                    <input
                                        class="form-check-input item-availability-radio"
                                        type="radio"
                                        name="availability_${index}"
                                        id="${yesId}"
                                        value="yes"
                                        data-item="${escapeHtml(item)}"
                                        ${currentValue === "yes" ? "checked" : ""}
                                    >

                                    <label
                                        class="form-check-label text-success"
                                        for="${yesId}"
                                    >
                                        Yes
                                    </label>
                                </div>

                                <div class="form-check">
                                    <input
                                        class="form-check-input item-availability-radio"
                                        type="radio"
                                        name="availability_${index}"
                                        id="${noId}"
                                        value="no"
                                        data-item="${escapeHtml(item)}"
                                        ${currentValue === "no" ? "checked" : ""}
                                    >

                                    <label
                                        class="form-check-label text-danger"
                                        for="${noId}"
                                    >
                                        No
                                    </label>
                                </div>

                            </div>
                        </div>

                    </div>
                </div>
            `);
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Get Availability Data
    |--------------------------------------------------------------------------
    */

    function getAvailabilityFromModal() {
        const availability = {};

        $(".item-availability-radio:checked").each(function () {
            const item = $(this).data("item");
            const value = $(this).val();

            availability[item] = value;
        });

        return availability;
    }

    function getMissingItems(availability, itemList) {
        return itemList.filter(item => {
            return availability[item] === "no";
        });
    }

    function getUnavailableOrUnselectedItems(availability, itemList) {
        return itemList.filter(item => {
            return availability[item] !== "yes";
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Open Approval Modal
    |--------------------------------------------------------------------------
    */

    function openApprovalModal(batchId) {
        currentBatchId = batchId;

        const batch = getCurrentBatch();

        if (!batch) {
            return;
        }

        $("#approvalPhoto").attr(
            "src",
            batch.photo || "assets/images/default.jpg"
        );

        $("#approvalBatchId").text(batch.batchId || "-");
        $("#approvalBrand").text(batch.brand || "-");
        $("#approvalDesignNumber").text(batch.designNumber || "-");
        $("#approvalColor").text(batch.color || "-");
        $("#approvalPiece").text(batch.piece || "-");
        $("#approvalQuantity").text(batch.quantity || "-");
        $("#approvalPriority").text(batch.priority || "-");

        $("#approvalRemarks").val(batch.approvalRemarks || "");

        $("#approvalMessage")
            .hide()
            .removeClass("alert-success alert-warning alert-danger")
            .html("");

        renderItemAvailability(batch);

        const isApproved = batch.status === "approved";

        $("#approveAvailableBtn").prop("disabled", isApproved);
        $("#approveMissingBtn").prop("disabled", isApproved);

        if (isApproved) {
            showMessage(
                "success",
                "This batch has already been approved."
            );
        }

        approvalModal.show();
    }

    /*
    |--------------------------------------------------------------------------
    | Save Approval
    |--------------------------------------------------------------------------
    */

    function saveApproval(newStatus) {
        const batch = getCurrentBatch();

        if (!batch) {
            return null;
        }

        const itemList = Array.isArray(batch.itemList)
            ? batch.itemList
            : [];

        const availability = getAvailabilityFromModal();
        const remarks = $("#approvalRemarks").val().trim();

        const missingItems = getMissingItems(
            availability,
            itemList
        );

        const incompleteItems = getUnavailableOrUnselectedItems(
            availability,
            itemList
        );

        if (itemList.length && incompleteItems.length) {
            showMessage(
                "warning",
                "Please select Yes or No for every item."
            );

            return null;
        }

        if (newStatus === "approved" && missingItems.length) {
            showMessage(
                "warning",
                "Some items are marked No. Use Approve Missing Item."
            );

            return null;
        }

        if (newStatus === "missing" && !missingItems.length) {
            showMessage(
                "warning",
                "Please mark at least one item as No."
            );

            return null;
        }

        const index = batchData.findIndex(item => {
            return String(item.id) === String(currentBatchId);
        });

        if (index === -1) {
            return null;
        }

        batchData[index] = {
            ...batchData[index],
            status: newStatus,
            itemAvailability: availability,
            missingItems,
            approvalRemarks: remarks,
            approvedAt: newStatus === "approved"
                ? new Date().toLocaleString("en-GB")
                : batchData[index].approvedAt || "",
            missingMarkedAt: newStatus === "missing"
                ? new Date().toLocaleString("en-GB")
                : batchData[index].missingMarkedAt || "",
            updatedAt: new Date().toLocaleString("en-GB")
        };

        saveStorage(BATCH_STORAGE_KEY, batchData);

        return batchData[index];
    }

    /*
    |--------------------------------------------------------------------------
    | Create Requirement
    |--------------------------------------------------------------------------
    */

    function createRequirement(batch) {
        const requirementData = readStorage(
            REQUIREMENT_STORAGE_KEY
        );

        const existingRequirement = requirementData.find(requirement => {
            return (
                String(requirement.batchId) === String(batch.batchId) &&
                requirement.status !== "completed"
            );
        });

        if (existingRequirement) {
            return existingRequirement;
        }

        const nextId = requirementData.length
            ? Math.max(
                ...requirementData.map(item => Number(item.id) || 0)
            ) + 1
            : 1;

        const requirement = {
            id: nextId,
            requirementId: `REQ-${String(nextId).padStart(3, "0")}`,
            batchId: batch.batchId,
            bomId: batch.bomId || "",
            brand: batch.brand || "",
            designNumber: batch.designNumber || "",
            color: batch.color || "",
            piece: batch.piece || "",
            quantity: batch.quantity || 0,
            priority: batch.priority || "Medium",
            photo: batch.photo || "",
            missingItems: Array.isArray(batch.missingItems)
                ? [...batch.missingItems]
                : [],
            itemAvailability: batch.itemAvailability || {},
            remarks: batch.approvalRemarks || "",
            status: "pending",
            createdAt: new Date().toLocaleString("en-GB")
        };

        requirementData.push(requirement);

        saveStorage(
            REQUIREMENT_STORAGE_KEY,
            requirementData
        );

        return requirement;
    }

    /*
    |--------------------------------------------------------------------------
    | View Button
    |--------------------------------------------------------------------------
    */

    $(document).on("click", ".open-approval-btn", function () {
        const id = $(this).data("id");

        openApprovalModal(id);
    });

    /*
    |--------------------------------------------------------------------------
    | All Yes
    |--------------------------------------------------------------------------
    */

    $("#allItemsYesBtn").on("click", function () {
        $(".item-availability-radio[value='yes']").prop(
            "checked",
            true
        );
    });

    /*
    |--------------------------------------------------------------------------
    | All No
    |--------------------------------------------------------------------------
    */

    $("#allItemsNoBtn").on("click", function () {
        $(".item-availability-radio[value='no']").prop(
            "checked",
            true
        );
    });

    /*
    |--------------------------------------------------------------------------
    | Approve All Available
    |--------------------------------------------------------------------------
    */

    $("#approveAvailableBtn").on("click", function () {
        const batch = getCurrentBatch();

        if (!batch) {
            return;
        }

        const itemList = Array.isArray(batch.itemList)
            ? batch.itemList
            : [];

        const availability = getAvailabilityFromModal();
        const incompleteItems = getUnavailableOrUnselectedItems(
            availability,
            itemList
        );

        if (incompleteItems.length) {
            showMessage(
                "warning",
                "Every item must be marked Yes before approval."
            );

            return;
        }

        const missingItems = getMissingItems(
            availability,
            itemList
        );

        if (missingItems.length) {
            showMessage(
                "warning",
                "Some items are missing. Use Approve Missing Item."
            );

            return;
        }

        Swal.fire({
            title: "Approve Batch?",
            text: `${batch.batchId} has all items available.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Yes, Approve",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#198754"
        }).then(function (result) {
            if (!result.isConfirmed) {
                return;
            }

            const savedBatch = saveApproval("approved");

            if (!savedBatch) {
                return;
            }

            approvalModal.hide();
            renderTable();

            Swal.fire({
                icon: "success",
                title: "Approved",
                text: `${batch.batchId} approved successfully.`,
                timer: 1800,
                showConfirmButton: false
            });
        });
    });

    /*
    |--------------------------------------------------------------------------
    | Approve Missing Item
    |--------------------------------------------------------------------------
    */

    $("#approveMissingBtn").on("click", function () {
        const batch = getCurrentBatch();

        if (!batch) {
            return;
        }

        const itemList = Array.isArray(batch.itemList)
            ? batch.itemList
            : [];

        const availability = getAvailabilityFromModal();

        const incompleteItems = getUnavailableOrUnselectedItems(
            availability,
            itemList
        );

        if (incompleteItems.length) {
            showMessage(
                "warning",
                "Please select Yes or No for every item."
            );

            return;
        }

        const missingItems = getMissingItems(
            availability,
            itemList
        );

        if (!missingItems.length) {
            showMessage(
                "warning",
                "No missing item selected."
            );

            return;
        }

        Swal.fire({
            title: "Approve Missing Item?",
            html: `
                <div class="text-start">
                    <p>
                        <strong>Batch:</strong>
                        ${escapeHtml(batch.batchId)}
                    </p>

                    <p>
                        <strong>Missing Items:</strong>
                    </p>

                    <ul>
                        ${missingItems.map(item => `
                            <li>${escapeHtml(item)}</li>
                        `).join("")}
                    </ul>

                    <p class="mb-0">
                        These items will be added to Requirements.
                    </p>
                </div>
            `,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Create Requirement",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#dc3545"
        }).then(function (result) {
            if (!result.isConfirmed) {
                return;
            }

            const savedBatch = saveApproval("missing");

            if (!savedBatch) {
                return;
            }

            const requirement = createRequirement(savedBatch);

            if (!requirement) {
                Swal.fire({
                    icon: "error",
                    title: "Error",
                    text: "Requirement could not be created."
                });

                return;
            }

            approvalModal.hide();
            renderTable();

            Swal.fire({
                icon: "success",
                title: "Requirement Created",
                text: "Missing item requirement saved successfully.",
                showCancelButton: true,
                confirmButtonText: "Open Requirement",
                cancelButtonText: "Close"
            }).then(function (nextResult) {
                if (nextResult.isConfirmed) {
                    window.location.href = "requirment.php";
                }
            });
        });
    });

    /*
    |--------------------------------------------------------------------------
    | Filters
    |--------------------------------------------------------------------------
    */

    $("#approvalStatusFilter").on("change", renderTable);

    $("#approvalSearchInput").on("keyup", renderTable);

    /*
    |--------------------------------------------------------------------------
    | Refresh
    |--------------------------------------------------------------------------
    */

    $("#refreshApprovalBtn").on("click", function () {
        loadData();
        renderTable();

        Swal.fire({
            icon: "success",
            title: "Refreshed",
            text: "Batch data loaded from localStorage.",
            timer: 1200,
            showConfirmButton: false
        });
    });

    /*
    |--------------------------------------------------------------------------
    | Modal Reset
    |--------------------------------------------------------------------------
    */

    $("#approvalModal").on("hidden.bs.modal", function () {
        currentBatchId = null;

        $("#approvalItemList").empty();
        $("#approvalRemarks").val("");

        $("#approvalMessage")
            .hide()
            .removeClass("alert-success alert-warning alert-danger")
            .html("");
    });

    /*
    |--------------------------------------------------------------------------
    | Initial Load
    |--------------------------------------------------------------------------
    */

    loadData();
    renderTable();
});