<?php
// index-apipainel.php
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Consulta por Nome - API Painel</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 40px auto; padding: 0 15px; }
        h1 { text-align: center; }
        form { display: flex; flex-direction: column; gap: 10px; max-width: 500px; margin: 0 auto 30px; }
        input { padding: 12px; font-size: 16px; }
        button { padding: 12px; background: #0066cc; color: white; border: none; font-size: 16px; cursor: pointer; }
        button:hover { background: #0055aa; }

        #modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; justify-content: center; align-items: center; }
        #modal-content { background: white; padding: 25px; border-radius: 8px; width: 95%; max-width: 1100px; max-height: 90vh; overflow-y: auto; }
        #log { background: #f8f9fa; padding: 15px; border: 1px solid #ddd; min-height: 180px; font-family: monospace; font-size: 13px; white-space: pre-wrap; overflow-y: auto; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; vertical-align: top; }
        th { background: #f2f2f2; font-weight: bold; }
        .empty { color: #e74c3c; font-weight: bold; text-align: center; padding: 20px; }
        .endereco { white-space: pre-line; }
    </style>
</head>
<body>

<h1>Consulta por Nome Completo - API Painel</h1>

<form id="formConsulta">
    <input type="text" id="nome" placeholder="Digite o nome completo (ex: Lana Dantas)" required minlength="5">
    <button type="submit">Consultar</button>
</form>

<div id="modal">
    <div id="modal-content">
        <h2>Processo da Consulta</h2>
        <pre id="log">Aguardando...</pre>
        <div id="resultados"></div>
        <button onclick="document.getElementById('modal').style.display='none'" style="margin-top:20px; padding:12px 24px; background:#dc3545; color:white; border:none; cursor:pointer; font-size:16px;">Fechar</button>
    </div>
</div>

<script>
function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
}

function getAuthToken() {
    return localStorage.getItem('session_token') ||
           localStorage.getItem('api_session_token') ||
           getCookie('session_token') ||
           getCookie('api_session_token') ||
           '';
}

document.getElementById('formConsulta').addEventListener('submit', async e => {
    e.preventDefault();
    const nome = document.getElementById('nome').value.trim();
    if (!nome) return;

    const modal = document.getElementById('modal');
    const logArea = document.getElementById('log');
    const resultadosDiv = document.getElementById('resultados');

    modal.style.display = 'flex';
    logArea.textContent = 'Iniciando consulta via API Painel...\nEnviando nome para a API...\n';

    try {
        const token = getAuthToken();
        const headers = {
            'Content-Type': 'application/json; charset=UTF-8',
            'Accept': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('busca-apipainel.php', {
            method: 'POST',
            headers,
            body: JSON.stringify({ nome })
        });

        if (!res.ok) throw new Error('Erro na resposta da API');

        const data = await res.json();

        logArea.textContent = data.log ? data.log.join('\n') : 'Sem log detalhado disponível.';

        resultadosDiv.innerHTML = '';

        if (data.status === true) {
            resultadosDiv.innerHTML += `<p><strong>Total de registros encontrados:</strong> ${data.total_encontrados}</p>`;

            if (data.total_encontrados > 0) {
                let tabela = '<table><thead><tr><th>Nome</th><th>CPF</th><th>Nascimento</th><th>Sexo</th><th>Endereços</th><th>Cidades</th></tr></thead><tbody>';

                data.resultados.forEach(row => {
                    tabela += '<tr>';
                    tabela += `<td>${row.nome || '—'}</td>`;
                    tabela += `<td>${row.cpf || '—'}</td>`;
                    tabela += `<td>${row.nascimento || '—'}</td>`;
                    tabela += `<td>${row.sexo || '—'}</td>`;
                    tabela += `<td class="endereco">${row.enderecos || '—'}</td>`;
                    tabela += `<td>${row.cidades || '—'}</td>`;
                    tabela += '</tr>';
                });

                tabela += '</tbody></table>';
                resultadosDiv.innerHTML += tabela;
            } else {
                resultadosDiv.innerHTML += '<p class="empty">Nenhum resultado encontrado para este nome.</p>';
            }
        } else {
            resultadosDiv.innerHTML += `<p style="color:red;">${data.erro || 'Erro desconhecido'}</p>`;
        }
    } catch (err) {
        logArea.textContent += `\nERRO: ${err.message}`;
        resultadosDiv.innerHTML = '<p style="color:red;">Falha na comunicação com a API.</p>';
    }
});
</script>

</body>
</html>