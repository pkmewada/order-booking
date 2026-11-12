<?php
// Sign-in accounts. Command line only; the cli/ folder is also denied over HTTP.
//   php cli/users-admin.php list
//   php cli/users-admin.php create <username> <admin|employee> [display name]   (asks for the password)
//   php cli/users-admin.php set-password <username>                             (asks; also clears a lock-out)
//   php cli/users-admin.php set-role <username> <admin|employee>
//   php cli/users-admin.php disable <username> | enable <username>
// Passwords are read from standard input (one line), never from arguments, so they stay out of shell history.
// Needs the accounts table first: php cli/orders-admin.php migrate
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}
require_once __DIR__ . '/../includes/users.php';

function usersCliFail(string $message, int $code = 1): void
{
    fwrite(STDERR, 'ERROR: ' . $message . PHP_EOL);
    exit($code);
}

function usersCliPassword(): string
{
    fwrite(STDERR, 'Password (at least ' . AUTH_PASSWORD_MIN . ' characters; visible on some terminals): ');
    $line = fgets(STDIN);
    fwrite(STDERR, PHP_EOL);
    return rtrim((string) $line, "\r\n");
}

$command = $argv[1] ?? '';
$name = $argv[2] ?? '';
try {
    $db = database();
    switch ($command) {
        case 'list':
            foreach (usersList($db) as $user) {
                fwrite(STDOUT, sprintf("%-24s %-9s %-9s %s%s\n", $user['username'], $user['role'], $user['active'] ? 'active' : 'disabled',
                    $user['lastLoginAt'] ? 'last sign-in ' . $user['lastLoginAt'] : 'never signed in', $user['locked'] ? ' (locked)' : ''));
            }
            break;
        case 'create':
            $user = usersCreate($db, ['username' => $name, 'role' => $argv[3] ?? '', 'displayName' => implode(' ', array_slice($argv, 4)),
                'password' => usersCliPassword()]);
            fwrite(STDOUT, "Created {$user['role']} '{$user['username']}'.\n");
            break;
        case 'set-password':
            usersSetPassword($db, usersIdByName($db, usersUsername($name)), usersCliPassword());
            fwrite(STDOUT, "Password changed for '$name'. Existing sessions are signed out.\n");
            break;
        case 'set-role':
            usersUpdate($db, usersIdByName($db, usersUsername($name)), ['role' => $argv[3] ?? '']);
            fwrite(STDOUT, "Role of '$name' is now " . ($argv[3] ?? '') . ".\n");
            break;
        case 'disable':
        case 'enable':
            usersUpdate($db, usersIdByName($db, usersUsername($name)), ['active' => $command === 'enable']);
            fwrite(STDOUT, "'$name' is now " . ($command === 'enable' ? 'enabled' : 'disabled') . ".\n");
            break;
        default:
            usersCliFail('Usage: php cli/users-admin.php list | create <username> <admin|employee> [name] | set-password <username>'
                . ' | set-role <username> <admin|employee> | disable <username> | enable <username>', 64);
    }
} catch (UserError $error) {
    usersCliFail($error->getMessage());
} catch (PDOException $error) {
    usersCliFail('Database: ' . $error->getMessage() . ' (run php cli/orders-admin.php migrate first?)');
}
