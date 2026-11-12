<?php
// Sign out: POST with the CSRF token only (see includes/auth.php authLogoutPage). Reached as /logout through index.php.
require_once __DIR__ . '/includes/auth.php';
authLogoutPage();
