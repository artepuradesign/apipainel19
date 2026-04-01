<?php
// src/controllers/CnpjProdutosController.php

require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/FileUpload.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../models/CnpjProdutos.php';

class CnpjProdutosController {
    private $db;
    private $model;

    public function __construct($db) {
        $this->db = $db;
        $this->model = new CnpjProdutos($db);
    }

    public function listProdutos() {
        try {
            $userId = (int)(AuthMiddleware::getCurrentUserId() ?? 0);
            if ($userId <= 0) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $isAdmin = $this->isAdminUser($userId);
            $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 50;
            $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

            $search = isset($_GET['search']) ? trim((string)$_GET['search']) : null;
            $status = isset($_GET['status']) ? trim((string)$_GET['status']) : null;
            $cnpj = isset($_GET['cnpj']) ? trim((string)$_GET['cnpj']) : null;

            if ($status && !in_array($status, ['ativo', 'inativo', 'rascunho'], true)) {
                Response::error('Status inválido', 400);
                return;
            }

            $rows = $this->model->listProdutos($userId, $isAdmin, $limit, $offset, $search, $status, $cnpj);
            $rows = array_map([$this, 'normalizeProdutoRow'], $rows);
            $total = $this->model->countProdutos($userId, $isAdmin, $search, $status, $cnpj);
            $sections = $this->model->getSectionNames($userId, $isAdmin);

            Response::success([
                'data' => $rows,
                'pagination' => [
                    'total' => $total,
                    'limit' => $limit,
                    'offset' => $offset,
                ],
                'sections' => $sections,
            ], 'Produtos carregados com sucesso');
        } catch (Exception $e) {
            Response::error('Erro ao listar produtos: ' . $e->getMessage(), 500);
        }
    }

    public function detalhePublico() {
        try {
            $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
            if ($id <= 0) {
                Response::error('id inválido', 400);
                return;
            }

            $produto = $this->model->findPublicById($id);
            if (!$produto) {
                Response::error('Produto não encontrado', 404);
                return;
            }

            Response::success($this->normalizeProdutoRow($produto), 'Produto carregado com sucesso');
        } catch (Exception $e) {
            Response::error('Erro ao carregar produto: ' . $e->getMessage(), 500);
        }
    }

    public function lojaPublica() {
        try {
            $cnpjDigits = preg_replace('/\D+/', '', (string)($_GET['cnpj'] ?? ''));
            if (strlen($cnpjDigits) !== 14) {
                Response::error('CNPJ inválido', 400);
                return;
            }

            $produtos = $this->model->listPublicByCnpj($cnpjDigits, 120);
            $produtos = array_map([$this, 'normalizeProdutoRow'], $produtos);

            $storeMeta = $this->model->findPublicStoreMetaByCnpj($cnpjDigits);
            $storeConfig = $this->extractPublicStoreConfig($storeMeta ?: []);

            $nomeEmpresa = !empty($storeConfig['store_name'])
                ? (string)$storeConfig['store_name']
                : (!empty($produtos[0]['nome_empresa']) ? (string)$produtos[0]['nome_empresa'] : null);

            $logoUrl = !empty($storeConfig['logo_url'])
                ? (string)$storeConfig['logo_url']
                : (!empty($produtos[0]['owner_avatar_url']) ? (string)$produtos[0]['owner_avatar_url'] : null);

            Response::success([
                'empresa' => [
                    'nome_empresa' => $nomeEmpresa,
                    'cnpj' => $this->formatCnpj($cnpjDigits),
                    'avatar_url' => $logoUrl ?: null,
                ],
                'configuracao' => $storeConfig,
                'produtos' => $produtos,
            ], 'Loja pública carregada com sucesso');
        } catch (Exception $e) {
            Response::error('Erro ao carregar loja pública: ' . $e->getMessage(), 500);
        }
    }

    public function obterConfiguracaoLoja() {
        try {
            $userId = (int)(AuthMiddleware::getCurrentUserId() ?? 0);
            if ($userId <= 0) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $storeMeta = $this->model->getStoreConfigByUserId($userId);
            if (!$storeMeta) {
                Response::error('Usuário não encontrado', 404);
                return;
            }

            $cnpjDigits = preg_replace('/\D+/', '', (string)($storeMeta['cnpj'] ?? ''));
            $config = $this->extractPublicStoreConfig($storeMeta);

            Response::success([
                'empresa' => [
                    'nome_empresa' => !empty($storeMeta['nome_empresa']) ? mb_substr(trim((string)$storeMeta['nome_empresa']), 0, 255) : null,
                    'cnpj' => strlen($cnpjDigits) === 14 ? $this->formatCnpj($cnpjDigits) : null,
                    'avatar_url' => !empty($storeMeta['owner_avatar_url']) ? mb_substr(trim((string)$storeMeta['owner_avatar_url']), 0, 2048) : null,
                ],
                'configuracao' => $config,
            ], 'Configuração da loja carregada com sucesso');
        } catch (Exception $e) {
            Response::error('Erro ao obter configuração da loja: ' . $e->getMessage(), 500);
        }
    }

    public function salvarConfiguracaoLoja() {
        try {
            $userId = (int)(AuthMiddleware::getCurrentUserId() ?? 0);
            if ($userId <= 0) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $input = $this->readJsonInput();
            if (!$input) {
                Response::error('Dados inválidos', 400);
                return;
            }

            $validatedConfig = $this->validateStoreConfigInput($input);
            $currentStoreMeta = $this->model->getStoreConfigByUserId($userId) ?: [];
            $currentPreferences = $this->decodeJsonObject($currentStoreMeta['store_preferences'] ?? null);
            $currentStorefront = isset($currentPreferences['storefront']) && is_array($currentPreferences['storefront'])
                ? $currentPreferences['storefront']
                : [];

            $mergedStorefront = array_merge($currentStorefront, $validatedConfig);
            $currentPreferences['storefront'] = $mergedStorefront;

            $socialLinks = [
                'whatsapp' => $mergedStorefront['whatsapp'] ?? null,
                'instagram' => $mergedStorefront['instagram'] ?? null,
            ];

            $saved = $this->model->upsertStoreConfigByUserId($userId, [
                'company' => $mergedStorefront['store_name'] ?? ($currentStoreMeta['nome_empresa'] ?? null),
                'bio' => $mergedStorefront['description'] ?? ($currentStoreMeta['store_bio'] ?? null),
                'website' => $mergedStorefront['website'] ?? ($currentStoreMeta['store_website'] ?? null),
                'social_links' => json_encode($socialLinks, JSON_UNESCAPED_UNICODE),
                'preferences' => json_encode($currentPreferences, JSON_UNESCAPED_UNICODE),
            ]);

            if (!$saved) {
                Response::error('Não foi possível salvar a configuração da loja', 500);
                return;
            }

            $updatedStoreMeta = $this->model->getStoreConfigByUserId($userId) ?: [];
            Response::success([
                'configuracao' => $this->extractPublicStoreConfig($updatedStoreMeta),
            ], 'Configuração da loja salva com sucesso');
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 400);
        } catch (Exception $e) {
            Response::error('Erro ao salvar configuração da loja: ' . $e->getMessage(), 500);
        }
    }

    public function criar() {
        try {
            $userId = (int)(AuthMiddleware::getCurrentUserId() ?? 0);
            if ($userId <= 0) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $input = $this->readJsonInput();
            if (!$input) {
                Response::error('Dados inválidos', 400);
                return;
            }

            $companyData = $this->getUserCompanyData($userId);
            if (empty($companyData['cnpj']) || empty($companyData['nome_empresa'])) {
                Response::error('Preencha CNPJ e nome da empresa em Dados Pessoais para cadastrar produtos', 400);
                return;
            }

            $input['cnpj'] = $companyData['cnpj'];
            $input['nome_empresa'] = $companyData['nome_empresa'];

            $payload = $this->validatePayload($input, false);
            $newId = $this->model->createProduto($payload, $userId);
            $created = $this->model->findByIdForUser($newId, $userId, true);
            $created = $created ? $this->normalizeProdutoRow($created) : null;

            Response::success($created, 'Produto cadastrado com sucesso', 201);
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 400);
        } catch (Exception $e) {
            Response::error('Erro ao cadastrar produto: ' . $e->getMessage(), 500);
        }
    }

    public function atualizar() {
        try {
            $userId = (int)(AuthMiddleware::getCurrentUserId() ?? 0);
            if ($userId <= 0) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $isAdmin = $this->isAdminUser($userId);
            $input = $this->readJsonInput();
            if (!$input || !isset($input['id'])) {
                Response::error('id é obrigatório', 400);
                return;
            }

            $id = (int)$input['id'];
            if ($id <= 0) {
                Response::error('id inválido', 400);
                return;
            }

            $existing = $this->model->findByIdForUser($id, $userId, $isAdmin);
            if (!$existing) {
                Response::error('Produto não encontrado ou sem permissão', 404);
                return;
            }

            $companyData = $this->getUserCompanyData($userId);
            if (!empty($companyData['cnpj']) && !empty($companyData['nome_empresa'])) {
                $input['cnpj'] = $companyData['cnpj'];
                $input['nome_empresa'] = $companyData['nome_empresa'];
            }

            $payload = $this->validatePayload($input, true);
            if (empty($payload)) {
                Response::error('Nenhum campo válido para atualizar', 400);
                return;
            }

            $this->model->updateProduto($id, $payload);
            $updated = $this->model->findByIdForUser($id, $userId, $isAdmin);
            $updated = $updated ? $this->normalizeProdutoRow($updated) : null;

            Response::success($updated, 'Produto atualizado com sucesso');
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 400);
        } catch (Exception $e) {
            Response::error('Erro ao atualizar produto: ' . $e->getMessage(), 500);
        }
    }

    public function excluir() {
        try {
            $userId = (int)(AuthMiddleware::getCurrentUserId() ?? 0);
            if ($userId <= 0) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $isAdmin = $this->isAdminUser($userId);
            $input = $this->readJsonInput();
            if (!$input || !isset($input['id'])) {
                Response::error('id é obrigatório', 400);
                return;
            }

            $id = (int)$input['id'];
            if ($id <= 0) {
                Response::error('id inválido', 400);
                return;
            }

            $existing = $this->model->findByIdForUser($id, $userId, $isAdmin);
            if (!$existing) {
                Response::error('Produto não encontrado ou sem permissão', 404);
                return;
            }

            $this->model->deleteProduto($id);
            Response::success(['id' => $id], 'Produto excluído com sucesso');
        } catch (Exception $e) {
            Response::error('Erro ao excluir produto: ' . $e->getMessage(), 500);
        }
    }

    public function uploadFoto() {
        try {
            $userId = (int)(AuthMiddleware::getCurrentUserId() ?? 0);
            if ($userId <= 0) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $file = null;
            if (isset($_FILES['photo']) && is_array($_FILES['photo'])) {
                $file = $_FILES['photo'];
            } elseif (isset($_FILES['file']) && is_array($_FILES['file'])) {
                $file = $_FILES['file'];
            } elseif (isset($_FILES['foto']) && is_array($_FILES['foto'])) {
                $file = $_FILES['foto'];
            }

            if (!$file) {
                Response::error('Arquivo de foto é obrigatório (campos aceitos: photo, file, foto)', 400);
                return;
            }

            if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                Response::error('Erro ao enviar arquivo', 400);
                return;
            }

            $allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
            if (!in_array((string)($file['type'] ?? ''), $allowedMime, true)) {
                Response::error('Formato inválido. Use JPEG, PNG, GIF ou WebP', 400);
                return;
            }

            $maxSize = 5 * 1024 * 1024;
            if ((int)($file['size'] ?? 0) > $maxSize) {
                Response::error('Arquivo muito grande. Máximo permitido: 5MB', 400);
                return;
            }

            $uploadDir = FileUpload::getUploadDir();

            $companyData = $this->getUserCompanyData($userId);
            $cnpjDigits = preg_replace('/\D+/', '', (string)($companyData['cnpj'] ?? ''));
            if (strlen($cnpjDigits) !== 14) {
                Response::error('CNPJ da empresa é obrigatório para enviar fotos do produto', 400);
                return;
            }

            $extension = strtolower((string)pathinfo((string)($file['name'] ?? ''), PATHINFO_EXTENSION));
            if (!in_array($extension, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)) {
                $extension = 'jpg';
            }

            $fileName = $cnpjDigits . '_produto_' . $userId . '_' . date('YmdHis') . '_' . bin2hex(random_bytes(4)) . '.' . $extension;
            $targetPath = $uploadDir . $fileName;

            if (!move_uploaded_file((string)$file['tmp_name'], $targetPath)) {
                Response::error('Falha ao salvar arquivo no servidor', 500);
                return;
            }

            Response::success([
                'filename' => $fileName,
                'url' => $this->buildUploadFileUrl($fileName),
            ], 'Foto enviada com sucesso');
        } catch (Exception $e) {
            Response::error('Erro ao enviar foto: ' . $e->getMessage(), 500);
        }
    }

    public function consultarCodigoBarras() {
        try {
            $userId = (int)(AuthMiddleware::getCurrentUserId() ?? 0);
            if ($userId <= 0) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $barcodeRaw = isset($_GET['codigo_barras']) ? (string)$_GET['codigo_barras'] : ((string)($_GET['codigo'] ?? ''));
            $barcode = preg_replace('/\D+/', '', $barcodeRaw);

            if (strlen($barcode) < 8 || strlen($barcode) > 32) {
                Response::error('Código de barras inválido', 400);
                return;
            }

            $isAdmin = $this->isAdminUser($userId);
            $lookupLog = [];

            $internalStart = microtime(true);
            $internalMatch = $this->model->findByBarcodeForUser($barcode, $userId, $isAdmin);
            $internalDuration = (int)round((microtime(true) - $internalStart) * 1000);

            if ($internalMatch) {
                $normalizedInternal = $this->normalizeProdutoRow($internalMatch);
                $internalImage = $normalizedInternal['external_featured_image_url'] ?? null;
                if (!$internalImage && !empty($normalizedInternal['fotos']) && is_array($normalizedInternal['fotos'])) {
                    $internalImage = (string)($normalizedInternal['fotos'][0] ?? '');
                }

                $lookupLog[] = $this->buildLookupLogEntry('banco_interno', true, false, 'Produto encontrado no banco interno', null, $internalDuration);
                $lookupLog[] = $this->buildLookupLogEntry('supernovaera', false, false, 'Consulta externa não executada (prioridade para banco interno)', 'https://www.supernovaera.com.br/' . rawurlencode($barcode) . '?_q=' . rawurlencode($barcode) . '&map=ft', 0, true);

                Response::success([
                    'found' => true,
                    'codigo_barras' => $barcode,
                    'nome_produto' => $normalizedInternal['nome_produto'] ?? null,
                    'marca' => $normalizedInternal['marca'] ?? null,
                    'categoria' => $normalizedInternal['categoria'] ?? null,
                    'tags' => $normalizedInternal['tags'] ?? null,
                    'ncm' => null,
                    'external_featured_image_url' => $internalImage,
                    'fotos' => !empty($normalizedInternal['fotos']) && is_array($normalizedInternal['fotos']) ? $normalizedInternal['fotos'] : (!empty($internalImage) ? [$internalImage] : []),
                    'fonte_prioritaria' => 'banco_interno',
                    'fontes' => [
                        'banco_interno' => [
                            'found' => true,
                            'id' => $normalizedInternal['id'] ?? null,
                            'nome_produto' => $normalizedInternal['nome_produto'] ?? null,
                            'marca' => $normalizedInternal['marca'] ?? null,
                            'categoria' => $normalizedInternal['categoria'] ?? null,
                            'tags' => $normalizedInternal['tags'] ?? null,
                            'image_url' => $internalImage,
                        ],
                        'supernovaera' => ['found' => false, 'skipped' => true],
                    ],
                    'consulta_log' => $lookupLog,
                ], 'Produto encontrado no banco interno');
                return;
            }

            $lookupLog[] = $this->buildLookupLogEntry('banco_interno', false, false, 'Nenhum produto encontrado no banco interno', null, $internalDuration);

            $supernovaStart = microtime(true);
            $supernova = $this->fetchSupernovaeraData($barcode);
            $supernovaDuration = (int)round((microtime(true) - $supernovaStart) * 1000);
            $lookupLog[] = $this->buildLookupLogEntry(
                'supernovaera',
                (bool)($supernova['found'] ?? false),
                (bool)($supernova['error'] ?? false),
                ($supernova['found'] ?? false) ? 'Dados localizados no Supernovaera' : (($supernova['error'] ?? false) ? ($supernova['message'] ?? 'Falha na consulta Supernovaera') : 'Sem dados no Supernovaera'),
                'https://www.supernovaera.com.br/' . rawurlencode($barcode) . '?_q=' . rawurlencode($barcode) . '&map=ft',
                $supernovaDuration
            );

            $nomeProduto = $supernova['nome_produto'] ?? null;
            $marca = $supernova['marca'] ?? null;
            $categoria = $supernova['categoria'] ?? null;
            $tags = $supernova['tags'] ?? null;
            $ncm = $supernova['ncm'] ?? null;
            $imageUrl = $supernova['image_url'] ?? null;

            $found =
                !empty($nomeProduto) ||
                !empty($marca) ||
                !empty($categoria) ||
                !empty($tags) ||
                !empty($ncm) ||
                !empty($imageUrl);

            Response::success([
                'found' => $found,
                'codigo_barras' => $barcode,
                'nome_produto' => $nomeProduto,
                'marca' => $marca,
                'categoria' => $categoria,
                'tags' => $tags,
                'ncm' => $ncm,
                'external_featured_image_url' => $imageUrl,
                'fotos' => !empty($imageUrl) ? [$imageUrl] : [],
                'fonte_prioritaria' => ($supernova['found'] ?? false) ? 'supernovaera' : null,
                'fontes' => [
                    'banco_interno' => ['found' => false],
                    'supernovaera' => $supernova,
                ],
                'consulta_log' => $lookupLog,
            ], $found ? 'Dados de produto encontrados em bases externas' : 'Nenhum dado encontrado para este código de barras');
        } catch (Exception $e) {
            Response::error('Erro ao consultar código de barras: ' . $e->getMessage(), 500);
        }
    }

    private function readJsonInput(): ?array {
        $raw = file_get_contents('php://input');
        if (!$raw) {
            return null;
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    private function validatePayload(array $input, bool $partial = false): array {
        $result = [];

        $requiredFields = ['cnpj', 'nome_empresa', 'nome_produto'];
        if (!$partial) {
            foreach ($requiredFields as $field) {
                if (!isset($input[$field]) || trim((string)$input[$field]) === '') {
                    throw new InvalidArgumentException("{$field} é obrigatório");
                }
            }
        }

        if (array_key_exists('cnpj', $input)) {
            $digits = preg_replace('/\D+/', '', (string)$input['cnpj']);
            if (strlen($digits) !== 14) {
                throw new InvalidArgumentException('CNPJ deve conter 14 dígitos');
            }
            $result['cnpj'] = $this->formatCnpj($digits);
        }

        if (array_key_exists('nome_empresa', $input)) {
            $nomeEmpresa = trim((string)$input['nome_empresa']);
            if ($nomeEmpresa === '' || mb_strlen($nomeEmpresa) > 255) {
                throw new InvalidArgumentException('nome_empresa inválido');
            }
            $result['nome_empresa'] = $nomeEmpresa;
        }

        if (array_key_exists('nome_produto', $input)) {
            $nomeProduto = trim((string)$input['nome_produto']);
            if ($nomeProduto === '' || mb_strlen($nomeProduto) > 255) {
                throw new InvalidArgumentException('nome_produto inválido');
            }
            $result['nome_produto'] = $nomeProduto;
        }

        if (array_key_exists('descricao_produto', $input) || array_key_exists('descricao', $input)) {
            $rawDescricao = array_key_exists('descricao_produto', $input) ? $input['descricao_produto'] : $input['descricao'];
            $descricao = trim((string)$rawDescricao);
            $normalizedDescricao = $descricao === '' ? null : mb_substr($descricao, 0, 65535);

            $result['descricao_produto'] = $normalizedDescricao;
            $result['descricao'] = $normalizedDescricao;
        }

        if (array_key_exists('sku', $input)) {
            $sku = trim((string)$input['sku']);
            $result['sku'] = $sku === '' ? null : mb_substr($sku, 0, 120);
        }

        if (array_key_exists('categoria', $input)) {
            $categoria = trim((string)$input['categoria']);
            $result['categoria'] = $categoria === '' ? null : mb_substr($categoria, 0, 120);
        }

        if (array_key_exists('categoria_id', $input)) {
            $categoriaId = (int)$input['categoria_id'];
            $result['categoria_id'] = $categoriaId > 0 ? $categoriaId : null;
        }

        if (array_key_exists('tags', $input)) {
            $tags = trim((string)$input['tags']);
            if ($tags !== '') {
                $tagList = array_values(array_unique(array_filter(array_map(function ($item) {
                    return mb_substr(trim((string)$item), 0, 60);
                }, explode(',', $tags)))));
                $tags = implode(', ', $tagList);
            }
            $result['tags'] = $tags === '' ? null : mb_substr($tags, 0, 500);
        }

        if (array_key_exists('marca', $input)) {
            $marca = trim((string)$input['marca']);
            $result['marca'] = $marca === '' ? null : mb_substr($marca, 0, 120);
        }

        if (array_key_exists('marca_id', $input)) {
            $marcaId = (int)$input['marca_id'];
            $result['marca_id'] = $marcaId > 0 ? $marcaId : null;
        }

        if (array_key_exists('external_featured_image_url', $input)) {
            $externalFeaturedImageUrl = trim((string)$input['external_featured_image_url']);
            if ($externalFeaturedImageUrl !== '' && (!filter_var($externalFeaturedImageUrl, FILTER_VALIDATE_URL) || mb_strlen($externalFeaturedImageUrl) > 2048)) {
                throw new InvalidArgumentException('external_featured_image_url inválida');
            }
            $result['external_featured_image_url'] = $externalFeaturedImageUrl === '' ? null : $externalFeaturedImageUrl;
        }

        $controlarEstoque = null;
        if (array_key_exists('controlar_estoque', $input)) {
            $rawControlar = $input['controlar_estoque'];
            $isTrue = $rawControlar === true || $rawControlar === 1 || $rawControlar === '1' || $rawControlar === 'true';
            $isFalse = $rawControlar === false || $rawControlar === 0 || $rawControlar === '0' || $rawControlar === 'false';

            if (!$isTrue && !$isFalse) {
                throw new InvalidArgumentException('controlar_estoque inválido');
            }

            $controlarEstoque = $isTrue;
            $result['controlar_estoque'] = $controlarEstoque ? 1 : 0;
        } elseif (!$partial) {
            $controlarEstoque = false;
            $result['controlar_estoque'] = 0;
        }

        if (array_key_exists('codigo_barras', $input)) {
            $codigoBarras = preg_replace('/\s+/', '', trim((string)$input['codigo_barras']));
            if ($codigoBarras !== '' && mb_strlen($codigoBarras) > 64) {
                throw new InvalidArgumentException('codigo_barras deve ter no máximo 64 caracteres');
            }
            $result['codigo_barras'] = $codigoBarras === '' ? null : $codigoBarras;
        }

        if (array_key_exists('fotos', $input)) {
            if (!is_array($input['fotos'])) {
                throw new InvalidArgumentException('fotos deve ser uma lista');
            }

            $fotos = array_values(array_filter(array_map(function ($url) {
                $val = trim((string)$url);
                if ($val === '') {
                    return null;
                }

                $filename = $this->extractPhotoFilename($val);
                if ($filename === '') {
                    return null;
                }

                return mb_substr($filename, 0, 255);
            }, $input['fotos'])));

            if (count($fotos) > 5) {
                throw new InvalidArgumentException('Máximo de 5 fotos por produto');
            }

            $result['fotos_json'] = empty($fotos) ? null : json_encode($fotos, JSON_UNESCAPED_UNICODE);
        }

        if (array_key_exists('preco', $input)) {
            $preco = (float)$input['preco'];
            if ($preco < 0) {
                throw new InvalidArgumentException('preco não pode ser negativo');
            }
            $result['preco'] = round($preco, 2);
        } elseif (!$partial) {
            $result['preco'] = 0;
        }

        if (array_key_exists('estoque', $input)) {
            $estoque = (int)$input['estoque'];
            if ($estoque < 0) {
                throw new InvalidArgumentException('estoque não pode ser negativo');
            }
            $result['estoque'] = $estoque;
        } elseif (!$partial) {
            $result['estoque'] = 0;
        }

        if ($controlarEstoque === false) {
            $result['estoque'] = 0;
        }

        if (array_key_exists('status', $input)) {
            $status = trim((string)$input['status']);
            if (!in_array($status, ['ativo', 'inativo', 'rascunho'], true)) {
                throw new InvalidArgumentException('status inválido');
            }
            $result['status'] = $status;
        } elseif (!$partial) {
            $result['status'] = 'ativo';
        }

        if (array_key_exists('module_id', $input)) {
            $result['module_id'] = (int)$input['module_id'] > 0 ? (int)$input['module_id'] : 183;
        } elseif (!$partial) {
            $result['module_id'] = 183;
        }

        return $result;
    }

    private function validateStoreConfigInput(array $input): array {
        $storeName = mb_substr(trim((string)($input['store_name'] ?? '')), 0, 120);
        if ($storeName === '' || mb_strlen($storeName) < 2) {
            throw new InvalidArgumentException('Informe o nome da loja com pelo menos 2 caracteres');
        }

        $description = mb_substr(trim((string)($input['description'] ?? '')), 0, 500);
        $website = trim((string)($input['website'] ?? ''));
        $logoUrl = trim((string)($input['logo_url'] ?? ''));

        if ($website !== '' && (!filter_var($website, FILTER_VALIDATE_URL) || mb_strlen($website) > 2048)) {
            throw new InvalidArgumentException('Website inválido');
        }

        if ($logoUrl !== '' && (!filter_var($logoUrl, FILTER_VALIDATE_URL) || mb_strlen($logoUrl) > 2048)) {
            throw new InvalidArgumentException('URL de logo inválida');
        }

        $whatsappDigits = preg_replace('/\D+/', '', (string)($input['whatsapp'] ?? ''));
        if ($whatsappDigits !== '' && (strlen($whatsappDigits) < 10 || strlen($whatsappDigits) > 13)) {
            throw new InvalidArgumentException('WhatsApp inválido. Use DDD + número com 10 a 13 dígitos');
        }

        $instagramRaw = trim((string)($input['instagram'] ?? ''));
        $instagram = preg_replace('/[^a-zA-Z0-9._]/', '', str_replace('@', '', $instagramRaw));
        $instagram = mb_substr((string)$instagram, 0, 60);

        $pixEnabled = $this->toBooleanOrNull($input['pix_enabled'] ?? true);
        if ($pixEnabled === null) {
            throw new InvalidArgumentException('Valor inválido para pix_enabled');
        }

        $pixKeyType = trim((string)($input['pix_key_type'] ?? ''));
        $pixKey = trim((string)($input['pix_key'] ?? ''));

        if ($pixEnabled) {
            if (!in_array($pixKeyType, ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'], true)) {
                throw new InvalidArgumentException('Selecione um tipo de chave PIX válido');
            }

            if (!$this->isPixKeyValidByType($pixKeyType, $pixKey)) {
                throw new InvalidArgumentException('Chave PIX inválida para o tipo selecionado');
            }
        } else {
            $pixKeyType = '';
            $pixKey = '';
        }

        $pixInstructions = mb_substr(trim((string)($input['pix_instructions'] ?? '')), 0, 240);

        return [
            'store_name' => $storeName,
            'description' => $description !== '' ? $description : null,
            'website' => $website !== '' ? $website : null,
            'logo_url' => $logoUrl !== '' ? $logoUrl : null,
            'whatsapp' => $whatsappDigits !== '' ? $whatsappDigits : null,
            'instagram' => $instagram !== '' ? $instagram : null,
            'pix_enabled' => $pixEnabled,
            'pix_key_type' => $pixKeyType !== '' ? $pixKeyType : null,
            'pix_key' => $pixKey !== '' ? $pixKey : null,
            'pix_instructions' => $pixInstructions !== '' ? $pixInstructions : null,
        ];
    }

    private function isAdminUser(int $userId): bool {
        $stmt = $this->db->prepare('SELECT user_role FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $role = $row['user_role'] ?? '';

        return $role === 'admin';
    }

    private function formatCnpj(string $digits): string {
        return substr($digits, 0, 2) . '.' .
            substr($digits, 2, 3) . '.' .
            substr($digits, 5, 3) . '/' .
            substr($digits, 8, 4) . '-' .
            substr($digits, 12, 2);
    }

    private function normalizeProdutoRow(array $row): array {
        $row['codigo_barras'] = !empty($row['codigo_barras']) ? (string)$row['codigo_barras'] : null;
        $row['categoria'] = !empty($row['categoria']) ? (string)$row['categoria'] : null;
        $row['tags'] = !empty($row['tags']) ? (string)$row['tags'] : null;
        $row['marca'] = !empty($row['marca']) ? (string)$row['marca'] : null;
        $row['owner_name'] = !empty($row['owner_name']) ? mb_substr(trim((string)$row['owner_name']), 0, 255) : null;
        $row['owner_avatar_url'] = !empty($row['owner_avatar_url']) ? mb_substr(trim((string)$row['owner_avatar_url']), 0, 2048) : null;
        $ownerCnpjDigits = preg_replace('/\D+/', '', (string)($row['owner_cnpj'] ?? ''));
        $row['owner_cnpj'] = strlen($ownerCnpjDigits) === 14 ? $this->formatCnpj($ownerCnpjDigits) : null;

        if (!empty($row['owner_name'])) {
            $row['nome_empresa'] = $row['owner_name'];
        }

        if (!empty($row['owner_cnpj'])) {
            $row['cnpj'] = $row['owner_cnpj'];
        }

        $descricaoProduto = null;
        if (array_key_exists('descricao_produto', $row) && trim((string)$row['descricao_produto']) !== '') {
            $descricaoProduto = mb_substr(trim((string)$row['descricao_produto']), 0, 65535);
        } elseif (array_key_exists('descricao', $row) && trim((string)$row['descricao']) !== '') {
            $descricaoProduto = mb_substr(trim((string)$row['descricao']), 0, 65535);
        }

        $row['descricao_produto'] = $descricaoProduto;
        $row['descricao'] = $descricaoProduto;

        $row['external_featured_image_url'] = !empty($row['external_featured_image_url']) ? (string)$row['external_featured_image_url'] : null;
        $row['controlar_estoque'] = ((int)($row['controlar_estoque'] ?? 0)) === 1;

        $fotos = [];
        if (!empty($row['fotos_json'])) {
            $decoded = json_decode((string)$row['fotos_json'], true);
            if (is_array($decoded)) {
                foreach ($decoded as $item) {
                    if (!is_string($item) || trim($item) === '') {
                        continue;
                    }

                    $filename = $this->extractPhotoFilename($item);
                    if ($filename === '') {
                        continue;
                    }

                    $fotos[] = $this->buildUploadFileUrl($filename);
                }

                $fotos = array_values(array_unique($fotos));
            }
        }

        $row['fotos'] = $fotos;
        return $row;
    }

    private function getUserCompanyData(int $userId): array {
        $stmt = $this->db->prepare('SELECT cnpj, full_name FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $digits = preg_replace('/\D+/', '', (string)($row['cnpj'] ?? ''));
        if (strlen($digits) !== 14) {
            return ['cnpj' => null, 'nome_empresa' => null];
        }

        $nomeEmpresa = trim((string)($row['full_name'] ?? ''));
        return [
            'cnpj' => $this->formatCnpj($digits),
            'nome_empresa' => $nomeEmpresa !== '' ? mb_substr($nomeEmpresa, 0, 255) : null,
        ];
    }

    private function extractPublicStoreConfig(array $storeMeta): array {
        $preferences = $this->decodeJsonObject($storeMeta['store_preferences'] ?? null);
        $storefront = isset($preferences['storefront']) && is_array($preferences['storefront'])
            ? $preferences['storefront']
            : [];
        $socialLinks = $this->decodeJsonObject($storeMeta['store_social_links'] ?? null);

        $pixEnabled = isset($storefront['pix_enabled'])
            ? (bool)$storefront['pix_enabled']
            : false;

        return [
            'store_name' => $this->limitNullableText($storefront['store_name'] ?? ($storeMeta['nome_empresa'] ?? null), 120),
            'description' => $this->limitNullableText($storefront['description'] ?? ($storeMeta['store_bio'] ?? null), 500),
            'website' => $this->normalizeNullableUrl($storefront['website'] ?? ($storeMeta['store_website'] ?? null)),
            'logo_url' => $this->normalizeNullableUrl($storefront['logo_url'] ?? ($storeMeta['owner_avatar_url'] ?? null)),
            'whatsapp' => $this->digitsOrNull($storefront['whatsapp'] ?? ($socialLinks['whatsapp'] ?? null), 13),
            'instagram' => $this->limitNullableText($storefront['instagram'] ?? ($socialLinks['instagram'] ?? null), 60),
            'pix_enabled' => $pixEnabled,
            'pix_key_type' => $pixEnabled ? $this->limitNullableText($storefront['pix_key_type'] ?? null, 20) : null,
            'pix_key' => $pixEnabled ? $this->limitNullableText($storefront['pix_key'] ?? null, 255) : null,
            'pix_instructions' => $this->limitNullableText($storefront['pix_instructions'] ?? null, 240),
        ];
    }

    private function decodeJsonObject($value): array {
        if (is_array($value)) {
            return $value;
        }

        if (!is_string($value) || trim($value) === '') {
            return [];
        }

        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function limitNullableText($value, int $max): ?string {
        $text = trim((string)($value ?? ''));
        if ($text === '') {
            return null;
        }

        return mb_substr($text, 0, $max);
    }

    private function normalizeNullableUrl($value): ?string {
        $text = trim((string)($value ?? ''));
        if ($text === '') {
            return null;
        }

        if (!filter_var($text, FILTER_VALIDATE_URL)) {
            return null;
        }

        return mb_substr($text, 0, 2048);
    }

    private function digitsOrNull($value, int $maxLength = 32): ?string {
        $digits = preg_replace('/\D+/', '', (string)($value ?? ''));
        if ($digits === '') {
            return null;
        }

        return mb_substr($digits, 0, $maxLength);
    }

    private function toBooleanOrNull($value): ?bool {
        if (is_bool($value)) {
            return $value;
        }

        if ($value === 1 || $value === '1' || $value === 'true') {
            return true;
        }

        if ($value === 0 || $value === '0' || $value === 'false') {
            return false;
        }

        return null;
    }

    private function isPixKeyValidByType(string $type, string $key): bool {
        $trimmed = trim($key);
        if ($trimmed === '') {
            return false;
        }

        switch ($type) {
            case 'cpf':
                return strlen(preg_replace('/\D+/', '', $trimmed)) === 11;
            case 'cnpj':
                return strlen(preg_replace('/\D+/', '', $trimmed)) === 14;
            case 'email':
                return (bool)filter_var($trimmed, FILTER_VALIDATE_EMAIL);
            case 'telefone':
                $digits = preg_replace('/\D+/', '', $trimmed);
                return strlen($digits) >= 10 && strlen($digits) <= 13;
            case 'aleatoria':
                return (bool)preg_match('/^[a-zA-Z0-9-]{20,80}$/', $trimmed);
            default:
                return false;
        }
    }

    private function buildUploadFileUrl(string $filename): string {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'api.apipainel.com.br';
        return $scheme . '://' . $host . '/produtos/' . rawurlencode($this->extractPhotoFilename($filename));
    }

    private function extractPhotoFilename(string $value): string {
        $trimmed = trim($value, " \t\n\r\0\x0B\"");
        if ($trimmed === '') {
            return '';
        }

        $decoded = rawurldecode($trimmed);

        if (preg_match('/(^|[?&])file=([^&]+)/i', $decoded, $matches)) {
            $decoded = rawurldecode((string)$matches[2]);
        }

        if (preg_match('#^https?://#i', $decoded)) {
            $path = parse_url($decoded, PHP_URL_PATH);
            if (is_string($path) && $path !== '') {
                $decoded = basename($path);
            }
        }

        if (strpos($decoded, '/') !== false || strpos($decoded, '\\') !== false) {
            $decoded = basename(str_replace('\\', '/', $decoded));
        }

        if (preg_match('/([a-zA-Z0-9._-]+\.(?:jpg|jpeg|png|gif|webp))/i', $decoded, $extMatch)) {
            return strtolower((string)$extMatch[1]) === strtolower($decoded) ? (string)$extMatch[1] : (string)$extMatch[1];
        }

        return preg_replace('/[^a-zA-Z0-9._-]/', '', $decoded) ?: '';
    }

    private function fetchOpenFoodFactsData(string $barcode): array {
        $url = 'https://world.openfoodfacts.org/api/v0/product/' . rawurlencode($barcode) . '.json';
        $json = $this->requestJson($url);

        if (!is_array($json) || !isset($json['product']) || !is_array($json['product'])) {
            return ['found' => false];
        }

        $product = $json['product'];

        $nomeProduto = $this->normalizeLookupText(
            (string)($product['product_name_pt'] ?? $product['product_name'] ?? $product['abbreviated_product_name'] ?? '')
        );
        $marca = $this->normalizeLookupText((string)($product['brands'] ?? ''));
        $categoria = $this->normalizeLookupText((string)($product['categories_pt'] ?? $product['categories'] ?? ''));
        $tags = $this->normalizeLookupText((string)($product['labels'] ?? $product['ingredients_text'] ?? ''));
        $ncm = $this->normalizeLookupText((string)($product['ncm'] ?? ''));
        $imageUrl = $this->normalizeLookupText(
            (string)($product['image_front_url'] ?? $product['image_url'] ?? $product['image_front_small_url'] ?? '')
        );

        return [
            'found' => ($nomeProduto !== null || $marca !== null || $categoria !== null || $tags !== null || $ncm !== null || $imageUrl !== null),
            'nome_produto' => $nomeProduto,
            'marca' => $marca,
            'categoria' => $categoria,
            'tags' => $tags,
            'ncm' => $ncm,
            'image_url' => $imageUrl,
        ];
    }

    private function fetchCosmosData(string $barcode): array {
        $url = 'https://cosmos.bluesoft.com.br/produtos/' . rawurlencode($barcode);
        $html = $this->requestText($url);

        if (!is_string($html) || trim($html) === '') {
            return ['found' => false];
        }

        $nomeProduto = null;
        if (preg_match('/<meta\s+property=["\']og:title["\']\s+content=["\']([^"\']+)["\']/i', $html, $matchTitle)) {
            $nomeProduto = $this->normalizeLookupText($matchTitle[1]);
        }
        if ($nomeProduto === null && preg_match('/<h1[^>]*>(.*?)<\/h1>/is', $html, $matchH1)) {
            $nomeProduto = $this->normalizeLookupText(strip_tags($matchH1[1]));
        }

        $imageUrl = null;
        if (preg_match('/<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']/i', $html, $matchImage)) {
            $imageUrl = $this->normalizeLookupText($matchImage[1]);
        }

        $ncm = null;
        $plainText = preg_replace('/\s+/u', ' ', strip_tags($html));
        if (is_string($plainText) && preg_match('/NCM\s*:\s*([0-9]{4}\.?[0-9]{2}\.?[0-9]{2})/iu', $plainText, $matchNcm)) {
            $ncm = $this->normalizeLookupText($matchNcm[1]);
        }

        return [
            'found' => ($nomeProduto !== null || $ncm !== null || $imageUrl !== null),
            'nome_produto' => $nomeProduto,
            'ncm' => $ncm,
            'image_url' => $imageUrl,
        ];
    }

    private function fetchSupernovaeraData(string $barcode): array {
        $url = 'https://www.supernovaera.com.br/' . rawurlencode($barcode) . '?_q=' . rawurlencode($barcode) . '&map=ft';
        $html = $this->requestText($url);

        if (!is_string($html) || trim($html) === '') {
            return ['found' => false];
        }

        $nomeProduto = null;
        if (preg_match('/<meta\s+property=["\']og:title["\']\s+content=["\']([^"\']+)["\']/i', $html, $matchOgTitle)) {
            $nomeProduto = $this->normalizeLookupText($matchOgTitle[1]);
        }
        if ($nomeProduto === null && preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $matchTitle)) {
            $nomeProduto = $this->normalizeLookupText(strip_tags($matchTitle[1]));
        }
        if ($nomeProduto === null && preg_match('/<h1[^>]*>(.*?)<\/h1>/is', $html, $matchH1)) {
            $nomeProduto = $this->normalizeLookupText(strip_tags($matchH1[1]));
        }
        if ($nomeProduto === null && preg_match('/vtex-product-summary-2-x-productBrand[^>]*>(.*?)<\/span>/is', $html, $matchBrandName)) {
            $nomeProduto = $this->normalizeLookupText(strip_tags($matchBrandName[1]));
        }
        if ($nomeProduto === null && preg_match('/aria-label=["\']Produto\s+([^"\']+)["\']/iu', $html, $matchAria)) {
            $nomeProduto = $this->normalizeLookupText($matchAria[1]);
        }

        $imageUrl = null;
        if (preg_match('/<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']/i', $html, $matchImage)) {
            $imageUrl = $this->normalizeLookupText($matchImage[1]);
        }
        if ($imageUrl === null && preg_match('/vtex-product-summary-2-x-imageNormal[^>]*src=["\']([^"\']+)["\']/i', $html, $matchCardImage)) {
            $imageUrl = $this->normalizeLookupText($matchCardImage[1]);
        }

        $ncm = null;
        $plainText = preg_replace('/\s+/u', ' ', strip_tags($html));
        if (is_string($plainText) && preg_match('/NCM\s*:?\s*([0-9]{4}\.?[0-9]{2}\.?[0-9]{2})/iu', $plainText, $matchNcm)) {
            $ncm = $this->normalizeLookupText($matchNcm[1]);
        }

        $marca = null;
        if ($nomeProduto !== null) {
            if (preg_match('/\b([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9\-]{2,})\s+\d+(?:[\.,]\d+)?\s*(?:G|KG|ML|L|UN)\b/u', mb_strtoupper($nomeProduto, 'UTF-8'), $matchMarca)) {
                $marca = $this->normalizeLookupText($matchMarca[1]);
            }
        }

        return [
            'found' => ($nomeProduto !== null || $ncm !== null || $imageUrl !== null || $marca !== null),
            'nome_produto' => $nomeProduto,
            'marca' => $marca,
            'categoria' => null,
            'tags' => null,
            'ncm' => $ncm,
            'image_url' => $imageUrl,
        ];
    }

    private function buildLookupLogEntry(string $source, bool $found, bool $hasError, string $message, ?string $url = null, int $durationMs = 0, bool $skipped = false): array {
        $status = $skipped ? 'skipped' : ($hasError ? 'error' : ($found ? 'success' : 'not_found'));

        return [
            'fonte' => $source,
            'status' => $status,
            'found' => $found,
            'mensagem' => $message,
            'url' => $url,
            'tempo_ms' => $durationMs,
        ];
    }

    private function requestJson(string $url): ?array {
        $raw = $this->requestText($url);
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    private function requestText(string $url): ?string {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 8,
                'ignore_errors' => true,
                'header' => "Accept: application/json, text/html;q=0.9, */*;q=0.8\r\n" .
                    "User-Agent: API-Painel-CNPJ-Produtos/1.0\r\n",
            ],
        ]);

        $result = @file_get_contents($url, false, $context);
        return is_string($result) ? $result : null;
    }

    private function normalizeLookupText(string $value): ?string {
        $normalized = html_entity_decode(trim($value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $normalized = preg_replace('/\s+/u', ' ', $normalized ?? '');
        if (!is_string($normalized)) {
            return null;
        }

        $normalized = trim($normalized);
        return $normalized !== '' ? mb_substr($normalized, 0, 500) : null;
    }
}
