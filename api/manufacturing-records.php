<?php
require_once __DIR__ . '/master-records.php';

function manufacturingRecords(string $table): void
{
    if (!in_array($table, ['employeeRecords', 'colourRecords', 'itemList', 'pieceItemList', 'additionalWork'], true)) {
        respond(400, ['success' => false, 'message' => 'Invalid resource.']);
    }
    $employee = $table === 'employeeRecords';
    $method = $_SERVER['REQUEST_METHOD'];
    if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'], true)) {
        header('Allow: GET, POST, PUT, DELETE');
        respond(405, ['success' => false, 'message' => 'Method not allowed.']);
    }
    try {
        $db = database();
        $columns = $employee ? 'id, name, category, employeeType' : 'id, name';
        if ($method === 'GET') {
            $rows = $db->query("SELECT $columns FROM `$table` ORDER BY createdAt DESC, id DESC")->fetchAll();
            if (!$employee) {
                foreach ($rows as &$row) { $row['id'] = (int) $row['id']; }
                unset($row);
            }
            respond(200, ['success' => true, 'data' => $rows]);
        }
        if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
            respond(415, ['success' => false, 'message' => 'Content-Type must be application/json.']);
        }
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) { respond(400, ['success' => false, 'message' => 'JSON object required.']); }
        $id = $data['id'] ?? '';
        if ($method !== 'POST') {
            if (($employee && (!is_string($id) || $id === '' || strlen($id) > 64)) ||
                (!$employee && !filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]))) {
                respond(422, ['success' => false, 'message' => 'Invalid record ID.']);
            }
            $query = $db->prepare("SELECT id FROM `$table` WHERE id = ?");
            $query->execute([$id]);
            if (!$query->fetch()) { respond(404, ['success' => false, 'message' => 'Record not found. Refresh the page.']); }
        }
        if ($method === 'DELETE') {
            if ($table === 'pieceItemList') {
                $records = $db->query('SELECT pieces FROM productRecords')->fetchAll(PDO::FETCH_COLUMN);
                foreach ($records as $piecesJson) {
                    foreach (json_decode($piecesJson, true) ?: [] as $piece) {
                        if ((string) ($piece['pieceItemId'] ?? '') === (string) $id) {
                            respond(409, ['success' => false, 'message' => 'This piece item is used by a BOM/product and cannot be deleted.']);
                        }
                    }
                }
            }
            $query = $db->prepare("DELETE FROM `$table` WHERE id = ?");
            $query->execute([$id]);
            respond(200, ['success' => true]);
        }
        $name = $data['name'] ?? '';
        if (!is_string($name) || trim($name) === '' || mb_strlen($name, 'UTF-8') > 150) {
            respond(422, ['success' => false, 'message' => 'Name is required (maximum 150 characters).']);
        }
        $fields = ['name' => trim($name)];
        if ($employee) {
            $category = $data['category'] ?? '';
            $type = $data['employeeType'] ?? '';
            if (!in_array($category, ['cutting', 'stitching', 'ironing'], true) || !in_array($type, ['housein', 'outsource'], true)) {
                respond(422, ['success' => false, 'message' => 'Select a valid category and employee type.']);
            }
            $fields += ['category' => $category, 'employeeType' => $type];
        }
        if ($method === 'POST') {
            if ($employee) { $fields = ['id' => 'WRK' . bin2hex(random_bytes(12))] + $fields; }
            $columnSql = implode(', ', array_keys($fields));
            $marks = implode(', ', array_fill(0, count($fields), '?'));
            $query = $db->prepare("INSERT INTO `$table` ($columnSql) VALUES ($marks)");
            $query->execute(array_values($fields));
            $id = $employee ? $fields['id'] : (int) $db->lastInsertId();
        } else {
            $sets = implode(', ', array_map(static function ($column) { return $column . ' = ?'; }, array_keys($fields)));
            $query = $db->prepare("UPDATE `$table` SET $sets WHERE id = ?");
            $query->execute(array_merge(array_values($fields), [$id]));
        }
        respond($method === 'POST' ? 201 : 200, ['success' => true, 'data' => ['id' => $id] + $fields]);
    } catch (PDOException $error) {
        if (($error->errorInfo[1] ?? null) === 1062) { respond(409, ['success' => false, 'message' => 'This name already exists.']); }
        if (($error->errorInfo[1] ?? null) === 1451) { respond(409, ['success' => false, 'message' => 'This master record is used by a BOM/product. Update or delete the linked record first.']); }
        error_log('Manufacturing master database error: ' . $error->getMessage());
        respond(503, ['success' => false, 'message' => 'Database unavailable. Import database/order-booking.sql and check includes/db.php.']);
    } catch (Throwable $error) {
        error_log('Manufacturing master error: ' . $error->getMessage());
        respond(500, ['success' => false, 'message' => 'Unable to complete request.']);
    }
}
