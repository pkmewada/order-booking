<?php
// Sign-in accounts (table appUsers): shared by the admin Users page (api/users.php) and `php cli/users-admin.php`.
// Any change to role, status or password increments authVersion, which signs that user out everywhere.
require_once __DIR__ . '/auth.php';

class UserError extends RuntimeException
{
    public $status;

    public function __construct(string $message, int $status = 422)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

function usersList(PDO $db): array
{
    $rows = $db->query('SELECT id, username, displayName, role, active, lastLoginAt, createdAt,
        (lockedUntil IS NOT NULL AND lockedUntil > NOW()) AS locked FROM appUsers ORDER BY username')->fetchAll();
    return array_map(static function (array $row): array {
        return ['id' => (int) $row['id'], 'username' => $row['username'], 'displayName' => $row['displayName'], 'role' => $row['role'],
            'active' => (bool) $row['active'], 'locked' => (bool) $row['locked'], 'lastLoginAt' => $row['lastLoginAt'], 'createdAt' => $row['createdAt']];
    }, $rows);
}

function usersUsername($value): string
{
    $value = is_string($value) ? trim($value) : '';
    if (!preg_match('/^[A-Za-z0-9._-]{3,64}$/D', $value)) {
        throw new UserError('Username: 3 to 64 letters, digits, dot, dash or underscore.');
    }
    return $value;
}

function usersDisplayName($value): string
{
    $value = is_string($value) ? trim($value) : '';
    if (mb_strlen($value) > 150) {
        throw new UserError('Name: maximum 150 characters.');
    }
    return $value;
}

function usersRole($value): string
{
    if (!in_array($value, AUTH_ROLES, true)) {
        throw new UserError('Role must be admin or employee.');
    }
    return $value;
}

function usersPassword($value): string
{
    if (!authValidPassword($value)) {
        throw new UserError('Password: at least ' . AUTH_PASSWORD_MIN . ' characters (maximum 200).');
    }
    return $value;
}

function usersCreate(PDO $db, array $data): array
{
    $username = usersUsername($data['username'] ?? null);
    $fields = [$username, usersDisplayName($data['displayName'] ?? ''), authHashPassword(usersPassword($data['password'] ?? null)), usersRole($data['role'] ?? 'employee')];
    try {
        $db->prepare('INSERT INTO appUsers (username, displayName, passwordHash, role) VALUES (?, ?, ?, ?)')->execute($fields);
    } catch (PDOException $error) {
        if (($error->errorInfo[1] ?? null) === 1062) {
            throw new UserError('This username already exists.', 409);
        }
        throw $error;
    }
    return usersFind($db, (int) $db->lastInsertId());
}

function usersFind(PDO $db, int $id): array
{
    foreach (usersList($db) as $user) {
        if ($user['id'] === $id) {
            return $user;
        }
    }
    throw new UserError('User not found. Refresh the list.', 404);
}

// Role and active status. The last active admin can never be demoted or disabled (no lock-out).
function usersUpdate(PDO $db, int $id, array $data): array
{
    $db->beginTransaction();
    try {
        $admins = $db->query("SELECT id FROM appUsers WHERE role = 'admin' AND active = 1 FOR UPDATE")->fetchAll(PDO::FETCH_COLUMN);
        $query = $db->prepare('SELECT id, displayName, role, active FROM appUsers WHERE id = ? FOR UPDATE');
        $query->execute([$id]);
        $current = $query->fetch();
        if (!$current) {
            throw new UserError('User not found. Refresh the list.', 404);
        }
        $displayName = array_key_exists('displayName', $data) ? usersDisplayName($data['displayName']) : $current['displayName'];
        $role = array_key_exists('role', $data) ? usersRole($data['role']) : $current['role'];
        $active = array_key_exists('active', $data) ? (bool) $data['active'] : (bool) $current['active'];
        $wasActiveAdmin = $current['role'] === 'admin' && (int) $current['active'];
        if ($wasActiveAdmin && ($role !== 'admin' || !$active) && count($admins) <= 1) {
            throw new UserError('This is the last active admin. Create or enable another admin first.', 409);
        }
        $access = $role !== $current['role'] || $active !== (bool) $current['active'];
        $db->prepare('UPDATE appUsers SET displayName = ?, role = ?, active = ?, authVersion = authVersion + ? WHERE id = ?')
            ->execute([$displayName, $role, $active ? 1 : 0, $access ? 1 : 0, $id]);
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }
    return usersFind($db, $id);
}

// New password: also clears a lock-out and signs the user out everywhere.
function usersSetPassword(PDO $db, int $id, $password): array
{
    $query = $db->prepare('UPDATE appUsers SET passwordHash = ?, failedLogins = 0, lockedUntil = NULL, authVersion = authVersion + 1 WHERE id = ?');
    $query->execute([authHashPassword(usersPassword($password)), $id]);
    if ($query->rowCount() === 0) {
        usersFind($db, $id); // throws 404 when missing
    }
    return usersFind($db, $id);
}

function usersIdByName(PDO $db, string $username): int
{
    $query = $db->prepare('SELECT id FROM appUsers WHERE username = ?');
    $query->execute([$username]);
    $id = $query->fetchColumn();
    if ($id === false) {
        throw new UserError("No user named '$username'.", 404);
    }
    return (int) $id;
}

// GET: list. POST {action: create|update|setPassword, ...}. Admins only (AUTH_API_RULES['users']).
function usersApi(): void
{
    $admin = authRequireApi('users');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    try {
        $db = database();
        if ($method === 'GET') {
            authJsonOk(['users' => usersList($db), 'me' => $admin['id']]);
        }
        if ($method !== 'POST') {
            header('Allow: GET, POST');
            authJson(405, ['message' => 'Method not allowed.']);
        }
        if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
            authJson(415, ['message' => 'Content-Type must be application/json.']);
        }
        $data = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($data)) {
            authJson(400, ['message' => 'JSON object required.']);
        }
        $id = (int) ($data['id'] ?? 0);
        switch ($data['action'] ?? '') {
            case 'create':
                authJsonOk(['user' => usersCreate($db, $data)]);
            case 'update':
                authJsonOk(['user' => usersUpdate($db, $id, $data)]);
            case 'setPassword':
                authJsonOk(['user' => usersSetPassword($db, $id, $data['password'] ?? null)]);
        }
        authJson(400, ['message' => 'Unknown action.']);
    } catch (UserError $error) {
        authJson($error->status, ['message' => $error->getMessage()]);
    } catch (Throwable $error) {
        error_log('Users API: ' . $error->getMessage());
        authJson(503, ['message' => 'Accounts are unavailable. Check that the database is migrated (php cli/orders-admin.php migrate).']);
    }
}

function authJsonOk(array $data): void
{
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}
