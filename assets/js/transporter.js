$(document).ready(function() {
    let transporters = [];
    let searchTerm = '';
    const stateCity = StateCity.init(document.getElementById('transporterState'), document.getElementById('transporterCity'));

    loadTransporters();

    function loadTransporters() {
        const stored = localStorage.getItem('transporters');
        transporters = stored ? JSON.parse(stored) : [];
        renderTable();
    }

    function saveToLocalStorage() {
        localStorage.setItem('transporters', JSON.stringify(transporters));
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
                    <td>${trans.name}</td>
                    <td>${trans.contact}</td>
                    <td>${trans.email}</td>
                    <td>${trans.city}</td>
                    <td>${trans.state}</td>
                    <td class="text-center">
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-primary edit-btn" data-id="${trans.id}" title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger delete-btn" data-id="${trans.id}" title="Delete">
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
                transporters = transporters.filter(t => t.id !== id);
                saveToLocalStorage();
                renderTable();
                Swal.fire('Deleted!', 'Transporter has been deleted successfully.', 'success');
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

    $('#saveTransporterBtn').click(function() {
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
        if (!contact) {
            Swal.fire('Warning!', 'Please enter contact number', 'warning');
            $('#transporterContact').focus();
            return;
        }
        if (!email) {
            Swal.fire('Warning!', 'Please enter email', 'warning');
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

        if (editId) {
            const index = transporters.findIndex(t => t.id === editId);
            if (index !== -1) {
                transporters[index] = { ...transporters[index], name, contact, email, city, state };
                Swal.fire('Success!', 'Transporter updated successfully!', 'success');
            }
        } else {
            transporters.push({ id: 'TRN' + Date.now(), name, contact, email, city, state });
            Swal.fire('Success!', 'Transporter added successfully!', 'success');
        }

        saveToLocalStorage();
        renderTable();
        $('#transporterModal').modal('hide');
        $('#transporterForm')[0].reset();
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
