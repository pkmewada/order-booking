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
async function navigate(page){await send('Page.navigate',{url:`http://127.0.0.1:${port}/${page}`});try{await until(()=>evaluate('typeof Production !== "undefined" && typeof jQuery !== "undefined" && document.querySelector(".footer")'),'page '+page,30000);}catch(error){console.error(await evaluate('JSON.stringify({url:location.href,ready:document.readyState,title:document.title,jquery:typeof jQuery,production:typeof Production,body:document.body?.innerText.slice(0,500)})'));throw error;}await delay(250);}
async function seed(stage){
 const route=P.buildRoute({additionalWorks:['Embroidery','Digital Print','Screen Print','Hand Work','Peco'].map(workType=>({workType}))});
 const keys=['approvedPool','repairData','packingPool','approvedBatchData','batchData','requirementData','productionTransaction',...Object.keys(P.managers),...Object.keys(P.managers).map(k=>k==='cuttingData'?'cuttingHistory':k+'_history')];
 const pool={id:1,batchId:'BATCH-001',pieceNumber:1,pieceItem:'Jacket',brand:'Test',quantity:500,route,currentStage:route.find(r=>r.stage===stage),stageBalances:{[stage]:{inputQty:500}},stageHistory:[],schemaVersion:2};
 await evaluate(`(()=>{for(const key of ${JSON.stringify(keys)}) localStorage.removeItem(key);localStorage.setItem('approvedPool',${JSON.stringify(JSON.stringify([pool]))});})()`);
}
async function autoConfirm(){await evaluate(`window.__alerts=[];Swal.fire=async options=>{window.__alerts.push(options);return {isConfirmed:true,value:options.inputValue};};`);}
(async()=>{
 const tabs=await until(async()=>{const r=await fetch(`http://127.0.0.1:${debugPort}/json/list`);return r.json();},'Edge debugger');
 const tab=tabs.find(tab=>tab.type==='page' && tab.url==='about:blank') || tabs.find(tab=>tab.type==='page');
 if(!tab) throw Error('No browser page target was created.');
 socket=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
 socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const p=pending.get(data.id);pending.delete(data.id);data.error?p.reject(Error(data.error.message)):p.resolve(data.result);}else if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails);});
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
 await send('Network.setBlockedURLs',{urls:['*qrcode*','*xlsx*','*cdn.datatables.net*','*fonts.googleapis.com*','*fonts.gstatic.com*']});
 await navigate('cutting-manager.php');
 const pages=[['cutting-manager.php','cuttingData'],['Embroidery.php','addWork_embroidery'],['Digital-Print.php','addWork_digital_print'],['Screen-Print.php','addWork_screen_print'],['Handwork.php','addWork_hand_work'],['Peco.php','addWork_peco'],['stitching-manager.php','stitchingData'],['ironing.php','ironingData']];
 for(const [page,key] of pages){
   const stage=P.managers[key];await seed(stage);await navigate(page);await autoConfirm();
   await until(()=>evaluate('document.querySelectorAll(".assign-single-btn").length > 0'),stage+' available');
   await evaluate(`$('.assign-single-btn').first().trigger('click');$('.assignment-row').each(function(){const select=$(this).find('.worker-select');select.val(select.find('option').filter(function(){return this.value&&!this.disabled;}).first().val());$(this).find('.quantity-input').val(500);$(this).find('.delivery-date-input').val('2026-10-01');});$('#saveAssignBtn').trigger('click');`);
   await until(()=>evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)})||'[]').length===1`),stage+' assign');
   await evaluate(`$('.progress-btn').first().trigger('click');$('#progressTypeSelect').val('set_completed');$('#progressQty').val(400);$('#updateProgressBtn').trigger('click');`);
   await until(()=>evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].completedQty===400`),stage+' edit 400');
   await evaluate(`$('.pass-row-action-btn').first().trigger('click');`);
   await until(()=>evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].passedQty===400`),stage+' pass 400');
   assert.equal(await evaluate(`document.querySelectorAll('.pass-row-action-btn').length`),0,stage+' pass hidden');
   assert.equal(await evaluate(`JSON.parse(localStorage.getItem('approvedPool'))[0].quantity`),400);
   await evaluate(`$('.progress-btn').first().trigger('click');$('#progressTypeSelect').val('set_completed');$('#progressQty').val(500);$('#updateProgressBtn').trigger('click');`);
   await until(()=>evaluate(`document.querySelectorAll('.pass-row-action-btn').length===1`),stage+' pass reappears');
   await evaluate(`$('.pass-row-action-btn').first().trigger('click');`);
   await until(()=>evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))[0].passedQty===500`),stage+' pass 100');
   await navigate(page);await autoConfirm();
   assert.equal(await evaluate(`document.querySelectorAll('.pass-row-action-btn').length`),0,stage+' reload');
   await evaluate(`$('.view-row-action-btn').first().trigger('click');$('.batch-history-btn').first().trigger('click');$('#listAllBtn').trigger('click');`);
   assert.equal(await evaluate(`document.querySelectorAll('.production-bulk-pass').length > 0`),true,stage+' bulk controls');
   const alerts=await evaluate('window.__alerts.filter(a=>a.icon==="error")');assert.deepEqual(alerts,[],stage+' alerts');
   console.log(`PASS ${stage}: real assign/edit/pass/100-delta/reload/print controls`);
   await seed(stage);await navigate(page);await autoConfirm();
   await evaluate(`$('#bulkAssignBtn').trigger('click');$('.multi-select-checkbox').first().prop('checked',true).trigger('change');$('.bulk-global-split').val(2);$('.bulk-apply-split-btn').first().trigger('click');$('.bulk-assignment-row').each(function(i){const row=$(this),select=row.find('.worker-select');select.val(select.find('option').filter(function(){return this.value&&!this.disabled;}).eq(i).val());row.find('.quantity-input').val(300);row.find('.delivery-date-input').val('2026-10-01');});$('#saveBulkAssignBtn').trigger('click');`);
   await until(()=>evaluate('window.__alerts.some(a=>a.icon==="error")'),stage+' bulk rejection');
   assert.equal(await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)})||'[]').length`),0);
   await evaluate(`window.__alerts=[];$('.bulk-assignment-row .quantity-input').val(250);$('#saveBulkAssignBtn').trigger('click');`);
   await until(()=>evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)})||'[]').length===2`),stage+' valid bulk assign');
   await until(()=>evaluate('document.querySelectorAll(".production-select").length===2'),stage+' selection controls');
   await evaluate(`Swal.fire=async options=>{window.__alerts.push(options);return {isConfirmed:true,value:options.input==='textarea'?'1: 50\\n2: 50':options.inputValue};};$('.production-select').prop('checked',true);$('.production-bulk-damage').first().trigger('click');`);
   await until(()=>evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)})).every(w=>w.damageQty===50)`),stage+' bulk damage');
   for(const id of [1,2]){
     await evaluate(`$('.progress-btn[data-id="${id}"]').trigger('click');$('#progressTypeSelect').val('set_completed');$('#progressQty').val(200);$('#updateProgressBtn').trigger('click');`);
     await until(()=>evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)})).find(w=>w.id===${id}).completedQty===200`),stage+' bulk completion');
   }
   await evaluate(`$('.production-select').prop('checked',true);$('.production-bulk-pass').first().trigger('click');`);
   await until(()=>evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)})).every(w=>w.passedQty===200)`),stage+' bulk pass');
   console.log(`PASS ${stage}: bulk 300+300 rejection, 250+250 assignment, damage and pass controls`);
 }
 await navigate('bom-master.php');
 assert.equal(await evaluate('document.querySelectorAll("select.work-stage").length'),0);
 const relevant=errors.filter(e=>/production-|cutting-manager|embroidery|digital-print|screen-print|handwork|peco\.js|stitching-manager|ironing\.js|bom-master/.test(JSON.stringify(e)));
 assert.deepEqual(relevant,[],JSON.stringify(relevant,null,2));
 console.log('PASS: browser integration; unrelated template exceptions: '+(errors.length-relevant.length));
 console.log('Template exception messages: '+JSON.stringify([...new Set(errors.filter(e=>!relevant.includes(e)).map(e=>e.exception?.description?.split('\n')[0]||e.text))]));
})().catch(error=>{console.error(error.stack);console.error('Browser exceptions:',JSON.stringify(errors,null,2));process.exitCode=1;}).finally(async()=>{
 try{if(socket?.readyState===1)await send('Browser.close');}catch{}socket?.close();edge.kill();php.kill();
 console.log('Isolated test profile: '+profile);
});
