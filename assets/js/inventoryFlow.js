$(function () {
    'use strict';
    const P = Production, stages = ['Cutting', 'Embroidery', 'Digital Print', 'Screen Print', 'Hand Work', 'Peco', 'Stitching', 'Ironing', 'Packing'];
    const n = v => Math.max(0, Number(v) || 0), esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const key = r => String(r.designNumber ?? '').trim().toLowerCase() || `batch:${r.batchId}`;
    const date = v => v ? esc(new Date(v).toLocaleString()) : '-';
    const sum = (rows, k) => rows.reduce((t, w) => t + n(w[k]), 0);
    let active = null, signature = '', details = [], pinned = false, selectedDetail = null;
    const modal = document.getElementById('stockFlowModal');
    const panel = document.createElement('div'); panel.className = 'stock-stage-popup'; panel.hidden = true; panel.id = 'stockStagePopup'; panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Stage assignment details'); modal.appendChild(panel);
    function updates(events) {
        return [...events].sort((a, b) => String(a.at || '').localeCompare(String(b.at || ''))).map(h => `<div class="stock-inline-update"><time>${date(h.at)}</time><span>${esc(h.action)} &middot; Qty: ${n(h.qty)}</span>${h.fromStage ? `<div>${esc(h.fromStage)} &rarr; ${esc(h.toStage || '-')}</div>` : ''}${h.after ? `<div>Completed: ${n(h.after.completedQty)} &middot; Damage: ${n(h.after.damageQty)} &middot; Passed: ${n(h.after.passedQty)}</div>` : ''}</div>`).join('');
    }
    function worker(w, events = []) {
        const fields = [['Lot / Assignment', w.packingLotId || w.subBatch || w.id], ['Worker', w.worker || '-'], ['Firm', w.firm || '-'], ['Type', w.type || 'In-house'], ['Assigned', n(w.assignedQty ?? w.quantity)], ['Completed', n(w.completedQty ?? w.progress)], ['Damage', n(w.damageQty ?? w.damage)], ['Passed', n(w.passedQty)], ['Delivery', w.deliveryDate || '-'], ['Rate', w.rate ?? '-'], ['Status', w.stopped ? 'On hold' : w.status || 'Pending']];
        const progress = (w.progressHistory || []).map(h => ({ at: h.at, action: `Completed ${n(h.before)} to ${n(h.completedQty)}`, qty: Math.max(0, n(h.completedQty) - n(h.before)) }));
        return `<section class="stock-worker"><strong>${esc(w.worker || w.firm || 'Worker not recorded')}</strong><dl>${fields.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}<dt>Assigned at</dt><dd>${date(w.createdAt || w.assignedAt)}</dd><dt>Passed at</dt><dd>${date(w.passedAt)}</dd></dl>${w.notes || w.remarks ? `<p>${esc(w.notes || w.remarks)}</p>` : ''}${updates([...events, ...progress])}</section>`;
    }
    function cell(title, input, rows, events = [], note = '', action) {
        const pairedCutting = action?.componentIds?.length && rows.some(work => work.componentId != null);
        const componentTotal = (field, mode = 'min') => {
            if (!pairedCutting) return sum(rows, field);
            const totals = action.componentIds.map(id => sum(rows.filter(work => String(work.componentId) === String(id)), field));
            return totals.length ? (mode === 'max' ? Math.max(...totals) : Math.min(...totals)) : 0;
        };
        const assigned = componentTotal('assignedQty');
        const completed = componentTotal('completedQty');
        const passed = componentTotal('passedQty');
        const damage = pairedCutting ? Math.min(assigned, componentTotal('damageQty', 'max')) : componentTotal('damageQty');
        const index = details.length, fullyPassed = input > 0 && passed > 0 && passed + damage >= input && !rows.some(w => w.stopped);
        const belongs = (h, w) => h.sourceWorkId != null && String(h.sourceWorkId) === String(w.id) && (h.sourceKey ? h.sourceKey === w.storageKey : (h.fromStage || h.stage) === w.stage);
        const general = events.filter(h => !rows.some(w => belongs(h, w)));
        const actionState = action ? InventoryActions.getActionState(action.stage, action.batchId, action.poolId) : null;
        const poolAttribute = action?.poolId ? `data-pool="${esc(action.poolId)}"` : '';
        const actionButtons = action ? `<div class="stock-flow-actions"><button type="button" class="btn btn-sm stock-flow-action stock-flow-assign" data-action="assign" data-stage="${esc(action.stage)}" data-batch="${esc(action.batchId)}" ${poolAttribute} ${actionState.assign ? '' : 'disabled'}><i class="bx bx-user-plus me-1" aria-hidden="true"></i>Assign</button><button type="button" class="btn btn-sm stock-flow-action stock-flow-pass" data-action="pass" data-stage="${esc(action.stage)}" data-batch="${esc(action.batchId)}" ${poolAttribute} ${actionState.pass ? '' : 'disabled'}><i class="bx bx-check-circle me-1" aria-hidden="true"></i>Pass</button></div>` : '';
        details.push(`<div class="stock-popup-title"><strong>${esc(title)}</strong><button type="button" class="stock-popup-close" aria-label="Close details">&times;</button></div>${note ? `<p class="small">${esc(note)}</p>` : ''}<div class="stock-popup-totals">Received: <b>${input}</b> &middot; Assigned: <b>${assigned}</b><br>Completed: <b>${completed}</b> &middot; Passed: <b>${passed}</b><br><span class="stock-damage">Damage: ${damage}</span> &middot; To complete: <b>${Math.max(0, input - completed - damage)}</b>${updates(general)}</div>${rows.map(w => worker(w, events.filter(h => belongs(h, w)))).join('') || '<p class="small mt-3">No worker assigned yet.</p>'}`);
        const state = fullyPassed ? 'passed' : rows.length ? 'in-progress' : 'not-started';
        return `<div class="stock-stage-wrap"><button type="button" class="stock-stage-cell stock-stage-${state}" data-detail="${index}" data-stage="${esc(action?.stage || title.split(' - Piece ')[0])}" data-batch="${esc(action?.batchId || '')}" ${action?.poolId ? `data-pool="${esc(action.poolId)}"` : ''} aria-label="${esc(title)}: ${state}, assigned ${assigned}, passed ${passed}" aria-controls="stockStagePopup"><span class="stock-stage-quantities"><strong class="stock-qty-assigned">${assigned}</strong> <span aria-hidden="true">&rarr;</span> <strong class="stock-qty-passed">${passed}</strong></span>${damage ? `<small class="stock-damage">${damage} damage</small>` : ''}<small class="stock-cell-hint">${rows.length} assignment${rows.length === 1 ? '' : 's'}</small><span class="stock-stage-detail" aria-hidden="true"><i class="bx bx-show"></i></span></button>${actionButtons}</div>`;
    }
    function render() {
        const previousDetail = pinned ? selectedDetail : null;
        const s = P.readState(); signature = JSON.stringify(s); details = []; panel.hidden = true; pinned = false;
        const receipts = s.inventoryData.filter(r => key(r) === active), batches = new Map(), pools = new Map(), works = new Map();
        receipts.forEach(r => { if (r.batchDocument?.batchId) batches.set(String(r.batchId), r.batchDocument); (r.productionHistory || []).forEach(p => pools.set(String(p.id), p)); (r.packingHistory || []).forEach(w => works.set(`Packing:${w.id}`, { ...P.normalizeWork(w, 'packingData'), stage: 'Packing' })); });
        [...s.batchData, ...s.approvedBatchData].filter(b => key(b) === active).forEach(b => batches.set(String(b.batchId), b));
        s.approvedPool.filter(p => key(p) === active).forEach(p => pools.set(String(p.id), p));
        [...pools.values()].forEach(p => { if (!batches.has(String(p.batchId))) batches.set(String(p.batchId), p); (p.stageHistory || []).forEach(h => { const storageKey = Object.keys(P.managers).find(k => P.managers[k] === h.stage); if (h.after?.id && storageKey) works.set(`${h.stage}:${h.after.id}`, P.normalizeWork(h.after, storageKey)); }); });
        Object.entries(P.managers).forEach(([k, stage]) => (s[k] || []).forEach(w => works.set(`${stage}:${w.id}`, P.normalizeWork(w, k))));
        const allWorks = [...works.values()];
        $('#stockFlowTitle').text(`Production Details - ${[...batches.values()][0]?.designNumber || active}`);
        const rows = [...batches].map(([id, b]) => {
            const batchPools = [...pools.values()].filter(p => String(p.batchId) === id), pieces = new Map();
            (b.pieces || []).forEach((piece, i) => pieces.set(String(piece.number || i + 1), { piece: { ...piece, number: piece.number || i + 1 }, pool: null }));
            batchPools.forEach(p => pieces.set(String(p.pieceNumber), { piece: pieces.get(String(p.pieceNumber))?.piece || { number: p.pieceNumber, item: p.pieceItem }, pool: p }));
            if (!pieces.size) return '';
            const received = receipts.filter(r => String(r.batchId) === id).reduce((t, r) => t + n(r.quantity), 0), total = n(b.quantity ?? batchPools[0]?.quantity);
            const bundleRows = s.bundlingData.filter(r => String(r.batchId) === id).map(r => ({ ...r, assignedQty: n(r.quantity), completedQty: r.status === 'passed' ? n(r.quantity) : n(r.completedQty), passedQty: r.status === 'passed' ? n(r.quantity) : 0, damageQty: n(r.damageQty) }));
            const packingPassed = [...pieces.values()].map(({ pool }) => pool ? sum(allWorks.filter(w => w.stage === 'Packing' && String(w.poolId) === String(pool.id)), 'passedQty') : 0);
            const bundlingInput = Math.min(...packingPassed);
            return [...pieces.values()].map(({ piece, pool }, i) => {
                const p = pool || { id: `pending-${id}-${piece.number}`, stageBalances: {}, stageHistory: [] }, pieceWorks = allWorks.filter(w => String(w.poolId) === String(p.id));
                const route = p.route?.length ? p.route : P.buildRoute(piece);
                const stageCells = stages.map(stage => {
                    const assignments = pieceWorks.filter(w => w.stage === stage), events = (p.stageHistory || []).filter(h => h.stage === stage || h.fromStage === stage || h.toStage === stage);
                    const balance = p.stageBalances?.[stage]?.inputQty, input = balance == null ? sum(assignments, 'assignedQty') : n(balance);
                    if (!input && !assignments.length) return `<td><span class="stock-not-started" title="${route.some(r => r.stage === stage) ? 'Not reached yet' : 'Not in this piece route'}">&mdash;</span></td>`;
                    const action = stage === 'Packing'
                        ? (i === 0 ? { stage, batchId: id } : null)
                        : pool ? {
                            stage,
                            batchId: id,
                            poolId: p.id,
                            ...(stage === 'Cutting' ? { componentIds: (p.cuttingComponents || []).filter(component => component.available).map(component => component.id) } : {})
                        } : null;
                    return `<td>${cell(`${stage} - Piece ${piece.number}`, input, assignments, events, '', action)}</td>`;
                }).join('');
                return `<tr>${i ? '' : `<td rowspan="${pieces.size}">${esc(b.brand || batchPools[0]?.brand || '-')}</td><td rowspan="${pieces.size}"><strong>${esc(b.designNumber || '-')}</strong><small class="d-block">${esc(id)}</small><small class="d-block">${esc(b.color || '-')}</small></td>`}<td class="stock-piece-label"><strong>Piece ${esc(piece.number)}</strong><small class="d-block">${esc(piece.item || p.pieceItem || '-')}</small>${piece.size ? `<small>${esc(piece.size)}</small>` : ''}</td><td>${total}</td>${stageCells}${i ? '' : `<td rowspan="${pieces.size}">${bundlingInput || bundleRows.length ? cell('Bundling', bundlingInput, bundleRows, [], 'Combined garment quantity for all pieces in this batch; counted once.', { stage: 'Bundling', batchId: id }) : '&mdash;'}</td><td rowspan="${pieces.size}">${received}</td>`}</tr>`;
            }).join('');
        }).join('');
        $('#stockFlowBody').html(`<p class="stock-table-guide">Stage quantities: <strong>Assigned &rarr; Passed</strong>. Damage is shown in red. Hover, focus or tap a stage for worker assignments, dates and progress. Bundling and inventory are combined garment quantities.</p><div class="stock-detail-scroll"><table class="stock-detail-table"><thead><tr>${['Brand', 'Design / Batch', 'Piece', 'Production', ...stages, 'Bundling', 'Inventory'].map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${stages.length + 6}">No piece records available.</td></tr>`}</tbody></table></div>`);
        $('#stockFlowBody .stock-table-guide').text('Select a production stage to view its assignments and available actions. Damage is shown in red. Bundling and inventory are combined garment quantities.');
        if (previousDetail) {
            const cell = [...document.querySelectorAll('.stock-stage-cell')].find(item =>
                item.dataset.batch === previousDetail.batch && item.dataset.stage === previousDetail.stage && (item.dataset.pool || '') === previousDetail.pool);
            if (cell) show(cell, true);
        }
    }
    function show(button, pin = false) {
        const cell = button.closest('.stock-stage-cell'), index = Number(cell.dataset.detail), html = details[index];
        if (!html) return;
        pinned = pin;
        selectedDetail = { batch: cell.dataset.batch, stage: cell.dataset.stage, pool: cell.dataset.pool || '' };
        panel.innerHTML = html;
        panel.hidden = false;
        panel.style.width = '370px';
        const r = cell.getBoundingClientRect(), width = panel.offsetWidth, height = panel.offsetHeight;
        panel.style.left = '10px';
        panel.style.left = `${Math.max(10, Math.min(r.left, window.innerWidth - width - 10))}px`;
        panel.style.top = `${Math.max(10, Math.min(r.bottom + 6, window.innerHeight - height - 10))}px`;
    }
    $(document).on('click', '.stock-stage-cell', function () { show(this, true); });
    $(document).on('keydown', '.stock-stage-cell', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); show(this, true); } });
    $(panel).on('click', '.stock-popup-close', () => { pinned = false; selectedDetail = null; panel.hidden = true; });
    $(document).on('keydown', e => { if (e.key === 'Escape') { pinned = false; panel.hidden = true; } });
    $(document).on('click', e => { if (!e.target.closest('.stock-stage-cell,.stock-stage-popup')) { pinned = false; selectedDetail = null; panel.hidden = true; } });
    $('#stockFlowModal').on('hidden.bs.modal', function () {
        panel.hidden = true; pinned = false; selectedDetail = null;
        if (this.dataset.preserveInventoryDetail === 'true') delete this.dataset.preserveInventoryDetail;
        else active = null;
    });
    $(document).on('click', '.stock-detail', function () { active = String($(this).attr('data-design')); try { render(); bootstrap.Modal.getOrCreateInstance(modal).show(); } catch (e) { Swal.fire({ icon: 'error', title: 'Unable to load production details', text: e.message }); } });
    $(document).on('click', '.stock-flow-action', function (event) {
        event.stopPropagation();
        InventoryActions.open(String($(this).attr('data-action')), String($(this).attr('data-stage')), String($(this).attr('data-batch')), String($(this).attr('data-pool') || ''));
    });
    const refresh = () => { if (active && modal.classList.contains('show')) try { if (JSON.stringify(P.readState()) !== signature) render(); } catch (e) { $('#stockFlowBody').text(e.message); } };
    window.addEventListener('storage', refresh); window.addEventListener('focus', refresh); window.addEventListener('inventory-flow-update', refresh); setInterval(refresh, 3000);
});