$(document).ready(function() {
    // Sample item data
    let items = [
        { id: 1, name: 'Main Fabric' },
        { id: 2, name: 'Cotton' },
        { id: 3, name: 'Zip' },
        { id: 4, name: 'Label' },
        { id: 5, name: 'Elastic' },
        { id: 6, name: 'Button' },
        { id: 7, name: 'Thread' },
        { id: 8, name: 'Interlining' },
        { id: 9, name: 'Lace' },
        { id: 10, name: 'Ribbon' }
    ];

    let nextId = 11;

    // Initialize
    renderItemTable();

    // Render table
    function renderItemTable() {
        const tbody = $('#itemTableBody');
        tbody.empty();

        const searchTerm = $('#searchItemInput').val().toLowerCase().trim();
        let filteredItems = items;

        if (searchTerm) {
            filteredItems = items.filter(i => 
                i.name.toLowerCase().includes(searchTerm)
            );
        }

        if (filteredItems.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="3" class="text-center text-muted py-4">
                        <i class="bx bx-list-ul fs-2 d-block mb-2"></i>
                        No items found
                    </td>
                </tr>
            `);
            return;
        }

        filteredItems.forEach((item, index) => {
            tbody.append(`
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${item.name}</strong></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-primary edit-item-btn me-1" 
                                data-id="${item.id}" 
                                title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>
                        <button class="btn btn-sm btn-danger delete-item-btn" 
                                data-id="${item.id}" 
                                title="Delete">
                                <i class="bx bx-trash"></i>
                            </button>
                    </td>
                </tr>
            `);
        });

        // Attach event listeners
        $('.edit-item-btn').click(function() {
            const id = parseInt($(this).data('id'));
            openEditItemModal(id);
        });

        $('.delete-item-btn').click(function() {
            const id = parseInt($(this).data('id'));
            openDeleteItemModal(id);
        });
    }

    // Open Add Modal
    $('#addItemBtn').click(function() {
        $('#itemModalLabel').text('Add Item');
        $('#itemName').val('');
        $('#editItemId').val('');
        $('#itemModal').modal('show');
    });

    // Open Edit Modal
    function openEditItemModal(id) {
        const item = items.find(i => i.id === id);
        if (!item) return;

        $('#itemModalLabel').text('Edit Item');
        $('#itemName').val(item.name);
        $('#editItemId').val(item.id);
        $('#itemModal').modal('show');
    }

    // Open Delete Modal
    function openDeleteItemModal(id) {
        const item = items.find(i => i.id === id);
        if (!item) return;

        $('#deleteItemId').val(id);
        $('#deleteItemName').text(item.name);
        $('#deleteItemModal').modal('show');
    }

    // Save Item (Add or Edit)
    $('#saveItemBtn').click(function() {
        const name = $('#itemName').val().trim();
        const editId = $('#editItemId').val();

        // Validation
        if (!name) {
            Swal.fire({
                icon: 'warning',
                title: 'Warning!',
                text: 'Please enter item name',
                confirmButtonColor: '#3085d6'
            });
            $('#itemName').focus();
            return;
        }

        // Check for duplicate name
        const duplicate = items.some(i => 
            i.name.toLowerCase() === name.toLowerCase() && 
            i.id !== parseInt(editId)
        );

        if (duplicate) {
            Swal.fire({
                icon: 'warning',
                title: 'Duplicate!',
                text: 'Item name already exists',
                confirmButtonColor: '#3085d6'
            });
            return;
        }

        if (editId) {
            // Update existing item
            const index = items.findIndex(i => i.id === parseInt(editId));
            if (index !== -1) {
                items[index].name = name;
            }

            Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: 'Item updated successfully!',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            // Add new item
            items.push({
                id: nextId++,
                name: name
            });

            Swal.fire({
                icon: 'success',
                title: 'Added!',
                text: 'Item added successfully!',
                timer: 2000,
                showConfirmButton: false
            });
        }

        renderItemTable();
        $('#itemModal').modal('hide');
        $('#itemForm')[0].reset();
        $('#editItemId').val('');
    });

    // Confirm Delete
    $('#confirmDeleteItemBtn').click(function() {
        const id = parseInt($('#deleteItemId').val());
        items = items.filter(i => i.id !== id);
        renderItemTable();
        $('#deleteItemModal').modal('hide');
        
        Swal.fire({
            icon: 'success',
            title: 'Deleted!',
            text: 'Item has been deleted successfully.',
            timer: 2000,
            showConfirmButton: false
        });
    });

    // Search
    $('#searchItemInput').on('keyup', function() {
        renderItemTable();
    });

    // Reset form when modal is hidden
    $('#itemModal').on('hidden.bs.modal', function() {
        $('#itemForm')[0].reset();
        $('#editItemId').val('');
    });

    // Initial render
    renderItemTable();
});