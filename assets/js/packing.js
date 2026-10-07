$(document).ready(async function () {
    'use strict';
    const P = Production;
    const workers = ['Ahmad Khan','Bilal Ahmed','Danish Ali','Faisal Khan','Usman Malik','Ali Ahmed','Imran Khan','Saeed Ahmad','Zafar Iqbal','Rashid Mahmood'];
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const modal = id => bootstrap.Modal.getOrCreateInstance(document.getElementById(id));
    const priority = v => `<span class="priority-badge priority-${esc(String(v || 'Medium').toLowerCase())}">${esc(v || 'Medium')}</span>`;
    const deliveryBadge=(value,done)=>{if(!value)return '-';const d=new Date(value+'T00:00:00'),now=new Date();now.setHours(0,0,0,0);const cls=done||d>now?'delivery-ontrack':+d===+now?'delivery-due-today':'delivery-overdue';return `<span class="delivery-date-badge ${cls}">${esc(d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}))}</span>`;};
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
    const passed = l => l.rows.every(w => w.packingClosed || (w.passedQty > 0 && w.passedQty === w.inputQty-w.damageQty));
    const canPassLot = l => !passed(l) && l.rows.every(w => !w.stopped && w.completedQty === w.inputQty-w.damageQty && w.damageQty === l.rows[0].damageQty);
    function lotRows(l,index) {
        const w=l.rows[0], m=P.packingLotMath(l.rows), bom=PackingLabels.find(w.designNumber);
        const icon=(cls,label,symbol)=>`<button class="btn btn-sm ${cls==='pass-lot-btn'?'btn-success':'btn-dark'} ${cls}" data-lot="${esc(l.id)}" title="${label}" aria-label="${label}"><i class="bx ${symbol}" aria-hidden="true"></i></button>`;
        return `<tr><td>${index+1}</td><td>${esc(w.batchId)}</td><td><strong class="text-primary">${esc(l.id)}</strong></td><td>${esc(w.brand)}</td><td>${esc(w.designNumber)} / ${esc(bom?.pattern||'-')}</td><td>${esc(bom?.mrp??'-')}</td><td>${l.rows.map(w=>esc(w.pieceType)).join('<br>')}</td><td>${esc(w.worker)}</td><td>${m.inputQty}</td><td>${m.completedQty} <span class="progress-bar-container"><span class="progress-bar-fill" style="display:block;width:${m.effectiveQty?Math.min(100,m.completedQty/m.effectiveQty*100):100}%"></span></span></td><td>${m.damageQty?`<span class="damage-badge">${m.damageQty}</span>`:'<span class="damage-empty">-</span>'}</td><td>${m.remainingQty}</td><td>${deliveryBadge(w.deliveryDate,passed(l))}</td><td><span class="status-badge ${passed(l)?'passed':'pending'}">${passed(l)?'Passed':'Pending'}</span></td><td><div class="d-flex gap-1">${passed(l)?'':icon('progress-btn','Edit','bx-edit')}${canPassLot(l)?icon('pass-lot-btn','Pass','bx-right-arrow-alt'):''}${icon('view-lot-btn','View','bx-show')}${icon('label-lot-btn','QR Code','bx-qr')}</div></td></tr>`;
    }
    function pager(selector,page,total,set) {
        $(selector).html(`<div class="info-text">${total} ${selector === '#availablePagination' ? 'batches' : 'assignments'}</div><div class="pager"><button class="page-btn prev" ${page===1?'disabled':''} aria-label="Previous page">&lsaquo;</button><button class="page-btn active">${page}</button><button class="page-btn next" ${page*10>=total?'disabled':''} aria-label="Next page">&rsaquo;</button></div>`);
        $(selector+' .prev').on('click',()=>set(page-1));$(selector+' .next').on('click',()=>set(page+1));
    }
    function render() {
        state = P.readState(); const ready = batches(false), assigned = lots().filter(l=>!passed(l));
        $("#passedList").html(lots().filter(l => lots().filter(other => String(other.rows[0].batchId) === String(l.rows[0].batchId)).every(passed)).map(lotRows).join('') || '<tr><td colspan="15">No fully passed packing batches.</td></tr>');
        availablePage = Math.min(availablePage,Math.max(1,Math.ceil(ready.length/10))); assignedPage = Math.min(assignedPage,Math.max(1,Math.ceil(assigned.length/10)));
        $('#availableList').html(ready.slice((availablePage-1)*10,availablePage*10).map(batchRows).join('') || '<tr><td colspan="11" class="text-center text-muted py-4">No items received for packing.</td></tr>');
        $('#assignedList').html(assigned.slice((assignedPage-1)*10,assignedPage*10).map((l,i)=>lotRows(l,(assignedPage-1)*10+i)).join('') || '<tr><td colspan="15" class="text-center text-muted py-4">No packing assignments yet.</td></tr>');
        $('#holdList').html(batches(true).map(batchRows).join('') || '<tr><td colspan="11" class="text-center text-muted py-4">No held balances.</td></tr>');
        pager('#availablePagination',availablePage,ready.length,p=>{availablePage=p;render();});pager('#assignedPagination',assignedPage,assigned.length,p=>{assignedPage=p;render();});
    }
    let saving=false;
    async function action(fn,close) { if(saving)return; saving=true; $("#saveAssignBtn,#updateProgressBtn,#passProgressBtn").prop("disabled",true); try { await fn(); if(close) modal(close).hide(); render(); } catch(e) { await Swal.fire({icon:'error',title:'Could not save packing',text:e.message});render(); } finally { saving=false; $("#saveAssignBtn,#updateProgressBtn,#passProgressBtn").prop("disabled",false); } }
    $(document).on('click','.assign-single-btn',function(){SetAssignments.open('packing',String($(this).data('batch')),render);});
    $('#bulkAssignPackingBtn').on('click',()=>SetAssignments.open('packing',null,render));
    $('#listAllBtn').on('click',()=>{render();modal('listModal').show();});
    $('#labelBtn').on('click',()=>PackingLabels.open());
    $(document).on('click','.label-lot-btn',function(){const l=lots().find(l=>l.id===String($(this).data('lot')));PackingLabels.open(l.rows[0],1,true);});
    $(document).on('click','.pass-lot-btn',function(){action(()=>P.passPackingLot(String($(this).data('lot'))));});
    $(document).on('click','.view-lot-btn',function(){
        state=P.readState();
        const l=lots().find(l=>l.id===String($(this).data('lot')));
        if(!l) return;
        const first=l.rows[0], bom=PackingLabels.find(first.designNumber);
        if ($(this).closest('#listModal').length) {
            $('#batchHistoryBody').html(BatchHistoryPdf.packing(first.batchId));
            modal('batchHistoryModal').show();
            return;
        }
        $('#viewDetailBody').html(AssignmentDetails.render({
            ...first,
            subBatch:l.id,
            assignedQty:Math.min(...l.rows.map(w=>w.assignedQty)),
            pieceType:l.rows.map(w=>w.pieceType).join(', '),
            photo:first.photo || bom?.photo || ''
        }));
        const show=()=>modal('viewDetailModal').show();
        const list=document.getElementById('listModal');
        if(list.classList.contains('show')) {
            list.addEventListener('hidden.bs.modal',show,{once:true});
            modal('listModal').hide();
        } else show();
    });
    $('#holdListBtn').on('click',()=>{render();modal('holdModal').show();});
    $(document).on('click','.hold-btn,.restore-btn',function(){action(()=>P.setPackingHold(String($(this).data('batch')),$(this).hasClass('hold-btn')));});
    $(document).on('click','.progress-btn',function(){
        state=P.readState();const l=lots().find(l=>l.id===String($(this).data('lot')));
        $('#passProgressBtn').data('lot',l.id).toggle(canPassLot(l));
        const m=P.packingLotMath(l.rows);
        $('#updateProgressBtn').data('lot',l.id);
        $('#progressBody').html(`
            <div class="mb-3"><label class="form-label" for="packingProgressLot">Packing Lot</label><input id="packingProgressLot" class="form-control" value="${esc(l.id)}" readonly></div>
            <div class="mb-3"><label class="form-label" for="packingProgressWorker">Worker</label><input id="packingProgressWorker" class="form-control" value="${esc(l.rows[0].worker)}" readonly></div>
            <div class="row g-3 mb-3">${[['Assigned Sets',m.inputQty],['Already Passed',m.passedQty],['Remaining',m.remainingQty]].map(([label,value],i)=>`<div class="col-12 col-sm-4"><label for="packingTotal${i}" class="form-label">${label}</label><input id="packingTotal${i}" class="form-control" readonly value="${value}"></div>`).join('')}</div>
            <div class="row g-3"><div class="col-sm-6"><label for="packingUpdateType" class="form-label">Update Type</label><select id="packingUpdateType" class="form-select update-type"><option value="completed">Completed (+)</option><option value="damage">Damage (+)</option></select></div><div class="col-sm-6"><label for="packingAddQty" class="form-label">Add Sets (+)</label><input id="packingAddQty" type="number" class="form-control add-quantity" min="0" max="${m.uncompletedQty}" value="0"><small class="text-muted">Max addable: ${m.uncompletedQty}</small></div></div>
            <div class="alert alert-info packing-progress-summary"><span><strong>Completed:</strong> ${m.completedQty}</span><span><strong>Damage:</strong> ${m.damageQty}</span><span><strong>To Complete:</strong> ${m.uncompletedQty}</span></div>
            <p class="small text-muted mt-3">One update applies to the whole set. Damaged sets are deducted; all remaining good sets pass together.</p>
            <div class="progress-history-wrap"><div class="progress-history-head">Previous Assignment / Progress History</div><div class="progress-history-body">${(state.packingData_history||[]).filter(h=>String(l.rows[0].id)===String(h.workId)).map(h=>`<div class="packing-history-entry"><time>${esc(new Date(h.at).toLocaleString())}</time><strong>${esc(h.action)}</strong><span class="text-muted">${esc(h.by||'Manager')}</span></div>`).join('')||'<div class="p-3 text-muted">No history yet.</div>'}</div></div>
        `);modal('progressModal').show();
    });
    $(document).on('input change','.add-quantity,.update-type',()=>$('#passProgressBtn').hide());
    $('#passProgressBtn').on('click',function(){action(()=>P.passPackingLot($(this).data('lot')),'progressModal');});
    $('#updateProgressBtn').on('click',function(){action(()=>P.editPackingLot($(this).data('lot'),$('#packingUpdateType').val(),Number($('#packingAddQty').val())),'progressModal');});
    $('#refreshPackingBtn').on('click',render);window.addEventListener('storage',()=>{if(state)render();});window.addEventListener('focus',()=>{if(state)render();});
    try{await P.initialize();render();}catch(e){Swal.fire({icon:'error',title:'Unable to load packing',text:e.message});}
});
