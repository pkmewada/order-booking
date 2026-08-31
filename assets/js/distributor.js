$(document).ready(function() {
    let distributors = [];
    let searchTerm = '';
    const stateCity = StateCity.init(document.getElementById('distributorState'), document.getElementById('distributorCity'));

    loadDistributors();

    function loadDistributors() {
        const stored = localStorage.getItem('distributors');
        distributors = stored ? JSON.parse(stored) : [];
        renderTable();
    }

    function saveToLocalStorage() {
        localStorage.setItem('distributors', JSON.stringify(distributors));
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
                    <td>${dist.name}</td>
                    <td>${dist.contact}</td>
                    <td>${dist.email}</td>
                    <td>${dist.city}</td>
                    <td>${dist.state}</td>
                    <td class="text-center">
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-primary edit-btn" data-id="${dist.id}" title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger delete-btn" data-id="${dist.id}" title="Delete">
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
                distributors = distributors.filter(d => d.id !== id);
                saveToLocalStorage();
                renderTable();
                Swal.fire('Deleted!', 'Distributor has been deleted successfully.', 'success');
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

    $('#saveDistributorBtn').click(function() {
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
        if (!contact) {
            Swal.fire('Warning!', 'Please enter contact number', 'warning');
            $('#distributorContact').focus();
            return;
        }
        if (!email) {
            Swal.fire('Warning!', 'Please enter email', 'warning');
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

        if (editId) {
            const index = distributors.findIndex(d => d.id === editId);
            if (index !== -1) {
                distributors[index] = { ...distributors[index], name, contact, email, city, state };
                Swal.fire('Success!', 'Distributor updated successfully!', 'success');
            }
        } else {
            distributors.push({ id: 'DIS' + Date.now(), name, contact, email, city, state });
            Swal.fire('Success!', 'Distributor added successfully!', 'success');
        }

        saveToLocalStorage();
        renderTable();
        $('#distributorModal').modal('hide');
        $('#distributorForm')[0].reset();
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
