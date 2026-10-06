const {test} = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/js/production-engine.js');
function setup(key, closed = false) {
    const stage = P.managers[key], packing = key === 'packingData';
    const pools = [1,...(packing ? [2] : [])].map(id => ({id,batchId:'B1',pieceNumber:id,route:[{stage},{stage:'Next',type:'stitching'}],stageBalances:{[stage]:{inputQty:10},Next:{inputQty:3}}}));
    const rows = pools.map(p => ({id:p.id,poolId:p.id,batchId:'B1',pieceNumber:p.id,worker:'Worker A',subBatch:'B1-C1',
        packingLotId:packing ? 'LOT1' : undefined,inputQty:10,assignedQty:10,completedQty:closed ? 8 : 5,damageQty:2,passedQty:closed ? 8 : 3,packingClosed:closed}));
    const map = new Map(Object.entries({approvedPool:pools,[key]:rows,bundlingData:closed ? [{id:'bundle',packingLotId:'LOT1',quantity:8,status:'passed'}] : [],inventoryData:closed ? [{id:'inventory',quantity:8}] : []}).map(([k,v])=>[k,JSON.stringify(v)]));
    const storage = {getItem:k=>map.get(k) ?? null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
    return P.createEngine(storage,{request:async (name,options,fn)=>fn()});
}
for (const key of Object.keys(P.managers)) test(`${key}: damage returns to same assignment and completes/passes normally`,async()=>{
    const e=setup(key), before=e.readState();
    assert.equal(e.damageRepairs().length,1);
    assert.equal(e.damageRepairs()[0].worker,'Worker A');
    await e.reassignDamage(key,1);
    const after=e.readState();
    for(const w of after[key]) {
        assert.equal(w.damageQty,0); assert.equal(w.inputQty,10); assert.equal(w.worker,'Worker A');
        assert.equal(w.completedQty,5); assert.equal(w.passedQty,3); assert.equal(w.batchId,'B1');
        assert.equal(P.calculateProductionMath(w).uncompletedQty,5);
    }
    assert.deepEqual(after.approvedPool.map(p=>p.stageBalances),before.approvedPool.map(p=>p.stageBalances));
    assert.equal(e.damageRepairs().length,0);
    await assert.rejects(e.reassignDamage(key,1),/already been reassigned/);
    if(key==='packingData') { await e.editPackingLot('LOT1','completed',5); assert.equal((await e.passPackingLot('LOT1')).qty,10); }
    else { await e.edit(key,[{id:1,completedQty:10}]); await e.pass(key,[1]); assert.equal(e.readState()[key][0].passedQty,10); assert.equal(e.readState().approvedPool[0].stageBalances.Next.inputQty,10); }
});
test('closed packing: repaired sets stay in batch without changing transferred inventory',async()=>{
    const e=setup('packingData',true), before=e.readState();
    await e.reassignDamage('packingData',1);
    const s=e.readState(), repaired=s.packingData.filter(w=>!w.packingClosed);
    assert.equal(repaired.length,2);
    assert.equal(repaired[0].packingLotId,repaired[1].packingLotId);
    assert.deepEqual(s.bundlingData,before.bundlingData); assert.deepEqual(s.inventoryData,before.inventoryData);
    for(const w of repaired) {assert.equal(w.inputQty,2); assert.equal(w.completedQty,0); assert.equal(w.batchId,'B1');}
    await e.editPackingLot(repaired[0].packingLotId,'completed',2);
    assert.equal((await e.passPackingLot(repaired[0].packingLotId)).qty,2);
    assert.equal(e.readState().packingData.reduce((n,w)=>n+w.inputQty,0),20);
});
test('stopped batch rejects reassignment without changing quantities',async()=>{
    const e=setup('cuttingData');
    await e.transaction(s=>{s.approvedBatchData.push({batchId:'B1',stopped:true});});
    const before=e.readState();
    await assert.rejects(e.reassignDamage('cuttingData',1),/stopped/);
    assert.deepEqual(e.readState(),before);
});
test('damage page renders worker/stage, escapes details and removes reassigned row',async()=>{
    const vm=require('node:vm'), fs=require('node:fs');
    let click, outstanding=true, resolveInit;
    const body={innerHTML:'',addEventListener:(type,fn)=>{click=fn;}};
    const error={textContent:'',classList:{add(){},remove(){}}};
    const context={document:{getElementById:id=>id==='damageRows'?body:error},window:{addEventListener(){}},Production:{
        initialize:()=>new Promise(resolve=>{resolveInit=resolve;}),
        damageRepairs:()=>outstanding ? [{sourceKey:'cuttingData',sourceWorkId:1,stage:'Cutting',worker:'Worker <A>',batchId:'B1',damageQty:2,unit:'pcs'}] : [],
        reassignDamage:async(key,id)=>{assert.equal(key,'cuttingData');assert.equal(id,'1');outstanding=false;}
    }};
    vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/damage-repair.js'),'utf8'),context);
    resolveInit(); await new Promise(resolve=>setImmediate(resolve));
    assert.match(body.innerHTML,/Worker &lt;A&gt;/);assert.match(body.innerHTML,/Cutting/);assert.match(body.innerHTML,/2 pcs/);
    const button={disabled:false,dataset:{key:'cuttingData',id:'1'}};
    await click({target:{closest:()=>button}});
    assert.match(body.innerHTML,/No outstanding damage/);
});
