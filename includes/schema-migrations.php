<?php

function applySchemaMigrations(PDO $db): void
{
    static $applied = false;
    if ($applied) {
        return;
    }

    $lock = $db->query("SELECT GET_LOCK('order-booking-schema-migrations', 30)")->fetchColumn();
    if ((int) $lock !== 1) {
        throw new RuntimeException('Unable to acquire the database migration lock.');
    }

    try {
        $db->exec(
            'CREATE TABLE IF NOT EXISTS appSchemaMigrations (
                migration VARCHAR(255) NOT NULL PRIMARY KEY,
                appliedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        $directory = __DIR__ . '/../database/migrations';
        $files = glob($directory . '/*.sql') ?: [];
        sort($files, SORT_STRING);
        $lookup = $db->prepare('SELECT 1 FROM appSchemaMigrations WHERE migration = ?');
        $markApplied = $db->prepare('INSERT INTO appSchemaMigrations (migration) VALUES (?)');

        foreach ($files as $file) {
            $migration = basename($file);
            $lookup->execute([$migration]);
            if ($lookup->fetchColumn()) {
                continue;
            }

            $sql = file_get_contents($file);
            if ($sql === false) {
                throw new RuntimeException('Unable to read database migration: ' . $migration);
            }

            $statements = preg_split('/;\s*(?:\r?\n|$)/', $sql, -1, PREG_SPLIT_NO_EMPTY);
            foreach ($statements as $statement) {
                if (trim($statement) !== '') {
                    $db->exec($statement);
                }
            }
            $markApplied->execute([$migration]);
        }
        $applied = true;
    } finally {
        $db->query("SELECT RELEASE_LOCK('order-booking-schema-migrations')")->fetchColumn();
    }
}
