$(document).ready(function() {
    let colors = [];
    async function request(method = 'GET', data) {
        const response = await fetch('api/colour.php', { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
        let result;
        try { result = await response.json(); } catch (_) { throw new Error('Invalid server response. Check Apache and database setup.'); }
        if (!response.ok || !result.success) throw new Error(result.message || 'Unable to complete request.');
        return result.data;
    }
    function cacheRecords() {
        try { localStorage.setItem('colors', JSON.stringify(colors)); } catch (error) { console.warn('Master cache unavailable', error); }
    }
    function escapeHtml(value) { return $('<div>').text(String(value ?? '')).html(); }
    async function loadRecords() {
        $('#addColorBtn, #saveColorBtn, #confirmDeleteBtn').prop('disabled', true);
        $('#colorTableBody').html('<tr><td colspan="3" class="text-center py-4">Loading...</td></tr>');
        try {
            colors = await request(); cacheRecords(); renderTable();
            $('#addColorBtn, #saveColorBtn, #confirmDeleteBtn').prop('disabled', false);
        } catch (error) {
            $('#colorTableBody').html('<tr><td colspan="3" class="text-center py-4">Unable to load records. Refresh after database setup.</td></tr>');
            Swal.fire('Unable to load', error.message, 'error');
        }
    }
    loadRecords();

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
                    <td><strong>${escapeHtml(color.name)}</strong></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-dark text-white delete-btn" style="background-color:#000;border-color:#000;color:#fff;" 
                                data-id="${color.id}" 
                                title="Delete">
                                <i class="bx bx-trash text-white"></i>
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
    $('#saveColorBtn').click(async function() {
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

        const button = $(this);
        if (button.prop('disabled')) return;
        button.prop('disabled', true);
        try {
            const id = null;
            const record = await request(id ? 'PUT' : 'POST', { id, name });
            if (id) { const index = colors.findIndex(row => row.id === id); if (index !== -1) colors[index] = record; }
            else { colors.unshift(record); }
            cacheRecords(); renderTable(); $('#colorModal').modal('hide'); $('#colorForm')[0].reset();
            
            Swal.fire('Success!', 'Color saved successfully.', 'success');
        } catch (error) { Swal.fire('Unable to save', error.message, 'error'); }
        finally { button.prop('disabled', false); }
    });

    // Confirm Delete
    $('#confirmDeleteBtn').click(async function() {
        const button = $(this);
        if (button.prop('disabled')) return;
        button.prop('disabled', true);
        try {
            const id = Number($('#deleteId').val()); await request('DELETE', { id });
            colors = colors.filter(row => row.id !== id); cacheRecords(); renderTable();
            $('#deleteModal').modal('hide'); Swal.fire('Deleted!', 'Color deleted successfully.', 'success');
        } catch (error) { Swal.fire('Unable to delete', error.message, 'error'); }
        finally { button.prop('disabled', false); }
    });

    // Search
    $('#searchInput').on('keyup', function() {
        renderTable();
    });

    // Reset form when modal is hidden
    $('#colorModal').on('hidden.bs.modal', function() {
        $('#colorForm')[0].reset();
    });


});