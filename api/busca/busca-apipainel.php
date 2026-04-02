<?php
// busca-nome.php - FINAL (funciona com link direto SEM precisar do nome)

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET");
header("Access-Control-Allow-Headers: Content-Type");

$nome         = $_POST['nome'] ?? null;
$link_manual  = $_POST['link_manual'] ?? null;

$link   = null;
$output = [];

// ==========================
// MODO LINK MANUAL (prioridade máxima)
// ==========================
if ($link_manual && filter_var($link_manual, FILTER_VALIDATE_URL)) {
    if (stripos($link_manual, 'pastebin.sbs/view/') !== false || stripos($link_manual, 'api.fdxapis.us/temp/') !== false) {
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
// DOWNLOAD DO CONTEÚDO
// ==========================
$context = stream_context_create([
    'http' => [
        'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n"
    ]
]);

$conteudo = @file_get_contents($link, false, $context);

if ($conteudo === false) {
    // ... erro ...
    exit;
}

// Debug temporário - grave o que foi baixado
file_put_contents(__DIR__ . '/debug_ultimo_conteudo.txt', $conteudo);
$resultados = [];

// Função para extrair array balanceado (lida com nested arrays)
function extractBalancedArray($content, $varName = 'dadosPessoais') {
    $startStr = "const {$varName} = [";
    $startPos = strpos($content, $startStr);
    if ($startPos === false) return false;

    $startPos += strlen($startStr) - 1; // Posicionar no '[' inicial
    $len = strlen($content);
    $level = 1; // Começa em 1 pois já estamos no [
    $inString = false;
    $stringChar = '';
    $escape = false;

    for ($i = $startPos + 1; $i < $len; $i++) {
        $char = $content[$i];

        if ($inString) {
            if ($escape) {
                $escape = false;
            } else if ($char === '\\') {
                $escape = true;
            } else if ($char === $stringChar) {
                $inString = false;
            }
        } else {
            if ($char === '"' || $char === "'") {
                $inString = true;
                $stringChar = $char;
            } else if ($char === '[') {
                $level++;
            } else if ($char === ']') {
                $level--;
                if ($level === 0) {
                    // Encontrou o fim
                    return substr($content, $startPos, $i - $startPos + 1);
                }
            }
        }
    }
    return false;
}

// 1. JSON (api.fdxapis.us) - Versão melhorada com balanceamento
if (preg_match('/api\.fdxapis\.us/', $link) || strpos($conteudo, 'dadosPessoais') !== false) {
    $jsonBruto = extractBalancedArray($conteudo);

    if ($jsonBruto) {
        // Limpeza agressiva para tornar válido JSON
        $jsonLimpo = preg_replace('/([{,]\s*)(\w+?)\s*:/', '$1"$2":', $jsonBruto); // Aspas em chaves
        $jsonLimpo = str_replace("'", '"', $jsonLimpo); // Troca ' por "
        $jsonLimpo = preg_replace('/,\s*([}\]])/', '$1', $jsonLimpo); // Remove vírgulas sobrando antes de } ou ]
        $jsonLimpo = preg_replace('/\s+/', ' ', $jsonLimpo); // Normaliza espaços (opcional, mas ajuda)

        $dados = json_decode($jsonLimpo, true);

        if (json_last_error() === JSON_ERROR_NONE && is_array($dados)) {
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
                    if ($ano > 1900 && $ano < 2100) {
                        $nasc = new DateTime("{$dt[3]}-{$dt[2]}-{$dt[1]}");
                        $hoje = new DateTime();
                        $entrada['idade'] = $hoje->diff($nasc)->y . ' anos';
                    }
                }

                // endereços
                $ends = []; $cids = [];
                if (isset($item['ENDERECO']) && is_array($item['ENDERECO'])) {
                    foreach ($item['ENDERECO'] as $e) {
                        $partes = array_filter([$e['LOGR_NOME']??'', $e['LOGR_NUMERO']??'', $e['LOGR_COMPLEMENTO']??null, $e['BAIRRO']??'']);
                        $str = implode(', ', $partes);
                        if (!empty($e['CIDADE'])) {
                            $str .= ' • ' . $e['CIDADE'];
                            $cids[] = $e['CIDADE'];
                        }
                        if (!empty($e['CEP']) && $e['CEP'] !== 'NULL') $str .= ' • ' . $e['CEP'];
                        if (trim($str)) $ends[] = trim($str);
                    }
                }
                $entrada['enderecos'] = !empty($ends) ? implode("\n", $ends) : '—';
                $entrada['cidades']   = !empty($cids) ? implode(', ', array_unique($cids)) : '—';

                $resultados[] = $entrada;
            }
        } else {
            // Debug erro JSON
            file_put_contents(__DIR__ . '/debug_json_error.txt', json_last_error_msg() . "\n" . $jsonLimpo);
        }
    }
}

// 2. Tabela HTML (fallback antigo)
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

// 3. Parser específico para pastebin.sbs (formato <p><b>Campo:</b> valor</p>)
if (empty($resultados)) {
    // Extrai apenas o conteúdo útil dentro do <article id="content">
    preg_match('/<article id="content"[^>]*>(.*?)<\/article>/is', $conteudo, $match);
    $conteudoLimpo = $match[1] ?? $conteudo;

    // Converte para texto puro
    $texto = html_entity_decode(strip_tags($conteudoLimpo), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $texto = preg_replace('/\s+/', ' ', trim($texto)); // normaliza espaços
    $linhas = preg_split('/\s*(CPF|Nome|Nascimento|Sexo|Nome da Mãe|Endereço):\s*/i', $texto, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY);

    $resultados = [];
    $entrada = [];
    $campoAtual = '';

    foreach ($linhas as $parte) {
        $parte = trim($parte);

        if (empty($parte)) continue;

        // Detecta novo campo
        if (preg_match('/^(CPF|Nome|Nascimento|Sexo|Nome da Mãe|Endereço)$/i', $parte, $m)) {
            $campoAtual = strtolower($m[1]);
            continue;
        }

        // Valor do campo atual
        if ($campoAtual) {
            switch ($campoAtual) {
                case 'cpf':
                    // Novo CPF → salva registro anterior se válido
                    if (!empty($entrada['cpf']) && !empty($entrada['nome'])) {
                        $entrada['enderecos'] = $entrada['endereco'] ?? '—';
                        $entrada['cidades']   = '—';

                        if (!empty($entrada['endereco']) && stripos($entrada['endereco'], 'SEM INFORMACAO') === false) {
                            preg_match_all('/•\s*([^•]+?)\s*\/[A-Z]{2}/i', $entrada['endereco'], $m);
                            if (!empty($m[1])) {
                                $cidades = array_map('trim', $m[1]);
                                $entrada['cidades'] = implode(', ', array_unique($cidades)) ?: '—';
                            }
                        }

                        $entrada['idade'] = '—';
                        if (!empty($entrada['nascimento']) && preg_match('/(\d{2})\/(\d{2})\/(\d{4})/', $entrada['nascimento'], $dt)) {
                            $ano = (int)$dt[3];
                            if ($ano > 1900 && $ano < 2100) {
                                $nasc = new DateTime("{$dt[3]}-{$dt[2]}-{$dt[1]}");
                                $hoje = new DateTime();
                                $idade = $hoje->diff($nasc)->y;
                                $entrada['idade'] = $idade . ' anos';
                            }
                        }

                        unset($entrada['endereco']);
                        $resultados[] = $entrada;
                    }
                    $entrada = [];
                    $entrada['cpf'] = $parte;
                    break;

                case 'nome':
                    $entrada['nome'] = $parte;
                    break;

                case 'nascimento':
                    $entrada['nascimento'] = $parte;
                    break;

                case 'sexo':
                    $entrada['sexo'] = $parte;
                    break;

                case 'endereço':
                case 'endereco':
                    $entrada['endereco'] = $parte;
                    break;
            }
            $campoAtual = ''; // reseta para próximo
        }
    }

    // Salva o último registro
    if (!empty($entrada['cpf']) && !empty($entrada['nome'])) {
        $entrada['enderecos'] = $entrada['endereco'] ?? '—';
        $entrada['cidades']   = '—';
        if (!empty($entrada['endereco']) && stripos($entrada['endereco'], 'SEM INFORMACAO') === false) {
            preg_match_all('/•\s*([^•]+?)\s*\/[A-Z]{2}/i', $entrada['endereco'], $m);
            if (!empty($m[1])) {
                $cidades = array_map('trim', $m[1]);
                $entrada['cidades'] = implode(', ', array_unique($cidades)) ?: '—';
            }
        }
        $entrada['idade'] = '—';
        if (!empty($entrada['nascimento']) && preg_match('/(\d{2})\/(\d{2})\/(\d{4})/', $entrada['nascimento'], $dt)) {
            $ano = (int)$dt[3];
            if ($ano > 1900 && $ano < 2100) {
                $nasc = new DateTime("{$dt[3]}-{$dt[2]}-{$dt[1]}");
                $hoje = new DateTime();
                $idade = $hoje->diff($nasc)->y;
                $entrada['idade'] = $idade . ' anos';
            }
        }
        unset($entrada['endereco']);
        $resultados[] = $entrada;
    }
}

// ←←← COLOQUE AQUI AS LINHAS DE DEBUG
file_put_contents(__DIR__ . '/debug_conteudo.txt', $conteudo);
file_put_contents(__DIR__ . '/debug_resultados.txt', print_r($resultados, true));

// ==========================
// RESPOSTA FINAL
// ==========================
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    "status"            => true,
    "nome_consultado"   => $nome ?? '(consulta via link direto)',
    "link"              => $link,
    "resultados"        => $resultados,
    "total_encontrados" => count($resultados),
    "log"               => $output
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);