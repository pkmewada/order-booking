$(function () {
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let page = 1;
    function render() {
        const term=String($('#searchInput').val() || '').trim().toLowerCase();
        const orders=JSON.parse(localStorage.getItem('orders') || '[]');
        const deliveries=orders.flatMap(order=>DeliveryRecords.batches(order).map(batch=>({order,batch})))
            .filter(({order,batch})=>[order.id,batch.id,order.customerName,order.shopName].some(value=>String(value || '').toLowerCase().includes(term)))
            .sort((a,b)=>String(b.batch.createdAt).localeCompare(String(a.batch.createdAt)));
        const pages=Math.max(1,Math.ceil(deliveries.length/10));page=Math.min(page,pages);
        const start=(page-1)*10,body=$('#orderTableBody').empty();
        deliveries.slice(start,start+10).forEach(({order,batch})=>{
            const totals=(batch.items || []).reduce((sum,item)=>({sets:sum.sets+Number(item.sets || 0),pieces:sum.pieces+Number(item.pieces || 0)}),{sets:0,pieces:0});
            const success=!!batch.pdf;
            const row=$(`<tr><td>${esc(batch.id)}</td><td>${esc(order.id)}</td><td>${esc(order.shopName || order.customerName)}</td><td>${esc(batch.createdAt ? new Date(batch.createdAt).toLocaleString('en-IN') : '--')}</td><td>${totals.sets} Sets (${totals.pieces} Pieces)</td><td><span class="badge bg-${success?'success':'info'}">${success?'Success':'In Progress'}</span></td><td><div class="d-flex gap-2"><button type="button" class="btn btn-sm btn-dark view-delivery" title="View delivery details"><i class="bx bx-show me-1"></i>View</button>${success?'<button type="button" class="btn btn-sm btn-dark delivery-pdf" title="Download uploaded PDF"><i class="bx bxs-file-pdf me-1"></i>PDF</button>':'<button type="button" class="btn btn-sm btn-success pass-delivery"><i class="bx bx-check me-1"></i>Pass</button>'}</div></td></tr>`);
            row.find('.view-delivery').on('click',()=>OrderDetails.show(DeliveryRecords.snapshot(order,batch),true));
            row.find('.delivery-pdf').on('click',async function(){
                this.disabled=true;
                try {await DeliveryRecords.downloadFile(batch.pdf);}catch(error){Swal.fire('PDF unavailable',error.message,'error');}finally{this.disabled=false;}
            });
            row.find('.pass-delivery').on('click',async function(){
                this.disabled=true;
                try {
                    const result=await Swal.fire({title:'Pass Delivery',text:`${batch.id} — Upload the delivery PDF.`,input:'file',inputAttributes:{accept:'.pdf,application/pdf','aria-label':'Delivery PDF'},showCancelButton:true,confirmButtonText:'Upload & Pass',showLoaderOnConfirm:true,allowOutsideClick:()=>!Swal.isLoading(),preConfirm:async file=>{
                        try {return await DeliveryRecords.pass(order.id,batch.id,file);}catch(error){Swal.showValidationMessage(error.message);return false;}
                    }});
                    if(result.isConfirmed){render();Swal.fire({icon:'success',title:'Delivery Success',text:'PDF uploaded and delivery passed.',timer:1500,showConfirmButton:false});}
                } finally {this.disabled=false;}
            });
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
    window.addEventListener('storage',event=>{if(event.key==='orders')render();});
    render();
});