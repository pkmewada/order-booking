/* Each dispatch pass remains an independent delivery with its own PDF proof. */
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
    function snapshot(order,batch) {
        const items = (batch.items || []).map(item => {
            const source = (order.items || []).find(row => row.barcode === item.barcode && row.brand === item.brand && row.size === item.size) || {};
            const perSet = Number(item.piecesPerSet) || OrderQuantities.perSet(item);
            const pieces = Number(item.pieces) || Number(item.sets) * perSet;
            return {...source,...item,qty:Number(item.sets) || Math.floor(pieces/perSet),dispatchScannedPieces:pieces,dispatchDeliveredPieces:pieces};
        });
        return {...order,items,deliveryBatchId:batch.id,deliveredAt:batch.createdAt,deliveryBatches:[batch],deliveryStatus:batch.pdf ? 'Success' : 'In Progress'};
    }
    let opening;
    function database() {
        if (!opening) opening = new Promise((resolve,reject) => {
            const request = indexedDB.open('order-booking-delivery-pdfs',1);
            request.onupgradeneeded = () => request.result.createObjectStore('pdfs');
            request.onsuccess = () => { const db=request.result; db.onversionchange=()=>{db.close();opening=null;};resolve(db); };
            request.onerror = () => { opening=null; reject(request.error); };
            request.onblocked = () => { opening=null; reject(new Error('Close other Delivery tabs and retry the upload.')); };
        });
        return opening;
    }
    async function writeFile(key,file) {
        const db = await database();
        return new Promise((resolve,reject) => {
            const tx=db.transaction('pdfs','readwrite');tx.objectStore('pdfs').put(file,key);
            tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error || new Error('PDF could not be saved.'));
        });
    }
    async function readFile(key) {
        const db=await database();
        return new Promise((resolve,reject)=>{
            const request=db.transaction('pdfs').objectStore('pdfs').get(key);
            request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
        });
    }
    async function removeFile(key) {
        const db=await database();
        return new Promise((resolve,reject)=>{
            const tx=db.transaction('pdfs','readwrite');tx.objectStore('pdfs').delete(key);
            tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
        });
    }
    async function pass(orderId,batchId,file) {
        if (!file || !file.size || typeof file.slice !== 'function') throw new Error('Choose a PDF to pass this delivery.');
        const header = new TextDecoder().decode(await file.slice(0,5).arrayBuffer());
        if (header !== '%PDF-') throw new Error('Choose a valid PDF file.');
        const key=globalThis.crypto?.randomUUID?.() || `PDF-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await writeFile(key,file);
        try {
            const orders=JSON.parse(localStorage.getItem('orders') || '[]');
            const order=orders.find(row=>String(row.id)===String(orderId));
            if (!order) throw new Error('This order was removed.');
            if (!order.deliveryBatches?.length) order.deliveryBatches=batches(order);
            const batch=order.deliveryBatches.find(row=>String(row.id)===String(batchId));
            if (!batch) throw new Error('This delivery was removed. Refresh the list.');
            if (batch.pdf) throw new Error('This delivery has already been passed.');
            batch.pdf={key,name:file.name || 'Delivery.pdf',size:file.size,uploadedAt:new Date().toISOString()};
            batch.status='Success';batch.completedAt=batch.pdf.uploadedAt;
            order.deliveryStatus=order.deliveryBatches.every(row=>row.pdf) ? 'Success' : 'In Progress';
            localStorage.setItem('orders',JSON.stringify(orders));
            return batch;
        } catch(error) { await removeFile(key).catch(()=>{});throw error; }
    }
    async function downloadFile(pdf) {
        const file=await readFile(pdf.key);
        if (!file) throw new Error('Uploaded PDF is unavailable in this browser.');
        const url=URL.createObjectURL(file),link=document.createElement('a');
        link.href=url;link.download=pdf.name;document.body.appendChild(link);link.click();
        setTimeout(()=>{link.remove();URL.revokeObjectURL(url);},60000);
    }
    return {batches,snapshot,pass,downloadFile};
})();
