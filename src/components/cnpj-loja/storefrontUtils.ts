import type { CnpjProduto } from '@/services/cnpjProdutosService';

export type StoreHighlight = 'lancamentos' | 'mais_vendidos' | 'ofertas';

export const STORE_HIGHLIGHT_LABELS: Record<StoreHighlight, string> = {
  lancamentos: 'Lançamentos',
  mais_vendidos: 'Mais vendidos',
  ofertas: 'Ofertas',
};

const PHOTO_SLOTS_TOTAL = 5;

const normalizeToken = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const parseTags = (value?: string | null) =>
  (value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

export const getHighlightFromTags = (value?: string | null): StoreHighlight | null => {
  const tags = parseTags(value).map(normalizeToken);

  if (tags.some((tag) => tag === 'lancamentos' || tag === 'lancamento')) return 'lancamentos';
  if (tags.some((tag) => tag === 'mais vendidos' || tag === 'mais vendido')) return 'mais_vendidos';
  if (tags.some((tag) => tag === 'ofertas' || tag === 'oferta')) return 'ofertas';

  return null;
};

const extractFilenameFromPhotoValue = (value: string) => {
  const trimmed = decodeURIComponent(value.trim().replace(/^"|"$/g, ''));
  if (!trimmed) return '';

  const noLeadingSlash = trimmed.replace(/^\/+/, '');

  if (/^api\/upload\/serve\?/i.test(noLeadingSlash)) {
    const query = noLeadingSlash.split('?')[1] || '';
    const params = new URLSearchParams(query);
    const fileParam = params.get('file')?.trim();
    if (fileParam) {
      const decodedParam = decodeURIComponent(fileParam).trim();
      if (/^https?:\/\//i.test(decodedParam) || /^api\/upload\/serve\?/i.test(decodedParam)) {
        return extractFilenameFromPhotoValue(decodedParam);
      }

      return decodedParam.split('/').pop()?.trim() || '';
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const fileParam = parsed.searchParams.get('file')?.trim();
      if (fileParam) {
        const decodedParam = decodeURIComponent(fileParam).trim();
        if (/^https?:\/\//i.test(decodedParam) || /^api\/upload\/serve\?/i.test(decodedParam)) {
          return extractFilenameFromPhotoValue(decodedParam);
        }

        return decodedParam.split('/').pop()?.trim() || '';
      }

      const lastPathChunk = parsed.pathname.split('/').pop()?.trim();
      if (lastPathChunk) return lastPathChunk;
    } catch {
      return '';
    }
  }

  if (/^(fotos|uploads|base-foto|produtos)\//i.test(noLeadingSlash)) {
    return noLeadingSlash.split('/').pop()?.trim() || '';
  }

  const extMatch = noLeadingSlash.match(/([A-Za-z0-9._-]+\.(?:png|jpe?g|webp|gif|bmp|svg|avif))/i);
  if (extMatch?.[1]) return extMatch[1].trim();

  return noLeadingSlash.split('?')[0].trim();
};

const parsePhotosInput = (input?: unknown) => {
  if (Array.isArray(input)) return input;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'string') return [parsed];
    } catch {
      // fallback para string simples
    }

    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [trimmed];
  }

  return [];
};

export const normalizeProductPhotos = (produto: Pick<CnpjProduto, 'fotos' | 'fotos_json' | 'external_featured_image_url'>) => {
  const merged = [produto.external_featured_image_url, ...parsePhotosInput(produto.fotos), ...parsePhotosInput(produto.fotos_json)]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .map((value) => {
      if (/^https?:\/\//i.test(value)) return value;
      const filename = extractFilenameFromPhotoValue(value);
      if (!filename) return '';
      return `https://api.apipainel.com.br/produtos/${encodeURIComponent(filename)}`;
    })
    .filter(Boolean);

  return Array.from(new Set(merged)).slice(0, PHOTO_SLOTS_TOTAL);
};

export const splitStoreSections = (produtos: CnpjProduto[]) => {
  const ativos = produtos.filter((produto) => produto.status === 'ativo');
  const sortedByCreated = [...ativos].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  const lancamentos = sortedByCreated
    .filter((produto) => getHighlightFromTags(produto.tags) === 'lancamentos')
    .slice(0, 8);

  const maisVendidos = sortedByCreated
    .filter((produto) => getHighlightFromTags(produto.tags) === 'mais_vendidos')
    .slice(0, 8);

  const ofertas = sortedByCreated.filter((produto) => getHighlightFromTags(produto.tags) === 'ofertas').slice(0, 8);

  return {
    lancamentos: lancamentos.length > 0 ? lancamentos : sortedByCreated.slice(0, 8),
    maisVendidos,
    ofertas,
    todos: sortedByCreated,
  };
};
