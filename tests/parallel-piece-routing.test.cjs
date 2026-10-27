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
