$(document).ready(function() {
    let orders = [];
    let searchTerm = '';
    let statusFilter = 'all';
    let currentPage = 1;
    const pageSize = 10;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    loadOrders();

    // Orders come from MySQL (api/orders.php); every change is made and validated on the server.
    async function loadOrders() {
        try {
            orders = await OrdersApi.list();
        } catch (error) {
            orders = [];
            $('#orderTableBody').html(`<tr><td colspan="9" class="text-center text-danger py-4">${esc(error.message)}</td></tr>`);
            return;
        }
        renderTable();
    }

    function failed(error) {
        Swal.fire({ title: 'Not saved', text: error.message, icon: 'error' });
        loadOrders();
    }

    function getFilteredOrders() {
        let filtered = orders.filter(order => !order.dispatchPassedAt);

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
        renderPassedOrders();
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
                        <td>${esc(order.id)}</td>
                        <td>${esc(order.customerName || 'N/A')}</td>
                        <td>${esc(order.shopName || 'N/A')}</td>
                        <td>${esc(order.deliveryDate || 'N/A')}</td>
                        <td>${OrderQuantities.totals(order).sets}</td>
                        <td>${OrderQuantities.totals(order).pieces}</td>
                        <td>
                            <div class="form-check form-switch mb-0">
                                <input class="form-check-input status-toggle" type="checkbox" role="switch"
                                    data-id="${esc(order.id)}" ${status === 'Active' ? 'checked' : ''}>
                                <label class="form-check-label fs-12">${esc(status)}</label>
                            </div>
                        </td>
                        <td class="text-center">
                            <div class="d-inline-flex gap-2 bg-white p-1 rounded" role="group">
                                <button class="btn btn-sm btn-dark pass-btn" data-id="${esc(order.id)}" title="Pass to Dispatch" aria-label="Pass to Dispatch"><i class="bx bx-right-arrow-alt"></i></button>
                                <button class="btn btn-sm btn-dark pdf-btn" title="Download order PDF" aria-label="Download order PDF">
                                    <i class="bx bxs-file-pdf"></i>
                                </button>
                                <a href="order-punch?id=${encodeURIComponent(order.id)}" class="btn btn-sm btn-dark" title="Edit">
                                    <i class="bx bx-edit" style="color: #fff !important;"></i>
                                </a>
                                <button class="btn btn-sm btn-dark delete-btn" data-id="${esc(order.id)}" title="Delete">
                                    <i class="bx bx-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `);
                tbody.find('tr:last .pdf-btn').on('click', async function() {
                    const button = this;
                    button.disabled = true;
                    try {
                        await OrderPdf.download(order);
                    } catch (error) {
                        console.error('Order PDF export failed:', error);
                        Swal.fire('PDF failed', 'Could not generate the order PDF. Please try again.', 'error');
                    } finally {
                        button.disabled = false;
                    }
                });
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

        $('.pass-btn').click(function() {
            const id = String($(this).data('id'));
            this.disabled = true;
            OrdersApi.passToDispatch(id).then(() => {
                loadOrders();
                Swal.fire({icon:'success', title:'Passed to Dispatch', timer:1200, showConfirmButton:false});
            }).catch(error => {
                Swal.fire({ title: 'Could not pass', text: error.message, icon: 'error' });
                loadOrders();
            });
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

        $('#paginationControls .page-link').click(function() {
            const page = parseInt($(this).data('page'));
            if (!page || page < 1 || page > totalPages || page === currentPage) return;
            currentPage = page;
            renderTable();
        });
    }

    function toggleStatus(id, isActive) {
        const order = orders.find(o => o.id === id);
        if (!order) return;

        const status = isActive ? 'Active' : 'Inactive';
        OrdersApi.setStatus(order.id, order.version, status).then(() => {
            loadOrders();
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: `Order marked ${status}`,
                timer: 1500,
                showConfirmButton: false
            });
        }).catch(failed);
    }

    function renderPassedOrders() {
        const esc = value => String(value ?? '--').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const term = searchTerm.trim().toLowerCase();
        const passed = orders.filter(o => o.dispatchPassedAt && (!term || [o.id,o.customerName,o.shopName].some(v => String(v || '').toLowerCase().includes(term))))
            .sort((a,b) => String(b.dispatchPassedAt).localeCompare(String(a.dispatchPassedAt)));
        const body = $('#passedOrdersBody').empty();
        passed.forEach(order => {
            const totals = OrderQuantities.totals(order);
            const row = $(`<tr><td>${esc(order.id)}</td><td>${esc(order.shopName || order.customerName)}</td><td>${totals.sets}</td></tr>`);
            body.append(row);
        });
        $('#passedOrdersCount').text(orders.filter(o => o.dispatchPassedAt).length);
        $('#passedOrdersSummary').text(`${passed.length} orders · ${passed.reduce((sum,order) => sum + OrderQuantities.totals(order).sets, 0)} sets`);
        if (!passed.length) body.append('<tr><td colspan="3" class="text-center text-muted">No passed orders found.</td></tr>');
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
                const order = orders.find(o => o.id === id);
                if (!order) { loadOrders(); return; }
                OrdersApi.remove(order.id, order.version).then(() => {
                    loadOrders();
                    Swal.fire('Deleted!', 'Order has been deleted successfully.', 'success');
                }).catch(failed);
            }
        });
    }

    // Other devices change orders too: reload when this tab becomes active or an import finishes.
    window.addEventListener('focus', loadOrders);
    window.addEventListener('orders:changed', loadOrders);

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
