// LOCAL development server: `npm run dev` (http://127.0.0.1:8080/order-bookings/order-list).
// Always bound to 127.0.0.1. It is the only place that sets the explicit local-development switch
// ORDERS_ALLOW_UNAUTHENTICATED_DEV=1; without it (for example on Apache or Hostinger) the order APIs return 401.
// Database: DEV_DB_* (default: the same local database as includes/db.php, 127.0.0.1:3306 `order-booking`).
const { spawn } = require('node:child_process');
const path = require('node:path');

const port = Number(process.env.DEV_PORT || 8080);
const env = {
    ...process.env,
    APP_ENV: 'development',
    ORDERS_ALLOW_UNAUTHENTICATED_DEV: '1',
    DB_HOST: process.env.DEV_DB_HOST || '127.0.0.1',
    DB_PORT: process.env.DEV_DB_PORT || '3306',
    DB_NAME: process.env.DEV_DB_NAME || 'order-booking',
    DB_USER: process.env.DEV_DB_USER || 'root',
    DB_PASSWORD: process.env.DEV_DB_PASSWORD || '',
};
if (!['127.0.0.1', 'localhost'].includes(env.DB_HOST)) {
    console.error('The development server only uses a local database.');
    process.exit(1);
}
const root = path.resolve(__dirname, '..');
const child = spawn(process.env.PHP_BIN || 'php', ['-d', 'upload_max_filesize=11M', '-d', 'post_max_size=12M', '-S', `127.0.0.1:${port}`,
    '-t', path.dirname(root), path.join(root, 'cli', 'dev-router.php')], { cwd: root, env, stdio: 'inherit' });
console.log(`Development server: http://127.0.0.1:${port}/${path.basename(root)}/order-list (database ${env.DB_NAME})`);
child.on('exit', code => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
