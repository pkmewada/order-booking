<?php
// Template only. Copy to includes/db.config.php on each server and fill in the real values there.
// includes/db.config.php is ignored by Git, so deploys never overwrite or publish it.
// DB_* environment variables, when set, take priority over this file.
return [
    'DB_HOST' => '127.0.0.1',
    'DB_PORT' => '3306',
    'DB_NAME' => 'database_name',
    'DB_USER' => 'database_user',
    'DB_PASSWORD' => 'change-me',
];
