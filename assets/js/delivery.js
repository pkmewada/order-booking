$(function () {
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let page = 1;
    let orders = [];
    // Orders and delivery PDFs are stored on the server (MySQL + private PDF storage).
    async function refresh() {
        try { orders = await OrdersApi.list(); }
        catch (error) { $('#orderTableBody').html(`<tr><td colspan="7" class="text-center text-danger py-4">${esc(error.message)}</td></tr>`); return; }
        render();
    }
    function passDelivery(order, batch, title) {
        return Swal.fire({title,text:`${batch.id} — Upload the delivery PDF.`,input:'file',inputAttributes:{accept:'.pdf,application/pdf','aria-label':'Delivery PDF'},showCancelButton:true,confirmButtonText:'Upload & Pass',showLoaderOnConfirm:true,allowOutsideClick:()=>!Swal.isLoading(),preConfirm:async file=>{
            try {return await DeliveryRecords.pass(order.id,batch.id,file);}catch(error){Swal.showValidationMessage(esc(error.message));return false;}
        }}).then(result=>{if(result.isConfirmed){refresh();Swal.fire({icon:'success',title:'Delivery Success',text:'PDF uploaded and delivery passed.',timer:1500,showConfirmButton:false});}});
    }
    function render() {
        const term=String($('#searchInput').val() || '').trim().toLowerCase();
        const deliveries=orders.flatMap(order=>DeliveryRecords.batches(order).map(batch=>({order,batch})))
            .filter(({order,batch})=>[order.id,batch.id,order.customerName,order.shopName].some(value=>String(value || '').toLowerCase().includes(term)))
            .sort((a,b)=>String(b.batch.createdAt).localeCompare(String(a.batch.createdAt)));
        const pages=Math.max(1,Math.ceil(deliveries.length/10));page=Math.min(page,pages);
        const start=(page-1)*10,body=$('#orderTableBody').empty();
        deliveries.slice(start,start+10).forEach(({order,batch})=>{
            const totals=(batch.items || []).reduce((sum,item)=>({sets:sum.sets+Number(item.sets || 0),pieces:sum.pieces+Number(item.pieces || 0)}),{sets:0,pieces:0});
            const state=DeliveryRecords.pdfState(batch);
            const badge={stored:['success','Success'],missing:['warning','PDF missing'],none:['info','In Progress']}[state];
            const actions=state==='stored'?'<button type="button" class="btn btn-sm btn-dark delivery-pdf" title="Download uploaded PDF"><i class="bx bxs-file-pdf me-1"></i>PDF</button>'
                :state==='missing'?'<button type="button" class="btn btn-sm btn-warning upload-missing" title="The PDF of this imported delivery is not on the server"><i class="bx bx-upload me-1"></i>Upload PDF</button>'
                :'<button type="button" class="btn btn-sm btn-success pass-delivery"><i class="bx bx-check me-1"></i>Pass</button>';
            const row=$(`<tr><td>${esc(batch.id)}</td><td>${esc(order.id)}</td><td>${esc(order.shopName || order.customerName)}</td><td>${esc(batch.createdAt ? new Date(batch.createdAt).toLocaleString('en-IN') : '--')}</td><td>${totals.sets} Sets (${totals.pieces} Pieces)</td><td><span class="badge bg-${badge[0]}">${badge[1]}</span></td><td><div class="d-flex gap-2"><button type="button" class="btn btn-sm btn-dark view-delivery" title="View delivery details"><i class="bx bx-show me-1"></i>View</button>${actions}</div></td></tr>`);
            row.find('.view-delivery').on('click',()=>OrderDetails.show(DeliveryRecords.snapshot(order,batch),true));
            row.find('.delivery-pdf').on('click',()=>DeliveryRecords.downloadFile(batch));
            row.find('.pass-delivery').on('click',function(){this.disabled=true;passDelivery(order,batch,'Pass Delivery').finally(()=>{this.disabled=false;});});
            row.find('.upload-missing').on('click',function(){this.disabled=true;passDelivery(order,batch,'Upload missing PDF').finally(()=>{this.disabled=false;});});
            body.append(row);
        });
        if(!deliveries.length)body.append('<tr><td colspan="7" class="text-center text-muted py-4">No deliveries found</td></tr>');
        $('#paginationInfo').text(deliveries.length?`Showing ${start+1}-${Math.min(start+10,deliveries.length)} of ${deliveries.length} deliveries`:'No deliveries');
        const controls=$('#paginationControls').empty();
        function button(label,target,disabled,active){
            const li=$('<li>',{class:'page-item'+(disabled?' disabled':'')+(active?' active':'')});
            $('<button>',{type:'button',class:'page-link',text:label,disabled}).on('click',()=>{page=target;render();}).appendTo(li);controls.append(li);
        }
        button('Prev',page-1,page===1);for(let i=1;i<=pages;i++)button(i,i,false,i===page);button('Next',page+1,page===pages);
    }
    $('#searchInput').on('input',()=>{page=1;render();});
    // Other devices change deliveries too: reload when this tab becomes active or an import finishes.
    window.addEventListener('focus',refresh);
    window.addEventListener('orders:changed',refresh);
    refresh();
});
