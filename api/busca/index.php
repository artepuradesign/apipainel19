<?php

// index.php

// Permitir CORS (opcional)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET");
header("Access-Control-Allow-Headers: Content-Type");

// Recebe CPF por GET ou POST
$cpf = $_POST['cpf'] ?? $_GET['cpf'] ?? null;

if (!$cpf) {
    echo json_encode([
        "status" => false,
        "erro" => "CPF não enviado."
    ]);
    exit;
}

// Sanitiza CPF
$cpf = preg_replace('/\D/', '', $cpf);

// Caminho do script Node.js
$scriptPath = __DIR__ . "/cpf-check.js";

// Comando para executar o Node
$cmd = "node $scriptPath $cpf";

// Executa o comando e captura saída e erros
$output = shell_exec($cmd . " 2>&1");

echo json_encode([
    "status" => true,
    "cpf" => $cpf,
    "exec_output" => $output
]);

?>
