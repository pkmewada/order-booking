$(document).ready(function() {
    let works = [];
    async function request(method = 'GET', data) {
        const response = await fetch('api/additional-work.php', { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
        let result;
        try { result = await response.json(); } catch (_) { throw new Error('Invalid server response. Check Apache and database setup.'); }
        if (!response.ok || !result.success) throw new Error(result.message || 'Unable to complete request.');
        return result.data;
    }
    function cacheRecords() {
        try { localStorage.setItem('additionalWorks', JSON.stringify(works)); } catch (error) { console.warn('Master cache unavailable', error); }
    }
    function escapeHtml(value) { return $('<div>').text(String(value ?? '')).html(); }
    async function loadRecords() {
        $('#addWorkBtn, #saveWorkBtn, #confirmDeleteWorkBtn').prop('disabled', true);
        $('#workTableBody').html('<tr><td colspan="3" class="text-center py-4">Loading...</td></tr>');
        try {
            works = await request(); cacheRecords(); renderWorkTable();
            $('#addWorkBtn, #saveWorkBtn, #confirmDeleteWorkBtn').prop('disabled', false);
        } catch (error) {
            $('#workTableBody').html('<tr><td colspan="3" class="text-center py-4">Unable to load records. Refresh after database setup.</td></tr>');
            Swal.fire('Unable to load', error.message, 'error');
        }
    }
    loadRecords();

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
                    <td><strong>${escapeHtml(work.name)}</strong></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-primary edit-work-btn me-1" 
                                data-id="${work.id}" 
                                title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>
                        <button class="btn btn-sm btn-dark text-white delete-work-btn" style="background-color:#000;border-color:#000;color:#fff;" 
                                data-id="${work.id}" 
                                title="Delete">
                                <i class="bx bx-trash text-white"></i>
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
    $('#saveWorkBtn').click(async function() {
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

        const button = $(this);
        if (button.prop('disabled')) return;
        button.prop('disabled', true);
        try {
            const id = editId ? Number(editId) : null;
            const record = await request(id ? 'PUT' : 'POST', { id, name });
            if (id) { const index = works.findIndex(row => row.id === id); if (index !== -1) works[index] = record; }
            else { works.unshift(record); }
            cacheRecords(); renderWorkTable(); $('#workModal').modal('hide'); $('#workForm')[0].reset();
            $('#editWorkId').val('');
            Swal.fire('Success!', 'Work saved successfully.', 'success');
        } catch (error) { Swal.fire('Unable to save', error.message, 'error'); }
        finally { button.prop('disabled', false); }
    });

    // Confirm Delete
    $('#confirmDeleteWorkBtn').click(async function() {
        const button = $(this);
        if (button.prop('disabled')) return;
        button.prop('disabled', true);
        try {
            const id = Number($('#deleteWorkId').val()); await request('DELETE', { id });
            works = works.filter(row => row.id !== id); cacheRecords(); renderWorkTable();
            $('#deleteWorkModal').modal('hide'); Swal.fire('Deleted!', 'Work deleted successfully.', 'success');
        } catch (error) { Swal.fire('Unable to delete', error.message, 'error'); }
        finally { button.prop('disabled', false); }
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


});