<?php
// Evaluates fixtures with the PHP order rules (api/order-records.php) for the parity test. No database.
if (PHP_SAPI !== 'cli') {
    exit(1);
}
require __DIR__ . '/../../api/order-records.php';

function summarize(array $order): array
{
    $items = [];
    foreach (orderItems($order) as $item) {
        $items[] = ['perSet' => orderPerSet($item), 'sets' => orderSets($item), 'pieces' => orderPieces($item), 'scanned' => orderScanned($item),
            'checked' => orderChecked($item), 'delivered' => orderDelivered($order, $item), 'available' => orderAvailable($order, $item)];
    }
    return ['items' => $items, 'confirmed' => orderConfirmed($order), 'status' => orderDispatchStatus($order)];
}

$results = [];
foreach (json_decode(stream_get_contents(STDIN), true) as $case) {
    $order = $case['order'];
    $result = ['summary' => summarize($order)];
    if (isset($case['scan'])) {
        $copy = $order;
        try {
            $index = orderApplyScan($copy, $case['scan']);
            $result['scan'] = ['index' => $index, 'summary' => summarize($copy), 'dispatchStatus' => $copy['dispatchStatus']];
        } catch (OrderError $error) {
            $result['scan'] = ['error' => $error->getMessage()];
        }
    }
    if (isset($case['deliver'])) {
        $copy = $order;
        try {
            $batch = orderApplyDeliverPartial($copy, $case['deliver'], 1700000000000, static function () { return false; });
            $result['deliver'] = [
                'delivered' => array_map(static function ($item) { return $item['dispatchDeliveredPieces']; }, $copy['items']),
                'batch' => array_map(static function ($item) { return [$item['barcode'], $item['pieces'], $item['sets']]; }, $batch['items']),
                'dispatchStatus' => $copy['dispatchStatus'], 'deliveryStatus' => $copy['deliveryStatus'],
                'confirmedAtSet' => !empty($copy['dispatchConfirmedAt']), 'summary' => summarize($copy),
            ];
        } catch (OrderError $error) {
            $result['deliver'] = ['error' => $error->getMessage()];
        }
    }
    $results[] = $result;
}
echo json_encode($results);
