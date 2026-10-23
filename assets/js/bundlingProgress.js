window.BundlingProgress = (() => {
    const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const completed = r => r.status === 'passed' ? Number(r.quantity) : Number(r.completedQty || 0);
    function passedRows(state) {
        return state.bundlingData.filter(r => state.bundlingData.filter(w => String(w.batchId) === String(r.batchId)).every(w => w.status === 'passed'));
    }
    function renderPassed(state) {
        const rows = passedRows(state), batchCount = new Set(rows.map(r => String(r.batchId))).size;
        $('#bundlingListSummary').text(`${batchCount} fully-passed batch(es), ${rows.length} assignment(s).`);
        $('#bundlingPassedBody').html(rows.map((r,i) => `<tr><td>${i+1}</td><td><strong>${esc(r.batchId)}</strong></td><td class="text-primary fw-semibold">${esc(r.id)}</td><td>${esc(r.brand)}</td><td>${esc(r.designNumber)} / ${esc(r.pattern || '-')}</td><td>${esc(r.mrp ?? '-')}</td><td>${(r.pieces || []).map(esc).join('<br>')}</td><td>${esc(r.worker)}</td><td>${Number(r.quantity)}<div class="small text-muted">${(r.sizes || []).map(s => `${esc(s.size)}: ${Number(s.quantity)}`).join(' · ')}</div></td><td>${completed(r)}</td><td>${Math.max(0,Number(r.quantity)-completed(r))}</td><td>${esc(r.deliveryDate || '-')}</td><td><span class="badge bg-success">Passed</span></td><td><button type="button" class="btn btn-sm btn-dark view-bundling-history" data-batch="${esc(r.batchId)}" title="View Batch History" aria-label="View Batch History"><i class="bx bx-show"></i></button></td></tr>`).join('') || '<tr><td colspan="14" class="text-center text-muted py-4">No fully passed bundling batches yet.</td></tr>');
    }
    function batchHistory(state,batchId) {
        const rows=state.bundlingData.filter(r => String(r.batchId) === String(batchId)), first=rows[0];
        if (!first) return '';
        return `<div style="border-bottom:2px solid #161617;padding-bottom:12px;margin-bottom:18px"><h4>BATCH HISTORY</h4><small>Batch ID: <strong>${esc(batchId)}</strong> · Design: <strong>${esc(first.designNumber)}</strong> · Brand: <strong>${esc(first.brand)}</strong></small><div>Generated: ${esc(new Date().toLocaleString('en-GB'))}</div></div>` + rows.map((r,i) => {
            const events=[{at:r.assignedAt,action:`assigned: ${r.quantity} pcs`},...(r.progressHistory || []).map(h=>({at:h.at,action:`completed: ${h.before} → ${h.completedQty} pcs`})),...(r.status==='passed'?[{at:r.passedAt,action:`passed: ${r.quantity} pcs`}]:[])];
            return `<section style="border:1px solid #e2e7f1;border-radius:8px;margin-bottom:16px;overflow:hidden"><div style="background:#f8f9fa;padding:10px 14px"><strong>${i+1}. ${esc(r.id)} — ${esc(r.worker)}</strong><div>Pieces: ${(r.pieces || []).map(esc).join(', ')} · Qty: ${r.quantity} · Progress: ${completed(r)} · Remaining: ${Math.max(0,Number(r.quantity)-completed(r))}</div></div><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th>Date &amp; Time</th><th>Action</th><th>By</th></tr></thead><tbody>${events.map(h=>`<tr><td>${esc(h.at || '-')}</td><td>${esc(h.action)}</td><td>Manager</td></tr>`).join('')}</tbody></table></section>`;
        }).join('');
    }
    function render(state) {
        renderPassed(state);
        $('#bundlingAssigned tr').each(function(i) {
            const r=state.bundlingData[i]; if(!r)return;
            const button=(cls,title,icon)=>`<button class="btn btn-sm ${cls==='pass-bundling'?'btn-success':'btn-dark'} ${cls}" data-id="${esc(r.id)}" title="${title}" aria-label="${title}"><i class="bx ${icon}"></i></button>`;
            $(this).children('td').last().html(`<div class="d-flex gap-1">${r.status==='passed'?'':button('edit-bundling','Edit','bx-edit')}${r.status!=='passed'&&completed(r)===Number(r.quantity)?button('pass-bundling','Pass','bx-right-arrow-alt'):''}${button('view-bundling','View','bx-show')}</div><div class="small text-muted mt-1">Completed: ${completed(r)} / ${r.quantity}</div>`);
            $(this).toggle(r.status!=='passed');
        });
        if(state.bundlingData.length&&state.bundlingData.every(r=>r.status==='passed'))$('#bundlingAssigned').append('<tr><td colspan="12" class="text-center text-muted py-4">No pending bundling assignments.</td></tr>');
    }
    function bind(P,save) {
        $('<button class="btn btn-dark ms-auto me-2" id="bundlingPassedList">List</button>').insertBefore('#bulkAssignBundlingBtn');
        $('#bundlingPassedList').on('click',()=>{
            renderPassed(P.readState());
            bootstrap.Modal.getOrCreateInstance(document.getElementById('bundlingListModal')).show();
        });
        $(document).on('click','.view-bundling-history',function(){
            $('#batchHistoryBody').html(batchHistory(P.readState(),String(this.dataset.batch)));
            bootstrap.Modal.getOrCreateInstance(document.getElementById('batchHistoryModal')).show();
        });
        $(document).on('click','.edit-bundling',async function(){
            const id=String($(this).data('id')),r=P.readState().bundlingData.find(r=>r.id===id);
            if(!r||r.status==='passed')return;
            const result=await Swal.fire({title:'Edit Bundling Progress',text:`Assigned: ${r.quantity} | Completed: ${completed(r)}. Enter total completed quantity.`,input:'number',inputValue:completed(r),inputAttributes:{min:completed(r),max:r.quantity,step:1},showCancelButton:true,confirmButtonText:'Save',inputValidator:value=>value===''||!Number.isSafeInteger(Number(value))||Number(value)<completed(r)||Number(value)>r.quantity?'Enter a whole quantity between previous progress and assigned quantity.':undefined});
            if(result.isConfirmed)save(()=>P.editBundling(id,Number(result.value)));
        });
        $(document).on('click','.view-bundling',function(){
            const r=P.readState().bundlingData.find(r=>r.id===String($(this).data('id')));if(!r)return;
            const rows=[['Batch',r.batchId],['Bundling Lot',r.id],['Brand',r.brand],['Design / Pattern',`${r.designNumber} / ${r.pattern||'-'}`],['MRP',r.mrp],['Pieces',(r.pieces||[]).join(', ')],['Worker',r.worker],['Quantity',r.quantity],['Completed',completed(r)],['Delivery',r.deliveryDate],['Status',r.status],...(r.sizes||[]).map(v=>[`Size ${v.size}`,v.quantity])];
            Swal.fire({title:'Bundling Details',html:`<table class="table table-bordered text-start">${rows.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table><h6>Progress History</h6>${(r.progressHistory||[]).map(h=>`<p>${esc(new Date(h.at).toLocaleString())}: ${esc(h.before)} &rarr; ${esc(h.completedQty)}</p>`).join('')||'<p>No progress updates.</p>'}`});
        });
    }
    return {render,bind};
})();
