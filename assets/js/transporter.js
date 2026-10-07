$(document).ready(function() {
    let transporters = [];
    let searchTerm = '';
    const stateCity = StateCity.init(document.getElementById('transporterState'), document.getElementById('transporterCity'));

    loadTransporters();

    async function request(method = 'GET', data) {
        const response = await fetch('api/transporter.php', {
            method, headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
            body: data ? JSON.stringify(data) : undefined
        });
        let result;
        try { result = await response.json(); }
        catch (_) { throw new Error('Invalid server response. Check that Apache is running.'); }
        if (!response.ok || !result.success) throw new Error(result.message || 'Unable to save record.');
        return result.data;
    }
    function cacheRecords() {
        // Compatibility cache for existing customer/order dropdowns; database remains authoritative.
        try { localStorage.setItem('transporters', JSON.stringify(transporters)); }
        catch (error) { console.warn('Unable to update master record cache', error); }
    }
    function showError(error) { Swal.fire('Unable to complete', error.message || 'Please try again.', 'error'); }
    function escapeHtml(value) { return $('<div>').text(value == null ? '' : String(value)).html(); }
    async function loadTransporters() {
        $('#saveTransporterBtn, #addTransporterBtn').prop('disabled', true);
        $('#transporterTableBody').html('<tr><td colspan="7" class="text-center py-4">Loading...</td></tr>');
        try {
            transporters = await request();
            cacheRecords();
            renderTable();
        } catch (error) {
            $('#transporterTableBody').html('<tr><td colspan="7" class="text-center py-4">Unable to load records. Refresh after checking database setup.</td></tr>');
            showError(error);
        } finally { $('#saveTransporterBtn, #addTransporterBtn').prop('disabled', false); }
    }

    function renderTable() {
        const tbody = $('#transporterTableBody');
        tbody.empty();

        let filtered = transporters;
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(t => t.name.toLowerCase().includes(term));
        }

        if (filtered.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="bx bx-user-x fs-2 d-block mb-2"></i>
                        No transporters found
                    </td>
                </tr>
            `);
            return;
        }

        filtered.forEach((trans, index) => {
            tbody.append(`
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(trans.name)}</td>
                    <td>${escapeHtml(trans.contact)}</td>
                    <td>${escapeHtml(trans.email)}</td>
                    <td>${escapeHtml(trans.city)}</td>
                    <td>${escapeHtml(trans.state)}</td>
                    <td class="text-center">
                        <div class="d-inline-flex gap-2" role="group">
                            <button class="btn btn-sm btn-primary edit-btn" data-id="${trans.id}" title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-dark text-white delete-btn" style="background-color:#000;border-color:#000;color:#fff;" data-id="${trans.id}" title="Delete">
                                <i class="bx bx-trash text-white"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `);
        });

        $('.edit-btn').click(function() {
            openEditModal($(this).data('id'));
        });

        $('.delete-btn').click(function() {
            showDeleteConfirmation($(this).data('id'));
        });
    }

    function showDeleteConfirmation(id) {
        Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await request('DELETE', { id });
                    transporters = transporters.filter(record => record.id !== id);
                    cacheRecords();
                    renderTable();
                    Swal.fire('Deleted!', 'Transporter has been deleted successfully.', 'success');
                } catch (error) { showError(error); }
            }
        });
    }

    $('#addTransporterBtn').click(function() {
        $('#transporterModalLabel').text('Add Transporter');
        $('#editId').val('');
        $('#transporterForm')[0].reset();
        stateCity.reset();
        $('#transporterModal').modal('show');
    });

    function openEditModal(id) {
        const trans = transporters.find(t => t.id === id);
        if (!trans) return;

        $('#transporterModalLabel').text('Edit Transporter');
        $('#editId').val(trans.id);
        $('#transporterName').val(trans.name);
        $('#transporterContact').val(trans.contact);
        $('#transporterEmail').val(trans.email);
        stateCity.setValue(trans.state, trans.city);
        $('#transporterModal').modal('show');
    }

    $('#saveTransporterBtn').click(async function() {
        const editId = $('#editId').val();
        const name = $('#transporterName').val().trim();
        const contact = $('#transporterContact').val().trim();
        const email = $('#transporterEmail').val().trim();
        const city = $('#transporterCity').val().trim();
        const state = $('#transporterState').val().trim();

        if (!name) {
            Swal.fire('Warning!', 'Please enter name', 'warning');
            $('#transporterName').focus();
            return;
        }
        if (!/^[6-9][0-9]{9}$/.test(contact)) {
            Swal.fire('Warning!', 'Phone number must be 10 digits and start with 6, 7, 8 or 9.', 'warning');
            $('#transporterContact').focus();
            return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            Swal.fire('Warning!', 'Please enter a valid email address.', 'warning');
            $('#transporterEmail').focus();
            return;
        }
        if (!city) {
            Swal.fire('Warning!', 'Please enter city', 'warning');
            $('#transporterCity').focus();
            return;
        }
        if (!state) {
            Swal.fire('Warning!', 'Please enter state', 'warning');
            $('#transporterState').focus();
            return;
        }

        const button = $(this);
        if (button.prop('disabled')) return;
        button.prop('disabled', true);
        try {
            const record = await request(editId ? 'PUT' : 'POST', { id: editId, name, contact, email, city, state });
            if (editId) {
                const index = transporters.findIndex(item => item.id === editId);
                if (index !== -1) transporters[index] = record;
            } else { transporters.unshift(record); }
            cacheRecords();
            renderTable();
            $('#transporterModal').modal('hide');
            $('#transporterForm')[0].reset();
            Swal.fire('Success!', 'Transporter ' + (editId ? 'updated' : 'added') + ' successfully!', 'success');
        } catch (error) { showError(error); }
        finally { button.prop('disabled', false); }
    });

    $('#searchInput').on('keyup', function() {
        searchTerm = $(this).val();
        renderTable();
    });

    $('#transporterModal').on('hidden.bs.modal', function() {
        $('#transporterForm')[0].reset();
        $('#editId').val('');
        stateCity.reset();
    });
});
