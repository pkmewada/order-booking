// Shared harness for the order integration tests (npm run test:orders).
// Safety: only a LOCAL database whose name ends in _test is ever used, and it must not match DB_NAME.
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PHP = process.env.PHP_BIN || 'php';

function testConfig() {
    const config = {
        DB_HOST: process.env.TEST_DB_HOST || '127.0.0.1',
        DB_PORT: process.env.TEST_DB_PORT || '3307',
        DB_NAME: process.env.TEST_DB_NAME || 'order_booking_test',
        DB_USER: process.env.TEST_DB_USER || 'root',
        DB_PASSWORD: process.env.TEST_DB_PASSWORD || '',
    };
    if (!/^[A-Za-z0-9_]+_test$/.test(config.DB_NAME)) throw new Error(`Refusing test database "${config.DB_NAME}": the name must end in _test.`);
    if (!['127.0.0.1', 'localhost'].includes(config.DB_HOST)) throw new Error(`Refusing test database host "${config.DB_HOST}": only 127.0.0.1 or localhost.`);
    if (process.env.DB_NAME && process.env.DB_NAME === config.DB_NAME) throw new Error('TEST_DB_NAME must differ from DB_NAME.');
    return config;
}

function childEnv(extra = {}) {
    const env = { ...process.env, ...testConfig(), ...extra };
    delete env.DELIVERY_PDF_DIR;
    if (extra.DELIVERY_PDF_DIR) env.DELIVERY_PDF_DIR = extra.DELIVERY_PDF_DIR;
    return env;
}

function php(args, { env = {}, input } = {}) {
    const result = spawnSync(PHP, args, { cwd: ROOT, env: childEnv(env), input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (result.error) throw result.error;
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

function sql(query, params = []) {
    const result = php(['tests/helpers/test-db.php', 'query'], { input: JSON.stringify({ sql: query, params }) });
    if (result.code !== 0) throw new Error(`SQL failed: ${result.stderr || result.stdout}`);
    return JSON.parse(result.stdout);
}

function resetDatabase() {
    const result = php(['tests/helpers/test-db.php', 'reset']);
    if (result.code !== 0) throw new Error(`Test database reset failed: ${result.stderr || result.stdout}`);
}

function cli(args, env = {}) {
    return php(['cli/orders-admin.php', ...args], { env });
}

const createdDirs = [];
function tempDir(prefix) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    createdDirs.push(dir);
    return dir;
}
function removeTempDirs() {
    for (const dir of createdDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}

const DEV_ENV = { APP_ENV: 'development', ORDERS_ALLOW_UNAUTHENTICATED_DEV: '1' };

// Starts independent `php -S` processes (separate PHP processes and database connections), bound to 127.0.0.1.
async function startServers(count, { env = {}, firstPort = 18081 } = {}) {
    const servers = [];
    for (let i = 0; i < count; i++) {
        const port = firstPort + i;
        const child = spawn(PHP, ['-d', 'upload_max_filesize=11M', '-d', 'post_max_size=12M', '-S', `127.0.0.1:${port}`,
            '-t', path.dirname(ROOT), path.join(ROOT, 'cli', 'dev-router.php')], { cwd: ROOT, env: childEnv(env), stdio: ['ignore', 'ignore', 'pipe'] });
        let log = '';
        child.stderr.on('data', chunk => { log += chunk; });
        servers.push({ port, child, base: `http://127.0.0.1:${port}/${path.basename(ROOT)}`, log: () => log });
    }
    for (const server of servers) {
        const started = Date.now();
        for (;;) {
            try { await fetch(server.base + '/api/orders.php'); break; } catch (_) { /* not listening yet */ }
            if (Date.now() - started > 10000) throw new Error(`php -S on ${server.port} did not start: ${server.log()}`);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    return servers;
}

function stopServers(servers) {
    for (const server of servers || []) server.child.kill();
}

async function api(server, body) {
    const response = await fetch(server.base + '/api/orders.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
}

async function getOrders(server, id) {
    const response = await fetch(server.base + '/api/orders.php' + (id ? '?id=' + encodeURIComponent(id) : ''));
    return { status: response.status, body: await response.json() };
}

async function uploadPdf(server, batchId, bytes, { name = 'Delivery.pdf', mode, type = 'application/pdf' } = {}) {
    const form = new FormData();
    form.append('batchId', batchId);
    if (mode) form.append('mode', mode);
    if (bytes !== null) form.append('file', new Blob([bytes], { type }), name);
    const response = await fetch(server.base + '/api/delivery-pdf.php', { method: 'POST', body: form });
    return { status: response.status, body: await response.json() };
}

function pdfBytes(size = 2048) {
    const header = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n');
    const trailer = Buffer.from('\n%%EOF\n');
    const body = Buffer.alloc(Math.max(0, size - header.length - trailer.length), 0x20);
    return Buffer.concat([header, body, trailer]);
}

// Seeds the masters an order needs: agent, transporter, customer, colour and catalog products.
function seedCatalog() {
    sql("INSERT INTO agents (id, name, contact, city, state) VALUES ('AGT1', 'Agent One', '9876543210', 'Surat', 'Gujarat')");
    sql("INSERT INTO transporters (id, name, contact, city, state) VALUES ('TRN1', 'Fast Transport', '9876543211', 'Surat', 'Gujarat')");
    sql("INSERT INTO customerRecords (id, name, shopName, contact, city, state, agentId, transporterId) VALUES ('CUS1', 'Asha', 'Asha Store', '9876543212', 'Pune', 'Maharashtra', 'AGT1', 'TRN1')");
    sql("INSERT INTO colourRecords (id, name) VALUES (1, 'Red'), (2, 'Blue')");
    const products = [[101, 'LITTLE DOLLY', 1], [102, 'AMARI', 1], [103, 'NIVI BLOSSOM', 2], [104, 'LITTLE DOLLY', 2]];
    for (const [design, brand, colour] of products) {
        sql("INSERT INTO productRecords (brand, designNumber, colourId, pieces, pieceCount, createdFrom, inProductList, bomCompleted) VALUES (?, ?, ?, '[]', 1, 'product', 1, 1)", [brand, design, colour]);
    }
    return { ld101: 'Ld-101-Red-18-26', am102: 'Am-102-Red-S-L', nv103: 'Nv-103-Blue-28-34', ld104: 'Ld-104-Blue-18-26' };
}

module.exports = { ROOT, PHP, DEV_ENV, testConfig, php, sql, resetDatabase, cli, tempDir, removeTempDirs, startServers, stopServers, api, getOrders, uploadPdf, pdfBytes, seedCatalog };
