/* Real Edge/PHP smoke tests in a new, isolated browser profile. Never touches the user's browser data. */
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const P=require('../assets/js/production-engine.js');
const root=path.resolve(__dirname,'..'),port=8875,debugPort=9335;
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'garment-production-test-'));
const php=spawn('C:/xampp/php/php.exe',['-S',`127.0.0.1:${port}`,'-t',root],{windowsHide:true,stdio:'ignore'});
const edge=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
 '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,
 `--remote-debugging-port=${debugPort}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket,seq=0;const pending=new Map(),errors=[];
async function until(fn,label,timeout=30000) {const start=Date.now();while(Date.now()-start<timeout){try{const v=await fn();if(v)return v;}catch{}await delay(100);}throw Error(`Timed out: ${label}`);}
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function navigate(page){await send('Page.navigate',{url:`http://127.0.0.1:${port}/${page}`});try{await until(()=>evaluate('(typeof Production !== "undefined" || location.pathname.endsWith("/batch.php")) && typeof jQuery !== "undefined" && document.readyState === "complete" && document.querySelector(".footer")'),'page '+page,30000);}catch(error){console.error(await evaluate('JSON.stringify({url:location.href,ready:document.readyState,title:document.title,jquery:typeof jQuery,production:typeof Production,body:document.body?.innerText.slice(0,500)})'));throw error;}await delay(250);}
async function seed(stage){
 const route=P.buildRoute({additionalWorks:['Embroidery','Digital Print','Screen Print','Hand Work','Peco'].map(workType=>({workType}))});
 const keys=['approvedPool','repairData','packingPool','approvedBatchData','batchData','requirementData','productionTransaction',...Object.keys(P.managers),...Object.keys(P.managers).map(k=>k==='cuttingData'?'cuttingHistory':k+'_history')];
 const pool={id:1,batchId:'BATCH-001',pieceNumber:1,pieceItem:'Jacket',brand:'Test',quantity:500,route,currentStage:route.find(r=>r.stage===stage),stageBalances:{[stage]:{inputQty:500}},stageHistory:[],schemaVersion:2};
 await evaluate(`(()=>{for(const key of ${JSON.stringify(keys)}) localStorage.removeItem(key);localStorage.setItem('approvedPool',${JSON.stringify(JSON.stringify([pool]))});})()`);
}
async function autoConfirm(){await evaluate(`window.__alerts=[];Swal.fire=async options=>{window.__alerts.push(options);return {isConfirmed:true,value:options.inputValue};};`);}
(async()=>{
 const tabs=await until(async()=>{const r=await fetch(`http://127.0.0.1:${debugPort}/json/list`,{signal:AbortSignal.timeout(3000)});return r.json();},'Edge debugger');
 const tab=tabs.find(tab=>tab.type==='page' && tab.url==='about:blank') || tabs.find(tab=>tab.type==='page');
 if(!tab) throw Error('No browser page target was created.');
 socket=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
 socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const p=pending.get(data.id);pending.delete(data.id);data.error?p.reject(Error(data.error.message)):p.resolve(data.result);}else if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails);});
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1500,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:profile});
 await send('Network.setBlockedURLs',{urls:['*qrcode*','*xlsx*','*cdn.datatables.net*','*fonts.googleapis.com*','*fonts.gstatic.com*']});

 await navigate('packing.php'); await autoConfirm();
 await evaluate(`(()=>{localStorage.setItem('bomMasterData',JSON.stringify([{id:1,brand:'AMARI',designNumber:'A1',color:'Blue',pattern:'Jacket Set',mrp:1775,pieceCount:3}]));const pieces=['Jacket','Jeans','Shirt'].map((item,i)=>({number:i+1,item,size:'M'}));localStorage.setItem('approvedBatchData',JSON.stringify([{batchId:'BATCH-001',pieces}]));localStorage.setItem('approvedPool',JSON.stringify(pieces.map((p,i)=>({id:i+1,batchId:'BATCH-001',brand:'AMARI',designNumber:'A1',color:'Blue',pieceNumber:p.number,pieceItem:p.item,route:Production.buildRoute({}),currentStage:{stage:'Ironing',type:'ironing'},stageBalances:{Ironing:{inputQty:[700,600,650][i]}},stageHistory:[],schemaVersion:2}))));})()`);
 await evaluate(`(async()=>{for(let i=0;i<3;i++){const qty=[700,600,650][i];const [w]=await Production.assign('ironingData',[{poolId:i+1,quantity:qty,worker:'Danish Ali',deliveryDate:'2026-10-15'}]);await Production.edit('ironingData',[{id:w.id,completedQty:qty}]);await Production.pass('ironingData',[w.id]);}})()`);
 await navigate('packing.php');await autoConfirm();
 assert.equal(await evaluate(`$('#availableList tr').length`),3);
 assert.equal(await evaluate(`$('.assign-single-btn').length`),1);
 assert.equal(await evaluate(`$('#bulkAssignBtn').length`),0);
 await evaluate(`$('.assign-single-btn').trigger('click');void 0;`);
 assert.equal(await evaluate(`Number($('.quantity-input').val())`),600);
 assert.equal(await evaluate(`$('.piece-quantity').length`),3);
 await evaluate(`$('.worker-select').val('Danish Ali');$('#saveAssignBtn').trigger('click');void 0;`);
 await until(()=>evaluate(`JSON.parse(localStorage.getItem('packingData')||'[]').length===3`),'paired packing assignment');
 await until(()=>fs.readdirSync(profile).some(f=>f.endsWith('-labels.html')),'automatic label download');
 const labelFile=fs.readdirSync(profile).find(f=>f.endsWith('-labels.html'));
 assert.equal((fs.readFileSync(path.join(profile,labelFile),'utf8').match(/<article/g)||[]).length,600);
 assert.equal(await evaluate(`$('#assignedList tr').length`),1);
 assert.equal(await evaluate(`$('#assignedList').text().includes('Jacket Set')`),true);
 assert.equal(await evaluate(`PackingLabels.sizes('LITTLE DOLLY').join(',')`),'18,20,22,24,26');
 assert.equal(await evaluate(`PackingLabels.sizes('NIVI BLOSSOM').join(',')`),'28,30,32,34');
 assert.equal(await evaluate(`$('#assignedList .progress-btn').length`),1);
 await evaluate(`$('.hold-btn').trigger('click');void 0;`);
 await until(()=>evaluate(`JSON.parse(localStorage.getItem('packingHolds')||'[]').length===1`),'hold balance');
 assert.equal(await evaluate(`$('#availableList .assign-single-btn').length`),0);
 await navigate('packing.php');await autoConfirm();
 await evaluate(`$('#holdListBtn').trigger('click');$('.restore-btn').trigger('click');void 0;`);
 await until(()=>evaluate(`JSON.parse(localStorage.getItem('packingHolds')||'[]').length===0`),'restore held balance');
 assert.equal(await evaluate(`Production.packingBatches()[0].pieces.map(p=>p.available).join(',')`),'100,0,50');
 await navigate('packing.php');await autoConfirm();
 await evaluate(`$('.progress-btn').trigger('click');$('.completed-input').val(600);$('#updateProgressBtn').trigger('click');void 0;`);
 await until(()=>evaluate(`JSON.parse(localStorage.getItem('packingData')).every(w=>w.completedQty===600)`),'save lot progress');
 await navigate('packing.php');
 assert.equal(await evaluate(`$('#assignedList').text().includes('Completed')`),true);
 await autoConfirm();
 await evaluate(`$('#assignedList .pass-lot-btn').trigger('click');void 0;`);
 await until(()=>evaluate(`JSON.parse(localStorage.getItem('packingData')).every(w=>w.passedQty===600)`),'pass lot');
 await navigate('packing.php');
 assert.equal(await evaluate(`$('#assignedList .progress-btn').length`),0);
 assert.equal(await evaluate(`$('#passedList .label-lot-btn').length`),1);
 await evaluate(`$('#labelBtn').trigger('click');$('#labelDesign').val('A1').trigger('input');void 0;`);
 assert.equal(await evaluate(`$('#labelSize option').map((i,e)=>e.value).get().join(',')`),'S,M,L');
 assert.equal(await evaluate(`$('#labelPreview .label-main').length`),1);
 assert.equal(await evaluate(`$('#labelPreview .label-stub').length`),1);
 assert.equal(await evaluate(`$('#labelPreview svg').length`),2);
 await delay(500);
 const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(profile,'packing-table.png'),Buffer.from(screenshot.data,'base64'));
 await navigate('bom-master.php');
 assert.equal(await evaluate(`$('#pattern').length`),1);
 assert.equal(await evaluate(`$('#mrp').length`),1);
 await evaluate(`$('.edit-bom-btn').first().trigger('click');void 0;`);
 assert.equal(await evaluate(`$('#pattern').val()`),'Jacket Set');
 assert.equal(await evaluate(`$('#mrp').val()`),'1775');
 assert.equal(await evaluate(`$('#mrp').val(-1)[0].checkValidity()`),false);
 const relevant=errors.filter(e=>/production-engine|packing\.js/.test(JSON.stringify(e)));assert.deepEqual(relevant,[]);
 await navigate('stitching-manager.php');assert.equal(await evaluate('typeof Production'),'object');
 console.log('PASS: Ironing receipts, two Packing tables, one batch Assign, 600 paired sets, hold/restore/reload, progress and Stitching engine load.');
 console.log('Screenshot: '+path.join(profile,'packing-table.png'));
})().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{try{if(socket?.readyState===1)await send('Browser.close');}catch{}socket?.close();edge.kill();php.kill();});
