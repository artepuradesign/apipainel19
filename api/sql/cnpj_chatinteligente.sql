-- cnpj_chatinteligente.sql
-- Banco: MySQL / MariaDB
-- Módulos:
--   187 -> /dashboard/cnpj-chatinteligente (configuração do agente)
--   188 -> /dashboard/cnpj-conexoes (conexões WhatsApp)

CREATE TABLE IF NOT EXISTS cnpj_chatinteligente_agents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  module_id INT NOT NULL DEFAULT 187,
  user_id INT NOT NULL,
  agent_name VARCHAR(120) NOT NULL,
  openai_api_key TEXT NULL,
  prompt LONGTEXT NOT NULL,
  status ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_chat_agent_user (user_id),
  KEY idx_chat_agent_module (module_id),
  KEY idx_chat_agent_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cnpj_chatinteligente_connections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  module_id INT NOT NULL DEFAULT 188,
  user_id INT NOT NULL,
  session_name VARCHAR(120) NOT NULL,
  whatsapp_number VARCHAR(20) NOT NULL,
  connection_status ENUM('pendente','conectado','desconectado') NOT NULL DEFAULT 'pendente',
  qr_code LONGTEXT NULL,
  integration_token VARCHAR(128) NULL,
  pairing_code VARCHAR(80) NULL,
  connection_error TEXT NULL,
  last_connected_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chat_conn_user (user_id),
  KEY idx_chat_conn_module (module_id),
  KEY idx_chat_conn_status (connection_status),
  UNIQUE KEY uq_chat_conn_token (integration_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Compatível com phpMyAdmin: removido bloco PREPARE/EXECUTE.
-- Se precisar ajustar base antiga, rode manualmente APENAS se a coluna não existir:
-- ALTER TABLE cnpj_chatinteligente_agents
--   ADD COLUMN status ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo' AFTER prompt;
--
-- ALTER TABLE cnpj_chatinteligente_connections
--   ADD COLUMN connection_status ENUM('pendente','conectado','desconectado') NOT NULL DEFAULT 'pendente' AFTER whatsapp_number;
--
-- ALTER TABLE cnpj_chatinteligente_connections
--   ADD COLUMN integration_token VARCHAR(128) NULL AFTER qr_code,
--   ADD COLUMN pairing_code VARCHAR(80) NULL AFTER integration_token,
--   ADD COLUMN connection_error TEXT NULL AFTER pairing_code;
--
-- CREATE UNIQUE INDEX uq_chat_conn_token ON cnpj_chatinteligente_connections (integration_token);
