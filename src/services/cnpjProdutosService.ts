import { cookieUtils } from '@/utils/cookieUtils';
import { apiRequest as centralApiRequest, fetchApiConfig } from '@/config/api';

export type ProdutoStatus = 'ativo' | 'inativo' | 'rascunho';

export interface CnpjProduto {
  id: number;
  module_id: number;
  user_id: number;
  cnpj: string;
  nome_empresa: string;
  nome_produto: string;
  sku: string | null;
  categoria: string | null;
  categoria_id?: number | null;
  tags?: string | null;
  marca?: string | null;
  marca_id?: number | null;
  external_featured_image_url?: string | null;
  codigo_barras?: string | null;
  descricao_produto?: string | null;
  descricao?: string | null;
  controlar_estoque?: boolean | number;
  fotos?: string[];
  fotos_json?: string | null;
  preco: number;
  estoque: number;
  status: ProdutoStatus;
  ativo: number;
  owner_name?: string | null;
  owner_cnpj?: string | null;
  owner_avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicStoreCompany {
  nome_empresa?: string | null;
  cnpj: string;
  avatar_url?: string | null;
}

export interface StorefrontConfig {
  store_name?: string | null;
  description?: string | null;
  website?: string | null;
  logo_url?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  pix_enabled?: boolean;
  pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null;
  pix_key?: string | null;
  pix_instructions?: string | null;
}

export interface PublicStoreResponse {
  empresa: PublicStoreCompany;
  configuracao?: StorefrontConfig;
  produtos: CnpjProduto[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CnpjProdutoSections {
  categories: string[];
  brands: string[];
  tags: string[];
}

export interface StoreConfigResponse {
  empresa: PublicStoreCompany;
  configuracao: StorefrontConfig;
}

export interface BarcodeLookupData {
  found: boolean;
  codigo_barras: string;
  nome_produto?: string | null;
  marca?: string | null;
  categoria?: string | null;
  tags?: string | null;
  ncm?: string | null;
  external_featured_image_url?: string | null;
  fotos?: string[];
  fonte_prioritaria?: 'banco_interno' | 'openfoodfacts' | 'cosmos' | 'supernovaera' | null;
  consulta_log?: BarcodeLookupLog[];
  fontes?: {
    banco_interno?: Record<string, any>;
    openfoodfacts?: Record<string, any>;
    cosmos?: Record<string, any>;
    supernovaera?: Record<string, any>;
  };
}

export interface BarcodeLookupLog {
  fonte: 'banco_interno' | 'openfoodfacts' | 'cosmos' | 'supernovaera';
  status: 'success' | 'not_found' | 'error' | 'skipped';
  found?: boolean;
  mensagem: string;
  url?: string | null;
  tempo_ms?: number;
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}, requireAuth: boolean = true): Promise<ApiResponse<T>> {
  try {
    await fetchApiConfig();

    let sessionToken = cookieUtils.get('session_token') || cookieUtils.get('api_session_token');
    if (!sessionToken) {
      sessionToken = localStorage.getItem('session_token') || localStorage.getItem('api_session_token');
    }

    if (requireAuth && !sessionToken) {
      return { success: false, error: 'Token de autorização não encontrado. Faça login novamente.' };
    }

    const isFormData = options.body instanceof FormData;
    const authorizationHeader = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};

    const data = await centralApiRequest<any>(endpoint, {
      ...options,
      headers: {
        ...authorizationHeader,
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {}),
      },
    });

    return data as ApiResponse<T>;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

export const cnpjProdutosService = {
  async list(params: { limit?: number; offset?: number; search?: string; status?: ProdutoStatus | 'todos'; cnpj?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    if (params.search) qs.set('search', params.search);
    if (params.status && params.status !== 'todos') qs.set('status', params.status);
    if (params.cnpj) qs.set('cnpj', params.cnpj);

    const endpoint = `/cnpj-produtos/list${qs.toString() ? `?${qs.toString()}` : ''}`;
    return apiRequest<{
      data: CnpjProduto[];
      pagination: { total: number; limit: number; offset: number };
      sections?: CnpjProdutoSections;
    }>(endpoint);
  },

  async criar(data: {
    module_id?: number;
    cnpj: string;
    nome_empresa: string;
    nome_produto: string;
    sku?: string;
    categoria?: string;
    categoria_id?: number;
    tags?: string;
    marca?: string;
    marca_id?: number;
    external_featured_image_url?: string;
    codigo_barras?: string;
    descricao_produto?: string;
    descricao?: string;
    controlar_estoque?: boolean;
    fotos?: string[];
    preco: number;
    estoque: number;
    status: ProdutoStatus;
  }) {
    return apiRequest<CnpjProduto>('/cnpj-produtos/criar', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async atualizar(data: {
    id: number;
    cnpj?: string;
    nome_empresa?: string;
    nome_produto?: string;
    sku?: string;
    categoria?: string;
    categoria_id?: number;
    tags?: string;
    marca?: string;
    marca_id?: number;
    external_featured_image_url?: string;
    codigo_barras?: string;
    descricao_produto?: string;
    descricao?: string;
    controlar_estoque?: boolean;
    fotos?: string[];
    preco?: number;
    estoque?: number;
    status?: ProdutoStatus;
  }) {
    return apiRequest<CnpjProduto>('/cnpj-produtos/atualizar', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async excluir(id: number) {
    return apiRequest<{ id: number }>('/cnpj-produtos/excluir', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },

  async uploadFoto(file: File) {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('file', file);
    formData.append('foto', file);

    return apiRequest<{ filename: string; url: string }>('/cnpj-produtos/upload-foto', {
      method: 'POST',
      body: formData,
    });
  },

  async consultarCodigoBarras(codigoBarras: string) {
    const barcode = codigoBarras.replace(/\s+/g, '').trim();
    const endpoint = `/cnpj-produtos/consultar-codigo?codigo_barras=${encodeURIComponent(barcode)}`;
    return apiRequest<BarcodeLookupData>(endpoint);
  },

  async detalhePublico(id: number) {
    return apiRequest<CnpjProduto>(`/cnpj-produtos/detalhe-publico?id=${id}`, { method: 'GET' }, false);
  },

  async lojaPublica(cnpj: string) {
    const cnpjDigits = cnpj.replace(/\D+/g, '');
    return apiRequest<PublicStoreResponse>(`/cnpj-produtos/loja-publica?cnpj=${encodeURIComponent(cnpjDigits)}`, { method: 'GET' }, false);
  },

  async obterConfiguracaoLoja() {
    return apiRequest<StoreConfigResponse>('/cnpj-produtos/config-loja', { method: 'GET' });
  },

  async salvarConfiguracaoLoja(data: {
    store_name: string;
    description?: string;
    website?: string;
    logo_url?: string;
    whatsapp?: string;
    instagram?: string;
    pix_enabled: boolean;
    pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | '';
    pix_key?: string;
    pix_instructions?: string;
  }) {
    return apiRequest<{ configuracao: StorefrontConfig }>('/cnpj-produtos/config-loja', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
