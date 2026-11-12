<?php
require_once __DIR__ . '/../includes/db.php';

function patternResponse(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

require_once __DIR__ . '/../includes/auth.php';
authRequireApi('patterns');

try {
    $db = database();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        $patterns = $db->query('SELECT id, name, pieceCount FROM patternRecords ORDER BY id')->fetchAll();
        $items = $db->query(
            'SELECT links.patternId, links.pieceNumber, pieces.id, pieces.name
             FROM patternPieceLinks links
             JOIN pieceItemList pieces ON pieces.id = links.pieceItemId
             ORDER BY links.patternId, links.pieceNumber'
        )->fetchAll();
        $itemsByPattern = [];
        foreach ($items as $item) {
            $itemsByPattern[$item['patternId']][] = [
                'id' => (int) $item['id'],
                'name' => $item['name'],
            ];
        }
        foreach ($patterns as &$pattern) {
            $pattern['id'] = (int) $pattern['id'];
            $pattern['pieceCount'] = (int) $pattern['pieceCount'];
            $pattern['items'] = $itemsByPattern[$pattern['id']] ?? [];
        }
        unset($pattern);
        patternResponse(200, ['success' => true, 'data' => $patterns]);
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST');
        patternResponse(405, ['success' => false, 'message' => 'Method not allowed.']);
    }
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        patternResponse(415, ['success' => false, 'message' => 'Content-Type must be application/json.']);
    }

    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) {
        patternResponse(400, ['success' => false, 'message' => 'A JSON object is required.']);
    }
    $name = $data['name'] ?? null;
    $pieceItemIds = $data['pieceItemIds'] ?? null;
    if (!is_string($name) || trim($name) === '' || mb_strlen(trim($name), 'UTF-8') > 150 || preg_match('/[\x00-\x1F\x7F]/u', $name)) {
        throw new InvalidArgumentException('A valid pattern name is required (maximum 150 characters).');
    }
    $name = trim($name);
    if (!is_array($pieceItemIds) || count($pieceItemIds) < 1 || count($pieceItemIds) > 255) {
        throw new InvalidArgumentException('Select between 1 and 255 piece items.');
    }

    $pieceItemIds = array_values($pieceItemIds);
    $validatedIds = [];
    $pieceLookup = $db->prepare('SELECT id FROM pieceItemList WHERE id = ?');
    foreach ($pieceItemIds as $pieceItemId) {
        if (!filter_var($pieceItemId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) || isset($validatedIds[(int) $pieceItemId])) {
            throw new InvalidArgumentException('Select each valid Piece Item only once.');
        }
        $pieceLookup->execute([$pieceItemId]);
        if (!$pieceLookup->fetchColumn()) {
            throw new InvalidArgumentException('A selected Piece Item no longer exists. Refresh and try again.');
        }
        $validatedIds[(int) $pieceItemId] = (int) $pieceItemId;
    }
    $pieceItemIds = array_values($validatedIds);

    $db->beginTransaction();
    $insertPattern = $db->prepare('INSERT INTO patternRecords (name, pieceCount) VALUES (?, ?)');
    $insertPattern->execute([$name, count($pieceItemIds)]);
    $patternId = (int) $db->lastInsertId();
    $insertPiece = $db->prepare('INSERT INTO patternPieceLinks (patternId, pieceNumber, pieceItemId) VALUES (?, ?, ?)');
    foreach ($pieceItemIds as $index => $pieceItemId) {
        $insertPiece->execute([$patternId, $index + 1, $pieceItemId]);
    }
    $db->commit();
    patternResponse(201, ['success' => true, 'data' => ['id' => $patternId, 'name' => $name, 'pieceCount' => count($pieceItemIds)]]);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    if ($error instanceof InvalidArgumentException) {
        patternResponse(422, ['success' => false, 'message' => $error->getMessage()]);
    }
    if ($error instanceof PDOException && ($error->errorInfo[1] ?? null) === 1062) {
        patternResponse(409, ['success' => false, 'message' => 'A pattern with this name already exists.']);
    }
    error_log('Pattern API: ' . $error->getMessage());
    patternResponse(503, ['success' => false, 'message' => 'Unable to load or save patterns. Check the database setup.']);
}
