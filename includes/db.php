<?php
// Connection settings, in this order: DB_* environment variables, then includes/db.config.php
// (one per server, never in Git; copy includes/db.config.example.php), then the XAMPP defaults below.
// Do not put credentials in this file: it is tracked, so every deploy replaces it.
require_once __DIR__ . '/schema-migrations.php';

function database(): PDO
{
    static $connection;
    if (!$connection) {
        $config = is_file(__DIR__ . '/db.config.php') ? require __DIR__ . '/db.config.php' : [];
        $config = is_array($config) ? $config : [];
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
