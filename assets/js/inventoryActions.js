(function () {
    'use strict';
    const P = Production;
    const workers = ['Ahmad Khan', 'Bilal Ahmed', 'Danish Ali', 'Faisal Khan', 'Usman Malik', 'Ali Ahmed', 'Imran Khan', 'Saeed Ahmad', 'Zafar Iqbal', 'Rashid Mahmood'];
    const firms = ['Ahmad Tailors', 'Bilal Garments', 'Danish Fabrics', 'Faisal Stitching', 'Usman Enterprises', 'Ali Industries', 'Imran Textiles', 'Saeed Garments', 'Zafar Fabrics', 'Rashid Tailors'];
    const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    let assignmentSources = [];
    let assignmentStage = '';
    const date = () => {
        const value = new Date();
        value.setDate(value.getDate() + 7);
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    };
    const stageKey = stage => Object.entries(P.managers).find(([key, name]) => key !== 'additionalWorkData' && name === stage)?.[0] || 'additionalWorkData';
    const isStageWork = (work, stage, key) => key !== 'additionalWorkData' || String(work.stage || work.workType).toLowerCase() === stage.toLowerCase();
    function routeOrderFor(pool, stage, key) {
        if (Number.isInteger(pool.currentStage?.routeIndex)) return pool.currentStage.routeIndex;
        return (pool.route || []).findIndex(route =>
            String(route.stage).toLowerCase() === stage.toLowerCase() &&
            (key !== 'additionalWorkData' || route.type === 'additional_work') &&
            (pool.currentStage?.parallelGroup ? route.parallelGroup === pool.currentStage.parallelGroup : true) &&
            (pool.currentStage?.workIndex === undefined || route.workIndex === pool.currentStage.workIndex));
    }

    function mountAssignmentModal() {
        if (document.getElementById('inventoryBulkAssignModal')) return;
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal fade" id="inventoryBulkAssignModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-fullscreen">
                    <div class="modal-content">
                        <div class="modal-header"><h5 class="modal-title" id="inventoryBulkAssignTitle"></h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
                        <form id="inventoryBulkAssignForm">
                            <div class="modal-body">
                                <div id="inventoryBulkAssignSummary" class="mb-3"></div>
                                <div class="table-responsive"><table class="table table-bordered align-middle text-nowrap"><thead id="inventoryBulkAssignHead"></thead><tbody id="inventoryBulkAssignRows"></tbody></table></div>
                                <div class="text-danger" id="inventoryBulkAssignError" role="alert"></div>
                            </div>
                            <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-dark" id="inventoryBulkAssignSave">Assign</button></div>
                        </form>
                    </div>
                </div>
            </div>`);
        $('#inventoryBulkAssignRows').on('change', '.inventory-assign-type', function () {
            const row = $(this).closest('tr');
            const outsource = this.value === 'outsource';
            row.find('.inventory-assign-worker').toggleClass('d-none', outsource).prop('required', !outsource);
            row.find('.inventory-assign-firm').toggleClass('d-none', !outsource).prop('required', outsource);
        });
        $('#inventoryBulkAssignModal').on('click', '#inventoryApplySplit', renderAssignmentRows);
        $('#inventoryBulkAssignRows').on('click', '.inventory-copy-split', function () {
            copyAssignmentSplit(Number($(this).data('split-index')));
        });
        $('#inventoryBulkAssignRows').on('input', '.inventory-assign-qty', balanceSplitQuantities);
        $('#inventoryBulkAssignForm').on('submit', submitAssignment);
    }

    function assignmentRows(stage, batchId, state, poolId) {
        const key = stageKey(stage), view = P.views(key);
        const pools = view.pool.filter(pool => String(pool.batchId) === batchId &&
            (!poolId || String(pool.id) === String(poolId)) &&
            pool.stageEnabled !== false &&
            (key !== 'additionalWorkData' || String(pool.currentStage?.stage || pool.workType).toLowerCase() === stage.toLowerCase()));
        return pools.map(pool => {
            const routeOrder = routeOrderFor(pool, stage, key);
            const works = state[key] || [];
            const componentRows = key === 'cuttingData' && Array.isArray(pool.cuttingComponents)
                ? pool.cuttingComponents.filter(component => component.available).map(component => ({
                    id: component.id,
                    name: component.name,
                    available: P.calculateAvailableQty(pool, works, stage, undefined, component.id, routeOrder, pool.quantity)
                }))
                : [];
            const available = componentRows.length
                ? Math.min(...componentRows.map(component => component.available))
                : P.calculateAvailableQty(pool, works, stage, undefined, undefined, routeOrder, pool.quantity);
            return { pool, routeOrder, available, componentRows };
        }).filter(row => row.available > 0);
    }

    function workerOptions() {
        return `<option value="">Select worker</option>${workers.map(worker => `<option value="${esc(worker)}">${esc(worker)}</option>`).join('')}`;
    }

    function firmOptions() {
        return `<option value="">Select firm</option>${firms.map(firm => `<option value="${esc(firm)}">${esc(firm)}</option>`).join('')}`;
    }

    function renderAssignmentRows() {
        const splitCount = Number($('#inventoryAssignmentSplitCount').val());
        const maxSplit = Math.min(50, ...assignmentSources.map(source => source.available));
        if (!Number.isSafeInteger(splitCount) || splitCount < 1 || splitCount > maxSplit) {
            $('#inventoryBulkAssignError').text(`Split count must be between 1 and ${Math.max(1, maxSplit)}.`);
            return;
        }
        $('#inventoryAssignmentSplitCount').val(splitCount);
        $('#inventoryBulkAssignError').empty();
        const splitGroups = Array.from({ length: splitCount }, (_, split) => {
            const groupRows = [];
            assignmentSources.forEach(({ pool, routeOrder, available, componentRows }) => {
                const quotient = Math.floor(available / splitCount), remainder = available % splitCount;
                const quantity = quotient + (split < remainder ? 1 : 0);
                const groupId = `inventory-${pool.id}-split-${split + 1}`;
                const label = `${pool.batchId}-${String(pool.pieceItem || 'Piece').replace(/[^A-Za-z0-9]+/g, '-')}-C${split + 1}`;
                const components = componentRows.length ? componentRows : [{ id: null, name: '', available }];
                components.forEach(component => groupRows.push(`<tr class="inventory-assign-row" data-pool-id="${esc(pool.id)}" data-split-index="${split}" data-route-order="${Number.isInteger(routeOrder) ? routeOrder : '-1'}" data-available="${component.available ?? available}" data-group-id="${esc(groupId)}" data-component-id="${esc(component.id ?? '')}" data-component-name="${esc(component.name)}" data-sub-batch="${esc(label)}">
                    <td><strong class="text-primary">${esc(label)}</strong></td>
                    <td><div class="fw-semibold">Piece ${esc(pool.pieceNumber)}</div><div class="small text-muted">${esc(pool.pieceItem || '-')}</div></td>
                    <td>${component.name ? `<strong>${esc(component.name)}</strong>` : '—'}</td>
                    ${assignmentStage === 'Stitching' ? '<td><select class="form-select form-select-sm inventory-assign-type"><option value="inhouse">In-house</option><option value="outsource">Outsource</option></select></td>' : ''}
                    <td><select class="form-select form-select-sm inventory-assign-worker" required>${workerOptions()}</select></td>
                    ${assignmentStage === 'Stitching' ? `<td><select class="form-select form-select-sm inventory-assign-firm d-none">${firmOptions()}</select></td>` : ''}
                    <td><input class="form-control form-control-sm inventory-assign-qty" type="number" min="0" max="${component.available ?? available}" step="1" value="${quantity}" required></td>
                    <td><select class="form-select form-select-sm inventory-assign-priority">${['Low', 'Medium', 'High'].map(value => `<option ${value === (pool.priority || 'Medium') ? 'selected' : ''}>${value}</option>`).join('')}</select></td>
                    <td><input class="form-control form-control-sm inventory-assign-date" type="date" value="${date()}" required></td>
                </tr>`));
            });
            if (groupRows.length) {
                const actionCell = `<td class="text-center align-middle" rowspan="${groupRows.length}"><button type="button" class="btn btn-success btn-sm inventory-copy-split" data-split-index="${split}" title="Copy first row values for C${split + 1}" aria-label="Copy first row values for split ${split + 1}"><i class="bx bx-copy"></i></button></td>`;
                groupRows[0] = groupRows[0].replace('</tr>', `${actionCell}</tr>`);
            }
            return groupRows;
        });
        $('#inventoryBulkAssignRows').html(splitGroups.flat().join(''));
    }

    function copyAssignmentSplit(splitIndex) {
        const rows = $('#inventoryBulkAssignRows tr.inventory-assign-row').filter(function () {
            return Number($(this).attr('data-split-index')) === splitIndex;
        });
        if (rows.length < 2) {
            Swal.fire({ icon: 'info', title: `C${splitIndex + 1} only has one row.` });
            return;
        }
        const first = rows.first(), type = assignmentStage === 'Stitching' ? first.find('.inventory-assign-type').val() : 'inhouse';
        const worker = first.find('.inventory-assign-worker').val(), firm = first.find('.inventory-assign-firm').val();
        const priority = first.find('.inventory-assign-priority').val(), deliveryDate = first.find('.inventory-assign-date').val();
        if (!(type === 'outsource' ? firm : worker) || !deliveryDate) {
            Swal.fire({ icon: 'warning', title: 'Complete the first row', text: `Fill the first C${splitIndex + 1} row before copying.` });
            return;
        }
        rows.slice(1).each(function () {
            const row = $(this);
            if (assignmentStage === 'Stitching') row.find('.inventory-assign-type').val(type).trigger('change');
            row.find('.inventory-assign-worker').val(worker);
            if (assignmentStage === 'Stitching') row.find('.inventory-assign-firm').val(firm);
            row.find('.inventory-assign-priority').val(priority);
            row.find('.inventory-assign-date').val(deliveryDate);
        });
        Swal.fire({ icon: 'success', title: 'Values copied', text: `C${splitIndex + 1} values copied to the other rows.`, timer: 1300, showConfirmButton: false });
    }

    function balanceSplitQuantities() {
        const row = $(this).closest('tr'), poolId = String(row.attr('data-pool-id'));
        const source = assignmentSources.find(item => String(item.pool.id) === poolId);
        if (!source) return;
        const splitGroups = new Map();
        $('#inventoryBulkAssignRows tr.inventory-assign-row').filter(function () {
            return String($(this).attr('data-pool-id')) === poolId;
        }).each(function () {
            const current = $(this), groupId = String(current.attr('data-group-id'));
            if (!splitGroups.has(groupId)) splitGroups.set(groupId, []);
            splitGroups.get(groupId).push(current);
        });
        const groups = [...splitGroups.values()];
        const currentGroup = row.attr('data-group-id'), target = groups.find(group => String(group[0].attr('data-group-id')) === String(currentGroup));
        if (!target) return;
        const input = row.find('.inventory-assign-qty'), capacity = Number(row.data('available'));
        const quantity = Math.min(capacity, source.available, Math.max(0, Math.floor(Number(input.val()) || 0)));
        input.val(quantity);
        target.forEach(item => item.find('.inventory-assign-qty').val(quantity));
        const otherGroups = groups.filter(group => group !== target);
        const remainder = Math.max(0, source.available - quantity);
        const quotient = otherGroups.length ? Math.floor(remainder / otherGroups.length) : 0;
        const extra = otherGroups.length ? remainder % otherGroups.length : 0;
        otherGroups.forEach((group, index) => {
            const next = quotient + (index < extra ? 1 : 0);
            group.forEach(item => item.find('.inventory-assign-qty').val(next));
        });
    }

    async function submitAssignment(event) {
        event.preventDefault();
        const button = document.getElementById('inventoryBulkAssignSave');
        if (button.disabled) return;
        const stage = button.dataset.stage, batchId = button.dataset.batch, key = stageKey(stage);
        const requests = [];
        try {
            $('#inventoryBulkAssignRows tr.inventory-assign-row').each(function () {
                const row = $(this), capacity = Number(row.data('available')), quantity = Number(row.find('.inventory-assign-qty').val());
                if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > capacity) throw new Error(`Enter a whole quantity between 0 and ${capacity}.`);
                if (quantity === 0) return;
                const type = assignmentStage === 'Stitching' ? row.find('.inventory-assign-type').val() : 'inhouse';
                const worker = type === 'outsource' ? '' : row.find('.inventory-assign-worker').val();
                const firm = type === 'outsource' ? row.find('.inventory-assign-firm').val() : '';
                if (!worker && !firm) throw new Error('Choose a worker or firm for every assignment.');
                const poolId = row.data('pool-id');
                const routeOrder = Number(row.attr('data-route-order'));
                const common = {
                    poolId,
                    type,
                    worker,
                    firm,
                    quantity,
                    priority: row.find('.inventory-assign-priority').val(),
                    deliveryDate: row.find('.inventory-assign-date').val(),
                    subBatch: row.attr('data-sub-batch')
                };
                if (!common.deliveryDate) throw new Error('Choose a delivery date for every assignment.');
                if (Number.isInteger(routeOrder) && routeOrder >= 0) common.routeOrder = routeOrder;
                if (key === 'additionalWorkData') common.workType = stage;
                const groupId = String(row.attr('data-group-id'));
                if (key === 'cuttingData') {
                    requests.push({
                        ...common,
                        componentId: row.attr('data-component-id') || 'legacy',
                        componentName: row.attr('data-component-name') || '',
                        splitGroupId: groupId
                    });
                } else {
                    requests.push(common);
                }
            });
            if (!requests.length) throw new Error('No available quantity is selected for assignment.');
            const groups = new Map();
            $('#inventoryBulkAssignRows tr.inventory-assign-row').each(function () {
                const row = $(this), groupId = String(row.attr('data-group-id'));
                if (!groups.has(groupId)) groups.set(groupId, []);
                groups.get(groupId).push(row);
            });
            if (key === 'cuttingData') {
                groups.forEach((rows, groupId) => {
                    if (rows.length > 1 && rows.some(row => Number(row.find('.inventory-assign-qty').val()) !== Number(rows[0].find('.inventory-assign-qty').val())))
                        throw new Error(`All configured Cutting items must use the same quantity in ${groupId}.`);
                });
            }
            assignmentSources.forEach(source => {
                const total = [...groups].filter(([, rows]) => String(rows[0].data('pool-id')) === String(source.pool.id))
                    .reduce((sum, [, rows]) => sum + Number(rows[0].find('.inventory-assign-qty').val() || 0), 0);
                if (total > source.available) throw new Error(`Assignments exceed the available quantity ${source.available} for Piece ${source.pool.pieceNumber}.`);
            });
            button.disabled = true;
            $('#inventoryBulkAssignError').empty();
            await P.assign(key, requests);
            bootstrap.Modal.getOrCreateInstance(document.getElementById('inventoryBulkAssignModal')).hide();
        } catch (error) {
            $('#inventoryBulkAssignError').text(error.message);
        } finally {
            button.disabled = false;
        }
    }

    function showAssignment(stage, batchId, poolId) {
        mountAssignmentModal();
        const state = P.readState(), key = stageKey(stage), rows = assignmentRows(stage, batchId, state, poolId);
        if (!rows.length) {
            Swal.fire({ icon: 'info', title: 'No quantity available', text: `There is no quantity available for ${stage} assignment in ${batchId}.` });
            return false;
        }
        assignmentSources = rows;
        assignmentStage = stage;
        const pieceTitle = rows[0].pool.pieceItem ? ` — Piece ${rows[0].pool.pieceNumber} (${rows[0].pool.pieceItem})` : '';
        $('#inventoryBulkAssignTitle').text(`Assign ${stage} — ${batchId}${pieceTitle}`);
        const first = rows[0].pool, total = Number(first.quantity) || 0, assigned = Math.max(0, total - rows[0].available);
        const photo = first.photo
            ? `<img src="${esc(first.photo)}" alt="" style="width:50px;height:50px;object-fit:cover;border-radius:6px" onerror="this.style.display='none'">`
            : '<span class="d-flex align-items-center justify-content-center bg-light rounded" style="width:50px;height:50px"><i class="bx bx-image text-muted fs-3"></i></span>';
        $('#inventoryBulkAssignSummary').html(`<section class="border rounded-3 p-3">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div class="d-flex align-items-center gap-2">${photo}<div>
                    <div class="fw-semibold">${esc(batchId)} — Design: ${esc(first.designNumber || '-')}</div>
                    <div class="small text-muted"><strong>Brand:</strong> ${esc(first.brand || '-')} &bull; <strong>Color:</strong> ${esc(first.color || '-')} &bull; <strong>Piece:</strong> ${esc(first.pieceItem || first.pieceNumber || '-')} &bull; <strong>Priority:</strong> ${esc(first.priority || '-')}</div>
                    <div class="d-flex flex-wrap gap-2 mt-1">
                        <span class="badge rounded-pill text-bg-primary">Per-Piece Total: ${total}</span>
                        <span class="badge rounded-pill text-bg-success">Per-Piece Assigned: ${assigned}</span>
                        <span class="badge rounded-pill text-bg-warning">Per-Piece Remaining: ${rows[0].available}</span>
                    </div>
                </div></div>
                <div class="text-end"><label for="inventoryAssignmentSplitCount" class="form-label small text-muted mb-1">Split each piece into:</label>
                    <div class="input-group input-group-sm"><input id="inventoryAssignmentSplitCount" class="form-control" type="number" min="1" max="50" value="1" style="max-width:90px"><button type="button" class="btn btn-success" id="inventoryApplySplit"><i class="bx bx-check me-1"></i>Split</button></div>
                </div>
            </div>
        </section>`);
        $('#inventoryBulkAssignHead').html(`<tr><th>Sub-Batch</th><th>Piece</th><th>Cutting Item</th>${stage === 'Stitching' ? '<th>Type</th>' : ''}<th>Worker</th>${stage === 'Stitching' ? '<th>Firm</th>' : ''}<th>Qty</th><th>Priority</th><th>Delivery Date</th><th>Action</th></tr>`);
        $('#inventoryAssignmentSplitCount').val(1);
        renderAssignmentRows();
        const submit = document.getElementById('inventoryBulkAssignSave');
        submit.dataset.stage = stage;
        submit.dataset.batch = batchId;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('inventoryBulkAssignModal')).show();
        return true;
    }

    function closeStockDetails() {
        const element = document.getElementById('stockFlowModal');
        if (!element?.classList.contains('show')) return Promise.resolve();
        element.dataset.preserveInventoryDetail = 'true';
        return new Promise(resolve => {
            element.addEventListener('hidden.bs.modal', resolve, { once: true });
            bootstrap.Modal.getOrCreateInstance(element).hide();
        });
    }

    function returnToInventory(modalId) {
        const element = document.getElementById(modalId);
        if (!element) throw new Error(`The ${modalId} action dialog was not created.`);
        element.addEventListener('hidden.bs.modal', () => {
            bootstrap.Modal.getOrCreateInstance(document.getElementById('stockFlowModal')).show();
            window.dispatchEvent(new Event('inventory-flow-update'));
        }, { once: true });
    }

    async function openAssignment(stage, batchId, poolId) {
        if (stage === 'Bundling') {
            const sources = P.bundlingReady(P.readState()).filter(source => String(source.batchId) === batchId);
            if (!sources.length) {
                Swal.fire({ icon: 'info', title: 'No quantity available', text: `No packing lots from ${batchId} are ready for bundling.` });
                return;
            }
            await closeStockDetails();
            SetAssignments.open('bundling', null, null, batchId, true);
            returnToInventory('setAssignmentModal');
            return;
        }
        if (stage === 'Packing') {
            const source = P.packingBatches(P.readState()).find(row => String(row.batchId) === batchId && !row.held && row.available > 0);
            if (!source) {
                Swal.fire({ icon: 'info', title: 'No quantity available', text: `No quantity from ${batchId} is ready for packing.` });
                return;
            }
            await closeStockDetails();
            SetAssignments.open('packing', batchId, null, null, true);
            returnToInventory('setAssignmentModal');
            return;
        }
        if (!assignmentRows(stage, batchId, P.readState(), poolId).length) {
            Swal.fire({ icon: 'info', title: 'No quantity available', text: `There is no quantity available for ${stage} assignment in ${batchId}.` });
            return;
        }
        await closeStockDetails();
        if (!showAssignment(stage, batchId, poolId)) {
            bootstrap.Modal.getOrCreateInstance(document.getElementById('stockFlowModal')).show();
            return;
        }
        returnToInventory('inventoryBulkAssignModal');
    }

    function passRows(stage, batchId, poolId) {
        const state = P.readState();
        if (stage === 'Bundling') {
            return state.bundlingData.filter(row => String(row.batchId) === batchId && row.status !== 'passed')
                .map(row => ({ id: row.id, batchId: row.batchId, label: row.id, brand: row.brand, piece: (row.pieces || []).join(', '), worker: row.worker, quantity: row.quantity, completed: row.completedQty || 0, damage: 0 }));
        }
        if (stage === 'Packing') {
            const groups = new Map();
            state.packingData.filter(row => String(row.batchId) === batchId).forEach(row => {
                const id = row.packingLotId || `legacy-${row.id}`;
                if (!groups.has(id)) groups.set(id, []);
                groups.get(id).push(row);
            });
            return [...groups].filter(([, rows]) => !rows.every(row => row.packingClosed || (row.passedQty > 0 && row.passedQty === row.inputQty - row.damageQty)))
                .map(([id, rows]) => {
                    const row = rows[0], math = P.packingLotMath(rows);
                    return { id, batchId: row.batchId, label: id, brand: row.brand, piece: rows.map(item => item.pieceType).join(', '), worker: row.worker, quantity: math.inputQty, completed: math.completedQty, damage: math.damageQty };
                });
        }
        const key = stageKey(stage);
        return (state[key] || []).filter(row => String(row.batchId) === batchId && (!poolId || String(row.poolId) === String(poolId)) && isStageWork(row, stage, key) && !row.stopped && P.status(row) !== 'passed')
            .map(row => ({ id: row.id, batchId: row.batchId, label: row.subBatch || row.id, brand: row.brand, piece: row.pieceType || row.pieceItem, worker: row.worker || row.firm, quantity: row.inputQty ?? row.assignedQty ?? row.quantity, completed: row.completedQty ?? row.progress ?? 0, damage: row.damageQty ?? row.damage ?? 0 }));
    }

    async function savePassProgress(stage, changes) {
        if (stage === 'Bundling') {
            for (const change of changes) await P.editBundling(change.id, change.completed);
            return true;
        }
        if (stage === 'Packing') {
            for (const change of changes) {
                if (change.damageChanged) await P.editPackingLot(change.id, 'damage', change.damage);
                if (change.completedChanged) await P.editPackingLot(change.id, 'completed', change.completed);
            }
            return true;
        }
        const key = stageKey(stage);
        await P.edit(key, changes.map(change => ({
            id: change.id,
            ...(change.completedChanged ? { addCompleted: change.completed } : {}),
            ...(change.damageChanged ? { addDamage: change.damage } : {})
        })));
        return true;
    }

    async function passReady(stage, batchId, poolId) {
        const state = P.readState();
        if (stage === 'Bundling') {
            const ready = state.bundlingData.filter(row => String(row.batchId) === batchId && row.status !== 'passed' && Number(row.completedQty) === Number(row.quantity));
            if (!ready.length) {
                await Swal.fire({ icon: 'info', title: 'Nothing to Pass', text: `No fully completed bundling assignments for ${batchId} are ready to pass.` });
                return false;
            }
            for (const row of ready) await P.passBundling(row.id);
            return true;
        }
        if (stage === 'Packing') {
            const groups = new Map();
            state.packingData.filter(row => String(row.batchId) === batchId).forEach(row => {
                const id = row.packingLotId || `legacy-${row.id}`;
                if (!groups.has(id)) groups.set(id, []);
                groups.get(id).push(row);
            });
            const ready = [...groups].filter(([, rows]) => rows.every(row => !row.stopped && row.completedQty === row.inputQty - row.damageQty && row.damageQty === rows[0].damageQty) &&
                !rows.every(row => row.packingClosed || (row.passedQty > 0 && row.passedQty === row.inputQty - row.damageQty)));
            if (!ready.length) {
                await Swal.fire({ icon: 'info', title: 'Nothing to Pass', text: `No fully completed packing lots for ${batchId} are ready to pass.` });
                return false;
            }
            for (const [id] of ready) await P.passPackingLot(id);
            return true;
        }
        const key = stageKey(stage), rows = (state[key] || []).filter(row =>
            String(row.batchId) === batchId && (!poolId || String(row.poolId) === String(poolId)) && isStageWork(row, stage, key) && !row.stopped &&
            P.calculateProductionMath(row).passableQty > 0);
        if (!rows.length) {
            await Swal.fire({ icon: 'info', title: 'Nothing to Pass', text: `No completed ${stage} assignments for ${batchId} are ready to pass.` });
            return false;
        }
        await P.pass(key, rows.map(row => row.id));
        return true;
    }

    async function openPass(stage, batchId, poolId) {
        const rows = passRows(stage, batchId, poolId);
        if (!rows.length) {
            Swal.fire({ icon: 'info', title: 'No assignments available', text: `There are no ${stage} assignments for ${batchId} to pass.` });
            return;
        }
        await closeStockDetails();
        BulkPass.open({
            title: `${stage === 'Packing' || stage === 'Bundling' ? 'Bulk Pass' : 'Pass'} ${stage} — ${batchId}${poolId && rows[0]?.piece ? ` — ${rows[0].piece}` : ''}`,
            itemLabel: stage === 'Packing' ? 'Packing Lot' : stage === 'Bundling' ? 'Bundling Lot' : 'Sub-Batch',
            rows,
            ...(stage === 'Bundling' ? { mode: 'absolute', showDamage: false } : {}),
            onSave: changes => savePassProgress(stage, changes),
            onPass: () => passReady(stage, batchId, poolId)
        });
        returnToInventory('bulkPassModal');
    }

    function getActionState(stage, batchId, poolId) {
        const state = P.readState();
        const canAssign = stage === 'Bundling'
            ? P.bundlingReady(state).some(row => String(row.batchId) === String(batchId))
            : stage === 'Packing'
                ? P.packingBatches(state).some(row => String(row.batchId) === String(batchId) && !row.held && row.available > 0)
                : assignmentRows(stage, String(batchId), state, poolId).length > 0;
        return { assign: canAssign, pass: passRows(stage, String(batchId), poolId).length > 0 };
    }

    async function open(action, stage, batchId, poolId) {
        try {
            if (action === 'assign') await openAssignment(stage, batchId, poolId);
            else if (action === 'pass') await openPass(stage, batchId, poolId);
            else throw new Error('Unknown inventory production action.');
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Could not open production action', text: error.message });
        }
    }

    window.InventoryActions = { open, getActionState };
})();
