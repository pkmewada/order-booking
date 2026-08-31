$(document).ready(function() {
    // Global variables
    let employees = [];
    let currentFilter = 'all';
    let typeFilter = 'all';
    let searchTerm = '';

    // Indian names array
    const indianNames = [
        'Aarav Sharma', 'Vivaan Patel', 'Aditya Singh', 'Vihaan Kumar', 'Arjun Reddy',
        'Sai Krishna', 'Rahul Verma', 'Amit Gupta', 'Rajesh Kumar', 'Sanjay Singh',
        'Priya Sharma', 'Ananya Reddy', 'Diya Patel', 'Aisha Khan', 'Neha Gupta',
        'Meera Singh', 'Kavya Reddy', 'Sara Ali', 'Ishita Verma', 'Riya Sharma',
        'Rohan Desai', 'Suresh Nair', 'Ganesh Iyer', 'Karthik Raj', 'Manoj Pillai',
        'Deepak Joshi', 'Prakash Rao', 'Vikram Singh', 'Naveen Kumar', 'Ravi Shankar'
    ];

    // Load employees on page load
    loadEmployees();

    // Generate worker ID (hidden from UI)
    function generateWorkerId() {
        const prefix = 'WRK';
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return prefix + timestamp + random;
    }

    // Load employees from localStorage or initialize with sample data
    function loadEmployees() {
        const stored = localStorage.getItem('employees');
        if (stored) {
            employees = JSON.parse(stored);
        } else {
            // Sample data with Indian names and employee types
            employees = [
                { id: generateWorkerId(), name: 'Aarav Sharma', category: 'cutting', employeeType: 'housein' },
                { id: generateWorkerId(), name: 'Priya Reddy', category: 'stitching', employeeType: 'outsource' },
                { id: generateWorkerId(), name: 'Rajesh Kumar', category: 'ironing', employeeType: 'housein' },
                { id: generateWorkerId(), name: 'Ananya Patel', category: 'cutting', employeeType: 'outsource' },
                { id: generateWorkerId(), name: 'Rahul Verma', category: 'stitching', employeeType: 'housein' },
                { id: generateWorkerId(), name: 'Neha Singh', category: 'ironing', employeeType: 'outsource' }
            ];
            saveToLocalStorage();
        }
        renderTable();
    }

    // Save to localStorage
    function saveToLocalStorage() {
        localStorage.setItem('employees', JSON.stringify(employees));
    }

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
                    <td>${emp.name}</td>
                    <td>${categoryLabel}</td>
                    <td><span class="${typeBadge}">${typeLabel}</span></td>
                    <td class="text-center">
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-primary edit-btn" 
                                data-id="${emp.id}" 
                                title="Edit">
                                <i class="bx bx-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger delete-btn" 
                                data-id="${emp.id}" 
                                title="Delete">
                                <i class="bx bx-trash"></i>
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
        }).then((result) => {
            if (result.isConfirmed) {
                employees = employees.filter(emp => emp.id !== id);
                saveToLocalStorage();
                renderTable();
                Swal.fire(
                    'Deleted!',
                    'Employee has been deleted successfully.',
                    'success'
                );
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
    $('#saveEmployeeBtn').click(function() {
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

        if (editId) {
            // Update existing employee
            const index = employees.findIndex(emp => emp.id === editId);
            if (index !== -1) {
                employees[index] = {
                    ...employees[index],
                    name: workerName,
                    category: category,
                    employeeType: employeeType
                };
                Swal.fire('Success!', 'Employee updated successfully!', 'success');
            }
        } else {
            // Add new employee
            const workerId = generateWorkerId();
            employees.push({
                id: workerId,
                name: workerName,
                category: category,
                employeeType: employeeType
            });
            Swal.fire('Success!', 'Employee added successfully!', 'success');
        }

        saveToLocalStorage();
        renderTable();
        $('#employeeModal').modal('hide');
        $('#employeeForm')[0].reset();
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