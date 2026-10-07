$(document).ready(function() {
    // Global variables
    let employees = [];
    let currentFilter = 'all';
    let typeFilter = 'all';
    let searchTerm = '';

    async function request(method = 'GET', data) {
        const response = await fetch('api/employee.php', { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
        let result;
        try { result = await response.json(); } catch (_) { throw new Error('Invalid server response. Check Apache and database setup.'); }
        if (!response.ok || !result.success) throw new Error(result.message || 'Unable to complete request.');
        return result.data;
    }
    function cacheRecords() {
        try { localStorage.setItem('employees', JSON.stringify(employees)); } catch (error) { console.warn('Master cache unavailable', error); }
    }
    function escapeHtml(value) { return $('<div>').text(String(value ?? '')).html(); }
    async function loadRecords() {
        $('#addEmployeeBtn, #saveEmployeeBtn').prop('disabled', true);
        $('#employeeTableBody').html('<tr><td colspan="5" class="text-center py-4">Loading...</td></tr>');
        try {
            employees = await request(); cacheRecords(); renderTable();
            $('#addEmployeeBtn, #saveEmployeeBtn').prop('disabled', false);
        } catch (error) {
            $('#employeeTableBody').html('<tr><td colspan="5" class="text-center py-4">Unable to load records. Refresh after database setup.</td></tr>');
            Swal.fire('Unable to load', error.message, 'error');
        }
    }
    loadRecords();

    // Get category label
    function getCategoryLabel(category) {
        return category.charAt(0).toUpperCase() + category.slice(1);
    }

    // Get employee type label
    function getEmployeeTypeLabel(type) {
        if (type === 'housein') return 'House In';
        if (type === 'outsource') return 'Outsource';
        return type;
    }

    // Get badge class for employee type
    function getEmployeeTypeBadge(type) {
        if (type === 'housein') {
            return 'badge bg-success';
        } else if (type === 'outsource') {
            return 'badge bg-warning';
        }
        return 'badge bg-secondary';
    }

    // Render table with filters
    function renderTable() {
        const tbody = $('#employeeTableBody');
        tbody.empty();

        // Apply filters
        let filteredEmployees = employees;

        // Category filter
        if (currentFilter !== 'all') {
            filteredEmployees = filteredEmployees.filter(emp => emp.category === currentFilter);
        }

        // Type filter
        if (typeFilter !== 'all') {
            filteredEmployees = filteredEmployees.filter(emp => emp.employeeType === typeFilter);
        }

        // Search filter
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase().trim();
            filteredEmployees = filteredEmployees.filter(emp => 
                emp.name.toLowerCase().includes(term)
            );
        }

        if (filteredEmployees.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        <i class="bx bx-user-x fs-2 d-block mb-2"></i>
                        No employees found
                    </td>
                </tr>
            `);
            return;
        }

        filteredEmployees.forEach((emp, index) => {
            const categoryLabel = getCategoryLabel(emp.category);
            const typeLabel = getEmployeeTypeLabel(emp.employeeType);
            const typeBadge = getEmployeeTypeBadge(emp.employeeType);
            const serialNumber = index + 1;
            
            tbody.append(`
                <tr>
                    <td>${serialNumber}</td>
                    <td>${escapeHtml(emp.name)}</td>
                    <td>${categoryLabel}</td>
                    <td><span class="${typeBadge}">${typeLabel}</span></td>
                    <td class="text-center">
                        <div class="d-inline-flex gap-2" role="group">
                            <button class="btn btn-sm btn-primary edit-btn" 
                                data-id="${emp.id}" 
                                title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-dark text-white delete-btn" style="background-color:#000;border-color:#000;color:#fff;" 
                                data-id="${emp.id}" 
                                title="Delete">
                                <i class="bx bx-trash text-white"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `);
        });

        // Attach event listeners to buttons
        $('.edit-btn').click(function() {
            const id = $(this).data('id');
            openEditModal(id);
        });

        $('.delete-btn').click(function() {
            const id = $(this).data('id');
            showDeleteConfirmation(id);
        });
    }

    // Show delete confirmation with SweetAlert
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
                    await request('DELETE', { id }); employees = employees.filter(emp => emp.id !== id);
                    cacheRecords(); renderTable(); Swal.fire('Deleted!', 'Employee deleted successfully.', 'success');
                } catch (error) { Swal.fire('Unable to delete', error.message, 'error'); }
            }
        });
    }

    // Open Add Modal
    $('#addEmployeeBtn').click(function() {
        $('#employeeModalLabel').text('Add Employee');
        $('#editId').val('');
        $('#workerName').val('');
        $('#categorySelect').val('');
        $('#employeeTypeSelect').val('');
        $('#employeeModal').modal('show');
    });

    // Open Edit Modal
    function openEditModal(id) {
        const employee = employees.find(emp => emp.id === id);
        if (!employee) return;

        $('#employeeModalLabel').text('Edit Employee');
        $('#editId').val(employee.id);
        $('#workerName').val(employee.name);
        $('#categorySelect').val(employee.category);
        $('#employeeTypeSelect').val(employee.employeeType);
        $('#employeeModal').modal('show');
    }

    // Save Employee
    $('#saveEmployeeBtn').click(async function() {
        const editId = $('#editId').val();
        const workerName = $('#workerName').val().trim();
        const category = $('#categorySelect').val();
        const employeeType = $('#employeeTypeSelect').val();

        // Validation
        if (!workerName) {
            Swal.fire('Warning!', 'Please enter worker name', 'warning');
            $('#workerName').focus();
            return;
        }
        if (!category) {
            Swal.fire('Warning!', 'Please select a category', 'warning');
            $('#categorySelect').focus();
            return;
        }
        if (!employeeType) {
            Swal.fire('Warning!', 'Please select an employee type', 'warning');
            $('#employeeTypeSelect').focus();
            return;
        }

        // Check for duplicate name (excluding current if editing)
        const duplicate = employees.some((emp, index) => {
            if (editId && emp.id === editId) return false;
            return emp.name.toLowerCase() === workerName.toLowerCase();
        });

        if (duplicate) {
            Swal.fire('Warning!', 'Employee with this name already exists', 'warning');
            return;
        }

        const button = $(this);
        if (button.prop('disabled')) return;
        button.prop('disabled', true);
        try {
            const record = await request(editId ? 'PUT' : 'POST', { id: editId, name: workerName, category, employeeType });
            if (editId) { const index = employees.findIndex(emp => emp.id === editId); if (index !== -1) employees[index] = record; }
            else { employees.unshift(record); }
            cacheRecords(); renderTable(); $('#employeeModal').modal('hide'); $('#employeeForm')[0].reset();
            Swal.fire('Success!', 'Employee saved successfully.', 'success');
        } catch (error) { Swal.fire('Unable to save', error.message, 'error'); }
        finally { button.prop('disabled', false); }
    });

    // Filter functionality
    $('#categoryFilter').change(function() {
        currentFilter = $(this).val();
        renderTable();
    });

    // Type filter functionality
    $('#typeFilter').change(function() {
        typeFilter = $(this).val();
        renderTable();
    });

    // Search functionality
    $('#searchInput').on('keyup', function() {
        searchTerm = $(this).val();
        renderTable();
    });

    // Handle Enter key in forms
    $('#workerName, #categorySelect, #employeeTypeSelect').keypress(function(e) {
        if (e.which === 13) {
            e.preventDefault();
            $('#saveEmployeeBtn').click();
        }
    });

    // Reset form when modal is hidden
    $('#employeeModal').on('hidden.bs.modal', function() {
        $('#employeeForm')[0].reset();
        $('#editId').val('');
    });
});