<?php
// Authentication and authorization (Phase 2): sessions, sign-in, CSRF and the role rules, in one place.
// Accounts live in `appUsers` (database/cli-migrations/20261112_002_app-users.sql) and are managed with
// `php cli/users-admin.php` or the admin Users page. Roles: admin (everything) and employee
// (Order Booking and Manufacturing). Defining this file has no side effects; nothing runs until a function is called.
require_once __DIR__ . '/db.php';

const AUTH_IDLE_SECONDS = 7200;      // signed out after 2 hours without a request (env AUTH_IDLE_SECONDS overrides)
const AUTH_ABSOLUTE_SECONDS = 43200; // and at the latest 12 hours after signing in
const AUTH_MAX_FAILED_LOGINS = 5;    // then the account is locked for AUTH_LOCK_MINUTES
const AUTH_LOCK_MINUTES = 15;
const AUTH_PASSWORD_MIN = 8;
const AUTH_ROLES = ['admin', 'employee'];
// A valid bcrypt hash of a random string: verified when the username does not exist, so timing does not reveal it.
const AUTH_DUMMY_HASH = '$2y$10$S7jmpOT8fzyiIJXAQ6VThOtNucDOuZ4FQ7zh2mmyiX..O8FbMXmJK';

// Who may use each API. read = GET; create = POST (defaults to write); write = POST/PUT/DELETE.
// 'any' = every signed-in user, 'admin' = admins only. Resources not listed here are admin-only.
const AUTH_API_RULES = [
    // Order Booking
    'orders' => ['read' => 'any', 'write' => 'any'],        // action "import" is admin-only (api/order-records.php)
    'delivery-pdf' => ['read' => 'any', 'write' => 'any'],  // mode "import" is admin-only (api/order-records.php)
    'customer' => ['read' => 'any', 'write' => 'any'],      // Customer Creation is an Order Booking page
    // Manufacturing
    'manufacturing-state' => ['read' => 'any', 'write' => 'any'],
    'bom' => ['read' => 'any', 'write' => 'any'],
    'colour' => ['read' => 'any', 'create' => 'any', 'write' => 'admin'],    // BOM Master adds new colours
    'item-list' => ['read' => 'any', 'create' => 'any', 'write' => 'admin'], // BOM Master adds new items
    // Settings (master data): everyone reads for lookups, only admins change it
    'agent' => ['read' => 'any', 'write' => 'admin'],
    'distributor' => ['read' => 'any', 'write' => 'admin'],
    'transporter' => ['read' => 'any', 'write' => 'admin'],
    'employee' => ['read' => 'any', 'write' => 'admin'],
    'piece-item-list' => ['read' => 'any', 'write' => 'admin'],
    'additional-work' => ['read' => 'any', 'write' => 'admin'],
    'patterns' => ['read' => 'any', 'write' => 'admin'],
    'product' => ['read' => 'any', 'write' => 'admin'],
    'users' => ['read' => 'admin', 'write' => 'admin'],
];

function authStartSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    session_name('ORDERBOOKINGSESSID');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

function authIdleSeconds(): int
{
    $value = (int) getenv('AUTH_IDLE_SECONDS');
    return $value > 0 ? $value : AUTH_IDLE_SECONDS;
}

// Test-only switch from Phase 1: under PHP's built-in server with APP_ENV=development and
// ORDERS_ALLOW_UNAUTHENTICATED_DEV=1 the APIs run as an admin without a session (used by `npm run test:orders`).
// It never works under Apache/LiteSpeed, whatever the environment says.
function authDevBypass(): bool
{
    return PHP_SAPI === 'cli-server' && getenv('APP_ENV') === 'development' && getenv('ORDERS_ALLOW_UNAUTHENTICATED_DEV') === '1';
}

function authEndSession(): void
{
    authStartSession();
    $_SESSION = [];
    if (!headers_sent()) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $params['path'], 'secure' => $params['secure'], 'httponly' => true, 'samesite' => 'Lax']);
    }
    session_destroy();
    $GLOBALS['authUser'] = null;
}

// The signed-in user, or null. Re-checked against the database on every request, so a disabled account,
// a role change or a password reset (authVersion) takes effect immediately.
function authUser(): ?array
{
    if (array_key_exists('authUser', $GLOBALS)) {
        return $GLOBALS['authUser'];
    }
    $GLOBALS['authUser'] = null;
    authStartSession();
    $session = $_SESSION['auth'] ?? null;
    if (!is_array($session) || !is_int($session['id'] ?? null)) {
        return null;
    }
    $now = time();
    if ($now - (int) ($session['lastSeen'] ?? 0) > authIdleSeconds() || $now - (int) ($session['loginAt'] ?? 0) > AUTH_ABSOLUTE_SECONDS) {
        authEndSession();
        $GLOBALS['authExpired'] = true;
        return null;
    }
    try {
        $query = database()->prepare('SELECT id, username, displayName, role, active, authVersion FROM appUsers WHERE id = ?');
        $query->execute([$session['id']]);
        $row = $query->fetch();
    } catch (PDOException $error) {
        error_log('Auth: ' . $error->getMessage());
        return null;
    }
    if (!$row || !(int) $row['active'] || (int) $row['authVersion'] !== (int) ($session['version'] ?? -1)) {
        authEndSession();
        $GLOBALS['authExpired'] = true;
        return null;
    }
    $_SESSION['auth']['lastSeen'] = $now;
    return $GLOBALS['authUser'] = [
        'id' => (int) $row['id'], 'username' => $row['username'], 'displayName' => $row['displayName'] !== '' ? $row['displayName'] : $row['username'],
        'role' => $row['role'],
    ];
}

function authAllows(?array $user, string $needed): bool
{
    return $user !== null && ($needed === 'any' || $user['role'] === $needed);
}

function authIsAdmin(): bool
{
    return authAllows($GLOBALS['authUser'] ?? null, 'admin');
}

function authCsrfToken(): string
{
    authStartSession();
    if (!is_string($_SESSION['csrf'] ?? null) || strlen($_SESSION['csrf']) !== 64) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function authCsrfValid($token): bool
{
    authStartSession();
    return is_string($token) && is_string($_SESSION['csrf'] ?? null) && hash_equals($_SESSION['csrf'], $token);
}

// Base URL of the app ("/order-bookings/" locally, "/" on live), for redirects from any entry point.
function authBaseUrl(): string
{
    $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/');
    $nested = preg_match('~/(manufacturing|orderBooking|settings|api)/[^/]+$~', $script) === 1;
    $base = str_replace('\\', '/', $nested ? dirname(dirname($script)) : dirname($script));
    return rtrim($base, '/') . '/';
}

// The page to return to after signing in: only a route of this app, never another site.
function authSafeNext($next): string
{
    return is_string($next) && preg_match('~^[a-z0-9-]+(\?[A-Za-z0-9=&_.%-]*)?$~', $next) && strpos($next, 'login') !== 0 ? $next : 'dashboard';
}

function authRedirect(string $route): void
{
    $url = authBaseUrl() . $route;
    if (!headers_sent()) {
        header('Location: ' . $url, true, 303);
    } else {
        echo '<script>location.replace(' . json_encode($url) . ');</script>';
    }
    exit;
}

function authJson(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['success' => false] + $body, JSON_UNESCAPED_UNICODE);
    exit;
}

// Pages: any signed-in user, or 'admin'. Signed-out visitors go to the sign-in page and come back afterwards.
function authRequirePage(string $needed = 'any'): array
{
    $user = authUser();
    if (!$user) {
        $route = ltrim((string) ($_GET['url'] ?? ''), '/');
        $query = $_GET;
        unset($query['url']);
        $next = $route !== '' ? $route . ($query ? '?' . http_build_query($query) : '') : '';
        $params = array_filter(['expired' => !empty($GLOBALS['authExpired']) ? '1' : null, 'next' => authSafeNext($next) !== 'dashboard' ? $next : null]);
        authRedirect('login' . ($params ? '?' . http_build_query($params) : ''));
    }
    if (!authAllows($user, $needed)) {
        http_response_code(403);
        header('Cache-Control: no-store');
        echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Access denied</title></head><body style="font-family:sans-serif;padding:40px">'
            . '<h1>Access denied</h1><p>This page is for administrators.</p><p><a href="' . htmlspecialchars(authBaseUrl() . 'dashboard', ENT_QUOTES) . '">Back to the dashboard</a></p></body></html>';
        exit;
    }
    header('Cache-Control: no-store');
    return $user;
}

// APIs: 401 without a session, 403 without the role or (for changes) without a valid CSRF token.
function authRequireApi(string $resource): array
{
    if (authDevBypass()) {
        return $GLOBALS['authUser'] = ['id' => 0, 'username' => 'dev', 'displayName' => 'dev', 'role' => 'admin'];
    }
    $user = authUser();
    if (!$user) {
        authJson(401, ['loginRequired' => true, 'message' => !empty($GLOBALS['authExpired'])
            ? 'Your session has expired. Login required: please sign in again.'
            : 'Login required. Please sign in.']);
    }
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $kind = in_array($method, ['GET', 'HEAD'], true) ? 'read' : ($method === 'POST' ? 'create' : 'write');
    $rule = AUTH_API_RULES[$resource] ?? ['read' => 'admin', 'write' => 'admin'];
    if (!authAllows($user, $rule[$kind] ?? $rule['write'])) {
        authJson(403, ['message' => 'You do not have permission for this action.']);
    }
    if ($kind !== 'read' && !authCsrfValid($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) {
        authJson(403, ['csrf' => true, 'message' => 'Security token missing or expired. Reload the page and try again.']);
    }
    return $user;
}

// Meta tags and the small fetch hook for every signed-in page: same-origin changes carry the CSRF token,
// and an API answer "login required" sends the browser to the sign-in page (then back to this page).
function authHeadTags(array $user): string
{
    $token = htmlspecialchars(authCsrfToken(), ENT_QUOTES, 'UTF-8');
    $role = htmlspecialchars($user['role'], ENT_QUOTES, 'UTF-8');
    return <<<HTML
    <meta name="csrf-token" content="$token">
    <meta name="app-user-role" content="$role">
    <script>
    (function () {
        var token = document.querySelector('meta[name="csrf-token"]').content;
        var nativeFetch = window.fetch.bind(window);
        window.fetch = function (input, init) {
            init = init || {};
            var isRequest = typeof Request !== 'undefined' && input instanceof Request;
            var url = new URL(isRequest ? input.url : String(input), document.baseURI);
            var method = String(init.method || (isRequest ? input.method : 'GET')).toUpperCase();
            var sameOrigin = url.origin === location.origin;
            if (sameOrigin && method !== 'GET' && method !== 'HEAD') {
                var headers = new Headers(init.headers || (isRequest ? input.headers : undefined));
                headers.set('X-CSRF-Token', token);
                init = Object.assign({}, init, { headers: headers });
            }
            return nativeFetch(input, init).then(function (response) {
                if (sameOrigin && response.status === 401) {
                    response.clone().json().then(function (body) {
                        if (!body || !body.loginRequired) return;
                        var base = new URL(document.baseURI).pathname;
                        var here = location.pathname.indexOf(base) === 0 ? location.pathname.slice(base.length) + location.search : '';
                        location.href = 'login?expired=1' + (here ? '&next=' + encodeURIComponent(here) : '');
                    }).catch(function () {});
                }
                return response;
            });
        };
    })();
    </script>
HTML;
}

function authHashPassword(string $password): string
{
    return password_hash($password, PASSWORD_DEFAULT);
}

function authValidPassword($password): bool
{
    return is_string($password) && strlen($password) >= AUTH_PASSWORD_MIN && strlen($password) <= 200;
}

// Checks a username and password. On success the session ID is regenerated (no session fixation).
function authLogin(string $username, string $password): array
{
    $db = database();
    $query = $db->prepare('SELECT id, passwordHash, active, authVersion, failedLogins, (lockedUntil IS NOT NULL AND lockedUntil > NOW()) AS locked
        FROM appUsers WHERE username = ?');
    $query->execute([$username]);
    $row = $query->fetch();
    if (!$row) {
        password_verify($password, AUTH_DUMMY_HASH);
        return ['ok' => false, 'message' => 'Invalid username or password.'];
    }
    if ((int) $row['locked']) {
        return ['ok' => false, 'message' => 'Too many failed sign-in attempts. Try again in ' . AUTH_LOCK_MINUTES . ' minutes.'];
    }
    if (!password_verify($password, $row['passwordHash'])) {
        $failed = (int) $row['failedLogins'] + 1;
        if ($failed >= AUTH_MAX_FAILED_LOGINS) {
            $db->prepare('UPDATE appUsers SET failedLogins = 0, lockedUntil = NOW() + INTERVAL ' . AUTH_LOCK_MINUTES . ' MINUTE WHERE id = ?')->execute([$row['id']]);
        } else {
            $db->prepare('UPDATE appUsers SET failedLogins = ? WHERE id = ?')->execute([$failed, $row['id']]);
        }
        return ['ok' => false, 'message' => 'Invalid username or password.'];
    }
    if (!(int) $row['active']) {
        return ['ok' => false, 'message' => 'This account is disabled. Ask an administrator.'];
    }
    if (password_needs_rehash($row['passwordHash'], PASSWORD_DEFAULT)) {
        $db->prepare('UPDATE appUsers SET passwordHash = ? WHERE id = ?')->execute([authHashPassword($password), $row['id']]);
    }
    $db->prepare('UPDATE appUsers SET failedLogins = 0, lockedUntil = NULL, lastLoginAt = NOW() WHERE id = ?')->execute([$row['id']]);
    authStartSession();
    session_regenerate_id(true);
    $now = time();
    $_SESSION = ['auth' => ['id' => (int) $row['id'], 'version' => (int) $row['authVersion'], 'loginAt' => $now, 'lastSeen' => $now]];
    authCsrfToken();
    unset($GLOBALS['authUser'], $GLOBALS['authExpired']);
    return ['ok' => true, 'message' => ''];
}

// The sign-in page (login.php): handles the form and returns what the page shows.
function authLoginPage(): array
{
    authStartSession();
    header('Cache-Control: no-store');
    header('X-Frame-Options: DENY');
    $next = authSafeNext($_POST['next'] ?? $_GET['next'] ?? '');
    $view = ['error' => '', 'notice' => '', 'username' => '', 'next' => $next];
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        try {
            if (authUser()) {
                authRedirect($next);
            }
        } catch (Throwable $error) {
            error_log('Auth: ' . $error->getMessage());
        }
        if (!empty($_GET['expired']) || !empty($GLOBALS['authExpired'])) {
            $view['notice'] = 'Your session has expired. Please sign in again.';
        } elseif (!empty($_GET['signedOut'])) {
            $view['notice'] = 'You have signed out.';
        }
        return $view;
    }
    $view['username'] = is_string($_POST['username'] ?? null) ? substr(trim($_POST['username']), 0, 64) : '';
    $password = is_string($_POST['password'] ?? null) ? $_POST['password'] : '';
    if (!authCsrfValid($_POST['_csrf'] ?? null)) {
        $view['error'] = 'The sign-in form expired. Please try again.';
        return $view;
    }
    if ($view['username'] === '' || $password === '') {
        $view['error'] = 'Enter your username and password.';
        return $view;
    }
    try {
        $result = authLogin($view['username'], $password);
    } catch (PDOException $error) {
        error_log('Auth: ' . $error->getMessage());
        http_response_code(503);
        $view['error'] = 'Sign-in is not available. The accounts table may not be set up yet (php cli/orders-admin.php migrate).';
        return $view;
    }
    if ($result['ok']) {
        authRedirect($next);
    }
    http_response_code(401);
    $view['error'] = $result['message'];
    return $view;
}

// POST logout (with the CSRF token), so another site cannot sign a user out.
function authLogoutPage(): void
{
    authStartSession();
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && authCsrfValid($_POST['_csrf'] ?? null)) {
        authEndSession();
        authRedirect('login?signedOut=1');
    }
    authRedirect(authUser() ? 'dashboard' : 'login');
}
