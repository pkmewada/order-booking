$(document).ready(function() {
    // Batch data
    let batchData = [
        { id: 1, batchId: 'BATCH-001', designNumber: 'D-1001', color: 'Red', quantity: 100 },
        { id: 2, batchId: 'BATCH-002', designNumber: 'D-1002', color: 'Blue', quantity: 150 },
        { id: 3, batchId: 'BATCH-003', designNumber: 'D-1003', color: 'Green', quantity: 200 }
    ];

    // Stitching data with Batch ID
    let stitchingData = {
        inhouse: [
            { id: 1, batchId: 'BATCH-001', name: 'Ali Ahmed', quantity: 100 },
            { id: 2, batchId: 'BATCH-001', name: 'Usman Malik', quantity: 150 }
        ],
        outsource: [
            { id: 3, batchId: 'BATCH-002', company: 'Fashion Stitch Pvt Ltd', quantity: 200 },
            { id: 4, batchId: 'BATCH-002', company: 'Quality Garments', quantity: 250 }
        ]
    };

    let nextId = 5;

    // Initialize
    populateBatchSelect();
    renderAll();

    // Populate batch select
    function populateBatchSelect() {
        const select = $('#batchSelect');
        select.empty();
        select.append('<option value="">Select Batch</option>');
        
        batchData.forEach(batch => {
            select.append(`<option value="${batch.batchId}">${batch.batchId} - ${batch.designNumber} (${batch.color})</option>`);
        });
    }

    // Function to render all tables
    function renderAll() {
        renderInHouse();
        renderOutSource();
        updateCounts();
    }

    // Render In-House Table
    function renderInHouse() {
        const tbody = $('#inHouseList');
        tbody.empty();

        if (stitchingData.inhouse.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="5" class="text-center text-muted">
                        <i class="bx bx-info-circle me-2"></i>No in-house workers found.
                    </td>
                </tr>
            `);
            return;
        }

        stitchingData.inhouse.forEach((worker, index) => {
            tbody.append(`
                <tr>
                    <td>${index + 1}</td>
                    <td><span class="btn btn-outline-primary btn-wave btn-sm">${worker.batchId}</span></td>
                    <td><strong>${worker.name}</strong></td>
                    <td><span class="badge bg-info">${worker.quantity}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-btn" data-id="${worker.id}" data-type="inhouse" title="Edit">
                            <i class="bx bx-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-btn" data-id="${worker.id}" data-type="inhouse" title="Delete">
                            <i class="bx bx-trash"></i>
                        </button>
                    </td>
                </tr>
            `);
        });
    }

    // Render Out-Source Table
    function renderOutSource() {
        const tbody = $('#outSourceList');
        tbody.empty();

        if (stitchingData.outsource.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="5" class="text-center text-muted">
                        <i class="bx bx-info-circle me-2"></i>No out-source workers found.
                    </td>
                </tr>
            `);
            return;
        }

        stitchingData.outsource.forEach((worker, index) => {
            tbody.append(`
                <tr>
                    <td>${index + 1}</td>
                    <td><span class="btn btn-outline-primary btn-wave btn-sm">${worker.batchId}</span></td>
                    <td><strong>${worker.company}</strong></td>
                    <td><span class="badge bg-warning">${worker.quantity}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-btn" data-id="${worker.id}" data-type="outsource" title="Edit">
                            <i class="bx bx-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-btn" data-id="${worker.id}" data-type="outsource" title="Delete">
                            <i class="bx bx-trash"></i>
                        </button>
                    </td>
                </tr>
            `);
        });
    }

    // Update counts
    function updateCounts() {
        $('#inHouseCount').text(stitchingData.inhouse.length);
        $('#outSourceCount').text(stitchingData.outsource.length);
    }

    // Reset form
    function resetForm() {
        $('#stitchingForm')[0].reset();
        $('#editId').val('');
        $('#editType').val('');
        $('#inHouseFields').hide();
        $('#outSourceFields').hide();
        $('#stitchingModalLabel').text('Add Worker');
        populateBatchSelect();
    }

    // Show/hide fields based on type
    $('#workerType').change(function() {
        const type = $(this).val();
        if (type === 'inhouse') {
            $('#inHouseFields').show();
            $('#outSourceFields').hide();
            $('#workerName').prop('required', true);
            $('#companyName').prop('required', false);
        } else if (type === 'outsource') {
            $('#inHouseFields').hide();
            $('#outSourceFields').show();
            $('#workerName').prop('required', false);
            $('#companyName').prop('required', true);
        } else {
            $('#inHouseFields').hide();
            $('#outSourceFields').hide();
            $('#workerName').prop('required', false);
            $('#companyName').prop('required', false);
        }
    });

    // Show add modal
    $('#addStitchingBtn').click(function() {
        resetForm();
        $('#stitchingModal').modal('show');
    });

    // Save (Add/Edit)
    $('#saveStitchingBtn').click(function() {
        const editId = $('#editId').val();
        const editType = $('#editType').val();
        const batchId = $('#batchSelect').val();
        const type = $('#workerType').val();
        const quantity = parseInt($('#quantity').val());

        if (!batchId || !type || !quantity || quantity < 1) {
            Swal.fire({
                icon: 'warning',
                title: 'Incomplete Form',
                text: 'Please select batch, type and enter valid quantity.',
                confirmButtonColor: '#3085d6',
                confirmButtonText: 'OK'
            });
            return;
        }

        if (type === 'inhouse') {
            const name = $('#workerName').val().trim();
            if (!name) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Incomplete Form',
                    text: 'Please enter worker name.',
                    confirmButtonColor: '#3085d6',
                    confirmButtonText: 'OK'
                });
                return;
            }

            if (editId && editType === 'inhouse') {
                const index = stitchingData.inhouse.findIndex(w => w.id === parseInt(editId));
                if (index !== -1) {
                    stitchingData.inhouse[index] = {
                        ...stitchingData.inhouse[index],
                        batchId: batchId,
                        name: name,
                        quantity: quantity
                    };
                }
                Swal.fire({
                    icon: 'success',
                    title: 'Updated!',
                    text: 'In-house worker updated successfully!',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                const newWorker = {
                    id: nextId++,
                    batchId: batchId,
                    name: name,
                    quantity: quantity
                };
                stitchingData.inhouse.push(newWorker);
                Swal.fire({
                    icon: 'success',
                    title: 'Added!',
                    text: 'In-house worker added successfully!',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        } else if (type === 'outsource') {
            const company = $('#companyName').val().trim();
            if (!company) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Incomplete Form',
                    text: 'Please enter company name.',
                    confirmButtonColor: '#3085d6',
                    confirmButtonText: 'OK'
                });
                return;
            }

            if (editId && editType === 'outsource') {
                const index = stitchingData.outsource.findIndex(w => w.id === parseInt(editId));
                if (index !== -1) {
                    stitchingData.outsource[index] = {
                        ...stitchingData.outsource[index],
                        batchId: batchId,
                        company: company,
                        quantity: quantity
                    };
                }
                Swal.fire({
                    icon: 'success',
                    title: 'Updated!',
                    text: 'Out-source worker updated successfully!',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                const newWorker = {
                    id: nextId++,
                    batchId: batchId,
                    company: company,
                    quantity: quantity
                };
                stitchingData.outsource.push(newWorker);
                Swal.fire({
                    icon: 'success',
                    title: 'Added!',
                    text: 'Out-source worker added successfully!',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        }

        renderAll();
        $('#stitchingModal').modal('hide');
    });

    // Edit button click
    $(document).on('click', '.edit-btn', function() {
        const id = parseInt($(this).data('id'));
        const type = $(this).data('type');
        let worker;

        if (type === 'inhouse') {
            worker = stitchingData.inhouse.find(w => w.id === id);
            if (worker) {
                $('#batchSelect').val(worker.batchId);
                $('#workerType').val('inhouse').trigger('change');
                $('#workerName').val(worker.name);
                $('#quantity').val(worker.quantity);
                $('#inHouseFields').show();
                $('#outSourceFields').hide();
            }
        } else if (type === 'outsource') {
            worker = stitchingData.outsource.find(w => w.id === id);
            if (worker) {
                $('#batchSelect').val(worker.batchId);
                $('#workerType').val('outsource').trigger('change');
                $('#companyName').val(worker.company);
                $('#quantity').val(worker.quantity);
                $('#inHouseFields').hide();
                $('#outSourceFields').show();
            }
        }

        if (worker) {
            $('#editId').val(id);
            $('#editType').val(type);
            $('#stitchingModalLabel').text('Edit Worker');
            $('#stitchingModal').modal('show');
        }
    });

    // Delete button click
    $(document).on('click', '.delete-btn', function() {
        const id = parseInt($(this).data('id'));
        const type = $(this).data('type');
        let worker;
        let typeLabel;

        if (type === 'inhouse') {
            worker = stitchingData.inhouse.find(w => w.id === id);
            typeLabel = 'In-House Worker';
        } else if (type === 'outsource') {
            worker = stitchingData.outsource.find(w => w.id === id);
            typeLabel = 'Out-Source Worker';
        }

        if (!worker) return;

        const displayName = type === 'inhouse' ? worker.name : worker.company;

        Swal.fire({
            title: 'Are you sure?',
            html: `You are about to delete <strong>${displayName}</strong> from ${typeLabel} (Batch: ${worker.batchId})`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                if (type === 'inhouse') {
                    stitchingData.inhouse = stitchingData.inhouse.filter(w => w.id !== id);
                } else if (type === 'outsource') {
                    stitchingData.outsource = stitchingData.outsource.filter(w => w.id !== id);
                }
                renderAll();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Worker has been deleted successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        });
    });

    // Modal close handlers
    $('#stitchingModal').on('hidden.bs.modal', function() {
        resetForm();
    });

    // Initial render
    renderAll();
});