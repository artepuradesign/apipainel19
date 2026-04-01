// Configuração central da API - busca do backend PHP com pool de conexões
let cachedApiUrl: string | null = null;
let configPromise: Promise<string> | null = null;

// Função para buscar a URL da API do backend PHP (singleton)
export const fetchApiConfig = async (): Promise<string> => {
  // Se já está carregado, retorna imediatamente
  if (cachedApiUrl) {
    return cachedApiUrl;
  }

  // Se já está carregando, retorna a mesma promise
  if (configPromise) {
    return configPromise;
  }

  // Inicia o carregamento
  configPromise = (async () => {
    try {
      console.log('🔄 [API CONFIG] Buscando URL da API do backend (api.php)...');
      
      // Busca a configuração do arquivo api.php
      const response = await fetch('https://api.apipainel.com.br', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        cache: 'force-cache', // Cache agressivo para evitar múltiplas requisições
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.api_url) {
          cachedApiUrl = data.data.api_url;
          console.log('✅ [API CONFIG] URL da API carregada:', cachedApiUrl);
          console.log('💡 [API CONFIG] Usando pool de conexões do backend');
          return cachedApiUrl;
        }
      }
    } catch (error) {
      console.warn('⚠️ [API CONFIG] Erro ao buscar configuração, usando fallback:', error);
    } finally {
      configPromise = null; // Reset da promise após conclusão
    }

    // Fallback se não conseguir buscar do backend
    cachedApiUrl = 'https://api.apipainel.com.br';
    console.log('⚠️ [API CONFIG] Usando URL fallback:', cachedApiUrl);
    return cachedApiUrl;
  })();

  return configPromise;
};

export const API_CONFIG = {
  get BASE_URL() {
    return cachedApiUrl || 'https://api.apipainel.com.br';
  },
  TIMEOUT: 30000,
  MAX_RETRIES: 3,
  REQUESTS_CACHE_TIME: 5000, // Cache de 5 segundos para requisições duplicadas
} as const;

export const getApiUrl = (endpoint: string = '') => {
  const baseUrl = API_CONFIG.BASE_URL;
  if (!endpoint) return baseUrl;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

// Cache de requisições para evitar chamadas duplicadas
interface CachedRequest {
  timestamp: number;
  promise: Promise<any>;
}

const requestsCache = new Map<string, CachedRequest>();

// Função para fazer requisições com cache e deduplica
export const apiRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  // Aguarda a configuração estar carregada
  await fetchApiConfig();
  
  const url = getApiUrl(endpoint);
  const cacheKey = `${options.method || 'GET'}:${url}:${JSON.stringify(options.body || {})}`;
  
  // Verifica se há uma requisição em cache recente
  const cached = requestsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < API_CONFIG.REQUESTS_CACHE_TIME) {
    console.log('📦 [API CACHE] Usando resposta em cache para:', endpoint);
    return cached.promise;
  }
  
  // Faz a requisição e armazena no cache
  const requestPromise = (async () => {
    try {
      console.log('🌐 [API REQUEST] Fazendo requisição para:', endpoint);

      const isFormData = options.body instanceof FormData;
      const baseHeaders: Record<string, string> = {
        Accept: 'application/json',
      };

      if (!isFormData) {
        baseHeaders['Content-Type'] = 'application/json';
      }
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...baseHeaders,
          ...options.headers,
        },
      });

       const safeParseJson = async () => {
         const text = await response.text();
         try {
           return JSON.parse(text);
         } catch {
           // Quando o backend retorna HTML (ex: Warning/Fatal error PHP), evitar crash de JSON.parse
           const preview = text?.slice(0, 200) || '';
           throw new Error(`Resposta inválida do servidor (não-JSON): ${preview}`);
         }
       };
      
      if (!response.ok) {
        // Tentar parsear JSON do erro para obter mensagem específica do backend
        try {
           const errorData = await safeParseJson();
          console.error('❌ [API REQUEST] Erro HTTP:', {
            status: response.status,
            statusText: response.statusText,
            endpoint,
            error: errorData
          });
          
          // Retornar objeto com success=false e mensagem do backend
          return {
            success: false,
            error: errorData.error || errorData.message || response.statusText,
            code: errorData.code || null,
            data: errorData.data || null
          } as T;
        } catch (parseError) {
           // Se não conseguir parsear JSON, lançar erro genérico (com preview)
           const errorText = parseError instanceof Error ? parseError.message : String(parseError);
          console.error('❌ [API REQUEST] Erro HTTP (sem JSON):', {
            status: response.status,
            statusText: response.statusText,
            endpoint,
            error: errorText
          });
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }
      
       const data = await safeParseJson();
      console.log('✅ [API REQUEST] Sucesso:', endpoint);
      return data as T;
    } catch (error) {
      console.error('❌ [API REQUEST] Erro na requisição:', { endpoint, error });
      // Remove do cache em caso de erro
      requestsCache.delete(cacheKey);
      throw error;
    }
  })();
  
  // Armazena no cache
  requestsCache.set(cacheKey, {
    timestamp: Date.now(),
    promise: requestPromise,
  });
  
  // Limpa o cache após o tempo definido
  setTimeout(() => {
    requestsCache.delete(cacheKey);
  }, API_CONFIG.REQUESTS_CACHE_TIME);
  
  return requestPromise;
};

// Limpa o cache de requisições manualmente
export const clearRequestsCache = () => {
  requestsCache.clear();
  console.log('🧹 [API CACHE] Cache de requisições limpo');
};

// Inicializar a configuração na carga da aplicação (apenas uma vez)
fetchApiConfig().catch(console.error);
