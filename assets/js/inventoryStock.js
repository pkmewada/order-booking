$(document).ready(async function () {
    'use strict';
    const P=Production, stages=['Cutting','Stitching','Ironing','Hand Work','Peco','Digital Print','Embroidery','Screen Print','Packing','Bundling'];
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const n=v=>Math.max(0,Number(v)||0), key=v=>String(v??'').trim().toLowerCase();
    function render() {
        try {
            const state=P.readState(), boms=JSON.parse(localStorage.getItem('bomMasterData')||'[]'), groups=new Map();
            const group=r=>{
                const id=key(r.designNumber)||`batch:${r.batchId}`;
                if(!groups.has(id))groups.set(id,{id,designNumber:r.designNumber,brand:r.brand,pattern:r.pattern,mrp:r.mrp,qty:0,sizeTotals:new Map(),loose:0,total:0,damage:0,stages:Object.fromEntries(stages.map(s=>[s,{input:0,passed:0,used:false}]))});
                return groups.get(id);
            };
            state.inventoryData.forEach(r=>{
                const g=group(r);g.qty+=n(r.quantity);
                if(r.sizes?.length)r.sizes.forEach(s=>g.sizeTotals.set(String(s.size),n(g.sizeTotals.get(String(s.size)))+n(s.quantity)));
                else g.loose+=n(r.quantity);
            });
            const batches=new Map();
            [...state.batchData,...state.approvedBatchData].forEach(b=>batches.set(String(b.batchId),b));
            const pools=new Map();
            state.approvedPool.forEach(p=>{const id=String(p.batchId);if(!pools.has(id))pools.set(id,[]);pools.get(id).push(p);});
            const works=Object.entries(P.managers).flatMap(([storageKey,stage])=>(state[storageKey]||[]).map(w=>({...w,stage})));
            for(const [id,rows] of pools) {
                const batch=batches.get(id)||rows[0],g=group(batch),total=n(batch.quantity)||Math.max(0,...rows.map(p=>n(p.quantity)));
                g.total+=total;
                const batchWorks=works.filter(w=>String(w.batchId)===id);
                let packingPassed=0;
                for(const stage of stages) {
                    const eligible=rows.filter(p=>(p.route||[]).some(r=>r.stage===stage)||p.stageBalances?.[stage]);
                    if(!eligible.length)continue;
                    const values=eligible.map(p=>({input:n(p.stageBalances?.[stage]?.inputQty),passed:batchWorks.filter(w=>w.stage===stage&&String(w.poolId)===String(p.id)).reduce((sum,w)=>sum+n(w.passedQty),0)}));
                    const t=g.stages[stage];t.used=true;
                    // Matching garment pieces form one quantity, even for 3/4/5-piece designs.
                    // Missing mandatory pieces have not yet received or passed this stage.
                    const mandatory=['Cutting','Stitching','Ironing','Packing'].includes(stage);
                    const missing=mandatory&&(batch.pieces||[]).length>eligible.length;
                    t.input+=missing?0:Math.min(...values.map(v=>v.input));
                    t.passed+=missing?0:Math.min(...values.map(v=>v.passed));
                    if(stage==='Packing')packingPassed=missing?0:Math.min(...values.map(v=>v.passed));
                }
                const bundling=g.stages.Bundling;
                bundling.used=true;
                bundling.input+=packingPassed;
                bundling.passed+=state.bundlingData.filter(r=>String(r.batchId)===id&&r.status==='passed').reduce((sum,r)=>sum+n(r.quantity),0);
                // Production damage is recorded per piece: any damaged piece loses one garment.
                // Packing updates are mirrored across every piece of a set, so count each lot once.
                let damage=batchWorks.filter(w=>w.stage!=='Packing').reduce((sum,w)=>sum+n(w.damageQty??w.damage),0);
                const packing=new Map();
                batchWorks.filter(w=>w.stage==='Packing').forEach(w=>{const lot=w.packingLotId||`legacy-${w.id}`;packing.set(lot,Math.max(n(packing.get(lot)),n(w.damageQty??w.damage)));});
                damage+=[...packing.values()].reduce((a,b)=>a+b,0);
                g.damage+=Math.min(total,damage);
            }
            const search=key($('#stockDesign').val());
            const html=[...groups.values()].filter(g=>key(`${g.brand} ${g.designNumber}`).includes(search)).sort((a,b)=>String(a.designNumber).localeCompare(String(b.designNumber),undefined,{numeric:true})).map(g=>{
                const bom=boms.find(b=>key(b.designNumber)===key(g.designNumber))||{},brand=bom.brand||g.brand,sizes=P.brandSizes(brand);
                const sets=sizes.length?Math.min(...sizes.map(s=>n(g.sizeTotals.get(s))))+Math.floor(g.loose/sizes.length):0;
                const mrp=bom.mrp??g.mrp, price=mrp!==''&&mrp!=null&&Number.isFinite(Number(mrp))?Number(mrp).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}):'-';
                return `<tr><td>${esc(brand)}</td><td>${esc(g.designNumber)}</td><td>${esc(bom.pattern||g.pattern||'-')}</td><td>${price}</td><td>${g.qty}</td><td>${sets}</td><td>${g.total} / <strong>${g.qty}</strong></td><td>${g.damage}</td><td><button type="button" class="btn btn-sm btn-dark stock-detail" data-design="${esc(g.id)}" title="Production details" aria-label="Production details"><i class="bx bx-show" aria-hidden="true"></i></button></td></tr>`;
            }).join('');
            $('#stockRows').html(html||'<tr><td colspan="9" class="text-muted py-5">No stock matches these filters.</td></tr>');$('#stockError').empty();
        } catch(e){$('#stockError').text('Unable to load inventory: '+e.message);}
    }
    $('#stockDesign').on('input',render);$('#refreshStock').on('click',render);
    window.addEventListener('storage',render);window.addEventListener('focus',render);
    try{await P.initialize();render();}catch(e){$('#stockError').text(e.message);}
});
