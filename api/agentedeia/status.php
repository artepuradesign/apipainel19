<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, Accept");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$cpf = $_GET['cpf'] ?? null;
if (!$cpf) {
    echo json_encode([
        'success' => false,
        'error' => 'CPF não informado'
    ]);
    exit;
}

$cpf = preg_replace('/\D/', '', $cpf);
$logFile = sys_get_temp_dir() . "/cpf-check-{$cpf}.log";

if (!file_exists($logFile)) {
    echo json_encode([
        'success' => true,
        'cpf' => $cpf,
        'status' => 'queued',
        'message' => 'Aguardando início do processamento'
    ]);
    exit;
}

$content = @file_get_contents($logFile) ?: '';
$tail = trim(substr($content, -2000));

$status = 'processing';
$message = 'Processando no servidor';

if (strpos($content, '❌') !== false || strpos($content, 'ERRO') !== false) {
    $status = 'error';
    $message = 'Falha durante o processamento';
} elseif (strpos($content, '✅ n8n OK') !== false) {
    $status = 'n8n_sent';
    $message = 'Finalizado e enviado ao n8n';
} elseif (strpos($content, '🔗 LINK FINAL') !== false || strpos($content, '📡 Enviando ao n8n') !== false) {
    $status = 'telegram_sent';
    $message = 'Enviado ao Telegram, aguardando retorno do n8n';
} elseif (strpos($content, '⏰ Timeout atingido') !== false) {
    $status = 'timeout';
    $message = 'Tempo limite de processamento atingido';
} elseif (strpos($content, '📤 CPF enviado') !== false || strpos($content, '✅ Logado') !== false) {
    $status = 'processing';
    $message = 'Processando no Telegram';
}

echo json_encode([
    'success' => true,
    'cpf' => $cpf,
    'status' => $status,
    'message' => $message,
    'tail' => $tail
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

?>