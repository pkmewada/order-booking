<?php
// Test database helper (CLI only). Refuses anything except a LOCAL database whose name ends in _test
// (or _dev for the manual development database), so it can never touch a production database.
//   php tests/helpers/test-db.php reset        drop + create the database, load the schema, run existing migrations
//   php tests/helpers/test-db.php query        stdin: {"sql": "...", "params": [...]}; prints JSON rows
if (PHP_SAPI !== 'cli') {
    exit(1);
}
$host = (string) getenv('DB_HOST');
$name = (string) getenv('DB_NAME');
if (!in_array($host, ['127.0.0.1', 'localhost'], true) || !preg_match('/^[A-Za-z0-9_]+_(test|dev)$/D', $name)) {
    fwrite(STDERR, "Refusing to use database '$name' on '$host': only local databases ending in _test or _dev are allowed.\n");
    exit(3);
}
$port = getenv('DB_PORT') ?: '3306';
$server = new PDO("mysql:host=$host;port=$port;charset=utf8mb4", getenv('DB_USER') ?: 'root', getenv('DB_PASSWORD') ?: '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$command = $argv[1] ?? '';
if ($command === 'reset') {
    $server->exec("DROP DATABASE IF EXISTS `$name`");
    $server->exec("CREATE DATABASE `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $server->exec("USE `$name`");
    $sql = file_get_contents(__DIR__ . '/../../database/order-booking.sql');
    $isMysql = stripos((string) $server->query('SELECT VERSION()')->fetchColumn(), 'mariadb') === false;
    foreach (preg_split('/;\s*(?:\r?\n|$)/', $sql) as $statement) {
        $trimmed = trim(preg_replace('/^\s*--.*$/m', '', $statement));
        if ($trimmed === '' || preg_match('/^(CREATE DATABASE|USE)\b/i', $trimmed)) {
            continue; // never touch the database named in the schema file
        }
        if ($isMysql && preg_match('/^ALTER TABLE .* IF NOT EXISTS/is', $trimmed)) {
            continue; // MariaDB-only upgrade syntax; a fresh schema already contains these columns and indexes
        }
        $server->exec($trimmed);
    }
    require __DIR__ . '/../../includes/db.php';
    database(); // applies the existing database/migrations exactly like the app does
    echo "reset $name\n";
    exit(0);
}
if ($command === 'query') {
    $server->exec("USE `$name`");
    $input = json_decode(stream_get_contents(STDIN), true);
    $query = $server->prepare($input['sql']);
    $query->execute($input['params'] ?? []);
    echo json_encode($query->columnCount() ? $query->fetchAll() : ['affected' => $query->rowCount()]);
    exit(0);
}
fwrite(STDERR, "Usage: reset | query\n");
exit(64);
