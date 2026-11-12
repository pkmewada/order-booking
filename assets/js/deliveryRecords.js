/* Each dispatch pass remains an independent delivery with its own PDF proof (stored on the server). */
window.DeliveryRecords = (() => {
    const legacyBatch = order => ({
        id: `DLV-LEGACY-${order.id}`, createdAt: order.deliveredAt, status: 'In Progress',
        items: (order.items || []).flatMap(item => {
            const pieces = DispatchFlow.deliveredPieces(order,item), perSet = OrderQuantities.perSet(item);
            return pieces > 0 ? [{...item, pieces, sets: pieces/perSet, piecesPerSet:perSet}] : [];
        })
    });
    function batches(order) {
        if (order.deliveryBatches?.length) return order.deliveryBatches;
        return DispatchFlow.delivered(order) ? [legacyBatch(order)] : [];
    }
    // stored = PDF on the server; missing = imported delivery whose PDF is not on the server yet; none = not passed.
    const pdfState = batch => batch.pdf ? (batch.pdf.state || 'stored') : 'none';
    function snapshot(order,batch) {
        const items = (batch.items || []).map(item => {
            const source = (order.items || []).find(row => row.barcode === item.barcode && row.brand === item.brand && row.size === item.size) || {};
            const perSet = Number(item.piecesPerSet) || OrderQuantities.perSet(item);
            const pieces = Number(item.pieces) || Number(item.sets) * perSet;
            return {...source,...item,qty:Number(item.sets) || Math.floor(pieces/perSet),dispatchScannedPieces:pieces,dispatchDeliveredPieces:pieces};
        });
        const status = {stored:'Success',missing:'PDF missing',none:'In Progress'}[pdfState(batch)];
        return {...order,items,deliveryBatchId:batch.id,deliveredAt:batch.createdAt,deliveryBatches:[batch],deliveryStatus:status};
    }
    async function pass(orderId,batchId,file) {
        if (!file || !file.size || typeof file.slice !== 'function') throw new Error('Choose a PDF to pass this delivery.');
        const header = new TextDecoder().decode(await file.slice(0,5).arrayBuffer());
        if (header !== '%PDF-') throw new Error('Choose a valid PDF file.');
        if (file.size > 10 * 1024 * 1024) throw new Error('The PDF is larger than 10 MB.');
        const data = await OrdersApi.uploadPdf(batchId,file); // the server repeats every check
        return (data.order.deliveryBatches || []).find(row=>String(row.id)===String(batchId));
    }
    function downloadFile(batch) {
        const link=document.createElement('a');
        link.href=OrdersApi.pdfUrl(batch.id);link.rel='noopener';
        document.body.appendChild(link);link.click();link.remove();
    }
    return {batches,snapshot,pass,downloadFile,pdfState};
})();
