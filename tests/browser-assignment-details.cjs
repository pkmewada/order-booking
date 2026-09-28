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
 await send('Network.setBlockedURLs',{urls:['*qrcode*','*xlsx*','*cdn.datatables.net*','*fonts.googleapis.com*','*fonts.gstatic.com*']});

 await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.print=function(){window.__printed=true;};'});
 const pages=[['cutting-manager.php','cuttingData'],['Embroidery.php','addWork_embroidery'],['Digital-Print.php','addWork_digital_print'],['Screen-Print.php','addWork_screen_print'],['Handwork.php','addWork_hand_work'],['Peco.php','addWork_peco'],['stitching-manager.php','stitchingData'],['ironing.php','ironingData']];
 await navigate('cutting-manager.php');
 for(const [page,key] of pages.filter(([page])=>!process.argv[2] || page===process.argv[2])){
   await seed(P.managers[key]);await navigate(page);
   await evaluate(`Production.assign(${JSON.stringify(key)},[{poolId:1,quantity:500,type:'inhouse',worker:'Bilal Ahmed',priority:'Medium',deliveryDate:'2026-10-15'}])`);
   await navigate(page);
   await evaluate(`$('.view-row-action-btn').first().trigger('click');void 0;`);
   await until(()=>evaluate(`document.querySelector('#viewDetailBody .assignment-sheet') && !bootstrap.Modal.getInstance(document.getElementById('viewDetailModal'))._isTransitioning`),page+' view');
   assert.equal(await evaluate(`document.querySelectorAll('#viewDetailBody .assignment-info-cell').length`),6);
   assert.equal(await evaluate(`(()=>{const a=document.querySelector('.assignment-image').getBoundingClientRect(),b=document.querySelector('.assignment-main').getBoundingClientRect();return a.width/b.width>.64;})()`),true);
   await evaluate(`document.getElementById('printDetailBtn').click();void 0;`);
   await until(()=>evaluate(`Array.from(document.querySelectorAll('iframe')).some(f=>f.contentWindow?.__printed)`),page+' print');
   assert.equal(await evaluate(`(()=>{const f=Array.from(document.querySelectorAll('iframe')).find(f=>f.contentWindow?.__printed);return f.contentDocument.querySelectorAll('.assignment-sheet').length;})()`),1);
   if(key==='ironingData'){
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(profile,'assignment-view.png'),Buffer.from(shot.data,'base64'));
      const html=await evaluate(`Array.from(document.querySelectorAll('iframe')).find(f=>f.contentWindow?.__printed).contentDocument.documentElement.outerHTML`);
      await evaluate(`document.open();document.write(${JSON.stringify(html)});document.close();`);
      await until(()=>evaluate('document.styleSheets.length>0 && document.readyState==="complete"'),'print stylesheet');
      const pdf=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});const bytes=Buffer.from(pdf.data,'base64');
      assert.equal((bytes.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1,'one A4 page');fs.writeFileSync(path.join(profile,'assignment.pdf'),bytes);
      await send('Emulation.setEmulatedMedia',{media:'print'});const preview=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(profile,'print-preview.png'),Buffer.from(preview.data,'base64'));
   }
   console.log('PASS '+page+': view, wide image panel, full-width details and isolated print');
 }
 const relevant=errors.filter(e=>/assignment-details|production-engine|cutting-manager|embroidery\.js|digital-print\.js|screen-print\.js|handwork\.js|peco\.js|stitching-manager|ironing\.js/.test(JSON.stringify(e)));assert.deepEqual(relevant,[]);
 console.log('Artifacts: '+profile);
})().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{try{if(socket?.readyState===1)await send('Browser.close');}catch{}socket?.close();edge.kill();php.kill();});
