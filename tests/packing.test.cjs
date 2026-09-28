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

function packingFixture(missing=false){
 const pieces=['Jacket','Jeans','Shirt'].map((item,i)=>({number:i+1,item,size:'M'}));
 const storage=new Storage({approvedBatchData:[{batchId:'BATCH-001',pieces}],approvedPool:pieces.slice(0,missing?2:3).map((p,i)=>({id:i+1,batchId:'BATCH-001',pieceNumber:p.number,pieceItem:p.item,route:P.buildRoute({}),currentStage:{stage:'Packing',type:'packing'},stageBalances:{Packing:{inputQty:[700,600,650][i]}},stageHistory:[],schemaVersion:2}))});
 return {storage,e:P.createEngine(storage,lock())};
}
const request=quantity=>({batchId:'BATCH-001',quantity,worker:'Danish Ali',priority:'High',deliveryDate:'2026-10-15'});
test('packing pairs all pieces, retains balances and groups assignments by lot',async()=>{const {e,storage}=packingFixture();assert.equal(e.packingBatches()[0].available,600);const rows=await e.assignPacking(request(600));assert.equal(new Set(rows.map(w=>w.packingLotId)).size,1);assert.deepEqual(rows.map(w=>w.assignedQty),[600,600,600]);assert.ok(rows.every(w=>w.size==='M'));assert.deepEqual(e.packingBatches()[0].pieces.map(p=>p.available),[100,0,50]);assert.equal(storage.read('packingPool').length,0);});
test('packing waits for missing pieces and refuses fractional or excessive sets atomically',async()=>{const missing=packingFixture(true);assert.equal(missing.e.packingBatches()[0].available,0);await assert.rejects(()=>missing.e.assignPacking(request(1)));const {e,storage}=packingFixture();await assert.rejects(()=>e.assignPacking(request(601)));await assert.rejects(()=>e.assignPacking(request(1.5)));assert.equal(storage.read('packingData').length,0);});
test('holding unmatched balances persists and later receipts can be restored',async()=>{const {e,storage}=packingFixture();await e.assignPacking(request(600));await e.setPackingHold('BATCH-001',true);await e.transaction(s=>{s.approvedPool[1].stageBalances.Packing.inputQty+=100;s.approvedPool[2].stageBalances.Packing.inputQty+=50;});const reload=P.createEngine(storage,lock());assert.equal(reload.packingBatches()[0].held,true);await assert.rejects(()=>reload.assignPacking(request(100)));await reload.setPackingHold('BATCH-001',false);await reload.assignPacking(request(100));assert.deepEqual(reload.packingBatches()[0].pieces.map(p=>p.available),[0,0,0]);});
test('concurrent packing assignments cannot reserve the same pairs twice',async()=>{const {e}=packingFixture();const results=await Promise.allSettled([e.assignPacking(request(400)),e.assignPacking(request(400))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(e.readState().packingData.length,3);});
test('packing progress and damaged pieces keep reservations',async()=>{const {e}=packingFixture();const rows=await e.assignPacking(request(600));await e.edit('packingData',rows.map(w=>({id:w.id,completedQty:590,damageQty:10})));assert.deepEqual(e.packingBatches()[0].pieces.map(p=>p.available),[100,0,50]);});
