// Parity: the unchanged browser rules (orderQuantities.js, dispatchFlow.js) and the PHP server rules
// must give identical results for the same orders. Needs only the PHP CLI.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, php } = require('./helpers/orders-env.cjs');

function browserRules() {
    const context = { window: {} };
    vm.createContext(context);
    for (const file of ['orderQuantities.js', 'dispatchFlow.js']) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js', file), 'utf8'), context);
    }
    return context.window;
}

const item = (barcode, brand, qty, extra = {}) => ({ barcode, brand, size: 'M', description: barcode, qty, ...extra });
const cases = [
    { name: 'brand set sizes and fallbacks', order: { id: 'A', items: [
        item('LD', 'LITTLE DOLLY', 3), item('AM', 'Amari', 2), item('NV', 'nivi blossom', 1), item('NVA', 'NIVI BLOSSOMA', 1),
        item('X1', 'Other', 2, { piecesPerSet: 6 }), item('X2', 'Other', 2, { pieceCount: 2 }), item('X3', 'Other', 2, { pieces: [1, 2, 3] }),
        item('X4', 'Other', 4), item('X5', 'Other', '3', { piecesPerSet: '2' }), item('X6', 'Other', 2.7, { piecesPerSet: 2.9 }),
    ] } },
    { name: 'scanned is capped and floored', order: { id: 'B', dispatchPassedAt: 'x', items: [
        item('LD', 'LITTLE DOLLY', 2, { dispatchScannedPieces: 25 }), item('AM', 'AMARI', 2, { dispatchScannedPieces: 4.8 }),
        item('NV', 'NIVI BLOSSOM', 1, { dispatchScannedPieces: -3 }),
    ] }, scan: 'NV', deliver: [2, 1, 0] },
    { name: 'legacy delivered order without batches', order: { id: 'C', dispatchPassedAt: 'x', deliveredAt: '2026-10-01T10:00:00.000Z', items: [
        item('LD', 'LITTLE DOLLY', 2, { dispatchScannedPieces: 10 }), item('AM', 'AMARI', 1, { dispatchScannedPieces: 3 }),
    ] }, scan: 'LD', deliver: [1, 0] },
    { name: 'empty batches array disables the legacy rule', order: { id: 'D', dispatchPassedAt: 'x', deliveredAt: '2026-10-01T10:00:00.000Z', deliveryBatches: [],
        items: [item('LD', 'LITTLE DOLLY', 2, { dispatchScannedPieces: 10 })] }, deliver: [2] },
    { name: 'partial delivery then completion', order: { id: 'E', dispatchPassedAt: 'x', deliveryBatches: [], items: [
        item('LD', 'LITTLE DOLLY', 3, { dispatchScannedPieces: 15, dispatchDeliveredPieces: 5 }), item('AM', 'AMARI', 2, { dispatchScannedPieces: 6 }),
    ] }, scan: 'AM', deliver: [2, 2] },
    { name: 'over-available delivery is rejected', order: { id: 'F', dispatchPassedAt: 'x', deliveryBatches: [], items: [
        item('LD', 'LITTLE DOLLY', 3, { dispatchScannedPieces: 7 }),
    ] }, deliver: [2] },
    { name: 'zero sets is rejected', order: { id: 'G', dispatchPassedAt: 'x', deliveryBatches: [], items: [item('LD', 'LITTLE DOLLY', 1, { dispatchScannedPieces: 5 })] }, deliver: [0] },
    { name: 'not passed to dispatch is rejected', order: { id: 'H', deliveryBatches: [], items: [item('LD', 'LITTLE DOLLY', 1, { dispatchScannedPieces: 5 })] }, deliver: [1] },
    { name: 'scan of unknown and of completed barcode', order: { id: 'I', dispatchPassedAt: 'x', deliveryBatches: [], items: [
        item('LD', 'LITTLE DOLLY', 1, { dispatchScannedPieces: 5 }), item('AM', 'AMARI', 1),
    ] }, scan: 'LD' },
    { name: 'scan after full delivery', order: { id: 'J', dispatchPassedAt: 'x', deliveryBatches: [{ id: 'b' }], items: [
        item('AM', 'AMARI', 1, { dispatchScannedPieces: 3, dispatchDeliveredPieces: 3 }),
    ] }, scan: 'AM' },
    { name: 'empty order', order: { id: 'K', items: [] }, scan: 'X' },
];

function jsResults(rules) {
    const Q = rules.OrderQuantities, F = rules.DispatchFlow;
    const summarize = order => ({
        items: (order.items || []).map(i => ({ perSet: Q.perSet(i), sets: Q.sets(i), pieces: Q.pieces(i), scanned: Q.scanned(i), checked: Q.checked(i),
            delivered: F.deliveredPieces(order, i), available: F.available(order, i) })),
        confirmed: F.confirmed(order), status: F.status(order),
    });
    return cases.map(c => {
        const result = { summary: summarize(c.order) };
        if ('scan' in c) {
            const copy = structuredClone(c.order);
            try {
                const scanned = F.scan(copy, c.scan);
                result.scan = { index: copy.items.indexOf(scanned), summary: summarize(copy), dispatchStatus: copy.dispatchStatus };
            } catch (error) { result.scan = { error: error.message }; }
        }
        if ('deliver' in c) {
            const copy = structuredClone(c.order);
            try {
                const batch = F.deliverPartial(copy, c.deliver);
                result.deliver = { delivered: copy.items.map(i => i.dispatchDeliveredPieces), batch: batch.items.map(i => [i.barcode, i.pieces, i.sets]),
                    dispatchStatus: copy.dispatchStatus, deliveryStatus: copy.deliveryStatus, confirmedAtSet: !!copy.dispatchConfirmedAt, summary: summarize(copy) };
            } catch (error) { result.deliver = { error: error.message }; }
        }
        return result;
    });
}

test('php -l passes for every Phase 1 PHP file', () => {
    for (const file of ['api/order-records.php', 'api/orders.php', 'api/delivery-pdf.php', 'cli/orders-admin.php', 'cli/dev-router.php',
        'tests/helpers/test-db.php', 'tests/helpers/rules.php',
        // Phase 2 (authentication)
        'includes/auth.php', 'includes/users.php', 'api/users.php', 'cli/users-admin.php', 'settings/users.php', 'login.php', 'logout.php', 'index.php',
        'includes/header.php', 'includes/header2.php', 'api/master-records.php', 'api/manufacturing-records.php', 'api/product-records.php',
        'api/manufacturing-state.php', 'api/patterns.php']) {
        const result = php(['-l', file]);
        assert.equal(result.code, 0, file + ': ' + result.stdout + result.stderr);
    }
});

test('PHP order rules match the browser rules for every fixture', () => {
    const output = php(['tests/helpers/rules.php'], { input: JSON.stringify(cases) });
    assert.equal(output.code, 0, output.stderr || output.stdout);
    const server = JSON.parse(output.stdout);
    const browser = jsResults(browserRules());
    cases.forEach((c, index) => assert.deepStrictEqual(server[index], JSON.parse(JSON.stringify(browser[index])), c.name));
});
