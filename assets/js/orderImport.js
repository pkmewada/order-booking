/* One-time import of orders that were saved only in this browser before SAP Phase 1.
   Order import and PDF import are tracked separately in localStorage 'ordersServerImport'.
   Nothing in this browser is deleted: localStorage 'orders' and the IndexedDB PDFs stay as they are. */
$(function () {
    const RECORD = 'ordersServerImport';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch (_) { return fallback; } };
    const localOrders = () => { const rows = readJson('orders', []); return Array.isArray(rows) ? rows : []; };
    const keyOf = (order, index) => (order && typeof order.id === 'string' && order.id) ? order.id : 'entry-' + index;
    function record() {
        const saved = readJson(RECORD, {});
        return { orders: {}, pdfs: {}, ...saved };
    }
    function save(state) {
        state.updatedAt = new Date().toISOString();
        try { localStorage.setItem(RECORD, JSON.stringify(state)); } catch (_) { /* keep going; the import is idempotent */ }
    }

    function readLegacyPdf(key) {
        return new Promise(resolve => {
            if (!window.indexedDB) { resolve(null); return; }
            const open = indexedDB.open('order-booking-delivery-pdfs', 1);
            open.onupgradeneeded = () => open.result.createObjectStore('pdfs');
            open.onerror = () => resolve(null);
            open.onsuccess = () => {
                const db = open.result;
                try {
                    const get = db.transaction('pdfs').objectStore('pdfs').get(key);
                    get.onsuccess = () => { db.close(); resolve(get.result || null); };
                    get.onerror = () => { db.close(); resolve(null); };
                } catch (_) { db.close(); resolve(null); }
            };
        });
    }

    // Step A: orders. Each result is stored per order, so finished orders are never offered again.
    async function importOrders(state, pending) {
        for (let start = 0; start < pending.length; start += 200) {
            const chunk = pending.slice(start, start + 200);
            const results = await OrdersApi.importOrders(chunk.map(entry => entry.order));
            results.forEach((result, index) => { state.orders[chunk[index].key] = { result: result.result, message: result.message || '' }; });
            save(state);
        }
    }

    // Step B: PDFs, independent of step A and retried on every page load until the server has them.
    async function importPdfs(state) {
        const imported = localOrders().filter((order, index) => ['imported', 'alreadyImported'].includes(state.orders[keyOf(order, index)]?.result));
        const candidates = imported.flatMap(order => (order.deliveryBatches || []).filter(batch => batch?.pdf?.key && state.pdfs[batch.id] !== 'uploaded').map(batch => ({ order, batch })));
        if (!candidates.length) return 0;
        const server = new Map((await OrdersApi.list()).map(order => [order.id, order]));
        let uploaded = 0;
        for (const { order, batch } of candidates) {
            const serverBatch = (server.get(order.id)?.deliveryBatches || []).find(row => row.id === batch.id);
            if (!serverBatch || serverBatch.pdf?.state !== 'missing') {
                if (serverBatch?.pdf?.state === 'stored') state.pdfs[batch.id] = 'uploaded';
                continue;
            }
            const blob = await readLegacyPdf(batch.pdf.key);
            if (!blob) { state.pdfs[batch.id] = 'notInBrowser'; continue; }
            try {
                await OrdersApi.uploadPdf(batch.id, new File([blob], batch.pdf.name || 'Delivery.pdf', { type: 'application/pdf' }), 'import');
                state.pdfs[batch.id] = 'uploaded';
                uploaded++;
            } catch (error) {
                state.pdfs[batch.id] = error.status === 409 ? 'uploaded' : 'failed';
            }
        }
        save(state);
        return uploaded;
    }

    function showProblems(state) {
        $('#ordersImportBanner').remove();
        const local = localOrders();
        const problems = local.map((order, index) => ({ order, key: keyOf(order, index) }))
            .filter(entry => ['conflict', 'invalid'].includes(state.orders[entry.key]?.result));
        const failedPdfs = Object.values(state.pdfs).filter(value => value === 'failed').length;
        if (!problems.length && !failedPdfs) return;
        const lines = problems.map(entry => `<li>${esc(entry.key)}: ${esc(state.orders[entry.key].result)} - ${esc(state.orders[entry.key].message)}</li>`).join('');
        const banner = $(`<div id="ordersImportBanner" class="alert alert-warning mt-3" role="alert">
            <strong>Browser orders need attention.</strong> They were <u>not</u> imported and are still saved in this browser.
            ${failedPdfs ? `<div>${failedPdfs} delivery PDF(s) failed to upload; they are retried automatically on the next page load.</div>` : ''}
            ${lines ? `<ul class="mb-2 mt-2">${lines}</ul><button type="button" class="btn btn-sm btn-dark import-download">Download local copy</button>` : ''}</div>`);
        banner.find('.import-download').on('click', () => {
            const blob = new Blob([JSON.stringify(problems.map(entry => entry.order), null, 2)], { type: 'application/json' });
            const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'orders-not-imported.json' });
            document.body.appendChild(link); link.click();
            setTimeout(() => { link.remove(); URL.revokeObjectURL(link.href); }, 60000);
        });
        $('.main-content .container-fluid').first().prepend(banner);
    }

    async function run() {
        const local = localOrders();
        if (!local.length) return;
        const state = record();
        const pending = local.map((order, index) => ({ order, key: keyOf(order, index) })).filter(entry => !state.orders[entry.key]);
        try {
            if (pending.length) {
                const answer = await Swal.fire({ icon: 'info', title: 'Orders saved only in this browser',
                    text: `This browser has ${pending.length} order(s) that are not on the server yet. Import them now? Nothing in this browser is deleted.`,
                    showCancelButton: true, confirmButtonText: 'Import', cancelButtonText: 'Later' });
                if (answer.isConfirmed) {
                    await importOrders(state, pending);
                    const counts = pending.reduce((sum, entry) => { const result = state.orders[entry.key]?.result; sum[result] = (sum[result] || 0) + 1; return sum; }, {});
                    await Swal.fire({ icon: counts.conflict || counts.invalid ? 'warning' : 'success', title: 'Import finished',
                        text: `Imported: ${counts.imported || 0}. Already on server: ${counts.alreadyImported || 0}. Conflicts: ${counts.conflict || 0}. Invalid: ${counts.invalid || 0}.` });
                    OrdersApi.changed();
                }
            }
            if (await importPdfs(state)) OrdersApi.changed();
        } catch (error) {
            console.error('Browser order import failed:', error);
            Swal.fire({ title: 'Import paused', text: error.message + ' It will be retried on the next page load.', icon: 'warning' });
        }
        showProblems(state);
    }

    setTimeout(run, 300);
});
