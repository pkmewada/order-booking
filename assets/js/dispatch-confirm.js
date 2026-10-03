$(function () {
    const id = new URLSearchParams(window.location.search).get('id');
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function read() {
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        return Array.isArray(orders) ? orders : [];
    }
    function render() {
        const order = read().find(order => order.id === id);
        const button = $('#confirmDeliveryBtn').prop('disabled', true);
        const body = $('#confirmItems').empty();
        if (!order) {
            $('#confirmMessage').text('Order not found. Return to Dispatch to select an order.').addClass('text-danger');
            return;
        }
        $('#confirmOrderTitle').text('Order - ' + order.id);
        $('#confirmCustomer').text([order.customerName, order.shopName, 'Delivery: ' + (order.deliveryDate || '--')].filter(Boolean).join(' | '));
        const totals = OrderQuantities.totals(order);
        const scanned = (order.items || []).reduce((sum, item) => sum + OrderQuantities.scanned(item), 0);
        $('#confirmSummary').text(totals.sets + ' Sets | ' + totals.pieces + ' Pieces | Scanned: ' + scanned + ' | Remaining: ' + (totals.pieces - scanned));
        (order.items || []).forEach((item, index) => {
            const pieces = OrderQuantities.pieces(item);
            const count = OrderQuantities.scanned(item);
            body.append(`<tr><td>${index + 1}</td><td>${esc(item.description || item.itemDescription || item.itemCode || '--')}</td><td>${esc(item.barcode)}</td><td>${esc(item.brand)}</td><td>${esc(item.size)}</td><td>${OrderQuantities.sets(item)}</td><td>${OrderQuantities.perSet(item)}</td><td>${pieces}</td><td>${count}</td><td>${pieces - count}</td></tr>`);
        });
        const delivered = DispatchFlow.delivered(order);
        button.prop('disabled', !DispatchFlow.ready(order) || delivered).html(delivered ? 'Delivered' : '<i class="bx bx-check-circle me-1"></i>Confirm');
        $('#confirmMessage').removeClass('text-danger').text(delivered ? 'This order is already in Delivery.' : DispatchFlow.ready(order) ? 'Confirm to send all sets and pieces to Delivery.' : 'Scan all remaining pieces in Dispatch before confirming.');
    }
    $('#confirmDeliveryBtn').on('click', function () {
        this.disabled = true;
        try {
            const orders = read();
            const order = orders.find(order => order.id === id);
            if (!order) throw Error('This order was removed.');
            DispatchFlow.confirm(order);
            DispatchFlow.deliver(order);
            localStorage.setItem('orders', JSON.stringify(orders));
            window.location.href = 'delivery';
        } catch (error) {
            render();
            $('#confirmMessage').text(error.message).addClass('text-danger');
        }
    });
    window.addEventListener('storage', event => { if (event.key === 'orders') render(); });
    render();
});
