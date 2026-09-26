const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/js/production-engine.js');
class Storage {
    constructor(seed={}) { this.values=new Map(Object.entries(seed).map(([k,v])=>[k,JSON.stringify(v)])); }
    getItem(k) { return this.values.get(k) ?? null; }
    setItem(k,v) { if(this.fail===k){this.fail=null;throw Error('Quota exceeded');}this.values.set(k,String(v)); }
    removeItem(k) { this.values.delete(k); }
    read(k) { return JSON.parse(this.getItem(k)||'[]'); }
}
function lock() { let queue=Promise.resolve();return {request(_name,_options,fn){const next=queue.then(fn);queue=next.catch(()=>{});return next;}}; }
function fixture(key,qty=500) {
    const route=P.buildRoute({additionalWorks:Object.values(P.managers).filter(n=>!['Cutting','Stitching','Ironing','Packing'].includes(n)).map(workType=>({workType}))});
    const stage=P.managers[key], index=route.findIndex(r=>r.stage===stage);
    const storage=new Storage({approvedPool:[{id:1,batchId:'BATCH-001',pieceNumber:1,pieceItem:'Jacket',quantity:qty,
        route,currentStage:route[index],stageBalances:{[stage]:{inputQty:qty}},stageHistory:[],schemaVersion:2}]});
    const locks=lock(), engine=P.createEngine(storage,locks);
    return {storage,engine,locks,key,stage,route};
}
const request=(quantity,worker='Worker A')=>({poolId:1,quantity,worker,deliveryDate:'2026-10-01'});
async function assigned(f,qty=500) { return (await f.engine.assign(f.key,[request(qty)]))[0]; }
function invariant(w) { const m=P.calculateProductionMath(w);assert.equal(m.inputQty,m.passedQty+m.remainingQty+m.damageQty); }
for(const key of Object.keys(P.managers).filter(k=>k!=='packingData')) {
 test(`${P.managers[key]}: single/multiple assignments reserve exactly 500`,async()=>{
    const f=fixture(key);await f.engine.assign(key,[request(300),request(200,'Worker B')]);
    const v=f.engine.views(key);assert.equal(f.engine.calculateAvailableQty(v.pool[0],v.works,f.stage),0);
    await assert.rejects(()=>f.engine.assign(key,[request(1)]),/available/);
 });
 test(`${P.managers[key]}: bulk overflow saves nothing`,async()=>{
    const f=fixture(key),before=[...f.storage.values];
    await assert.rejects(()=>f.engine.assign(key,[request(300),request(300,'Worker B')]),/available/);
    assert.deepEqual([...f.storage.values],before);
 });
 test(`${P.managers[key]}: 400 partial pass, reload, edit 500, pass only 100`,async()=>{
    const f=fixture(key),w=await assigned(f);
    await f.engine.edit(key,[{id:w.id,completedQty:400}]);
    assert.equal((await f.engine.pass(key,[w.id]))[0].qty,400);
    const pool=f.storage.read('approvedPool')[0],next=f.route[f.route.findIndex(r=>r.stage===f.stage)+1];
    assert.equal(pool.quantity,400);assert.equal(pool.currentStage.stage,next.stage);
    assert.equal(pool.stageBalances[next.stage].inputQty,400);
    const reloaded=P.createEngine(f.storage,f.locks);
    assert.equal(P.calculateProductionMath(reloaded.views(key).works[0]).passableQty,0);
    assert.equal((await reloaded.pass(key,[w.id]))[0].qty,0);
    await reloaded.edit(key,[{id:w.id,completedQty:500}]);
    assert.equal(P.calculateProductionMath(reloaded.views(key).works[0]).passableQty,100);
    assert.equal((await reloaded.pass(key,[w.id]))[0].qty,100);
    assert.equal(f.storage.read('approvedPool').length,1);
    assert.equal(f.storage.read('approvedPool')[0].stageBalances[next.stage].inputQty,500);
    invariant(reloaded.views(key).works[0]);
 });
 test(`${P.managers[key]}: concurrent 700 double pass cannot become 1400`,async()=>{
    const f=fixture(key,700),w=await assigned(f,700);await f.engine.edit(key,[{id:w.id,completedQty:700}]);
    const another=P.createEngine(f.storage,f.locks);
    const results=await Promise.all([f.engine.pass(key,[w.id]),another.pass(key,[w.id])]);
    assert.equal(results.flat().reduce((n,r)=>n+r.qty,0),700);
    assert.equal(f.storage.read('approvedPool')[0].stageHistory.filter(h=>h.action==='passed').length,1);
    if(key==='ironingData')assert.equal(f.storage.read('packingPool').reduce((n,r)=>n+r.quantity,0),700);
 });
 test(`${P.managers[key]}: damage 100, good 400, linked repair and validation`,async()=>{
    const f=fixture(key),w=await assigned(f);
    await f.engine.edit(key,[{id:w.id,damageQty:100,completedQty:400}]);await f.engine.pass(key,[w.id]);
    const repair=f.storage.read('repairData')[0];
    assert.equal(repair.damageQty,100);assert.equal(repair.sourceWorkId,w.id);assert.equal(repair.poolId,1);assert.equal(repair.stage,f.stage);
    const before=[...f.storage.values];
    await assert.rejects(()=>f.engine.edit(key,[{id:w.id,damageQty:101}]),/already passed/);
    await assert.rejects(()=>f.engine.edit(key,[{id:w.id,completedQty:300}]),/Already passed: 400/);
    await assert.rejects(()=>f.engine.edit(key,[{id:w.id,damageQty:-1}]),/non-negative/);
    await assert.rejects(()=>f.engine.edit(key,[{id:w.id,damageQty:501}]),/exceed/);
    assert.deepEqual([...f.storage.values],before);invariant(f.engine.views(key).works[0]);
 });
 test(`${P.managers[key]}: damage after partial pass, atomic bulk damage, bulk pass`,async()=>{
    const f=fixture(key);const [a,b]=await f.engine.assign(key,[request(300),request(200,'B')]);
    await f.engine.edit(key,[{id:a.id,completedQty:200},{id:b.id,completedQty:100}]);
    await f.engine.pass(key,[a.id,b.id]);
    const before=[...f.storage.values];
    await assert.rejects(()=>f.engine.edit(key,[{id:a.id,damageQty:100},{id:b.id,damageQty:201}]));
    assert.deepEqual([...f.storage.values],before);
    await f.engine.edit(key,[{id:a.id,damageQty:100},{id:b.id,damageQty:100}]);
    assert.ok((await f.engine.pass(key,[a.id,b.id,a.id])).every(r=>r.qty===0));
    f.engine.views(key).works.forEach(invariant);
 });
 test(`${P.managers[key]}: edit assignment excludes old reservation`,async()=>{
    const f=fixture(key),w=await assigned(f,300);
    await f.engine.edit(key,[{id:w.id,assignedQty:500}]);
    await assert.rejects(()=>f.engine.edit(key,[{id:w.id,assignedQty:501}]),/available/);
    const v=f.engine.views(key);assert.equal(f.engine.calculateAvailableQty(v.pool[0],v.works,f.stage),0);
 });
}
test('route is deterministic and ignores manual positions',()=>{
 const r=P.buildRoute({additionalWorks:[{workType:'Peco',stage:'Before Cutting'},{workType:'Embroidery',stage:'After Ironing'},{workType:'Peco'}]});
 assert.deepEqual(r.map(s=>s.stage),['Cutting','Embroidery','Peco','Stitching','Ironing','Packing']);
 assert.deepEqual(P.buildRoute({}).map(s=>s.stage),['Cutting','Stitching','Ironing','Packing']);
});
test('500 -> 400 -> 350 -> 300 -> Packing 300',async()=>{
 const f=fixture('cuttingData');
 const p=f.storage.read('approvedPool')[0];p.route=P.buildRoute({additionalWorks:[{workType:'Embroidery'}]});f.storage.setItem('approvedPool',JSON.stringify([p]));
 for(const [key,input,good] of [['cuttingData',500,400],['addWork_embroidery',400,350],['stitchingData',350,300],['ironingData',300,300]]) {
    const [w]=await f.engine.assign(key,[request(input)]);
    await f.engine.edit(key,[{id:w.id,completedQty:good,damageQty:input-good}]);
    await f.engine.pass(key,[w.id]);
 }
 assert.equal(f.storage.read('packingPool').reduce((n,p)=>n+p.quantity,0),300);
 assert.equal(f.storage.read('approvedPool').length,1);
});
test('late upstream receipt does not rewind downstream currentStage',async()=>{
 const f=fixture('cuttingData'),w=await assigned(f);await f.engine.edit(f.key,[{id:w.id,completedQty:400}]);await f.engine.pass(f.key,[w.id]);
 const [e]=await f.engine.assign('addWork_embroidery',[request(400)]);await f.engine.edit('addWork_embroidery',[{id:e.id,completedQty:400}]);await f.engine.pass('addWork_embroidery',[e.id]);
 const before=f.storage.read('approvedPool')[0].currentStage;
 await f.engine.edit(f.key,[{id:w.id,completedQty:500}]);await f.engine.pass(f.key,[w.id]);
 assert.deepEqual(f.storage.read('approvedPool')[0].currentStage,before);
 const view=f.engine.views('addWork_embroidery');assert.equal(f.engine.calculateAvailableQty(view.pool[0],view.works,'Embroidery'),100);
});
test('write failure rolls back every affected storage key',async()=>{
 const f=fixture('ironingData'),w=await assigned(f);await f.engine.edit(f.key,[{id:w.id,completedQty:500}]);
 const before=[...f.storage.values];f.storage.fail='packingPool';await assert.rejects(()=>f.engine.pass(f.key,[w.id]),/rolled back/);
 assert.deepEqual([...f.storage.values],before);
});
test('repair recovery is explicit and cannot duplicate quantity',async()=>{
 const f=fixture('cuttingData'),w=await assigned(f);await f.engine.edit(f.key,[{id:w.id,damageQty:100,completedQty:400}]);await f.engine.pass(f.key,[w.id]);
 await f.engine.recoverRepair(f.key,w.id,100);await assert.rejects(()=>f.engine.recoverRepair(f.key,w.id,100));
 assert.equal((await f.engine.pass(f.key,[w.id]))[0].qty,0);
 await f.engine.edit(f.key,[{id:w.id,completedQty:500}]);assert.equal((await f.engine.pass(f.key,[w.id]))[0].qty,100);
});
test('force pass orange, confirmed receipt green, no Cutting reset',async()=>{
 const storage=new Storage({approvedBatchData:[{batchId:'BATCH-001',quantity:500,pieces:[{number:1,item:'Jacket',materials:['Fabric','Zip']}]}]});
 const e=P.createEngine(storage,lock());await e.approve('BATCH-001',[{pieceNumber:1,mode:'pass',availability:{Fabric:'yes',Zip:'no'}}]);
 assert.equal(storage.read('approvedBatchData')[0].pieces[0].approval.status,'in_progress');
 const [w]=await e.assign('cuttingData',[request(500)]);await e.edit('cuttingData',[{id:w.id,completedQty:400}]);await e.pass('cuttingData',[w.id]);
 const before=storage.read('approvedPool')[0];await e.tickRequirement(1,'Zip',true);await e.receiveRequirement(1);await e.receiveRequirement(1);
 const after=storage.read('approvedPool')[0];assert.deepEqual(after.currentStage,before.currentStage);assert.equal(after.quantity,400);
 assert.deepEqual(after.stageBalances,before.stageBalances);assert.equal(storage.read('approvedPool').length,1);
 assert.equal(storage.read('approvedBatchData')[0].pieces[0].approval.status,'pass');
});
test('confirm remains pending without production until all requirements arrive',async()=>{
 const storage=new Storage({approvedBatchData:[{batchId:'BATCH-001',quantity:500,pieces:[{number:1,item:'Jacket',materials:['A','B','C']}]}]});
 const e=P.createEngine(storage,lock());await e.approve('BATCH-001',[{pieceNumber:1,mode:'confirm',availability:{A:'yes'}}]);
 await e.tickRequirement(1,'B',true);await e.receiveRequirement(1);assert.equal(storage.read('approvedPool').length,0);
 await e.tickRequirement(1,'C',true);await e.receiveRequirement(1);assert.equal(storage.read('approvedPool')[0].quantity,500);
});
test('legacy normalization preserves passed quantity and does not reset storage',async()=>{
 const storage=new Storage({approvedPool:[{id:1,batchId:'BATCH-001',pieceNumber:1,quantity:400,route:P.buildRoute({}),currentStage:{type:'stitching',stage:'Stitching'}}],cuttingData:[{id:1,poolId:1,quantity:500,progress:400,damage:0,passedQty:400}]});
 const e=P.createEngine(storage,lock());assert.equal(e.views('cuttingData').works[0].passedQty,400);
 await e.edit('cuttingData',[{id:1,completedQty:500}]);assert.equal((await e.pass('cuttingData',[1]))[0].qty,100);
 assert.equal(storage.read('cuttingData')[0].inputQty,500);
});
test('ambiguous legacy duplicate records are preserved and blocked',async()=>{
 const f=fixture('cuttingData');const p=f.storage.read('approvedPool')[0];f.storage.setItem('approvedPool',JSON.stringify([p,{...p,id:2}]));
 const before=[...f.storage.values];await assert.rejects(()=>f.engine.assign(f.key,[request(500)]),/duplicate pool/);assert.deepEqual([...f.storage.values],before);
});
test('unfinished multi-key transaction is rolled back on reload',async()=>{
 const f=fixture('cuttingData');const original=f.storage.getItem('approvedPool');
 f.storage.setItem('productionTransaction',JSON.stringify({before:{approvedPool:original,cuttingData:null}}));
 f.storage.setItem('approvedPool','[]');f.storage.setItem('cuttingData','[{"id":999}]');
 await f.engine.initialize();assert.equal(f.storage.getItem('approvedPool'),original);
 assert.equal(f.storage.getItem('cuttingData'),null);assert.equal(f.storage.getItem('productionTransaction'),null);
});
test('legacy numeric strings normalize without changing their quantities',async()=>{
 const f=fixture('cuttingData');f.storage.setItem('cuttingData',JSON.stringify([{id:1,poolId:1,quantity:'500',progress:'400',damage:'0',passedQty:'0'}]));
 await f.engine.pass(f.key,[1]);assert.equal(f.storage.read('cuttingData')[0].passedQty,400);
});
test('outsource stitching retains OS identity and shares in-house capacity',async()=>{
 const f=fixture('stitchingData');
 const [a,b]=await f.engine.assign(f.key,[request(300),{...request(200),worker:'',firm:'Test Firm',type:'outsource'}]);
 assert.match(a.subBatch,/-C1$/);assert.match(b.subBatch,/-OS1$/);
 await assert.rejects(()=>f.engine.assign(f.key,[request(1)]),/available/);
});
test('legacy cutting repair is enriched rather than duplicated',async()=>{
 const f=fixture('cuttingData'),w=await assigned(f);
 f.storage.setItem('repairData',JSON.stringify([{cuttingId:w.id,damageQty:0}]));
 await f.engine.edit(f.key,[{id:w.id,damageQty:100}]);
 assert.equal(f.storage.read('repairData').length,1);assert.equal(f.storage.read('repairData')[0].poolId,1);
});
test('stopping a batch cannot overwrite approval or silently free assignments',async()=>{
 const f=fixture('cuttingData');f.storage.setItem('approvedBatchData',JSON.stringify([{id:1,batchId:'BATCH-001',pieces:[{number:1,approval:{status:'pass'}}]}]));
 const w=await assigned(f);await f.engine.edit(f.key,[{id:w.id,completedQty:400}]);
 await f.engine.setBatchStopped(1,true);await assert.rejects(()=>f.engine.pass(f.key,[w.id]),/stopped/);
 await f.engine.setBatchStopped(1,false);assert.equal((await f.engine.pass(f.key,[w.id]))[0].qty,400);
 assert.equal(f.storage.read('approvedBatchData')[0].pieces[0].approval.status,'pass');
});
test('multiple selected approvals are atomic if one piece is invalid',async()=>{
 const storage=new Storage({approvedBatchData:[{batchId:'BATCH-001',quantity:500,pieces:[{number:1,materials:['A']},{number:2,materials:['B']}]}]});
 const e=P.createEngine(storage,lock()),before=[...storage.values];
 await assert.rejects(()=>e.approve('BATCH-001',[{pieceNumber:1,mode:'approve',availability:{A:'yes'}},{pieceNumber:2,mode:'approve',availability:{B:'no'}}]));
 assert.deepEqual([...storage.values],before);
});
