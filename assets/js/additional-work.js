$(document).ready(function() {
    // Sample additional work data
    let works = [
        { id: 1, name: 'Screen Print' },
        { id: 2, name: 'Digital Print' },
        { id: 3, name: 'Peco' },
        { id: 4, name: 'Handwork' },
        { id: 5, name: 'Embroidery' },
        { id: 6, name: 'Pleating' }
    ];

    let nextId = 7;

    // Initialize
    renderWorkTable();

    // Render table
    function renderWorkTable() {
        const tbody = $('#workTableBody');
        tbody.empty();

        const searchTerm = $('#searchWorkInput').val().toLowerCase().trim();
        let filteredWorks = works;

        if (searchTerm) {
            filteredWorks = works.filter(w => 
                w.name.toLowerCase().includes(searchTerm)
            );
        }

        if (filteredWorks.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="3" class="text-center text-muted py-4">
                        <i class="bx bx-brush fs-2 d-block mb-2"></i>
                        No additional work found
                    </td>
                </tr>
            `);
            return;
        }

        filteredWorks.forEach((work, index) => {
            tbody.append(`
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${work.name}</strong></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-primary edit-work-btn me-1" 
                                data-id="${work.id}" 
                                title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>
                        <button class="btn btn-sm btn-danger delete-work-btn" 
                                data-id="${work.id}" 
                                title="Delete">
                                <i class="bx bx-trash"></i>
                            </button>
                    </td>
                </tr>
            `);
        });

        // Attach event listeners
        $('.edit-work-btn').click(function() {
            const id = parseInt($(this).data('id'));
            openEditWorkModal(id);
        });

        $('.delete-work-btn').click(function() {
            const id = parseInt($(this).data('id'));
            openDeleteWorkModal(id);
        });
    }

    // Open Add Modal
    $('#addWorkBtn').click(function() {
        $('#workModalLabel').text('Add Additional Work');
        $('#workName').val('');
        $('#editWorkId').val('');
        $('#workModal').modal('show');
    });

    // Open Edit Modal
    function openEditWorkModal(id) {
        const work = works.find(w => w.id === id);
        if (!work) return;

        $('#workModalLabel').text('Edit Additional Work');
        $('#workName').val(work.name);
        $('#editWorkId').val(work.id);
        $('#workModal').modal('show');
    }

    // Open Delete Modal
    function openDeleteWorkModal(id) {
        const work = works.find(w => w.id === id);
        if (!work) return;

        $('#deleteWorkId').val(id);
        $('#deleteWorkName').text(work.name);
        $('#deleteWorkModal').modal('show');
    }

    // Save Additional Work (Add or Edit)
    $('#saveWorkBtn').click(function() {
        const name = $('#workName').val().trim();
        const editId = $('#editWorkId').val();

        // Validation
        if (!name) {
            Swal.fire({
                icon: 'warning',
                title: 'Warning!',
                text: 'Please enter work name',
                confirmButtonColor: '#3085d6'
            });
            $('#workName').focus();
            return;
        }

        // Check for duplicate name
        const duplicate = works.some(w => 
            w.name.toLowerCase() === name.toLowerCase() && 
            w.id !== parseInt(editId)
        );

        if (duplicate) {
            Swal.fire({
                icon: 'warning',
                title: 'Duplicate!',
                text: 'Additional work name already exists',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        if (editId) {
            // Update existing work
            const index = works.findIndex(w => w.id === parseInt(editId));
            if (index !== -1) {
                works[index].name = name;
            }

            Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: 'Additional work updated successfully!',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            // Add new work
            works.push({
                id: nextId++,
                name: name
            });

            Swal.fire({
                icon: 'success',
                title: 'Added!',
                text: 'Additional work added successfully!',
                timer: 2000,
                showConfirmButton: false
            });
        }

        renderWorkTable();
        $('#workModal').modal('hide');
        $('#workForm')[0].reset();
        $('#editWorkId').val('');
    });

    // Confirm Delete
    $('#confirmDeleteWorkBtn').click(function() {
        const id = parseInt($('#deleteWorkId').val());
        works = works.filter(w => w.id !== id);
        renderWorkTable();
        $('#deleteWorkModal').modal('hide');
        
        Swal.fire({
            icon: 'success',
            title: 'Deleted!',
            text: 'Additional work has been deleted successfully.',
            timer: 2000,
            showConfirmButton: false
        });
    });

    // Search
    $('#searchWorkInput').on('keyup', function() {
        renderWorkTable();
    });

    // Reset form when modal is hidden
    $('#workModal').on('hidden.bs.modal', function() {
        $('#workForm')[0].reset();
        $('#editWorkId').val('');
    });

    // Initial render
    renderWorkTable();
});