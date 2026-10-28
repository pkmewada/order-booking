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

test('Pant, Shirt and Jacket fan out and unlock Stitching independently per piece', async () => {
    const itemNames = ['Pant', 'Shirt', 'Jacket'];
    const workNames = ['Embroidery', 'Hand Work', 'Digital Print'];
    const branchKeys = ['addWork_embroidery', 'addWork_hand_work', 'addWork_digital_print'];
    const route = Production.buildRoute({
        additionalWorks: workNames.map(workType => ({ workType, stage: 'After Cutting' }))
    });
    // Existing catalog rows have appeared with inconsistent capitalization.
    route.find(step => step.branch === 'B').stage = 'Hand work';
    route.find(step => step.branch === 'B').works = ['Hand work'];
    route.find(step => step.branch === 'C').stage = 'Digital print';
    route.find(step => step.branch === 'C').works = ['Digital print'];

    const pools = itemNames.map((pieceItem, index) => ({
        id: index + 1,
        batchId: 'BATCH-THREE-PIECES',
        pieceNumber: index + 1,
        pieceItem,
        brand: 'TEST',
        designNumber: '100',
        color: 'Black',
        quantity: 100,
        route: structuredClone(route),
        currentStage: { type: 'cutting', stage: 'Cutting' },
        stageBalances: { Cutting: { inputQty: 100 } },
        stageHistory: []
    }));
    const cuttingRows = pools.map((pool, index) => ({
        id: index + 1,
        poolId: pool.id,
        batchId: pool.batchId,
        pieceNumber: pool.pieceNumber,
        pieceType: `Piece ${pool.pieceNumber} (${pool.pieceItem})`,
        stage: 'Cutting',
        inputQty: 100,
        assignedQty: 100,
        completedQty: 100,
        damageQty: 0,
        passedQty: 0,
        worker: 'Cutting worker',
        deliveryDate: '2026-10-27'
    }));
    const storage = new MemoryStorage({
        approvedPool: pools,
        approvedBatchData: [{
            batchId: 'BATCH-THREE-PIECES',
            pieces: itemNames.map((item, index) => ({ number: index + 1, item, approval: {} }))
        }],
        cuttingData: cuttingRows
    });
    const engine = Production.createEngine(storage, { request: (_name, _opts, action) => action() });

    await engine.pass('cuttingData', cuttingRows.map(row => row.id));

    const branchAssignments = {};
    for (const [index, key] of branchKeys.entries()) {
        const available = engine.views(key).pool;
        assert.equal(available.length, 3, `${workNames[index]} receives every garment piece`);
        assert.deepEqual(available.map(pool => pool.quantity), [100, 100, 100]);
        branchAssignments[key] = await engine.assign(key, available.map(pool => ({
            poolId: pool.id,
            quantity: 100,
            worker: `${workNames[index]} worker`,
            deliveryDate: '2026-10-27'
        })));
        await engine.edit(key, branchAssignments[key].map(work => ({ id: work.id, completedQty: 100 })));
    }

    // Embroidery is passed for all three. Piece 2 and 3 have their remaining
    // branches passed; Piece 1 must stay locked until its own branches pass.
    await engine.pass('addWork_embroidery', branchAssignments.addWork_embroidery.map(work => work.id));
    await engine.pass('addWork_hand_work', branchAssignments.addWork_hand_work.slice(1).map(work => work.id));
    await engine.pass('addWork_digital_print', branchAssignments.addWork_digital_print.slice(1).map(work => work.id));

    let stitching = engine.views('stitchingData').pool;
    assert.deepEqual(stitching.map(pool => pool.stageEnabled), [false, true, true]);
    assert.deepEqual(stitching.map(pool => pool.quantity), [0, 100, 100]);
    await assert.rejects(
        engine.assign('stitchingData', [{ poolId: 1, quantity: 100, worker: 'Stitching worker', deliveryDate: '2026-10-27' }]),
        /Stitching is locked/
    );

    await engine.pass('addWork_hand_work', [branchAssignments.addWork_hand_work[0].id]);
    stitching = engine.views('stitchingData').pool;
    assert.deepEqual(stitching.map(pool => pool.stageEnabled), [false, true, true]);
    assert.equal(stitching[0].waitingForAdditionalWorks[0], 'Digital Print (100 C)');

    await engine.pass('addWork_digital_print', [branchAssignments.addWork_digital_print[0].id]);
    stitching = engine.views('stitchingData').pool;
    assert.deepEqual(stitching.map(pool => pool.stageEnabled), [true, true, true]);
    assert.deepEqual(stitching.map(pool => pool.quantity), [100, 100, 100]);
    assert.deepEqual(stitching.map(pool => pool.pieceItem), itemNames);

    const stitchingAssignments = await engine.assign('stitchingData', stitching.map(pool => ({
        poolId: pool.id, quantity: 100, worker: 'Stitching worker', deliveryDate: '2026-10-27'
    })));
    await engine.edit('stitchingData', stitchingAssignments.map(work => ({ id: work.id, completedQty: 100 })));
    await engine.pass('stitchingData', stitchingAssignments.map(work => work.id));
    let ironing = engine.views('ironingData').pool;
    assert.deepEqual(ironing.map(pool => pool.pieceItem), itemNames);
    assert.deepEqual(ironing.map(pool => pool.quantity), [100, 100, 100]);

    const ironingAssignments = await engine.assign('ironingData', ironing.map(pool => ({
        poolId: pool.id, quantity: 100, worker: 'Ironing worker', deliveryDate: '2026-10-27'
    })));
    await engine.edit('ironingData', ironingAssignments.map(work => ({ id: work.id, completedQty: 100 })));
    await engine.pass('ironingData', ironingAssignments.map(work => work.id));
    const packingReceipts = engine.readState().packingPool;
    assert.equal(packingReceipts.length, 3);
    assert.deepEqual(packingReceipts.map(row => row.pieceNumber), [1, 2, 3]);
    assert.deepEqual(packingReceipts.map(row => row.inputQty), [100, 100, 100]);
});

test('already-passed lowercase legacy branches restore the missing Stitching receipt', () => {
    const route = Production.buildRoute({ additionalWorks: [
        { workType: 'Embroidery', stage: 'After Cutting' },
        { workType: 'Hand Work', stage: 'After Cutting' },
        { workType: 'Digital Print', stage: 'After Cutting' }
    ] });
    route.find(step => step.branch === 'B').stage = 'Hand work';
    route.find(step => step.branch === 'B').works = ['Hand work'];
    route.find(step => step.branch === 'C').stage = 'Digital print';
    route.find(step => step.branch === 'C').works = ['Digital print'];
    const pool = {
        id: 1, batchId: 'BATCH-LEGACY', pieceNumber: 1, pieceItem: 'Pant', quantity: 100,
        route, currentStage: { type: 'additional_work', stage: 'Embroidery', works: ['Embroidery'] },
        stageBalances: { Cutting: { inputQty: 100 }, Embroidery: { inputQty: 100 }, 'Hand work': { inputQty: 100 }, 'Digital print': { inputQty: 100 } },
        stitchingReleased: false, stageHistory: []
    };
    const stageRows = [
        ['addWork_embroidery', 'Embroidery'],
        ['addWork_hand_work', 'Hand work'],
        ['addWork_digital_print', 'Digital print']
    ];
    const seed = { approvedPool: [pool], approvedBatchData: [{ batchId: 'BATCH-LEGACY', pieces: [{ number: 1, item: 'Pant' }] }] };
    for (const [key, stage] of stageRows) seed[key] = [{
        id: 1, poolId: 1, batchId: 'BATCH-LEGACY', pieceNumber: 1, stage,
        inputQty: 100, assignedQty: 100, completedQty: 100, damageQty: 0, passedQty: 100
    }];
    const engine = Production.createEngine(new MemoryStorage(seed), { request: (_name, _opts, action) => action() });
    const stitching = engine.views('stitchingData').pool;
    assert.equal(stitching.length, 1);
    assert.equal(stitching[0].stageEnabled, true);
    assert.equal(stitching[0].quantity, 100);
    assert.equal(stitching[0].stitchingReleased, true);
});

test('three pieces pass five Cutting branches, then one sequential work after Stitching and Ironing', async () => {
    const itemNames = ['Pant', 'Shirt', 'Jacket'];
    const workKeys = ['addWork_embroidery', 'addWork_digital_print', 'addWork_screen_print', 'addWork_hand_work', 'addWork_peco'];
    const route = Production.buildRoute({ additionalWorks: [
        ...['Embroidery', 'Digital Print', 'Screen Print', 'Hand Work', 'Peco'].map(workType => ({ workType, stage: 'After Cutting' })),
        { workType: 'Peco', stage: 'After Stitching' },
        { workType: 'Hand Work', stage: 'After Ironing' }
    ] });
    assert.equal(route.filter(step => step.parallelGroup === 'cutting-to-stitching').length, 5);
    assert.equal(route.find(step => step.workIndex === 5).parallelGroup, undefined, 'Peco after Stitching is sequential');
    assert.equal(route.find(step => step.workIndex === 6).parallelGroup, undefined, 'Hand Work after Ironing is sequential');
    assert.throws(() => Production.buildRoute({ additionalWorks: [
        { workType: 'Peco', stage: 'After Stitching' }, { workType: 'Hand Work', stage: 'After Stitching' }
    ] }), /only one additional work after Stitching/i);
    const pools = itemNames.map((pieceItem, index) => ({
        id: index + 1, batchId: 'BATCH-THREE-PIECES', pieceNumber: index + 1, pieceItem,
        quantity: 100, route: structuredClone(route), currentStage: { type: 'cutting', stage: 'Cutting' },
        stageBalances: { Cutting: { inputQty: 100 } }, stageHistory: []
    }));
    const cuttingRows = pools.map(pool => ({
        id: pool.id, poolId: pool.id, batchId: pool.batchId, pieceNumber: pool.pieceNumber,
        stage: 'Cutting', inputQty: 100, assignedQty: 100, completedQty: 100, damageQty: 0, passedQty: 0,
        worker: 'Cutting worker', deliveryDate: '2026-10-27'
    }));
    const storage = new MemoryStorage({
        approvedPool: pools,
        approvedBatchData: [{ batchId: 'BATCH-THREE-PIECES', pieces: itemNames.map((item, index) => ({ number: index + 1, item })) }],
        cuttingData: cuttingRows
    });

    const engine = Production.createEngine(storage, { request: (_name, _opts, action) => action() });
    await engine.pass('cuttingData', cuttingRows.map(row => row.id));
    assert.equal(engine.views('ironingData').pool.length, 0, 'Ironing has no input before the Stitching work passes');

    for (const key of workKeys) {
        const poolViews = engine.views(key).pool;
        assert.equal(poolViews.length, 3, `${key} has one queue per garment piece`);
        assert.deepEqual(poolViews.map(pool => pool.quantity), [100, 100, 100], `${key} exposes only the active route occurrence quantity`);
        const assignments = await engine.assign(key, poolViews.map(pool => ({
            poolId: pool.id, quantity: 100, worker: `${key} worker`, deliveryDate: '2026-10-27'
        })));
        await engine.edit(key, assignments.map(work => ({ id: work.id, completedQty: 100 })));
        await engine.pass(key, assignments.map(work => work.id));
    }

    let stitching = engine.views('stitchingData').pool;
    assert.deepEqual(stitching.map(pool => pool.stageEnabled), [true, true, true]);
    const stitchingRows = await engine.assign('stitchingData', stitching.map(pool => ({
        poolId: pool.id, quantity: 100, worker: 'Stitching worker', deliveryDate: '2026-10-27'
    })));
    await engine.edit('stitchingData', stitchingRows.map(work => ({ id: work.id, completedQty: 100 })));
    await engine.pass('stitchingData', stitchingRows.map(work => work.id));

    let peco = engine.views('addWork_peco').pool;
    assert.deepEqual(peco.map(pool => pool.quantity), [100, 100, 100]);
    const pecoRows = await engine.assign('addWork_peco', peco.map(pool => ({
        poolId: pool.id, quantity: 100, worker: 'Peco after Stitching', deliveryDate: '2026-10-27'
    })));
    assert.deepEqual(pecoRows.map(work => work.parallelGroup), [null, null, null]);
    await engine.edit('addWork_peco', pecoRows.map(work => ({ id: work.id, completedQty: 100 })));
    await engine.pass('addWork_peco', pecoRows.map(work => work.id));

    const ironing = engine.views('ironingData').pool;
    assert.deepEqual(ironing.map(pool => pool.quantity), [100, 100, 100]);
    const ironingRows = await engine.assign('ironingData', ironing.map(pool => ({
        poolId: pool.id, quantity: 100, worker: 'Ironing worker', deliveryDate: '2026-10-27'
    })));
    await engine.edit('ironingData', ironingRows.map(work => ({ id: work.id, completedQty: 100 })));
    await engine.pass('ironingData', ironingRows.map(work => work.id));

    const handWork = engine.views('addWork_hand_work').pool;
    const handRows = await engine.assign('addWork_hand_work', handWork.map(pool => ({
        poolId: pool.id, quantity: 100, worker: 'Hand Work after Ironing', deliveryDate: '2026-10-27'
    })));
    assert.deepEqual(handRows.map(work => work.parallelGroup), [null, null, null]);
    await engine.edit('addWork_hand_work', handRows.map(work => ({ id: work.id, completedQty: 100 })));
    await engine.pass('addWork_hand_work', handRows.slice(0, 2).map(work => work.id));
    assert.equal(engine.readState().packingPool.length, 2, 'Packing receives only pieces whose final branches passed');
    await engine.pass('addWork_hand_work', [handRows[2].id]);

    const packingReceipts = engine.readState().packingPool;
    assert.equal(packingReceipts.length, 3);
    assert.deepEqual(packingReceipts.map(row => row.pieceNumber), [1, 2, 3]);
    assert.deepEqual(packingReceipts.map(row => row.inputQty), [100, 100, 100]);
});

test('the unified additional-work manager migrates legacy assignments and routes new catalog types', async () => {
    const embroideryRoute = [
        { type: 'cutting', stage: 'Cutting' },
        { type: 'additional_work', stage: 'Embroidery', works: ['Embroidery'] },
        { type: 'stitching', stage: 'Stitching' },
        { type: 'ironing', stage: 'Ironing' },
        { type: 'packing', stage: 'Packing' }
    ];
    const foilRoute = [
        { type: 'cutting', stage: 'Cutting' },
        { type: 'additional_work', stage: 'Foil Printing', works: ['Foil Printing'] },
        { type: 'stitching', stage: 'Stitching' },
        { type: 'ironing', stage: 'Ironing' },
        { type: 'packing', stage: 'Packing' }
    ];
    const storage = new MemoryStorage({
        approvedPool: [
            { id: 1, batchId: 'LEGACY', pieceNumber: 1, pieceItem: 'Shirt', quantity: 100, route: embroideryRoute,
                currentStage: { ...embroideryRoute[1], routeIndex: 1 }, stageBalances: { Cutting: { inputQty: 100 }, Embroidery: { inputQty: 100 } }, stageHistory: [] },
            { id: 2, batchId: 'DYNAMIC', pieceNumber: 1, pieceItem: 'Shirt', quantity: 100, route: foilRoute,
                currentStage: { ...foilRoute[1], routeIndex: 1 }, stageBalances: { Cutting: { inputQty: 100 }, 'Foil Printing': { inputQty: 100 } }, stageHistory: [] }
        ],
        approvedBatchData: [{ batchId: 'LEGACY', pieces: [{ number: 1 }] }, { batchId: 'DYNAMIC', pieces: [{ number: 1 }] }],
        addWork_embroidery: [{
            id: 7, poolId: 1, batchId: 'LEGACY', pieceNumber: 1, stage: 'Embroidery', routeOrder: 1,
            inputQty: 100, assignedQty: 100, completedQty: 0, damageQty: 0, passedQty: 0,
            worker: 'Embroidery worker', deliveryDate: '2026-10-28'
        }],
        addWork_embroidery_history: [{ id: 1, workId: 7, action: 'assigned', at: '2026-10-28, 10:00:00' }]
    });
    const remoteState = Object.fromEntries([...storage.data].map(([key, value]) => [key, JSON.parse(value)]));
    let remoteRevision = 1;
    const repository = {
        async load() { return { state: structuredClone(remoteState), revision: remoteRevision, initialized: true }; },
        async save(changes, revision) {
            assert.equal(revision, remoteRevision);
            Object.assign(remoteState, structuredClone(changes));
            return ++remoteRevision;
        }
    };
    const engine = Production.createEngine(storage, undefined, repository);
    await engine.initialize();

    const legacy = engine.readState();
    assert.equal(legacy.additionalWorkData.length, 1);
    assert.equal(legacy.additionalWorkData[0].workType, 'Embroidery');
    assert.equal(legacy.addWork_embroidery.length, 0);
    assert.equal(legacy.additionalWorkHistory[0].workId, legacy.additionalWorkData[0].id);
    assert.deepEqual(remoteState.addWork_embroidery, []);
    assert.equal(storage.getItem('addWork_embroidery'), null);
    assert.equal(storage.getItem('addWork_embroidery_history'), null);
    assert.deepEqual(engine.views('additionalWorkData').pool.map(pool => pool.workType), ['Embroidery', 'Foil Printing']);

    const [availableFoil] = engine.views('additionalWorkData').pool.filter(pool => pool.workType === 'Foil Printing');
    const [assignment] = await engine.assign('additionalWorkData', [{
        poolId: availableFoil.id, workType: availableFoil.workType, routeOrder: availableFoil.currentStage.routeIndex,
        quantity: 100, worker: 'Foil worker', deliveryDate: '2026-10-28'
    }]);
    assert.equal(assignment.workType, 'Foil Printing');
    await engine.edit('additionalWorkData', [{ id: assignment.id, completedQty: 100 }]);
    await engine.pass('additionalWorkData', [assignment.id]);

    const state = engine.readState();
    assert.equal(state.additionalWorkData.find(work => work.id === assignment.id).passedQty, 100);
    assert.equal(state.approvedPool.find(pool => pool.id === availableFoil.id).stageBalances.Stitching.inputQty, 100);
});
