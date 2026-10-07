/* Export history in an isolated A4 document so modal positioning cannot crop it. */
(function () {
    'use strict';
    const libraryUrl = new URL('../libs/html2pdf/html2pdf.bundle.min.js', document.currentScript.src).href;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let busy = false;
    async function download() {
        const body = document.getElementById('batchHistoryBody');
        if (busy || !body || !body.textContent.trim()) return;
        busy = true;
        const button = document.getElementById('downloadBatchHistoryBtn');
        if (button) button.disabled = true;
        const frame = document.createElement('iframe');
        frame.title = 'Batch History PDF document';
        frame.style.cssText = 'position:fixed;left:0;top:0;width:794px;height:1123px;border:0;z-index:-10000;pointer-events:none;';
        document.body.appendChild(frame);
        try {
            await new Promise((resolve,reject) => {
                const timeout = setTimeout(() => reject(new Error('PDF document could not load. Please retry.')), 20000);
                frame.onload = () => {
                    clearTimeout(timeout);
                    if (typeof frame.contentWindow.html2pdf !== 'function') reject(new Error('PDF library could not load. Please retry.'));
                    else resolve();
                };
                frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>Batch History</title><style>
                    html,body { margin:0;padding:0;background:#fff;color:#161617;font:12px Arial,sans-serif;line-height:1.5; }
                    * { box-sizing:border-box; }
                    .batch-history-pdf-sheet { width:190mm;margin:0;padding:0; }
                    .batch-history-pdf-sheet > * { width:100%;max-width:100%;overflow:visible !important; }
                    h4 { margin:0;font-size:22px;line-height:1.3; }
                    small { font-size:11px; }
                    table { width:100% !important;max-width:100%;margin:0;border-collapse:collapse;table-layout:fixed; }
                    td,th { padding:8px 10px !important;text-align:left;vertical-align:top;white-space:normal !important;overflow-wrap:anywhere; }
                    tr { break-inside:avoid; }
                    th:first-child { width:40%; }
                    th:nth-child(2) { width:40%; }
                    th:nth-child(3) { width:20%; }
                    thead { display:table-header-group; }
                </style><script src="${esc(libraryUrl)}"></script></head><body><article class="batch-history-pdf-sheet">${body.innerHTML}</article></body></html>`;
            });
            const doc = frame.contentDocument;
            await doc.fonts.ready;
            const batch = body.querySelector('strong')?.textContent || 'Batch';
            const name = `Batch-History-${batch}`.replace(/[^a-z0-9_-]+/gi, '-');
            // Render and measure in the same window; the parent modal and scroll offset are excluded.
            const options = frame.contentWindow.JSON.parse(JSON.stringify({
                filename:`${name}.pdf`,margin:[10,10,10,10],
                image:{type:'jpeg',quality:.98},
                html2canvas:{scale:2,backgroundColor:'#ffffff',scrollX:0,scrollY:0},
                jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
                pagebreak:{mode:['css','legacy'],avoid:'tr'}
            }));
            const worker = frame.contentWindow.html2pdf().set(options).from(doc.querySelector('.batch-history-pdf-sheet')).toPdf();
            const pdf = await worker.get('pdf');
            // Download from the main page so removing the render iframe cannot cancel the file save.
            const blob = new Blob([pdf.output('arraybuffer')], {type:'application/pdf'});
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${name}.pdf`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 60000);
        } finally {
            frame.remove();
            busy = false;
            if (button) button.disabled = false;
        }
    }
    function setup() {
        const content = document.querySelector('#batchHistoryModal .modal-content');
        if (!content || document.getElementById('downloadBatchHistoryBtn')) return;
        const footer = document.createElement('div'); footer.className = 'modal-footer';
        footer.innerHTML = '<button type="button" class="btn btn-dark" id="downloadBatchHistoryBtn"><i class="bx bx-download me-1"></i> Download PDF</button>';
        content.appendChild(footer);
        footer.querySelector('button').addEventListener('click', () => download().catch(error => {
            if (window.Swal) Swal.fire({icon:'error',title:'Unable to download PDF',text:error.message});
        }));
    }
    function packing(batchId) {
        const s = Production.readState(), rows = s.packingData.filter(w => String(w.batchId) === String(batchId)), first = rows[0];
        if (!first) return '';
        const history = s.packingData_history || [];
        return `<div style="border-bottom:2px solid #161617;padding-bottom:12px;margin-bottom:18px"><h4>BATCH HISTORY</h4><small>Batch ID: <strong>${esc(batchId)}</strong> · Design: <strong>${esc(first.designNumber)}</strong> · Brand: <strong>${esc(first.brand)}</strong></small><div>Generated: ${esc(new Date().toLocaleString('en-GB'))}</div></div>` + rows.map((w,i) => {
            const events = history.filter(h => String(h.workId) === String(w.id)).sort((a,b) => String(a.at).localeCompare(String(b.at)));
            return `<section style="border:1px solid #e2e7f1;border-radius:8px;margin-bottom:16px;overflow:hidden"><div style="background:#f8f9fa;padding:10px 14px"><strong>${i+1}. ${esc(w.packingLotId || w.subBatch)} — ${esc(w.worker)}</strong><div>Piece: ${esc(w.pieceType)} · Qty: ${w.assignedQty} · Progress: ${w.completedQty} · Damage: ${w.damageQty} · Passed: ${w.passedQty} · Remaining: ${Production.calculateProductionMath(w).uncompletedQty}</div></div><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th>Date &amp; Time</th><th>Action</th><th>By</th></tr></thead><tbody>${events.map(h => `<tr><td>${esc(h.at)}</td><td>${esc(h.action)}</td><td>${esc(h.by || 'Manager')}</td></tr>`).join('') || '<tr><td colspan="3">No history events</td></tr>'}</tbody></table></section>`;
        }).join('');
    }
    window.BatchHistoryPdf = {download, packing};
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
