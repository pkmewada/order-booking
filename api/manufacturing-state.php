<?php
require_once __DIR__ . '/../includes/db.php';

function manufacturingStateRespond(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function manufacturingStateKeys(): array
{
    return [
        'approvedPool', 'cuttingData', 'additionalWorkData', 'additionalWorkHistory',
        'addWork_embroidery', 'addWork_digital_print',
        'addWork_screen_print', 'addWork_hand_work', 'addWork_peco', 'stitchingData',
        'ironingData', 'packingData', 'cuttingHistory', 'addWork_embroidery_history',
        'addWork_digital_print_history', 'addWork_screen_print_history',
        'addWork_hand_work_history', 'addWork_peco_history', 'stitchingData_history',
        'ironingData_history', 'packingData_history', 'repairData', 'packingPool',
        'approvedBatchData', 'batchData', 'requirementData', 'packingHolds',
        'bundlingData', 'inventoryData'
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    try {
        $db = database();
        $meta = $db->query('SELECT revision, initialized FROM manufacturingStateMeta WHERE id = 1')->fetch();
        if (!$meta) {
            manufacturingStateRespond(503, ['success' => false, 'message' => 'Manufacturing database schema is incomplete. Import database/order-booking.sql.']);
        }
        $rows = $db->query('SELECT stateKey, stateData FROM manufacturingState')->fetchAll();
        $state = [];
        foreach ($rows as $row) {
            $value = json_decode($row['stateData'], true);
            if (!is_array($value)) {
                throw new UnexpectedValueException('Invalid saved manufacturing state for ' . $row['stateKey'] . '.');
            }
            $state[$row['stateKey']] = $value;
        }
        manufacturingStateRespond(200, [
            'success' => true,
            'data' => ['state' => $state, 'revision' => (int) $meta['revision'], 'initialized' => (bool) $meta['initialized']]
        ]);
    } catch (Throwable $error) {
        error_log('Manufacturing state read error: ' . $error->getMessage());
        manufacturingStateRespond(503, ['success' => false, 'message' => 'Unable to load manufacturing data. Check the database connection and import database/order-booking.sql.']);
    }
}

if ($method !== 'POST') {
    header('Allow: GET, POST');
    manufacturingStateRespond(405, ['success' => false, 'message' => 'Method not allowed.']);
}
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
    manufacturingStateRespond(415, ['success' => false, 'message' => 'Content-Type must be application/json.']);
}

try {
    $request = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    manufacturingStateRespond(400, ['success' => false, 'message' => 'A valid JSON request is required.']);
}
if (!is_array($request) || !isset($request['state']) || !is_array($request['state'])) {
    manufacturingStateRespond(400, ['success' => false, 'message' => 'Manufacturing state must be an object.']);
}

$allowed = manufacturingStateKeys();
$state = $request['state'];
foreach ($state as $key => $value) {
    if (!in_array($key, $allowed, true) || !is_array($value) || count($value) > 100000) {
        manufacturingStateRespond(422, ['success' => false, 'message' => 'Invalid manufacturing state collection.']);
    }
}
$initialize = ($request['initialize'] ?? false) === true;
$revision = $request['revision'] ?? null;
if (!$initialize && (!is_int($revision) || $revision < 0)) {
    manufacturingStateRespond(422, ['success' => false, 'message' => 'A valid manufacturing database revision is required.']);
}

try {
    $db = database();
    $db->beginTransaction();
    $metaQuery = $db->query('SELECT revision, initialized FROM manufacturingStateMeta WHERE id = 1 FOR UPDATE');
    $meta = $metaQuery->fetch();
    if (!$meta) {
        throw new RuntimeException('Manufacturing state schema is missing. Import database/order-booking.sql.');
    }
    if ($initialize) {
        if ((bool) $meta['initialized']) {
            $db->rollBack();
            manufacturingStateRespond(409, ['success' => false, 'message' => 'Manufacturing data was already imported. Reload the page to use the database copy.']);
        }
        foreach ($allowed as $key) {
            $value = $state[$key] ?? [];
            $query = $db->prepare('INSERT INTO manufacturingState (stateKey, stateData) VALUES (?, ?)');
            $query->execute([$key, json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
        }
        $newRevision = (int) $meta['revision'] + 1;
        $query = $db->prepare('UPDATE manufacturingStateMeta SET revision = ?, initialized = TRUE WHERE id = 1');
        $query->execute([$newRevision]);
    } else {
        if (!(bool) $meta['initialized']) {
            $db->rollBack();
            manufacturingStateRespond(409, ['success' => false, 'message' => 'Manufacturing database has not been initialized. Reload the page to import existing data.']);
        }
        if ((int) $meta['revision'] !== $revision) {
            $db->rollBack();
            manufacturingStateRespond(409, ['success' => false, 'message' => 'Manufacturing data changed in another session. Reload the page and retry your update.']);
        }
        $query = $db->prepare('INSERT INTO manufacturingState (stateKey, stateData) VALUES (?, ?) ON DUPLICATE KEY UPDATE stateData = VALUES(stateData)');
        foreach ($state as $key => $value) {
            $query->execute([$key, json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
        }
        $newRevision = (int) $meta['revision'] + 1;
        $query = $db->prepare('UPDATE manufacturingStateMeta SET revision = ? WHERE id = 1');
        $query->execute([$newRevision]);
    }
    $db->commit();
    manufacturingStateRespond(200, ['success' => true, 'data' => ['revision' => $newRevision]]);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log('Manufacturing state write error: ' . $error->getMessage());
    manufacturingStateRespond(503, ['success' => false, 'message' => $error instanceof RuntimeException ? $error->getMessage() : 'Unable to save manufacturing data. Check the database connection.']);
}
