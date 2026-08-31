$(document).ready(function() {
    let orders = [];
    let searchTerm = '';
    let statusFilter = 'all';
    let currentPage = 1;
    const pageSize = 10;

    loadOrders();

    function loadOrders() {
        const stored = localStorage.getItem('orders');
        orders = stored ? JSON.parse(stored) : [];
        renderTable();
    }

    function saveOrders() {
        localStorage.setItem('orders', JSON.stringify(orders));
    }

    function getFilteredOrders() {
        let filtered = orders;

        if (statusFilter !== 'all') {
            filtered = filtered.filter(o => (o.status || 'Active') === statusFilter);
        }

        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(o =>
                o.id.toLowerCase().includes(term) ||
                (o.customerName || '').toLowerCase().includes(term) ||
                (o.shopName || '').toLowerCase().includes(term)
            );
        }

        // Most recent orders first
        return filtered.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }

    function renderTable() {
        const filtered = getFilteredOrders();
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;

        const start = (currentPage - 1) * pageSize;
        const pageItems = filtered.slice(start, start + pageSize);

        const tbody = $('#orderTableBody');
        tbody.empty();

        if (pageItems.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="9" class="text-center text-muted py-4">
                        <i class="bx bx-receipt fs-2 d-block mb-2"></i>
                        No orders found
                    </td>
                </tr>
            `);
        } else {
            pageItems.forEach((order, index) => {
                const status = order.status || 'Active';
                tbody.append(`
                    <tr>
                        <td>${start + index + 1}</td>
                        <td>${order.id}</td>
                        <td>${order.customerName || 'N/A'}</td>
                        <td>${order.shopName || 'N/A'}</td>
                        <td>${order.deliveryDate || 'N/A'}</td>
                        <td>${order.totalSets ?? 0}</td>
                        <td>${order.totalPcs ?? 0}</td>
                        <td>
                            <div class="form-check form-switch mb-0">
                                <input class="form-check-input status-toggle" type="checkbox" role="switch"
                                    data-id="${order.id}" ${status === 'Active' ? 'checked' : ''}>
                                <label class="form-check-label fs-12">${status}</label>
                            </div>
                        </td>
                        <td class="text-center">
                            <div class="btn-group" role="group">
                                <a href="order-punch?id=${order.id}" class="btn btn-sm btn-primary" title="Edit">
                                    <i class="bx bx-edit"></i>
                                </a>
                                <button class="btn btn-sm btn-danger delete-btn" data-id="${order.id}" title="Delete">
                                    <i class="bx bx-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `);
            });
        }

        $('#paginationInfo').text(
            filtered.length === 0
                ? 'No orders'
                : `Showing ${start + 1}-${Math.min(start + pageSize, filtered.length)} of ${filtered.length} orders`
        );

        renderPagination(totalPages);

        $('.status-toggle').change(function() {
            const id = $(this).data('id');
            const checked = $(this).is(':checked');
            toggleStatus(id, checked);
        });

        $('.delete-btn').click(function() {
            showDeleteConfirmation($(this).data('id'));
        });
    }

    function renderPagination(totalPages) {
        const $pagination = $('#paginationControls');
        $pagination.empty();

        $pagination.append(`
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="javascript:void(0);" data-page="${currentPage - 1}">Prev</a>
            </li>
        `);

        for (let i = 1; i <= totalPages; i++) {
            $pagination.append(`
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="javascript:void(0);" data-page="${i}">${i}</a>
                </li>
            `);
        }

        $pagination.append(`
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="javascript:void(0);" data-page="${currentPage + 1}">Next</a>
            </li>
        `);

        $('.page-link').click(function() {
            const page = parseInt($(this).data('page'));
            if (!page || page < 1 || page > totalPages || page === currentPage) return;
            currentPage = page;
            renderTable();
        });
    }

    function toggleStatus(id, isActive) {
        const order = orders.find(o => o.id === id);
        if (!order) return;

        order.status = isActive ? 'Active' : 'Inactive';
        saveOrders();
        renderTable();

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Order marked ${order.status}`,
            timer: 1500,
            showConfirmButton: false
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
                orders = orders.filter(o => o.id !== id);
                saveOrders();
                renderTable();
                Swal.fire('Deleted!', 'Order has been deleted successfully.', 'success');
            }
        });
    }

    $('#searchInput').on('keyup', function() {
        searchTerm = $(this).val();
        currentPage = 1;
        renderTable();
    });

    $('#statusFilter').on('change', function() {
        statusFilter = $(this).val();
        currentPage = 1;
        renderTable();
    });
});
