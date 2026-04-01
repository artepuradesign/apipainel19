<?php
/**
 * Utility para salvar arquivos base64 em disco
 *
 * Duas pastas:
 *   - produtos/       → fotos dos produtos enviados pelos usuários
 *   - upload/         → PDFs de entrega enviados pelo admin
 */
class FileUpload {

    // ── Diretório para fotos dos produtos ───────────────────────────────
    private static $uploadDir;

    public static function getUploadDir() {
        if (!self::$uploadDir) {
            self::$uploadDir = realpath(__DIR__ . '/../../') . '/produtos/';
        }
        if (!is_dir(self::$uploadDir)) {
            mkdir(self::$uploadDir, 0755, true);
        }
        return self::$uploadDir;
    }

    public static function getLegacyUploadDir() {
        return realpath(__DIR__ . '/../../') . '/arquivosupload/';
    }

    // ── Diretório para PDFs de entrega do admin ─────────────────────────
    private static $deliveryDir;

    public static function getDeliveryDir() {
        if (!self::$deliveryDir) {
            self::$deliveryDir = realpath(__DIR__ . '/../../') . '/upload/';
        }
        if (!is_dir(self::$deliveryDir)) {
            mkdir(self::$deliveryDir, 0755, true);
        }
        return self::$deliveryDir;
    }

    // ── Helpers genéricos ───────────────────────────────────────────────

    /**
     * Salva um arquivo base64 em disco
     * @param string $base64Data  dados base64 (pode incluir header data:...)
     * @param string $originalName nome original do arquivo
     * @param string $prefix      prefixo para o nome (ex: "ped_42_anexo1")
     * @param string $dir         diretório destino (caminho absoluto, com / no final)
     * @param string|null $fixedBaseName nome fixo (sem extensão). Quando informado, não usa timestamp.
     * @return string|null        nome do arquivo salvo ou null em caso de erro
     */
    public static function saveBase64ToDir($base64Data, $originalName, $prefix, $dir, $fixedBaseName = null) {
        if (empty($base64Data)) return null;

        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        // Remover header data:xxx;base64,
        $data = $base64Data;
        if (strpos($data, ',') !== false) {
            $data = explode(',', $data, 2)[1];
        }

        $decoded = base64_decode($data, true);
        if ($decoded === false) return null;

        $ext = strtolower(pathinfo((string)$originalName, PATHINFO_EXTENSION));
        if (!$ext || !preg_match('/^[a-z0-9]+$/', $ext)) {
            $ext = self::detectExtensionFromBase64($base64Data);
        }

        $allowedExt = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'jfif', 'webp'];
        if (!$ext || !in_array($ext, $allowedExt, true)) {
            $detected = self::detectExtensionFromBase64($base64Data);
            $ext = ($detected && in_array($detected, $allowedExt, true)) ? $detected : 'pdf';
        }

        if (!empty($fixedBaseName)) {
            $safeBaseName = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)$fixedBaseName);
            if (empty($safeBaseName)) {
                $safeBaseName = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)$prefix) ?: 'arquivo';
            }

            foreach (glob($dir . $safeBaseName . '.*') as $oldFile) {
                @unlink($oldFile);
            }

            $standardName = "{$safeBaseName}.{$ext}";
        } else {
            $timestamp = date('Ymd_His');
            $standardName = "{$prefix}_{$timestamp}.{$ext}";
        }

        $filePath = $dir . $standardName;

        $result = file_put_contents($filePath, $decoded);
        if ($result === false) return null;

        return $standardName;
    }

    private static function detectExtensionFromBase64($base64Data) {
        if (!is_string($base64Data) || strpos($base64Data, 'data:') !== 0) {
            return null;
        }

        $header = explode(',', $base64Data, 2)[0] ?? '';
        $mime = '';
        if (preg_match('#^data:([^;]+);base64$#i', $header, $matches)) {
            $mime = strtolower(trim($matches[1]));
        }

        $mimeToExt = [
            'application/pdf' => 'pdf',
            'image/jpeg' => 'jpg',
            'image/jpg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/jfif' => 'jfif',
            'image/pjpeg' => 'jpg',
        ];

        return $mimeToExt[$mime] ?? null;
    }

    /**
     * Salva anexo do usuário em produtos/
     */
    public static function saveBase64File($base64Data, $originalName, $prefix) {
        return self::saveBase64ToDir($base64Data, $originalName, $prefix, self::getUploadDir());
    }

    /**
     * Salva anexo do usuário com nome fixo (sem timestamp), mantendo extensão do arquivo
     */
    public static function saveBase64FileAs($base64Data, $originalName, $baseName) {
        return self::saveBase64ToDir($base64Data, $originalName, $baseName, self::getUploadDir(), $baseName);
    }

    /**
     * Salva PDF de entrega do admin em upload/
     */
    public static function saveDeliveryPdf($base64Data, $originalName, $prefix) {
        return self::saveBase64ToDir($base64Data, $originalName, $prefix, self::getDeliveryDir());
    }

    // ── Operações por tipo ──────────────────────────────────────────────

    /**
     * Deleta um arquivo do diretório de produtos (produtos/)
     */
    public static function deleteFile($filename) {
        if (empty($filename)) return false;
        $base = basename($filename);

        $path = self::getUploadDir() . $base;
        if (file_exists($path)) {
            return unlink($path);
        }

        $legacyPath = self::getLegacyUploadDir() . $base;
        if (file_exists($legacyPath)) {
            return unlink($legacyPath);
        }

        return false;
    }

    /**
     * Deleta um arquivo do diretório de entregas (upload/)
     */
    public static function deleteDeliveryFile($filename) {
        if (empty($filename)) return false;

        $base = basename($filename);
        $deliveryPath = self::getDeliveryDir() . $base;
        if (file_exists($deliveryPath)) {
            return unlink($deliveryPath);
        }

        // Compatibilidade com arquivos antigos salvos no diretório legado
        $legacyPath = self::getLegacyUploadDir() . $base;
        if (file_exists($legacyPath)) {
            return unlink($legacyPath);
        }

        return false;
    }

    /**
     * Retorna o caminho completo de um anexo (produtos/)
     */
    public static function getFilePath($filename) {
        if (empty($filename)) return null;
        $base = basename($filename);

        $path = self::getUploadDir() . $base;
        if (file_exists($path)) {
            return $path;
        }

        $legacyPath = self::getLegacyUploadDir() . $base;
        return file_exists($legacyPath) ? $legacyPath : null;
    }

    /**
     * Retorna o caminho completo de um PDF de entrega (upload/)
     */
    public static function getDeliveryFilePath($filename) {
        if (empty($filename)) return null;

        $base = basename($filename);
        $deliveryPath = self::getDeliveryDir() . $base;
        if (file_exists($deliveryPath)) {
            return $deliveryPath;
        }

        // Compatibilidade com arquivos antigos salvos em arquivosupload/
        $legacyPath = self::getLegacyUploadDir() . $base;
        return file_exists($legacyPath) ? $legacyPath : null;
    }

    // ── Servir arquivos ─────────────────────────────────────────────────

    private static function sendFile($path, $filename) {
        if (!$path) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Arquivo não encontrado']);
            return;
        }

        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $mimeTypes = [
            'pdf'  => 'application/pdf',
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'jfif' => 'image/jpeg',
            'png'  => 'image/png',
            'gif'  => 'image/gif',
            'webp' => 'image/webp',
        ];
        $mime   = $mimeTypes[$ext] ?? 'application/octet-stream';

        header('Content-Type: ' . $mime);
        header('Content-Disposition: inline; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: public, max-age=86400');
        readfile($path);
        exit;
    }

    /**
     * Serve um anexo do usuário (produtos/)
     */
    public static function serveFile($filename, $downloadName = null) {
        $path = self::getFilePath($filename);
        self::sendFile($path, $downloadName ?: $filename);
    }

    /**
     * Serve um PDF de entrega (upload/)
     */
    public static function serveDeliveryFile($filename, $downloadName = null) {
        $path = self::getDeliveryFilePath($filename);
        self::sendFile($path, $downloadName ?: $filename);
    }
}
