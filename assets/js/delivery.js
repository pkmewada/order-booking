$(function () {
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let page = 1;
    function render() {
        const term = String($('#searchInput').val() || '').trim().toLowerCase();
        const orders = JSON.parse(localStorage.getItem('orders') || '[]').filter(order => DispatchFlow.delivered(order) && [order.id, order.customerName, order.shopName].some(value => String(value || '').toLowerCase().includes(term))).sort((a, b) => String(b.deliveredAt).localeCompare(String(a.deliveredAt)));
        const pages = Math.max(1, Math.ceil(orders.length / 10)); page = Math.min(page, pages);
        const start = (page - 1) * 10;
        const body = $('#orderTableBody').empty();
        orders.slice(start, start + 10).forEach(order => {
            const totals = (order.items || []).reduce((total, item) => {
                const count = DispatchFlow.deliveredPieces(order, item);
                const perSet = OrderQuantities.perSet(item);
                return {sets: total.sets + Math.floor(count / perSet), extra: total.extra + count % perSet, pieces: total.pieces + count};
            }, {sets:0, extra:0, pieces:0});
            const quantity = totals.sets + ' Sets' + (totals.extra ? ' + ' + totals.extra + ' Pieces' : '') + ' (' + totals.pieces + ' Pieces)';
            const row = $('<tr><td>' + esc(order.id) + '</td><td>' + esc(order.customerName) + '</td><td>' + esc(order.shopName) + '</td><td>' + esc(order.deliveryDate || '--') + '</td><td>' + quantity + '</td><td><span class="badge bg-success">Delivered</span></td><td><button type="button" class="btn btn-sm btn-dark"><i class="bx bx-show me-1"></i>View</button></td></tr>');
            row.find('button').on('click', () => OrderDetails.show(order,true));
            body.append(row);
        });
        if (!orders.length) body.append('<tr><td colspan="7" class="text-center text-muted py-4">No delivered orders found</td></tr>');
        $('#paginationInfo').text(orders.length ? 'Showing ' + (start + 1) + '-' + Math.min(start + 10, orders.length) + ' of ' + orders.length + ' orders' : 'No orders');
        const controls = $('#paginationControls').empty();
        function button(label, target, disabled, active) {
            const li = $('<li>', {class: 'page-item' + (disabled ? ' disabled' : '') + (active ? ' active' : '')});
            $('<button>', {type: 'button', class: 'page-link', text: label, disabled}).on('click', () => {page = target; render();}).appendTo(li); controls.append(li);
        }
        button('Prev', page - 1, page === 1);
        for (let i = 1; i <= pages; i++) button(i, i, false, i === page);
        button('Next', page + 1, page === pages);
    }
    $('#searchInput').on('input', () => {page = 1; render();});
    window.addEventListener('storage', event => {if (event.key === 'orders') render();});
    render();
});
