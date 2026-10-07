<?php
require_once __DIR__ . '/../includes/db.php';

function respond(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function masterRecords(string $table, string $prefix): void
{
    if (!in_array($table, ['agents', 'distributors', 'transporters', 'customerRecords'], true)) {
        respond(400, ['success' => false, 'message' => 'Invalid resource.']);
    }
    $isCustomer = $table === 'customerRecords';
    $method = $_SERVER['REQUEST_METHOD'];
    if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'], true)) {
        header('Allow: GET, POST, PUT, DELETE');
        respond(405, ['success' => false, 'message' => 'Method not allowed.']);
    }
    try {
        $db = database();
        if ($method === 'GET') {
            $extraColumns = $isCustomer ? ', shopName, agentId, transporterId, distributorId' : '';
            $rows = $db->query("SELECT id, name, contact, COALESCE(email, '') AS email, city, state$extraColumns FROM `$table` ORDER BY created_at DESC, id DESC")->fetchAll();
            respond(200, ['success' => true, 'data' => $rows]);
        }
        if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
            respond(415, ['success' => false, 'message' => 'Content-Type must be application/json.']);
        }
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) {
            respond(400, ['success' => false, 'message' => 'A JSON object is required.']);
        }
        $id = $data['id'] ?? '';
        if (!is_string($id) || strlen($id) > 64 || ($method !== 'POST' && $id === '')) {
            respond(422, ['success' => false, 'message' => 'A valid record ID is required.']);
        }
        if ($method !== 'POST') {
            $query = $db->prepare("SELECT id FROM `$table` WHERE id = ?");
            $query->execute([$id]);
            if (!$query->fetch()) {
                respond(404, ['success' => false, 'message' => 'Record not found. Refresh the list.']);
            }
        }
        if ($method === 'DELETE') {
            $query = $db->prepare("DELETE FROM `$table` WHERE id = ?");
            $query->execute([$id]);
            respond(200, ['success' => true]);
        }
        $fields = [];
        $limits = ['name' => 150, 'contact' => 40, 'email' => 254, 'city' => 100, 'state' => 100];
        if ($isCustomer) {
            $limits += ['shopName' => 150, 'agentId' => 64, 'transporterId' => 64, 'distributorId' => 64];
        }
        foreach ($limits as $field => $limit) {
            $value = $data[$field] ?? '';
            if (!is_string($value) || mb_strlen($value, 'UTF-8') > $limit) {
                respond(422, ['success' => false, 'message' => "Invalid $field (maximum $limit characters)."]);
            }
            $fields[$field] = trim($value);
        }
        foreach ($isCustomer ? ['name', 'shopName'] : ['name', 'city', 'state'] as $required) {
            if ($fields[$required] === '') {
                respond(422, ['success' => false, 'message' => ucfirst($required) . ' is required.']);
            }
        }
        if (!preg_match('/^[6-9][0-9]{9}$/D', $fields['contact'])) {
            respond(422, ['success' => false, 'message' => 'Phone number must be 10 digits and start with 6, 7, 8 or 9.']);
        }
        if ($fields['email'] !== '' && !filter_var($fields['email'], FILTER_VALIDATE_EMAIL)) {
            respond(422, ['success' => false, 'message' => 'Enter a valid email address.']);
        }
        $fields['email'] = strtolower($fields['email']);
        if ($fields['email'] !== '') {
            $duplicate = $db->prepare("SELECT id FROM `$table` WHERE email = ? AND id <> ? LIMIT 1");
            $duplicate->execute([$fields['email'], $method === 'PUT' ? $id : '']);
            if ($duplicate->fetch()) {
                respond(409, ['success' => false, 'message' => 'This email is already used by another record.']);
            }
        }
        if ($isCustomer) {
            foreach (['agentId' => 'agents', 'transporterId' => 'transporters', 'distributorId' => 'distributors'] as $field => $master) {
                if ($fields[$field] !== '') {
                    $lookup = $db->prepare("SELECT id FROM `$master` WHERE id = ?");
                    $lookup->execute([$fields[$field]]);
                    if (!$lookup->fetch()) {
                        respond(422, ['success' => false, 'message' => 'Selected ' . $master . ' record no longer exists. Refresh the page.']);
                    }
                }
            }
        }
        $values = array_values($fields);
        $values[2] = $fields['email'] === '' ? null : $fields['email'];
        if ($isCustomer) {
            foreach (['agentId', 'transporterId', 'distributorId'] as $field) {
                $index = array_search($field, array_keys($fields), true);
                $values[$index] = $fields[$field] === '' ? null : $fields[$field];
            }
        }
        $columns = array_keys($fields);
        if ($method === 'POST') {
            $id = $prefix . bin2hex(random_bytes(12));
            $columnSql = implode(', ', $columns);
            $placeholders = implode(', ', array_fill(0, count($columns) + 1, '?'));
            $query = $db->prepare("INSERT INTO `$table` (id, $columnSql) VALUES ($placeholders)");
            $query->execute(array_merge([$id], $values));
        } else {
            $assignments = implode(', ', array_map(static function ($column) { return $column . ' = ?'; }, $columns));
            $query = $db->prepare("UPDATE `$table` SET $assignments WHERE id = ?");
            $query->execute(array_merge($values, [$id]));
        }
        respond($method === 'POST' ? 201 : 200, ['success' => true, 'data' => array_merge(['id' => $id], $fields)]);
    } catch (PDOException $error) {
        if (($error->errorInfo[1] ?? null) === 1062) {
            respond(409, ['success' => false, 'message' => 'This email is already used by another record.']);
        }
        if (($error->errorInfo[1] ?? null) === 1451) {
            respond(409, ['success' => false, 'message' => 'This record is linked to a customer. Update the customer before deleting it.']);
        }
        error_log('Master records database error: ' . $error->getMessage());
        respond(503, ['success' => false, 'message' => 'Database unavailable. Import database/order-booking.sql and check includes/db.php.']);
    } catch (Throwable $error) {
        error_log('Master records API error: ' . $error->getMessage());
        respond(500, ['success' => false, 'message' => 'Unable to complete the request.']);
    }
}
