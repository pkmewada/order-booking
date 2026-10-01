window.BundlingProgress = (() => {
    const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const completed = r => r.status === 'passed' ? Number(r.quantity) : Number(r.completedQty || 0);
    function render(state) {
        $('#bundlingAssigned tr').each(function(i) {
            const r=state.bundlingData[i]; if(!r)return;
            const button=(cls,title,icon)=>`<button class="btn btn-sm ${cls==='pass-bundling'?'btn-success':'btn-dark'} ${cls}" data-id="${esc(r.id)}" title="${title}" aria-label="${title}"><i class="bx ${icon}"></i></button>`;
            $(this).children('td').last().html(`<div class="d-flex gap-1">${r.status==='passed'?'':button('edit-bundling','Edit','bx-edit')}${r.status!=='passed'&&completed(r)===Number(r.quantity)?button('pass-bundling','Pass','bx-check-circle'):''}${button('view-bundling','View','bx-show')}</div><div class="small text-muted mt-1">Completed: ${completed(r)} / ${r.quantity}</div>`);
            $(this).toggle(r.status!=='passed');
        });
        if(state.bundlingData.length&&state.bundlingData.every(r=>r.status==='passed'))$('#bundlingAssigned').append('<tr><td colspan="12" class="text-center text-muted py-4">No pending bundling assignments.</td></tr>');
    }
    function bind(P,save) {
        $('<button class="btn btn-dark ms-auto me-2" id="bundlingPassedList">List</button>').insertBefore('#bulkAssignBundlingBtn');
        $('#bundlingPassedList').on('click',()=>{
            const rows=P.readState().bundlingData.filter(r=>r.status==='passed');
            Swal.fire({title:'Passed Bundling',width:1000,html:`<div class="table-responsive"><table class="table table-bordered"><thead><tr><th>Lot</th><th>Brand</th><th>Design</th><th>Worker</th><th>Quantity</th><th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.id)}</td><td>${esc(r.brand)}</td><td>${esc(r.designNumber)}</td><td>${esc(r.worker)}</td><td>${esc(r.quantity)}</td><td><button class="btn btn-sm btn-dark view-bundling" data-id="${esc(r.id)}" title="View" aria-label="View"><i class="bx bx-show"></i></button></td></tr>`).join('')||'<tr><td colspan="6">No passed bundling assignments.</td></tr>'}</tbody></table></div>`});
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
