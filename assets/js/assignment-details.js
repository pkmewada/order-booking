/* Shared assignment view and isolated A4 printing. No production mutations. */
(function () {
    'use strict';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const cssUrl = document.querySelector('link[href*="assets/css/assignment-details.css"]').href;
    function date(value) {
        if (!value) return '-';
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'});
    }
    function cell(label, value, className) {
        return `<div class="${className}"><span class="assignment-label">${esc(label)}</span><span class="assignment-value">${esc(value ?? '-')}</span></div>`;
    }
    function render(item) {
        const owner = item.type === 'outsource' ? ['Firm Name',item.firm] : ['Worker Name',item.worker];
        const subtitle = new Date().toLocaleDateString('en-GB') + (item.location ? ', ' + item.location : '');
        return `<article class="assignment-sheet"><header class="assignment-heading"><h1>ASSIGNMENT DETAILS</h1><p>${esc(subtitle)}</p></header>
            <div class="assignment-main"><aside class="assignment-summary">${[owner,['Design Number',item.designNumber],['Brand',item.brand],['Total Quantity',item.assignedQty ?? item.quantity ?? 0]].map(([k,v])=>cell(k,v|| (v===0?0:'-'),'assignment-summary-field')).join('')}</aside>
            <div class="assignment-image"><div class="assignment-placeholder"><svg viewBox="0 0 100 85" aria-hidden="true"><rect x="7" y="7" width="86" height="70" rx="7"/><circle cx="70" cy="29" r="6"/><path d="M18 65 40 35 55 55 64 45 83 65"/></svg><span>No Image</span></div>${item.photo ? `<img src="${esc(item.photo)}" alt="Design ${esc(item.designNumber || '')}" onload="this.previousElementSibling.hidden=true" onerror="this.hidden=true;this.previousElementSibling.hidden=false">` : ''}</div></div>
            <section class="assignment-info">${[['Batch ID',item.batchId],['Sub-Batch',item.subBatch],['Color',item.color],['Piece Type',item.pieceType],['Priority',item.priority],['Delivery Date',date(item.deliveryDate)]].map(([k,v])=>cell(k,v||'-','assignment-info-cell')).join('')}</section>
            <footer class="assignment-signature"><span>Signature .....</span></footer></article>`;
    }
    let printing = false;
    async function print() {
        if (printing) return;
        const sheet = document.querySelector('#viewDetailBody .assignment-sheet');
        if (!sheet) return;
        printing = true;
        const frame = document.createElement('iframe');
        frame.title = 'Assignment print document';
        frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0';
        document.body.append(frame);
        try {
            await new Promise((resolve,reject)=>{
                const timeout = setTimeout(()=>reject(new Error('Print layout could not load. Please try again.')),15000);
                frame.onload=()=>{clearTimeout(timeout);resolve();};
                frame.srcdoc=`<!doctype html><html><head><meta charset="utf-8"><title>Assignment Details</title><link rel="stylesheet" href="${esc(cssUrl)}"></head><body class="assignment-print-document">${sheet.outerHTML}</body></html>`;
            });
            await Promise.all([...frame.contentDocument.images].map(img=>img.complete ? Promise.resolve() : new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(()=>{if(!img.complete){img.hidden=true;img.previousElementSibling.hidden=false;}resolve();},5000);} )));
            await frame.contentDocument.fonts.ready;
            frame.contentWindow.focus();
            frame.contentWindow.print();
        } finally {
            printing=false;
            // Keep the document alive while the browser's print preview is open.
            setTimeout(()=>frame.remove(),60000);
        }
    }
    document.addEventListener('click',event=>{
        if (!event.target.closest('#printDetailBtn')) return;
        event.preventDefault();event.stopImmediatePropagation();
        print().catch(error=>{if(window.Swal)Swal.fire({icon:'error',title:'Unable to print',text:error.message});});
    },true);
    window.AssignmentDetails = {render,print};
})();
