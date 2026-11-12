// Authentication and authorization (Phase 2). Real sessions over `php -S` WITHOUT the API test switch,
// on the local *_test database only (helpers/orders-env.cjs). Each client keeps its own cookies, like a browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers/orders-env.cjs');

const pdfDir = H.tempDir('auth-pdfs-');
const PASSWORDS = { admin: 'Admin-pass-123', staff: 'Staff-pass-123', other: 'Other-pass-123' };
let server, shortServer, codes;

function client(target = server) {
    const jar = new Map();
    let csrf = '';
    async function request(path, { method = 'GET', headers = {}, body, withCsrf = false } = {}) {
        const sent = { ...headers };
        if (jar.size) sent.cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
        if (withCsrf) sent['X-CSRF-Token'] = csrf;
        const response = await fetch(target.base + path, { method, headers: sent, body, redirect: 'manual' });
        for (const cookie of response.headers.getSetCookie()) {
            const pair = cookie.split(';')[0];
            const name = pair.slice(0, pair.indexOf('=')), value = pair.slice(pair.indexOf('=') + 1);
            if (/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(cookie) || value === 'deleted') jar.delete(name); else jar.set(name, value);
        }
        return response;
    }
    async function json(path, options = {}) {
        const response = await request(path, options);
        return { status: response.status, body: await response.json() };
    }
    function api(path, data, { withCsrf = true, method = 'POST' } = {}) {
        return json(path, { method, withCsrf, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    }
    async function formToken(path = '/login') {
        const html = await (await request(path)).text();
        return (html.match(/name="_csrf" value="([a-f0-9]{64})"/) || [])[1] || '';
    }
    async function login(username, password, token) {
        const form = new URLSearchParams({ username, password, _csrf: token ?? await formToken() });
        return request('/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    }
    // The CSRF token every signed-in page carries in <meta name="csrf-token">.
    async function loadCsrf(page = '/dashboard') {
        const html = await (await request(page)).text();
        csrf = (html.match(/<meta name="csrf-token" content="([a-f0-9]{64})">/) || [])[1] || '';
        return csrf;
    }
    return { request, json, api, login, loadCsrf, formToken, jar, setCsrf: value => { csrf = value; }, get csrf() { return csrf; } };
}

async function signedIn(username, password = PASSWORDS[username], target = server) {
    const c = client(target);
    const response = await c.login(username, password);
    assert.equal(response.status, 303, `sign-in of ${username}`);
    await c.loadCsrf();
    assert.ok(c.csrf, 'page carries a CSRF token');
    return c;
}

function createUser(username, role, password) {
    const result = H.php(['cli/users-admin.php', 'create', username, role, 'Name', username], { input: password + '\n' });
    assert.equal(result.code, 0, result.stderr + result.stdout);
}

test.before(async () => {
    H.resetDatabase();
    const migrated = H.cli(['migrate']);
    assert.equal(migrated.code, 0, migrated.stderr);
    codes = H.seedCatalog();
    createUser('admin', 'admin', PASSWORDS.admin);
    createUser('staff', 'employee', PASSWORDS.staff);
    // No API test switch here: these servers behave like the live site.
    [server] = await H.startServers(1, { env: { DELIVERY_PDF_DIR: pdfDir }, firstPort: 18101 });
    [shortServer] = await H.startServers(1, { env: { DELIVERY_PDF_DIR: pdfDir, AUTH_IDLE_SECONDS: '2' }, firstPort: 18102 });
});
test.after(() => { H.stopServers([server, shortServer]); H.removeTempDirs(); });

test('CLI: accounts are created with hashed passwords; short passwords and duplicate names are refused', () => {
    const rows = H.sql("SELECT username, role, passwordHash FROM appUsers ORDER BY username");
    assert.deepEqual(rows.map(row => `${row.username}:${row.role}`), ['admin:admin', 'staff:employee']);
    for (const row of rows) assert.match(row.passwordHash, /^\$2y\$/, 'bcrypt hash, never the plain password');
    assert.notEqual(H.php(['cli/users-admin.php', 'create', 'shorty', 'employee'], { input: 'short\n' }).code, 0);
    assert.notEqual(H.php(['cli/users-admin.php', 'create', 'staff', 'employee'], { input: 'Another-pass-1\n' }).code, 0);
    assert.match(H.php(['cli/users-admin.php', 'list']).stdout, /admin\s+admin\s+active/);
});

test('sign-in: valid credentials redirect and regenerate the session; invalid ones and missing CSRF are refused', async () => {
    const c = client();
    const token = await c.formToken();
    const before = c.jar.get('ORDERBOOKINGSESSID');
    assert.ok(before, 'the sign-in page starts a session for its CSRF token');

    const wrong = await c.login('staff', 'wrong-password', token);
    assert.equal(wrong.status, 401);
    assert.match(await wrong.text(), /Invalid username or password/);
    const unknown = await c.login('nobody', 'whatever-123', token);
    assert.match(await unknown.text(), /Invalid username or password/, 'same message for an unknown user');
    const noCsrf = await c.login('staff', PASSWORDS.staff, 'f'.repeat(64));
    assert.match(await noCsrf.text(), /sign-in form expired/);
    assert.equal((await c.json('/api/orders.php')).status, 401, 'still signed out');

    const ok = await c.login('staff', PASSWORDS.staff, token);
    assert.equal(ok.status, 303);
    assert.match(ok.headers.get('location'), /\/dashboard$/);
    assert.notEqual(c.jar.get('ORDERBOOKINGSESSID'), before, 'session ID regenerated at sign-in (no fixation)');
    assert.equal((await c.json('/api/orders.php')).status, 200);
    const cookie = (await client().request('/login')).headers.getSetCookie().join(';');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
});

test('unauthenticated: every API answers 401 and every page redirects to sign-in', async () => {
    const c = client();
    for (const path of ['/api/orders.php', '/api/delivery-pdf.php?batchId=x', '/api/customer.php', '/api/agent.php', '/api/product.php', '/api/bom.php',
        '/api/colour.php', '/api/employee.php', '/api/manufacturing-state.php', '/api/patterns.php', '/api/users.php']) {
        const response = await c.json(path);
        assert.equal(response.status, 401, path);
        assert.equal(response.body.loginRequired, true, path);
    }
    const create = await c.api('/api/orders.php', { action: 'create' }, { withCsrf: false });
    assert.equal(create.status, 401);
    const page = await c.request('/order-list');
    assert.equal(page.status, 303);
    assert.match(page.headers.get('location'), /\/login\?next=order-list$/);
    const direct = await c.request('/orderBooking/orderList.php');
    assert.equal(direct.status, 303, 'direct access to a page file also needs sign-in');
    assert.match(direct.headers.get('location'), /\/order-bookings\/login/);
    assert.equal((await c.request('/colour')).status, 303);
});

test('roles: employee works in Order Booking and Manufacturing; Settings, master changes and Users are admin-only', async () => {
    const staff = await signedIn('staff');
    const admin = await signedIn('admin');
    assert.equal((await staff.request('/order-list')).status, 200);
    assert.equal((await staff.request('/cutting-manager')).status, 200);
    assert.equal((await staff.request('/colour')).status, 403, 'Settings page');
    assert.equal((await staff.request('/users')).status, 403);
    assert.equal((await admin.request('/colour')).status, 200);
    assert.equal((await admin.request('/users')).status, 200);

    for (const path of ['/api/agent.php', '/api/customer.php', '/api/product.php', '/api/patterns.php', '/api/employee.php', '/api/manufacturing-state.php']) {
        assert.equal((await staff.json(path)).status, 200, 'employee reads ' + path);
    }
    assert.equal((await staff.json('/api/users.php')).status, 403);
    assert.equal((await staff.api('/api/agent.php', { name: 'X' })).status, 403, 'agent changes are admin-only');
    assert.equal((await staff.api('/api/patterns.php', { name: 'X' })).status, 403);
    assert.equal((await staff.api('/api/product.php', { brand: 'AMARI' })).status, 403);
    const colour = await staff.api('/api/colour.php', { name: 'Green' });
    assert.equal(colour.status, 201, 'BOM Master quick-add: employee may create a colour');
    assert.equal((await staff.api('/api/colour.php', { id: colour.body.data.id, name: 'Lime' }, { method: 'PUT' })).status, 403, '...but not rename it');
    assert.equal((await staff.api('/api/colour.php', { id: colour.body.data.id }, { method: 'DELETE' })).status, 403);
    assert.equal((await admin.api('/api/colour.php', { id: colour.body.data.id }, { method: 'DELETE' })).status, 200);
    const agent = await admin.api('/api/agent.php', { name: 'X' });
    assert.ok(![401, 403].includes(agent.status), 'admin passes authorization (validation may still reject the data)');
});

test('BOM endpoint: employee keeps BOM Master work but cannot make admin-only product changes; admin can do both', async () => {
    const staff = await signedIn('staff');
    const admin = await signedIn('admin');
    // BOM Master quick-add (separate APIs): employees and admins may add colours and items.
    const green = await staff.api('/api/colour.php', { name: 'Bom Green' });
    assert.equal(green.status, 201, 'employee adds a colour');
    const lace = await staff.api('/api/item-list.php', { name: 'Bom Lace', itemType: 'Cutting' });
    assert.equal(lace.status, 201, 'employee adds a Cutting item');
    assert.equal((await staff.api('/api/item-list.php', { name: 'Bom Thread', itemType: 'Non-Cutting' })).status, 201, 'employee adds a Non-Cutting item');
    assert.deepEqual(H.sql("SELECT name, itemType FROM itemList WHERE name IN ('Bom Lace', 'Bom Thread') ORDER BY name").map(r => r.itemType), ['Cutting', 'Non-Cutting']);
    for (const user of [staff, admin]) {
        const untyped = await user.api('/api/item-list.php', { name: 'Bom Untyped' });
        assert.equal(untyped.status, 422, 'item validation unchanged: a type is still required');
        assert.match(untyped.body.message, /Select Cutting or Non-Cutting/);
    }
    assert.equal((await admin.api('/api/colour.php', { name: 'Bom Teal' })).status, 201, 'admin adds a colour');
    assert.equal((await admin.api('/api/item-list.php', { name: 'Bom Button', itemType: 'Non-Cutting' })).status, 201, 'admin adds an item');

    const shirt = H.sql("SELECT id FROM pieceItemList WHERE name = 'Shirt'")[0].id;
    H.sql("INSERT INTO patternRecords (name, pieceCount) VALUES ('Auth Pattern', 1)");
    const patternId = H.sql("SELECT id FROM patternRecords WHERE name = 'Auth Pattern'")[0].id;
    H.sql('INSERT INTO patternPieceLinks (patternId, pieceNumber, pieceItemId) VALUES (?, 1, ?)', [patternId, shirt]);
    const bom = (fields = {}) => ({ brand: 'AMARI', designNumber: '901', colourId: green.body.data.id, patternId, pattern: 'Auth Pattern', mrp: '',
        pieces: [{ pieceItemId: shirt, materialIds: [lace.body.data.id], additionalWorks: [] }], ...fields });

    // Employee: BOM rows that are not in the Product List — create, edit everything, status, delete.
    const created = await staff.api('/api/bom.php', bom());
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const bomId = created.body.data.id;
    assert.equal((await staff.api('/api/bom.php', bom({ id: bomId, brand: 'NIVI BLOSSOM', designNumber: '902' }))).status, 200, 'edit own BOM');
    assert.equal((await staff.api('/api/bom.php', { action: 'status', id: bomId, status: 'inactive' })).status, 200);
    assert.equal((await staff.api('/api/bom.php', { id: bomId }, { method: 'DELETE' })).status, 200, 'delete a BOM not in the Product List');

    // A product created on the Product page that still needs its BOM (shown in BOM Master as "In Progress").
    H.sql("INSERT INTO productRecords (brand, designNumber, colourId, pieces, pieceCount, createdFrom, inProductList, bomCompleted) VALUES ('LITTLE DOLLY', '905', 1, '[]', 1, 'product', 1, 0)");
    const listed = H.sql("SELECT id FROM productRecords WHERE designNumber = '905'")[0].id;
    const same = { id: listed, brand: 'LITTLE DOLLY', designNumber: '905', colourId: 1 };
    assert.equal((await staff.api('/api/bom.php', bom({ ...same, mrp: '499' }))).status, 200, 'employee completes the BOM of a listed product');
    assert.equal((await staff.api('/api/bom.php', { action: 'status', id: listed, status: 'inactive' })).status, 200, 'status stays a BOM Master action');
    assert.equal((await staff.api('/api/bom.php', { action: 'status', id: listed, status: 'active' })).status, 200);

    // Employee: admin-only product changes through bom.php are refused, and nothing is written.
    for (const change of [{ brand: 'AMARI' }, { designNumber: '906' }, { colourId: green.body.data.id }]) {
        const refused = await staff.api('/api/bom.php', bom({ ...same, ...change }));
        assert.equal(refused.status, 403, 'product field change ' + JSON.stringify(change));
    }
    const form = new FormData();
    form.append('payload', JSON.stringify(bom(same)));
    form.append('photo', new Blob([Buffer.from('fake')], { type: 'image/png' }), 'x.png');
    assert.equal((await staff.json('/api/bom.php', { method: 'POST', withCsrf: true, body: form })).status, 403, 'photo of a listed product');
    assert.equal((await staff.api('/api/bom.php', { id: listed }, { method: 'DELETE' })).status, 403, 'delete a listed product');
    assert.equal((await staff.api('/api/bom.php', { action: 'import', ids: [listed] })).status, 422, 'Product List import never runs through bom.php');
    assert.equal((await staff.api('/api/product.php', { action: 'import', ids: [listed] })).status, 403, '...and product.php is admin-only');
    const row = H.sql(`SELECT brand, designNumber, colourId, photo, mrp, bomCompleted FROM productRecords WHERE id = ${Number(listed)}`)[0];
    assert.deepEqual([row.brand, String(row.designNumber), Number(row.colourId), row.photo, Number(row.mrp), Number(row.bomCompleted)],
        ['LITTLE DOLLY', '905', 1, null, 499, 1], 'refused requests changed nothing; the BOM completion was kept');

    // Admin keeps every permission through the same endpoint.
    assert.equal((await admin.api('/api/bom.php', bom({ ...same, designNumber: '907', colourId: green.body.data.id }))).status, 200, 'admin changes product fields');
    assert.equal((await admin.api('/api/bom.php', { id: listed }, { method: 'DELETE' })).status, 200, 'admin deletes a listed product');
});

test('CSRF: changes without the session token are refused; reads do not need it', async () => {
    const staff = await signedIn('staff');
    const body = { action: 'create', customerId: 'CUS1', existingCustomer: 'No', deliveryDate: '2026-12-01', items: [{ barcode: codes.ld101, qty: 1 }] };
    const missing = await staff.api('/api/orders.php', body, { withCsrf: false });
    assert.equal(missing.status, 403);
    assert.equal(missing.body.csrf, true);
    const other = await signedIn('admin');
    staff.setCsrf(other.csrf);
    assert.equal((await staff.api('/api/orders.php', body)).status, 403, "another session's token is useless");
    await staff.loadCsrf();
    assert.equal((await staff.api('/api/orders.php', body)).status, 200);
    assert.equal((await staff.json('/api/orders.php')).status, 200);
});

test('existing workflow as a signed-in employee: create, pass, scan, partial delivery, PDF upload and private download', async () => {
    const staff = await signedIn('staff');
    const created = await staff.api('/api/orders.php', { action: 'create', customerId: 'CUS1', existingCustomer: 'No', deliveryDate: '2026-12-02',
        items: [{ barcode: codes.am102, qty: 2 }] });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    let order = created.body.data.order;
    assert.equal(order.totalSets, 2);
    assert.equal((await staff.api('/api/orders.php', { action: 'passToDispatch', id: order.id })).status, 200);
    for (let i = 0; i < 3; i++) assert.equal((await staff.api('/api/orders.php', { action: 'scan', id: order.id, barcode: codes.am102 })).status, 200);
    order = (await staff.json('/api/orders.php?id=' + order.id)).body.data;
    const delivered = await staff.api('/api/orders.php', { action: 'deliverPartial', id: order.id, version: order.version,
        lines: [{ itemId: order.items[0].id, sets: 1 }] });
    assert.equal(delivered.status, 200, JSON.stringify(delivered.body));
    const batch = delivered.body.data.order.deliveryBatches[0];

    const upload = async (who, mode, withCsrf = true) => {
        const form = new FormData();
        form.append('batchId', batch.id);
        if (mode) form.append('mode', mode);
        form.append('file', new Blob([H.pdfBytes()], { type: 'application/pdf' }), 'Signed.pdf');
        return who.json('/api/delivery-pdf.php', { method: 'POST', body: form, withCsrf });
    };
    assert.equal((await upload(staff, null, false)).status, 403, 'PDF upload needs the CSRF token');
    assert.equal((await upload(staff, 'import')).status, 403, 'PDF import mode is admin-only');
    const passed = await upload(staff, null);
    assert.equal(passed.status, 200, JSON.stringify(passed.body));
    assert.equal(passed.body.data.order.deliveryBatches[0].pdf.state, 'stored');

    const download = await staff.request('/api/delivery-pdf.php?batchId=' + encodeURIComponent(batch.id));
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('content-type'), 'application/pdf');
    assert.match(download.headers.get('cache-control'), /private, no-store/);
    assert.equal((await client().json('/api/delivery-pdf.php?batchId=' + encodeURIComponent(batch.id))).status, 401, 'no download without sign-in');
});

test('order import is admin-only (orders and PDFs)', async () => {
    const legacy = [{ id: 'ORD1760000000001', customerName: 'Legacy', items: [], createdAt: '2026-10-01T06:40:00.000Z' }];
    const staff = await signedIn('staff');
    const refused = await staff.api('/api/orders.php', { action: 'import', orders: legacy });
    assert.equal(refused.status, 403);
    assert.match(refused.body.message, /administrator/);
    assert.equal(H.sql("SELECT COUNT(*) AS n FROM customerOrders WHERE id = 'ORD1760000000001'")[0].n, 0);
    const admin = await signedIn('admin');
    const imported = await admin.api('/api/orders.php', { action: 'import', orders: legacy });
    assert.equal(imported.status, 200, JSON.stringify(imported.body));
    assert.equal(imported.body.data.results[0].result, 'imported');
});

test('session expiry: idle sessions end; disabling, role changes and password resets sign the user out', async () => {
    const idle = await signedIn('staff', PASSWORDS.staff, shortServer);
    assert.equal((await idle.json('/api/orders.php')).status, 200);
    await new Promise(resolve => setTimeout(resolve, 3200));
    const expired = await idle.json('/api/orders.php');
    assert.equal(expired.status, 401);
    assert.match(expired.body.message, /expired/);
    const page = await (await idle.request('/login?expired=1')).text();
    assert.match(page, /Your session has expired/);

    createUser('other', 'employee', PASSWORDS.other);
    const other = await signedIn('other');
    const admin = await signedIn('admin');
    const id = H.sql("SELECT id FROM appUsers WHERE username = 'other'")[0].id;
    assert.equal((await admin.api('/api/users.php', { action: 'update', id, active: false })).status, 200);
    assert.equal((await other.json('/api/orders.php')).status, 401, 'disabled account is signed out at once');
    assert.match(await (await client().login('other', PASSWORDS.other)).text(), /disabled/);
    assert.equal((await admin.api('/api/users.php', { action: 'update', id, active: true })).status, 200);

    const again = await signedIn('other');
    assert.equal((await admin.api('/api/users.php', { action: 'setPassword', id, password: 'Brand-new-pass-9' })).status, 200);
    assert.equal((await again.json('/api/orders.php')).status, 401, 'password reset ends existing sessions');
    assert.equal((await client().login('other', PASSWORDS.other)).status, 401, 'old password no longer works');
    assert.equal((await client().login('other', 'Brand-new-pass-9')).status, 303);
});

test('lock-out after 5 wrong passwords; an admin password reset unlocks', async () => {
    createUser('locky', 'employee', 'Locky-pass-123');
    const c = client();
    for (let i = 0; i < 5; i++) assert.equal((await c.login('locky', 'wrong-' + i)).status, 401);
    const locked = await c.login('locky', 'Locky-pass-123');
    assert.match(await locked.text(), /Too many failed sign-in attempts/);
    assert.equal(H.php(['cli/users-admin.php', 'set-password', 'locky'], { input: 'Locky-pass-456\n' }).code, 0);
    assert.equal((await client().login('locky', 'Locky-pass-456')).status, 303);
});

test('users API: the last active admin cannot be demoted or disabled; admins create accounts', async () => {
    const admin = await signedIn('admin');
    const list = await admin.json('/api/users.php');
    const me = list.body.data.users.find(user => user.username === 'admin');
    const demote = await admin.api('/api/users.php', { action: 'update', id: me.id, role: 'employee' });
    assert.equal(demote.status, 409);
    assert.match(demote.body.message, /last active admin/);
    assert.equal((await admin.api('/api/users.php', { action: 'update', id: me.id, active: false })).status, 409);
    const created = await admin.api('/api/users.php', { action: 'create', username: 'new.staff', displayName: 'New <b>Staff</b>', role: 'employee', password: 'New-staff-pass-1' });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    assert.equal((await admin.api('/api/users.php', { action: 'create', username: 'x', role: 'employee', password: 'Short-pass-1' })).status, 422);
    assert.equal((await client().login('new.staff', 'New-staff-pass-1')).status, 303);
});

test('logout needs POST with the CSRF token, then the session is gone', async () => {
    const staff = await signedIn('staff');
    const getLogout = await staff.request('/logout');
    assert.equal(getLogout.status, 303);
    assert.equal((await staff.json('/api/orders.php')).status, 200, 'GET /logout does not sign out (CSRF-safe)');
    const form = new URLSearchParams({ _csrf: staff.csrf });
    const out = await staff.request('/logout', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    assert.equal(out.status, 303);
    assert.match(out.headers.get('location'), /\/login\?signedOut=1$/);
    assert.equal((await staff.json('/api/orders.php')).status, 401);
});
