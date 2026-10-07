window.CatalogApi = (() => {
 let records=[], masters={colors:[],items:[],works:[]};
 async function request(endpoint,data,file,method='POST') {
  const options={method:data?method:'GET',cache:'no-store'};
  if(data){if(file){const body=new FormData();body.append('payload',JSON.stringify(data));body.append('photo',file);options.body=body;}else{options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(data);}}
  const response=await fetch('api/'+endpoint+'.php',options);let result;
  try{result=await response.json();}catch(_){throw new Error('Invalid server response. Check database setup.');}
  if(!response.ok||!result.success)throw new Error(result.message||'Request failed.');return result.data;
 }
 async function load(){const [rows,colors,items,works]=await Promise.all([request('bom'),request('colour'),request('item-list'),request('additional-work')]);records=rows;masters={colors,items,works};try{localStorage.setItem('bomMasterData',JSON.stringify(rows));localStorage.setItem('products',JSON.stringify(rows.filter(r=>r.inProductList)));}catch(e){console.warn('Catalog cache unavailable',e);}return rows;}
 function details(data){return {...data,colourId:masters.colors.find(r=>r.name===data.color)?.id,pieces:(data.pieces||[]).map(p=>({number:p.number,itemId:masters.items.find(i=>i.name===p.item)?.id,materialIds:(p.materials||[]).map(n=>masters.items.find(i=>i.name===n)?.id),additionalWorks:(p.additionalWorks||[]).map(w=>({workId:masters.works.find(i=>i.name===w.workType)?.id,stage:w.stage}))}))};}
 return {load,request,details,get records(){return records;},get masters(){return masters;}};
})();
