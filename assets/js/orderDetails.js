window.OrderDetails = (() => {
    const esc = v => String(v ?? '--').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function list(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { return []; } }
    function show(order, delivery = false) {
        let element = document.getElementById('orderDetailsModal');
        if (!element) {
            document.body.insertAdjacentHTML('beforeend','<div class="modal fade" id="orderDetailsModal" tabindex="-1"><div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h5 class="modal-title"></h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body"></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="button" class="btn btn-dark details-pdf">Download PDF</button></div></div></div></div>');
            element = document.getElementById('orderDetailsModal');
        }
        const customer = list('customers').find(c => String(c.id) === String(order.customerId)) || {};
        const agent = list('agents').find(c => String(c.id) === String(order.agentId)) || {};
        const transport = list('transporters').find(c => String(c.id) === String(order.transporterId)) || {};
        element.querySelector('.modal-title').textContent = (delivery ? 'Delivery' : 'Order') + ' Details - ' + (order.deliveryBatchId || order.id);
        const fields = [['Order ID',order.id],['Customer',order.customerName],['Shop',order.shopName],['City',order.city || customer.city],['Contact',order.contact || customer.contact],['Agent',order.agentName || agent.name],['Transport',order.transportName || transport.name],['Order Taken By',order.orderTakenBy || order.order_taken_by],['Order Date',order.createdAt],['Delivery Date',order.deliveryDate],['Passed to Dispatch',order.dispatchPassedAt],['Delivered At',order.deliveredAt],['Status',delivery ? (order.deliveryStatus || 'In Progress') : (order.status || 'Active')]];
        if (order.deliveryBatchId) fields.unshift(['Delivery ID',order.deliveryBatchId]);
        const items = (order.items || []).map((item,i) => `<tr>${[i+1,item.barcode,item.description || item.itemDescription || item.itemCode,item.brand,item.size,OrderQuantities.sets(item),OrderQuantities.pieces(item),OrderQuantities.scanned(item),window.DispatchFlow ? DispatchFlow.deliveredPieces(order,item) : (item.dispatchDeliveredPieces || 0)].map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('');
        const batches = (order.deliveryBatches || []).map(b => `<div class="border rounded p-3 mt-3"><strong>${esc(b.id)}</strong> — ${esc(b.createdAt)}<ul>${(b.items || []).map(i=>`<li>${esc(i.description || i.barcode)} — ${esc(i.brand)} / ${esc(i.size)}: ${esc(i.sets)} Sets / ${esc(i.pieces)} Pieces</li>`).join('')}</ul></div>`).join('');
        element.querySelector('.modal-body').innerHTML = `<div class="row g-3 mb-4">${fields.map(([k,v])=>`<div class="col-md-4"><strong>${esc(k)}</strong><div>${esc(v)}</div></div>`).join('')}</div><div class="table-responsive"><table class="table table-bordered"><thead><tr><th>#</th><th>Barcode</th><th>Item</th><th>Brand</th><th>Size</th><th>Ordered Sets</th><th>Ordered Pieces</th><th>Scanned Pieces</th><th>Delivered Pieces</th></tr></thead><tbody>${items || '<tr><td colspan="9">No items.</td></tr>'}</tbody></table></div>${batches ? '<h6 class="mt-3">Delivery History</h6>'+batches : ''}`;
        const button = element.querySelector('.details-pdf');
        button.disabled = false;
        button.onclick = async () => {
            button.disabled = true;
            try { await OrderPdf.download(order,{hideNote:delivery,delivery}); }
            catch (_) { Swal.fire('PDF failed','Could not generate the PDF. Please try again.','error'); }
            finally {button.disabled = false;}
        };
        bootstrap.Modal.getOrCreateInstance(element).show();
    }
    return {show};
})();
