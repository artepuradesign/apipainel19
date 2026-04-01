/**
 * Serviço para enviar CPF para processamento via Atito
 * O sistema Atito processa o CPF através de:
 * 1. PHP recebe o CPF via POST
 * 2. Executa script Node.js que interage com Telegram Bot
 * 3. Bot busca dados e envia para webhook n8n
 * 4. n8n armazena os dados no banco de dados
 */

export const atitoConsultaCpfService = {
  /**
   * Envia CPF para processamento via Atito
   * @param cpf CPF sem formatação (11 dígitos)
   * @returns {success: boolean, message?: string, error?: string}
   */
  async enviarCpf(cpf: string): Promise<{ success: boolean; message?: string; error?: string; statusUrl?: string; status?: string }> {
    try {
      console.log('🌐 [ATITO] Enviando CPF para processamento (POST):', cpf);
      
      const url = `https://api.apipainel.com.br/agentedeia/index.php?cpf=${encodeURIComponent(cpf)}`;
      console.log('🔗 [ATITO] URL completa:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8'
        }
      });

      console.log('📊 [ATITO] Status da resposta:', response.status);
      
      const rawText = await response.text();
      console.log('📄 [ATITO] Resposta raw (primeiros 300 chars):', rawText.substring(0, 300));

      let parsed: any = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      if (response.ok) {
        if (parsed && (parsed.status === true || parsed.success === true)) {
          return {
            success: true,
            message: parsed.message || 'CPF recebido para processamento no servidor',
            statusUrl: parsed.status_url,
            status: 'queued'
          };
        }

        return {
          success: true,
          message: 'CPF recebido para processamento no servidor',
          status: 'queued'
        };
      }
      
      console.error('❌ [ATITO] Falha na requisição HTTP:', response.status);
      return {
        success: false,
        error: parsed?.erro || parsed?.error || `Falha ao enviar CPF (HTTP ${response.status})`
      };
      
    } catch (error: any) {
      console.error('❌ [ATITO] Exceção:', error);
      return { 
        success: false, 
        error: error.message || 'Erro de conexão com o servidor Atito' 
      };
    }
  },

  async consultarStatus(cpf: string, statusUrl?: string): Promise<{ success: boolean; status?: string; message?: string; error?: string }> {
    try {
      const url = statusUrl || `https://api.apipainel.com.br/agentedeia/status.php?cpf=${encodeURIComponent(cpf)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const rawText = await response.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        return {
          success: false,
          error: data?.error || `Falha ao consultar status (HTTP ${response.status})`
        };
      }

      return {
        success: true,
        status: data?.status,
        message: data?.message
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Erro ao consultar status do processamento'
      };
    }
  }
};
