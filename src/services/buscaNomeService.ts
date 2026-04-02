// Serviço para consulta por nome completo via proxy PHP (resolve CORS)
import { cookieUtils } from '@/utils/cookieUtils';

export interface NomeConsultaResultado {
  nome: string;
  cpf: string;
  nascimento: string;
  idade: string;
  sexo: string;
  enderecos: string;
  cidades: string;
  nome_mae?: string;
  [key: string]: string | undefined;
}

export interface NomeConsultaResponse {
  status: boolean;
  nome_consultado: string;
  link: string;
  resultados: NomeConsultaResultado[];
  total_encontrados: number;
  log: string[];
  erro?: string;
}

async function postJsonWithXhr(
  url: string,
  body: string,
  timeoutMs = 30000,
  authToken?: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
    xhr.setRequestHeader('Accept', 'application/json');
    if (authToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    }
    xhr.timeout = timeoutMs;

    xhr.onload = () => {
      resolve({
        status: xhr.status,
        body: xhr.responseText ?? ''
      });
    };

    xhr.onerror = () => reject(new Error('Falha de rede ao consultar servidor'));
    xhr.ontimeout = () => reject(new Error('Tempo limite excedido na consulta por nome'));

    xhr.send(body);
  });
}

export const buscaNomeService = {
  /**
   * Consulta por nome completo via proxy PHP (evita CORS)
   * Suporta busca por nome ou link direto (pastebin.sbs/api.fdxapis.us)
   */
  async consultarNome(nome: string, linkManual?: string): Promise<{
    success: boolean;
    data?: NomeConsultaResponse;
    error?: string;
  }> {
    try {
      console.log('🔍 [BUSCA_NOME] Iniciando consulta por nome:', nome || '(link manual)');

      const authToken =
        cookieUtils.get('session_token') ||
        cookieUtils.get('api_session_token') ||
        undefined;
      
      // JSON-only sem fallback (conforme regra de produção)
      const SEARCH_URL = 'https://api.apipainel.com.br/busca/busca-nome.php';
      
      let requestPayload: Record<string, string>;
      
      if (linkManual && (linkManual.includes('pastebin.sbs') || linkManual.includes('api.fdxapis.us'))) {
        requestPayload = { link_manual: linkManual };
        console.log('📎 [BUSCA_NOME] Usando link manual:', linkManual);
      } else {
        if (!nome || nome.trim().length < 5) {
          console.error('❌ [BUSCA_NOME] Nome inválido ou muito curto');
          return {
            success: false,
            error: 'Nome inválido ou muito curto (mínimo 5 caracteres)'
          };
        }
        requestPayload = { nome: nome.trim() };
        console.log('📤 [BUSCA_NOME] Enviando nome para consulta via proxy:', nome.trim());
      }

      const response = await postJsonWithXhr(SEARCH_URL, JSON.stringify(requestPayload), 30000, authToken);

      console.log('📡 [BUSCA_NOME] Status da resposta:', response.status);

      if (response.status < 200 || response.status >= 300) {
        const errorText = response.body;
        console.error('❌ [BUSCA_NOME] Erro HTTP:', response.status, errorText);
        return {
          success: false,
          error: `Erro na comunicação: ${response.status}${errorText ? ` - ${errorText.slice(0, 200)}` : ''}`
        };
      }

      // Parse robusto (alguns erros retornam HTML/texto e quebram response.json())
      const rawText = response.body;
      let data: NomeConsultaResponse;
      try {
        data = JSON.parse(rawText) as NomeConsultaResponse;
      } catch (parseError) {
        console.error('❌ [BUSCA_NOME] Resposta não-JSON:', rawText);
        return {
          success: false,
          error: 'Resposta inválida do servidor (não retornou JSON)'
        };
      }

      console.log('📥 [BUSCA_NOME] Resposta recebida:', {
        status: data.status,
        total_encontrados: data.total_encontrados,
        link: data.link
      });

      if (data.status === true) {
        console.log('✅ [BUSCA_NOME] Consulta realizada com sucesso!');
        console.log('📊 [BUSCA_NOME] Resultados encontrados:', data.total_encontrados);
        
        return {
          success: true,
          data: data
        };
      } else {
        console.log('❌ [BUSCA_NOME] Consulta sem resultados:', data.erro);
        return {
          success: false,
          error: data.erro || 'Nenhum resultado encontrado'
        };
      }

    } catch (error) {
      console.error('❌ [BUSCA_NOME] Erro na requisição:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao consultar API'
      };
    }
  }
};
