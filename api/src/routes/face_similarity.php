<?php

require_once __DIR__ . '/../../config/conexao.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../services/FaceSimilarityService.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $db = getDBConnection();
    $datafaceDb = getDatafaceConnection();

    $authMiddleware = new AuthMiddleware($db);
    if (!$authMiddleware->handle()) {
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        Response::methodNotAllowed('Método não permitido');
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        Response::error('Payload inválido', 400);
        exit;
    }

    $landmarks = $input['landmarks'] ?? [];
    $limit = isset($input['limit']) ? (int)$input['limit'] : 10;
    $threshold = isset($input['threshold']) ? (float)$input['threshold'] : 70;
    $gender = $input['gender'] ?? null;

    $service = new FaceSimilarityService($datafaceDb);
    $results = $service->searchByLandmarks($landmarks, $limit, $threshold, $gender);

    Response::success([
        'total_found' => count($results),
        'max_results' => max(1, min(10, $limit)),
        'threshold' => $threshold,
        'gender_filter' => $gender,
        'results' => $results,
    ], 'Busca de similaridade finalizada');
} catch (Exception $e) {
    error_log('FACE_SIMILARITY ERROR: ' . $e->getMessage());
    Response::error('Erro ao consultar similaridade facial: ' . $e->getMessage(), 500);
}
