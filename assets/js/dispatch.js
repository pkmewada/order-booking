$(function () {
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const read = () => {
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        return Array.isArray(orders) ? orders : [];
    };
    const items = order => Array.isArray(order.items) ? order.items : [];
    const complete = order => items(order).length > 0 && items(order).every(item => OrderQuantities.checked(item));
    const status = order => DispatchFlow.status(order);
    let page = 1, selectedId = null, scanner = null, startingCamera = false, scanning = false;
    let draft = null;
    const modalElement = document.getElementById('dispatchModal');
    const modal = new bootstrap.Modal(modalElement, {focus:false});

    function quantity(pieces, perSet) {
        const sets = Math.floor(pieces / perSet), extra = pieces % perSet;
        return sets + ' Sets' + (extra ? ' + ' + extra + ' Pcs' : '') + '<div class="text-muted small">' + pieces + ' Pieces</div>';
    }
    function orderQuantity(order, kind) {
        const total = items(order).reduce((sum, item) => {
            const perSet = OrderQuantities.perSet(item), passed = DispatchFlow.deliveredPieces(order, item);
            const count = kind === 'scanned' ? OrderQuantities.scanned(item) : kind === 'passed' ? passed : kind === 'remaining' ? Math.max(0, OrderQuantities.pieces(item) - passed) : kind === 'available' ? DispatchFlow.available(order, item) : OrderQuantities.pieces(item);
            return {sets:sum.sets + Math.floor(count / perSet), extra:sum.extra + count % perSet, pieces:sum.pieces + count};
        }, {sets:0, extra:0, pieces:0});
        return total.sets + ' Sets' + (total.extra ? ' + ' + total.extra + ' Pcs' : '') + '<div class="text-muted small">' + total.pieces + ' Pieces</div>';
    }
    function renderList() {
        const term = $('#searchInput').val().trim().toLowerCase();
        const filter = $('#statusFilter').val();
        const orders = read().filter(order => order.dispatchPassedAt && !DispatchFlow.confirmed(order) && (filter === 'all' || status(order) === filter) &&
            [order.id, order.customerName, order.shopName].some(value => String(value || '').toLowerCase().includes(term)))
            .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        const pages = Math.max(1, Math.ceil(orders.length / 10));
        page = Math.min(page, pages);
        const start = (page - 1) * 10;
        const body = $('#orderTableBody').empty();
        orders.slice(start, start + 10).forEach((order, index) => {
            const state = status(order);
            const row = $(`<tr><td>${start + index + 1}</td><td>${esc(order.id)}</td><td>${esc(order.customerName || 'N/A')}</td>
                <td>${esc(order.shopName || 'N/A')}</td><td>${esc(order.deliveryDate || 'N/A')}</td>
                <td>${orderQuantity(order, 'ordered')}</td><td>${orderQuantity(order, 'scanned')}</td><td>${orderQuantity(order, 'passed')}</td><td>${orderQuantity(order, 'remaining')}</td><td>${orderQuantity(order, 'available')}</td>
                <td><span class="badge bg-${state === 'Completed' ? 'success' : state === 'In Progress' ? 'info' : 'warning'}">${state}</span></td>
                <td class="text-center"><button class="btn btn-sm btn-primary view-btn"><i class="bx bx-show me-1"></i>View</button></td></tr>`);
            row.find('.view-btn').on('click', () => {
                selectedId = order.id;
                draft = read().find(row => row.id === selectedId);
                $('#dispatchScanMessage').empty();
                $('#dispatchScanInput').val('');
                renderModal(); modal.show();
            });
            body.append(row);
        });
        if (!orders.length) body.append('<tr><td colspan="12" class="text-center text-muted py-4">No orders found</td></tr>');
        $('#paginationInfo').text(orders.length ? `Showing ${start + 1}-${Math.min(start + 10, orders.length)} of ${orders.length} orders` : 'No orders');
        const pagination = $('#paginationControls').empty();
        const add = (label, target, disabled, active = false) => {
            const li = $(`<li class="page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}"><button type="button" class="page-link" ${disabled ? 'disabled' : ''}>${label}</button></li>`);
            li.find('button').on('click', () => { page = target; renderList(); }); pagination.append(li);
        };
        add('Prev', page - 1, page === 1);
        for (let i = 1; i <= pages; i++) add(i, i, false, page === i);
        add('Next', page + 1, page === pages);
    }
    function renderModal() {
        const order = draft;
        if (!order) { modal.hide(); return; }
        $('#dispatchModalTitle').text('Dispatch - ' + order.id);
        $('#dispatchCustomer').text([order.customerName, order.shopName, 'Delivery: ' + (order.deliveryDate || '--'), 'City: ' + (order.city || '--'), 'Contact: ' + (order.contact || '--'), 'Agent: ' + (order.agentName || '--'), 'Transport: ' + (order.transportName || '--')].filter(Boolean).join(' | '));
        const totals = OrderQuantities.totals(order);
        const scanned = items(order).reduce((sum, item) => sum + OrderQuantities.scanned(item), 0);
        $('#dispatchSummary').html('<div class="d-flex flex-wrap gap-4"><div>Ordered<br>' + orderQuantity(order, 'ordered') + '</div><div>Scanned<br>' + orderQuantity(order, 'scanned') + '</div><div>Passed<br>' + orderQuantity(order, 'passed') + '</div><div>Remaining to Pass<br>' + orderQuantity(order, 'remaining') + '</div><div>Ready to Pass<br>' + orderQuantity(order, 'available') + '</div></div>');
        $('#dispatchConfirmBtn').prop('disabled', !items(order).some(item => DispatchFlow.available(order, item) >= OrderQuantities.perSet(item)));
        $('#dispatchScanForm').toggleClass('d-none', DispatchFlow.confirmed(order));
        $('#dispatchCameraBtn').prop('disabled', DispatchFlow.confirmed(order));
        const body = $('#dispatchItems').empty();
        items(order).forEach((item, index) => {
            const row = $(`<tr class="${OrderQuantities.checked(item) ? 'table-success' : ''}"><td><span class="badge bg-${OrderQuantities.checked(item) ? 'success' : 'warning'}">${OrderQuantities.checked(item) ? '&#10003; Scanned' : OrderQuantities.scanned(item) > 0 ? 'In Progress' : 'Pending'}</span></td>
                <td>${esc(item.barcode || '--')}</td><td>${esc(item.description || item.itemDescription || item.itemCode || '--')}</td>
                <td>${esc(item.brand)}</td><td>${esc(item.size)}</td><td>${OrderQuantities.perSet(item)}</td><td>${quantity(OrderQuantities.pieces(item), OrderQuantities.perSet(item))}</td><td>${quantity(OrderQuantities.scanned(item), OrderQuantities.perSet(item))}</td><td>${quantity(DispatchFlow.deliveredPieces(order, item), OrderQuantities.perSet(item))}</td><td>${quantity(Math.max(0, OrderQuantities.pieces(item) - DispatchFlow.deliveredPieces(order, item)), OrderQuantities.perSet(item))}</td><td>${quantity(DispatchFlow.available(order, item), OrderQuantities.perSet(item))}</td><td><button type="button" class="btn btn-sm btn-dark replace-item" data-index="${index}" ${DispatchFlow.deliveredPieces(order, item) >= OrderQuantities.pieces(item) ? 'disabled' : ''}>Replace</button></td></tr>`);
            body.append(row);
        });
        if (!items(order).length) body.append('<tr><td colspan="12" class="text-center">No items in this order.</td></tr>');
        $('#dispatchProgress').text(`${items(order).filter(item => OrderQuantities.checked(item)).length} / ${items(order).length} items scanned - ${status(order)}`)
            .toggleClass('text-success', complete(order));
    }
    function updateOrder(action) {
        const orders = read();
        const order = orders.find(row => row.id === selectedId);
        if (!order) throw Error('This order was removed.');
        if (!order.dispatchPassedAt) throw Error('Pass this order from Order List first.');
        const result = action(order);
        localStorage.setItem('orders', JSON.stringify(orders));
        draft = order;
        renderList(); renderModal();
        return result;
    }
    const deliveryElement = document.getElementById('partialDeliveryModal');
    const deliveryModal = new bootstrap.Modal(deliveryElement);
    let deliverySignature = '';
    const signature = order => JSON.stringify(items(order).map(item => [item.barcode, item.brand, item.size, OrderQuantities.sets(item), OrderQuantities.perSet(item)]));
    function deliverySummary() {
        let pieces = 0;
        const labels = [];
        $('#partialDeliveryItems .deliver-pieces').each(function () {
            const sets = Math.max(0, Number(this.value) || 0);
            const perSet = Number(this.dataset.perSet);
            const count = sets * perSet;
            pieces += count;
            if (sets) labels.push(sets + ' Sets (' + count + ' Pieces)');
        });
        $('#partialDeliverySummary').text('Pass: ' + pieces + ' Pieces' + (labels.length ? ' | ' + labels.join(', ') : ''));
        $('#partialDeliveryConfirmBtn').prop('disabled', pieces < 1);
    }
    $('#dispatchConfirmBtn').on('click', async function () {
        await stopCamera();
        draft = read().find(order => order.id === selectedId);
        if (!draft) { modal.hide(); return; }
        deliverySignature = signature(draft);
        $('#partialDeliveryTitle').text('Pass Sets to Delivery - ' + draft.id);
        $('#partialDeliveryMessage').empty();
        const body = $('#partialDeliveryItems').empty();
        items(draft).forEach((item, index) => {
            const available = DispatchFlow.available(draft, item);
            const perSet = OrderQuantities.perSet(item);
            const readySets = Math.floor(available / perSet);
            body.append('<tr><td>' + esc(item.description || item.itemDescription || item.itemCode || '--') + '</td><td>' + esc(item.brand) + ' / ' + esc(item.size) + '</td><td>' + perSet + ' Pieces</td><td>' + quantity(OrderQuantities.pieces(item), perSet) + '</td><td>' + quantity(DispatchFlow.deliveredPieces(draft, item), perSet) + '</td><td>' + quantity(available, perSet) + '</td><td><input type="number" class="form-control deliver-pieces" min="0" max="' + readySets + '" step="1" value="' + readySets + '" data-index="' + index + '" data-per-set="' + perSet + '" aria-label="Pass sets for item ' + (index + 1) + '"><small class="text-muted">Sets only; ' + (available % perSet) + ' extra pieces stay</small></td></tr>');
        });
        deliverySummary(); deliveryModal.show();
    });
    $('#partialDeliveryItems').on('input', '.deliver-pieces', deliverySummary);
    $('#partialDeliveryConfirmBtn').on('click', function () {
        this.disabled = true;
        const selections = $('#partialDeliveryItems .deliver-pieces').map(function () { return this.value; }).get();
        try {
            updateOrder(order => {
                if (signature(order) !== deliverySignature) throw Error('Order changed. Close and reopen delivery details.');
                DispatchFlow.deliverPartial(order, selections);
            });
            window.location.href = 'delivery';
        } catch (error) {
            deliverySummary();
            $('#partialDeliveryMessage').text(error.message);
        }
    });
    $(deliveryElement).on('shown.bs.modal', function () { $('.modal-backdrop').last().css('z-index', 1060); });
    $(deliveryElement).on('hidden.bs.modal', function () {
        if (modalElement.classList.contains('show')) { document.body.classList.add('modal-open'); $('#dispatchConfirmBtn').trigger('focus'); }
    });
    const replaceElement = document.getElementById('replaceDesignModal');
    const replaceModal = new bootstrap.Modal(replaceElement);
    let replaceIndex = null, replaceOriginal = '', replacement = null;
    const products = () => JSON.parse(localStorage.getItem('products') || '[]');
    const designName = product => String(product.designNumber || product.description || '');
    const designKey = product => String(product.designNumber || product.description || product.itemDescription || product.itemCode || '').trim().toLowerCase();
    const designSelected = (order, product) => items(order).some(item =>
        designKey(item) === designKey(product) || (product.barcode && item.barcode === product.barcode));
    function chooseReplacement(product) {
        const current = read().find(order => order.id === selectedId);
        if (!current || designSelected(current, product)) {
            replacement = null;
            $('#replaceDesignSave').prop('disabled', true);
            $('#replacementPreview').addClass('d-none');
            $('#replacementMessage').text('This design is already selected in this order. Choose another design.');
            return;
        }
        $('#replacementMessage').empty();
        replacement = product;
        const item = draft && items(draft)[replaceIndex];
        if (!item) return;
        const passed = DispatchFlow.deliveredPieces(draft, item);
        const sets = OrderQuantities.sets(item) - Math.floor(passed / OrderQuantities.perSet(item));
        $('#replacementDesign').val(designName(product));
        $('#replacementResults').empty();
        $('#replacementPreview').removeClass('d-none').text('Design: ' + designName(product) + ' | Brand: ' + (product.brand || '--') + ' | Size: ' + (product.size || '--') + ' | Color: ' + (product.color || '--') + ' | Barcode: ' + (product.barcode || '--') + ' | ' + sets + ' Sets | 1 Set = ' + OrderQuantities.perSet(product) + ' Pieces | Total: ' + sets * OrderQuantities.perSet(product) + ' Pieces. Scan the replacement design again.');
        $('#replaceDesignSave').prop('disabled', !product.barcode || sets < 1);
    }
    $('#dispatchItems').on('click', '.replace-item', async function () {
        await stopCamera();
        draft = read().find(order => order.id === selectedId);
        replaceIndex = Number(this.dataset.index);
        const item = draft && items(draft)[replaceIndex];
        if (!item) return;
        replaceOriginal = JSON.stringify(item);
        replacement = null;
        $('#replacementDesign').val(''); $('#replacementResults').empty(); $('#replacementPreview').empty().addClass('d-none'); $('#replacementMessage').empty(); $('#replaceDesignSave').prop('disabled', true);
        replaceModal.show();
    });
    $('#replacementDesign').on('input', function () {
        replacement = null; $('#replaceDesignSave').prop('disabled', true); $('#replacementPreview').addClass('d-none');
        const query = this.value.trim().toLowerCase();
        const list = $('#replacementResults').empty();
        if (!query) return;
        const current = read().find(order => order.id === selectedId);
        const matches = products().filter(product => current && !designSelected(current, product) && designName(product).toLowerCase().includes(query));
        const exact = matches.filter(product => designName(product).toLowerCase() === query);
        if (exact.length === 1) { chooseReplacement(exact[0]); return; }
        matches.forEach(product => $('<button>', {type:'button', class:'list-group-item list-group-item-action', text:[designName(product),product.brand,product.size,product.color].filter(Boolean).join(' | ')}).on('click', () => chooseReplacement(product)).appendTo(list));
        if (!matches.length) $('<div>', {class:'list-group-item text-muted', text:'No product found for this design.'}).appendTo(list);
    });
    $('#replaceDesignSave').on('click', function () {
        if (!replacement) return;
        this.disabled = true;
        try {
            updateOrder(order => {
                const item = items(order)[replaceIndex];
                if (!item || JSON.stringify(item) !== replaceOriginal) throw Error('Order changed. Close and reopen Replace.');
                const product = products().find(product => product.barcode === replacement.barcode && designName(product) === designName(replacement));
                if (!product || !product.barcode) throw Error('Product changed or removed. Select the design again.');
                if (designSelected(order, product)) throw Error('This design is already selected in this order. Choose another design.');
                const passed = DispatchFlow.deliveredPieces(order, item);
                const perSet = OrderQuantities.perSet(item);
                if (passed % perSet) throw Error('This item has a previous partial-piece delivery. Replace an item with complete passed sets.');
                const passedSets = passed / perSet;
                const remainingSets = OrderQuantities.sets(item) - passedSets;
                if (remainingSets < 1) throw Error('All sets have already been passed.');
                const next = {barcode:product.barcode, description:designName(product), designNumber:designName(product), brand:product.brand, size:product.size, color:product.color, piecesPerSet:OrderQuantities.perSet(product), qty:remainingSets, dispatchScannedPieces:0, dispatchDeliveredPieces:0, dispatchChecked:false};
                if (passedSets) {
                    item.qty = passedSets; item.dispatchScannedPieces = passed; item.dispatchDeliveredPieces = passed;
                    order.items.splice(replaceIndex + 1, 0, next);
                } else { order.items[replaceIndex] = next; }
                const totals = OrderQuantities.totals(order); order.totalSets = totals.sets; order.totalPcs = totals.pieces;
                order.dispatchStatus = DispatchFlow.status(order); order.updatedAt = new Date().toISOString();
                delete order.dispatchConfirmedAt; delete order.dispatchCompletedAt; delete order.dispatchConfirmedItems;
            });
            replaceModal.hide();
        } catch (error) { $('#replacementMessage').text(error.message); $('#replaceDesignSave').prop('disabled', false); }
    });
    $(replaceElement).on('shown.bs.modal', function () { $('.modal-backdrop').last().css('z-index', 1060); $('#replacementDesign').trigger('focus'); });
    $(replaceElement).on('hidden.bs.modal', function () { if (modalElement.classList.contains('show')) { document.body.classList.add('modal-open'); $('#dispatchScanInput').trigger('focus'); } });
    function scan(code) {
        if (!selectedId || !String(code || '').trim()) return;
        try {
            const item = updateOrder(order => DispatchFlow.scan(order, code));
            $('#dispatchScanMessage').text('Saved: ' + code + ' - ' + OrderQuantities.scanned(item) + ' / ' + OrderQuantities.pieces(item) + ' pieces').removeClass('text-danger').addClass('text-success');
        } catch (error) {
            $('#dispatchScanMessage').text(error.message).removeClass('text-success').addClass('text-danger');
        }
        $('#dispatchScanInput').val('').trigger('focus');
    }
    $('#dispatchScanForm').on('submit', event => { event.preventDefault(); scan($('#dispatchScanInput').val()); });
    async function stopCamera() {
        const current = scanner; scanner = null;
        if (current) { try { if (current.isScanning) await current.stop(); current.clear(); } catch (_) {} }
        $('#dispatchCameraBtn').text('Camera Scan');
    }
    $('#dispatchCameraBtn').on('click', async function () {
        if (startingCamera) return;
        if (scanner) { await stopCamera(); return; }
        startingCamera = true;
        this.disabled = true;
        try {
            scanner = new Html5Qrcode('dispatchReader');
            await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 150 } }, code => {
                if (scanning || !selectedId) return;
                scanning = true;
                scan(code);
                stopCamera().finally(() => { scanning = false; });
            }, () => {});
            if (!modalElement.classList.contains('show')) await stopCamera();
            else $(this).text('Stop Camera');
        } catch (_) {
            await stopCamera();
            $('#dispatchScanMessage').text('Camera unavailable. Allow camera access or use the barcode input.').addClass('text-danger');
        } finally { startingCamera = false; this.disabled = false; }
    });
    $(modalElement).on('shown.bs.modal', () => $('#dispatchScanInput').trigger('focus'));
    $(modalElement).on('hidden.bs.modal', () => { selectedId = null; draft = null; if (!startingCamera) stopCamera(); });
    $('#searchInput').on('input', () => { page = 1; renderList(); });
    $('#statusFilter').on('change', () => { page = 1; renderList(); });
    window.addEventListener('storage', event => { if (event.key === 'orders') { renderList(); if (selectedId) { draft = read().find(order => order.id === selectedId); renderModal(); } } });
    renderList();
});
