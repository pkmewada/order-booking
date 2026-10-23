/* Shared set-based split and bulk assignment dialog for Packing and Bundling. */
(function () {
    'use strict';
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const workers=['Ahmad Khan','Bilal Ahmed','Danish Ali','Faisal Khan','Usman Malik','Ali Ahmed','Imran Khan','Saeed Ahmad','Zafar Iqbal','Rashid Mahmood'];
    let mode, sources=[], onSaved, busy=false;
    const tomorrow=()=>{const d=new Date();d.setDate(d.getDate()+7);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
    const workerOptions=()=>'<option value="">Select Worker</option>'+workers.map(w=>`<option>${esc(w)}</option>`).join('');
    const sourceId=s=>mode==='packing'?s.batchId:s.packingLotId;
    const capacity=s=>mode==='packing'?s.available:s.availableSets;
    function mount() {
        if(document.getElementById('setAssignmentModal'))return;
        $('body').append(`<div class="modal fade" id="setAssignmentModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false"><div class="modal-dialog modal-dialog-centered modal-dialog-scrollable" style="width:calc(100% - 2rem);max-width:1500px;margin-left:auto;margin-right:auto"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="setAssignmentTitle"></h5><button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><form id="setAssignmentForm" style="display:flex;flex-direction:column;min-height:0;overflow:hidden"><div class="modal-body"><div id="setSourcePicker" class="mb-3"></div><div id="setAssignmentCards"></div><div id="setAssignmentError" class="text-danger mt-2" role="alert"></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-dark" id="saveSetAssignments" type="submit"><i class="bx bx-save"></i> Assign</button></div></form></div></div></div>`);
        $('#setSourcePicker').on('change','#setSingleSource',function(){$('#setAssignmentCards').empty();if(this.value!=='')addCard(Number(this.value));});
        $('#setSourcePicker').on('input','#setSourceSearch',function(){const q=this.value.toLowerCase();$('.set-source-option').each(function(){$(this).toggle($(this).text().toLowerCase().includes(q));});});
        $('#setSourcePicker').on('change','.set-source-check',function(){const i=Number(this.value);if(this.checked)addCard(i);else $('#setCard'+i).remove();$('#setSelectedCount').text($('.set-source-check:checked').length+' selected');});
        $('#setSourcePicker').on('change','#setSelectAll',function(){$('.set-source-check').prop('checked',this.checked).trigger('change');});
        $('#setAssignmentCards').on('click','.set-apply-split',function(){const card=$(this).closest('.set-assignment-card');try{split(card,Number(card.find('.set-split-count').val()));}catch(e){showError(e);}});
        $('#setAssignmentCards').on('click','.set-remove-row',function(){const card=$(this).closest('.set-assignment-card');$(this).closest('tr').remove();update(card);});
        $('#setAssignmentCards').on('input change','.set-row-qty,.set-remainder',function(){update($(this).closest('.set-assignment-card'));});
        $('#setAssignmentForm').on('submit',submit);
    }
    function showError(e){$('#setAssignmentError').text(e.message);}
    function row(s,qty) {
        return `<tr><td class="set-split-label fw-semibold text-primary"></td><td><select class="form-select form-select-sm set-row-worker" style="min-width:200px" required>${workerOptions()}</select></td><td><input type="number" class="form-control form-control-sm set-row-qty" min="${mode==='bundling'&&s.remainderQuantity?0:1}" max="${capacity(s)}" step="1" value="${qty}" required style="min-width:110px"></td><td class="small text-muted">${esc(s.brand)}</td>${mode==='packing'?`<td><select class="form-select form-select-sm set-row-priority" style="min-width:110px">${['Low','Medium','High'].map(v=>`<option ${v===(s.priority||'Medium')?'selected':''}>${v}</option>`).join('')}</select></td>`:''}<td><input type="date" class="form-control form-control-sm set-row-date" value="${esc(tomorrow())}" required style="min-width:170px"></td>${mode==='bundling'?`<td>${s.remainderQuantity?`<label class="d-flex gap-2"><input type="checkbox" class="set-remainder"> Include ${s.remainderQuantity} remaining units</label>`:'-'}</td>`:''}<td><button type="button" class="btn btn-sm btn-outline-danger set-remove-row" title="Remove row" aria-label="Remove row"><i class="bx bx-trash"></i></button></td></tr>`;
    }
    function checkSplit(s,n){if(!Number.isSafeInteger(n)||n<1||n>100||n>Math.max(1,capacity(s)))throw new Error('Split count must be 1 to '+Math.min(100,Math.max(1,capacity(s)))+' for '+sourceId(s)+'.');}
    function split(card,n) {
        const s=sources[Number(card.data('index'))];checkSplit(s,n);
        const oldWorker=card.find('.set-row-worker').first().val(),oldDate=card.find('.set-row-date').first().val();
        card.find('tbody').html(Array.from({length:n},(_,i)=>row(s,Math.floor(capacity(s)/n)+(i<capacity(s)%n?1:0))).join(''));
        const worker=oldWorker;if(worker)card.find('.set-row-worker').val(worker);
        if(oldDate)card.find('.set-row-date').val(oldDate);
        if(mode==='bundling' && capacity(s)===0 && s.remainderQuantity)card.find('.set-remainder').first().prop('checked',true);
        update(card);
    }
    function update(card) {
        const s=sources[Number(card.data('index'))],sum=card.find('.set-row-qty').toArray().reduce((n,e)=>n+Number(e.value||0),0);
        card.find('tbody tr').each(function(i){$(this).find('.set-split-label').text(sourceId(s)+' / '+(i+1));});
        card.find('.set-balance').text(`${capacity(s)} sets available | Assigning: ${sum} | Remaining: ${capacity(s)-sum}`).toggleClass('text-danger',sum>capacity(s));
    }
    function addCard(i) {
        if($('#setCard'+i).length)return;
        const s=sources[i];
        $('#setAssignmentCards').append(`<section class="set-assignment-card mb-4" id="setCard${i}" data-index="${i}"><div class="alert alert-primary d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3"><div><i class="bx bx-layer me-2"></i><strong>${esc(sourceId(s))}</strong><div class="small text-muted">${esc(s.brand)} | Design: ${esc(s.designNumber)}</div>${mode==='bundling'?`<div class="small">${s.quantity} quantity = ${s.availableSets} sets${s.remainderQuantity?' + '+s.remainderQuantity+' remaining units':''}</div>`:''}<div class="set-balance small text-success"></div></div><div><label class="form-label" for="setSplit${i}">Split Count (Rows)</label><div class="input-group"><input id="setSplit${i}" type="number" class="form-control set-split-count" min="1" max="100" value="1" style="width:90px"><button class="btn btn-success set-apply-split" type="button"><i class="bx bx-check"></i> Apply Split</button></div></div></div><div class="table-responsive"><table class="table table-bordered table-sm text-nowrap mb-0"><thead><tr><th>Lot / Split</th><th>Worker Name</th><th>Quantity / Sets</th><th>Brand</th>${mode==='packing'?'<th>Priority</th>':''}<th>Delivery Date</th>${mode==='bundling'?'<th>Remaining Units</th>':''}<th>Action</th></tr></thead><tbody></tbody></table></div></section>`);
        split($('#setCard'+i),1);
    }
    async function submit(e) {
        e.preventDefault();if(busy)return;
        try {
            const requests=[];
            $('.set-assignment-card').each(function(){
                const card=$(this),s=sources[Number(card.data('index'))];let total=0,remainderRows=0;
                card.find('tbody tr').each(function(){const tr=$(this),qty=Number(tr.find('.set-row-qty').val()),includeRemainder=tr.find('.set-remainder').prop('checked')===true;
                    if(!Number.isSafeInteger(qty)||qty<0||(!qty&&!includeRemainder))throw new Error('Enter a positive set quantity for '+sourceId(s)+'.');
                    total+=qty;if(includeRemainder)remainderRows++;
                    const request={worker:tr.find('.set-row-worker').val(),deliveryDate:tr.find('.set-row-date').val()};
                    if(!request.worker||!request.deliveryDate)throw new Error('Worker and delivery date are required.');
                    requests.push(mode==='packing'?{...request,batchId:s.batchId,quantity:qty,priority:tr.find('.set-row-priority').val()}:{...request,packingLotId:s.packingLotId,setQuantity:qty,includeRemainder});
                });
                if(total>capacity(s)||remainderRows>1)throw new Error('Assignments exceed the available balance for '+sourceId(s)+'. Include remaining units in only one row.');
            });
            if(!requests.length)throw new Error('Select at least one batch / lot and add an assignment.');
            busy=true;$('#setAssignmentError').empty();$('#setAssignmentModal button').prop('disabled',true);
            const results=mode==='packing'?await Production.assignPackingBulk(requests):await Production.assignBundlingBulk(requests);
            bootstrap.Modal.getOrCreateInstance(document.getElementById('setAssignmentModal')).hide();
            onSaved?.();
            if(mode==='packing'&&results.length===1&&window.PackingLabels){try{PackingLabels.downloadBrandSizes(results[0][0]);}catch(error){await Swal.fire({icon:'warning',title:'Assigned; download labels using QR Code',text:error.message});}}
        }catch(error){showError(error);}finally{busy=false;$('#setAssignmentModal button').prop('disabled',false);}
    }
    function open(stage,id,callback) {
        if(busy)return;mount();mode=stage;onSaved=callback;const state=Production.readState();
        sources=stage==='packing'?Production.packingBatches(state).filter(s=>!s.held&&s.available>0):Production.bundlingReady(state);
        $('#setAssignmentModal').toggleClass('set-bulk-modal',!id);
        $('#setAssignmentTitle').text((id?'Assign ':'Bulk Assign ')+(stage==='packing'?'Packing':'Bundling')+' Workers');
        $('#setAssignmentCards,#setAssignmentError').empty();
        const selectedIndex=sources.findIndex(s=>sourceId(s)===id);
        $('#setSourcePicker').html(id?`<label for="setSingleSource" class="form-label">Select Batch (Received for ${stage==='packing'?'Packing':'Bundling'})</label><select id="setSingleSource" class="form-select"><option value="">Choose Batch</option>${sources.map((s,i)=>`<option value="${i}" ${i===selectedIndex?'selected':''}>${esc(sourceId(s))} - ${esc(s.brand)} - Remaining: ${capacity(s)} sets</option>`).join('')}</select>`:`<div class="d-flex flex-wrap align-items-start gap-3"><label class="fw-semibold pt-2">Select Batches:</label><details class="set-batch-picker"><summary>Click to choose batches...</summary><div class="set-picker-options"><input id="setSourceSearch" class="form-control form-control-sm mb-2" placeholder="Search batch, brand, design..." aria-label="Search batches"><label class="d-block p-2 border-bottom"><input id="setSelectAll" type="checkbox" checked> Select All</label>${sources.map((s,i)=>`<label class="set-source-option p-2 border-bottom"><input class="set-source-check me-2" type="checkbox" value="${i}" checked> ${esc(sourceId(s))}<div class="small text-muted ms-4">${esc(s.brand)} | Design: ${esc(s.designNumber)} | ${capacity(s)} sets</div></label>`).join('')}</div></details><span id="setSelectedCount" class="badge bg-primary ms-auto mt-2">${sources.length} selected</span></div>`);
        if(id){if(selectedIndex>=0)addCard(selectedIndex);}else sources.forEach((s,i)=>addCard(i));
        if(!sources.length)$('#setAssignmentCards').html('<p class="text-muted">No quantity is available for assignment.</p>');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('setAssignmentModal')).show();
    }
    window.SetAssignments={open};
})();
