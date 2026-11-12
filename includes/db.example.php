<?php
// Connection settings, in this order: DB_* environment variables, then includes/db.config.php
// (one per server, never in Git; copy includes/db.config.example.php), then the XAMPP defaults below.
// includes/db.php is NOT in Git. Its tracked template is includes/db.example.php: copy it to
// includes/db.php on every server and clone, and copy it again when the template changes.
// Credentials still belong in includes/db.config.php or the DB_* environment variables, not here.
require_once __DIR__ . '/schema-migrations.php';

// Reads includes/db.config.php, which must contain only `<?php return [...];` (see db.config.example.php).
// A malformed file (plain text, a copy of this file, no array) is ignored and logged instead of breaking
// every API response.
function databaseConfigFile(string $file): array
{
    if (!is_file($file)) {
        return [];
    }
    $source = preg_replace('/^\xEF\xBB\xBF/', '', (string) file_get_contents($file));
    if (strncmp(ltrim($source), '<?php', 5) !== 0 || preg_match('/^\s*(function|class)\s+\w+/im', $source)) {
        error_log('includes/db.config.php ignored: it must contain only <?php return [...]; (see includes/db.config.example.php).');
        return [];
    }
    ob_start();
    try {
        $config = require $file;
    } finally {
        ob_end_clean();
    }
    if (!is_array($config)) {
        error_log('includes/db.config.php ignored: it must return an array (see includes/db.config.example.php).');
        return [];
    }
    return $config;
}

function database(): PDO
{
    static $connection;
    if (!$connection) {
        $config = databaseConfigFile(__DIR__ . '/db.config.php');
        $setting = static function (string $key, string $default) use ($config): string {
            $value = getenv($key);
            return $value !== false && $value !== '' ? $value : (string) ($config[$key] ?? $default);
        };
        $host = $setting('DB_HOST', '127.0.0.1');
        $port = $setting('DB_PORT', '3306');
        $name = $setting('DB_NAME', 'order-booking');
        $user = $setting('DB_USER', 'root');
        $password = $setting('DB_PASSWORD', '');
        $connection = new PDO("mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4", $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        applySchemaMigrations($connection);
    }
    return $connection;
}
