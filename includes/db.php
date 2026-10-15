<?php
// XAMPP defaults. Set these environment variables or change the defaults below.
function database(): PDO
{
    static $connection;
    if (!$connection) {
        $host = getenv('DB_HOST') ?: '127.0.0.1';
        $port = getenv('DB_PORT') ?: '3306';
        $name = getenv('DB_NAME') ?: 'order-booking';
        $user = getenv('DB_USER') ?: 'root';
        $password = getenv('DB_PASSWORD') ?: '';
        $connection = new PDO("mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4", $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        applyDatabaseMigrations($connection);
    }
    return $connection;
}

function applyDatabaseMigrations(PDO $connection): void
{
    static $applied = false;
    if ($applied) {
        return;
    }

    $lockName = 'order-booking-schema-migrations';
    $lock = $connection->prepare('SELECT GET_LOCK(?, 15)');
    $lock->execute([$lockName]);
    if ((int) $lock->fetchColumn() !== 1) {
        throw new RuntimeException('Could not acquire the database migration lock.');
    }

    try {
        $connection->exec(
            'CREATE TABLE IF NOT EXISTS `appSchemaMigrations` (
                `migration` VARCHAR(190) NOT NULL PRIMARY KEY,
                `appliedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        $migrationFiles = glob(__DIR__ . '/../database/migrations/*.sql');
        if ($migrationFiles === false) {
            throw new RuntimeException('Could not read the database migrations directory.');
        }
        sort($migrationFiles, SORT_STRING);

        $isApplied = $connection->prepare('SELECT 1 FROM `appSchemaMigrations` WHERE `migration` = ?');
        $recordApplied = $connection->prepare('INSERT INTO `appSchemaMigrations` (`migration`) VALUES (?)');
        foreach ($migrationFiles as $file) {
            $migration = basename($file);
            $isApplied->execute([$migration]);
            if ($isApplied->fetchColumn()) {
                continue;
            }

            $contents = file_get_contents($file);
            if ($contents === false) {
                throw new RuntimeException('Could not read database migration ' . $migration . '.');
            }

            $statements = preg_split('/;\s*(?:\r?\n|$)/', trim($contents));
            if ($statements === false) {
                throw new RuntimeException('Could not parse database migration ' . $migration . '.');
            }
            foreach ($statements as $statement) {
                if (trim($statement) !== '') {
                    $connection->exec($statement);
                }
            }
            $recordApplied->execute([$migration]);
        }
        $applied = true;
    } finally {
        $releaseLock = $connection->prepare('SELECT RELEASE_LOCK(?)');
        $releaseLock->execute([$lockName]);
    }
}
