// Integration tests for SAP Phase 1 (orders, dispatch, delivery, PDFs, import, rollback).
// Uses ONLY a local *_test database (see helpers/orders-env.cjs) and php -S servers bound to 127.0.0.1.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const H = require('./helpers/orders-env.cjs');

const pdfDir = H.tempDir('order-pdfs-');
const env = { ...H.DEV_ENV, DELIVERY_PDF_DIR: pdfDir };
let servers = [];
let codes;
const S = () => servers[0];

async function create(items, extra = {}) {
    const response = await H.api(S(), { action: 'create', customerId: 'CUS1', existingCustomer: 'No', deliveryDate: '2026-12-01', items, ...extra });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body.data.order;
}
async function act(body, server = S()) { return H.api(server, body); }
async function reload(id) { return (await H.getOrders(S(), id)).body.data; }
async function passed(items) {
    const order = await create(items);
    assert.equal((await act({ action: 'passToDispatch', id: order.id })).status, 200);
    return reload(order.id);
}
async function scanAll(id, barcode, times) {
    for (let i = 0; i < times; i++) assert.equal((await act({ action: 'scan', id, barcode })).status, 200);
}
const pdfFiles = () => fs.readdirSync(pdfDir).filter(name => /^[a-f0-9]{32}\.pdf$/.test(name));

test.before(async () => {
    H.resetDatabase();
    codes = H.seedCatalog();
    servers = await H.startServers(4, { env });
});
test.after(() => { H.stopServers(servers); H.removeTempDirs(); });

test('APIs stay disabled (503) until the CLI migration is verified; migrate is idempotent', async () => {
    const before = await H.getOrders(S());
    assert.equal(before.status, 503);
    assert.match(before.body.message, /not migrated/);
    assert.equal(H.cli(['verify']).code, 1);
    const first = H.cli(['migrate']);
    assert.equal(first.code, 0, first.stderr);
    assert.match(first.stdout, /Verified and recorded/);
    const second = H.cli(['migrate']);
    assert.equal(second.code, 0, second.stderr);
    assert.match(second.stdout, /Already applied and verified/);
    assert.equal(H.cli(['verify']).code, 0);
    assert.match(H.cli(['status']).stdout, /applied {2}cli\/20261112_001_customer-orders\.sql/);
    assert.equal((await H.getOrders(S())).status, 200);
});

test('production mode fails closed: no unauthenticated access without the explicit dev switch', async () => {
    const variants = [{}, { APP_ENV: 'production', ORDERS_ALLOW_UNAUTHENTICATED_DEV: '1' }, { APP_ENV: 'development' }];
    for (const [index, extra] of variants.entries()) {
        const [server] = await H.startServers(1, { env: { DELIVERY_PDF_DIR: pdfDir, ...extra }, firstPort: 18090 + index });
        try {
            assert.equal((await H.getOrders(server)).status, 401, JSON.stringify(extra));
            assert.equal((await H.api(server, { action: 'create' })).status, 401);
            assert.equal((await fetch(server.base + '/api/delivery-pdf.php?batchId=x')).status, 401);
        } finally { H.stopServers([server]); }
    }
});

test('the dev switch works only under the built-in PHP server; outside development PDF storage must be configured', () => {
    // Full dev switch, but a SAPI other than cli-server (stands in for Apache/LiteSpeed with a stray SetEnv): still closed.
    const access = H.php(['-r', "require 'api/order-records.php'; ordersRequireAccess(); echo 'OPEN';"], { env: H.DEV_ENV });
    assert.match(access.stdout, /Login required/);
    assert.doesNotMatch(access.stdout, /OPEN/);
    // Without DELIVERY_PDF_DIR only development may use the in-project fallback folder.
    const storage = H.php(['-r', "require 'api/order-records.php'; try { ordersPdfDirectory(); echo 'FALLBACK'; } catch (OrderError $e) { echo $e->status, ' ', $e->getMessage(); }"],
        { env: { APP_ENV: 'production' } });
    assert.match(storage.stdout, /^503 PDF storage is not configured/);
    const orphans = H.cli(['orphans'], { APP_ENV: 'production' });
    assert.notEqual(orphans.code, 0);
    assert.match(orphans.stderr + orphans.stdout, /Set DELIVERY_PDF_DIR/);
    // A configured folder must exist and lie outside the project / web root (checked read-only; nothing is created).
    const check = dir => H.php(['-r', "require 'api/order-records.php'; try { ordersPdfDirectory(); echo 'OK'; } catch (OrderError $e) { echo $e->status; }"],
        { env: { APP_ENV: 'production', DELIVERY_PDF_DIR: dir } }).stdout;
    assert.equal(check(path.join(H.ROOT, 'storage')), '503', 'inside the project');
    assert.equal(check(path.join(H.ROOT, 'STORAGE') + path.sep), '503', 'inside the project, other case + trailing slash');
    assert.equal(check(path.join(pdfDir, 'does-not-exist')), '503', 'missing folder');
    assert.equal(check(pdfDir), 'OK', 'existing folder outside the project');
});

test('server and exception messages are shown as text, never as HTML, in SweetAlert2', () => {
    // SweetAlert2 renders the 2nd positional argument of Swal.fire(title, html, icon) and showValidationMessage() as HTML.
    for (const file of ['orderList', 'orderPunch', 'orderImport', 'delivery', 'dispatch', 'deliveryRecords']) {
        const source = fs.readFileSync(path.join(H.ROOT, 'assets', 'js', file + '.js'), 'utf8');
        assert.doesNotMatch(source, /Swal\.fire\(\s*'[^']*'\s*,\s*[^'\s]/, file + ': positional Swal.fire with a non-literal message');
        assert.doesNotMatch(source, /showValidationMessage\((?!esc\()/, file + ': unescaped showValidationMessage');
        assert.doesNotMatch(source, /\bhtml\s*:/, file + ': html option');
    }
});

test('create validates on the server and snapshots customer and products from the database', async () => {
    const bad = [
        [{ customerId: 'NOPE' }, /Customer not found/],
        [{ items: [{ barcode: 'Ld-999-Red-18-26', qty: 1 }] }, /not in the product list/],
        [{ items: [{ barcode: codes.ld101, qty: 0 }] }, /whole number/],
        [{ items: [{ barcode: codes.ld101, qty: 1.5 }] }, /whole number/],
        [{ items: [{ barcode: codes.ld101, qty: 100001 }] }, /whole number/],
        [{ items: [{ barcode: codes.ld101, qty: 1 }, { barcode: codes.ld101, qty: 2 }] }, /appears twice/],
        [{ items: [] }, /at least one product/],
        [{ deliveryDate: '2026-02-30' }, /valid delivery date/],
        [{ existingCustomer: 'Maybe' }, /existing customer/],
    ];
    for (const [patch, message] of bad) {
        const response = await act({ action: 'create', customerId: 'CUS1', existingCustomer: 'No', deliveryDate: '2026-12-01', items: [{ barcode: codes.ld101, qty: 1 }], ...patch });
        assert.equal(response.status, 422, JSON.stringify(patch));
        assert.match(response.body.message, message);
    }
    const tooMany = Array.from({ length: 501 }, (_, i) => ({ barcode: 'B' + i, qty: 1 }));
    assert.equal((await act({ action: 'create', customerId: 'CUS1', deliveryDate: '2026-12-01', items: tooMany })).status, 422);
    const order = await create([{ barcode: codes.ld101, qty: 2 }, { barcode: codes.am102, qty: 3 }], { customerName: 'Injected' });
    assert.match(order.id, /^ORD\d{13}$/);
    assert.equal(order.customerName, 'Asha');
    assert.equal(order.shopName, 'Asha Store');
    assert.equal(order.agentName, 'Agent One');
    assert.equal(order.transportName, 'Fast Transport');
    assert.equal(order.status, 'Active');
    assert.deepEqual(order.items.map(i => [i.barcode, i.description, i.brand, i.size, i.piecesPerSet, i.qty]),
        [[codes.ld101, '101', 'LITTLE DOLLY', '18-26', 5, 2], [codes.am102, '102', 'AMARI', 'S-L', 3, 3]]);
    assert.equal(order.totalSets, 5);
    assert.equal(order.totalPcs, 19);
    assert.deepEqual(order.deliveryBatches, []);
    assert.match(order.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('D1: edit, status change and delete only before Pass to Dispatch; versions block stale pages', async () => {
    const order = await create([{ barcode: codes.ld101, qty: 1 }]);
    const stale = await act({ action: 'update', id: order.id, version: order.version + 5, customerId: 'CUS1', deliveryDate: '2026-12-02', items: [{ barcode: codes.ld101, qty: 4 }] });
    assert.equal(stale.status, 409);
    const updated = await act({ action: 'update', id: order.id, version: order.version, customerId: 'CUS1', existingCustomer: 'Yes', deliveryDate: '2026-12-02', items: [{ barcode: codes.ld101, qty: 4 }] });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.order.items[0].qty, 4);
    assert.equal(updated.body.data.order.existingCustomer, 'Yes');
    assert.ok(updated.body.data.order.updatedAt);
    const toggled = await act({ action: 'setStatus', id: order.id, version: updated.body.data.order.version, status: 'Inactive' });
    assert.equal(toggled.body.data.order.status, 'Inactive');
    assert.equal((await act({ action: 'setStatus', id: order.id, version: toggled.body.data.order.version, status: 'Closed' })).status, 422);

    const first = await act({ action: 'passToDispatch', id: order.id });
    const again = await act({ action: 'passToDispatch', id: order.id });
    assert.equal(first.body.data.order.dispatchPassedAt, again.body.data.order.dispatchPassedAt, 'first timestamp is kept');
    const current = again.body.data.order;
    for (const body of [
        { action: 'update', id: order.id, version: current.version, customerId: 'CUS1', deliveryDate: '2026-12-02', items: [{ barcode: codes.ld101, qty: 1 }] },
        { action: 'setStatus', id: order.id, version: current.version, status: 'Active' },
        { action: 'delete', id: order.id, version: current.version },
    ]) {
        const response = await act(body);
        assert.equal(response.status, 409, body.action);
        assert.match(response.body.message, /passed to Dispatch/);
    }
    const removable = await create([{ barcode: codes.am102, qty: 1 }]);
    assert.equal((await act({ action: 'delete', id: removable.id, version: removable.version })).status, 200);
    assert.equal((await H.getOrders(S(), removable.id)).status, 404);
});

test('scan, Replace and pass-to-delivery follow the existing dispatch rules on the server', async () => {
    const draft = await create([{ barcode: codes.ld101, qty: 3 }]);
    const early = await act({ action: 'scan', id: draft.id, barcode: codes.ld101 });
    assert.equal(early.status, 422);
    assert.match(early.body.message, /Pass this order from Order List first/);
    const order = await passed([{ barcode: codes.ld101, qty: 3 }, { barcode: codes.am102, qty: 1 }]);
    assert.match((await act({ action: 'scan', id: order.id, barcode: 'UNKNOWN' })).body.message, /not in the selected order/);
    await scanAll(order.id, codes.ld101, 10);
    let current = await reload(order.id);
    assert.equal(current.items[0].dispatchScannedPieces, 10);
    assert.equal(current.dispatchStatus, 'In Progress');

    const tooMany = await act({ action: 'deliverPartial', id: order.id, version: current.version, lines: [{ itemId: current.items[0].id, sets: 3 }] });
    assert.equal(tooMany.status, 422);
    assert.match(tooMany.body.message, /available scanned quantity/);
    assert.equal((await act({ action: 'deliverPartial', id: order.id, version: current.version, lines: [{ itemId: current.items[0].id, sets: 0 }] })).status, 422);
    assert.equal((await act({ action: 'deliverPartial', id: order.id, version: current.version, lines: [{ itemId: 999999, sets: 1 }] })).status, 409);
    const delivered = await act({ action: 'deliverPartial', id: order.id, version: current.version, lines: [{ itemId: current.items[0].id, sets: 1 }] });
    assert.equal(delivered.status, 200, JSON.stringify(delivered.body));
    current = delivered.body.data.order;
    const batch = current.deliveryBatches[0];
    assert.equal(batch.id, delivered.body.data.result.batchId);
    assert.match(batch.id, new RegExp(`^DLV-${order.id}-\\d{13}$`));
    assert.deepEqual(batch.items.map(i => [i.barcode, i.sets, i.pieces]), [[codes.ld101, 1, 5]]);
    assert.equal(current.items[0].dispatchDeliveredPieces, 5);
    assert.equal(current.deliveryStatus, 'In Progress');
    assert.equal(batch.pdf, null);
    const replay = await act({ action: 'deliverPartial', id: order.id, version: order.version + 10, lines: [{ itemId: current.items[0].id, sets: 1 }] });
    assert.equal(replay.status, 409, 'a stale or repeated request is rejected');

    // Replace: 1 set already passed stays on the old line; the remaining 2 sets move to the new design.
    assert.match((await act({ action: 'replaceItem', id: order.id, version: current.version, itemId: current.items[0].id, productBarcode: codes.am102 })).body.message, /already selected/);
    assert.match((await act({ action: 'replaceItem', id: order.id, version: current.version, itemId: current.items[0].id, productBarcode: 'Ld-999-X-1' })).body.message, /Product changed or removed/);
    const replaced = await act({ action: 'replaceItem', id: order.id, version: current.version, itemId: current.items[0].id, productBarcode: codes.ld104 });
    assert.equal(replaced.status, 200, JSON.stringify(replaced.body));
    current = replaced.body.data.order;
    assert.deepEqual(current.items.map(i => [i.barcode, i.qty, i.dispatchScannedPieces, i.dispatchDeliveredPieces]),
        [[codes.ld101, 1, 5, 5], [codes.ld104, 2, 0, 0], [codes.am102, 1, 0, 0]]);
    assert.equal(current.totalSets, 4);
    await scanAll(order.id, codes.ld104, 10);
    await scanAll(order.id, codes.am102, 3);
    current = await reload(order.id);
    const done = await act({ action: 'deliverPartial', id: order.id, version: current.version,
        lines: [{ itemId: current.items[1].id, sets: 2 }, { itemId: current.items[2].id, sets: 1 }] });
    assert.equal(done.status, 200);
    assert.equal(done.body.data.order.dispatchStatus, 'Completed');
    assert.ok(done.body.data.order.dispatchConfirmedAt);
    assert.match((await act({ action: 'scan', id: order.id, barcode: codes.ld104 })).body.message, /already been confirmed/);
});

test('concurrency a: 30 simultaneous scans on a 10-piece line record exactly 10', async () => {
    const order = await passed([{ barcode: codes.ld101, qty: 2 }]);
    const responses = await Promise.all(Array.from({ length: 30 }, (_, i) => act({ action: 'scan', id: order.id, barcode: codes.ld101 }, servers[i % 4])));
    const statuses = responses.map(r => r.status);
    assert.equal(statuses.filter(s => s === 200).length, 10, statuses.join(','));
    assert.equal(statuses.filter(s => s === 422).length, 20, statuses.join(','));
    assert.deepEqual(H.sql('SELECT dispatchScannedPieces AS n FROM customerOrderItems WHERE orderId = ?', [order.id]), [{ n: 10 }]);
});

test('concurrency b: simultaneous scans across three lines lose no update', async () => {
    const order = await passed([{ barcode: codes.ld101, qty: 2 }, { barcode: codes.am102, qty: 3 }, { barcode: codes.nv103, qty: 2 }]);
    const scans = [...Array(10).fill(codes.ld101), ...Array(9).fill(codes.am102), ...Array(8).fill(codes.nv103)].sort(() => Math.random() - 0.5);
    const responses = await Promise.all(scans.map((barcode, i) => act({ action: 'scan', id: order.id, barcode }, servers[i % 4])));
    assert.ok(responses.every(r => r.status === 200), responses.map(r => r.status).join(','));
    const rows = H.sql('SELECT barcode, dispatchScannedPieces AS n FROM customerOrderItems WHERE orderId = ? ORDER BY sortOrder', [order.id]);
    assert.deepEqual(rows.map(r => r.n), [10, 9, 8]);
});

test('concurrency c and d: duplicate delivery requests create exactly one batch; over-delivery is refused', async () => {
    const order = await passed([{ barcode: codes.ld101, qty: 2 }]);
    await scanAll(order.id, codes.ld101, 10);
    const current = await reload(order.id);
    const body = { action: 'deliverPartial', id: order.id, version: current.version, lines: [{ itemId: current.items[0].id, sets: 2 }] };
    const statuses = (await Promise.all(Array.from({ length: 8 }, (_, i) => act(body, servers[i % 4])))).map(r => r.status).sort();
    assert.deepEqual(statuses, [200, 409, 409, 409, 409, 409, 409, 409]);
    assert.equal(H.sql('SELECT COUNT(*) AS n FROM deliveryBatches WHERE orderId = ?', [order.id])[0].n, 1);
    assert.equal(H.sql('SELECT dispatchDeliveredPieces AS n FROM customerOrderItems WHERE orderId = ?', [order.id])[0].n, 10);
    const fresh = await reload(order.id);
    const over = await act({ action: 'deliverPartial', id: order.id, version: fresh.version, lines: [{ itemId: fresh.items[0].id, sets: 1 }] });
    assert.equal(over.status, 422, 'correct version, but nothing left to deliver');
});

test('concurrency e: two simultaneous PDF passes on one delivery store exactly one file', async () => {
    const order = await passed([{ barcode: codes.am102, qty: 1 }]);
    await scanAll(order.id, codes.am102, 3);
    let current = await reload(order.id);
    current = (await act({ action: 'deliverPartial', id: order.id, version: current.version, lines: [{ itemId: current.items[0].id, sets: 1 }] })).body.data.order;
    const batchId = current.deliveryBatches[0].id;
    const before = pdfFiles().length;
    const statuses = (await Promise.all([H.uploadPdf(servers[0], batchId, H.pdfBytes()), H.uploadPdf(servers[1], batchId, H.pdfBytes()),
        H.uploadPdf(servers[2], batchId, H.pdfBytes())])).map(r => r.status).sort();
    assert.deepEqual(statuses, [200, 409, 409]);
    assert.equal(pdfFiles().length, before + 1, 'losing uploads removed their files');
});

test('concurrency f: simultaneous creates get unique IDs; a taken order number is skipped', async () => {
    const before = H.sql('SELECT COUNT(*) AS n FROM customerOrders')[0].n;
    const created = await Promise.all(Array.from({ length: 20 }, (_, i) =>
        act({ action: 'create', customerId: 'CUS1', deliveryDate: '2026-12-01', items: [{ barcode: codes.ld101, qty: 1 }] }, servers[i % 4])));
    assert.ok(created.every(r => r.status === 200), created.map(r => r.status).join(','));
    assert.equal(new Set(created.map(r => r.body.data.order.id)).size, 20);
    assert.equal(H.sql('SELECT COUNT(*) AS n FROM customerOrders')[0].n, before + 20);

    let exercised = false;
    for (let attempt = 0; attempt < 5 && !exercised; attempt++) {
        const start = Date.now() + 400;
        const values = Array.from({ length: 45 }, (_, i) => `('ORD${start + i}', NOW(3))`).join(',');
        H.sql(`INSERT INTO customerOrders (id, createdAt) VALUES ${values}`);
        while (Date.now() < start + 2) await new Promise(resolve => setTimeout(resolve, 1));
        const order = await create([{ barcode: codes.ld101, qty: 1 }]);
        const base = Date.parse(order.createdAt);
        const expected = base >= start && base < start + 45 ? start + 45 : base;
        assert.equal(order.id, 'ORD' + expected);
        exercised = base >= start && base < start + 45;
        H.sql(`DELETE FROM customerOrders WHERE id IN (${Array.from({ length: 45 }, (_, i) => `'ORD${start + i}'`).join(',')})`);
    }
    assert.ok(exercised, 'the collision path was exercised');
});

test('PDF security: upload checks, private download headers, one pass per delivery, orphan clean-up', async () => {
    const order = await passed([{ barcode: codes.ld101, qty: 3 }]);
    await scanAll(order.id, codes.ld101, 15);
    let current = await reload(order.id);
    for (const sets of [1, 1, 1]) {
        current = (await act({ action: 'deliverPartial', id: order.id, version: current.version, lines: [{ itemId: current.items[0].id, sets }] })).body.data.order;
    }
    const [b1, b2, b3] = current.deliveryBatches.map(b => b.id);
    const checks = [
        [H.pdfBytes(10 * 1024 * 1024 + 1), {}, 413],
        [Buffer.from('hello, not a pdf'), { name: 'fake.pdf' }, 422],
        [Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2000)]), { name: 'image.pdf' }, 422],
        [Buffer.alloc(0), {}, 422],
    ];
    for (const [bytes, options, status] of checks) {
        const response = await H.uploadPdf(S(), b1, bytes, options);
        assert.equal(response.status, status, response.body.message);
    }
    assert.equal((await H.uploadPdf(S(), b1, null)).status, 422, 'no file');
    assert.equal((await H.uploadPdf(S(), 'DLV-NOPE', H.pdfBytes())).status, 404);
    assert.equal((await fetch(S().base + '/api/delivery-pdf.php?batchId=' + b1)).status, 404, 'no PDF yet');

    const bytes = H.pdfBytes(10 * 1024 * 1024);
    const ok = await H.uploadPdf(S(), b1, bytes, { name: 'Proof <1>.pdf' });
    assert.equal(ok.status, 200, ok.body.message);
    const stored = ok.body.data.order.deliveryBatches.find(b => b.id === b1);
    assert.deepEqual([stored.status, stored.pdf.state, stored.pdf.name, stored.pdf.size], ['Success', 'stored', 'Proof _1_.pdf', bytes.length]);
    assert.equal(ok.body.data.order.deliveryStatus, 'In Progress', 'other deliveries still open');
    assert.equal((await H.uploadPdf(S(), b1, H.pdfBytes())).status, 409, 'already passed');
    assert.equal((await H.uploadPdf(S(), b2, H.pdfBytes(), { mode: 'import' })).status, 409, 'import only for missing PDFs');

    const download = await fetch(S().base + '/api/delivery-pdf.php?batchId=' + encodeURIComponent(b1));
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('content-type'), 'application/pdf');
    assert.match(download.headers.get('content-disposition'), /^attachment; filename="Proof _1_\.pdf"/);
    assert.equal(download.headers.get('cache-control'), 'private, no-store, max-age=0');
    assert.equal(download.headers.get('pragma'), 'no-cache');
    assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(download.headers.get('content-security-policy'), "default-src 'none'; sandbox");
    assert.ok(Buffer.from(await download.arrayBuffer()).equals(bytes));

    assert.equal((await H.uploadPdf(S(), b2, H.pdfBytes())).status, 200);
    const last = await H.uploadPdf(S(), b3, H.pdfBytes());
    assert.equal(last.body.data.order.deliveryStatus, 'Success');

    const orphan = path.join(pdfDir, 'a'.repeat(32) + '.pdf');
    const young = path.join(pdfDir, 'b'.repeat(32) + '.pdf');
    fs.writeFileSync(orphan, H.pdfBytes());
    fs.writeFileSync(young, H.pdfBytes());
    const old = new Date(Date.now() - 2 * 3600 * 1000);
    fs.utimesSync(orphan, old, old);
    const referenced = pdfFiles().length;
    const listed = H.cli(['orphans'], { DELIVERY_PDF_DIR: pdfDir });
    assert.match(listed.stdout, /1 orphaned PDF file\(s\)\./);
    assert.ok(fs.existsSync(orphan), 'listing does not delete');
    const removed = H.cli(['orphans', '--delete'], { DELIVERY_PDF_DIR: pdfDir });
    assert.equal(removed.code, 0, removed.stderr);
    assert.ok(!fs.existsSync(orphan));
    assert.ok(fs.existsSync(young), 'files younger than 1 hour are kept');
    assert.equal(pdfFiles().length, referenced - 1);
    fs.unlinkSync(young);
});

test('import: idempotent, keeps IDs, reports conflicts and invalid data, never overwrites', async () => {
    const existing = await create([{ barcode: codes.ld101, qty: 1 }]);
    const legacyDelivered = { id: 'ORD1759300000000', status: 'Active', createdAt: '2026-10-01T06:40:00.000Z', customerId: 'OLD-1', customerName: 'Old Shop',
        shopName: 'Old Shop', deliveryDate: '2026-10-05', dispatchPassedAt: '2026-10-02T06:00:00.000Z', deliveredAt: '2026-10-03T06:00:00.000Z',
        items: [{ barcode: 'Ld-1-Red-18-26', itemDescription: 'Legacy Frock', brand: 'Little Dolly', size: '18-26', qty: 2, dispatchScannedPieces: 10, dispatchChecked: true }] };
    const withPdf = { id: 'ORD1759400000000', status: 'Inactive', createdAt: '2026-10-02T06:40:00.000Z', customerId: 'OLD-2', customerName: 'Pdf Shop', shopName: 'Pdf Shop',
        deliveryDate: '2026-10-06', dispatchPassedAt: '2026-10-02T07:00:00.000Z', deliveredAt: '2026-10-02T08:00:00.000Z', deliveryStatus: 'Success',
        items: [{ barcode: 'Am-2-Blue-S-L', description: '2', brand: 'AMARI', size: 'S-L', piecesPerSet: 3, qty: 2, dispatchScannedPieces: 6, dispatchDeliveredPieces: 3 }],
        deliveryBatches: [{ id: 'DLV-ORD1759400000000-1759400100000', createdAt: '2026-10-02T08:00:00.000Z', status: 'Success', completedAt: '2026-10-02T09:00:00.000Z',
            pdf: { key: 'idb-key', name: 'Signed.pdf', size: 1234, uploadedAt: '2026-10-02T09:00:00.000Z' },
            items: [{ barcode: 'Am-2-Blue-S-L', description: '2', brand: 'AMARI', size: 'S-L', piecesPerSet: 3, sets: 1, pieces: 3 }] }] };
    const conflicting = { ...legacyDelivered, id: existing.id };
    const payload = [legacyDelivered, withPdf, { status: 'Active', items: [] }, { id: 'ORD1', items: 'nope' }, conflicting];
    const first = (await act({ action: 'import', orders: payload })).body.data.results;
    assert.deepEqual(first.map(r => r.result), ['imported', 'imported', 'invalid', 'invalid', 'conflict']);
    assert.deepEqual(first[1].missingPdfBatches, ['DLV-ORD1759400000000-1759400100000']);
    assert.deepEqual(first[0].missingPdfBatches, []);

    const legacy = await reload(legacyDelivered.id);
    assert.equal(legacy.createdAt, legacyDelivered.createdAt);
    assert.equal(legacy.items[0].description, 'Legacy Frock');
    assert.equal(legacy.items[0].dispatchDeliveredPieces, 10, 'legacy delivered-without-batches rule kept');
    assert.deepEqual(legacy.deliveryBatches.map(b => [b.id, b.isLegacy, b.createdAt, b.items[0].pieces]),
        [['DLV-LEGACY-ORD1759300000000', true, '2026-10-03T06:00:00.000Z', 10]]);
    assert.equal(legacy.dispatchStatus, null);
    const pdfOrder = await reload(withPdf.id);
    assert.equal(pdfOrder.status, 'Inactive');
    assert.deepEqual(pdfOrder.deliveryBatches[0].pdf, { name: 'Signed.pdf', size: 1234, uploadedAt: '2026-10-02T09:00:00.000Z', state: 'missing' });
    assert.equal(H.sql('SELECT customerName FROM customerOrders WHERE id = ?', [existing.id])[0].customerName, 'Asha', 'conflict did not overwrite');

    const second = (await act({ action: 'import', orders: [legacyDelivered, withPdf] })).body.data.results;
    assert.deepEqual(second.map(r => r.result), ['alreadyImported', 'alreadyImported']);
    const changed = (await act({ action: 'import', orders: [{ ...legacyDelivered, customerName: 'Edited in another browser' }] })).body.data.results;
    assert.equal(changed[0].result, 'conflict');
    assert.equal((await reload(legacyDelivered.id)).customerName, 'Old Shop');

    // PDF import is tracked separately: a failed upload is retried without importing the order again.
    const batchId = withPdf.deliveryBatches[0].id;
    const importedAt = H.sql('SELECT importedAt FROM customerOrders WHERE id = ?', [withPdf.id])[0].importedAt;
    assert.equal((await H.uploadPdf(S(), batchId, Buffer.from('broken'), { mode: 'import' })).status, 422);
    assert.equal((await reload(withPdf.id)).deliveryBatches[0].pdf.state, 'missing');
    const retry = await H.uploadPdf(S(), batchId, H.pdfBytes(), { mode: 'import', name: 'whatever.pdf' });
    assert.equal(retry.status, 200, retry.body.message);
    const pdf = retry.body.data.order.deliveryBatches[0].pdf;
    assert.deepEqual([pdf.state, pdf.name, pdf.uploadedAt], ['stored', 'Signed.pdf', '2026-10-02T09:00:00.000Z']);
    assert.equal((await H.uploadPdf(S(), batchId, H.pdfBytes(), { mode: 'import' })).status, 409, 'a stored PDF is never replaced');
    assert.equal(H.sql('SELECT importedAt FROM customerOrders WHERE id = ?', [withPdf.id])[0].importedAt, importedAt);
    assert.equal(H.sql('SELECT COUNT(*) AS n FROM customerOrders WHERE id IN (?, ?)', [legacyDelivered.id, withPdf.id])[0].n, 2);

    // A missing PDF can also be filled manually (normal pass).
    const manual = { ...withPdf, id: 'ORD1759500000000', deliveryBatches: [{ ...withPdf.deliveryBatches[0], id: 'DLV-ORD1759500000000-1' }] };
    assert.equal((await act({ action: 'import', orders: [manual] })).body.data.results[0].result, 'imported');
    assert.equal((await H.uploadPdf(S(), 'DLV-ORD1759500000000-1', H.pdfBytes())).status, 200);
});

test('concurrency g: the same import from two browsers at once never duplicates', async () => {
    const order = { id: 'ORD1759600000000', createdAt: '2026-10-04T00:00:00.000Z', customerName: 'Twin', items: [{ barcode: 'X', brand: 'AMARI', qty: 1 }] };
    const results = await Promise.all(servers.map(server => act({ action: 'import', orders: [order] }, server)));
    const outcomes = results.map(r => r.body.data.results[0].result).sort();
    assert.deepEqual(outcomes, ['alreadyImported', 'alreadyImported', 'alreadyImported', 'imported']);
    assert.equal(H.sql('SELECT COUNT(*) AS n FROM customerOrderItems WHERE orderId = ?', [order.id])[0].n, 1);
});

function binDir() {
    const candidates = [process.env.MYSQL_BIN_DIR, 'C:/wamp64/bin/mariadb/mariadb11.4.9/bin'].filter(Boolean);
    return candidates.find(dir => fs.existsSync(path.join(dir, process.platform === 'win32' ? 'mysqldump.exe' : 'mysqldump')));
}
function normalizeExport(orders) {
    return orders.map(order => ({ ...order, version: 0, items: order.items.map(({ id, ...item }) => item),
        deliveryBatches: order.deliveryBatches.map(batch => ({ ...batch, items: batch.items.map(({ orderItemId, ...item }) => item) })) }));
}

test('rollback rehearsal: export, dump/drop/restore, down/migrate/restore all round-trip losslessly', async t => {
    const bin = binDir();
    if (!bin) { t.skip('NOT RUN: mysqldump not found (set MYSQL_BIN_DIR)'); return; }
    const config = H.testConfig();
    const exportA = path.join(H.tempDir('orders-export-'), 'A');
    const a = H.cli(['export', exportA], { DELIVERY_PDF_DIR: pdfDir });
    assert.equal(a.code, 0, a.stderr);
    const ordersA = JSON.parse(fs.readFileSync(path.join(exportA, 'orders.json'), 'utf8'));
    const manifestA = JSON.parse(fs.readFileSync(path.join(exportA, 'manifest.json'), 'utf8'));
    assert.ok(ordersA.length > 20 && Object.keys(manifestA.pdfs).length >= 6);

    // 1. Database backup and restore of the 4 tables.
    const dumpFile = path.join(path.dirname(exportA), 'orders.sql');
    const connection = ['-h', config.DB_HOST, '-P', config.DB_PORT, '-u', config.DB_USER, ...(config.DB_PASSWORD ? ['-p' + config.DB_PASSWORD] : [])];
    const dump = spawnSync(path.join(bin, 'mysqldump'), [...connection, '--single-transaction', '--result-file=' + dumpFile, config.DB_NAME,
        'customerOrders', 'customerOrderItems', 'deliveryBatches', 'deliveryBatchItems'], { encoding: 'utf8' });
    assert.equal(dump.status, 0, dump.stderr);
    assert.equal(H.cli(['down']).code, 0);
    assert.equal((await H.getOrders(S())).status, 503, 'APIs disabled while not migrated');
    const load = spawnSync(path.join(bin, 'mysql'), [...connection, config.DB_NAME], { input: fs.readFileSync(dumpFile), encoding: 'utf8' });
    assert.equal(load.status, 0, load.stderr);
    assert.equal(H.cli(['migrate']).code, 0);
    const exportB = path.join(path.dirname(exportA), 'B');
    assert.equal(H.cli(['export', exportB], { DELIVERY_PDF_DIR: pdfDir }).code, 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(exportB, 'orders.json'), 'utf8')), ordersA, 'dump restore is exact');

    // 2. Drop everything, migrate again and restore from the export (orders and PDFs).
    assert.equal(H.cli(['down']).code, 0);
    assert.equal(H.cli(['migrate']).code, 0);
    const restorePdfDir = H.tempDir('order-pdfs-restored-');
    const restored = H.cli(['restore', exportA], { DELIVERY_PDF_DIR: restorePdfDir });
    assert.equal(restored.code, 0, restored.stderr + restored.stdout);
    assert.match(restored.stdout, new RegExp(`${ordersA.length} imported, 0 already present, 0 conflicts, 0 invalid, ${Object.keys(manifestA.pdfs).length} PDFs restored`));
    const exportC = path.join(path.dirname(exportA), 'C');
    assert.equal(H.cli(['export', exportC], { DELIVERY_PDF_DIR: restorePdfDir }).code, 0);
    const ordersC = JSON.parse(fs.readFileSync(path.join(exportC, 'orders.json'), 'utf8'));
    assert.deepEqual(normalizeExport(ordersC), normalizeExport(ordersA), 'only version counters and internal line IDs differ');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(exportC, 'manifest.json'), 'utf8')).pdfs, manifestA.pdfs, 'PDF checksums match');
    const again = H.cli(['restore', exportA], { DELIVERY_PDF_DIR: restorePdfDir });
    assert.match(again.stdout, new RegExp(`0 imported, ${ordersA.length} already present`), 'restore is idempotent');
    assert.equal(H.cli(['restore', exportA + '-missing']).code, 1);

    // 3. The PRE-Phase-1 browser code (as committed on main, commit 6ee8500) can read the export,
    //    which is what a code rollback needs.
    const context = { window: {}, indexedDB: undefined };
    vm.createContext(context);
    for (const file of ['orderQuantities.js', 'dispatchFlow.js', 'deliveryRecords.js']) {
        const old = spawnSync('git', ['show', '6ee8500:assets/js/' + file], { cwd: H.ROOT, encoding: 'utf8' });
        assert.equal(old.status, 0, old.stderr);
        vm.runInContext(old.stdout, context);
    }
    context.DispatchFlow = context.window.DispatchFlow;
    context.OrderQuantities = context.window.OrderQuantities;
    for (const order of ordersA) {
        const totals = context.window.OrderQuantities.totals(order);
        assert.deepEqual([totals.sets, totals.pieces], [order.totalSets, order.totalPcs], order.id);
        const batches = context.window.DeliveryRecords.batches(order);
        assert.equal(batches.length, order.deliveryBatches.length, order.id);
        for (const batch of batches) assert.equal(context.window.DeliveryRecords.snapshot(order, batch).deliveryBatchId, batch.id);
    }
});

test('direct web access to private folders is denied', async t => {
    for (const blocked of ['/storage/delivery-pdfs/x.pdf', '/cli/orders-admin.php', '/database/order-booking.sql', '/tests/helpers/test-db.php']) {
        assert.equal((await fetch(S().base + blocked)).status, 403, 'php -S dev router: ' + blocked);
    }
    const apache = process.env.APACHE_BASE_URL || 'http://localhost/order-bookings';
    const probe = path.join(H.ROOT, 'storage', 'delivery-pdfs', 'probe-' + Date.now() + '.pdf');
    try {
        await fetch(apache + '/');
    } catch (_) { t.skip('NOT RUN: Apache not reachable at ' + apache); return; }
    fs.mkdirSync(path.dirname(probe), { recursive: true });
    fs.writeFileSync(probe, H.pdfBytes());
    try {
        for (const blocked of ['/storage/delivery-pdfs/' + path.basename(probe), '/storage/', '/cli/orders-admin.php', '/cli/dev-router.php', '/database/cli-migrations/20261112_001_customer-orders.sql']) {
            assert.equal((await fetch(apache + blocked)).status, 403, 'Apache: ' + blocked);
        }
    } finally { fs.unlinkSync(probe); }
});
