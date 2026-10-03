/* Each export reads the selected local order; no database order ID is required. */
window.OrderPdf = (() => {
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    function list(key) {
        try { const data = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(data) ? data : []; }
        catch (_) { return []; }
    }
    function date(value) {
        if (!value) return '--';
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? '--' : parsed.toLocaleDateString('en-GB', {
            day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata'
        });
    }
    async function imageOrText(path, fallback, style) {
        const img = new Image();
        const loaded = await new Promise(resolve => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = path;
        });
        return loaded ? `<img src="${escape(img.src)}" style="${style}" alt="">` : fallback;
    }
    async function download(order) {
        if (typeof html2pdf !== 'function') throw new Error('PDF library unavailable');
        const customer = list('customers').find(row => row.id === order.customerId) || {};
        const agent = list('agents').find(row => row.id === order.agentId) || {};
        const transport = list('transporters').find(row => row.id === order.transporterId) || {};
        const products = (Array.isArray(order.items) ? order.items : []).slice().sort((a, b) =>
            String(a.description || a.itemDescription || '').localeCompare(String(b.description || b.itemDescription || '')));
        const brandPieces = { NIVIBLOSSOM: 4, AMARI: 3, LITTLEDOLLY: 5 };
        let totalSets = 0, totalPieces = 0;
        const rows = products.map((item, index) => {
            const qty = Math.max(0, Number(item.qty) || 0);
            const perSet = Math.max(1, Number(item.piecesPerSet) || brandPieces[String(item.brand || '').toUpperCase().replace(/\s/g, '')] || 1);
            totalSets += qty;
            totalPieces += qty * perSet;
            return `<tr><td>${index + 1}</td><td>${escape(item.description || item.itemDescription || item.itemCode || '--')}</td><td>${escape(item.brand)}</td><td>${escape(item.size)}</td><td>${qty} Set / ${qty * perSet} pcs</td></tr>`;
        });
        const mantra = await imageOrText('assets/mantra.png', '<strong style="font-size:16px">श्री महावीराय नमः</strong>', 'width:150px;height:auto');
        const logo = await imageOrText('assets/images/logoooo.jpg', '<span style="font-size:26px;font-weight:bold">Little Dolly &nbsp; | &nbsp; AMARI &nbsp; | &nbsp; Nivi Blossom</span>', 'width:70%;height:auto;display:block;margin:0 auto');
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:-10000px;top:0;width:750px;';
        const root = document.createElement('div');
        root.style.cssText = 'width:750px;background:white;color:black;font:12px Arial,sans-serif;';
        host.appendChild(root);
        document.body.appendChild(host);
        const header = `<div style="text-align:center;margin-bottom:20px">${mantra}</div>
            <div style="text-align:center;margin-top:4px;margin-bottom:12px">${logo}</div>
            <div style="display:flex;gap:24px;line-height:1.4;margin-bottom:14px">
            <div style="width:56%"><strong style="font-size:22px">BOTHRA CREATION</strong><br>
            Plot NO. 29, 69 118, Readymade Complex, Pardesipura,<br>Indore, Madhya Pradesh 452010<br>
            Contact : 0731 255 4118 78 , +91 83588 79118<br>Email : info@littledolly.in<br>Website : www.littledolly.in<br>
            Order Taken By : ${escape(order.orderTakenBy || order.order_taken_by || '--')}<br><strong>Order No : ${escape(order.id)}</strong></div>
            <div style="width:44%;overflow-wrap:anywhere"><strong style="font-size:22px">${escape((order.shopName || '').toUpperCase())}</strong><br>
            <strong>Order Date : ${date(order.createdAt)}<br>Delivery Date : ${date(order.deliveryDate)}</strong><br>
            Client : ${escape(order.customerName)}<br>City : ${escape(order.city || customer.city || '--')}<br>
            Contact : ${escape(order.contact || customer.contact || '--')}<br>Agent : ${escape(order.agentName || agent.name || '--')}<br>
            Transport : ${escape(order.transportName || transport.name || '--')}</div></div>`;
        const terms = `<div style="margin-top:14px;font-size:11px;line-height:1.4"><strong>Terms &amp; Condition :-</strong>
            <ol style="padding-left:20px;margin:6px 0"><li>Order once placed can not be cancelled</li>
            <li>If payment is made after one month, interest will be charged @ 24% p.a. from bill date.</li>
            <li>Subject to INDORE Jurisdiction.</li><li>Other Charges as per applicable will be charged extra.</li>
            <li><strong>Note : </strong>For Any Query Regarding Order Please Contact - <strong>+91 83588 79118</strong></li></ol></div>`;
        const table = content => `<table style="width:100%;border-collapse:collapse;table-layout:fixed;text-align:center">
            <colgroup><col style="width:8%"><col style="width:32%"><col style="width:20%"><col style="width:18%"><col style="width:22%"></colgroup>
            <thead><tr style="background:#f0f0f0"><th>S.No</th><th>Item Description</th><th>Brand</th><th>Size</th><th>Sets</th></tr></thead>
            <tbody>${content}</tbody></table>`;
        const total = `<tr><td colspan="4" style="text-align:right"><strong>Total</strong></td><td><strong>${totalSets} Set / ${totalPieces} pcs</strong></td></tr>`;
        try {
            // Measure whole rows so long descriptions cannot be cut across pages.
            const pages = [];
            let current = [];
            const measure = content => {
                root.innerHTML = header + table(content) + terms;
                root.querySelectorAll('td,th').forEach(cell => { cell.style.cssText += ';border:1px solid black;padding:5px 6px;overflow-wrap:anywhere;'; });
                return root.scrollHeight;
            };
            for (const row of rows.length ? rows : ['<tr><td colspan="5">No items found in this order.</td></tr>']) {
                if (measure(current.join('') + row + total) > 1010 && current.length) {
                    pages.push(current); current = [];
                }
                current.push(row);
            }
            if (measure(current.join('') + total) > 1010 && current.length) {
                pages.push(current); current = [];
            }
            pages.push(current);
            let pdf;
            for (let i = 0; i < pages.length; i++) {
                measure(pages[i].join('') + (i === pages.length - 1 ? total : ''));
                const worker = html2pdf().set({
                    margin: [12, 8, 14, 8],
                    html2canvas: { scale: 2, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                }).from(root).toCanvas();
                const canvas = await worker.get('canvas');
                if (!pdf) {
                    await worker.toPdf(); pdf = await worker.get('pdf');
                    // Use one measured canvas per page to preserve repeated headers and terms.
                    while (pdf.internal.getNumberOfPages() > 1) pdf.deletePage(pdf.internal.getNumberOfPages());
                } else {
                    pdf.addPage();
                    pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 8, 12, 194, canvas.height * 194 / canvas.width);
                }
                pdf.setFontSize(10);
                pdf.text(`Page ${i + 1} of ${pages.length}`, 105, 290, { align: 'center' });
                if (i < pages.length - 1) pdf.text('PTO', 201, 290, { align: 'right' });
            }
            const filename = `${order.id}-${order.shopName || order.customerName || 'ORDER'}`.replace(/[^a-z0-9_-]+/gi, '-');
            pdf.save(`${filename}.pdf`);
        } finally { host.remove(); }
    }
    return { download };
})();
