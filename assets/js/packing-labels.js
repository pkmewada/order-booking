/* Packing-only BOM label lookup. No production balance mutations. */
(function () {
    'use strict';
    const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const all = () => JSON.parse(localStorage.getItem('bomMasterData') || '[]');
    const find = design => all().find(b=>String(b.designNumber).trim().toLowerCase()===String(design||'').trim().toLowerCase());
    const sizes = brand => ({'LITTLE DOLLY':['18','20','22','24','26'],'AMARI':['S','M','L'],'NIVI BLOSSOM':['28','30','32','34']}[String(brand||'').trim().toUpperCase()] || []);
    const ages = brand => ({'LITTLE DOLLY':'1–5 Years','AMARI':'6 Months–2 Years','NIVI BLOSSOM':'6–10 Years'}[String(brand||'').trim().toUpperCase()] || '');
    const css = `.packing-label{box-sizing:border-box;width:180mm;min-height:60mm;display:grid;grid-template-columns:2fr 1fr;background:#fff;color:#111;border:1px solid #333;border-radius:5px;font-family:Arial,sans-serif;break-inside:avoid;margin:0 auto 5mm}.packing-label *{box-sizing:border-box}.label-main{padding:2mm;display:flex;flex-direction:column}.label-stub{padding:2mm;border-left:1px dashed #777;font-size:12px;display:flex;flex-direction:column}.label-brand{font-family:Georgia,"Times New Roman",serif;font-weight:700;font-size:34px;text-align:center;border-bottom:1px solid #333;padding:0 0 1.5mm;margin-bottom:0;letter-spacing:.3px;line-height:1.15}.label-stub .label-brand{font-size:25px;margin-bottom:1mm;padding-bottom:1mm}.label-grid{display:grid;grid-template-columns:25% 75%;grid-template-rows:auto auto auto 1fr;flex:1}.label-grid>div{padding:1.5mm;min-width:0}.label-design{grid-column:1;grid-row:1 / 3;text-align:center;border-right:1px solid #555;border-bottom:1px solid #555;display:flex;flex-direction:column;justify-content:center;gap:2mm}.label-colour{grid-column:2;grid-row:1;border-bottom:1px solid #555;display:flex;align-items:center;justify-content:space-between;gap:2mm}.label-colour .label-big{font-size:21px}.label-price{grid-column:2;grid-row:2;border-bottom:1px solid #555}.label-size-cell{grid-column:1;grid-row:3 / 5;border-right:1px solid #555;text-align:center;display:flex;flex-direction:column;justify-content:center;gap:2mm}.label-pattern{grid-column:2;grid-row:3;border-bottom:1px solid #555;display:flex;justify-content:space-between;align-items:center;gap:2mm;font-size:13px;overflow-wrap:anywhere}.label-pcs{white-space:nowrap;font-weight:700}.label-code-cell{grid-column:2;grid-row:4;display:flex;align-items:center;justify-content:center}.label-big{font-size:23px;font-weight:700;overflow-wrap:anywhere}.label-size{font-size:46px;font-weight:700;line-height:1.15}.label-barcode{display:block;width:100%;height:17mm}.label-stub p{margin:.6mm 0;line-height:1.3;overflow-wrap:anywhere}.label-tax{font-size:8px;margin-top:.5mm}.label-care{border:1px solid #555;text-align:center;margin-top:1mm;padding:1mm;font-size:10px;overflow-wrap:anywhere}.label-care strong{display:block;margin-bottom:.5mm;font-size:10px}.label-main .label-design>span,.label-main .label-colour>span{font-size:16px}.label-main .label-design .label-big{font-size:26px}.label-main .label-pattern{font-size:15px}.label-print{margin:12px}@media print{@page{size:A4;margin:10mm}.label-print{display:none}body{margin:0}}`;
    function label(b,size) {
        if(typeof JsBarcode!=='function') throw Error('Barcode library did not load. Refresh Packing and retry.');
        if(!sizes(b.brand).includes(size)) throw Error('Choose a valid size for this brand.');
        const code = String(b.id ?? b.bomId ?? b.designNumber) + '-' + size;
        const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
        JsBarcode(svg,code,{format:'CODE128',width:2,height:45,fontSize:12,margin:10});
        const barcode=new XMLSerializer().serializeToString(svg).replace('<svg ','<svg class="label-barcode" ');
        const pcs=Number(b.pieceCount)||b.pieces?.length||1;
        const money=b.mrp!=='' && b.mrp!=null ? Number(b.mrp).toLocaleString('en-IN',{maximumFractionDigits:2}) : '-';
        const dolly=String(b.brand||'').trim().toUpperCase()==='LITTLE DOLLY';
        const brand=esc(b.brand);
        const heading=`<div class="label-brand${dolly?' label-brand-dolly':''}">${brand}</div>`;
        return `<article class="packing-label"><div class="label-main">${heading}<div class="label-grid"><div class="label-design"><span>D. No.</span><strong class="label-big">${esc(b.designNumber)}</strong></div><div class="label-colour"><span>Col:</span><strong class="label-big">${esc(b.color)}</strong></div><div class="label-price"><strong class="label-big">MRP: ${esc(money)}/-</strong><div class="label-tax">Incl. of all taxes</div></div><div class="label-size-cell"><span>Size</span><strong class="label-size">${esc(size)}</strong></div><div class="label-pattern"><span>Pattern: <strong>${esc(b.pattern||'-')}</strong></span><span class="label-pcs">${pcs} Pcs</span></div><div class="label-code-cell">${barcode}</div></div></div><div class="label-stub">${heading}<p>D. No. <b>${esc(b.designNumber)}</b></p><p>Colour: <b>${esc(b.color)}</b></p><p>Pattern: <b>${esc(b.pattern||'-')}</b></p><p>Size: <b>${esc(size)}</b> &nbsp; Set: <b>${pcs} Pcs</b></p><p>MRP: <b>${esc(money)}/-</b> <span class="label-tax">Incl. of all taxes</span></p>${barcode}<div class="label-care"><strong>Customer Care</strong>littledollyindore@gamil.com</div></div></article>`;

    }
    function downloadFor(row,size,quantity) {
        const b=find(row.designNumber);
        if(!b) throw Error('BOM not found for this design number.');
        const qty=Number(quantity);
        if(!Number.isSafeInteger(qty)||qty<1||qty>10000) throw Error('Label quantity must be between 1 and 10000.');
        const selectedSizes=Array.isArray(size)?size:[size];
        if(!selectedSizes.length) throw Error('No label sizes are configured for this brand.');
        const html=selectedSizes.map(value=>label(b,value)).join('');
        const blob=new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>${esc(row.packingLotId||b.designNumber)} Labels</title><style>${css}</style></head><body><button class="label-print" onclick="window.print()">Print / Save PDF</button>${html.repeat(qty)}</body></html>`],{type:'text/html;charset=utf-8'});
        const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${String(row.packingLotId||b.designNumber).replace(/[^a-z0-9_-]/gi,'_')}-${Array.isArray(size)?'all-sizes':size}-labels.html`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }
    function downloadBrandSizes(row) {
        const b=find(row.designNumber);
        if(!b) throw Error('BOM not found for this design number.');
        downloadFor(row,sizes(b.brand),1);
    }
    let context=null, brandSizesOnly=false;
    function preview(reset=false) {
        const b=find($('#labelDesign').val()), old=$('#labelSize').val();
        if(reset) $('#labelSize').html((b?sizes(b.brand):[]).map(v=>`<option>${v}</option>`).join(''));
        if(reset && b && sizes(b.brand).includes(old)) $('#labelSize').val(old);
        $('#labelDetails').text(b?`${b.brand} · ${b.color} · Pattern: ${b.pattern||'-'} · MRP: ${b.mrp??'-'} · ${ages(b.brand)}`:'Enter an existing BOM design number.');
        try {$('#labelPreview').html(b?`<style>${css}</style><div style="overflow:auto">${brandSizesOnly?sizes(b.brand).map(size=>label(b,size)).join(''):label(b,$('#labelSize').val())}</div>`:'');}catch(e){$('#labelPreview').text(e.message);}
        $('#downloadLabelBtn').prop('disabled',!b || (brandSizesOnly?!sizes(b.brand).length:!sizes(b.brand).includes($('#labelSize').val())));
    }
    function open(row=null,quantity=1,allBrandSizes=false) {
        context=row;
        brandSizesOnly=allBrandSizes;
        $("#labelSize,#labelQuantity").closest(".col-md-4").toggle(!brandSizesOnly);
        $("#labelDesign").prop("readOnly",brandSizesOnly);
        $('#labelQuantity').html(Array.from({length:Math.max(1000,Math.min(10000,quantity))},(_,i)=>`<option>${i+1}</option>`).join(''));
        $('#labelDesigns').html(all().map(b=>`<option value="${esc(b.designNumber)}">${esc(b.brand)}</option>`).join(''));
        $('#labelDesign').val(row?.designNumber||'');$('#labelQuantity').val(quantity);preview(true);
        if(!brandSizesOnly && row?.labelSize){$('#labelSize').val(row.labelSize);preview();}
        bootstrap.Modal.getOrCreateInstance(document.getElementById('labelModal')).show();
    }
    $(function(){
        $('#labelDesign').on('input change',()=>{context=null;preview(true);});$('#labelSize').on('change',()=>preview());
        $('#downloadLabelBtn').on('click',()=>{try{if(brandSizesOnly) downloadBrandSizes(context); else downloadFor(context||{designNumber:$('#labelDesign').val()},$('#labelSize').val(),$('#labelQuantity').val());}catch(e){Swal.fire({icon:'error',title:'Could not create label',text:e.message});}});
    });
    window.PackingLabels={find,sizes,open,downloadFor,downloadBrandSizes,label};
})();
