<?php
require_once __DIR__ . '/master-records.php';

function productRows(PDO $db): array
{
    $rows = $db->query('SELECT p.*, c.name AS color FROM productRecords p JOIN colourRecords c ON c.id = p.colourId ORDER BY p.id DESC')->fetchAll();
    $itemRows = $db->query('SELECT id, name, itemType FROM itemList')->fetchAll();
    $items = []; $itemTypes = []; $itemDetails = [];
    foreach ($itemRows as $itemRow) {
        $items[$itemRow['id']] = $itemRow['name']; $itemTypes[$itemRow['id']] = $itemRow['itemType'];
        $itemDetails[$itemRow['id']] = ['id' => (int) $itemRow['id'], 'name' => $itemRow['name'], 'itemType' => $itemRow['itemType']];
    }
    $pieceRows = $db->query('SELECT id, name, photo FROM pieceItemList')->fetchAll();
    $pieceItems = []; $piecePhotos = [];
    foreach ($pieceRows as $pieceRow) { $pieceItems[$pieceRow['id']] = $pieceRow['name']; $piecePhotos[$pieceRow['id']] = $pieceRow['photo']; }
    $works = $db->query('SELECT id, name FROM additionalWork')->fetchAll(PDO::FETCH_KEY_PAIR);
    $sizes = ['LITTLE DOLLY' => '18-26', 'AMARI' => 'S-L', 'NIVI BLOSSOM' => '28-34'];
    $prefixes = ['LITTLE DOLLY' => 'Ld', 'AMARI' => 'Am', 'NIVI BLOSSOM' => 'Nv'];
    foreach ($rows as &$row) {
        $row['pieces'] = json_decode($row['pieces'], true) ?: [];
        foreach ($row['pieces'] as &$piece) {
            $piece['item'] = $pieceItems[$piece['pieceItemId'] ?? 0] ?? $items[$piece['itemId'] ?? 0] ?? '';
            $piece['itemType'] = $itemTypes[$piece['itemId'] ?? 0] ?? null;
            $piece['piecePhoto'] = $piecePhotos[$piece['pieceItemId'] ?? 0] ?? null;
            $piece['materials'] = array_map(static function ($id) use ($items) { return $items[$id] ?? ''; }, $piece['materialIds']);
            $piece['materialItems'] = array_values(array_filter(array_map(static function ($id) use ($itemDetails) { return $itemDetails[$id] ?? null; }, $piece['materialIds'])));
            foreach ($piece['additionalWorks'] as &$work) { $work['workType'] = $works[$work['workId']] ?? ''; }
            unset($work);
        }
        unset($piece);
        $row['id'] = (int) $row['id'];
        $row['pieceCount'] = (int) $row['pieceCount'];
        $row['bomCompleted'] = (bool) $row['bomCompleted'];
        $row['inProductList'] = (bool) $row['inProductList'];
        $row['description'] = (string) $row['designNumber'];
        $row['size'] = $sizes[$row['brand']] ?? '';
        $row['barcode'] = ($prefixes[$row['brand']] ?? '') . '-' . $row['designNumber'] . '-' . $row['color'] . '-' . $row['size'];
        $row['bomId'] = 'BOM-' . str_pad((string) $row['id'], 3, '0', STR_PAD_LEFT);
    }
    unset($row);
    return $rows;
}

function removeProductPhoto(?string $photo): void
{
    if (!$photo || !preg_match('~^uploads/products/[a-f0-9]{32}\.(jpg|png|webp)$~D', $photo)) { return; }
    $file = __DIR__ . '/../' . $photo;
    if (is_file($file) && !unlink($file)) { error_log('Unable to remove product photo: ' . $photo); }
}

function productRecords(string $mode): void
{
    $newPhoto = null;
    try {
        $db = database();
        $method = $_SERVER['REQUEST_METHOD'];
        if ($method === 'GET') {
            $rows = productRows($db);
            if ($mode === 'product') { $rows = array_values(array_filter($rows, static function ($r) { return $r['inProductList']; })); }
            respond(200, ['success' => true, 'data' => $rows]);
        }
        if (!in_array($method, ['POST', 'DELETE'], true)) {
            header('Allow: GET, POST, DELETE');
            respond(405, ['success' => false, 'message' => 'Method not allowed.']);
        }
        $multipart = stripos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') === 0;
        if (!$multipart && stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
            respond(415, ['success' => false, 'message' => 'JSON or multipart form data required.']);
        }
        $data = json_decode($multipart ? ($_POST['payload'] ?? '') : file_get_contents('php://input'), true);
        if (!is_array($data)) { respond(400, ['success' => false, 'message' => 'Invalid request body.']); }
        $action = $method === 'DELETE' ? 'delete' : ($data['action'] ?? 'save');
        if (!in_array($action, ['delete', 'import', 'status', 'save'], true)) { respond(400, ['success' => false, 'message' => 'Invalid action.']); }
        $id = $data['id'] ?? null;
        $old = null;
        if ($id) {
            if (!filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])) { respond(422, ['success' => false, 'message' => 'Invalid ID.']); }
            $query = $db->prepare('SELECT * FROM productRecords WHERE id = ?');
            $query->execute([$id]); $old = $query->fetch();
            if (!$old) { respond(404, ['success' => false, 'message' => 'Record not found.']); }
        }
        if ($action === 'delete') {
            if (!$old) { respond(422, ['success' => false, 'message' => 'ID required.']); }
            $query = $db->prepare('DELETE FROM productRecords WHERE id = ?'); $query->execute([$id]);
            removeProductPhoto($old['photo']);
            respond(200, ['success' => true]);
        }
        if ($action === 'import') {
            $ids = $data['ids'] ?? [];
            if ($mode !== 'product' || !is_array($ids) || !$ids || count($ids) > 500) { respond(422, ['success' => false, 'message' => 'Select BOM records to import.']); }
            $db->beginTransaction();
            $eligible = $db->prepare("SELECT id FROM productRecords WHERE id = ? AND bomCompleted = 1 AND status = 'active' FOR UPDATE");
            $query = $db->prepare("UPDATE productRecords SET inProductList = 1 WHERE id = ? AND bomCompleted = 1 AND status = 'active'");
            foreach ($ids as $importId) {
                if (!filter_var($importId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])) { throw new InvalidArgumentException('Invalid import ID.'); }
                $eligible->execute([$importId]);
                if (!$eligible->fetch()) { throw new InvalidArgumentException('A selected BOM is no longer complete or active. Refresh the import list.'); }
                $query->execute([$importId]);
            }
            $db->commit();
            respond(200, ['success' => true]);
        }
        if ($action === 'status') {
            if (!$old || !in_array($data['status'] ?? '', ['active', 'inactive'], true)) { respond(422, ['success' => false, 'message' => 'Valid ID and status required.']); }
            $query = $db->prepare('UPDATE productRecords SET status = ? WHERE id = ?'); $query->execute([$data['status'], $id]);
            respond(200, ['success' => true]);
        }
        $brand = $data['brand'] ?? '';
        $design = (string) ($data['designNumber'] ?? '');
        $pattern = $data['pattern'] ?? '';
        $mrp = $data['mrp'] ?? null;
        if (!in_array($brand, ['LITTLE DOLLY', 'AMARI', 'NIVI BLOSSOM'], true)) { throw new InvalidArgumentException('Select a valid brand.'); }
        if (!preg_match('/^[0-9]{1,18}$/D', $design)) { throw new InvalidArgumentException('Design number must contain 1–18 digits only.'); }
        $design = ltrim($design, '0') ?: '0';
        if (!is_string($pattern) || ($pattern !== '' && !preg_match('/^[A-Za-z0-9 ]{1,150}$/D', $pattern))) { throw new InvalidArgumentException('Pattern must contain letters, numbers and spaces only.'); }
        if ($mrp === '') { $mrp = null; }
        if ($mrp !== null && (!is_scalar($mrp) || !preg_match('/^[0-9]{1,10}(\.[0-9]{1,2})?$/D', (string) $mrp))) { throw new InvalidArgumentException('MRP must be a non-negative number with up to two decimals.'); }
        $lookup = $db->prepare('SELECT id FROM colourRecords WHERE id = ?'); $lookup->execute([$data['colourId'] ?? 0]);
        if (!$lookup->fetch()) { throw new InvalidArgumentException('Select a colour from Colour master.'); }
        $complete = $mode === 'bom' || ($old && $old['bomCompleted']);
        $pieces = $complete && $mode === 'product' ? json_decode($old['pieces'], true) : ($data['pieces'] ?? []);
        if (!is_array($pieces) || count($pieces) > 5 || ($mode === 'bom' && count($pieces) < 1)) { throw new InvalidArgumentException('Configure 1–5 pieces for BOM.'); }
        $itemLookup = $db->prepare('SELECT id, name, itemType FROM itemList WHERE id = ?');
        $pieceItemLookup = $db->prepare('SELECT id FROM pieceItemList WHERE id = ?');
        $workLookup = $db->prepare('SELECT id FROM additionalWork WHERE id = ?');
        $normalized = [];
        foreach ($pieces as $index => $piece) {
            if (!is_array($piece)) { throw new InvalidArgumentException('Invalid piece.'); }
            $pieceItemId = $piece['pieceItemId'] ?? null;
            $legacyItemId = $piece['legacyItemId'] ?? $piece['itemId'] ?? null;
            if ($pieceItemId !== null) {
                $pieceItemLookup->execute([$pieceItemId]);
                if (!$pieceItemLookup->fetch()) { throw new InvalidArgumentException('Select each garment piece from Piece Items.'); }
            } elseif ($legacyItemId !== null) {
                $itemLookup->execute([$legacyItemId]);
                if (!$itemLookup->fetch()) { throw new InvalidArgumentException('Select each garment piece from Piece Items.'); }
            } else {
                $itemName = $piece['itemName'] ?? '';
                if (!is_string($itemName) || trim($itemName) === '' || mb_strlen($itemName, 'UTF-8') > 150) {
                    throw new InvalidArgumentException('Select each garment piece from Piece Items.');
                }
                $pieceItemLookupByName = $db->prepare('SELECT id FROM pieceItemList WHERE name = ?');
                $pieceItemLookupByName->execute([trim($itemName)]);
                if (!$pieceItemLookupByName->fetch()) { throw new InvalidArgumentException('Select each garment piece from Piece Items.'); }
            }
            $materials = $piece['materialIds'] ?? [];
            $works = $piece['additionalWorks'] ?? [];
            if (!is_array($materials) || !is_array($works) || count($materials) > 100 || count($works) > 100) { throw new InvalidArgumentException('Invalid piece details.'); }
            foreach ($materials as $material) {
                $itemLookup->execute([$material]); $materialRow = $itemLookup->fetch();
                if (!$materialRow) { throw new InvalidArgumentException('Invalid material selection.'); }
                if ($mode === 'bom' && !$materialRow['itemType']) { throw new InvalidArgumentException('Configure the item type in Item List before adding it to a new BOM.'); }
            }
            $validWorks = [];
            foreach ($works as $workOrder => $work) {
                $workLookup->execute([$work['workId'] ?? 0]);
                if (!$workLookup->fetch() || !in_array($work['stage'] ?? '', ['Before Cutting','After Cutting','After Stitching','After Ironing'], true)) { throw new InvalidArgumentException('Select valid additional work and timing.'); }
                $validWorks[] = ['workId' => (int) $work['workId'], 'stage' => $work['stage'], 'workOrder' => (int) $workOrder + 1];
            }
            $afterCuttingCount = count(array_filter($validWorks, static function ($work) { return $work['stage'] === 'After Cutting'; }));
            if ($afterCuttingCount > 5) { throw new InvalidArgumentException('Select no more than 5 additional works between Cutting and Stitching.'); }
            foreach (['After Stitching', 'After Ironing'] as $sequentialStage) {
                $count = count(array_filter($validWorks, static function ($work) use ($sequentialStage) { return $work['stage'] === $sequentialStage; }));
                if ($count > 1) { throw new InvalidArgumentException('Select only one additional work at ' . $sequentialStage . '.'); }
            }
            $normalized[] = ['number' => $index + 1, 'pieceItemId' => $pieceItemId === null ? null : (int) $pieceItemId,
                'legacyItemId' => $pieceItemId === null ? (int) ($legacyItemId ?? 0) : null,
                'itemName' => isset($itemName) ? trim($itemName) : null,
                'materialIds' => array_values(array_unique(array_map('intval', $materials))), 'additionalWorks' => array_values($validWorks)];
            unset($itemName);
        }
        if ($mode === 'product' && $old) { $pattern = $old['pattern']; $mrp = $old['mrp']; }
        if (isset($_FILES['photo']) && $_FILES['photo']['error'] !== UPLOAD_ERR_NO_FILE) {
            $file = $_FILES['photo'];
            if ($file['error'] !== UPLOAD_ERR_OK || $file['size'] > 5 * 1024 * 1024) { throw new InvalidArgumentException('Photo upload failed. Maximum size is 5 MB.'); }
            $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
            $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
            if (!isset($extensions[$mime]) || !getimagesize($file['tmp_name'])) { throw new InvalidArgumentException('Upload a JPEG, PNG or WebP image.'); }
            $dir = __DIR__ . '/../uploads/products';
            if (!is_dir($dir) && !mkdir($dir, 0755, true)) { throw new RuntimeException('Photo folder unavailable.'); }
            $newPhoto = 'uploads/products/' . bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
            if (!move_uploaded_file($file['tmp_name'], __DIR__ . '/../' . $newPhoto)) { throw new RuntimeException('Photo could not be saved.'); }
        }
        $db->beginTransaction();
        $legacyItemName = $db->prepare('SELECT name FROM itemList WHERE id = ?');
        $findPieceItem = $db->prepare('SELECT id FROM pieceItemList WHERE name = ?');
        $insertPieceItem = $db->prepare('INSERT INTO pieceItemList (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)');
        foreach ($normalized as &$piece) {
            if ($piece['pieceItemId'] !== null) { continue; }
            $name = $piece['itemName'];
            if ($piece['legacyItemId']) {
                $legacyItemName->execute([$piece['legacyItemId']]);
                $name = (string) $legacyItemName->fetchColumn();
            }
            if ($name === '') { throw new InvalidArgumentException('Select each garment piece from Piece Items.'); }
            $findPieceItem->execute([$name]);
            $piece['pieceItemId'] = $findPieceItem->fetchColumn();
            if (!$piece['pieceItemId']) {
                $insertPieceItem->execute([$name]);
                $piece['pieceItemId'] = (int) $db->lastInsertId();
            }
            $piece['pieceItemId'] = (int) $piece['pieceItemId'];
            unset($piece['legacyItemId'], $piece['itemName']);
        }
        unset($piece);
        $values = [$brand, $design, $data['colourId'], $pattern, $mrp, $newPhoto ?: ($old['photo'] ?? null), json_encode($normalized), max(1, count($normalized)), $complete ? 1 : 0];
        if ($old) {
            $query = $db->prepare('UPDATE productRecords SET brand=?, designNumber=?, colourId=?, pattern=?, mrp=?, photo=?, pieces=?, pieceCount=?, bomCompleted=? WHERE id=?');
            $query->execute(array_merge($values, [$id]));
        } else {
            $query = $db->prepare('INSERT INTO productRecords (brand,designNumber,colourId,pattern,mrp,photo,pieces,pieceCount,bomCompleted,createdFrom,inProductList) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
            $query->execute(array_merge($values, [$mode, $mode === 'product' ? 1 : 0])); $id = (int) $db->lastInsertId();
        }
        foreach (['productItemLinks', 'productWorkLinks', 'productWorkSteps'] as $linkTable) { $query = $db->prepare("DELETE FROM $linkTable WHERE productId=?"); $query->execute([$id]); }
        $itemInsert = $db->prepare('INSERT INTO productItemLinks (productId,pieceNumber,itemId,role) VALUES (?,?,?,?)');
        $workInsert = $db->prepare('INSERT INTO productWorkSteps (productId,pieceNumber,workOrder,workId,stage) VALUES (?,?,?,?,?)');
        foreach ($normalized as $piece) {
            foreach ($piece['materialIds'] as $material) { $itemInsert->execute([$id, $piece['number'], $material, 'material']); }
            foreach ($piece['additionalWorks'] as $work) { $workInsert->execute([$id, $piece['number'], $work['workOrder'], $work['workId'], $work['stage']]); }
        }
        $db->commit();
        if ($newPhoto && $old) { removeProductPhoto($old['photo']); }
        respond(200, ['success' => true, 'data' => ['id' => (int) $id]]);
    } catch (Throwable $error) {
        if (isset($db) && $db->inTransaction()) { $db->rollBack(); }
        if ($newPhoto) { removeProductPhoto($newPhoto); }
        if ($error instanceof InvalidArgumentException) { respond(422, ['success' => false, 'message' => $error->getMessage()]); }
        if ($error instanceof PDOException && ($error->errorInfo[1] ?? null) === 1062) { respond(409, ['success' => false, 'message' => 'Design number already exists.']); }
        error_log('Product API: ' . $error->getMessage());
        respond(503, ['success' => false, 'message' => 'Unable to save/load product. Import the latest SQL and check the database/upload folder.']);
    }
}
