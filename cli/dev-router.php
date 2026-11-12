<?php
// Router for the LOCAL development server only (started by `npm run dev` and the integration tests):
//   php -S 127.0.0.1:8080 -t <parent folder> <project>/cli/dev-router.php
// The app is served under /<project folder>/ like WAMP, so the existing <base href> logic works unchanged.
// Mirrors the Apache rules: private folders are denied, real files are served, pages go through index.php.
if (PHP_SAPI !== 'cli-server') {
    http_response_code(403);
    exit;
}
$root = realpath(__DIR__ . '/..');
$prefix = '/' . basename($root);
$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
if ($path === '/') {
    header('Location: ' . $prefix . '/order-list');
    exit;
}
if (strpos($path . '/', $prefix . '/') !== 0) {
    http_response_code(404);
    exit('Not found');
}
$relative = substr($path, strlen($prefix)) ?: '/';
if (preg_match('~(^|/)(cli|database|storage|tests|node_modules)(/|$)~i', $relative) || preg_match('~(^|/)\.[^/]~', $relative)) {
    http_response_code(403);
    exit('Forbidden');
}
$file = realpath($root . $relative);
if ($file !== false && strpos($file, $root) === 0 && is_file($file)) {
    return false; // served by php -S from the parent document root
}
$_GET['url'] = ltrim($relative, '/');
$_SERVER['SCRIPT_NAME'] = $prefix . '/index.php';
require $root . '/index.php';
