<?php
// Orders, dispatch and delivery (SAP Phase 1). Every business rule is enforced here on the server.
// The quantity rules mirror assets/js/orderQuantities.js and assets/js/dispatchFlow.js
// (tests/order-rules-parity.integration.cjs keeps them identical).
require_once __DIR__ . '/product-records.php';

const ORDERS_MIGRATION = 'cli/20261112_001_customer-orders.sql';
const ORDER_PDF_MAX_BYTES = 10485760; // 10 MB (owner decision D2)
const ORDER_MAX_ITEMS = 500;
const ORDER_MAX_QTY = 100000;
const ORDER_TEXT_LIMITS = [
    'status' => 20, 'customerId' => 64, 'customerName' => 150, 'shopName' => 150, 'city' => 100,
    'contact' => 40, 'existingCustomer' => 10, 'agentId' => 64, 'agentName' => 150, 'transporterId' => 64,
    'transportName' => 150, 'distributorId' => 64, 'orderTakenBy' => 150, 'dispatchStatus' => 20,
    'deliveryStatus' => 20, 'dispatchConfirmedItems' => 65000,
];
const ORDER_NULLABLE_TEXT = ['agentId', 'transporterId', 'distributorId', 'orderTakenBy', 'dispatchStatus', 'deliveryStatus', 'dispatchConfirmedItems'];
const ORDER_TIME_FIELDS = ['createdAt', 'updatedAt', 'dispatchPassedAt', 'dispatchConfirmedAt', 'dispatchCompletedAt', 'deliveredAt'];
const ORDER_ITEM_TEXT_LIMITS = ['barcode' => 150, 'description' => 255, 'designNumber' => 100, 'brand' => 100, 'size' => 50, 'color' => 150];

class OrderError extends RuntimeException
{
    public $status;

    public function __construct(string $message, int $status = 422)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

// There is no login yet. Unauthenticated access exists ONLY behind an explicit local-development
// switch. Every other environment, including production, fails closed (owner decision D3).
// The switch only works under PHP's built-in server (`npm run dev`), never under Apache/LiteSpeed,
// so a stray SetEnv on a web server cannot open the API.
function ordersRequireAccess(): void
{
    if (PHP_SAPI === 'cli-server' && getenv('APP_ENV') === 'development' && getenv('ORDERS_ALLOW_UNAUTHENTICATED_DEV') === '1') {
        return;
    }
    respond(401, ['success' => false, 'message' => 'Login required. Order APIs stay disabled until authentication is implemented.']);
}

// The new APIs stay disabled until `php cli/orders-admin.php migrate` has verified the schema.
function ordersEnsureReady(PDO $db): void
{
    try {
        $query = $db->prepare('SELECT 1 FROM appSchemaMigrations WHERE migration = ?');
        $query->execute([ORDERS_MIGRATION]);
        $ready = (bool) $query->fetchColumn();
    } catch (PDOException $error) {
        $ready = false;
    }
    if (!$ready) {
        throw new OrderError('Orders database is not migrated. Run: php cli/orders-admin.php migrate', 503);
    }
}

// ---------- Time (UTC, millisecond precision) ----------

function ordersNowMs(): int
{
    return (int) floor(microtime(true) * 1000);
}

function ordersIsoFromMs(int $ms): string
{
    return gmdate('Y-m-d\TH:i:s', intdiv($ms, 1000)) . '.' . str_pad((string) ($ms % 1000), 3, '0', STR_PAD_LEFT) . 'Z';
}

function ordersIsoFromDb(?string $value): ?string
{
    if ($value === null) {
        return null;
    }
    $time = DateTime::createFromFormat('Y-m-d H:i:s.u', $value, new DateTimeZone('UTC'))
        ?: DateTime::createFromFormat('Y-m-d H:i:s', $value, new DateTimeZone('UTC'));
    return $time ? $time->format('Y-m-d\TH:i:s.v\Z') : null;
}

function ordersDbFromIso($value, string $field): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_string($value) || strlen($value) > 40) {
        throw new OrderError("Invalid $field.");
    }
    try {
        $time = new DateTime($value, new DateTimeZone('UTC'));
    } catch (Exception $error) {
        throw new OrderError("Invalid $field.");
    }
    $time->setTimezone(new DateTimeZone('UTC'));
    return $time->format('Y-m-d H:i:s.v');
}

// ---------- Quantity rules (mirror OrderQuantities / DispatchFlow) ----------

function orderNumber($value): float
{
    return is_numeric($value) ? (float) $value : 0.0;
}

function orderPerSet(array $item): int
{
    $brand = preg_replace('/[^A-Z]/', '', strtoupper((string) ($item['brand'] ?? '')));
    $counts = ['NIVIBLOSSOM' => 4, 'NIVIBLOSSOMA' => 4, 'LITTLEDOLLY' => 5, 'AMARI' => 3];
    if (isset($counts[$brand])) {
        return $counts[$brand];
    }
    $raw = $item['piecesPerSet'] ?? null;
    if (!$raw) {
        $raw = $item['pieceCount'] ?? null;
    }
    if (!$raw && isset($item['pieces']) && is_array($item['pieces'])) {
        $raw = count($item['pieces']);
    }
    $number = orderNumber($raw);
    return max(1, (int) floor($number ?: 1));
}

function orderSets(array $item): int
{
    return max(0, (int) floor(orderNumber($item['qty'] ?? 0)));
}

function orderPieces(array $item): int
{
    return orderSets($item) * orderPerSet($item);
}

function orderScanned(array $item): int
{
    return min(orderPieces($item), max(0, (int) floor(orderNumber($item['dispatchScannedPieces'] ?? 0))));
}

function orderChecked(array $item): bool
{
    return orderPieces($item) > 0 && orderScanned($item) === orderPieces($item);
}

function orderDelivered(array $order, array $item): int
{
    $stored = (int) floor(orderNumber($item['dispatchDeliveredPieces'] ?? 0));
    if (!$stored && !empty($order['deliveredAt']) && !isset($order['deliveryBatches'])) {
        $stored = orderPieces($item);
    }
    return min(orderPieces($item), max(0, $stored));
}

function orderItems(array $order): array
{
    return isset($order['items']) && is_array($order['items']) ? array_values($order['items']) : [];
}

function orderConfirmed(array $order): bool
{
    $items = orderItems($order);
    if (!$items) {
        return false;
    }
    foreach ($items as $item) {
        if (orderDelivered($order, $item) < orderPieces($item)) {
            return false;
        }
    }
    return true;
}

function orderDispatchStatus(array $order): string
{
    if (orderConfirmed($order)) {
        return 'Completed';
    }
    foreach (orderItems($order) as $item) {
        if (orderScanned($item) > 0) {
            return 'In Progress';
        }
    }
    return 'Pending';
}

function orderAvailable(array $order, array $item): int
{
    return max(0, orderScanned($item) - orderDelivered($order, $item));
}

function orderSignature(array $order): string
{
    $rows = array_map(static function ($item) {
        return [$item['barcode'] ?? null, $item['brand'] ?? null, $item['size'] ?? null, orderSets($item), orderPerSet($item)];
    }, orderItems($order));
    return json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function orderTotals(array $items): array
{
    $sets = 0;
    $pieces = 0;
    foreach ($items as $item) {
        $sets += orderSets($item);
        $pieces += orderPieces($item);
    }
    return [$sets, $pieces];
}

// Mirrors DispatchFlow.scan. Returns the index of the scanned line.
function orderApplyScan(array &$order, string $barcode): int
{
    if (orderConfirmed($order)) {
        throw new OrderError('This dispatch has already been confirmed.');
    }
    $code = trim($barcode);
    $found = false;
    foreach ($order['items'] as $index => $item) {
        if (trim((string) ($item['barcode'] ?? '')) !== $code) {
            continue;
        }
        $found = true;
        if (!orderChecked($item)) {
            $order['items'][$index]['dispatchScannedPieces'] = orderScanned($item) + 1;
            $order['items'][$index]['dispatchChecked'] = orderChecked($order['items'][$index]);
            $order['dispatchStatus'] = orderDispatchStatus($order);
            return $index;
        }
    }
    throw new OrderError($found ? 'All required pieces for this barcode have been scanned.' : 'This barcode is not in the selected order.');
}

// Mirrors DispatchFlow.deliverPartial. $selections are whole sets per line, aligned with items.
function orderApplyDeliverPartial(array &$order, array $selections, int $nowMs, callable $batchIdTaken): array
{
    if (empty($order['dispatchPassedAt'])) {
        throw new OrderError('Pass this order from Order List first.');
    }
    $items = orderItems($order);
    if (count($selections) !== count($items)) {
        throw new OrderError('Order changed. Reopen delivery details.');
    }
    $rows = [];
    $any = false;
    foreach ($items as $index => $item) {
        $sets = $selections[$index];
        if (!is_int($sets) || $sets < 0) {
            throw new OrderError('Pass only whole sets within the available scanned quantity.');
        }
        $count = $sets * orderPerSet($item);
        if ($count > orderAvailable($order, $item)) {
            throw new OrderError('Pass only whole sets within the available scanned quantity.');
        }
        $rows[] = [$index, $count, orderDelivered($order, $item)];
        $any = $any || $count > 0;
    }
    if (!$any) {
        throw new OrderError('Choose at least one complete set to pass.');
    }
    $timestamp = ordersIsoFromMs($nowMs);
    $baseId = 'DLV-' . $order['id'] . '-' . $nowMs;
    $batchId = $baseId;
    $suffix = 1;
    while ($batchIdTaken($batchId)) {
        $batchId = $baseId . '-' . $suffix++;
    }
    $batch = ['id' => $batchId, 'createdAt' => $timestamp, 'status' => 'In Progress', 'completedAt' => null, 'isLegacy' => false, 'pdf' => null, 'items' => []];
    foreach ($rows as [$index, $count, $previous]) {
        $order['items'][$index]['dispatchDeliveredPieces'] = $previous + $count;
        if ($count) {
            $item = $order['items'][$index];
            $perSet = orderPerSet($item);
            $batch['items'][] = [
                'orderItemId' => $item['id'] ?? null, 'barcode' => $item['barcode'] ?? '', 'description' => $item['description'] ?? '',
                'designNumber' => $item['designNumber'] ?? null, 'brand' => $item['brand'] ?? '', 'size' => $item['size'] ?? '',
                'color' => $item['color'] ?? null, 'piecesPerSet' => $perSet, 'qty' => $count / $perSet, 'sets' => $count / $perSet,
                'pieces' => $count, 'dispatchScannedPieces' => $count, 'dispatchDeliveredPieces' => $count,
            ];
        }
    }
    $order['deliveryBatches'] = array_merge($order['deliveryBatches'] ?? [], [$batch]);
    $order['deliveredAt'] = $timestamp;
    $order['deliveryStatus'] = 'In Progress';
    $order['dispatchStatus'] = orderDispatchStatus($order);
    if (orderConfirmed($order)) {
        $order['dispatchConfirmedAt'] = $timestamp;
        $order['dispatchCompletedAt'] = $timestamp;
        $order['dispatchConfirmedItems'] = orderSignature($order);
    }
    return $batch;
}

function orderDesignKey(array $item): string
{
    foreach (['designNumber', 'description', 'itemDescription', 'itemCode'] as $field) {
        if (isset($item[$field]) && (string) $item[$field] !== '') {
            return strtolower(trim((string) $item[$field]));
        }
    }
    return '';
}

// Mirrors the Replace design rules in assets/js/dispatch.js.
function orderApplyReplace(array &$order, int $index, array $product, int $nowMs): void
{
    $item = $order['items'][$index] ?? null;
    if (!$item) {
        throw new OrderError('Order changed. Close and reopen Replace.', 409);
    }
    foreach ($order['items'] as $row) {
        if (orderDesignKey($row) === orderDesignKey($product) || ($product['barcode'] && ($row['barcode'] ?? '') === $product['barcode'])) {
            throw new OrderError('This design is already selected in this order. Choose another design.');
        }
    }
    $passed = orderDelivered($order, $item);
    $perSet = orderPerSet($item);
    if ($passed % $perSet) {
        throw new OrderError('This item has a previous partial-piece delivery. Replace an item with complete passed sets.');
    }
    $passedSets = intdiv($passed, $perSet);
    $remainingSets = orderSets($item) - $passedSets;
    if ($remainingSets < 1) {
        throw new OrderError('All sets have already been passed.');
    }
    $design = (string) ($product['designNumber'] ?? $product['description'] ?? '');
    $next = [
        'barcode' => $product['barcode'], 'description' => $design, 'designNumber' => $design, 'brand' => $product['brand'] ?? '',
        'size' => $product['size'] ?? '', 'color' => $product['color'] ?? null, 'piecesPerSet' => orderPerSet($product),
        'qty' => $remainingSets, 'dispatchScannedPieces' => 0, 'dispatchDeliveredPieces' => 0, 'dispatchChecked' => false,
    ];
    if ($passedSets) {
        $order['items'][$index]['qty'] = $passedSets;
        $order['items'][$index]['dispatchScannedPieces'] = $passed;
        $order['items'][$index]['dispatchDeliveredPieces'] = $passed;
        array_splice($order['items'], $index + 1, 0, [$next]);
    } else {
        $order['items'][$index] = $next; // no id: the old line is deleted and the new one inserted
    }
    [$order['totalSets'], $order['totalPcs']] = orderTotals($order['items']);
    $order['dispatchStatus'] = orderDispatchStatus($order);
    $order['updatedAt'] = ordersIsoFromMs($nowMs);
    $order['dispatchConfirmedAt'] = null;
    $order['dispatchCompletedAt'] = null;
    $order['dispatchConfirmedItems'] = null;
}

// ---------- Persistence ----------

function ordersTransaction(PDO $db, callable $work)
{
    for ($attempt = 1; ; $attempt++) {
        try {
            $db->beginTransaction();
            $result = $work($db);
            $db->commit();
            return $result;
        } catch (Throwable $error) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            $code = $error instanceof PDOException ? (int) ($error->errorInfo[1] ?? 0) : 0;
            if (in_array($code, [1213, 1205], true) && $attempt < 3) {
                usleep(random_int(5000, 30000));
                continue; // deadlock or lock wait: retry the whole transaction (bounded)
            }
            throw $error;
        }
    }
}

function ordersNumber($value)
{
    $number = (float) $value;
    return floor($number) === $number ? (int) $number : $number;
}

// Loads orders in the same JSON shape the pages used in localStorage. With $lock, rows are locked
// in the fixed order: order row, then its item rows, then its batch rows.
function ordersLoad(PDO $db, ?string $id = null, bool $lock = false): array
{
    $suffix = $lock ? ' FOR UPDATE' : '';
    if ($id === null) {
        $orderRows = $db->query('SELECT * FROM customerOrders ORDER BY createdAt DESC, id DESC')->fetchAll();
        $itemRows = $db->query('SELECT * FROM customerOrderItems ORDER BY orderId, sortOrder, id')->fetchAll();
        $batchRows = $db->query('SELECT * FROM deliveryBatches ORDER BY orderId, createdAt, id')->fetchAll();
        $batchItemRows = $db->query('SELECT * FROM deliveryBatchItems ORDER BY batchId, sortOrder, id')->fetchAll();
    } else {
        $query = $db->prepare('SELECT * FROM customerOrders WHERE id = ?' . $suffix);
        $query->execute([$id]);
        $orderRows = $query->fetchAll();
        if (!$orderRows) {
            return [];
        }
        $query = $db->prepare('SELECT * FROM customerOrderItems WHERE orderId = ? ORDER BY sortOrder, id' . $suffix);
        $query->execute([$id]);
        $itemRows = $query->fetchAll();
        $query = $db->prepare('SELECT * FROM deliveryBatches WHERE orderId = ? ORDER BY createdAt, id' . $suffix);
        $query->execute([$id]);
        $batchRows = $query->fetchAll();
        $query = $db->prepare('SELECT bi.* FROM deliveryBatchItems bi JOIN deliveryBatches b ON b.id = bi.batchId WHERE b.orderId = ? ORDER BY bi.batchId, bi.sortOrder, bi.id');
        $query->execute([$id]);
        $batchItemRows = $query->fetchAll();
    }
    $items = [];
    foreach ($itemRows as $row) {
        $items[$row['orderId']][] = [
            'id' => (int) $row['id'], 'barcode' => $row['barcode'], 'description' => $row['description'],
            'designNumber' => $row['designNumber'], 'brand' => $row['brand'], 'size' => $row['size'], 'color' => $row['color'],
            'piecesPerSet' => (int) $row['piecesPerSet'], 'qty' => (int) $row['qty'],
            'dispatchScannedPieces' => (int) $row['dispatchScannedPieces'], 'dispatchDeliveredPieces' => (int) $row['dispatchDeliveredPieces'],
            'dispatchChecked' => (bool) $row['dispatchChecked'],
        ];
    }
    $batchItems = [];
    foreach ($batchItemRows as $row) {
        $sets = ordersNumber($row['sets']);
        $batchItems[$row['batchId']][] = [
            'orderItemId' => $row['orderItemId'] === null ? null : (int) $row['orderItemId'], 'barcode' => $row['barcode'],
            'description' => $row['description'], 'designNumber' => $row['designNumber'], 'brand' => $row['brand'], 'size' => $row['size'],
            'color' => $row['color'], 'piecesPerSet' => (int) $row['piecesPerSet'], 'qty' => $sets, 'sets' => $sets,
            'pieces' => (int) $row['pieces'], 'dispatchScannedPieces' => (int) $row['pieces'], 'dispatchDeliveredPieces' => (int) $row['pieces'],
        ];
    }
    $batches = [];
    foreach ($batchRows as $row) {
        $pdf = null;
        if ($row['pdfState'] !== 'none') {
            $pdf = ['name' => $row['pdfName'], 'size' => $row['pdfSize'] === null ? null : (int) $row['pdfSize'],
                'uploadedAt' => ordersIsoFromDb($row['pdfUploadedAt']), 'state' => $row['pdfState']];
        }
        $batches[$row['orderId']][] = [
            'id' => $row['id'], 'createdAt' => ordersIsoFromDb($row['createdAt']), 'status' => $row['status'],
            'completedAt' => ordersIsoFromDb($row['completedAt']), 'isLegacy' => (bool) $row['isLegacy'],
            'pdf' => $pdf, 'items' => $batchItems[$row['id']] ?? [],
        ];
    }
    $orders = [];
    foreach ($orderRows as $row) {
        $order = [
            'id' => $row['id'], 'status' => $row['status'], 'customerId' => $row['customerId'], 'customerName' => $row['customerName'],
            'shopName' => $row['shopName'], 'city' => $row['city'], 'contact' => $row['contact'], 'agentName' => $row['agentName'],
            'transportName' => $row['transportName'], 'agentId' => $row['agentId'], 'transporterId' => $row['transporterId'],
            'distributorId' => $row['distributorId'], 'existingCustomer' => $row['existingCustomer'], 'deliveryDate' => $row['deliveryDate'],
            'orderTakenBy' => $row['orderTakenBy'], 'items' => $items[$row['id']] ?? [], 'totalSets' => (int) $row['totalSets'],
            'totalPcs' => (int) $row['totalPcs'], 'dispatchStatus' => $row['dispatchStatus'],
            'dispatchConfirmedItems' => $row['dispatchConfirmedItems'], 'deliveryStatus' => $row['deliveryStatus'],
            'deliveryBatches' => $batches[$row['id']] ?? [], 'version' => (int) $row['version'],
        ];
        foreach (ORDER_TIME_FIELDS as $field) {
            $order[$field] = ordersIsoFromDb($row[$field]);
        }
        $orders[] = $order;
    }
    return $orders;
}

function ordersOrderColumns(array $order): array
{
    $columns = [];
    foreach (ORDER_TEXT_LIMITS as $field => $limit) {
        $value = $order[$field] ?? null;
        $columns[$field] = ($value === null && in_array($field, ORDER_NULLABLE_TEXT, true)) ? null : (string) ($value ?? '');
    }
    foreach (ORDER_TIME_FIELDS as $field) {
        $columns[$field] = ordersDbFromIso($order[$field] ?? null, $field);
    }
    $columns['deliveryDate'] = $order['deliveryDate'] ?? null;
    [$columns['totalSets'], $columns['totalPcs']] = orderTotals(orderItems($order));
    return $columns;
}

function ordersItemColumns(array $item, int $sortOrder): array
{
    return [
        'sortOrder' => $sortOrder, 'barcode' => (string) ($item['barcode'] ?? ''), 'description' => (string) ($item['description'] ?? ''),
        'designNumber' => isset($item['designNumber']) ? (string) $item['designNumber'] : null, 'brand' => (string) ($item['brand'] ?? ''),
        'size' => (string) ($item['size'] ?? ''), 'color' => isset($item['color']) ? (string) $item['color'] : null,
        'piecesPerSet' => orderPerSet($item), 'qty' => orderSets($item), 'dispatchScannedPieces' => orderScanned($item),
        'dispatchDeliveredPieces' => (int) ($item['dispatchDeliveredPieces'] ?? 0), 'dispatchChecked' => !empty($item['dispatchChecked']) ? 1 : 0,
    ];
}

function ordersInsertRow(PDO $db, string $table, array $columns): void
{
    $names = implode(', ', array_map(static function ($name) { return "`$name`"; }, array_keys($columns)));
    $marks = implode(', ', array_fill(0, count($columns), '?'));
    $db->prepare("INSERT INTO `$table` ($names) VALUES ($marks)")->execute(array_values($columns));
}

function ordersInsertBatch(PDO $db, string $orderId, array $batch, array $itemIdsByIndex = []): void
{
    $pdf = $batch['pdf'] ?? null;
    ordersInsertRow($db, 'deliveryBatches', [
        'id' => $batch['id'], 'orderId' => $orderId, 'status' => (string) ($batch['status'] ?? 'In Progress'),
        'createdAt' => ordersDbFromIso($batch['createdAt'] ?? null, 'delivery createdAt'),
        'completedAt' => ordersDbFromIso($batch['completedAt'] ?? null, 'delivery completedAt'),
        'isLegacy' => !empty($batch['isLegacy']) ? 1 : 0,
        'pdfState' => $pdf ? 'missing' : 'none', 'pdfName' => $pdf['name'] ?? null,
        'pdfSize' => isset($pdf['size']) ? (int) $pdf['size'] : null,
        'pdfUploadedAt' => $pdf ? ordersDbFromIso($pdf['uploadedAt'] ?? null, 'PDF uploadedAt') : null,
    ]);
    foreach (array_values($batch['items'] ?? []) as $sortOrder => $item) {
        $orderItemId = $item['orderItemId'] ?? ($itemIdsByIndex[$item['orderItemIndex'] ?? -1] ?? null);
        ordersInsertRow($db, 'deliveryBatchItems', [
            'batchId' => $batch['id'], 'orderItemId' => $orderItemId, 'sortOrder' => $sortOrder,
            'barcode' => (string) ($item['barcode'] ?? ''), 'description' => (string) ($item['description'] ?? ''),
            'designNumber' => isset($item['designNumber']) ? (string) $item['designNumber'] : null, 'brand' => (string) ($item['brand'] ?? ''),
            'size' => (string) ($item['size'] ?? ''), 'color' => isset($item['color']) ? (string) $item['color'] : null,
            'piecesPerSet' => (int) $item['piecesPerSet'], 'sets' => $item['sets'], 'pieces' => (int) $item['pieces'],
        ]);
    }
}

// Inserts a complete order (create, import, restore). Must run inside a transaction.
function ordersInsert(PDO $db, array $order, array $extra = []): void
{
    ordersInsertRow($db, 'customerOrders', ['id' => $order['id']] + ordersOrderColumns($order) + $extra);
    $itemIds = [];
    foreach (orderItems($order) as $sortOrder => $item) {
        ordersInsertRow($db, 'customerOrderItems', ['orderId' => $order['id']] + ordersItemColumns($item, $sortOrder));
        $itemIds[$sortOrder] = (int) $db->lastInsertId();
    }
    foreach ($order['deliveryBatches'] ?? [] as $batch) {
        ordersInsertBatch($db, $order['id'], $batch, $itemIds);
    }
}

// Saves the changes an action made to a locked order. Quantity columns are compare-and-set against
// the values read under the lock, so a lost update can never be written silently.
function ordersSave(PDO $db, array $before, array $after): void
{
    $columns = ordersOrderColumns($after);
    unset($columns['createdAt']);
    $sets = implode(', ', array_map(static function ($name) { return "`$name` = ?"; }, array_keys($columns)));
    $query = $db->prepare("UPDATE customerOrders SET $sets, version = version + 1 WHERE id = ? AND version = ?");
    $query->execute(array_merge(array_values($columns), [$before['id'], $before['version']]));
    if ($query->rowCount() !== 1) {
        throw new OrderError('Order changed in another session. Reload and try again.', 409);
    }
    $old = [];
    $oldPosition = [];
    foreach (orderItems($before) as $position => $item) {
        $old[$item['id']] = $item;
        $oldPosition[$item['id']] = $position;
    }
    $kept = [];
    foreach (orderItems($after) as $sortOrder => $item) {
        $values = ordersItemColumns($item, $sortOrder);
        if (isset($item['id'], $old[$item['id']])) {
            $kept[$item['id']] = true;
            if ($values === ordersItemColumns($old[$item['id']], $oldPosition[$item['id']])) {
                continue;
            }
            $assignments = implode(', ', array_map(static function ($name) { return "`$name` = ?"; }, array_keys($values)));
            $query = $db->prepare("UPDATE customerOrderItems SET $assignments WHERE id = ? AND orderId = ? AND dispatchScannedPieces = ? AND dispatchDeliveredPieces = ?");
            $query->execute(array_merge(array_values($values), [$item['id'], $before['id'], orderScanned($old[$item['id']]), (int) $old[$item['id']]['dispatchDeliveredPieces']]));
            if ($query->rowCount() !== 1) {
                throw new OrderError('Order changed in another session. Reload and try again.', 409);
            }
        } else {
            ordersInsertRow($db, 'customerOrderItems', ['orderId' => $before['id']] + $values);
        }
    }
    foreach (array_keys($old) as $id) {
        if (!isset($kept[$id])) {
            $db->prepare('DELETE FROM customerOrderItems WHERE id = ? AND orderId = ?')->execute([$id, $before['id']]);
        }
    }
    $existing = array_column($before['deliveryBatches'] ?? [], 'id');
    foreach ($after['deliveryBatches'] ?? [] as $batch) {
        if (!in_array($batch['id'], $existing, true)) {
            ordersInsertBatch($db, $before['id'], $batch);
        }
    }
}

// Runs one action on a locked order. $expectedVersion = null skips the stale-page check (scans).
function ordersMutate(PDO $db, string $id, ?int $expectedVersion, callable $action): array
{
    return ordersTransaction($db, static function (PDO $db) use ($id, $expectedVersion, $action) {
        $loaded = ordersLoad($db, $id, true);
        if (!$loaded) {
            throw new OrderError('This order was removed. Refresh the list.', 404);
        }
        $before = $loaded[0];
        if ($expectedVersion !== null && $expectedVersion !== $before['version']) {
            throw new OrderError('Order changed in another session. Reload and try again.', 409);
        }
        $after = $before;
        $result = $action($after, $db);
        if ($after !== $before) {
            ordersSave($db, $before, $after);
        }
        $order = ordersLoad($db, $id)[0];
        return ['order' => $order, 'result' => $result];
    });
}

// ---------- Input validation ----------

function ordersText(array $data, string $field, int $limit, bool $required = false): string
{
    $value = $data[$field] ?? '';
    if (!is_string($value) || mb_strlen($value, 'UTF-8') > $limit) {
        throw new OrderError("Invalid $field (maximum $limit characters).");
    }
    $value = trim($value);
    if ($required && $value === '') {
        throw new OrderError("$field is required.");
    }
    return $value;
}

function ordersVersion(array $data): int
{
    $version = $data['version'] ?? null;
    if (!is_int($version) || $version < 1) {
        throw new OrderError('A valid order version is required. Reload the page.');
    }
    return $version;
}

function ordersValidDate($value): bool
{
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value)) {
        return false;
    }
    [$year, $month, $day] = array_map('intval', explode('-', $value));
    return checkdate($month, $day, $year);
}

function ordersCatalog(PDO $db): array
{
    $products = [];
    foreach (productRows($db) as $row) {
        if (!empty($row['inProductList']) && ($row['barcode'] ?? '') !== '') {
            $products[$row['barcode']] = $row;
        }
    }
    return $products;
}

function ordersCustomerSnapshot(PDO $db, string $customerId): ?array
{
    $query = $db->prepare('SELECT c.id, c.name, c.shopName, c.city, c.contact, c.agentId, c.transporterId, c.distributorId,
        COALESCE(a.name, \'\') AS agentName, COALESCE(t.name, \'\') AS transportName
        FROM customerRecords c LEFT JOIN agents a ON a.id = c.agentId LEFT JOIN transporters t ON t.id = c.transporterId WHERE c.id = ?');
    $query->execute([$customerId]);
    $row = $query->fetch();
    if (!$row) {
        return null;
    }
    return [
        'customerId' => $row['id'], 'customerName' => $row['name'], 'shopName' => $row['shopName'], 'city' => $row['city'] ?? '',
        'contact' => $row['contact'] ?? '', 'agentName' => $row['agentName'], 'transportName' => $row['transportName'],
        'agentId' => $row['agentId'], 'transporterId' => $row['transporterId'], 'distributorId' => $row['distributorId'],
    ];
}

// Validates Order Punch input. Snapshots come from the database, never from the browser.
function ordersPunchFields(PDO $db, array $data, ?array $current): array
{
    $customerId = ordersText($data, 'customerId', 64, true);
    $customer = ordersCustomerSnapshot($db, $customerId);
    if (!$customer) {
        if (!$current || $current['customerId'] !== $customerId) {
            throw new OrderError('Customer not found. Refresh the customer list and try again.');
        }
        $customer = array_intersect_key($current, array_flip(['customerId', 'customerName', 'shopName', 'city', 'contact', 'agentName', 'transportName', 'agentId', 'transporterId', 'distributorId']));
    }
    $existing = $data['existingCustomer'] ?? 'No';
    if (!in_array($existing, ['Yes', 'No'], true)) {
        throw new OrderError('Invalid existing customer value.');
    }
    if (!ordersValidDate($data['deliveryDate'] ?? null)) {
        throw new OrderError('Please select a valid delivery date.');
    }
    $input = $data['items'] ?? null;
    if (!is_array($input) || !$input || count($input) > ORDER_MAX_ITEMS) {
        throw new OrderError('Please scan at least one product (maximum ' . ORDER_MAX_ITEMS . ' lines).');
    }
    $catalog = ordersCatalog($db);
    $previous = [];
    foreach ($current['items'] ?? [] as $item) {
        $previous[$item['barcode']] = $item;
    }
    $items = [];
    $seen = [];
    foreach ($input as $line) {
        $barcode = is_array($line) ? ($line['barcode'] ?? null) : null;
        $qty = is_array($line) ? ($line['qty'] ?? null) : null;
        if (!is_string($barcode) || $barcode === '' || strlen($barcode) > 150) {
            throw new OrderError('Each line needs a product barcode.');
        }
        if (isset($seen[$barcode])) {
            throw new OrderError('A product appears twice. Change its quantity instead.');
        }
        $seen[$barcode] = true;
        if (!is_int($qty) || $qty < 1 || $qty > ORDER_MAX_QTY) {
            throw new OrderError('Quantity must be a whole number of sets from 1 to ' . ORDER_MAX_QTY . '.');
        }
        if (isset($catalog[$barcode])) {
            $product = $catalog[$barcode];
            $items[] = ['barcode' => $barcode, 'description' => (string) $product['description'], 'size' => (string) $product['size'],
                'brand' => (string) $product['brand'], 'piecesPerSet' => orderPerSet($product), 'qty' => $qty];
        } elseif (isset($previous[$barcode])) {
            $kept = $previous[$barcode];
            unset($kept['id']);
            $items[] = ['qty' => $qty] + $kept; // product left the catalog: keep the stored snapshot
        } else {
            throw new OrderError("Product $barcode is not in the product list. Refresh and try again.");
        }
    }
    return $customer + ['existingCustomer' => $existing, 'deliveryDate' => $data['deliveryDate'], 'items' => $items];
}

function ordersRequireBeforeDispatch(array $order): void
{
    if (!empty($order['dispatchPassedAt'])) {
        throw new OrderError('This order has been passed to Dispatch and can no longer be changed here.', 409);
    }
}

// ---------- Actions ----------

function ordersCreate(PDO $db, array $data): array
{
    $fields = ordersPunchFields($db, $data, null);
    $nowMs = ordersNowMs();
    for ($attempt = 0; $attempt < 50; $attempt++) {
        $order = ['id' => 'ORD' . ($nowMs + $attempt), 'status' => 'Active', 'createdAt' => ordersIsoFromMs($nowMs), 'deliveryBatches' => []] + $fields;
        try {
            ordersTransaction($db, static function (PDO $db) use ($order) {
                ordersInsert($db, $order);
            });
            return ordersLoad($db, $order['id'])[0];
        } catch (PDOException $error) {
            if ((int) ($error->errorInfo[1] ?? 0) === 1062) {
                continue; // order number taken (another create or an imported order): try the next one
            }
            throw $error;
        }
    }
    throw new OrderError('Could not allocate an order number. Please try again.', 503);
}

function ordersHandleAction(PDO $db, array $data): array
{
    $action = $data['action'] ?? '';
    if ($action === 'create') {
        return ['order' => ordersCreate($db, $data)];
    }
    if ($action === 'import') {
        return ['results' => ordersImport($db, $data['orders'] ?? null)];
    }
    $id = ordersText($data, 'id', 40, true);
    switch ($action) {
        case 'update':
            return ordersMutate($db, $id, ordersVersion($data), static function (array &$order, PDO $db) use ($data) {
                ordersRequireBeforeDispatch($order);
                $order = array_merge($order, ordersPunchFields($db, $data, $order));
                $order['updatedAt'] = ordersIsoFromMs(ordersNowMs());
            });
        case 'setStatus':
            $status = $data['status'] ?? '';
            if (!in_array($status, ['Active', 'Inactive'], true)) {
                throw new OrderError('Invalid status.');
            }
            return ordersMutate($db, $id, ordersVersion($data), static function (array &$order) use ($status) {
                ordersRequireBeforeDispatch($order);
                $order['status'] = $status;
            });
        case 'delete':
            $version = ordersVersion($data);
            return ordersTransaction($db, static function (PDO $db) use ($id, $version) {
                $order = ordersLoad($db, $id, true)[0] ?? null;
                if (!$order) {
                    throw new OrderError('This order was removed. Refresh the list.', 404);
                }
                if ($order['version'] !== $version) {
                    throw new OrderError('Order changed in another session. Reload and try again.', 409);
                }
                ordersRequireBeforeDispatch($order);
                if ($order['deliveryBatches']) {
                    throw new OrderError('This order has deliveries and cannot be deleted.', 409);
                }
                $db->prepare('DELETE FROM customerOrders WHERE id = ?')->execute([$id]);
                return ['deleted' => $id];
            });
        case 'passToDispatch':
            return ordersMutate($db, $id, null, static function (array &$order) {
                if (empty($order['dispatchPassedAt'])) {
                    $order['dispatchPassedAt'] = ordersIsoFromMs(ordersNowMs());
                }
            });
        case 'scan':
            $barcode = ordersText($data, 'barcode', 150, true);
            return ordersMutate($db, $id, null, static function (array &$order) use ($barcode) {
                if (empty($order['dispatchPassedAt'])) {
                    throw new OrderError('Pass this order from Order List first.');
                }
                $index = orderApplyScan($order, $barcode);
                return ['itemIndex' => $index];
            });
        case 'replaceItem':
            $itemId = $data['itemId'] ?? null;
            $barcode = ordersText($data, 'productBarcode', 150, true);
            if (!is_int($itemId)) {
                throw new OrderError('A valid item is required.');
            }
            return ordersMutate($db, $id, ordersVersion($data), static function (array &$order, PDO $db) use ($itemId, $barcode) {
                if (empty($order['dispatchPassedAt'])) {
                    throw new OrderError('Pass this order from Order List first.');
                }
                $index = array_search($itemId, array_column($order['items'], 'id'), true);
                if ($index === false) {
                    throw new OrderError('Order changed. Close and reopen Replace.', 409);
                }
                $product = ordersCatalog($db)[$barcode] ?? null;
                if (!$product) {
                    throw new OrderError('Product changed or removed. Select the design again.');
                }
                orderApplyReplace($order, $index, $product, ordersNowMs());
            });
        case 'deliverPartial':
            $lines = $data['lines'] ?? null;
            if (!is_array($lines)) {
                throw new OrderError('Choose at least one complete set to pass.');
            }
            return ordersMutate($db, $id, ordersVersion($data), static function (array &$order, PDO $db) use ($lines) {
                $positions = array_flip(array_column($order['items'], 'id'));
                $selections = array_fill(0, count($order['items']), 0);
                $seen = [];
                foreach ($lines as $line) {
                    $itemId = is_array($line) ? ($line['itemId'] ?? null) : null;
                    if (!is_int($itemId) || !isset($positions[$itemId]) || isset($seen[$itemId])) {
                        throw new OrderError('Order changed. Close and reopen delivery details.', 409);
                    }
                    $seen[$itemId] = true;
                    $selections[$positions[$itemId]] = $line['sets'] ?? null;
                }
                $taken = static function (string $batchId) use ($db): bool {
                    $query = $db->prepare('SELECT 1 FROM deliveryBatches WHERE id = ?');
                    $query->execute([$batchId]);
                    return (bool) $query->fetchColumn();
                };
                $batch = orderApplyDeliverPartial($order, $selections, ordersNowMs(), $taken);
                return ['batchId' => $batch['id']];
            });
    }
    throw new OrderError('Unknown action.', 400);
}

// ---------- Browser import (idempotent; never overwrites) ----------

function ordersCanonical($value)
{
    if (is_array($value)) {
        if ($value && array_keys($value) !== range(0, count($value) - 1)) {
            ksort($value, SORT_STRING);
        }
        foreach ($value as $key => $item) {
            $value[$key] = ordersCanonical($item);
        }
    }
    return $value;
}

function ordersLegacyHash(array $raw): string
{
    return hash('sha256', json_encode(ordersCanonical($raw), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION));
}

function ordersImportText(array $source, string $field, int $limit, bool $nullable): ?string
{
    $value = $source[$field] ?? null;
    if ($value === null) {
        return $nullable ? null : '';
    }
    if (!is_scalar($value) || is_bool($value)) {
        throw new OrderError("Invalid $field.");
    }
    $value = (string) $value;
    if (mb_strlen($value, 'UTF-8') > $limit) {
        throw new OrderError("$field is longer than $limit characters.");
    }
    return $value;
}

function ordersImportInt($value, string $field, int $max): int
{
    if ($value === null || $value === '') {
        return 0;
    }
    if (!is_numeric($value) || (float) $value < 0 || (float) $value > $max || floor((float) $value) !== (float) $value) {
        throw new OrderError("Invalid $field.");
    }
    return (int) $value;
}

// Converts one browser (or exported) order into the server shape, or throws OrderError (invalid).
function ordersNormalizeImport($raw): array
{
    if (!is_array($raw) || !is_string($raw['id'] ?? null) || !preg_match('/^[A-Za-z0-9_-]{1,40}$/D', $raw['id'])) {
        throw new OrderError('Missing or invalid order ID.');
    }
    if (!isset($raw['items']) || !is_array($raw['items']) || count($raw['items']) > ORDER_MAX_ITEMS) {
        throw new OrderError('Order items are missing or invalid.');
    }
    $order = ['id' => $raw['id']];
    foreach (ORDER_TEXT_LIMITS as $field => $limit) {
        $order[$field] = ordersImportText($raw, $field, $limit, in_array($field, ORDER_NULLABLE_TEXT, true));
    }
    if ($order['status'] === '') {
        $order['status'] = 'Active';
    }
    foreach (ORDER_TIME_FIELDS as $field) {
        $order[$field] = ordersDbFromIso($raw[$field] ?? null, $field) === null ? null : (string) $raw[$field];
    }
    if ($order['createdAt'] === null) {
        $order['createdAt'] = preg_match('/^ORD(\d{13})$/D', $raw['id'], $match) ? ordersIsoFromMs((int) $match[1]) : ordersIsoFromMs(ordersNowMs());
    }
    $date = $raw['deliveryDate'] ?? null;
    if ($date !== null && $date !== '' && !ordersValidDate($date)) {
        throw new OrderError('Invalid delivery date.');
    }
    $order['deliveryDate'] = ($date === '' ? null : $date);

    $items = [];
    foreach ($raw['items'] as $rawItem) {
        if (!is_array($rawItem)) {
            throw new OrderError('Invalid order item.');
        }
        $item = [];
        foreach (ORDER_ITEM_TEXT_LIMITS as $field => $limit) {
            $item[$field] = ordersImportText($rawItem, $field, $limit, in_array($field, ['designNumber', 'color'], true));
        }
        if ($item['description'] === '') {
            $item['description'] = ordersImportText($rawItem, 'itemDescription', 255, false) ?: ordersImportText($rawItem, 'itemCode', 255, false);
        }
        $item['qty'] = ordersImportInt($rawItem['qty'] ?? 0, 'item quantity', ORDER_MAX_QTY);
        $item['piecesPerSet'] = orderPerSet($rawItem);
        $item['dispatchScannedPieces'] = orderScanned(['qty' => $item['qty'], 'piecesPerSet' => $item['piecesPerSet'], 'brand' => $item['brand'],
            'dispatchScannedPieces' => ordersImportInt($rawItem['dispatchScannedPieces'] ?? 0, 'scanned pieces', PHP_INT_MAX)]);
        $item['dispatchDeliveredPieces'] = orderDelivered($raw, $rawItem); // legacy rule, evaluated on the original order
        $item['dispatchChecked'] = !empty($rawItem['dispatchChecked']);
        $items[] = $item;
    }
    $order['items'] = $items;

    $batches = [];
    $rawBatches = $raw['deliveryBatches'] ?? null;
    if (is_array($rawBatches) && $rawBatches) {
        if (count($rawBatches) > 500) {
            throw new OrderError('Too many deliveries.');
        }
        foreach ($rawBatches as $rawBatch) {
            if (!is_array($rawBatch) || !is_string($rawBatch['id'] ?? null) || !preg_match('/^[A-Za-z0-9_.-]{1,80}$/D', $rawBatch['id'])) {
                throw new OrderError('Invalid delivery ID.');
            }
            $batchItems = [];
            foreach (is_array($rawBatch['items'] ?? null) ? $rawBatch['items'] : [] as $rawItem) {
                if (!is_array($rawItem)) {
                    throw new OrderError('Invalid delivery item.');
                }
                $perSet = orderPerSet($rawItem);
                $pieces = ordersImportInt($rawItem['pieces'] ?? 0, 'delivered pieces', PHP_INT_MAX) ?: (int) round(orderNumber($rawItem['sets'] ?? 0) * $perSet);
                $batchItem = ['piecesPerSet' => $perSet, 'pieces' => $pieces, 'sets' => orderNumber($rawItem['sets'] ?? 0) ?: $pieces / $perSet];
                foreach (ORDER_ITEM_TEXT_LIMITS as $field => $limit) {
                    $batchItem[$field] = ordersImportText($rawItem, $field, $limit, in_array($field, ['designNumber', 'color'], true));
                }
                $batchItem['orderItemIndex'] = ordersMatchItem($items, $batchItem);
                $batchItems[] = $batchItem;
            }
            $pdf = null;
            if (isset($rawBatch['pdf']) && is_array($rawBatch['pdf'])) {
                $pdf = ['name' => ordersImportText($rawBatch['pdf'], 'name', 150, true) ?? 'Delivery.pdf',
                    'size' => isset($rawBatch['pdf']['size']) ? ordersImportInt($rawBatch['pdf']['size'], 'PDF size', PHP_INT_MAX) : null,
                    'uploadedAt' => $rawBatch['pdf']['uploadedAt'] ?? null];
                ordersDbFromIso($pdf['uploadedAt'], 'PDF uploadedAt');
            }
            ordersDbFromIso($rawBatch['createdAt'] ?? null, 'delivery createdAt');
            ordersDbFromIso($rawBatch['completedAt'] ?? null, 'delivery completedAt');
            $batches[] = [
                'id' => $rawBatch['id'], 'createdAt' => $rawBatch['createdAt'] ?? null, 'completedAt' => $rawBatch['completedAt'] ?? null,
                'status' => ordersImportText($rawBatch, 'status', 20, false) ?: 'In Progress', 'isLegacy' => !empty($rawBatch['isLegacy']),
                'pdf' => $pdf, 'items' => $batchItems,
            ];
        }
    } else {
        // Mirrors DeliveryRecords.batches(): old orders delivered before batches existed.
        $legacyItems = [];
        foreach ($items as $index => $item) {
            if ($item['dispatchDeliveredPieces'] > 0) {
                $perSet = $item['piecesPerSet'];
                $legacyItems[] = ['orderItemIndex' => $index, 'piecesPerSet' => $perSet, 'pieces' => $item['dispatchDeliveredPieces'],
                    'sets' => $item['dispatchDeliveredPieces'] / $perSet] + array_intersect_key($item, ORDER_ITEM_TEXT_LIMITS);
            }
        }
        if ($legacyItems) {
            $batches[] = ['id' => 'DLV-LEGACY-' . $raw['id'], 'createdAt' => $order['deliveredAt'], 'completedAt' => null,
                'status' => 'In Progress', 'isLegacy' => true, 'pdf' => null, 'items' => $legacyItems];
        }
    }
    $order['deliveryBatches'] = $batches;
    return $order;
}

function ordersMatchItem(array $items, array $batchItem): ?int
{
    foreach ($items as $index => $item) {
        if ($item['barcode'] === $batchItem['barcode'] && $item['brand'] === $batchItem['brand'] && $item['size'] === $batchItem['size']) {
            return $index;
        }
    }
    return null;
}

function ordersMissingPdfBatches(PDO $db, string $orderId): array
{
    $query = $db->prepare("SELECT id FROM deliveryBatches WHERE orderId = ? AND pdfState = 'missing' ORDER BY id");
    $query->execute([$orderId]);
    return $query->fetchAll(PDO::FETCH_COLUMN);
}

function ordersImportOne(PDO $db, $raw): array
{
    $id = is_array($raw) && is_string($raw['id'] ?? null) ? substr($raw['id'], 0, 80) : null;
    try {
        $order = ordersNormalizeImport($raw);
    } catch (OrderError $error) {
        return ['id' => $id, 'result' => 'invalid', 'message' => $error->getMessage()];
    }
    $hash = ordersLegacyHash($raw);
    $legacy = json_encode($raw, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    for ($attempt = 0; $attempt < 3; $attempt++) {
        try {
            $result = ordersTransaction($db, static function (PDO $db) use ($order, $hash, $legacy) {
                $query = $db->prepare('SELECT legacyHash FROM customerOrders WHERE id = ? FOR UPDATE');
                $query->execute([$order['id']]);
                $row = $query->fetch();
                if ($row) {
                    return $row['legacyHash'] === $hash
                        ? ['result' => 'alreadyImported']
                        : ['result' => 'conflict', 'message' => 'A different order with this ID already exists on the server. Nothing was changed.'];
                }
                foreach ($order['deliveryBatches'] as $batch) {
                    $query = $db->prepare('SELECT orderId FROM deliveryBatches WHERE id = ?');
                    $query->execute([$batch['id']]);
                    if ($query->fetchColumn() !== false) {
                        return ['result' => 'conflict', 'message' => 'Delivery ' . $batch['id'] . ' already exists on the server. Nothing was changed.'];
                    }
                }
                ordersInsert($db, $order, ['legacyData' => $legacy, 'legacyHash' => $hash, 'importedAt' => ordersDbFromIso(ordersIsoFromMs(ordersNowMs()), 'importedAt')]);
                return ['result' => 'imported'];
            });
            break;
        } catch (PDOException $error) {
            if ((int) ($error->errorInfo[1] ?? 0) !== 1062 || $attempt === 2) {
                throw $error;
            }
            // Another session inserted the same order or delivery at the same moment: check again.
        }
    }
    $result['id'] = $order['id'];
    if ($result['result'] !== 'conflict') {
        $result['missingPdfBatches'] = ordersMissingPdfBatches($db, $order['id']);
    }
    return $result;
}

function ordersImport(PDO $db, $orders): array
{
    if (!is_array($orders) || count($orders) > 200 || array_keys($orders) !== range(0, count($orders) - 1)) {
        throw new OrderError('Send between 1 and 200 orders per import request.');
    }
    $results = [];
    foreach ($orders as $raw) {
        $results[] = ordersImportOne($db, $raw);
    }
    return $results;
}

// ---------- Delivery PDFs ----------

function ordersInsideFolder(string $path, string $folder): bool
{
    $folder = $folder === '' ? false : realpath($folder);
    if ($folder === false) {
        return false;
    }
    $normalize = static function (string $value): string {
        $value = str_replace('\\', '/', $value);
        return rtrim(DIRECTORY_SEPARATOR === '\\' ? strtolower($value) : $value, '/') . '/';
    };
    return strpos($normalize($path), $normalize($folder)) === 0;
}

function ordersPdfDirectory(): string
{
    $configured = getenv('DELIVERY_PDF_DIR');
    if ($configured !== false && $configured !== '') {
        $directory = rtrim($configured, '/\\');
        if (getenv('APP_ENV') !== 'development') {
            // Live: an existing, writable folder outside the project and the web root; otherwise fail closed.
            $real = realpath($directory);
            if ($real === false || !is_dir($real) || !is_writable($real) || ordersInsideFolder($real, dirname(__DIR__))
                || ordersInsideFolder($real, (string) ($_SERVER['DOCUMENT_ROOT'] ?? ''))) {
                throw new OrderError('PDF storage is not configured correctly. DELIVERY_PDF_DIR must be an existing, writable folder outside the web root.', 503);
            }
            return $directory;
        }
    } else {
        // Fallback inside the project: local development only, and only while the deny-all storage/.htaccess exists.
        // Everywhere else DELIVERY_PDF_DIR is required (outside public_html), so live never stores PDFs in the web root.
        if (getenv('APP_ENV') !== 'development') {
            throw new OrderError('PDF storage is not configured. Set DELIVERY_PDF_DIR to a folder outside the web root.', 503);
        }
        $directory = dirname(__DIR__) . '/storage/delivery-pdfs';
        if (!is_file(dirname(__DIR__) . '/storage/.htaccess')) {
            throw new OrderError('PDF storage is not protected. Set DELIVERY_PDF_DIR to a folder outside the web root.', 503);
        }
    }
    if (!is_dir($directory) && !@mkdir($directory, 0750, true) && !is_dir($directory)) {
        throw new OrderError('PDF storage folder is unavailable.', 503);
    }
    return $directory;
}

// Validates the uploaded file: upload errors, size, MIME type and PDF signature.
function ordersReceivePdf(): array
{
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > ORDER_PDF_MAX_BYTES + 65536) {
        throw new OrderError('The PDF is larger than 10 MB.', 413);
    }
    $file = $_FILES['file'] ?? null;
    if (!is_array($file) || is_array($file['error'] ?? null)) {
        if ($length > 0 && !$_POST) {
            throw new OrderError('The PDF is larger than the server upload limit.', 413);
        }
        throw new OrderError('Choose a PDF to pass this delivery.');
    }
    switch ((int) $file['error']) {
        case UPLOAD_ERR_OK:
            break;
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            throw new OrderError('The PDF is larger than the server upload limit.', 413);
        case UPLOAD_ERR_PARTIAL:
            throw new OrderError('The upload was interrupted. Please try again.');
        case UPLOAD_ERR_NO_FILE:
            throw new OrderError('Choose a PDF to pass this delivery.');
        default:
            error_log('Delivery PDF upload error code ' . (int) $file['error']);
            throw new OrderError('The server could not receive the PDF.', 500);
    }
    if (!is_uploaded_file($file['tmp_name'])) {
        throw new OrderError('Choose a PDF to pass this delivery.');
    }
    ordersCheckPdfFile($file['tmp_name']);
    $name = ordersPdfName((string) ($file['name'] ?? ''));
    return [$file['tmp_name'], $name];
}

function ordersCheckPdfFile(string $path): void
{
    $size = filesize($path);
    if ($size === false || $size < 1) {
        throw new OrderError('The PDF is empty.');
    }
    if ($size > ORDER_PDF_MAX_BYTES) {
        throw new OrderError('The PDF is larger than 10 MB.', 413);
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);
    $handle = fopen($path, 'rb');
    $signature = $handle ? fread($handle, 5) : '';
    if ($handle) {
        fclose($handle);
    }
    if ($mime !== 'application/pdf' || $signature !== '%PDF-') {
        throw new OrderError('Choose a valid PDF file.');
    }
}

function ordersPdfName(string $name): string
{
    $name = preg_replace('/[\x00-\x1F\x7F\/\\\\:*?"<>|]+/u', '_', basename(str_replace('\\', '/', $name))) ?? '';
    $name = trim(mb_substr($name, 0, 146, 'UTF-8'));
    if ($name === '' || $name === '.' || $name === '..') {
        $name = 'Delivery';
    }
    return preg_match('/\.pdf$/iD', $name) ? $name : $name . '.pdf';
}

// Stores a PDF for a delivery. $mode: 'pass' (state none, or missing for a manual fill) or 'import'
// (state missing only, keeps the original name and time). File work happens before the transaction;
// if the transaction does not commit, the new file is deleted again.
function ordersAttachPdf(PDO $db, string $batchId, string $source, string $name, string $mode, bool $uploaded): array
{
    $query = $db->prepare('SELECT orderId FROM deliveryBatches WHERE id = ?');
    $query->execute([$batchId]);
    $orderId = $query->fetchColumn();
    if ($orderId === false) {
        throw new OrderError('This delivery was removed. Refresh the list.', 404);
    }
    $directory = ordersPdfDirectory();
    $file = bin2hex(random_bytes(16)) . '.pdf';
    $target = $directory . DIRECTORY_SEPARATOR . $file;
    $moved = $uploaded ? move_uploaded_file($source, $target) : copy($source, $target);
    if (!$moved) {
        throw new OrderError('The PDF could not be saved.', 500);
    }
    @chmod($target, 0640);
    try {
        $sha = hash_file('sha256', $target);
        $size = filesize($target);
        $nowMs = ordersNowMs();
        ordersTransaction($db, static function (PDO $db) use ($orderId, $batchId, $file, $name, $mode, $sha, $size, $nowMs) {
            $query = $db->prepare('SELECT id FROM customerOrders WHERE id = ? FOR UPDATE');
            $query->execute([$orderId]);
            if ($query->fetchColumn() === false) {
                throw new OrderError('This order was removed.', 404);
            }
            $query = $db->prepare('SELECT orderId, pdfState FROM deliveryBatches WHERE id = ? FOR UPDATE');
            $query->execute([$batchId]);
            $batch = $query->fetch();
            if (!$batch || $batch['orderId'] !== $orderId) {
                throw new OrderError('This delivery was removed. Refresh the list.', 404);
            }
            $allowed = $mode === 'import' ? ['missing'] : ['none', 'missing'];
            if (!in_array($batch['pdfState'], $allowed, true)) {
                throw new OrderError($batch['pdfState'] === 'stored' ? 'This delivery has already been passed.' : 'This delivery has no PDF waiting for import.', 409);
            }
            $now = ordersDbFromIso(ordersIsoFromMs($nowMs), 'now');
            if ($mode === 'import') {
                $db->prepare("UPDATE deliveryBatches SET pdfState = 'stored', pdfFile = ?, pdfSize = ?, pdfSha256 = ?,
                    pdfName = COALESCE(pdfName, ?), pdfUploadedAt = COALESCE(pdfUploadedAt, ?) WHERE id = ?")
                    ->execute([$file, $size, $sha, $name, $now, $batchId]);
            } else {
                $db->prepare("UPDATE deliveryBatches SET pdfState = 'stored', pdfFile = ?, pdfSize = ?, pdfSha256 = ?, pdfName = ?,
                    pdfUploadedAt = ?, status = 'Success', completedAt = ? WHERE id = ?")
                    ->execute([$file, $size, $sha, $name, $now, $now, $batchId]);
            }
            $db->prepare("UPDATE customerOrders SET version = version + 1, deliveryStatus = CASE WHEN EXISTS
                (SELECT 1 FROM deliveryBatches b WHERE b.orderId = customerOrders.id AND b.pdfState <> 'stored') THEN 'In Progress' ELSE 'Success' END
                WHERE id = ?")->execute([$orderId]);
        });
    } catch (Throwable $error) {
        @unlink($target);
        throw $error;
    }
    return ordersLoad($db, $orderId)[0];
}

function ordersSendPdf(PDO $db, string $batchId): void
{
    $query = $db->prepare('SELECT pdfState, pdfFile, pdfName FROM deliveryBatches WHERE id = ?');
    $query->execute([$batchId]);
    $batch = $query->fetch();
    if (!$batch) {
        throw new OrderError('Delivery not found.', 404);
    }
    if ($batch['pdfState'] !== 'stored' || !preg_match('/^[a-f0-9]{32}\.pdf$/D', (string) $batch['pdfFile'])) {
        throw new OrderError('The PDF for this delivery is not available on the server.', 404);
    }
    $path = ordersPdfDirectory() . DIRECTORY_SEPARATOR . $batch['pdfFile'];
    if (!is_file($path)) {
        error_log('Delivery PDF file missing on disk for batch ' . $batchId);
        throw new OrderError('The PDF for this delivery is not available on the server.', 404);
    }
    $name = ordersPdfName((string) $batch['pdfName']);
    $ascii = preg_replace('/[^A-Za-z0-9._ -]/', '_', $name);
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $ascii . '"; filename*=UTF-8\'\'' . rawurlencode($name));
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: private, no-store, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; sandbox");
    readfile($path);
    exit;
}

// ---------- HTTP entry points ----------

function ordersRespondError(Throwable $error, string $context): void
{
    if ($error instanceof OrderError) {
        respond($error->status, ['success' => false, 'message' => $error->getMessage()]);
    }
    error_log($context . ': ' . $error->getMessage());
    respond($error instanceof PDOException ? 503 : 500, ['success' => false, 'message' => 'Unable to complete the request. Please try again.']);
}

function ordersApi(): void
{
    ordersRequireAccess();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET', 'POST'], true)) {
        header('Allow: GET, POST');
        respond(405, ['success' => false, 'message' => 'Method not allowed.']);
    }
    try {
        $db = database();
        ordersEnsureReady($db);
        if ($method === 'GET') {
            if (isset($_GET['id'])) {
                $order = is_string($_GET['id']) ? (ordersLoad($db, $_GET['id'])[0] ?? null) : null;
                if (!$order) {
                    throw new OrderError('This order could not be found. It may have been deleted.', 404);
                }
                respond(200, ['success' => true, 'data' => $order]);
            }
            respond(200, ['success' => true, 'data' => ordersLoad($db)]);
        }
        if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
            respond(415, ['success' => false, 'message' => 'Content-Type must be application/json.']);
        }
        $data = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($data)) {
            respond(400, ['success' => false, 'message' => 'A JSON object is required.']);
        }
        respond(200, ['success' => true, 'data' => ordersHandleAction($db, $data)]);
    } catch (Throwable $error) {
        ordersRespondError($error, 'Orders API');
    }
}

function ordersPdfApi(): void
{
    ordersRequireAccess();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    try {
        $db = database();
        ordersEnsureReady($db);
        if ($method === 'GET') {
            $batchId = $_GET['batchId'] ?? '';
            if (!is_string($batchId) || $batchId === '' || strlen($batchId) > 80) {
                throw new OrderError('Delivery not found.', 404);
            }
            ordersSendPdf($db, $batchId);
        }
        if ($method !== 'POST') {
            header('Allow: GET, POST');
            respond(405, ['success' => false, 'message' => 'Method not allowed.']);
        }
        [$path, $name] = ordersReceivePdf();
        $batchId = $_POST['batchId'] ?? '';
        if (!is_string($batchId) || $batchId === '' || strlen($batchId) > 80) {
            throw new OrderError('This delivery was removed. Refresh the list.', 404);
        }
        $mode = ($_POST['mode'] ?? 'pass') === 'import' ? 'import' : 'pass';
        respond(200, ['success' => true, 'data' => ['order' => ordersAttachPdf($db, $batchId, $path, $name, $mode, true)]]);
    } catch (Throwable $error) {
        ordersRespondError($error, 'Delivery PDF API');
    }
}
