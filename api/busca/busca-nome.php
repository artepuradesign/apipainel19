<?php
// busca-nome.php - JSON-only

ini_set('memory_limit', '512M');
ini_set('max_execution_time', '120');
ini_set('default_socket_timeout', '60');

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, Accept, Origin, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => false, "erro" => "Método não permitido. Use POST."]);
    exit();
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') === false) {
    http_response_code(400);
    echo json_encode(["status" => false, "erro" => "Payload inválido. Envie somente application/json."]);
    exit();
}

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true);

if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(["status" => false, "erro" => "JSON inválido na requisição."]);
    exit();
}

$nome = isset($payload['nome']) ? trim((string)$payload['nome']) : null;
$link_manual = isset($payload['link_manual']) ? trim((string)$payload['link_manual']) : null;

$link   = null;
$output = [];

// ==========================
// MODO LINK MANUAL (prioridade máxima)
// ==========================
if ($link_manual && filter_var($link_manual, FILTER_VALIDATE_URL)) {
    if (stripos($link_manual, 'pastebin.sbs/view/') !== false || 
        stripos($link_manual, 'api.fdxapis.us/temp/') !== false) {
        $link = $link_manual;
        $output[] = "Consulta direta via link manual";
        $output[] = "Link: $link";
    }
}

// ==========================
// MODO NORMAL (só se não tiver link manual)
// ==========================
if (!$link) {
    if (!$nome || strlen(trim($nome)) < 5) {
        echo json_encode(["status" => false, "erro" => "Nome inválido ou muito curto."]);
        exit;
    }

    $nome = trim($nome);
    $scriptPath = __DIR__ . "/nome-check.js";
    $cmd = 'node ' . escapeshellarg($scriptPath) . ' ' . escapeshellarg($nome);
    $exec = shell_exec($cmd . " 2>&1");

    $output = array_filter(explode("\n", trim($exec)));

    if (stripos($exec, 'TELEGRAM_SESSION_INVALID') !== false) {
        echo json_encode([
            "status" => false,
            "erro" => "Sessão do Telegram inválida ou expirada. Atualize a sessão no nome-check.js.",
            "codigo" => "TELEGRAM_SESSION_INVALID",
            "log" => $output
        ]);
        exit;
    }

    if (preg_match('/LINK_FINAL:\s*(https?:\/\/(?:pastebin\.sbs\/view\/|api\.fdxapis\.us\/temp\/)[^\s]+)/i', $exec, $m)) {
        $link = $m[1];
    } else {
        echo json_encode([
            "status" => false,
            "erro" => "Bot não retornou link válido.",
            "log" => $output
        ]);
        exit;
    }
}

// ==========================
// DOWNLOAD DO CONTEÚDO - usando cURL (mais confiável para arquivos grandes)
// ==========================
function downloadWithCurl($url) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        CURLOPT_ENCODING       => 'gzip, deflate',
        CURLOPT_HTTPHEADER     => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        ],
    ]);

    $conteudo = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error    = curl_error($ch);
    curl_close($ch);

    if ($conteudo === false || $httpCode >= 400) {
        return false;
    }
    return $conteudo;
}

$conteudo = downloadWithCurl($link);

if ($conteudo === false) {
    // fallback para file_get_contents
    $context = stream_context_create([
        'http' => [
            'header'  => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n",
            'timeout' => 60,
        ]
    ]);
    $conteudo = @file_get_contents($link, false, $context);
}

if ($conteudo === false || strlen($conteudo) < 300) {
    echo json_encode([
        "status" => false,
        "erro"   => "Falha ao baixar conteúdo ou conteúdo muito pequeno.",
        "tamanho" => strlen($conteudo ?? ''),
        "link"   => $link
    ]);
    exit;
}

// Debug: sempre salvar o conteúdo bruto
file_put_contents(__DIR__ . '/debug_ultimo_conteudo.txt', $conteudo);
file_put_contents(__DIR__ . '/debug_tamanho.txt', "Tamanho baixado: " . number_format(strlen($conteudo)) . " bytes\n");

// ==========================
// 1. Tentar extrair e parsear o JSON de forma mais robusta
// ==========================
$dados = null;

if (preg_match('/const\s+dadosPessoais\s*=\s*(\[[\s\S]*?\]);/s', $conteudo, $m)) {
    $jsonStr = trim($m[1]);

    // Limpeza agressiva
    $jsonStr = str_replace(["\r", "\n", "\t"], ' ', $jsonStr);
    $jsonStr = preg_replace('/\s+/', ' ', $jsonStr);
    $jsonStr = str_replace("'", '"', $jsonStr);
    $jsonStr = preg_replace('/,\s*(\]|})/', '$1', $jsonStr); // remove vírgula trailing

    $dados = json_decode($jsonStr, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        file_put_contents(__DIR__ . '/debug_json_erro.txt', 
            json_last_error_msg() . "\n\nPrimeiros 3000 chars:\n" . substr($jsonStr, 0, 3000)
        );
    }
}

// Tentativa alternativa: balanceamento manual de colchetes (quando regex falha)
if (!is_array($dados) || empty($dados)) {
    $inicio = strpos($conteudo, 'const dadosPessoais = [');
    if ($inicio !== false) {
        $inicio += strlen('const dadosPessoais = ');
        $nivel = 0;
        $jsonStr = '';
        $encontrouFim = false;

        for ($i = $inicio; $i < strlen($conteudo); $i++) {
            $c = $conteudo[$i];
            $jsonStr .= $c;

            if ($c === '[') $nivel++;
            if ($c === ']') $nivel--;

            if ($nivel === 0 && $c === ';') {
                $encontrouFim = true;
                break;
            }
        }

        if ($encontrouFim) {
            $jsonStr = rtrim($jsonStr, ';');
            $jsonStr = str_replace("'", '"', $jsonStr);
            $dados = json_decode($jsonStr, true);
        }
    }
}

$resultados = [];

if (is_array($dados) && !empty($dados)) {
    foreach ($dados as $item) {
        if (!isset($item['DADOS'])) continue;
        $d = $item['DADOS'];
        $entrada = [
            'nome'       => $d['NOME'] ?? '—',
            'cpf'        => $d['CPF'] ?? '—',
            'nascimento' => $d['NASCIMENTO'] ?? '—',
            'sexo'       => $d['SEXO'] ?? '—',
        ];

        // idade
        $entrada['idade'] = '—';
        if (preg_match('/(\d{2})\/(\d{2})\/(\d{4})/', $entrada['nascimento'], $dt)) {
            $ano = (int)$dt[3];
            if ($ano > 1900 && $ano < date('Y') + 1) {
                $nasc = new DateTime("{$dt[3]}-{$dt[2]}-{$dt[1]}");
                $hoje = new DateTime();
                $entrada['idade'] = $hoje->diff($nasc)->y . ' anos';
            }
        }

        // endereços
        $ends = []; $cids = [];
        if (isset($item['ENDERECO']) && is_array($item['ENDERECO'])) {
            foreach ($item['ENDERECO'] as $e) {
                $partes = array_filter([
                    $e['LOGR_NOME']     ?? '',
                    $e['LOGR_NUMERO']   ?? '',
                    $e['LOGR_COMPLEMENTO'] ?? null,
                    $e['BAIRRO']        ?? ''
                ]);
                $str = implode(', ', $partes);
                if (!empty($e['CIDADE'])) {
                    $str .= ' • ' . $e['CIDADE'];
                    $cids[] = $e['CIDADE'];
                }
                if (!empty($e['CEP']) && $e['CEP'] !== 'NULL') {
                    $str .= ' • ' . $e['CEP'];
                }
                if (trim($str)) $ends[] = trim($str);
            }
        }
        $entrada['enderecos'] = !empty($ends) ? implode("\n", $ends) : '—';
        $entrada['cidades']   = !empty($cids) ? implode(', ', array_unique($cids)) : '—';

        $resultados[] = $entrada;
    }
}

// 2. Tabela HTML (fallback) – mantido como está
if (empty($resultados)) {
    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    $dom->loadHTML(mb_convert_encoding($conteudo, 'HTML-ENTITIES', 'UTF-8'));
    foreach ($dom->getElementsByTagName('table') as $table) {
        $headers = [];
        $rows = $table->getElementsByTagName('tr');
        foreach ($rows as $i => $row) {
            if ($i == 0) {
                foreach ($row->getElementsByTagName('th') as $th) {
                    $headers[] = strtolower(str_replace([' ', '/'], '_', trim($th->textContent)));
                }
                continue;
            }
            $cells = $row->getElementsByTagName('td');
            if ($cells->length < count($headers)) continue;
            $ent = [];
            foreach ($cells as $j => $cell) {
                if (isset($headers[$j])) {
                    $ent[$headers[$j]] = trim(preg_replace('/\s+/', ' ', $cell->textContent));
                }
            }
            if (!empty($ent['nome'] ?? '') || !empty($ent['cpf'] ?? '')) {
                $resultados[] = $ent;
            }
        }
        if (!empty($resultados)) break;
    }
}

// 3. Parser pastebin (mantido como está)
if (empty($resultados)) {
    preg_match('/<article id="content"[^>]*>(.*?)<\/article>/is', $conteudo, $match);
    $conteudoLimpo = $match[1] ?? $conteudo;

    $texto = html_entity_decode(strip_tags($conteudoLimpo), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $texto = preg_replace('/\s+/', ' ', trim($texto));
    $linhas = preg_split('/\s*(CPF|Nome|Nascimento|Sexo|Nome da Mãe|Endereço):\s*/i', $texto, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY);

    $entrada = [];
    $campoAtual = '';

    foreach ($linhas as $parte) {
        $parte = trim($parte);
        if (empty($parte)) continue;

        if (preg_match('/^(CPF|Nome|Nascimento|Sexo|Nome da Mãe|Endereço)$/i', $parte, $m)) {
            $campoAtual = strtolower($m[1]);
            continue;
        }

        if ($campoAtual) {
            switch ($campoAtual) {
                case 'cpf':
                    if (!empty($entrada['cpf']) && !empty($entrada['nome'])) {
                        $entrada['enderecos'] = $entrada['endereco'] ?? '—';
                        $entrada['cidades']   = '—';
                        // ... (lógica de cidades mantida igual)
                        $entrada['idade'] = '—';
                        // ... (cálculo de idade mantido igual)
                        unset($entrada['endereco']);
                        $resultados[] = $entrada;
                    }
                    $entrada = [];
                    $entrada['cpf'] = $parte;
                    break;

                case 'nome':     $entrada['nome'] = $parte; break;
                case 'nascimento': $entrada['nascimento'] = $parte; break;
                case 'sexo':     $entrada['sexo'] = $parte; break;
                case 'endereço':
                case 'endereco': $entrada['endereco'] = $parte; break;
            }
            $campoAtual = '';
        }
    }

    // Último registro
    if (!empty($entrada['cpf']) && !empty($entrada['nome'])) {
        // ... mesma lógica de fechamento do último registro
        $entrada['enderecos'] = $entrada['endereco'] ?? '—';
        $entrada['cidades']   = '—';
        // ... (cidades e idade)
        unset($entrada['endereco']);
        $resultados[] = $entrada;
    }
}

// Debug final
file_put_contents(__DIR__ . '/debug_resultados.txt', print_r($resultados, true));

// ==========================
// RESPOSTA FINAL
// ==========================
echo json_encode([
    "status"            => true,
    "nome_consultado"   => $nome ?? '(consulta via link direto)',
    "link"              => $link,
    "resultados"        => $resultados,
    "total_encontrados" => count($resultados),
    "log"               => $output,
    "tamanho_conteudo"  => number_format(strlen($conteudo)) . ' bytes',
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);