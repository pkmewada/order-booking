<?php
// Orders administration (SAP Phase 1). Command line only; the cli/ folder is also denied over HTTP.
//   php cli/orders-admin.php migrate|verify|status|down|export <dir>|restore <dir>|orphans [--delete]
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}
require_once __DIR__ . '/../api/order-records.php';

const CLI_MIGRATION_DIR = __DIR__ . '/../database/cli-migrations';

function out(string $line): void
{
    fwrite(STDOUT, $line . PHP_EOL);
}

function fail(string $line, int $code = 1): void
{
    fwrite(STDERR, 'ERROR: ' . $line . PHP_EOL);
    exit($code);
}

function migrationFiles(): array
{
    $files = array_filter(glob(CLI_MIGRATION_DIR . '/*.sql') ?: [], static function ($file) {
        return substr($file, -9) !== '.down.sql';
    });
    sort($files, SORT_STRING);
    return $files;
}

function migrationName(string $file): string
{
    return 'cli/' . basename($file);
}

function sqlStatements(string $file): array
{
    $sql = file_get_contents($file);
    if ($sql === false) {
        fail('Unable to read ' . basename($file));
    }
    $sql = preg_replace('/^\s*--.*$/m', '', $sql);
    return array_values(array_filter(array_map('trim', preg_split('/;\s*(?:\r?\n|$)/', $sql)), 'strlen'));
}

// Expected structure, read from the migration itself so the check never drifts from the SQL.
function expectedSchema(string $file): array
{
    $expected = [];
    preg_match_all('/CREATE TABLE IF NOT EXISTS `(\w+)` \((.*?)\n\) ENGINE/s', file_get_contents($file), $tables, PREG_SET_ORDER);
    foreach ($tables as [, $table, $body]) {
        preg_match_all('/^\s*`(\w+)`/m', $body, $columns);
        preg_match_all('/(?:UNIQUE )?KEY `(\w+)`/', $body, $indexes);
        preg_match_all('/CONSTRAINT `(\w+)`/', $body, $foreignKeys);
        $expected[$table] = ['columns' => $columns[1], 'indexes' => array_merge(['PRIMARY'], $indexes[1]), 'foreignKeys' => $foreignKeys[1]];
    }
    return $expected;
}

function verifySchema(PDO $db, string $file): array
{
    $problems = [];
    foreach (expectedSchema($file) as $table => $spec) {
        $query = $db->prepare('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
        $query->execute([$table]);
        $columns = $query->fetchAll(PDO::FETCH_COLUMN);
        if (!$columns) {
            $problems[] = "missing table $table";
            continue;
        }
        foreach (array_diff($spec['columns'], $columns) as $column) {
            $problems[] = "missing column $table.$column";
        }
        $query = $db->prepare('SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
        $query->execute([$table]);
        foreach (array_diff($spec['indexes'], $query->fetchAll(PDO::FETCH_COLUMN)) as $index) {
            $problems[] = "missing index $table.$index";
        }
        $query = $db->prepare('SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ?');
        $query->execute([$table]);
        foreach (array_diff($spec['foreignKeys'], $query->fetchAll(PDO::FETCH_COLUMN)) as $foreignKey) {
            $problems[] = "missing foreign key $table.$foreignKey";
        }
    }
    return $problems;
}

function isApplied(PDO $db, string $name): bool
{
    $query = $db->prepare('SELECT 1 FROM appSchemaMigrations WHERE migration = ?');
    $query->execute([$name]);
    return (bool) $query->fetchColumn();
}

function withLock(PDO $db, callable $work)
{
    if ((int) $db->query("SELECT GET_LOCK('order-booking-cli-migrations', 30)")->fetchColumn() !== 1) {
        fail('Another migration is running.');
    }
    try {
        return $work();
    } finally {
        $db->query("SELECT RELEASE_LOCK('order-booking-cli-migrations')")->fetchColumn();
    }
}

function commandMigrate(PDO $db): void
{
    out('Database: ' . $db->query('SELECT DATABASE()')->fetchColumn() . ' on ' . $db->query('SELECT VERSION()')->fetchColumn());
    withLock($db, static function () use ($db) {
        foreach (migrationFiles() as $file) {
            $name = migrationName($file);
            if (!isApplied($db, $name)) {
                out("Applying $name");
                foreach (sqlStatements($file) as $statement) {
                    $db->exec($statement);
                }
            }
            $problems = verifySchema($db, $file);
            if ($problems) {
                fail("Verification failed for $name: " . implode('; ', $problems) . '. The migration was NOT recorded; the order APIs stay disabled.');
            }
            if (!isApplied($db, $name)) {
                $db->prepare('INSERT INTO appSchemaMigrations (migration) VALUES (?)')->execute([$name]);
                out("Verified and recorded $name");
            } else {
                out("Already applied and verified: $name");
            }
        }
    });
    out('OK');
}

function commandVerify(PDO $db): void
{
    $failed = false;
    foreach (migrationFiles() as $file) {
        $name = migrationName($file);
        $problems = verifySchema($db, $file);
        $recorded = isApplied($db, $name);
        out(sprintf('%s: %s, %s', $name, $problems ? 'INVALID (' . implode('; ', $problems) . ')' : 'schema OK', $recorded ? 'recorded' : 'NOT recorded'));
        $failed = $failed || $problems || !$recorded;
    }
    if ($failed) {
        fail('Verification failed.');
    }
    out('OK');
}

function commandStatus(PDO $db): void
{
    foreach (migrationFiles() as $file) {
        out((isApplied($db, migrationName($file)) ? 'applied  ' : 'pending  ') . migrationName($file));
    }
}

// Test/local only: refuses anything that is not a local database whose name ends in _test.
// Checked before connecting, because connecting already runs the existing automatic migrations.
function guardTestDatabase(): void
{
    $name = getenv('DB_NAME') ?: 'order-booking';
    $host = getenv('DB_HOST') ?: '127.0.0.1';
    if (!preg_match('/^[A-Za-z0-9_]+_test$/D', $name) || !in_array($host, ['127.0.0.1', 'localhost'], true)) {
        fail("Refusing to run down on '$name' at '$host'. Only local databases ending in _test are allowed.");
    }
}

function commandDown(PDO $db): void
{
    if ((string) $db->query('SELECT DATABASE()')->fetchColumn() !== getenv('DB_NAME')) {
        fail('Connected database does not match DB_NAME. Refusing to run down.');
    }
    foreach (array_reverse(migrationFiles()) as $file) {
        $down = substr($file, 0, -4) . '.down.sql';
        foreach (sqlStatements($down) as $statement) {
            $db->exec($statement);
        }
        out('Rolled back ' . migrationName($file));
    }
}

function commandExport(PDO $db, ?string $directory): void
{
    if (!$directory) {
        fail('Usage: export <empty-or-new-directory>');
    }
    if (is_dir($directory) && array_diff(scandir($directory), ['.', '..'])) {
        fail('Export directory must be new or empty.');
    }
    if (!is_dir($directory) && !mkdir($directory . '/pdfs', 0750, true)) {
        fail('Cannot create the export directory.');
    }
    if (!is_dir($directory . '/pdfs')) {
        mkdir($directory . '/pdfs', 0750);
    }
    $orders = ordersLoad($db);
    $json = json_encode($orders, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    file_put_contents($directory . '/orders.json', $json);
    $pdfs = [];
    $rows = $db->query("SELECT id, pdfFile, pdfSha256 FROM deliveryBatches WHERE pdfState = 'stored'")->fetchAll();
    $storage = $rows ? ordersPdfDirectory() : '';
    foreach ($rows as $row) {
        $source = $storage . DIRECTORY_SEPARATOR . $row['pdfFile'];
        if (!is_file($source) || hash_file('sha256', $source) !== $row['pdfSha256']) {
            fail('PDF for delivery ' . $row['id'] . ' is missing or changed on disk. Export stopped.');
        }
        copy($source, $directory . '/pdfs/' . $row['id'] . '.pdf');
        $pdfs[$row['id']] = $row['pdfSha256'];
    }
    $manifest = ['exportedAt' => ordersIsoFromMs(ordersNowMs()), 'database' => $db->query('SELECT DATABASE()')->fetchColumn(),
        'orders' => count($orders), 'ordersSha256' => hash('sha256', $json), 'pdfs' => $pdfs];
    file_put_contents($directory . '/manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    out(sprintf('Exported %d orders and %d PDFs to %s', count($orders), count($pdfs), $directory));
}

function commandRestore(PDO $db, ?string $directory): void
{
    if (!$directory || !is_file($directory . '/manifest.json') || !is_file($directory . '/orders.json')) {
        fail('Usage: restore <export-directory> (with manifest.json and orders.json)');
    }
    $manifest = json_decode(file_get_contents($directory . '/manifest.json'), true);
    $json = file_get_contents($directory . '/orders.json');
    if (!is_array($manifest) || hash('sha256', $json) !== ($manifest['ordersSha256'] ?? '')) {
        fail('orders.json does not match manifest.json. Restore stopped.');
    }
    foreach ($manifest['pdfs'] ?? [] as $batchId => $sha) {
        $file = $directory . '/pdfs/' . $batchId . '.pdf';
        if (!is_file($file) || hash_file('sha256', $file) !== $sha) {
            fail("PDF for delivery $batchId is missing or changed in the export. Restore stopped.");
        }
    }
    $counts = ['imported' => 0, 'alreadyImported' => 0, 'conflict' => 0, 'invalid' => 0];
    foreach (array_chunk(json_decode($json, true) ?: [], 200) as $chunk) {
        foreach (ordersImport($db, $chunk) as $result) {
            $counts[$result['result']]++;
            if (in_array($result['result'], ['conflict', 'invalid'], true)) {
                out(strtoupper($result['result']) . ' ' . $result['id'] . ': ' . ($result['message'] ?? ''));
            }
        }
    }
    $restoredPdfs = 0;
    foreach (array_keys($manifest['pdfs'] ?? []) as $batchId) {
        $query = $db->prepare('SELECT pdfState FROM deliveryBatches WHERE id = ?');
        $query->execute([$batchId]);
        if ($query->fetchColumn() === 'missing') {
            ordersAttachPdf($db, (string) $batchId, $directory . '/pdfs/' . $batchId . '.pdf', 'Delivery.pdf', 'import', false);
            $restoredPdfs++;
        }
    }
    out(sprintf('Restore: %d imported, %d already present, %d conflicts, %d invalid, %d PDFs restored',
        $counts['imported'], $counts['alreadyImported'], $counts['conflict'], $counts['invalid'], $restoredPdfs));
    if ($counts['conflict'] || $counts['invalid']) {
        exit(2);
    }
}

function commandOrphans(PDO $db, bool $delete): void
{
    $directory = ordersPdfDirectory();
    $referenced = array_flip($db->query('SELECT pdfFile FROM deliveryBatches WHERE pdfFile IS NOT NULL')->fetchAll(PDO::FETCH_COLUMN));
    $found = 0;
    foreach (scandir($directory) as $file) {
        if (!preg_match('/^[a-f0-9]{32}\.pdf$/D', $file) || isset($referenced[$file])) {
            continue;
        }
        $path = $directory . DIRECTORY_SEPARATOR . $file;
        if (filemtime($path) > time() - 3600) {
            continue; // may belong to an upload that is still in progress
        }
        $found++;
        if ($delete) {
            unlink($path);
            out("Deleted orphan $file");
        } else {
            out("Orphan $file");
        }
    }
    out("$found orphaned PDF file(s)" . ($delete ? ' deleted' : '') . '.');
}

$command = $argv[1] ?? '';
if ($command === 'down') {
    guardTestDatabase();
}
try {
    $db = database();
    switch ($command) {
        case 'migrate': commandMigrate($db); break;
        case 'verify': commandVerify($db); break;
        case 'status': commandStatus($db); break;
        case 'down': commandDown($db); break;
        case 'export': commandExport($db, $argv[2] ?? null); break;
        case 'restore': commandRestore($db, $argv[2] ?? null); break;
        case 'orphans': commandOrphans($db, in_array('--delete', $argv, true)); break;
        default: fail('Usage: php cli/orders-admin.php migrate|verify|status|down|export <dir>|restore <dir>|orphans [--delete]', 64);
    }
} catch (OrderError $error) {
    fail($error->getMessage());
} catch (Throwable $error) {
    fail(get_class($error) . ': ' . $error->getMessage());
}
