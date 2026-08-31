$(document).ready(function() {
    // Initial data with Batch IDs
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
            photo: 'assets/images/batch1.jpg'
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
            photo: 'assets/images/batch2.jpg'
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
            photo: 'assets/images/batch3.jpg'
        }
    ];

    let nextId = 4;

    // Initialize
    renderTable();

    // Function to generate Batch ID
    function generateBatchId() {
        const prefix = 'BATCH';
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        return `${prefix}-${year}${month}${day}-${random}`;
    }

    // Function to render table
    function renderTable() {
        const tbody = $('#batchTableBody');
        tbody.empty();

        // Apply filters
        const brandFilter = $('#brandFilter').val();
        const priorityFilter = $('#priorityFilter').val();
        const colorFilter = $('#colorFilter').val();
        const searchTerm = $('#searchInput').val().toLowerCase();

        let filteredData = batchData;

        if (brandFilter) {
            filteredData = filteredData.filter(b => b.brand === brandFilter);
        }

        if (priorityFilter) {
            filteredData = filteredData.filter(b => b.priority === priorityFilter);
        }

        if (colorFilter) {
            filteredData = filteredData.filter(b => b.color === colorFilter);
        }

        if (searchTerm) {
            filteredData = filteredData.filter(b => 
                b.batchId.toLowerCase().includes(searchTerm) ||
                b.brand.toLowerCase().includes(searchTerm) ||
                b.designNumber.toLowerCase().includes(searchTerm) ||
                b.color.toLowerCase().includes(searchTerm)
            );
        }

        if (filteredData.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="9" class="text-center text-muted py-4">
                        <i class="bx bx-info-circle me-2"></i>No batches found.
                    </td>
                </tr>
            `);
            return;
        }

        filteredData.forEach((batch) => {
            const priorityClass = batch.priority === 'High' ? 'text-danger' : 
                                 batch.priority === 'Medium' ? 'text-warning' : 'text-secondary';
            
            tbody.append(`
                <tr>
                    <td>
                        <span class="fw-semibold">${batch.batchId}</span>
                    </td>
                    <td>
                        <img src="${batch.photo || 'assets/images/default.jpg'}" alt="Batch" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">
                    </td>
                    <td><strong>${batch.brand}</strong></td>
                    <td><strong>${batch.designNumber}</strong></td>
                    <td>${batch.color}</td>
                    <td>${batch.quantity}</td>
                    <td><span class="${priorityClass} fw-semibold">${batch.priority}</span></td>
                    <td>${batch.createdAt}</td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-btn" 
                            data-id="${batch.id}" 
                            title="Edit">
                            <i class="bx bx-edit"></i> Edit
                        </button>
                    </td>
                </tr>
            `);
        });
    }

    // Reset form
    function resetForm() {
        $('#batchForm')[0].reset();
        $('#editId').val('');
        $('#photoPreview').empty();
        $('#batchModalLabel').text('Create Batch');
        // Set default priority to Medium
        $('#prioritySelect').val('Medium');
        // Set default brand
        $('#brandSelect').val('');
        // Set default color
        $('#colorSelect').val('');
    }

    // Show add modal
    $('#createBatchBtn').click(function() {
        resetForm();
        $('#batchModal').modal('show');
    });

    // Save (Add/Edit)
    $('#saveBatchBtn').click(function() {
        const editId = $('#editId').val();
        const brand = $('#brandSelect').val();
        const designNumber = $('#designNumber').val().trim();
        const color = $('#colorSelect').val();
        const quantity = parseInt($('#quantity').val());
        const priority = $('#prioritySelect').val();

        if (!brand || !designNumber || !color || !quantity || !priority) {
            Swal.fire({
                icon: 'warning',
                title: 'Incomplete Form',
                text: 'Please fill all fields.',
                confirmButtonColor: '#3085d6',
                confirmButtonText: 'OK'
            });
            return;
        }

        // Handle photo (simulated)
        const photo = 'assets/images/batch' + (editId || Date.now()) + '.jpg';

        if (editId) {
            // Edit existing
            const index = batchData.findIndex(b => b.id === parseInt(editId));
            if (index !== -1) {
                batchData[index] = {
                    ...batchData[index],
                    brand: brand,
                    designNumber: designNumber,
                    color: color,
                    quantity: quantity,
                    priority: priority,
                    photo: photo
                };
            }
            Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: 'Batch updated successfully!',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            // Add new
            const newBatch = {
                id: nextId++,
                batchId: generateBatchId(),
                brand: brand,
                designNumber: designNumber,
                color: color,
                quantity: quantity,
                priority: priority,
                createdAt: new Date().toLocaleDateString(),
                photo: photo
            };
            batchData.push(newBatch);
            Swal.fire({
                icon: 'success',
                title: 'Created!',
                text: `Batch ${newBatch.batchId} created successfully!`,
                timer: 2000,
                showConfirmButton: false
            });
        }

        renderTable();
        $('#batchModal').modal('hide');
    });

    // Edit button click - using .edit-btn class
    $(document).on('click', '.edit-btn', function() {
        const id = parseInt($(this).data('id'));
        const batch = batchData.find(b => b.id === id);
        
        if (!batch) return;

        $('#editId').val(batch.id);
        $('#brandSelect').val(batch.brand);
        $('#designNumber').val(batch.designNumber);
        $('#colorSelect').val(batch.color);
        $('#quantity').val(batch.quantity);
        $('#prioritySelect').val(batch.priority);
        $('#batchModalLabel').text('Edit Batch');
        
        if (batch.photo) {
            $('#photoPreview').html(`<img src="${batch.photo}" style="max-width: 150px; border-radius: 5px; border: 1px solid #ddd;">`);
        }
        
        $('#batchModal').modal('show');
    });

    // Filter events
    $('#brandFilter, #priorityFilter, #colorFilter, #searchInput').on('change keyup', function() {
        renderTable();
    });

    // Modal close handlers
    $('#batchModal').on('hidden.bs.modal', function() {
        resetForm();
    });

    // Initial render
    renderTable();
});