<?php
require_once __DIR__ . '/BaseModel.php';

class CnpjChatInteligente extends BaseModel {
    protected $agentsTable = 'cnpj_chatinteligente_agents';
    protected $connectionsTable = 'cnpj_chatinteligente_connections';

    public function __construct($db) {
        parent::__construct($db);
    }

    public function getAgentByUserId(int $userId): ?array {
        $query = "SELECT id, module_id, user_id, agent_name, prompt, status, openai_api_key, created_at, updated_at
                  FROM {$this->agentsTable}
                  WHERE user_id = ?
                  LIMIT 1";
        $stmt = $this->db->prepare($query);
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function upsertAgent(int $userId, array $data): array {
        $current = $this->getAgentByUserId($userId);

        $agentName = trim((string)($data['agent_name'] ?? ''));
        $prompt = trim((string)($data['prompt'] ?? ''));
        $apiKey = trim((string)($data['openai_api_key'] ?? ''));
        $keepExistingApiKey = (bool)($data['keep_existing_api_key'] ?? false);

        if ($agentName === '' || mb_strlen($agentName) < 2 || mb_strlen($agentName) > 120) {
            throw new Exception('Nome do agente deve ter entre 2 e 120 caracteres');
        }

        if ($prompt === '' || mb_strlen($prompt) < 20 || mb_strlen($prompt) > 5000) {
            throw new Exception('Prompt deve ter entre 20 e 5000 caracteres');
        }

        $finalApiKey = null;
        if ($apiKey !== '') {
            if (mb_strlen($apiKey) < 20 || mb_strlen($apiKey) > 255) {
                throw new Exception('API Key inválida');
            }
            $finalApiKey = $apiKey;
        } elseif ($keepExistingApiKey && $current && !empty($current['openai_api_key'])) {
            $finalApiKey = (string)$current['openai_api_key'];
        }

        if ($finalApiKey === null || $finalApiKey === '') {
            throw new Exception('API Key é obrigatória para configurar o agente');
        }

        if ($current) {
            $update = "UPDATE {$this->agentsTable}
                       SET module_id = 187,
                           agent_name = ?,
                           openai_api_key = ?,
                           prompt = ?,
                           status = 'ativo',
                           updated_at = NOW()
                       WHERE user_id = ?";
            $stmt = $this->db->prepare($update);
            $stmt->execute([$agentName, $finalApiKey, $prompt, $userId]);
        } else {
            $insert = "INSERT INTO {$this->agentsTable}
                      (module_id, user_id, agent_name, openai_api_key, prompt, status, created_at, updated_at)
                      VALUES (187, ?, ?, ?, ?, 'ativo', NOW(), NOW())";
            $stmt = $this->db->prepare($insert);
            $stmt->execute([$userId, $agentName, $finalApiKey, $prompt]);
        }

        $saved = $this->getAgentByUserId($userId);
        if (!$saved) {
            throw new Exception('Não foi possível salvar a configuração do agente');
        }

        return $this->normalizeAgent($saved);
    }

    public function listConnectionsByUserId(int $userId): array {
        $query = "SELECT id, module_id, user_id, session_name, whatsapp_number, connection_status, qr_code, integration_token, pairing_code, connection_error, last_connected_at, created_at, updated_at
                  FROM {$this->connectionsTable}
                  WHERE user_id = ?
                  ORDER BY id DESC";
        $stmt = $this->db->prepare($query);
        $stmt->execute([$userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function createConnection(int $userId, array $data): array {
        $sessionName = trim((string)($data['session_name'] ?? ''));
        $whatsAppNumber = preg_replace('/\D+/', '', (string)($data['whatsapp_number'] ?? ''));

        if ($sessionName === '' || mb_strlen($sessionName) < 2 || mb_strlen($sessionName) > 120) {
            throw new Exception('Nome da conexão deve ter entre 2 e 120 caracteres');
        }

        if ($whatsAppNumber === '' || mb_strlen($whatsAppNumber) < 10 || mb_strlen($whatsAppNumber) > 13) {
            throw new Exception('Número de WhatsApp inválido (10 a 13 dígitos)');
        }

        $integrationToken = bin2hex(random_bytes(24));

        $insert = "INSERT INTO {$this->connectionsTable}
                  (module_id, user_id, session_name, whatsapp_number, connection_status, qr_code, integration_token, pairing_code, connection_error, created_at, updated_at)
                  VALUES (188, ?, ?, ?, 'pendente', NULL, ?, NULL, NULL, NOW(), NOW())";
        $stmt = $this->db->prepare($insert);
        $stmt->execute([$userId, $sessionName, $whatsAppNumber, $integrationToken]);

        $id = (int)$this->db->lastInsertId();
        return $this->getConnectionByIdForUser($id, $userId) ?? [];
    }

    public function updateConnectionStatus(int $userId, int $id, string $status): array {
        $allowed = ['pendente', 'conectado', 'desconectado'];
        if (!in_array($status, $allowed, true)) {
            throw new Exception('Status de conexão inválido');
        }

        $update = "UPDATE {$this->connectionsTable}
                   SET connection_status = ?,
                       qr_code = CASE WHEN ? = 'conectado' THEN NULL ELSE qr_code END,
                       connection_error = CASE WHEN ? = 'conectado' THEN NULL ELSE connection_error END,
                       last_connected_at = CASE WHEN ? = 'conectado' THEN NOW() ELSE last_connected_at END,
                       updated_at = NOW()
                   WHERE id = ? AND user_id = ?";
        $stmt = $this->db->prepare($update);
        $stmt->execute([$status, $status, $status, $status, $id, $userId]);

        $row = $this->getConnectionByIdForUser($id, $userId);
        if (!$row) {
            throw new Exception('Conexão não encontrada');
        }

        return $row;
    }

    private function getConnectionByIdForUser(int $id, int $userId): ?array {
        $query = "SELECT id, module_id, user_id, session_name, whatsapp_number, connection_status, qr_code, integration_token, pairing_code, connection_error, last_connected_at, created_at, updated_at
                  FROM {$this->connectionsTable}
                  WHERE id = ? AND user_id = ?
                  LIMIT 1";
        $stmt = $this->db->prepare($query);
        $stmt->execute([$id, $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function rotateConnectionToken(int $userId, int $id): array {
        $row = $this->getConnectionByIdForUser($id, $userId);
        if (!$row) {
            throw new Exception('Conexão não encontrada');
        }

        $newToken = bin2hex(random_bytes(24));
        $query = "UPDATE {$this->connectionsTable}
                  SET integration_token = ?, updated_at = NOW()
                  WHERE id = ? AND user_id = ?";
        $stmt = $this->db->prepare($query);
        $stmt->execute([$newToken, $id, $userId]);

        $updated = $this->getConnectionByIdForUser($id, $userId);
        if (!$updated) {
            throw new Exception('Não foi possível atualizar o token da conexão');
        }

        return $updated;
    }

    public function updateConnectionFromN8n(string $integrationToken, array $payload): array {
        $row = $this->getConnectionByToken($integrationToken);
        if (!$row) {
            throw new Exception('Conexão inválida para integração n8n');
        }

        $status = trim((string)($payload['connection_status'] ?? ''));
        $allowed = ['pendente', 'conectado', 'desconectado'];
        if ($status === '' || !in_array($status, $allowed, true)) {
            $status = (string)$row['connection_status'];
        }

        $qrCode = array_key_exists('qr_code', $payload)
            ? (string)($payload['qr_code'] ?? '')
            : (string)($row['qr_code'] ?? '');
        $pairingCode = array_key_exists('pairing_code', $payload)
            ? trim((string)($payload['pairing_code'] ?? ''))
            : (string)($row['pairing_code'] ?? '');
        $error = array_key_exists('connection_error', $payload)
            ? trim((string)($payload['connection_error'] ?? ''))
            : (string)($row['connection_error'] ?? '');

        if ($status === 'conectado') {
            $qrCode = '';
            $error = '';
        }

        $query = "UPDATE {$this->connectionsTable}
                  SET connection_status = ?,
                      qr_code = ?,
                      pairing_code = ?,
                      connection_error = ?,
                      last_connected_at = CASE WHEN ? = 'conectado' THEN NOW() ELSE last_connected_at END,
                      updated_at = NOW()
                  WHERE id = ?";
        $stmt = $this->db->prepare($query);
        $stmt->execute([
            $status,
            $qrCode !== '' ? $qrCode : null,
            $pairingCode !== '' ? $pairingCode : null,
            $error !== '' ? $error : null,
            $status,
            (int)$row['id'],
        ]);

        $updated = $this->getConnectionByToken($integrationToken);
        if (!$updated) {
            throw new Exception('Falha ao sincronizar conexão');
        }

        return $updated;
    }

    public function getRuntimeConfigByToken(string $integrationToken): array {
        $query = "SELECT
                    c.id AS connection_id,
                    c.user_id,
                    c.session_name,
                    c.whatsapp_number,
                    c.connection_status,
                    c.integration_token,
                    a.agent_name,
                    a.prompt,
                    a.openai_api_key
                  FROM {$this->connectionsTable} c
                  INNER JOIN {$this->agentsTable} a ON a.user_id = c.user_id
                  WHERE c.integration_token = ?
                  LIMIT 1";
        $stmt = $this->db->prepare($query);
        $stmt->execute([$integrationToken]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new Exception('Configuração não encontrada para o token informado');
        }

        if (empty($row['openai_api_key'])) {
            throw new Exception('A conexão existe, mas o usuário não cadastrou API Key da OpenAI');
        }

        if (empty($row['prompt'])) {
            throw new Exception('A conexão existe, mas o prompt do agente está vazio');
        }

        return [
            'connection_id' => (int)$row['connection_id'],
            'user_id' => (int)$row['user_id'],
            'session_name' => (string)$row['session_name'],
            'whatsapp_number' => (string)$row['whatsapp_number'],
            'connection_status' => (string)$row['connection_status'],
            'agent_name' => (string)($row['agent_name'] ?? ''),
            'prompt' => (string)($row['prompt'] ?? ''),
            'openai_api_key' => (string)($row['openai_api_key'] ?? ''),
        ];
    }

    private function getConnectionByToken(string $integrationToken): ?array {
        $query = "SELECT id, module_id, user_id, session_name, whatsapp_number, connection_status, qr_code, integration_token, pairing_code, connection_error, last_connected_at, created_at, updated_at
                  FROM {$this->connectionsTable}
                  WHERE integration_token = ?
                  LIMIT 1";
        $stmt = $this->db->prepare($query);
        $stmt->execute([$integrationToken]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function normalizeAgent(array $row): array {
        $rawKey = (string)($row['openai_api_key'] ?? '');
        $masked = null;

        if ($rawKey !== '') {
            $prefix = mb_substr($rawKey, 0, 6);
            $suffix = mb_substr($rawKey, -4);
            $masked = $prefix . str_repeat('*', max(mb_strlen($rawKey) - 10, 4)) . $suffix;
        }

        return [
            'id' => (int)($row['id'] ?? 0),
            'module_id' => (int)($row['module_id'] ?? 187),
            'user_id' => (int)($row['user_id'] ?? 0),
            'agent_name' => (string)($row['agent_name'] ?? ''),
            'prompt' => (string)($row['prompt'] ?? ''),
            'status' => (string)($row['status'] ?? 'ativo'),
            'has_api_key' => $rawKey !== '',
            'api_key_masked' => $masked,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }
}