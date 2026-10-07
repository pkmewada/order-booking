/* Counts match the available and current assignment tables, before pagination. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else { root.NavbarCounts = api; api.start(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const routes = {'cutting-manager':'cuttingData',embroidery:'addWork_embroidery','digital-print':'addWork_digital_print','screen-print':'addWork_screen_print',handwork:'addWork_hand_work',peco:'addWork_peco','stitching-manager':'stitchingData',ironing:'ironingData'};
    const unique = (rows, key) => new Set(rows.map(key)).size;
    const inventoryKey = r => String(r.designNumber ?? '').trim().toLowerCase() || `batch:${r.batchId}`;
    const lotId = r => r.packingLotId || `legacy-${r.id}`;
    const lotPassed = rows => rows.every(w => w.packingClosed || (w.passedQty > 0 && w.passedQty === w.inputQty - w.damageQty));
    function calculate(P, read) {
        const s = P.readState(), result = {};
        for (const [route,key] of Object.entries(routes)) {
            const stage = P.managers[key], rows = s[key];
            const available = s.approvedPool.filter(p => P.calculateAvailableQty(p, rows, stage) > 0).length;
            const assigned = rows.filter(w => P.status(w) !== 'passed').length;
            result[route] = {available, assigned, total: available + assigned};
        }
        const lots = new Map();
        s.packingData.forEach(w => { const id = lotId(w); if (!lots.has(id)) lots.set(id, []); lots.get(id).push(w); });
        const available = P.packingBatches(s).filter(b => !b.held && b.pieces.some(p => p.available > 0)).reduce((sum,b) => sum + b.pieces.length, 0);
        const assigned = [...lots.values()].filter(rows => !lotPassed(rows)).length;
        result.packing = {available, assigned, total: available + assigned};
        const ready = P.bundlingReady(s).length;
        const bundlingAssigned = s.bundlingData.filter(r => r.status !== 'passed').length;
        result.bundling = {available: ready, assigned: bundlingAssigned, total: ready + bundlingAssigned};
        Object.assign(result, {
            'bom-master': {total: read('bomMasterData').length},
            batch: {total: s.batchData.length},
            'batch-approval': {total: s.approvedBatchData.length || s.batchData.filter(b => b.status === 'approved').length},
            'damage-repair': {total: P.damageRepairs().length},
            requirment: {total: s.requirementData.filter(r => r.status !== 'completed').length},
            'final-production': {total: s.inventoryData.length},
            inventory: {total: unique([...s.inventoryData, ...s.approvedPool], inventoryKey)}
        });
        return result;
    }
    function start() {
        const links = [];
        const read = key => { const rows = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(rows) ? rows : []; };
        const names = new Set([...Object.keys(routes),'packing','bundling','bom-master','batch','batch-approval','damage-repair','requirment','final-production','inventory']);
        document.querySelectorAll('a.side-menu__item[href]').forEach(link => {
            const route = link.getAttribute('href').split(/[?#]/)[0].split('/').pop().replace(/\.php$/i, '').toLowerCase();
            if (!names.has(route)) return;
            const badge = document.createElement('span');
            badge.className = 'badge rounded-pill bg-danger ms-auto production-nav-count';
            link.appendChild(badge); links.push({badge, route});
        });
        function refresh() {
            if (!window.Production) return;
            try {
                const counts = calculate(Production, read);
                links.forEach(({badge, route}) => {
                    const count = counts[route], value = String(count.total);
                    if (badge.textContent !== value) badge.textContent = value;
                    badge.title = count.available === undefined ? `${value} records` : `Available: ${count.available} + Assigned: ${count.assigned}`;
                    badge.setAttribute('aria-label', badge.title);
                });
            } catch (_) { /* Recovery and invalid storage are handled by the owning page. */ }
        }
        function ready() { refresh(); window.addEventListener('storage', refresh); window.addEventListener('focus', refresh); window.setInterval(refresh, 1500); }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
    }
    return {calculate, start};
});
