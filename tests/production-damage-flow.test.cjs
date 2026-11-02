const test = require('node:test');
const assert = require('node:assert/strict');
const Production = require('../assets/js/productionEngine.js');

class MemoryStorage {
    constructor(seed) {
        this.data = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
    }
    getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
    setItem(key, value) { this.data.set(key, String(value)); }
    removeItem(key) { this.data.delete(key); }
}
const locks = { request: (_name, _opts, action) => action() };
const deadline = '2026-11-10';
const branchWorks = ['Embroidery', 'Digital Print', 'Screen Print', 'Hand Work'];
const material = (id, name, itemType = 'Cutting') => ({ id, name, itemType });

function threePieceEngine() {
    const additionalWorks = branchWorks.map(workType => ({ workType, stage: 'After Cutting' }));
    const pieces = [
        { number: 1, item: 'Pant', materials: ['Cotton', 'Satin'], materialItems: [material('cotton', 'Cotton'), material('satin', 'Satin')], additionalWorks },
        { number: 2, item: 'Shirt', materials: ['Fabric', 'Button'], materialItems: [material('fabric', 'Fabric'), material('button', 'Button', 'Non-Cutting')], additionalWorks },
        { number: 3, item: 'Jacket', materials: ['Shell', 'Lining'], materialItems: [material('shell', 'Shell'), material('lining', 'Lining')], additionalWorks }
    ];
    const batch = { id: 1, batchId: 'BATCH-3PC', quantity: 1000, brand: 'LITTLE DOLLY', designNumber: 'D-3PC', color: 'Navy', pieces };
    return Production.createEngine(new MemoryStorage({ approvedBatchData: [batch], batchData: [structuredClone(batch)] }), locks);
}
const pool = (engine, number) => engine.readState().approvedPool.find(p => p.pieceNumber === number);
const rowsOf = (engine, key, poolId) => engine.readState()[key].filter(work => work.poolId === poolId);
const viewsFor = (engine, key, poolId) => engine.views(key).pool.filter(view => view.id === poolId);

async function assignCutting(engine, poolId, quantity, split) {
    const p = pool(engine, engine.readState().approvedPool.find(item => item.id === poolId).pieceNumber);
    return engine.assign('cuttingData', p.cuttingComponents.filter(component => component.available).map(component => ({
        poolId, componentId: component.id, componentName: component.name, splitGroupId: split,
        subBatch: `${p.batchId}-${split}`, quantity, worker: 'Cutter', deliveryDate: deadline
    })));
}
async function completeAndPassCutting(engine, poolId) {
    const rows = rowsOf(engine, 'cuttingData', poolId);
    const open = rows.filter(work => Production.calculateProductionMath(work).uncompletedQty > 0);
    if (open.length) await engine.edit('cuttingData', open.map(work => ({ id: work.id, addCompleted: Production.calculateProductionMath(work).uncompletedQty })));
    const components = new Map();
    engine.readState().cuttingData.filter(work => work.poolId === poolId).forEach(work => {
        const id = String(work.componentId ?? 'legacy');
        components.set(id, (components.get(id) || 0) + Production.calculateProductionMath(work).passableQty);
    });
    const quantity = Math.min(...components.values());
    return engine.passComponents('cuttingData', poolId, [...components.keys()].map(componentId => ({ componentId, quantity })));
}
async function assignBranches(engine, poolId) {
    const created = [];
    for (const view of viewsFor(engine, 'additionalWorkData', poolId)) {
        const rows = engine.readState().additionalWorkData;
        const available = engine.calculateAvailableQty(view, rows, view.workType, undefined, undefined, view.currentStage.routeIndex, view.quantity);
        if (available <= 0) continue;
        created.push(...await engine.assign('additionalWorkData', [{ poolId, workType: view.workType, routeOrder: view.currentStage.routeIndex,
            quantity: available, worker: `${view.workType} worker`, deliveryDate: deadline }]));
    }
    return created;
}
async function completeAll(engine, key, works) {
    const fresh = works.map(work => engine.readState()[key].find(row => row.id === work.id));
    const open = fresh.filter(work => Production.calculateProductionMath(work).uncompletedQty > 0);
    if (open.length) await engine.edit(key, open.map(work => ({ id: work.id, addCompleted: Production.calculateProductionMath(work).uncompletedQty })));
}
async function assignStage(engine, key, poolId) {
    const [view] = viewsFor(engine, key, poolId);
    const available = engine.calculateAvailableQty(view, engine.readState()[key], Production.managers[key]);
    return engine.assign(key, [{ poolId, quantity: available, worker: `${key} worker`, deliveryDate: deadline }]);
}
function assertConservation(engine) {
    for (const key of ['cuttingData', 'additionalWorkData', 'stitchingData', 'ironingData', 'packingData']) {
        for (const work of engine.readState()[key]) {
            const m = Production.calculateProductionMath(work);
            assert.equal(m.inputQty, m.passedQty + m.remainingQty + m.damageQty, `${key} #${work.id} conserves its quantity`);
        }
    }
}

test('3-piece garment: requirement, paired Cutting damage, 4 parallel works, damage repairs, Packing, Bundling and Inventory', async () => {
    const engine = threePieceEngine();
    // Jacket is force-passed with Lining missing; a requirement opens and its Lining cannot be cut yet.
    await engine.approve('BATCH-3PC', [
        { pieceNumber: 1, mode: 'approve', availability: { Cotton: 'yes', Satin: 'yes' } },
        { pieceNumber: 2, mode: 'approve', availability: { Fabric: 'yes', Button: 'yes' } },
        { pieceNumber: 3, mode: 'pass', availability: { Shell: 'yes', Lining: 'no' } }
    ]);
    const [pant, shirt, jacket] = [1, 2, 3].map(number => pool(engine, number));
    assert.deepEqual([pant, shirt, jacket].map(p => p.stageBalances.Cutting.inputQty), [1000, 1000, 1000]);
    assert.deepEqual(shirt.cuttingComponents.map(c => c.name), ['Fabric'], 'Non-Cutting items are not cut');
    assert.equal(jacket.cuttingComponents.find(c => c.name === 'Lining').available, false);
    const [requirement] = engine.readState().requirementData;
    assert.deepEqual(requirement.missingItems, ['Lining']);
    await engine.tickRequirement(requirement.id, 'Lining', true);
    await engine.receiveRequirement(requirement.id);
    assert.equal(pool(engine, 3).cuttingComponents.find(c => c.name === 'Lining').available, true);
    assert.equal(pool(engine, 3).stageBalances.Cutting.inputQty, 1000, 'receiving material never adds production');

    // Cutting: every piece is cut on its own.
    for (const p of [pant, shirt, jacket]) await assignCutting(engine, p.id, 1000, 'C1');
    await engine.edit('cuttingData', engine.readState().cuttingData.map(work => ({ id: work.id, addCompleted: 1000 })));
    const cotton = engine.readState().cuttingData.find(work => work.componentId === 'cotton');
    await engine.edit('cuttingData', [{ id: cotton.id, addDamage: 200 }]);
    const pantCutting = rowsOf(engine, 'cuttingData', pant.id);
    assert.deepEqual(pantCutting.map(work => [work.itemName, work.completedQty, work.damageQty]), [['Cotton', 800, 200], ['Satin', 800, 200]],
        '200 damaged Cotton also spoils 200 Satin of the same garments');
    const damageRows = engine.damageRepairs();
    assert.equal(damageRows.length, 1, 'paired Cutting damage is one Damage entry');
    assert.equal(damageRows[0].damageQty, 200);
    assert.match(damageRows[0].pieces, /Cotton 200, Satin 200/);

    for (const p of [pant, shirt, jacket]) await completeAndPassCutting(engine, p.id);
    assert.deepEqual(viewsFor(engine, 'additionalWorkData', pant.id).map(view => view.quantity), [800, 800, 800, 800],
        'only the 800 good garments reach every Add Work branch');
    assert.deepEqual(viewsFor(engine, 'additionalWorkData', shirt.id).map(view => view.quantity), [1000, 1000, 1000, 1000]);
    await assert.rejects(engine.assign('additionalWorkData', [{ poolId: pant.id, workType: 'Embroidery',
        routeOrder: viewsFor(engine, 'additionalWorkData', pant.id)[0].currentStage.routeIndex, quantity: 801, worker: 'X', deliveryDate: deadline }]),
        /Available: 800/);

    // Add Work: Embroidery damages 50 Pant pieces; Shirt finishes; Jacket misses one branch.
    const pantBranches = await assignBranches(engine, pant.id);
    const shirtBranches = await assignBranches(engine, shirt.id);
    const jacketBranches = await assignBranches(engine, jacket.id);
    await completeAll(engine, 'additionalWorkData', [...pantBranches, ...shirtBranches, ...jacketBranches]);
    const pantEmbroidery = pantBranches.find(work => work.workType === 'Embroidery');
    await engine.edit('additionalWorkData', [{ id: pantEmbroidery.id, addDamage: 50 }]);
    await engine.pass('additionalWorkData', [...pantBranches, ...shirtBranches].map(work => work.id));
    await engine.pass('additionalWorkData', jacketBranches.filter(work => work.workType !== 'Hand Work').map(work => work.id));

    let stitching = engine.views('stitchingData').pool;
    const stitchQty = id => stitching.find(view => view.id === id);
    assert.equal(stitchQty(pant.id).quantity, 750, 'Pant moves on with the slowest branch: 800 - 50 damaged');
    assert.equal(stitchQty(shirt.id).quantity, 1000, 'Shirt is not held back by the other pieces');
    assert.equal(stitchQty(jacket.id).stageEnabled, false);
    assert.deepEqual(stitchQty(jacket.id).waitingForAdditionalWorks, ['Hand Work (1000 C)']);

    // Cutting repair returns to Cutting with both Pant items, then flows to every branch.
    await engine.reassignDamage('cuttingData', cotton.id);
    const cuttingRepairs = rowsOf(engine, 'cuttingData', pant.id).filter(work => work.repairOf !== undefined);
    assert.deepEqual(cuttingRepairs.map(work => [work.stage, work.itemName, work.inputQty]), [['Cutting', 'Cotton', 200], ['Cutting', 'Satin', 200]]);
    assert.equal(new Set(cuttingRepairs.map(work => work.subBatch)).size, 1, 'repaired items stay one paired split');
    await completeAndPassCutting(engine, pant.id);
    assert.deepEqual(viewsFor(engine, 'additionalWorkData', pant.id).map(view => view.quantity), [1000, 1000, 1000, 1000]);
    const pantRepairBranches = await assignBranches(engine, pant.id);
    assert.deepEqual(pantRepairBranches.map(work => work.inputQty), [200, 200, 200, 200]);
    await completeAll(engine, 'additionalWorkData', pantRepairBranches);
    await engine.pass('additionalWorkData', pantRepairBranches.map(work => work.id));
    stitching = engine.views('stitchingData').pool;
    assert.equal(stitchQty(pant.id).quantity, 950, 'Embroidery still owes its 50 damaged pieces');

    // Embroidery damage repair returns to the same Embroidery branch.
    await engine.reassignDamage('additionalWorkData', pantEmbroidery.id);
    const embroideryRepair = engine.readState().additionalWorkData.find(work => work.repairOf === pantEmbroidery.id);
    assert.equal(embroideryRepair.stage, 'Embroidery');
    assert.equal(embroideryRepair.routeOrder, pantEmbroidery.routeOrder);
    assert.equal(embroideryRepair.branch, pantEmbroidery.branch);
    await completeAll(engine, 'additionalWorkData', [embroideryRepair]);
    await engine.pass('additionalWorkData', [embroideryRepair.id]);
    await engine.pass('additionalWorkData', jacketBranches.filter(work => work.workType === 'Hand Work').map(work => work.id));
    stitching = engine.views('stitchingData').pool;
    assert.deepEqual([pant, shirt, jacket].map(p => stitchQty(p.id).quantity), [1000, 1000, 1000]);
    assert.equal(engine.damageRepairs().length, 0);

    // Stitching: Shirt damages 100; Ironing receives only good pieces.
    const stitchRows = [];
    for (const p of [pant, shirt, jacket]) stitchRows.push(...await assignStage(engine, 'stitchingData', p.id));
    await completeAll(engine, 'stitchingData', stitchRows);
    const shirtStitch = stitchRows.find(work => work.poolId === shirt.id);
    await engine.edit('stitchingData', [{ id: shirtStitch.id, addDamage: 100 }]);
    await engine.pass('stitchingData', stitchRows.map(work => work.id));
    assert.deepEqual([pant, shirt, jacket].map(p => viewsFor(engine, 'ironingData', p.id)[0].quantity), [1000, 900, 1000]);
    await assert.rejects(engine.assign('ironingData', [{ poolId: shirt.id, quantity: 1000, worker: 'Ironer', deliveryDate: deadline }]), /Available: 900/);

    const ironRows = [];
    for (const p of [pant, shirt, jacket]) ironRows.push(...await assignStage(engine, 'ironingData', p.id));
    await completeAll(engine, 'ironingData', ironRows);
    await engine.pass('ironingData', ironRows.map(work => work.id));
    let packing = engine.packingBatches().find(batch => batch.batchId === 'BATCH-3PC');
    assert.deepEqual(packing.pieces.map(piece => piece.received), [1000, 900, 1000]);
    assert.equal(packing.available, 900, 'sets are limited by the piece with the fewest good pieces');

    // Packing: 10 damaged sets; 890 complete sets go to Bundling.
    const [firstLot] = await engine.assignPackingBulk([{ batchId: 'BATCH-3PC', quantity: 900, worker: 'Packer', deliveryDate: deadline }]);
    const firstLotId = firstLot[0].packingLotId;
    await engine.editPackingLot(firstLotId, 'damage', 10);
    await engine.editPackingLot(firstLotId, 'completed', 890);
    await engine.passPackingLot(firstLotId);
    assert.equal(engine.bundlingReady().find(lot => lot.packingLotId === firstLotId).totalQuantity, 890);

    // Shirt stitching repair goes back to Stitching, then through Ironing to Packing.
    await engine.reassignDamage('stitchingData', shirtStitch.id);
    const stitchRepair = engine.readState().stitchingData.find(work => work.repairOf === shirtStitch.id);
    assert.equal(stitchRepair.stage, 'Stitching');
    await completeAll(engine, 'stitchingData', [stitchRepair]);
    await engine.pass('stitchingData', [stitchRepair.id]);
    const ironRepair = await assignStage(engine, 'ironingData', shirt.id);
    await completeAll(engine, 'ironingData', ironRepair);
    await engine.pass('ironingData', ironRepair.map(work => work.id));
    packing = engine.packingBatches().find(batch => batch.batchId === 'BATCH-3PC');
    assert.equal(packing.available, 100);
    const [secondLot] = await engine.assignPackingBulk([{ batchId: 'BATCH-3PC', quantity: 100, worker: 'Packer', deliveryDate: deadline }]);
    await engine.editPackingLot(secondLot[0].packingLotId, 'completed', 100);
    await engine.passPackingLot(secondLot[0].packingLotId);

    // Packing damage repair stays in Packing as one 3-piece set lot.
    await engine.reassignDamage('packingData', firstLot[0].id);
    const packingRepair = engine.readState().packingData.filter(work => String(work.packingLotId).includes('-repair-'));
    assert.deepEqual(packingRepair.map(work => [work.stage, work.inputQty]), [['Packing', 10], ['Packing', 10], ['Packing', 10]]);
    await engine.editPackingLot(packingRepair[0].packingLotId, 'completed', 10);
    await engine.passPackingLot(packingRepair[0].packingLotId);

    // Bundling all lots, then Inventory holds exactly the 1000 ordered garments.
    for (const lot of engine.bundlingReady().filter(item => item.batchId === 'BATCH-3PC')) {
        const row = await engine.assignBundling({ packingLotId: lot.packingLotId, worker: 'Bundler', deliveryDate: deadline });
        await engine.editBundling(row.id, row.quantity);
        await engine.passBundling(row.id);
    }
    const inventory = engine.readState().inventoryData.filter(row => row.batchId === 'BATCH-3PC');
    assert.deepEqual(inventory.map(row => row.quantity).sort((a, b) => a - b), [10, 100, 890]);
    assert.equal(inventory.reduce((sum, row) => sum + row.quantity, 0), 1000);
    assert.equal(engine.damageRepairs().length, 0);
    assertConservation(engine);
});

test('passing Cutting items one by one (Auto Pass) still sends only paired good garments onward', async () => {
    const route = Production.buildRoute({ additionalWorks: [{ workType: 'Embroidery', stage: 'After Cutting' }] });
    const p = { id: 1, batchId: 'B-PAIR', pieceNumber: 1, pieceItem: 'Pant', quantity: 1000, route,
        currentStage: { ...route[0], routeIndex: 0 }, stageBalances: { Cutting: { inputQty: 1000 } }, stageHistory: [],
        cuttingComponents: [{ id: 'cotton', name: 'Cotton', available: true }, { id: 'satin', name: 'Satin', available: true }] };
    const engine = Production.createEngine(new MemoryStorage({ approvedPool: [p], approvedBatchData: [{ batchId: 'B-PAIR', pieces: [{ number: 1, item: 'Pant' }] }] }), locks);
    const rows = await engine.assign('cuttingData', p.cuttingComponents.map(component => ({ poolId: 1, componentId: component.id,
        splitGroupId: 'g1', subBatch: 'B-PAIR-C1', quantity: 1000, worker: 'Cutter', deliveryDate: deadline })));
    // Both items are damaged in the same edit: pairing must not double the damage.
    await engine.edit('cuttingData', rows.map(work => ({ id: work.id, addCompleted: 800, addDamage: 200 })));
    assert.deepEqual(engine.readState().cuttingData.map(work => work.damageQty), [200, 200]);
    await engine.pass('cuttingData', rows.map(work => work.id));
    assert.equal(engine.views('additionalWorkData').pool[0].quantity, 800);
    // Recovering one damaged item recovers its pair.
    await engine.recoverRepair('cuttingData', rows[0].id, 50);
    assert.deepEqual(engine.readState().cuttingData.map(work => work.damageQty), [150, 150]);
});

test('older saved over-assignments still load and other pieces keep working', async () => {
    const route = Production.buildRoute({ additionalWorks: [{ workType: 'Embroidery', stage: 'After Cutting' }] });
    const branchIndex = route.findIndex(step => step.stage === 'Embroidery');
    const pools = [1, 2].map(id => ({ id, batchId: 'B-OLD', pieceNumber: id, pieceItem: id === 1 ? 'Pant' : 'Shirt', quantity: 1000, route: structuredClone(route),
        currentStage: { ...route[branchIndex], routeIndex: branchIndex },
        stageBalances: { Cutting: { inputQty: 1000 }, Embroidery: { inputQty: 800 } },
        branchBalances: { 'cutting-to-stitching': { Embroidery: { inputQty: 800 } } }, stageHistory: [] }));
    const engine = Production.createEngine(new MemoryStorage({
        approvedPool: pools,
        approvedBatchData: [{ batchId: 'B-OLD', pieces: [{ number: 1, item: 'Pant' }, { number: 2, item: 'Shirt' }] }],
        // Saved by the old math: 1000 assigned although Cutting passed only 800.
        additionalWorkData: [{ id: 1, poolId: 1, batchId: 'B-OLD', pieceNumber: 1, stage: 'Embroidery', workType: 'Embroidery', routeOrder: branchIndex,
            inputQty: 1000, assignedQty: 1000, completedQty: 1000, damageQty: 0, passedQty: 0, worker: 'W', deliveryDate: deadline }]
    }), locks);
    const [shirtWork] = await engine.assign('additionalWorkData', [{ poolId: 2, workType: 'Embroidery', routeOrder: branchIndex, quantity: 800, worker: 'W', deliveryDate: deadline }]);
    await engine.edit('additionalWorkData', [{ id: shirtWork.id, completedQty: 800 }]);
    await engine.pass('additionalWorkData', [1, shirtWork.id]);
    const stitching = engine.views('stitchingData').pool;
    assert.deepEqual(stitching.map(view => view.quantity), [800, 800], 'Stitching never receives more than Cutting released');
});
