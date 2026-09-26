const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const pairs={'cutting-manager':'cutting-manager',embroidery:'Embroidery','digital-print':'Digital-Print','screen-print':'Screen-Print',handwork:'Handwork',peco:'Peco','stitching-manager':'stitching-manager',ironing:'ironing'};
let scripts=0,pages=0;
for(const filename of fs.readdirSync(path.join(root,'assets/js')).filter(f=>f.endsWith('.js'))){
    new vm.Script(fs.readFileSync(path.join(root,'assets/js',filename),'utf8'),{filename});scripts++;
}
for(const filename of fs.readdirSync(root).filter(f=>f.endsWith('.php'))){
    const result=spawnSync('C:/xampp/php/php.exe',['-l',path.join(root,filename)],{encoding:'utf8',windowsHide:true});
    assert.equal(result.status,0,result.stdout+result.stderr);pages++;
}
for(const [script,page] of Object.entries(pairs)){
    const html=fs.readFileSync(path.join(root,page+'.php'),'utf8'),js=fs.readFileSync(path.join(root,'assets/js',script+'.js'),'utf8');
    assert.ok(html.indexOf('production-engine.js')<html.indexOf(script+'.js'),page+' engine load order');
    assert.ok(html.includes('production-controls.js'),page+' bulk controls');
    for(const operation of ['assign','edit','pass','stop']) assert.ok(js.includes(`Production.${operation}(`),script+' '+operation);
    assert.ok(js.includes('Production.calculateAvailableQty('));
    assert.ok(js.includes('Production.calculateProductionMath(item).passableQty > 0'));
    assert.ok(!js.includes('localStorage.clear('));
    assert.ok(!js.includes('saveStorage(APPROVED_POOL_KEY'));
    assert.ok(!js.includes('autoPassQty'));
    assert.ok(!js.includes('srcBefore - qty'));
}
const bom=fs.readFileSync(path.join(root,'assets/js/bom-master.js'),'utf8');
assert.ok(!/<select\s+class="work-stage"/.test(bom));
assert.ok(bom.includes('Production.buildRoute('));
console.log(`PASS: ${scripts} JavaScript files parsed, ${pages} PHP pages linted, eight manager integrations checked.`);
