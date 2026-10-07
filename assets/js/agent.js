$(document).ready(function() {
    let agents = [];
    let searchTerm = '';
    const stateCity = StateCity.init(document.getElementById('agentState'), document.getElementById('agentCity'));

    loadAgents();

    async function request(method = 'GET', data) {
        const response = await fetch('api/agent.php', {
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
        try { localStorage.setItem('agents', JSON.stringify(agents)); }
        catch (error) { console.warn('Unable to update master record cache', error); }
    }
    function showError(error) { Swal.fire('Unable to complete', error.message || 'Please try again.', 'error'); }
    function escapeHtml(value) { return $('<div>').text(value == null ? '' : String(value)).html(); }
    async function loadAgents() {
        $('#saveAgentBtn, #addAgentBtn').prop('disabled', true);
        $('#agentTableBody').html('<tr><td colspan="7" class="text-center py-4">Loading...</td></tr>');
        try {
            agents = await request();
            cacheRecords();
            renderTable();
        } catch (error) {
            $('#agentTableBody').html('<tr><td colspan="7" class="text-center py-4">Unable to load records. Refresh after checking database setup.</td></tr>');
            showError(error);
        } finally { $('#saveAgentBtn, #addAgentBtn').prop('disabled', false); }
    }

    function renderTable() {
        const tbody = $('#agentTableBody');
        tbody.empty();

        let filtered = agents;
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(a => a.name.toLowerCase().includes(term));
        }

        if (filtered.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="bx bx-user-x fs-2 d-block mb-2"></i>
                        No agents found
                    </td>
                </tr>
            `);
            return;
        }

        filtered.forEach((agent, index) => {
            tbody.append(`
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(agent.name)}</td>
                    <td>${escapeHtml(agent.contact)}</td>
                    <td>${escapeHtml(agent.email)}</td>
                    <td>${escapeHtml(agent.city)}</td>
                    <td>${escapeHtml(agent.state)}</td>
                    <td class="text-center">
                        <div class="d-inline-flex gap-2" role="group">
                            <button class="btn btn-sm btn-primary edit-btn" data-id="${agent.id}" title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-dark text-white delete-btn" style="background-color:#000;border-color:#000;color:#fff;" data-id="${agent.id}" title="Delete">
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
                    agents = agents.filter(record => record.id !== id);
                    cacheRecords();
                    renderTable();
                    Swal.fire('Deleted!', 'Agent has been deleted successfully.', 'success');
                } catch (error) { showError(error); }
            }
        });
    }

    $('#addAgentBtn').click(function() {
        $('#agentModalLabel').text('Add Agent');
        $('#editId').val('');
        $('#agentForm')[0].reset();
        stateCity.reset();
        $('#agentModal').modal('show');
    });

    function openEditModal(id) {
        const agent = agents.find(a => a.id === id);
        if (!agent) return;

        $('#agentModalLabel').text('Edit Agent');
        $('#editId').val(agent.id);
        $('#agentName').val(agent.name);
        $('#agentContact').val(agent.contact);
        $('#agentEmail').val(agent.email);
        stateCity.setValue(agent.state, agent.city);
        $('#agentModal').modal('show');
    }

    $('#saveAgentBtn').click(async function() {
        const editId = $('#editId').val();
        const name = $('#agentName').val().trim();
        const contact = $('#agentContact').val().trim();
        const email = $('#agentEmail').val().trim();
        const city = $('#agentCity').val().trim();
        const state = $('#agentState').val().trim();

        if (!name) {
            Swal.fire('Warning!', 'Please enter name', 'warning');
            $('#agentName').focus();
            return;
        }
        if (!/^[6-9][0-9]{9}$/.test(contact)) {
            Swal.fire('Warning!', 'Phone number must be 10 digits and start with 6, 7, 8 or 9.', 'warning');
            $('#agentContact').focus();
            return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            Swal.fire('Warning!', 'Please enter a valid email address.', 'warning');
            $('#agentEmail').focus();
            return;
        }
        if (!city) {
            Swal.fire('Warning!', 'Please enter city', 'warning');
            $('#agentCity').focus();
            return;
        }
        if (!state) {
            Swal.fire('Warning!', 'Please enter state', 'warning');
            $('#agentState').focus();
            return;
        }

        const button = $(this);
        if (button.prop('disabled')) return;
        button.prop('disabled', true);
        try {
            const record = await request(editId ? 'PUT' : 'POST', { id: editId, name, contact, email, city, state });
            if (editId) {
                const index = agents.findIndex(item => item.id === editId);
                if (index !== -1) agents[index] = record;
            } else { agents.unshift(record); }
            cacheRecords();
            renderTable();
            $('#agentModal').modal('hide');
            $('#agentForm')[0].reset();
            Swal.fire('Success!', 'Agent ' + (editId ? 'updated' : 'added') + ' successfully!', 'success');
        } catch (error) { showError(error); }
        finally { button.prop('disabled', false); }
    });

    $('#searchInput').on('keyup', function() {
        searchTerm = $(this).val();
        renderTable();
    });

    $('#agentModal').on('hidden.bs.modal', function() {
        $('#agentForm')[0].reset();
        $('#editId').val('');
        stateCity.reset();
    });
});
