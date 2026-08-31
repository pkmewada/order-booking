<?php

$route = trim($_GET['url'] ?? '', '/');

if ($route == '') {
     $route = "login";
}


// Split URL
$routeParts = explode('/', $route);


// Main Page
$page = $routeParts[0];


// Parameter
$params = array_slice($routeParts, 1);


// Make parameter globally available
$GLOBALS['routeParams'] = $params;



// Check normal page

$file = __DIR__ . "/{$page}.php";


if (is_file($file)) {

    require $file;

} else {

    http_response_code(404);

    require __DIR__.'/404.php';

}

?>
