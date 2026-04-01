-- cnpj_produtos.sql
-- Banco: MySQL
-- Módulo: CNPJ Produtos (ID 183)
-- Objetivo: schema completo para /dashboard/cnpj-produtos

-- =========================================================
-- 1) Tabelas auxiliares: Categorias, Marcas e Tags
-- =========================================================

CREATE TABLE IF NOT EXISTS cnpj_product_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  module_id INT NOT NULL DEFAULT 183,
  user_id INT NULL,
  parent_id BIGINT UNSIGNED NULL,
  nome VARCHAR(120) NOT NULL,
  slug VARCHAR(150) NULL,
  descricao TEXT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_prodcat_module (module_id),
  INDEX idx_prodcat_user (user_id),
  INDEX idx_prodcat_parent (parent_id),
  INDEX idx_prodcat_nome (nome),
  CONSTRAINT fk_prodcat_parent FOREIGN KEY (parent_id) REFERENCES cnpj_product_categories (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cnpj_product_brands (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  module_id INT NOT NULL DEFAULT 183,
  user_id INT NULL,
  parent_id BIGINT UNSIGNED NULL,
  nome VARCHAR(120) NOT NULL,
  slug VARCHAR(150) NULL,
  descricao TEXT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_prodbrand_module (module_id),
  INDEX idx_prodbrand_user (user_id),
  INDEX idx_prodbrand_parent (parent_id),
  INDEX idx_prodbrand_nome (nome),
  CONSTRAINT fk_prodbrand_parent FOREIGN KEY (parent_id) REFERENCES cnpj_product_brands (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cnpj_product_tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  module_id INT NOT NULL DEFAULT 183,
  user_id INT NULL,
  nome VARCHAR(80) NOT NULL,
  slug VARCHAR(120) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_prodtag_module (module_id),
  INDEX idx_prodtag_user (user_id),
  INDEX idx_prodtag_nome (nome),
  UNIQUE KEY uq_prodtag_module_user_nome (module_id, user_id, nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 2) Tabela principal de produtos
-- =========================================================

CREATE TABLE IF NOT EXISTS cnpj_produtos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  module_id INT NOT NULL DEFAULT 183,
  user_id INT NOT NULL,

  cnpj VARCHAR(18) NOT NULL,
  nome_empresa VARCHAR(255) NOT NULL,
  nome_produto VARCHAR(255) NOT NULL,
  sku VARCHAR(120) NULL,

  categoria VARCHAR(120) NULL,
  categoria_id BIGINT UNSIGNED NULL,
  tags VARCHAR(500) NULL,
  marca VARCHAR(120) NULL,
  marca_id BIGINT UNSIGNED NULL,
  external_featured_image_url VARCHAR(2048) NULL,

  codigo_barras VARCHAR(64) NULL,
  controlar_estoque TINYINT(1) NOT NULL DEFAULT 0,
  fotos_json JSON NULL,

  preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  estoque INT NOT NULL DEFAULT 0,
  status ENUM('ativo', 'inativo', 'rascunho') NOT NULL DEFAULT 'ativo',
  ativo TINYINT(1) NOT NULL DEFAULT 1,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_cnpj_produtos_user (user_id),
  INDEX idx_cnpj_produtos_module (module_id),
  INDEX idx_cnpj_produtos_cnpj (cnpj),
  INDEX idx_cnpj_produtos_categoria (categoria),
  INDEX idx_cnpj_produtos_categoria_id (categoria_id),
  INDEX idx_cnpj_produtos_marca (marca),
  INDEX idx_cnpj_produtos_marca_id (marca_id),
  INDEX idx_cnpj_produtos_codigo_barras (codigo_barras),
  INDEX idx_cnpj_produtos_status (status),
  INDEX idx_cnpj_produtos_ativo (ativo),
  CONSTRAINT fk_cnpj_produtos_categoria FOREIGN KEY (categoria_id) REFERENCES cnpj_product_categories (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_cnpj_produtos_marca FOREIGN KEY (marca_id) REFERENCES cnpj_product_brands (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relação n:n para tags (opcional, além do campo tags em texto)
CREATE TABLE IF NOT EXISTS cnpj_produto_tags (
  produto_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (produto_id, tag_id),
  INDEX idx_produto_tags_tag (tag_id),
  CONSTRAINT fk_produto_tags_produto FOREIGN KEY (produto_id) REFERENCES cnpj_produtos (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_produto_tags_tag FOREIGN KEY (tag_id) REFERENCES cnpj_product_tags (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 3) Patch para bases já existentes (executar uma vez)
-- =========================================================

SET @db_name := DATABASE();

SELECT COUNT(*) INTO @col_categoria_id
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'cnpj_produtos' AND COLUMN_NAME = 'categoria_id';
SET @sql := IF(@col_categoria_id = 0,
  'ALTER TABLE cnpj_produtos ADD COLUMN categoria_id BIGINT UNSIGNED NULL AFTER categoria',
  'SELECT "Coluna categoria_id já existe"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @col_tags
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'cnpj_produtos' AND COLUMN_NAME = 'tags';
SET @sql := IF(@col_tags = 0,
  'ALTER TABLE cnpj_produtos ADD COLUMN tags VARCHAR(500) NULL AFTER categoria_id',
  'SELECT "Coluna tags já existe"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @col_marca
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'cnpj_produtos' AND COLUMN_NAME = 'marca';
SET @sql := IF(@col_marca = 0,
  'ALTER TABLE cnpj_produtos ADD COLUMN marca VARCHAR(120) NULL AFTER tags',
  'SELECT "Coluna marca já existe"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @col_marca_id
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'cnpj_produtos' AND COLUMN_NAME = 'marca_id';
SET @sql := IF(@col_marca_id = 0,
  'ALTER TABLE cnpj_produtos ADD COLUMN marca_id BIGINT UNSIGNED NULL AFTER marca',
  'SELECT "Coluna marca_id já existe"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @col_external_img
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'cnpj_produtos' AND COLUMN_NAME = 'external_featured_image_url';
SET @sql := IF(@col_external_img = 0,
  'ALTER TABLE cnpj_produtos ADD COLUMN external_featured_image_url VARCHAR(2048) NULL AFTER marca_id',
  'SELECT "Coluna external_featured_image_url já existe"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @idx_categoria_id
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'cnpj_produtos' AND INDEX_NAME = 'idx_cnpj_produtos_categoria_id';
SET @sql := IF(@idx_categoria_id = 0,
  'CREATE INDEX idx_cnpj_produtos_categoria_id ON cnpj_produtos (categoria_id)',
  'SELECT "Índice idx_cnpj_produtos_categoria_id já existe"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @idx_marca_id
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'cnpj_produtos' AND INDEX_NAME = 'idx_cnpj_produtos_marca_id';
SET @sql := IF(@idx_marca_id = 0,
  'CREATE INDEX idx_cnpj_produtos_marca_id ON cnpj_produtos (marca_id)',
  'SELECT "Índice idx_cnpj_produtos_marca_id já existe"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =========================================================
-- 4) Seed opcional para uso imediato no painel
-- =========================================================

INSERT INTO cnpj_product_categories (module_id, user_id, nome, slug)
SELECT 183, NULL, seed.nome, seed.slug
FROM (
  SELECT 'Sem categoria' AS nome, 'sem-categoria' AS slug
  UNION ALL SELECT 'Alimentos e Bebidas', 'alimentos-e-bebidas'
  UNION ALL SELECT 'Alimentos Naturais', 'alimentos-naturais'
  UNION ALL SELECT 'Artigos para Festas', 'artigos-para-festas'
  UNION ALL SELECT 'Artesanato', 'artesanato'
  UNION ALL SELECT 'Automotivo', 'automotivo'
  UNION ALL SELECT 'Bebidas', 'bebidas'
  UNION ALL SELECT 'Beleza e Cosméticos', 'beleza-e-cosmeticos'
  UNION ALL SELECT 'Brinquedos', 'brinquedos'
  UNION ALL SELECT 'Calçados', 'calcados'
  UNION ALL SELECT 'Casa e Decoração', 'casa-e-decoracao'
  UNION ALL SELECT 'Celulares e Acessórios', 'celulares-e-acessorios'
  UNION ALL SELECT 'Climatização', 'climatizacao'
  UNION ALL SELECT 'Construção', 'construcao'
  UNION ALL SELECT 'Cozinha e Utilidades', 'cozinha-e-utilidades'
  UNION ALL SELECT 'Eletrodomésticos', 'eletrodomesticos'
  UNION ALL SELECT 'Eletrônicos', 'eletronicos'
  UNION ALL SELECT 'Embalagens', 'embalagens'
  UNION ALL SELECT 'Escritório', 'escritorio'
  UNION ALL SELECT 'Esportes', 'esportes'
  UNION ALL SELECT 'Ferramentas', 'ferramentas'
  UNION ALL SELECT 'Floricultura', 'floricultura'
  UNION ALL SELECT 'Games', 'games'
  UNION ALL SELECT 'Higiene e Limpeza', 'higiene-e-limpeza'
  UNION ALL SELECT 'Informática', 'informatica'
  UNION ALL SELECT 'Instrumentos Musicais', 'instrumentos-musicais'
  UNION ALL SELECT 'Joias e Acessórios', 'joias-e-acessorios'
  UNION ALL SELECT 'Livros e Papelaria', 'livros-e-papelaria'
  UNION ALL SELECT 'Malas e Mochilas', 'malas-e-mochilas'
  UNION ALL SELECT 'Materiais Elétricos', 'materiais-eletricos'
  UNION ALL SELECT 'Materiais Hidráulicos', 'materiais-hidraulicos'
  UNION ALL SELECT 'Móveis', 'moveis'
  UNION ALL SELECT 'Moda Feminina', 'moda-feminina'
  UNION ALL SELECT 'Moda Infantil', 'moda-infantil'
  UNION ALL SELECT 'Moda Masculina', 'moda-masculina'
  UNION ALL SELECT 'Ótica', 'otica'
  UNION ALL SELECT 'Papelaria', 'papelaria'
  UNION ALL SELECT 'Perfumaria', 'perfumaria'
  UNION ALL SELECT 'Pet Shop', 'pet-shop'
  UNION ALL SELECT 'Produtos Digitais', 'produtos-digitais'
  UNION ALL SELECT 'Saúde', 'saude'
  UNION ALL SELECT 'Saúde e Bem-estar', 'saude-e-bem-estar'
  UNION ALL SELECT 'Segurança', 'seguranca'
  UNION ALL SELECT 'Serviços', 'servicos'
  UNION ALL SELECT 'Suplementos', 'suplementos'
  UNION ALL SELECT 'Telefonia', 'telefonia'
  UNION ALL SELECT 'Turismo', 'turismo'
  UNION ALL SELECT 'Vestuário', 'vestuario'
) AS seed
LEFT JOIN cnpj_product_categories existing
  ON existing.module_id = 183
  AND existing.user_id IS NULL
  AND existing.nome = seed.nome
WHERE existing.id IS NULL;

INSERT INTO cnpj_product_brands (module_id, user_id, nome, slug)
SELECT 183, NULL, 'Sem marca', 'sem-marca'
WHERE NOT EXISTS (
  SELECT 1 FROM cnpj_product_brands WHERE module_id = 183 AND user_id IS NULL AND nome = 'Sem marca'
);

-- Conferência rápida
SELECT id, nome_produto, categoria, marca, tags, external_featured_image_url, status
FROM cnpj_produtos
WHERE ativo = 1
ORDER BY id DESC;