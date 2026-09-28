$(document).ready(async function () {
    'use strict';
    const P = Production;
    const workers = ['Ahmad Khan','Bilal Ahmed','Danish Ali','Faisal Khan','Usman Malik','Ali Ahmed','Imran Khan','Saeed Ahmad','Zafar Iqbal','Rashid Mahmood'];
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const modal = id => bootstrap.Modal.getOrCreateInstance(document.getElementById(id));
    const priority = v => `<span class="priority-badge priority-${esc(String(v || 'Medium').toLowerCase())}">${esc(v || 'Medium')}</span>`;
    let state, availablePage = 1, assignedPage = 1;
    function lots() {
        const groups = new Map();
        for (const w of state.packingData) {
            const id = w.packingLotId || `legacy-${w.id}`;
            if (!groups.has(id)) groups.set(id, {id, rows: []});
            groups.get(id).rows.push(w);
        }
        return [...groups.values()];
    }
    function batches(held) { return P.packingBatches(state).filter(b => b.held === held && b.pieces.some(p => p.available > 0)); }
    function batchRows(b) {
        const n = b.pieces.length;
        return b.pieces.map((p,i) => `<tr>${i ? '' : `<td rowspan="${n}"><strong>${esc(b.batchId)}</strong></td><td rowspan="${n}">${b.photo ? `<img src="${esc(b.photo)}" alt="Design" style="width:70px;height:85px;object-fit:contain">` : '<div class="bg-light rounded p-3 text-muted small">No Image</div>'}</td><td rowspan="${n}">${esc(b.brand)}</td><td rowspan="${n}">${esc(b.designNumber)}</td><td rowspan="${n}">${esc(b.color)}</td>`}<td><strong>${esc(p.number)} Piece</strong></td><td>${esc(p.item)}${p.size ? `<div class="small text-muted">Size: ${esc(p.size)}</div>` : ''}</td><td><span class="text-muted">${p.received} / </span><strong class="text-success">${p.assigned}</strong><div class="small text-muted">Available: ${p.available}</div></td><td>${priority(b.priority)}</td><td><span class="status-badge ${b.held ? 'stopped' : p.assigned ? 'assign_progress' : 'not_assigned'}">${b.held ? 'On Hold' : p.assigned ? 'In Progress' : 'Not Assigned'}</span></td>${i ? '' : `<td rowspan="${n}"><div class="d-flex gap-1 flex-wrap">${b.held ? `<button class="btn btn-sm btn-dark restore-btn" data-batch="${esc(b.batchId)}">Restore</button>` : `<button class="btn btn-sm btn-dark assign-single-btn" data-batch="${esc(b.batchId)}" ${b.available ? '' : 'disabled'}><i class="bx bx-plus"></i> Assign</button><button class="btn btn-sm btn-dark hold-btn" data-batch="${esc(b.batchId)}">Hold</button>`}</div><div class="small text-muted mt-1">${b.available} paired sets</div>${b.available ? '' : '<div class="small text-muted">Waiting for matching pieces</div>'}</td>`}</tr>`).join('');
    }
    function lotRows(l,index) {
        const n = l.rows.length, first = l.rows[0], complete = l.rows.every(w => P.calculateProductionMath(w).uncompletedQty === 0);
        return l.rows.map((w,i) => `<tr>${i ? '' : `<td rowspan="${n}">${index+1}</td><td rowspan="${n}"><strong>${esc(w.batchId)}</strong></td><td rowspan="${n}">${esc(l.id)}<div class="small text-muted">${w.assignedQty} sets</div></td><td rowspan="${n}">${esc(w.brand)}</td>`}<td>${esc(w.pieceType)}${w.size ? `<div class="small text-muted">${esc(w.size)}</div>` : ''}</td><td>${esc(w.worker)}</td><td><span class="text-muted">${w.assignedQty} / </span><strong class="text-success">${w.completedQty}</strong></td><td>${w.completedQty} <span class="progress-bar-container"><span class="progress-bar-fill" style="width:${w.assignedQty ? Math.min(100,100*w.completedQty/w.assignedQty) : 0}%"></span></span></td><td>${w.damageQty ? `<span class="damage-badge">${w.damageQty}</span>` : '-'}</td><td>${P.calculateProductionMath(w).uncompletedQty}</td>${i ? '' : `<td rowspan="${n}">${priority(first.priority)}</td><td rowspan="${n}"><span class="delivery-date-badge delivery-ontrack">${esc(first.deliveryDate)}</span></td><td rowspan="${n}"><span class="status-badge ${complete ? 'passed' : 'in_progress'}">${complete ? 'Completed' : 'Assigned'}</span></td><td rowspan="${n}"><button class="btn btn-sm btn-dark progress-btn" data-lot="${esc(l.id)}" title="Edit packing lot" aria-label="Edit packing lot"><i class="bx bx-edit"></i></button></td>`}</tr>`).join('');
    }
    function pager(selector,page,total,set) {
        $(selector).html(`<div class="info-text">${total} ${selector === '#availablePagination' ? 'batches' : 'assignments'}</div><div class="pager"><button class="page-btn prev" ${page===1?'disabled':''} aria-label="Previous page">&lsaquo;</button><button class="page-btn active">${page}</button><button class="page-btn next" ${page*10>=total?'disabled':''} aria-label="Next page">&rsaquo;</button></div>`);
        $(selector+' .prev').on('click',()=>set(page-1));$(selector+' .next').on('click',()=>set(page+1));
    }
    function render() {
        state = P.readState(); const ready = batches(false), assigned = lots();
        availablePage = Math.min(availablePage,Math.max(1,Math.ceil(ready.length/10))); assignedPage = Math.min(assignedPage,Math.max(1,Math.ceil(assigned.length/10)));
        $('#availableList').html(ready.slice((availablePage-1)*10,availablePage*10).map(batchRows).join('') || '<tr><td colspan="11" class="text-center text-muted py-4">No items received for packing.</td></tr>');
        $('#assignedList').html(assigned.slice((assignedPage-1)*10,assignedPage*10).map((l,i)=>lotRows(l,(assignedPage-1)*10+i)).join('') || '<tr><td colspan="14" class="text-center text-muted py-4">No packing assignments yet.</td></tr>');
        $('#holdList').html(batches(true).map(batchRows).join('') || '<tr><td colspan="11" class="text-center text-muted py-4">No held balances.</td></tr>');
        pager('#availablePagination',availablePage,ready.length,p=>{availablePage=p;render();});pager('#assignedPagination',assignedPage,assigned.length,p=>{assignedPage=p;render();});
    }
    async function action(fn,close) { try { await fn(); if(close) modal(close).hide(); render(); } catch(e) { await Swal.fire({icon:'error',title:'Could not save packing',text:e.message});render(); } }
    function assignmentFields() {
        const b=batches(false).find(b=>b.batchId===$('#batchSelect').val());
        if(!b){$('#assignRowsContainer').empty();return;}
        $('#assignRowsContainer').html(`<div class="bulk-item-card"><div class="bulk-item-header"><div><div class="bulk-item-title">${esc(b.batchId)} &mdash; Design: ${esc(b.designNumber)}</div><div class="bulk-item-sub">Brand: ${esc(b.brand)} &middot; Color: ${esc(b.color)} &middot; ${b.pieces.length} pieces per set</div><div class="bulk-qty-summary"><span class="bulk-qty-pill remaining">${b.available} paired sets available</span>${b.pieces.map(p=>`<span class="bulk-qty-pill total">${esc(p.item)}${p.size?' / '+esc(p.size):''}: ${p.available}</span>`).join('')}</div></div></div><div class="table-responsive"><table class="table table-bordered text-nowrap"><thead><tr><th>Worker</th><th>Qty / Sets</th>${b.pieces.map(p=>`<th>${esc(p.item)}${p.size?' / '+esc(p.size):''}</th>`).join('')}<th>Priority</th><th>Delivery Date</th></tr></thead><tbody><tr><td><select class="form-select worker-select"><option value="">Select Worker</option>${workers.map(w=>`<option>${esc(w)}</option>`).join('')}</select></td><td><input type="number" class="form-control quantity-input" min="1" max="${b.available}" value="${b.available}" style="min-width:80px"></td>${b.pieces.map(()=>`<td class="piece-quantity">${b.available}</td>`).join('')}<td><select class="form-select priority-select">${['Low','Medium','High'].map(v=>`<option ${v===(b.priority||'Medium')?'selected':''}>${v}</option>`).join('')}</select></td><td><input class="form-control delivery-date-input" type="date" value="${new Date(Date.now()+7*86400000).toISOString().slice(0,10)}"></td></tr></tbody></table></div></div>`);
    }
    $(document).on('click','.assign-single-btn',function(){render();$('#batchSelect').html('<option value="">Choose Batch</option>'+batches(false).filter(b=>b.available>0).map(b=>`<option value="${esc(b.batchId)}">${esc(b.batchId)} &mdash; ${b.available} paired sets</option>`).join('')).val(String($(this).data('batch')));assignmentFields();modal('assignModal').show();});
    $('#batchSelect').on('change',assignmentFields);
    $(document).on('input','.quantity-input',function(){$('.piece-quantity').text(this.value);});
    $('#saveAssignBtn').on('click',()=>action(()=>P.assignPacking({batchId:$('#batchSelect').val(),quantity:Number($('.quantity-input').val()),worker:$('.worker-select').val(),priority:$('.priority-select').val(),deliveryDate:$('.delivery-date-input').val()}),'assignModal'));
    $('#holdListBtn').on('click',()=>{render();modal('holdModal').show();});
    $(document).on('click','.hold-btn,.restore-btn',function(){action(()=>P.setPackingHold(String($(this).data('batch')),$(this).hasClass('hold-btn')));});
    $(document).on('click','.progress-btn',function(){
        state=P.readState();const l=lots().find(l=>l.id===String($(this).data('lot')));
        $('#progressBody').html(`<p><strong>${esc(l.rows[0].batchId)} / ${esc(l.id)}</strong></p><div class="table-responsive"><table class="table table-bordered"><thead><tr><th>Piece / Size</th><th>Assigned</th><th>Completed Good Pieces (Total)</th><th>Damage (Total)</th><th>Recovery</th></tr></thead><tbody>${l.rows.map(w=>`<tr class="progress-piece" data-id="${w.id}"><td>${esc(w.pieceType)} ${esc(w.size||'')}</td><td>${w.assignedQty}</td><td><input type="number" class="form-control completed-input" min="0" max="${w.assignedQty}" value="${w.completedQty}"></td><td><input type="number" class="form-control damage-input" min="${w.damageQty}" max="${w.assignedQty}" value="${w.damageQty}"></td><td>${w.damageQty?`<button class="btn btn-sm btn-dark recover-btn" data-id="${w.id}" data-max="${w.damageQty}">Recover</button>`:'-'}</td></tr>`).join('')}</tbody></table></div>`);modal('progressModal').show();
    });
    $('#updateProgressBtn').on('click',()=>action(()=>P.edit('packingData',$('.progress-piece').toArray().map(el=>({id:Number($(el).data('id')),completedQty:Number($(el).find('.completed-input').val()),damageQty:Number($(el).find('.damage-input').val())}))),'progressModal'));
    $(document).on('click','.recover-btn',async function(){const id=Number($(this).data('id')),max=Number($(this).data('max'));const result=await Swal.fire({title:'Recover damaged pieces',input:'number',inputAttributes:{min:1,max},showCancelButton:true});if(result.isConfirmed)action(()=>P.recoverRepair('packingData',id,Number(result.value)),'progressModal');});
    $('#refreshPackingBtn').on('click',render);window.addEventListener('storage',()=>{if(state)render();});window.addEventListener('focus',()=>{if(state)render();});
    try{await P.initialize();render();}catch(e){Swal.fire({icon:'error',title:'Unable to load packing',text:e.message});}
});
