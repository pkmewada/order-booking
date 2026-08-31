$(document).ready(function() {
    let agents = [];
    let searchTerm = '';
    const stateCity = StateCity.init(document.getElementById('agentState'), document.getElementById('agentCity'));

    loadAgents();

    function loadAgents() {
        const stored = localStorage.getItem('agents');
        agents = stored ? JSON.parse(stored) : [];
        renderTable();
    }

    function saveToLocalStorage() {
        localStorage.setItem('agents', JSON.stringify(agents));
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
                    <td>${agent.name}</td>
                    <td>${agent.contact}</td>
                    <td>${agent.email}</td>
                    <td>${agent.city}</td>
                    <td>${agent.state}</td>
                    <td class="text-center">
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-primary edit-btn" data-id="${agent.id}" title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger delete-btn" data-id="${agent.id}" title="Delete">
                                <i class="bx bx-trash"></i>
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
        }).then((result) => {
            if (result.isConfirmed) {
                agents = agents.filter(a => a.id !== id);
                saveToLocalStorage();
                renderTable();
                Swal.fire('Deleted!', 'Agent has been deleted successfully.', 'success');
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

    $('#saveAgentBtn').click(function() {
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
        if (!contact) {
            Swal.fire('Warning!', 'Please enter contact number', 'warning');
            $('#agentContact').focus();
            return;
        }
        if (!email) {
            Swal.fire('Warning!', 'Please enter email', 'warning');
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

        if (editId) {
            const index = agents.findIndex(a => a.id === editId);
            if (index !== -1) {
                agents[index] = { ...agents[index], name, contact, email, city, state };
                Swal.fire('Success!', 'Agent updated successfully!', 'success');
            }
        } else {
            agents.push({ id: 'AGT' + Date.now(), name, contact, email, city, state });
            Swal.fire('Success!', 'Agent added successfully!', 'success');
        }

        saveToLocalStorage();
        renderTable();
        $('#agentModal').modal('hide');
        $('#agentForm')[0].reset();
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
