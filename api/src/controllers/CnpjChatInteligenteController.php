<?php
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../models/CnpjChatInteligente.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class CnpjChatInteligenteController {
    private $model;

    public function __construct($db) {
        $this->model = new CnpjChatInteligente($db);
    }

    public function getAgentConfig() {
        try {
            $userId = AuthMiddleware::getCurrentUserId();
            if (!$userId) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $agent = $this->model->getAgentByUserId((int)$userId);
            if (!$agent) {
                Response::success([
                    'id' => 0,
                    'module_id' => 187,
                    'user_id' => (int)$userId,
                    'agent_name' => '',
                    'prompt' => '',
                    'status' => 'ativo',
                    'has_api_key' => false,
                    'api_key_masked' => null,
                ], 'Configuração ainda não criada');
                return;
            }

            $normalized = [
                'id' => (int)($agent['id'] ?? 0),
                'module_id' => (int)($agent['module_id'] ?? 187),
                'user_id' => (int)($agent['user_id'] ?? $userId),
                'agent_name' => (string)($agent['agent_name'] ?? ''),
                'prompt' => (string)($agent['prompt'] ?? ''),
                'status' => (string)($agent['status'] ?? 'ativo'),
                'has_api_key' => !empty($agent['openai_api_key']),
                'api_key_masked' => !empty($agent['openai_api_key']) ? substr((string)$agent['openai_api_key'], 0, 6) . '****' : null,
                'created_at' => $agent['created_at'] ?? null,
                'updated_at' => $agent['updated_at'] ?? null,
            ];

            Response::success($normalized, 'Configuração carregada');
        } catch (Exception $e) {
            Response::error('Erro ao carregar configuração do agente: ' . $e->getMessage(), 500);
        }
    }

    public function saveAgentConfig() {
        try {
            $userId = AuthMiddleware::getCurrentUserId();
            if (!$userId) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $raw = file_get_contents('php://input');
            $input = json_decode($raw, true);
            if (!$input || !is_array($input)) {
                Response::error('Dados inválidos', 400);
                return;
            }

            $saved = $this->model->upsertAgent((int)$userId, $input);
            Response::success($saved, 'Configuração do agente salva com sucesso');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function listConnections() {
        try {
            $userId = AuthMiddleware::getCurrentUserId();
            if (!$userId) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $rows = $this->model->listConnectionsByUserId((int)$userId);
            Response::success(['data' => $rows], 'Conexões carregadas com sucesso');
        } catch (Exception $e) {
            Response::error('Erro ao carregar conexões: ' . $e->getMessage(), 500);
        }
    }

    public function createConnection() {
        try {
            $userId = AuthMiddleware::getCurrentUserId();
            if (!$userId) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $raw = file_get_contents('php://input');
            $input = json_decode($raw, true);
            if (!$input || !is_array($input)) {
                Response::error('Dados inválidos', 400);
                return;
            }

            $created = $this->model->createConnection((int)$userId, $input);
            Response::success($created, 'Conexão criada com sucesso', 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function updateConnectionStatus() {
        try {
            $userId = AuthMiddleware::getCurrentUserId();
            if (!$userId) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $raw = file_get_contents('php://input');
            $input = json_decode($raw, true);
            if (!$input || !is_array($input)) {
                Response::error('Dados inválidos', 400);
                return;
            }

            $id = (int)($input['id'] ?? 0);
            $status = trim((string)($input['connection_status'] ?? ''));

            if ($id <= 0 || $status === '') {
                Response::error('ID e status são obrigatórios', 400);
                return;
            }

            $updated = $this->model->updateConnectionStatus((int)$userId, $id, $status);
            Response::success($updated, 'Status atualizado com sucesso');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function rotateConnectionToken() {
        try {
            $userId = AuthMiddleware::getCurrentUserId();
            if (!$userId) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $raw = file_get_contents('php://input');
            $input = json_decode($raw, true);
            if (!$input || !is_array($input)) {
                Response::error('Dados inválidos', 400);
                return;
            }

            $id = (int)($input['id'] ?? 0);
            if ($id <= 0) {
                Response::error('ID da conexão é obrigatório', 400);
                return;
            }

            $updated = $this->model->rotateConnectionToken((int)$userId, $id);
            Response::success($updated, 'Token da integração atualizado com sucesso');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function getRuntimeConfigForN8n() {
        try {
            $token = $this->getIntegrationTokenFromRequest();
            if ($token === '') {
                Response::error('Token de integração não informado', 401);
                return;
            }

            $config = $this->model->getRuntimeConfigByToken($token);
            Response::success($config, 'Configuração runtime carregada com sucesso');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function syncConnectionFromN8n() {
        try {
            $token = $this->getIntegrationTokenFromRequest();
            if ($token === '') {
                Response::error('Token de integração não informado', 401);
                return;
            }

            $raw = file_get_contents('php://input');
            $input = json_decode($raw, true);
            if (!$input || !is_array($input)) {
                Response::error('Payload inválido para sincronização', 400);
                return;
            }

            $updated = $this->model->updateConnectionFromN8n($token, $input);
            Response::success($updated, 'Conexão sincronizada com sucesso');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    private function getIntegrationTokenFromRequest(): string {
        $headerToken = $_SERVER['HTTP_X_INTEGRATION_TOKEN'] ?? '';
        $queryToken = $_GET['token'] ?? '';
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

        $bearerToken = '';
        if (is_string($authHeader) && preg_match('/Bearer\s+(.+)/i', $authHeader, $matches)) {
            $bearerToken = trim((string)$matches[1]);
        }

        $token = trim((string)($headerToken ?: ($queryToken ?: $bearerToken)));
        if ($token === '') {
            return '';
        }

        return preg_replace('/[^a-zA-Z0-9]/', '', $token);
    }
}