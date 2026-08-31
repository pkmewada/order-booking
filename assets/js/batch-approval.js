$(document).ready(function() {
    // Initial batch data with approval status
    let batchData = [
        { 
            id: 1, 
            batchId: 'BATCH-001',
            brand: 'NIVI BLOSSOM',
            designNumber: 'D-1001', 
            color: 'Red', 
            quantity: 100, 
            priority: 'High',
            createdAt: new Date().toLocaleDateString(),
            status: 'pending',
            photo: 'assets/images/batch1.jpg',
            pieceType: '1 Piece',
            checks: [], // Store checked items
            remarks: '' // Store remarks
        },
        { 
            id: 2, 
            batchId: 'BATCH-002',
            brand: 'AMARI',
            designNumber: 'D-1002', 
            color: 'Blue', 
            quantity: 150, 
            priority: 'Medium',
            createdAt: new Date().toLocaleDateString(),
            status: 'pending',
            photo: 'assets/images/batch2.jpg',
            pieceType: '2 Piece',
            checks: ['check1', 'check2'], // Example: 2 checks saved
            remarks: 'Need to verify fabric quality' // Example remarks
        },
        { 
            id: 3, 
            batchId: 'BATCH-003',
            brand: 'LITTLE DOLLY',
            designNumber: 'D-1003', 
            color: 'Green', 
            quantity: 200, 
            priority: 'Low',
            createdAt: new Date().toLocaleDateString(),
            status: 'approved',
            photo: 'assets/images/batch3.jpg',
            pieceType: '1 Piece',
            checks: ['check1', 'check2', 'check3', 'check4'], // All 4 checks
            remarks: 'All checks completed successfully' // Example remarks
        },
        { 
            id: 4, 
            batchId: 'BATCH-004',
            brand: 'NIVI BLOSSOM',
            designNumber: 'D-1004', 
            color: 'Yellow', 
            quantity: 120, 
            priority: 'High',
            createdAt: new Date().toLocaleDateString(),
            status: 'pending',
            photo: 'assets/images/batch4.jpg',
            pieceType: '3 Piece',
            checks: ['check1'], // 1 check saved
            remarks: '' // Empty remarks
        },
        { 
            id: 5, 
            batchId: 'BATCH-005',
            brand: 'AMARI',
            designNumber: 'D-1005', 
            color: 'Black', 
            quantity: 200, 
            priority: 'Medium',
            createdAt: new Date().toLocaleDateString(),
            status: 'pending',
            photo: 'assets/images/batch5.jpg',
            pieceType: '2 Piece',
            checks: ['check1', 'check2', 'check3'], // 3 checks saved
            remarks: 'Waiting for additional fabric shipment' // Example remarks
        }
    ];

    let currentViewBatchId = null;

    // Initialize
    renderTable();

    // Function to get check labels
    function getCheckLabels(checkIds) {
        const checkMap = {
            'check1': 'Frame/Pattern Availability',
            'check2': 'Main Fabric Stock',
            'check3': 'Additional Fabric',
            'check4': 'Zip Stock'
        };
        return checkIds.map(id => checkMap[id] || id);
    }

    // Function to generate check status with blue tick
    function generateCheckStatus(checkIds) {
        const checkMap = {
            'check1': 'Frame/Pattern',
            'check2': 'Main Fabric',
            'check3': 'Additional Fabric',
            'check4': 'Zip Stock'
        };
        
        const allChecks = ['check1', 'check2', 'check3', 'check4'];
        let html = '<div style="font-size: 12px; line-height: 1.8;">';
        
        allChecks.forEach(checkId => {
            const isChecked = checkIds.includes(checkId);
            const label = checkMap[checkId] || checkId;
            if (isChecked) {
                html += `<div><span style="color: #0d6efd; font-weight: bold;">✓</span> <strong>${label}</strong></div>`;
            } else {
                html += `<div><span style="color: #dc3545;">✗</span> ${label}</div>`;
            }
        });
        
        html += '</div>';
        return html;
    }

    // Function to render table
    function renderTable() {
        const tbody = $('#batchTableBody');
        tbody.empty();

        // Get filter values
        const statusFilter = $('#statusFilter').val();
        const searchTerm = $('#searchInput').val().toLowerCase();

        // Apply filters
        let filteredData = batchData;

        if (statusFilter) {
            filteredData = filteredData.filter(b => b.status === statusFilter);
        }

        if (searchTerm) {
            filteredData = filteredData.filter(b => 
                b.batchId.toLowerCase().includes(searchTerm) ||
                b.brand.toLowerCase().includes(searchTerm) ||
                b.designNumber.toLowerCase().includes(searchTerm)
            );
        }

        if (filteredData.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="bx bx-info-circle me-2"></i>No batches found.
                    </td>
                </tr>
            `);
            return;
        }

        filteredData.forEach((batch) => {
            const statusColor = batch.status === 'approved' ? 'text-success' : 'text-warning';
            const statusText = batch.status === 'approved' ? 'Approved' : 'Pending';
            
            // Get check status
            const checkStatusHTML = generateCheckStatus(batch.checks);
            
            // Display remarks
            const remarksDisplay = batch.remarks && batch.remarks.trim() !== ''
                ? batch.remarks
                : '<span class="text-muted">No remarks</span>';
            
            tbody.append(`
                <tr>
                    <td>
                        <span class="fw-semibold">${batch.batchId}</span>
                    </td>
                    <td><strong>${batch.brand}</strong></td>
                    <td>
                        <img src="${batch.photo || 'assets/images/default.jpg'}" alt="Batch" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">
                    </td>
                    <td>
                        <span class="${statusColor} fw-semibold">${statusText}</span>
                    </td>
                    <td>
                        ${checkStatusHTML}
                    </td>
                    <td>
                        <small class="d-block text-truncate" style="max-width: 150px;" title="${batch.remarks || 'No remarks'}">
                            ${remarksDisplay}
                        </small>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-primary view-btn" data-id="${batch.id}" title="View Details">
                            <i class="bx bx-show"></i> View
                        </button>
                    </td>
                </tr>
            `);
        });
    }

    // Show view modal
    function showViewModal(batchId) {
        const batch = batchData.find(b => b.id === batchId);
        if (!batch) return;

        currentViewBatchId = batchId;

        // Set image
        $('#viewImage').attr('src', batch.photo || 'assets/images/default.jpg');
        
        // Set details
        $('#viewBatchId').text(batch.batchId);
        $('#viewBrand').text(batch.brand);
        $('#viewDesignNumber').text(batch.designNumber);
        $('#viewColor').text(batch.color);
        $('#viewQuantity').text(batch.quantity);
        $('#viewPriority').text(batch.priority);
        $('#viewCreatedDate').text(batch.createdAt);
        
        // Reset checklist
        $('.checklist-item').prop('checked', false);
        $('#statusMessage').hide();
        $('#actionButtons').show();

        // Set remarks
        $('#remarksInput').val(batch.remarks || '');

        // Set piece type radio based on batch data
        if (batch.pieceType === '1 Piece') {
            $('#pieceType1').prop('checked', true);
        } else if (batch.pieceType === '2 Piece') {
            $('#pieceType2').prop('checked', true);
        } else if (batch.pieceType === '3 Piece') {
            $('#pieceType3').prop('checked', true);
        } else {
            $('#pieceType1').prop('checked', true);
        }

        // Restore saved checks
        if (batch.checks && batch.checks.length > 0) {
            batch.checks.forEach(checkId => {
                $('#' + checkId).prop('checked', true);
            });
        }

        // Show buttons based on status
        if (batch.status === 'pending') {
            $('#approveBtn').show();
            $('#pendingBtn').show();
            $('#statusMessage').hide();
        } else if (batch.status === 'approved') {
            $('#approveBtn').hide();
            $('#pendingBtn').hide();
            $('#statusMessage').removeClass('alert-warning alert-danger').addClass('alert-success')
                .html(`<i class="bx bx-check-circle me-2"></i> This batch is already <strong>Approved</strong>.`)
                .show();
        }

        $('#viewModal').modal('show');
    }

    // Update batch status
    function updateBatchStatus(batchId, newStatus, pieceType, checks, remarks) {
        const batch = batchData.find(b => b.id === batchId);
        if (!batch) return false;

        batch.status = newStatus;
        if (pieceType) {
            batch.pieceType = pieceType;
        }
        if (checks) {
            batch.checks = checks;
        }
        if (remarks !== undefined) {
            batch.remarks = remarks;
        }
        renderTable();
        return true;
    }

    // Event Handlers

    // View button
    $(document).on('click', '.view-btn', function() {
        const id = parseInt($(this).data('id'));
        showViewModal(id);
    });

    // Approve from modal - REQUIRE ALL 4 CHECKS
    $('#approveBtn').click(function() {
        if (!currentViewBatchId) return;
        
        const batch = batchData.find(b => b.id === currentViewBatchId);
        if (!batch) return;

        // Get selected piece type
        const pieceType = $('input[name="pieceType"]:checked').val() || '1 Piece';

        // Get all checked items
        const checkedItems = [];
        $('.checklist-item:checked').each(function() {
            checkedItems.push($(this).attr('id'));
        });

        // Get remarks
        const remarks = $('#remarksInput').val().trim();

        // Check if ALL 4 checkboxes are checked
        const requiredChecks = ['check1', 'check2', 'check3', 'check4'];
        const allChecked = requiredChecks.every(checkId => checkedItems.includes(checkId));

        if (!allChecked) {
            $('#statusMessage').removeClass('alert-success alert-danger').addClass('alert-warning')
                .html('<i class="bx bx-info-circle me-2"></i> Please check ALL 4 quality checks before approving.')
                .show();
            return;
        }

        // Get checkbox labels
        const selectedLabels = [];
        $('.checklist-item:checked').each(function() {
            selectedLabels.push($(this).next('label').text());
        });

        Swal.fire({
            title: 'Approve Batch?',
            html: `
                <div class="text-start">
                    <p><strong>Batch:</strong> ${batch.batchId}</p>
                    <p><strong>Piece Type:</strong> ${pieceType}</p>
                    <p><strong>All 4 Checks Completed:</strong></p>
                    <ul class="mb-0">
                        ${selectedLabels.map(check => `<li>✅ ${check}</li>`).join('')}
                    </ul>
                    ${remarks ? `<p class="mt-2"><strong>Remarks:</strong> ${remarks}</p>` : ''}
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, Approve!',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                updateBatchStatus(currentViewBatchId, 'approved', pieceType, checkedItems, remarks);
                $('#viewModal').modal('hide');
                Swal.fire({
                    icon: 'success',
                    title: 'Approved!',
                    text: `Batch ${batch.batchId} approved with all 4 checks completed.`,
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        });
    });

    // Pending from modal - NO CHECKS REQUIRED
    $('#pendingBtn').click(function() {
        if (!currentViewBatchId) return;
        
        const batch = batchData.find(b => b.id === currentViewBatchId);
        if (!batch) return;

        // Get selected piece type
        const pieceType = $('input[name="pieceType"]:checked').val() || '1 Piece';

        // Get all checked items
        const checkedItems = [];
        $('.checklist-item:checked').each(function() {
            checkedItems.push($(this).attr('id'));
        });

        // Get remarks
        const remarks = $('#remarksInput').val().trim();

        // Get checkbox labels
        const selectedLabels = [];
        $('.checklist-item:checked').each(function() {
            selectedLabels.push($(this).next('label').text());
        });

        Swal.fire({
            title: 'Save as Pending?',
            html: `
                <div class="text-start">
                    <p><strong>Batch:</strong> ${batch.batchId}</p>
                    <p><strong>Piece Type:</strong> ${pieceType}</p>
                    <p><strong>Selected Checks (${checkedItems.length}/4):</strong></p>
                    <ul class="mb-0">
                        ${selectedLabels.length > 0 ? selectedLabels.map(check => `<li>${check}</li>`).join('') : '<li>No checks selected</li>'}
                    </ul>
                    ${remarks ? `<p class="mt-2"><strong>Remarks:</strong> ${remarks}</p>` : ''}
                    <p class="mt-2 text-muted">These selections will be saved when you reopen.</p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#ffc107',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, Save as Pending!',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                updateBatchStatus(currentViewBatchId, 'pending', pieceType, checkedItems, remarks);
                $('#viewModal').modal('hide');
                Swal.fire({
                    icon: 'info',
                    title: 'Pending!',
                    text: `Batch ${batch.batchId} saved as pending with ${checkedItems.length} checks.`,
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        });
    });

    // Filter events
    $('#statusFilter, #searchInput').on('change keyup', function() {
        renderTable();
    });

    // Modal close handler
    $('#viewModal').on('hidden.bs.modal', function() {
        currentViewBatchId = null;
        $('.checklist-item').prop('checked', false);
        $('#statusMessage').hide();
        $('#remarksInput').val('');
        // Reset to default
        $('#pieceType1').prop('checked', true);
    });

    // Initial render
    renderTable();
});