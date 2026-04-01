import { cookieUtils } from '@/utils/cookieUtils';
import { apiRequest as centralApiRequest, fetchApiConfig } from '@/config/api';

export interface AgentConfigPayload {
  agent_name: string;
  openai_api_key?: string;
  prompt: string;
  keep_existing_api_key?: boolean;
}

export interface AgentConfigResponse {
  id: number;
  module_id: number;
  user_id: number;
  agent_name: string;
  prompt: string;
  status: 'ativo' | 'inativo';
  has_api_key: boolean;
  api_key_masked: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppConnection {
  id: number;
  module_id: number;
  user_id: number;
  session_name: string;
  whatsapp_number: string;
  connection_status: 'pendente' | 'conectado' | 'desconectado';
  qr_code: string | null;
  integration_token?: string | null;
  pairing_code?: string | null;
  connection_error?: string | null;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface TriggerWahaConnectPayload {
  webhook_url: string;
  integration_token: string;
  ip: string;
  porta: number;
  api_key: string;
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    await fetchApiConfig();

    let sessionToken = cookieUtils.get('session_token') || cookieUtils.get('api_session_token');
    if (!sessionToken) {
      sessionToken = localStorage.getItem('session_token') || localStorage.getItem('api_session_token');
    }

    if (!sessionToken) {
      return { success: false, error: 'Token de autorização não encontrado. Faça login novamente.' };
    }

    const data = await centralApiRequest<any>(endpoint, {
      ...options,
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    return data as ApiResponse<T>;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

export const cnpjChatInteligenteService = {
  async getAgentConfig() {
    return apiRequest<AgentConfigResponse>('/cnpj-chatinteligente/agent', { method: 'GET' });
  },

  async saveAgentConfig(payload: AgentConfigPayload) {
    return apiRequest<AgentConfigResponse>('/cnpj-chatinteligente/agent', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async listConnections() {
    return apiRequest<{ data: WhatsAppConnection[] }>('/cnpj-chatinteligente/connections', { method: 'GET' });
  },

  async createConnection(payload: { session_name: string; whatsapp_number: string }) {
    return apiRequest<WhatsAppConnection>('/cnpj-chatinteligente/connections', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateConnectionStatus(payload: { id: number; connection_status: 'pendente' | 'conectado' | 'desconectado' }) {
    return apiRequest<WhatsAppConnection>('/cnpj-chatinteligente/connections/status', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async rotateConnectionToken(payload: { id: number }) {
    return apiRequest<WhatsAppConnection>('/cnpj-chatinteligente/connections/token', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async triggerWahaConnect(payload: TriggerWahaConnectPayload): Promise<ApiResponse<{ ok?: boolean }>> {
    try {
      const response = await fetch(payload.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          integration_token: payload.integration_token,
          ip: payload.ip,
          porta: payload.porta,
          api_key: payload.api_key,
        }),
      });

      const text = await response.text();
      let parsed: any = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        return {
          success: false,
          error: parsed?.message || parsed?.error || `Falha ao acionar webhook n8n (HTTP ${response.status})`,
          data: parsed,
        };
      }

      return {
        success: true,
        data: parsed || { ok: true },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao acionar webhook n8n' };
    }
  },
};