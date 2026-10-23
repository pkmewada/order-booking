$(document).ready(function() {
    let items = [];
    const isPieceItem = new URLSearchParams(window.location.search).get('type') === 'piece';
    const endpoint = isPieceItem ? 'piece-item-list' : 'item-list';
    const itemLabel = isPieceItem ? 'Piece Item' : 'Item';
    if (isPieceItem) {
        $('.page-title').text('Piece Item Management');
        $('.breadcrumb-item.active').text('Piece Items');
        $('.card-title').html('<i class="bx bx-list-ul text-primary me-2"></i> Piece Items');
        $('#addItemBtn').html('<i class="bx bx-plus align-middle"></i> Add Piece Item');
        $('#itemName').attr('placeholder', 'Enter a garment item (e.g., Shirt, Jeans, Jacket)');
    }
    async function request(method = 'GET', data) {
        const response = await fetch(`api/${endpoint}.php`, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
        let result;
        try { result = await response.json(); } catch (_) { throw new Error('Invalid server response. Check Apache and database setup.'); }
        if (!response.ok || !result.success) throw new Error(result.message || 'Unable to complete request.');
        return result.data;
    }
    function cacheRecords() {
        try { localStorage.setItem(isPieceItem ? 'pieceItems' : 'items', JSON.stringify(items)); } catch (error) { console.warn('Master cache unavailable', error); }
    }
    function escapeHtml(value) { return $('<div>').text(String(value ?? '')).html(); }
    async function loadRecords() {
        $('#addItemBtn, #saveItemBtn, #confirmDeleteItemBtn').prop('disabled', true);
        $('#itemTableBody').html('<tr><td colspan="3" class="text-center py-4">Loading...</td></tr>');
        try {
            items = await request(); cacheRecords(); renderItemTable();
            $('#addItemBtn, #saveItemBtn, #confirmDeleteItemBtn').prop('disabled', false);
        } catch (error) {
            $('#itemTableBody').html('<tr><td colspan="3" class="text-center py-4">Unable to load records. Refresh after database setup.</td></tr>');
            Swal.fire('Unable to load', error.message, 'error');
        }
    }
    loadRecords();

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
                    <td><strong>${escapeHtml(item.name)}</strong></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-primary edit-item-btn me-1" 
                                data-id="${item.id}" 
                                title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>
                        <button class="btn btn-sm btn-dark text-white delete-item-btn" style="background-color:#000;border-color:#000;color:#fff;" 
                                data-id="${item.id}" 
                                title="Delete">
                                <i class="bx bx-trash text-white"></i>
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
        $('#itemModalLabel').text(`Add ${itemLabel}`);
        $('#itemName').val('');
        $('#editItemId').val('');
        $('#itemModal').modal('show');
    });

    // Open Edit Modal
    function openEditItemModal(id) {
        const item = items.find(i => i.id === id);
        if (!item) return;

        $('#itemModalLabel').text(`Edit ${itemLabel}`);
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
    $('#saveItemBtn').click(async function() {
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

        const button = $(this);
        if (button.prop('disabled')) return;
        button.prop('disabled', true);
        try {
            const id = editId ? Number(editId) : null;
            const record = await request(id ? 'PUT' : 'POST', { id, name });
            if (id) { const index = items.findIndex(row => row.id === id); if (index !== -1) items[index] = record; }
            else { items.unshift(record); }
            cacheRecords(); renderItemTable(); $('#itemModal').modal('hide'); $('#itemForm')[0].reset();
            $('#editItemId').val('');
            Swal.fire('Success!', 'Item saved successfully.', 'success');
        } catch (error) { Swal.fire('Unable to save', error.message, 'error'); }
        finally { button.prop('disabled', false); }
    });

    // Confirm Delete
    $('#confirmDeleteItemBtn').click(async function() {
        const button = $(this);
        if (button.prop('disabled')) return;
        button.prop('disabled', true);
        try {
            const id = Number($('#deleteItemId').val()); await request('DELETE', { id });
            items = items.filter(row => row.id !== id); cacheRecords(); renderItemTable();
            $('#deleteItemModal').modal('hide'); Swal.fire('Deleted!', 'Item deleted successfully.', 'success');
        } catch (error) { Swal.fire('Unable to delete', error.message, 'error'); }
        finally { button.prop('disabled', false); }
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


});