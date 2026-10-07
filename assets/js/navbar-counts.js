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
            batch: {total: s.batchData.filter(b => b.status !== 'approved' && !b.passedAt).length},
            'batch-approval': {total: (s.approvedBatchData.length ? s.approvedBatchData : s.batchData.filter(b => b.status === 'approved')).filter(b => !(b.pieces || []).length || b.pieces.some(p => !['pass','in_progress'].includes(p.approval?.status || 'pending'))).length},
            'damage-repair': {total: P.damageRepairs().length},
            requirment: {total: unique(s.requirementData.filter(r => r.status !== 'completed'), r => JSON.stringify([r.batchId || r.designNumber, r.pieceNumber ?? r.pieceId ?? r.id]))},
            'final-production': {total: s.inventoryData.length},
            inventory: {total: unique([...s.inventoryData, ...s.approvedPool], inventoryKey)}
        });
        return result;
    }
    function start() {
        const links = [];
        const read = key => { const rows = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(rows) ? rows : []; };
        const names = new Set([...Object.keys(routes),'packing','bundling','batch','batch-approval','damage-repair','requirment','final-production','inventory']);
        document.querySelectorAll('a.side-menu__item[href]').forEach(link => {
            const route = link.getAttribute('href').split(/[?#]/)[0].split('/').pop().replace(/\.php$/i, '').toLowerCase();
            if (!names.has(route)) return;
            const wrapper = document.createElement('span');
            wrapper.className = 'd-inline-flex gap-1 ms-auto';
            const split = Object.hasOwn(routes, route) || route === 'packing' || route === 'bundling';
            function makeBadge(label, blue) {
                const badge = document.createElement('span');
                badge.className = 'badge rounded-pill production-nav-count ' + (blue ? 'production-nav-assigned' : 'production-nav-unassigned');
                badge.style.cssText = `background-color:${blue ? '#0d6efd' : '#dc3545'} !important;color:#fff !important;`;
                badge.title = label;
                wrapper.appendChild(badge);
                return badge;
            }
            const badge = makeBadge(split ? 'Unassigned' : 'Pending', false);
            const assignedBadge = split ? makeBadge('Assigned', true) : null;
            link.appendChild(wrapper); links.push({badge, assignedBadge, route});
        });
        function refresh() {
            if (!window.Production) return;
            try {
                const counts = calculate(Production, read);
                links.forEach(({badge, assignedBadge, route}) => {
                    const count = counts[route];
                    const value = String(assignedBadge ? count.available : count.total);
                    if (badge.textContent !== value) badge.textContent = value;
                    badge.title = assignedBadge ? `Unassigned: ${value}` : `${value} records`;
                    badge.setAttribute('aria-label', badge.title);
                    if (assignedBadge) {
                        const assigned = String(count.assigned);
                        if (assignedBadge.textContent !== assigned) assignedBadge.textContent = assigned;
                        assignedBadge.title = `Assigned: ${assigned}`;
                        assignedBadge.setAttribute('aria-label', assignedBadge.title);
                    }
                });
            } catch (_) { /* Recovery and invalid storage are handled by the owning page. */ }
        }
        function ready() { refresh(); window.addEventListener('storage', refresh); window.addEventListener('focus', refresh); window.setInterval(refresh, 1500); }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
    }
    return {calculate, start};
});
