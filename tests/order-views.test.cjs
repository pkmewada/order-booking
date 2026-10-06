const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const load=name=>fs.readFileSync(require.resolve('../assets/js/'+name),'utf8');
async function exportPdf(options) {
    const captures=[], writes=[];
    const root={style:{},innerHTML:'',scrollHeight:500,querySelectorAll:()=>[]};
    let saved;
    const pdf={internal:{getNumberOfPages:()=>1},setFontSize(){},text(){},save:name=>saved=name};
    const worker={set(){return this;},from(element){captures.push(element.innerHTML);return this;},toCanvas(){return this;},toPdf(){return Promise.resolve(this);},get:key=>Promise.resolve(key==='pdf'?pdf:{width:750,height:500})};
    let count=0;
    const context={window:{},localStorage:{getItem:()=>null,setItem:(...args)=>writes.push(args)},
        Image:class {set src(value){this.onerror();}},
        document:{createElement:()=>count++===0?{style:{},appendChild(){},remove(){}}:root,body:{appendChild(){}}},html2pdf:()=>worker};
    vm.createContext(context);
    vm.runInContext(load('order-quantities.js'),context);
    context.OrderQuantities=context.window.OrderQuantities;
    vm.runInContext(load('dispatch-flow.js'),context);
    context.DispatchFlow=context.window.DispatchFlow;
    vm.runInContext(load('order-pdf.js'),context);
    const order={id:'ORD1',shopName:'Shop',customerName:'Customer',items:[{description:'Dress',brand:'AMARI',qty:4,piecesPerSet:3,dispatchDeliveredPieces:6},{description:'Unsent',brand:'AMARI',qty:1,piecesPerSet:3,dispatchDeliveredPieces:0}]};
    const before=JSON.stringify(order);
    await context.window.OrderPdf.download(order,options);
    assert.equal(JSON.stringify(order),before);assert.equal(writes.length,0);
    return {html:captures.join(''),saved};
}
test('delivery PDF keeps template and terms, omits bottom note and prints only delivered quantities',async()=>{
    const {html,saved}=await exportPdf({delivery:true,hideNote:true});
    assert.match(html,/BOTHRA CREATION/);assert.match(html,/Terms &amp; Condition/);assert.match(html,/2 Set \/ 6 pcs/);
    assert.doesNotMatch(html,/For Any Query Regarding Order|Unsent/);assert.match(saved,/-DELIVERY\.pdf$/);
});
test('existing order PDF retains original quantities and note',async()=>{
    const {html,saved}=await exportPdf();
    assert.match(html,/4 Set \/ 12 pcs/);assert.match(html,/5 Set \/ 15 pcs/);assert.match(html,/For Any Query Regarding Order/);
    assert.doesNotMatch(saved,/-DELIVERY/);
});
