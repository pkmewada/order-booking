/* Orders API client (SAP Phase 1). MySQL on the server is the source of truth and enforces every rule. */
window.OrdersApi = (() => {
    async function request(url, options = {}) {
        let response;
        try { response = await fetch(url, { cache: 'no-store', ...options }); }
        catch (_) { throw new Error('Cannot reach the server. Check the connection and try again.'); }
        let result;
        try { result = await response.json(); }
        catch (_) { throw new Error('Invalid server response. Check the database setup.'); }
        if (!response.ok || !result.success) {
            const error = new Error(result.message || 'Request failed.');
            error.status = response.status;
            throw error;
        }
        return result.data;
    }
    const post = body => request('api/orders.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const cache = (key, rows) => { try { localStorage.setItem(key, JSON.stringify(rows)); } catch (_) { /* cache is optional */ } };

    // Masters and products come from the database; the localStorage copies stay as compatibility caches.
    async function masters() {
        const [customers, agents, transporters, distributors] = await Promise.all(['customer', 'agent', 'transporter', 'distributor'].map(name => request('api/' + name + '.php')));
        cache('customers', customers); cache('agents', agents); cache('transporters', transporters); cache('distributors', distributors);
        return { customers, agents, transporters, distributors };
    }
    async function products() {
        const rows = (await request('api/bom.php')).filter(row => row.inProductList);
        cache('products', rows);
        return rows;
    }

    return {
        masters, products,
        list: () => request('api/orders.php'),
        get: id => request('api/orders.php?id=' + encodeURIComponent(id)),
        create: fields => post({ action: 'create', ...fields }),
        update: (id, version, fields) => post({ action: 'update', id, version, ...fields }),
        setStatus: (id, version, status) => post({ action: 'setStatus', id, version, status }),
        remove: (id, version) => post({ action: 'delete', id, version }),
        passToDispatch: id => post({ action: 'passToDispatch', id }),
        scan: (id, barcode) => post({ action: 'scan', id, barcode }),
        replaceItem: (id, version, itemId, productBarcode) => post({ action: 'replaceItem', id, version, itemId, productBarcode }),
        deliverPartial: (id, version, lines) => post({ action: 'deliverPartial', id, version, lines }),
        importOrders: orders => post({ action: 'import', orders }).then(data => data.results),
        uploadPdf(batchId, file, mode) {
            const body = new FormData();
            body.append('batchId', batchId);
            if (mode) body.append('mode', mode);
            body.append('file', file, file.name || 'Delivery.pdf');
            return request('api/delivery-pdf.php', { method: 'POST', body });
        },
        pdfUrl: batchId => 'api/delivery-pdf.php?batchId=' + encodeURIComponent(batchId),
        changed: () => window.dispatchEvent(new Event('orders:changed')),
    };
})();
