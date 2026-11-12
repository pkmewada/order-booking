$(document).ready(function() {
    let distributors = [];
    let searchTerm = '';
    const stateCity = StateCity.init(document.getElementById('distributorState'), document.getElementById('distributorCity'));

    loadDistributors();

    async function request(method = 'GET', data) {
        const response = await fetch('api/distributor.php', {
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
        try { localStorage.setItem('distributors', JSON.stringify(distributors)); }
        catch (error) { console.warn('Unable to update master record cache', error); }
    }
    function showError(error) { Swal.fire('Unable to complete', error.message || 'Please try again.', 'error'); }
    function escapeHtml(value) { return $('<div>').text(value == null ? '' : String(value)).html(); }
    async function loadDistributors() {
        $('#saveDistributorBtn, #addDistributorBtn').prop('disabled', true);
        $('#distributorTableBody').html('<tr><td colspan="7" class="text-center py-4">Loading...</td></tr>');
        try {
            distributors = await request();
            cacheRecords();
            renderTable();
        } catch (error) {
            $('#distributorTableBody').html('<tr><td colspan="7" class="text-center py-4">Unable to load records. Refresh after checking database setup.</td></tr>');
            showError(error);
        } finally { $('#saveDistributorBtn, #addDistributorBtn').prop('disabled', false); }
    }

    function renderTable() {
        const tbody = $('#distributorTableBody');
        tbody.empty();

        let filtered = distributors;
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(d => d.name.toLowerCase().includes(term));
        }

        if (filtered.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="bx bx-user-x fs-2 d-block mb-2"></i>
                        No distributors found
                    </td>
                </tr>
            `);
            return;
        }

        filtered.forEach((dist, index) => {
            tbody.append(`
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(dist.name)}</td>
                    <td>${escapeHtml(dist.contact)}</td>
                    <td>${escapeHtml(dist.email)}</td>
                    <td>${escapeHtml(dist.city)}</td>
                    <td>${escapeHtml(dist.state)}</td>
                    <td class="text-center">
                        <div class="d-inline-flex gap-2" role="group">
                            <button class="btn btn-sm btn-primary edit-btn" data-id="${dist.id}" title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-dark text-white delete-btn" style="background-color:#000;border-color:#000;color:#fff;" data-id="${dist.id}" title="Delete">
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
                    distributors = distributors.filter(record => record.id !== id);
                    cacheRecords();
                    renderTable();
                    Swal.fire('Deleted!', 'Distributor has been deleted successfully.', 'success');
                } catch (error) { showError(error); }
            }
        });
    }

    $('#addDistributorBtn').click(function() {
        $('#distributorModalLabel').text('Add Distributor');
        $('#editId').val('');
        $('#distributorForm')[0].reset();
        stateCity.reset();
        $('#distributorModal').modal('show');
    });

    function openEditModal(id) {
        const dist = distributors.find(d => d.id === id);
        if (!dist) return;

        $('#distributorModalLabel').text('Edit Distributor');
        $('#editId').val(dist.id);
        $('#distributorName').val(dist.name);
        $('#distributorContact').val(dist.contact);
        $('#distributorEmail').val(dist.email);
        stateCity.setValue(dist.state, dist.city);
        $('#distributorModal').modal('show');
    }

    $('#saveDistributorBtn').click(async function() {
        const editId = $('#editId').val();
        const name = $('#distributorName').val().trim();
        const contact = $('#distributorContact').val().trim();
        const email = $('#distributorEmail').val().trim();
        const city = $('#distributorCity').val().trim();
        const state = $('#distributorState').val().trim();

        if (!name) {
            Swal.fire('Warning!', 'Please enter name', 'warning');
            $('#distributorName').focus();
            return;
        }
        if (!/^[6-9][0-9]{9}$/.test(contact)) {
            Swal.fire('Warning!', 'Phone number must be 10 digits and start with 6, 7, 8 or 9.', 'warning');
            $('#distributorContact').focus();
            return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            Swal.fire('Warning!', 'Please enter a valid email address.', 'warning');
            $('#distributorEmail').focus();
            return;
        }
        if (!city) {
            Swal.fire('Warning!', 'Please enter city', 'warning');
            $('#distributorCity').focus();
            return;
        }
        if (!state) {
            Swal.fire('Warning!', 'Please enter state', 'warning');
            $('#distributorState').focus();
            return;
        }

        const button = $(this);
        if (button.prop('disabled')) return;
        button.prop('disabled', true);
        try {
            const record = await request(editId ? 'PUT' : 'POST', { id: editId, name, contact, email, city, state });
            if (editId) {
                const index = distributors.findIndex(item => item.id === editId);
                if (index !== -1) distributors[index] = record;
            } else { distributors.unshift(record); }
            cacheRecords();
            renderTable();
            $('#distributorModal').modal('hide');
            $('#distributorForm')[0].reset();
            Swal.fire('Success!', 'Distributor ' + (editId ? 'updated' : 'added') + ' successfully!', 'success');
        } catch (error) { showError(error); }
        finally { button.prop('disabled', false); }
    });

    $('#searchInput').on('keyup', function() {
        searchTerm = $(this).val();
        renderTable();
    });

    $('#distributorModal').on('hidden.bs.modal', function() {
        $('#distributorForm')[0].reset();
        $('#editId').val('');
        stateCity.reset();
    });
});
