$(document).ready(function() {
    // Sample color data
    let colors = [
        { id: 1, name: 'Red' },
        { id: 2, name: 'Blue' },
        { id: 3, name: 'Green' },
        { id: 4, name: 'Yellow' },
        { id: 5, name: 'Black' },
        { id: 6, name: 'White' },
        { id: 7, name: 'Orange' },
        { id: 8, name: 'Purple' },
        { id: 9, name: 'Pink' },
        { id: 10, name: 'Brown' }
    ];

    let nextId = 11;

    // Initialize
    renderTable();

    // Render table
    function renderTable() {
        const tbody = $('#colorTableBody');
        tbody.empty();

        const searchTerm = $('#searchInput').val().toLowerCase().trim();
        let filteredColors = colors;

        if (searchTerm) {
            filteredColors = colors.filter(c => 
                c.name.toLowerCase().includes(searchTerm)
            );
        }

        if (filteredColors.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="3" class="text-center text-muted py-4">
                        <i class="bx bx-palette fs-2 d-block mb-2"></i>
                        No colors found
                    </td>
                </tr>
            `);
            return;
        }

        filteredColors.forEach((color, index) => {
            tbody.append(`
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${color.name}</strong></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-danger delete-btn" 
                                data-id="${color.id}" 
                                title="Delete">
                                <i class="bx bx-trash"></i>
                            </button>
                    </td>
                </tr>
            `);
        });

        // Attach event listeners
        $('.delete-btn').click(function() {
            const id = parseInt($(this).data('id'));
            openDeleteModal(id);
        });
    }

    // Open Add Modal
    $('#addColorBtn').click(function() {
        $('#colorModalLabel').text('Add Color');
        $('#colorName').val('');
        $('#colorModal').modal('show');
    });

    // Open Delete Modal
    function openDeleteModal(id) {
        const color = colors.find(c => c.id === id);
        if (!color) return;

        $('#deleteId').val(id);
        $('#deleteColorName').text(color.name);
        $('#deleteModal').modal('show');
    }

    // Save Color
    $('#saveColorBtn').click(function() {
        const name = $('#colorName').val().trim();

        // Validation
        if (!name) {
            Swal.fire({
                icon: 'warning',
                title: 'Warning!',
                text: 'Please enter color name',
                confirmButtonColor: '#3085d6'
            });
            $('#colorName').focus();
            return;
        }

        // Check for duplicate name
        const duplicate = colors.some(c => c.name.toLowerCase() === name.toLowerCase());

        if (duplicate) {
            Swal.fire({
                icon: 'warning',
                title: 'Duplicate!',
                text: 'Color name already exists',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        // Add new color
        colors.push({
            id: nextId++,
            name: name
        });

        Swal.fire({
            icon: 'success',
            title: 'Added!',
            text: 'Color added successfully!',
            timer: 2000,
            showConfirmButton: false
        });

        renderTable();
        $('#colorModal').modal('hide');
        $('#colorForm')[0].reset();
    });

    // Confirm Delete
    $('#confirmDeleteBtn').click(function() {
        const id = parseInt($('#deleteId').val());
        colors = colors.filter(c => c.id !== id);
        renderTable();
        $('#deleteModal').modal('hide');
        
        Swal.fire({
            icon: 'success',
            title: 'Deleted!',
            text: 'Color has been deleted successfully.',
            timer: 2000,
            showConfirmButton: false
        });
    });

    // Search
    $('#searchInput').on('keyup', function() {
        renderTable();
    });

    // Reset form when modal is hidden
    $('#colorModal').on('hidden.bs.modal', function() {
        $('#colorForm')[0].reset();
    });

    // Initial render
    renderTable();
});