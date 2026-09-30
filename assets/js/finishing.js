$(document).ready(async function () {
    'use strict';
    const P = Production, page = $('[data-finishing-page]').data('finishing-page');
    const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const date = v => v ? new Date(v).toLocaleString() : '-';
    const deliveryBadge=(value,done)=>{if(!value)return '-';const d=new Date(value+'T00:00:00'),now=new Date();now.setHours(0,0,0,0);const cls=done||d>now?'delivery-ontrack':+d===+now?'delivery-due-today':'delivery-overdue';return `<span class="delivery-date-badge ${cls}">${esc(d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}))}</span>`;};
    const day = v => { const d=new Date(v); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
    const money = v => Number.isFinite(Number(v)) && v !== '' ? Number(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}) : '-';
    const table = (heads,rows) => `<div class="table-responsive"><table class="table table-bordered text-nowrap"><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${heads.length}" class="text-muted text-center py-4">No records.</td></tr>`}</tbody></table></div>`;
    let state, busy=false;
    const bomFor = design => JSON.parse(localStorage.getItem('bomMasterData')||'[]').find(b=>String(b.designNumber).trim().toLowerCase()===String(design).trim().toLowerCase()) || {};
    const setSummary = lot => {
        const count=lot.sizes?.length || P.brandSizes(lot.brand).length;
        if(!count)return `${lot.quantity} quantity`;
        const sets=Math.floor(lot.quantity/count), remainder=lot.quantity%count;
        return `${lot.quantity} quantity &rarr; <strong>${sets} sets</strong>${remainder?`<div class="small text-muted">${remainder} remaining</div>`:''}`;
    };
    async function save(fn,close=false) {
        if(busy)return;busy=true;$('#assignBundlingBtn,.pass-bundling').prop('disabled',true);
        try {await fn();if(close)bootstrap.Modal.getOrCreateInstance(document.getElementById('bundlingModal')).hide();render();}
        catch(e){await Swal.fire({icon:'error',title:'Could not save',text:e.message});render();}
        finally{busy=false;$('#assignBundlingBtn,.pass-bundling').prop('disabled',false);}
    }
    function documentFor(batchId, allRows) {
        const pools = new Map();
        allRows.forEach(r=>(r.productionHistory||[]).forEach(p=>pools.set(String(p.id),p)));
        const events=[...pools.values()].flatMap(p=>(p.stageHistory||[]).map(h=>({...h,piece:p.pieceItem||p.pieceNumber,worker:h.after?.worker||h.before?.worker||'-'}))).sort((a,b)=>String(a.at).localeCompare(String(b.at)));
        const quantities=allRows.map(r=>`<tr><td>${esc(r.packingLotId)}</td><td>${esc(r.designNumber)}</td><td>${esc(r.color||'-')}</td><td>${setSummary(r)}</td><td>${money(r.mrp)}</td><td>${r.mrp!==''?money(Number(r.mrp)*r.quantity):'-'}</td><td>${esc(r.worker)}</td><td>${esc(date(r.assignedAt))}</td><td>${esc(date(r.receivedAt))}</td></tr>`).join('');
        const packingSources=[...new Map(allRows.map(r=>[r.packingLotId,r])).values()];
        const packing=packingSources.flatMap(r=>(r.packingHistory||[]).map(w=>`<tr><td>${esc(r.packingLotId)}</td><td>${esc(w.pieceType)}</td><td>${esc(w.worker)}</td><td>${w.assignedQty}</td><td>${w.completedQty}</td><td>${w.passedQty}</td><td>${esc(w.deliveryDate||'-')}</td></tr>`)).join('');
        return `<details class="batch-document"><summary>Batch ${esc(batchId)} — Complete Documentation</summary><div class="document-content"><h6>Quantity &amp; MRP Valuation</h6><p class="text-muted small">All received lots for this batch. MRP value is a stock valuation, not a sales invoice.</p>${table(['Packing Lot','Design','Color','Quantity','MRP','MRP Value','Bundling Worker','Assigned','Inventory Received'],quantities)}<h6 class="mt-4">Packing Record</h6>${table(['Packing Lot','Piece','Worker','Assigned','Completed','Passed','Delivery Date'],packing)}<h6 class="mt-4">Production History</h6>${table(['Date','Piece','Stage','Action','Quantity','Worker'],events.map(h=>`<tr><td>${esc(date(h.at))}</td><td>${esc(h.piece)}</td><td>${esc(h.stage)}</td><td>${esc(h.action)}</td><td>${esc(h.qty)}</td><td>${esc(h.worker)}</td></tr>`).join(''))}</div></details>`;
    }
    function renderInventory() {
        const batch=String($('#inventoryBatch').val()||'').trim().toLowerCase(),design=String($('#inventoryDesign').val()||'').trim().toLowerCase(),from=$('#inventoryFrom').val(),to=$('#inventoryTo').val();
        if(from&&to&&from>to){$('#inventorySummary').text('The From date must be on or before the To date.');$('#inventoryList').empty();return;}
        const records=state.inventoryData.filter(r=>String(r.batchId).toLowerCase().includes(batch)&&String(r.designNumber).toLowerCase().includes(design)&&(!from||day(r.receivedAt)>=from)&&(!to||day(r.receivedAt)<=to));
        $('#inventorySummary').text(`${records.length} lots · ${records.reduce((n,r)=>n+r.quantity,0)} total quantity`);
        const groups=new Map();records.forEach(r=>{if(!groups.has(r.batchId))groups.set(r.batchId,[]);groups.get(r.batchId).push(r);});
        $('#inventoryList').html([...groups].map(([id,rows])=>`<div class="card custom-card"><div class="card-header"><div class="card-title">${esc(id)} <span class="badge bg-success ms-2">In Inventory</span></div></div><div class="card-body">${table(['Packing / Bundling Lot','Brand','Design / Pattern','Color','MRP','Pieces','Quantity / Sets','Worker','Received'],rows.map(r=>`<tr><td>${esc(r.packingLotId)}<div class="small text-muted">${esc(r.bundlingId)}</div></td><td>${esc(r.brand)}</td><td>${esc(r.designNumber)} / ${esc(r.pattern||'-')}</td><td>${esc(r.color||'-')}</td><td>${money(r.mrp)}</td><td>${r.pieces.map(esc).join('<br>')}</td><td>${setSummary(r)}</td><td>${esc(r.worker)}</td><td>${esc(date(r.receivedAt))}</td></tr>`).join(''))}${documentFor(id,state.inventoryData.filter(r=>r.batchId===id))}</div></div>`).join('')||'<div class="card custom-card"><div class="card-body text-muted text-center py-5">No inventory matches these filters.</div></div>');
    }
    function render() {
        state=P.readState();
        if(page==='inventory'){renderInventory();return;}
        $('#bundlingReady').html(P.bundlingReady(state).map(l=>{const bom=bomFor(l.designNumber);return `<tr><td>${esc(l.batchId)}</td><td>${esc(l.packingLotId)}</td><td>${esc(l.brand)}</td><td>${esc(l.designNumber)} / ${esc(bom.pattern||'-')}</td><td>${money(bom.mrp??'')}</td><td>${l.pieces.map(esc).join('<br>')}</td><td>${setSummary(l)}<div class="small text-muted">Received: ${l.totalQuantity} / Assigned: ${l.assignedQuantity}</div></td><td><button class="btn btn-sm btn-dark assign-bundling" data-lot="${esc(l.packingLotId)}">Assign</button></td></tr>`;}).join('')||'<tr><td colspan="8" class="text-center text-muted py-4">No fully passed packing lots awaiting bundling.</td></tr>');
        $('#bundlingAssigned').html(state.bundlingData.map((r,i)=>`<tr><td>${i+1}</td><td><strong>${esc(r.batchId)}</strong></td><td class="text-primary fw-semibold">${esc(r.id)}</td><td>${esc(r.brand)}</td><td>${esc(r.designNumber)} / ${esc(r.pattern||'-')}</td><td>${money(r.mrp)}</td><td>${r.pieces.map(esc).join('<br>')}</td><td>${esc(r.worker)}</td><td>${setSummary(r)}</td><td>${deliveryBadge(r.deliveryDate,r.status==='passed')}</td><td><span class="status-badge ${r.status==='passed'?'passed':'pending'}">${r.status==='passed'?'Passed':'Pending'}</span></td><td>${r.status==='passed'?'<span class="text-success">Sent to Inventory</span>':`<button class="btn btn-sm btn-success pass-bundling" data-id="${esc(r.id)}" title="Pass to Inventory" aria-label="Pass to Inventory"><i class="bx bx-check-circle"></i></button>`}</td></tr>`).join('')||'<tr><td colspan="12" class="text-center text-muted py-4">No bundling assignments yet.</td></tr>');
    }
    $(document).on('click','.assign-bundling',function(){SetAssignments.open('bundling',String($(this).data('lot')),render);});
    $('#bulkAssignBundlingBtn').on('click',()=>SetAssignments.open('bundling',null,render));
    $(document).on('click','.pass-bundling',function(){const id=String($(this).data('id'));save(()=>P.passBundling(id));});
    $('#inventoryBatch,#inventoryDesign,#inventoryFrom,#inventoryTo').on('input change',()=>{if(state)renderInventory();});
    $('#refreshFinishingBtn').on('click',render);window.addEventListener('storage',()=>{if(state)render();});window.addEventListener('focus',()=>{if(state)render();});
    try{await P.initialize();render();}catch(e){Swal.fire({icon:'error',title:'Unable to load '+page,text:e.message});}
});
