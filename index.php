<?php

$route = trim($_GET['url'] ?? '', '/');

if ($route == '') {
     $route = "login";
}


// Split URL
$routeParts = explode('/', $route);


// Main Page
$page = strtolower($routeParts[0]);


// Parameter
$params = array_slice($routeParts, 1);


// Make parameter globally available
$GLOBALS['routeParams'] = $params;



// Check normal page

$pageRoutes = [
    'batch' => 'manufacturing/batch.php',
    'batch-approval' => 'manufacturing/batchApproval.php',
    'bom-master' => 'manufacturing/bomMaster.php',
    'bundling' => 'manufacturing/bundling.php',
    'cutting-manager' => 'manufacturing/cuttingManager.php',
    'damage-repair' => 'manufacturing/damageRepair.php',
    'additional-work-manager' => 'manufacturing/additional-work-manager.php',
    'digital-print' => 'manufacturing/additional-work-manager.php',
    'embroidery' => 'manufacturing/additional-work-manager.php',
    'final-production' => 'manufacturing/finalProduction.php',
    'handwork' => 'manufacturing/additional-work-manager.php',
    'ironing' => 'manufacturing/ironing.php',
    'inventory' => 'manufacturing/inventory.php',
    'packing' => 'manufacturing/packing.php',
    'peco' => 'manufacturing/additional-work-manager.php',
    'product-manager' => 'manufacturing/productManager.php',
    'screen-print' => 'manufacturing/additional-work-manager.php',
    'stitching-manager' => 'manufacturing/stitchingManager.php',
    'stock' => 'manufacturing/stock.php',
    'requirment' => 'manufacturing/requirements.php',
    'requirements' => 'manufacturing/requirements.php',
    'customer-creation' => 'orderBooking/customerCreation.php',
    'dashboard' => 'orderBooking/dashboard.php',
    'delivery' => 'orderBooking/delivery.php',
    'dispatch-confirm' => 'orderBooking/dispatchConfirm.php',
    'dispatch' => 'orderBooking/dispatch.php',
    'order-list' => 'orderBooking/orderList.php',
    'order-punch' => 'orderBooking/orderPunch.php',
    'additional-work' => 'settings/additionalWork.php',
    'agent' => 'settings/agent.php',
    'colour' => 'settings/colour.php',
    'distributor' => 'settings/distributor.php',
    'empolyee' => 'settings/employee.php',
    'employee' => 'settings/employee.php',
    'item-list' => 'settings/itemList.php',
    'pattern' => 'settings/pattern.php',
    'product-creation' => 'settings/productCreation.php',
    'product-form' => 'settings/productForm.php',
    'setting' => 'settings/settings.php',
    'transporter' => 'settings/transporter.php',
];

$file = __DIR__ . '/' . ($pageRoutes[$page] ?? "{$page}.php");


if (is_file($file)) {

    require $file;

} else {

    http_response_code(404);

    require __DIR__.'/404.php';

}

?>
