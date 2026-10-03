(function (root) {
    const Q = root.OrderQuantities;
    const items = order => Array.isArray(order.items) ? order.items : [];
    const signature = order => JSON.stringify(items(order).map(item => [item.barcode, item.brand, item.size, Q.sets(item), Q.perSet(item)]));
    const ready = order => items(order).length > 0 && items(order).every(item => Q.checked(item));
    const deliveredPieces = (order, item) => Math.min(Q.pieces(item), Math.max(0, Number(item.dispatchDeliveredPieces) || (order.deliveredAt && !order.deliveryBatches ? Q.pieces(item) : 0)));
    const confirmed = order => items(order).length > 0 && items(order).every(item => deliveredPieces(order, item) >= Q.pieces(item));
    const status = order => confirmed(order) ? 'Completed' : items(order).some(item => Q.scanned(item) > 0) ? 'In Progress' : 'Pending';
    root.DispatchFlow = {
        ready, confirmed, status,
        delivered: order => items(order).some(item => deliveredPieces(order, item) > 0),
        deliveredPieces,
        available: (order, item) => Math.max(0, Q.scanned(item) - deliveredPieces(order, item)),
        deliverPartial(order, selections) {
            if (!order.dispatchPassedAt) throw Error('Pass this order from Order List first.');
            if (selections.length !== items(order).length) throw Error('Order changed. Reopen delivery details.');
            const rows = items(order).map((item, index) => {
                const sets = Number(selections[index]);
                const count = sets * Q.perSet(item);
                const available = Math.max(0, Q.scanned(item) - deliveredPieces(order, item));
                if (!Number.isInteger(sets) || sets < 0 || count > available) throw Error('Pass only whole sets within the available scanned quantity.');
                return {item, count, previous: deliveredPieces(order, item)};
            });
            if (!rows.some(row => row.count > 0)) throw Error('Choose at least one complete set to pass.');
            const timestamp = new Date().toISOString();
            const batch = {id: 'DLV' + Date.now(), createdAt: timestamp, items: []};
            rows.forEach(({item, count, previous}) => {
                item.dispatchDeliveredPieces = previous + count;
                if (count) batch.items.push({barcode:item.barcode, description:item.description, brand:item.brand, size:item.size, piecesPerSet:Q.perSet(item), sets:count / Q.perSet(item), pieces:count});
            });
            order.deliveryBatches = (order.deliveryBatches || []).concat(batch);
            order.deliveredAt = timestamp;
            order.deliveryStatus = 'Delivered';
            order.dispatchStatus = status(order);
            if (confirmed(order)) { order.dispatchConfirmedAt = timestamp; order.dispatchCompletedAt = timestamp; order.dispatchConfirmedItems = signature(order); }
        },
        scan(order, barcode) {
            if (confirmed(order)) throw Error('This dispatch has already been confirmed.');
            const matches = items(order).filter(item => String(item.barcode || '').trim() === String(barcode).trim());
            const item = matches.find(item => !Q.checked(item));
            if (!item) throw Error(matches.length ? 'All required pieces for this barcode have been scanned.' : 'This barcode is not in the selected order.');
            item.dispatchScannedPieces = Q.scanned(item) + 1;
            item.dispatchChecked = Q.checked(item);
            order.dispatchStatus = status(order);
            return item;
        },
        confirm(order) {
            if (!ready(order)) throw Error('Scan all required pieces before confirming dispatch.');
            order.dispatchConfirmedAt = order.dispatchConfirmedAt || new Date().toISOString();
            order.dispatchConfirmedItems = signature(order);
            order.dispatchCompletedAt = order.dispatchConfirmedAt;
            order.dispatchStatus = 'Completed';
        },
        deliver(order) {
            if (!confirmed(order)) throw Error('Confirm dispatch before delivery.');
            order.deliveredAt = order.deliveredAt || new Date().toISOString();
            order.deliveryStatus = 'Delivered';
        }
    };
})(window);
