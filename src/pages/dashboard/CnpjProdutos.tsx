import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { Package, Plus, RefreshCw, Pencil, Trash2, Search, ScanLine, ExternalLink } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import SimpleTitleBar from '@/components/dashboard/SimpleTitleBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BarcodeScanner from '@/components/cnpj-produtos/BarcodeScanner';
import ProductPhotoUploader from '@/components/cnpj-produtos/ProductPhotoUploader';
import ProductDescriptionEditor from '@/components/cnpj-produtos/ProductDescriptionEditor';
import ProductDataPanel from '@/components/cnpj-produtos/ProductDataPanel';
import ProductCategorySelector from '@/components/cnpj-produtos/ProductCategorySelector';
import ProductTagSelector from '@/components/cnpj-produtos/ProductTagSelector';
import ProductBrandSelector from '@/components/cnpj-produtos/ProductBrandSelector';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cnpjProdutosService, type BarcodeLookupLog, type CnpjProduto, type CnpjProdutoSections, type ProdutoStatus } from '@/services/cnpjProdutosService';

const MODULE_ID = 183;

const PRODUCT_CATEGORIES = [
  'Alimentos e Bebidas',
  'Alimentos Naturais',
  'Artigos para Festas',
  'Artesanato',
  'Automotivo',
  'Bebidas',
  'Beleza e Cosméticos',
  'Brinquedos',
  'Calçados',
  'Casa e Decoração',
  'Celulares e Acessórios',
  'Climatização',
  'Construção',
  'Cozinha e Utilidades',
  'Eletrodomésticos',
  'Eletrônicos',
  'Embalagens',
  'Escritório',
  'Esportes',
  'Ferramentas',
  'Floricultura',
  'Games',
  'Higiene e Limpeza',
  'Informática',
  'Instrumentos Musicais',
  'Joias e Acessórios',
  'Livros e Papelaria',
  'Malas e Mochilas',
  'Materiais Elétricos',
  'Materiais Hidráulicos',
  'Móveis',
  'Moda Feminina',
  'Moda Infantil',
  'Moda Masculina',
  'Ótica',
  'Papelaria',
  'Perfumaria',
  'Pet Shop',
  'Produtos Digitais',
  'Saúde',
  'Saúde e Bem-estar',
  'Segurança',
  'Serviços',
  'Suplementos',
  'Telefonia',
  'Turismo',
  'Vestuário',
] as const;

const produtoSchema = z.object({
  cnpj: z.string().min(14, 'CNPJ deve conter 14 dígitos').max(18, 'CNPJ inválido'),
  nome_empresa: z.string().trim().min(2, 'Informe a empresa').max(255, 'Máximo de 255 caracteres'),
  nome_produto: z.string().trim().min(2, 'Informe o produto').max(255, 'Máximo de 255 caracteres'),
  sku: z.string().trim().max(120, 'Máximo de 120 caracteres').optional().or(z.literal('')),
  categoria: z.string().trim().max(120, 'Máximo de 120 caracteres').optional().or(z.literal('')),
  codigo_barras: z.string().trim().max(64, 'Máximo de 64 caracteres').optional().or(z.literal('')),
  controlar_estoque: z.boolean(),
  fotos: z.array(z.string().trim().min(1, 'Foto inválida')).max(5, 'Máximo de 5 fotos'),
  preco: z.number().min(0, 'Preço não pode ser negativo'),
  estoque: z.number().int().min(0, 'Estoque não pode ser negativo'),
  status: z.enum(['ativo', 'inativo', 'rascunho']),
});

type ProdutoFormData = z.infer<typeof produtoSchema>;

const emptyForm: ProdutoFormData = {
  cnpj: '',
  nome_empresa: '',
  nome_produto: '',
  sku: '',
  categoria: '',
  codigo_barras: '',
  controlar_estoque: false,
  fotos: [],
  preco: 0,
  estoque: 0,
  status: 'ativo',
};

const statusLabel: Record<ProdutoStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  rascunho: 'Rascunho',
};

const PHOTO_SLOTS_TOTAL = 5;

const API_FILES_BASE_URL = 'https://api.apipainel.com.br';

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

const normalizeSingleProductPhotoUrl = (value: unknown) => {
  if (typeof value !== 'string') return '';

  const raw = value.trim().replace(/^"|"$/g, '');
  if (!raw) return '';

  const filename = extractFilenameFromPhotoValue(raw);
  if (!filename) return '';

  return `${API_FILES_BASE_URL}/produtos/${encodeURIComponent(filename)}`;
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
      // fallback para string simples ou lista separada por vírgula
    }

    if (trimmed.includes(',')) {
      return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }

    return [trimmed];
  }

  return [];
};

const normalizeProductPhotos = (fotos?: unknown, fotosJson?: unknown) => {
  const merged = [...parsePhotosInput(fotos), ...parsePhotosInput(fotosJson)]
    .map(normalizeSingleProductPhotoUrl)
    .filter((url): url is string => url.length > 0);

  return Array.from(new Set(merged)).slice(0, PHOTO_SLOTS_TOTAL);
};

const toPhotoSlots = (fotos: string[] = []) => {
  const slots = Array.from({ length: PHOTO_SLOTS_TOTAL }, () => '');
  fotos.slice(0, PHOTO_SLOTS_TOTAL).forEach((url, index) => {
    slots[index] = url;
  });
  return slots;
};

const createEmptyFileSlots = () => Array.from({ length: PHOTO_SLOTS_TOTAL }, () => null as File | null);

const sanitizePhotoUrls = (fotos: string[]) =>
  fotos
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .slice(0, PHOTO_SLOTS_TOTAL);

const toPhotoStorageValue = (value: string) => {
  const extracted = extractFilenameFromPhotoValue(value);
  return extracted.replace(/^\/+/, '').trim();
};

const emptySections: CnpjProdutoSections = {
  categories: [],
  brands: [],
  tags: [],
};

const normalizeSectionValues = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    )
  );
};

const normalizeSections = (sections: unknown): CnpjProdutoSections => {
  if (!sections || typeof sections !== 'object') return emptySections;

  const obj = sections as Partial<CnpjProdutoSections>;
  return {
    categories: normalizeSectionValues(obj.categories),
    brands: normalizeSectionValues(obj.brands),
    tags: normalizeSectionValues(obj.tags),
  };
};

type TaxonomyKey = keyof CnpjProdutoSections;

type BarcodeLookupPreview = {
  found: boolean;
  codigo_barras: string;
  nome_produto?: string | null;
  marca?: string | null;
  categoria?: string | null;
  tags?: string | null;
  ncm?: string | null;
  external_featured_image_url?: string | null;
  fonte_prioritaria?: 'banco_interno' | 'supernovaera' | null;
  consulta_log?: BarcodeLookupLog[];
};

const createInitialLookupLog = (barcode: string): BarcodeLookupLog[] => [
  {
    fonte: 'banco_interno',
    status: 'not_found',
    mensagem: 'Aguardando consulta no banco interno...',
  },
  {
    fonte: 'supernovaera',
    status: 'not_found',
    mensagem: 'Aguardando consulta no Supernovaera...',
    url: `https://www.supernovaera.com.br/${encodeURIComponent(barcode)}?_q=${encodeURIComponent(barcode)}&map=ft`,
  },
];

const normalizeCommaValues = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const removeCommaValue = (value: string, target: string) =>
  normalizeCommaValues(value)
    .filter((item) => item.toLowerCase() !== target.toLowerCase())
    .join(', ');

type StoreHighlightKey = 'nenhum' | 'lancamentos' | 'mais_vendidos' | 'ofertas';

const STORE_HIGHLIGHT_TAGS: Record<Exclude<StoreHighlightKey, 'nenhum'>, string> = {
  lancamentos: 'Lançamentos',
  mais_vendidos: 'Mais vendidos',
  ofertas: 'Ofertas',
};

const normalizeTextToken = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getStoreHighlightFromTags = (tagsValue: string): StoreHighlightKey => {
  const tags = normalizeCommaValues(tagsValue).map(normalizeTextToken);

  if (tags.some((tag) => tag === 'lancamentos' || tag === 'lancamento')) return 'lancamentos';
  if (tags.some((tag) => tag === 'mais vendidos' || tag === 'mais vendido')) return 'mais_vendidos';
  if (tags.some((tag) => tag === 'ofertas' || tag === 'oferta')) return 'ofertas';

  return 'nenhum';
};

const applyStoreHighlightTag = (tagsValue: string, highlight: StoreHighlightKey) => {
  const existingTags = normalizeCommaValues(tagsValue).filter((tag) => {
    const normalized = normalizeTextToken(tag);
    return !['lancamentos', 'lancamento', 'mais vendidos', 'mais vendido', 'ofertas', 'oferta'].includes(normalized);
  });

  if (highlight !== 'nenhum') {
    existingTags.push(STORE_HIGHLIGHT_TAGS[highlight]);
  }

  return Array.from(new Set(existingTags)).join(', ');
};

const getStoreHighlightLabelFromTags = (tagsValue?: string | null) => {
  const key = getStoreHighlightFromTags((tagsValue || '').toString());
  return key === 'nenhum' ? null : STORE_HIGHLIGHT_TAGS[key];
};

const CnpjProdutos = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const showManagementSection = location.pathname === '/dashboard/cnpj-gerenciamento-produtos';

  const [produtos, setProdutos] = useState<CnpjProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | ProdutoStatus>('todos');

  const [formData, setFormData] = useState<ProdutoFormData>(emptyForm);
  const [descricaoProdutoHtml, setDescricaoProdutoHtml] = useState('');
  const [productPhotos, setProductPhotos] = useState<string[]>(toPhotoSlots());
  const [pendingPhotoFiles, setPendingPhotoFiles] = useState<(File | null)[]>(createEmptyFileSlots());
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'form' | 'search'>('form');
  const [barcodeLookupState, setBarcodeLookupState] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle');
  const [barcodeLookupMessage, setBarcodeLookupMessage] = useState('');
  const [barcodeLookupPreview, setBarcodeLookupPreview] = useState<BarcodeLookupPreview | null>(null);
  const [barcodeLookupModalOpen, setBarcodeLookupModalOpen] = useState(false);
  const [editing, setEditing] = useState<CnpjProduto | null>(null);
  const [saving, setSaving] = useState(false);
  const [catalogVisibility, setCatalogVisibility] = useState<'loja_busca' | 'somente_loja' | 'somente_busca' | 'oculto'>('loja_busca');
  const [tagsProduto, setTagsProduto] = useState('');
  const [storeHighlight, setStoreHighlight] = useState<StoreHighlightKey>('nenhum');
  const [marcaProduto, setMarcaProduto] = useState('');
  const [externalFeaturedImageUrl, setExternalFeaturedImageUrl] = useState('');
  const [sectionOptions, setSectionOptions] = useState<CnpjProdutoSections>(emptySections);
  const [taxonomyOverrides, setTaxonomyOverrides] = useState<Partial<Record<TaxonomyKey, string[]>>>({});
  const [taxonomyModal, setTaxonomyModal] = useState<{ open: boolean; key: TaxonomyKey | null }>({ open: false, key: null });
  const [taxonomyInput, setTaxonomyInput] = useState('');
  const [taxonomyEditingIndex, setTaxonomyEditingIndex] = useState<number | null>(null);
  const [taxonomyParentCategory, setTaxonomyParentCategory] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<CnpjProduto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const userCnpj = formatCnpj(user?.cnpj || '');
  const userEmpresa = (user?.full_name || '').trim();

  const canUseUserCompanyData = userCnpj.replace(/\D/g, '').length === 14 && userEmpresa.length > 1;

  const loadProdutos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await cnpjProdutosService.list({
        limit: 200,
        offset: 0,
        search: search.trim() || undefined,
        status: statusFilter,
      });

      if (result.success && result.data) {
        const normalizedProducts = (result.data.data || []).map((produto) => ({
          ...produto,
          fotos: normalizeProductPhotos(produto.fotos, produto.fotos_json),
        }));
        setProdutos(normalizedProducts);
        setSectionOptions(normalizeSections(result.data.sections));
      } else {
        setProdutos([]);
        setSectionOptions(emptySections);
        if (result.error) toast.error(result.error);
      }
    } catch {
      setProdutos([]);
      setSectionOptions(emptySections);
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadProdutos();
  }, [loadProdutos]);

  const taxonomyLabels: Record<TaxonomyKey, string> = {
    categories: 'categorias',
    tags: 'tags',
    brands: 'marcas',
  };

  const getTaxonomyOptions = useCallback(
    (key: TaxonomyKey) => normalizeSectionValues(taxonomyOverrides[key] ?? sectionOptions[key]),
    [sectionOptions, taxonomyOverrides]
  );

  const sectionOptionsForForm = useMemo<CnpjProdutoSections>(
    () => ({
      categories: getTaxonomyOptions('categories'),
      tags: getTaxonomyOptions('tags'),
      brands: getTaxonomyOptions('brands'),
    }),
    [getTaxonomyOptions]
  );

  const activeTaxonomyKey = taxonomyModal.key;
  const activeTaxonomyOptions = useMemo(
    () => (activeTaxonomyKey ? getTaxonomyOptions(activeTaxonomyKey) : []),
    [activeTaxonomyKey, getTaxonomyOptions]
  );

  const taxonomyParentOptions = useMemo(
    () =>
      normalizeSectionValues([...PRODUCT_CATEGORIES, ...sectionOptionsForForm.categories]).filter(
        (item) => !item.includes('>')
      ),
    [sectionOptionsForForm.categories]
  );

  const closeTaxonomyModal = () => {
    setTaxonomyModal({ open: false, key: null });
    setTaxonomyInput('');
    setTaxonomyEditingIndex(null);
    setTaxonomyParentCategory('');
  };

  const openTaxonomyModal = (key: TaxonomyKey) => {
    setTaxonomyModal({ open: true, key });
    setTaxonomyInput('');
    setTaxonomyEditingIndex(null);
    setTaxonomyParentCategory('');
  };

  const handleTaxonomySubmit = () => {
    if (!activeTaxonomyKey) return;

    const value = taxonomyInput.trim();
    if (!value) return;

    const normalizedParent = taxonomyParentCategory.trim();
    const finalValue =
      activeTaxonomyKey === 'categories' && normalizedParent
        ? `${normalizedParent} > ${value}`
        : value;

    const duplicated = activeTaxonomyOptions.some(
      (item, index) => item.toLowerCase() === finalValue.toLowerCase() && index !== taxonomyEditingIndex
    );

    if (duplicated) {
      toast.error(`Essa ${taxonomyLabels[activeTaxonomyKey].slice(0, -1)} já existe.`);
      return;
    }

    const next = [...activeTaxonomyOptions];

    if (taxonomyEditingIndex === null) {
      next.push(finalValue);
    } else {
      next[taxonomyEditingIndex] = finalValue;
    }

    setTaxonomyOverrides((prev) => ({
      ...prev,
      [activeTaxonomyKey]: normalizeSectionValues(next),
    }));
    setTaxonomyInput('');
    setTaxonomyEditingIndex(null);
    setTaxonomyParentCategory('');
  };

  const handleTaxonomyEditStart = (index: number) => {
    const selected = activeTaxonomyOptions[index];
    if (!selected) return;
    setTaxonomyEditingIndex(index);
    setTaxonomyInput(selected);
    setTaxonomyParentCategory('');
  };

  const handleTaxonomyDelete = (index: number) => {
    if (!activeTaxonomyKey) return;

    const removed = activeTaxonomyOptions[index];
    if (!removed) return;

    const next = activeTaxonomyOptions.filter((_, itemIndex) => itemIndex !== index);

    setTaxonomyOverrides((prev) => ({
      ...prev,
      [activeTaxonomyKey]: normalizeSectionValues(next),
    }));

    if (taxonomyEditingIndex === index) {
      setTaxonomyEditingIndex(null);
      setTaxonomyInput('');
    }

    if (activeTaxonomyKey === 'categories' && formData.categoria?.toLowerCase() === removed.toLowerCase()) {
      setFormData((prev) => ({ ...prev, categoria: '' }));
    }

    if (activeTaxonomyKey === 'brands') {
      setMarcaProduto((prev) => removeCommaValue(prev, removed));
    }

    if (activeTaxonomyKey === 'tags') {
      setTagsProduto((prev) => removeCommaValue(prev, removed));
    }
  };

  const resetForm = () => {
    setFormData({
      ...emptyForm,
      cnpj: userCnpj,
      nome_empresa: userEmpresa,
      fotos: [],
    });
    setTagsProduto('');
    setStoreHighlight('nenhum');
    setMarcaProduto('');
    setExternalFeaturedImageUrl('');
    setDescricaoProdutoHtml('');
    setProductPhotos(toPhotoSlots());
    setPendingPhotoFiles(createEmptyFileSlots());
    setEditing(null);
  };

  useEffect(() => {
    if (editing) return;
    setFormData((prev) => ({
      ...prev,
      cnpj: userCnpj,
      nome_empresa: userEmpresa,
    }));
  }, [editing, userCnpj, userEmpresa]);

  const handleUploadPhotoSlot = async (slotIndex: number, file: File | null) => {
    if (!file) return;

    setPendingPhotoFiles((prev) => {
      const next = [...prev];
      next[slotIndex] = file;
      return next;
    });

    toast.success(`Foto ${slotIndex + 1} pronta para salvar`);
  };

  const handleSave = async () => {
    if (uploadingPhotos) {
      toast.error('Aguarde o envio das fotos terminar antes de salvar o produto');
      return;
    }

    if (!canUseUserCompanyData) {
      toast.error('Complete CNPJ e nome no menu Dados Pessoais antes de cadastrar produtos');
      return;
    }

    let finalPhotos = toPhotoSlots(productPhotos);
    const pendingEntries = pendingPhotoFiles
      .map((file, index) => ({ file, index }))
      .filter((entry): entry is { file: File; index: number } => entry.file instanceof File);

    if (pendingEntries.length > 0) {
      setUploadingPhotos(true);
      try {
        const uploaded = await Promise.all(
          pendingEntries.map(async ({ file, index }) => {
            const result = await cnpjProdutosService.uploadFoto(file);
            const persistedPhotoValue = (result.data?.filename || result.data?.url || '').trim();

            if (!result.success || !persistedPhotoValue) {
              throw new Error(result.error || `Falha ao enviar foto ${index + 1}`);
            }

            return { index, value: persistedPhotoValue };
          })
        );

        const merged = toPhotoSlots(productPhotos);
        uploaded.forEach(({ index, value }) => {
          merged[index] = value;
        });

        finalPhotos = merged;
        setProductPhotos(merged);
        setPendingPhotoFiles(createEmptyFileSlots());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao enviar fotos antes de salvar');
        return;
      } finally {
        setUploadingPhotos(false);
      }
    }

    const payload = {
      ...formData,
      cnpj: userCnpj,
      nome_empresa: userEmpresa,
      estoque: formData.controlar_estoque ? formData.estoque : 0,
      fotos: sanitizePhotoUrls(finalPhotos)
        .map(toPhotoStorageValue)
        .filter((value) => value.length > 0),
    };

    const parsed = produtoSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Dados inválidos');
      return;
    }

    setSaving(true);
    try {
      const normalizedTags = applyStoreHighlightTag(tagsProduto, storeHighlight);

      if (editing) {
        const result = await cnpjProdutosService.atualizar({
          id: editing.id,
          ...parsed.data,
          tags: normalizedTags,
          marca: marcaProduto,
          external_featured_image_url: externalFeaturedImageUrl,
          descricao_produto: descricaoProdutoHtml,
        });

        if (!result.success) {
          toast.error(result.error || 'Erro ao atualizar produto');
          return;
        }

        toast.success('Produto atualizado com sucesso');
      } else {
        const createPayload = {
          module_id: MODULE_ID,
          cnpj: parsed.data.cnpj,
          nome_empresa: parsed.data.nome_empresa,
          nome_produto: parsed.data.nome_produto,
          sku: parsed.data.sku,
          categoria: parsed.data.categoria,
          tags: normalizedTags,
          marca: marcaProduto,
          external_featured_image_url: externalFeaturedImageUrl,
          descricao_produto: descricaoProdutoHtml,
          codigo_barras: parsed.data.codigo_barras,
          controlar_estoque: parsed.data.controlar_estoque,
          fotos: parsed.data.fotos,
          preco: parsed.data.preco,
          estoque: parsed.data.estoque,
          status: parsed.data.status,
        };

        const result = await cnpjProdutosService.criar({
          ...createPayload,
        });

        if (!result.success) {
          toast.error(result.error || 'Erro ao cadastrar produto');
          return;
        }

        toast.success('Produto cadastrado com sucesso');
      }

      resetForm();
      await loadProdutos();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (produto: CnpjProduto) => {
    if (showManagementSection) {
      navigate('/dashboard/cnpj-produtos', {
        state: { editingProduct: produto },
      });
      return;
    }

    const normalizedPhotos = normalizeProductPhotos(produto.fotos, produto.fotos_json);
    const existingDescription =
      ((produto as CnpjProduto & { descricao_produto?: string; descricao?: string }).descricao_produto ||
        (produto as CnpjProduto & { descricao_produto?: string; descricao?: string }).descricao ||
        '')
        .toString();

    setEditing(produto);
    setFormData({
      cnpj: produto.cnpj,
      nome_empresa: produto.nome_empresa,
      nome_produto: produto.nome_produto,
      sku: produto.sku || '',
      categoria: produto.categoria || '',
      codigo_barras: produto.codigo_barras || '',
      controlar_estoque: produto.controlar_estoque === true || produto.controlar_estoque === 1,
      fotos: normalizedPhotos,
      preco: Number(produto.preco || 0),
      estoque: Number(produto.estoque || 0),
      status: produto.status,
    });
    setDescricaoProdutoHtml(existingDescription);
    setProductPhotos(toPhotoSlots(normalizedPhotos));
    setPendingPhotoFiles(createEmptyFileSlots());
    setTagsProduto((produto.tags || '').toString());
    setStoreHighlight(getStoreHighlightFromTags((produto.tags || '').toString()));
    setMarcaProduto((produto.marca || '').toString());
    setExternalFeaturedImageUrl((produto.external_featured_image_url || '').toString());

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (showManagementSection) return;

    const state = location.state as { editingProduct?: CnpjProduto } | null;
    const editingProduct = state?.editingProduct;
    if (!editingProduct) return;

    handleEdit(editingProduct);
    navigate('/dashboard/cnpj-produtos', { replace: true, state: null });
  }, [location.state, navigate, showManagementSection]);

  const selectedPhotosCount = useMemo(
    () =>
      productPhotos.reduce((count, photo, index) => {
        const hasRemotePhoto = photo.trim().length > 0;
        const hasPendingFile = pendingPhotoFiles[index] instanceof File;
        return count + (hasRemotePhoto || hasPendingFile ? 1 : 0);
      }, 0),
    [productPhotos, pendingPhotoFiles]
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await cnpjProdutosService.excluir(deleteTarget.id);
      if (!result.success) {
        toast.error(result.error || 'Erro ao excluir produto');
        return;
      }

      toast.success('Produto excluído com sucesso');
      setDeleteTarget(null);
      await loadProdutos();
    } finally {
      setDeleting(false);
    }
  };

  const openFormScanner = () => {
    setBarcodeLookupState('idle');
    setBarcodeLookupMessage('');
    setBarcodeLookupPreview(null);
    setBarcodeLookupModalOpen(false);
    setScannerTarget('form');
    setScannerOpen(true);
  };

  const openSearchScanner = () => {
    setScannerTarget('search');
    setScannerOpen(true);
  };

  const handleScannedBarcodeForForm = async (rawValue: string) => {
    const barcode = rawValue.replace(/\s+/g, '').trim();
    if (!barcode) return;

    setFormData((prev) => ({ ...prev, codigo_barras: barcode }));
    setBarcodeLookupState('loading');
    setBarcodeLookupMessage('Consultando banco interno e Supernovaera...');
    setBarcodeLookupPreview({
      found: false,
      codigo_barras: barcode,
      consulta_log: createInitialLookupLog(barcode),
    });
    setBarcodeLookupModalOpen(true);

    if (!canUseUserCompanyData) {
      setBarcodeLookupState('idle');
      setBarcodeLookupMessage('Código de barras capturado. Complete os dados manualmente.');
      toast.success('Código de barras capturado');
      return;
    }

    try {
      const startedAt = Date.now();
      const result = await cnpjProdutosService.consultarCodigoBarras(barcode);
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1200) {
        await new Promise((resolve) => setTimeout(resolve, 1200 - elapsed));
      }

      const normalizedPreview: BarcodeLookupPreview = {
        found: Boolean(result.data?.found),
        codigo_barras: result.data?.codigo_barras || barcode,
        nome_produto: result.data?.nome_produto || '',
        marca: result.data?.marca || '',
        categoria: result.data?.categoria || '',
        tags: result.data?.tags || '',
        ncm: result.data?.ncm || '',
        external_featured_image_url: result.data?.external_featured_image_url || '',
        fonte_prioritaria:
          result.data?.fonte_prioritaria === 'banco_interno' || result.data?.fonte_prioritaria === 'supernovaera'
            ? result.data.fonte_prioritaria
            : null,
        consulta_log: result.data?.consulta_log && result.data.consulta_log.length > 0
          ? result.data.consulta_log
          : createInitialLookupLog(barcode),
      };

      setBarcodeLookupPreview(normalizedPreview);

      if (!result.success || !result.data || !result.data.found) {
        setBarcodeLookupState('not_found');
        setBarcodeLookupMessage('Código capturado, mas nenhuma base retornou dados para este produto.');
        toast.success('Código capturado. Sem dados automáticos para este código.');
        return;
      }

      setBarcodeLookupState('found');
      setBarcodeLookupMessage('Consulta concluída. Revise os dados e o log no modal.');
      toast.success('Dados do produto encontrados.');
    } catch {
      setBarcodeLookupState('error');
      setBarcodeLookupMessage('Não foi possível consultar as bases agora. Continue o preenchimento manual.');
      setBarcodeLookupPreview((prev) => ({
        ...(prev || { found: false, codigo_barras: barcode }),
        consulta_log: [
          {
            fonte: 'banco_interno',
            status: 'error',
            mensagem: 'Falha ao consultar as fontes.',
          },
        ],
      }));
      toast.error('Falha ao consultar dados do código de barras.');
    }
  };

  const handleApplyBarcodeLookupData = () => {
    if (!barcodeLookupPreview) return;

    setFormData((prev) => ({
      ...prev,
      codigo_barras: barcodeLookupPreview.codigo_barras || prev.codigo_barras,
      nome_produto: barcodeLookupPreview.nome_produto?.trim() ? barcodeLookupPreview.nome_produto : prev.nome_produto,
      categoria: barcodeLookupPreview.categoria?.trim() ? barcodeLookupPreview.categoria : prev.categoria,
    }));

    if (barcodeLookupPreview.marca?.trim()) {
      setMarcaProduto(barcodeLookupPreview.marca);
    }

    if (barcodeLookupPreview.tags?.trim()) {
      setTagsProduto(barcodeLookupPreview.tags);
    }

    if (barcodeLookupPreview.external_featured_image_url?.trim()) {
      setExternalFeaturedImageUrl(barcodeLookupPreview.external_featured_image_url);
    }

    setBarcodeLookupModalOpen(false);
    toast.success('Dados aplicados ao cadastro do produto.');
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-1 sm:px-0 max-w-full overflow-x-hidden [&_label]:text-[13px] sm:[&_label]:text-sm [&_input]:text-sm [&_textarea]:text-sm">
      <SimpleTitleBar
        title="CNPJ Produtos"
        subtitle="Controle completo de produtos das empresas"
        useModuleMetadata={false}
        icon={<Package className="h-4 w-4 sm:h-5 sm:w-5" />}
        right={
          <>
            <Button variant="ghost" size="sm" onClick={loadProdutos} disabled={loading} className="h-8 w-8 p-0">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </>
        }
        onBack={() => navigate('/dashboard')}
      />

      {!showManagementSection ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px] gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg font-semibold tracking-tight">{editing ? 'Editar Produto' : 'Cadastro de Produto'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cnpj">CNPJ *</Label>
                <Input id="cnpj" value={formData.cnpj} readOnly disabled placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="empresa">Empresa *</Label>
                <Input id="empresa" value={formData.nome_empresa} readOnly disabled placeholder="Nome da empresa" />
              </div>
            </div>

            {!canUseUserCompanyData && (
              <p className="text-sm text-destructive">
                Preencha CNPJ e nome da empresa em Dados Pessoais para liberar o cadastro de produtos.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="codigo_barras">Código de barras</Label>
                <Input
                  id="codigo_barras"
                  value={formData.codigo_barras || ''}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, codigo_barras: e.target.value.replace(/\s+/g, '') }));
                    if (barcodeLookupState !== 'idle' || barcodeLookupMessage) {
                      setBarcodeLookupState('idle');
                      setBarcodeLookupMessage('');
                    }
                  }}
                  placeholder="Ex: 7891234567890"
                />
                {barcodeLookupMessage && (
                  <p className={`text-xs ${barcodeLookupState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {barcodeLookupMessage}
                  </p>
                )}
              </div>
              <Button type="button" variant="outline" className="w-full md:w-auto" onClick={openFormScanner} disabled={barcodeLookupState === 'loading'}>
                {barcodeLookupState === 'loading' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                {barcodeLookupState === 'loading' ? 'Buscando...' : 'Escanear'}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="produto">Produto *</Label>
                <Input id="produto" value={formData.nome_produto} onChange={(e) => setFormData((prev) => ({ ...prev, nome_produto: e.target.value }))} placeholder="Nome do produto" />
              </div>
            </div>

            <ProductDescriptionEditor
              value={descricaoProdutoHtml}
              onChange={setDescricaoProdutoHtml}
              disabled={saving || uploadingPhotos}
            />

            <ProductDataPanel
              value={{
                sku: formData.sku || '',
                codigo_barras: formData.codigo_barras || '',
                preco: formData.preco,
                estoque: formData.estoque,
                controlar_estoque: formData.controlar_estoque,
              }}
              onChange={(next) =>
                setFormData((prev) => ({
                  ...prev,
                  ...next,
                }))
              }
            />

            <div className="flex items-end gap-2">
              <Button onClick={handleSave} disabled={saving || uploadingPhotos} className="w-full md:w-auto">
                {uploadingPhotos
                  ? 'Enviando fotos...'
                  : saving
                    ? (editing ? 'Atualizando...' : 'Salvando...')
                    : editing
                      ? 'Atualizar produto'
                      : 'Cadastrar produto'}
              </Button>
              {editing && (
                <Button variant="outline" onClick={resetForm} disabled={saving}>
                  Cancelar
                </Button>
              )}
            </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base font-semibold tracking-tight">Publicar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value: ProdutoStatus) => setFormData((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Classificação da loja</Label>
                <Select value={storeHighlight} onValueChange={(value: StoreHighlightKey) => setStoreHighlight(value)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem destaque</SelectItem>
                    <SelectItem value="lancamentos">Lançamentos</SelectItem>
                    <SelectItem value="mais_vendidos">Mais vendidos</SelectItem>
                    <SelectItem value="ofertas">Ofertas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Visibilidade no catálogo</Label>
                <Select
                  value={catalogVisibility}
                  onValueChange={(value: 'loja_busca' | 'somente_loja' | 'somente_busca' | 'oculto') => setCatalogVisibility(value)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loja_busca">Loja e resultados de pesquisa</SelectItem>
                    <SelectItem value="somente_loja">Apenas na loja</SelectItem>
                    <SelectItem value="somente_busca">Apenas nos resultados de pesquisa</SelectItem>
                    <SelectItem value="oculto">Oculto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={handleSave} disabled={saving || uploadingPhotos}>
                  {editing ? 'Atualizar produto' : 'Salvar'}
                </Button>
                <Button variant="outline" onClick={resetForm} disabled={saving || uploadingPhotos}>
                  Salvar como rascunho
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base font-semibold tracking-tight">Imagem do produto</CardTitle>
            </CardHeader>
            <CardContent>
              {productPhotos[0] ? (
                <img src={productPhotos[0]} alt="Imagem principal do produto" loading="lazy" className="h-40 w-full rounded-md object-cover border" />
              ) : (
                <div className="h-40 w-full rounded-md border bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
                  Defina a primeira imagem na galeria abaixo
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base font-semibold tracking-tight">Galeria de imagens do produto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="fotos">Fotos do produto (até 5)</Label>
                <span className="text-xs text-muted-foreground">{selectedPhotosCount}/5</span>
              </div>
              <p className="text-xs text-muted-foreground">A primeira imagem enviada será usada como imagem principal do produto.</p>
              <ProductPhotoUploader
                key={editing ? `produto-fotos-${editing.id}` : 'produto-fotos-novo'}
                photos={productPhotos}
                uploading={uploadingPhotos}
                onUpload={handleUploadPhotoSlot}
                onRemove={(slotIndex) => {
                  setProductPhotos((prev) => {
                    const next = toPhotoSlots(prev);
                    next[slotIndex] = '';
                    return next;
                  });
                  setPendingPhotoFiles((prev) => {
                    const next = [...prev];
                    next[slotIndex] = null;
                    return next;
                  });
                }}
              />
              {uploadingPhotos && <p className="text-xs text-muted-foreground">Enviando foto...</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm sm:text-base font-semibold tracking-tight">Categorias de produto</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  aria-label="Gerenciar categorias"
                  title="Gerenciar categorias"
                  onClick={() => openTaxonomyModal('categories')}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ProductCategorySelector
                value={formData.categoria || ''}
                options={sectionOptionsForForm.categories}
                onChange={(category) => setFormData((prev) => ({ ...prev, categoria: category }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm sm:text-base font-semibold tracking-tight">Tags de produto</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  aria-label="Gerenciar tags"
                  title="Gerenciar tags"
                  onClick={() => openTaxonomyModal('tags')}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ProductTagSelector
                value={tagsProduto}
                suggestedTags={sectionOptionsForForm.tags}
                onChange={setTagsProduto}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm sm:text-base font-semibold tracking-tight">Marcas</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  aria-label="Gerenciar marcas"
                  title="Gerenciar marcas"
                  onClick={() => openTaxonomyModal('brands')}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ProductBrandSelector
                value={marcaProduto}
                options={sectionOptionsForForm.brands}
                onChange={setMarcaProduto}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base font-semibold tracking-tight">Imagem externa em destaque</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Label htmlFor="external-featured-image">URL da imagem</Label>
              <Input
                id="external-featured-image"
                type="url"
                value={externalFeaturedImageUrl}
                onChange={(e) => setExternalFeaturedImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </CardContent>
          </Card>
          </div>
        </div>
      ) : null}

      {showManagementSection ? (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <CardTitle className="text-base sm:text-lg font-semibold tracking-tight">Gerenciamento de Produtos</CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="relative">
                    <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por produto, empresa, SKU ou código"
                      className="pl-8 w-full sm:w-[280px] lg:w-[320px]"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={openSearchScanner} className="w-full sm:w-auto">
                    <ScanLine className="h-4 w-4" />
                    Escanear
                  </Button>
                  <Select value={statusFilter} onValueChange={(value: 'todos' | ProdutoStatus) => setStatusFilter(value)}>
                    <SelectTrigger className="w-full sm:w-[160px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => {
                      resetForm();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Novo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-w-full overflow-hidden">
              {loading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Carregando produtos...</div>
              ) : produtos.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</div>
              ) : (
                <>
                  <div className="lg:hidden space-y-3 p-3">
                    {produtos.map((produto) => {
                      const firstPhoto = normalizeProductPhotos(produto.fotos, produto.fotos_json)[0];

                      return (
                        <div key={produto.id} className="rounded-md border p-3 space-y-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {firstPhoto ? (
                              <img
                                src={firstPhoto}
                                alt={`Foto do produto ${produto.nome_produto}`}
                                loading="lazy"
                                className="h-14 w-14 rounded object-cover border shrink-0"
                              />
                            ) : (
                              <div className="h-14 w-14 rounded border bg-muted/40 flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
                                Sem foto
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{produto.nome_produto}</p>
                              <p className="text-xs text-muted-foreground truncate">{produto.nome_empresa}</p>
                              <p className="text-xs text-muted-foreground truncate">{produto.cnpj}</p>
                              <p className="text-xs text-muted-foreground truncate">{produto.sku || 'Sem SKU'}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded border p-2">
                              <p className="text-muted-foreground">Preço</p>
                              <p className="font-medium">R$ {Number(produto.preco).toFixed(2).replace('.', ',')}</p>
                            </div>
                            <div className="rounded border p-2">
                              <p className="text-muted-foreground">Estoque</p>
                              <p className="font-medium">{produto.controlar_estoque === true || produto.controlar_estoque === 1 ? produto.estoque : '—'}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <Badge variant={produto.status === 'ativo' ? 'default' : 'secondary'}>{statusLabel[produto.status]}</Badge>
                              {getStoreHighlightLabelFromTags(produto.tags) ? (
                                <Badge variant="outline">{getStoreHighlightLabelFromTags(produto.tags)}</Badge>
                              ) : null}
                            </div>
                            <div className="inline-flex items-center gap-1">
                              <Button variant="ghost" size="icon" asChild title="Abrir página de vendas">
                                <a href={`/vendas/produto/${produto.id}`} target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(produto)} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(produto)} title="Excluir">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden lg:block w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Foto</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Empresa / CNPJ</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Preço</TableHead>
                          <TableHead>Estoque</TableHead>
                          <TableHead>Classificação</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {produtos.map((produto) => {
                          const firstPhoto = normalizeProductPhotos(produto.fotos, produto.fotos_json)[0];

                          return (
                            <TableRow key={produto.id}>
                              <TableCell>
                                {firstPhoto ? (
                                  <img
                                    src={firstPhoto}
                                    alt={`Foto do produto ${produto.nome_produto}`}
                                    loading="lazy"
                                    className="h-12 w-12 rounded object-cover border"
                                  />
                                ) : (
                                  <div className="h-12 w-12 rounded border bg-muted/40 flex items-center justify-center text-[10px] text-muted-foreground">
                                    Sem foto
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">#{produto.id}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{produto.nome_empresa}</span>
                                  <span className="text-xs text-muted-foreground">{produto.cnpj}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{produto.nome_produto}</span>
                                  <span className="text-xs text-muted-foreground">{produto.sku || 'Sem SKU'}</span>
                                  <span className="text-xs text-muted-foreground">{produto.codigo_barras || 'Sem código de barras'}</span>
                                </div>
                              </TableCell>
                              <TableCell>R$ {Number(produto.preco).toFixed(2).replace('.', ',')}</TableCell>
                              <TableCell>{produto.controlar_estoque === true || produto.controlar_estoque === 1 ? produto.estoque : '—'}</TableCell>
                              <TableCell>{getStoreHighlightLabelFromTags(produto.tags) || '—'}</TableCell>
                              <TableCell>
                                <Badge variant={produto.status === 'ativo' ? 'default' : 'secondary'}>{statusLabel[produto.status]}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-1">
                                  <Button variant="ghost" size="icon" asChild title="Abrir página de vendas">
                                    <a href={`/vendas/produto/${produto.id}`} target="_blank" rel="noreferrer">
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleEdit(produto)} title="Editar">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(produto)} title="Excluir">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

        </>
      ) : null}

      <Dialog
        open={taxonomyModal.open}
        onOpenChange={(open) => {
          if (!open) {
            closeTaxonomyModal();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Gerenciar {activeTaxonomyKey ? taxonomyLabels[activeTaxonomyKey] : 'taxonomia'}
            </DialogTitle>
            <DialogDescription>
              Adicione, edite ou exclua {activeTaxonomyKey ? taxonomyLabels[activeTaxonomyKey] : 'itens'} para usar neste cadastro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {activeTaxonomyKey === 'categories' && (
              <div className="space-y-1.5">
                <Label>Categoria pai (opcional)</Label>
                <Select
                  value={taxonomyParentCategory || 'none'}
                  onValueChange={(value) => setTaxonomyParentCategory(value === 'none' ? '' : value)}
                  disabled={taxonomyEditingIndex !== null}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem categoria pai" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria pai</SelectItem>
                    {taxonomyParentOptions.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Se selecionar categoria pai, o sistema criará no formato: Categoria &gt; Subcategoria.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input
                value={taxonomyInput}
                onChange={(e) => setTaxonomyInput(e.target.value)}
                placeholder={
                  activeTaxonomyKey === 'categories' && taxonomyParentCategory
                    ? 'Nome da subcategoria'
                    : `Nome da ${activeTaxonomyKey ? taxonomyLabels[activeTaxonomyKey].slice(0, -1) : 'opção'}`
                }
              />
              <Button type="button" onClick={handleTaxonomySubmit} disabled={!taxonomyInput.trim()}>
                {taxonomyEditingIndex === null ? 'Adicionar' : 'Salvar'}
              </Button>
            </div>

            {activeTaxonomyOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item cadastrado ainda.</p>
            ) : (
              <ul className="space-y-1 overflow-visible rounded-md border border-border p-2 md:max-h-64 md:overflow-y-auto" role="list">
                {activeTaxonomyOptions.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5">
                    <span className="min-w-0 text-sm break-words">{item}</span>
                    <div className="inline-flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" title="Editar" onClick={() => handleTaxonomyEditStart(index)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" title="Excluir" onClick={() => handleTaxonomyDelete(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {taxonomyEditingIndex !== null && (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTaxonomyEditingIndex(null);
                  setTaxonomyInput('');
                }}
              >
                Cancelar edição
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir produto</DialogTitle>
            <DialogDescription>
              Essa ação vai remover o produto da listagem ativa. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">{deleteTarget?.nome_produto}</div>
            <div className="text-muted-foreground">{deleteTarget?.nome_empresa}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Confirmar exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={barcodeLookupModalOpen} onOpenChange={setBarcodeLookupModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados encontrados por código de barras</DialogTitle>
            <DialogDescription>
              1ª tentativa no banco interno, depois consulta externa no Supernovaera.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {barcodeLookupState === 'loading' && (
              <div className="rounded-md border p-3 text-sm text-muted-foreground flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Coletando dados nas fontes, aguarde...
              </div>
            )}

            {barcodeLookupPreview?.external_featured_image_url ? (
              <img
                src={barcodeLookupPreview.external_featured_image_url}
                alt={barcodeLookupPreview.nome_produto || 'Imagem do produto encontrado'}
                loading="lazy"
                className="h-40 w-full rounded-md border object-contain bg-muted/20"
              />
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">Código de barras</p>
                <p className="font-medium break-all">{barcodeLookupPreview?.codigo_barras || '—'}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">NCM</p>
                <p className="font-medium">{barcodeLookupPreview?.ncm || 'Não informado'}</p>
              </div>
              <div className="rounded-md border p-2 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Nome do produto</p>
                <p className="font-medium">{barcodeLookupPreview?.nome_produto || 'Não informado'}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">Marca</p>
                <p className="font-medium">{barcodeLookupPreview?.marca || 'Não informado'}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">Categoria</p>
                <p className="font-medium">{barcodeLookupPreview?.categoria || 'Não informado'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Log das consultas</p>
              <div className="rounded-md border p-2 space-y-2 max-h-48 overflow-y-auto">
                {(barcodeLookupPreview?.consulta_log || []).map((log, index) => (
                  <div key={`${log.fonte}-${index}`} className="rounded border p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{log.fonte}</span>
                      <span className="text-muted-foreground">
                        {log.status} {typeof log.tempo_ms === 'number' ? `• ${log.tempo_ms}ms` : ''}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{log.mensagem}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBarcodeLookupModalOpen(false)}>
              Continuar manualmente
            </Button>
            <Button onClick={handleApplyBarcodeLookupData} disabled={barcodeLookupState === 'loading' || !barcodeLookupPreview?.found}>
              Aplicar dados no formulário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ler código de barras</DialogTitle>
            <DialogDescription>
              {scannerTarget === 'search'
                ? 'Use a câmera para escanear e preencher automaticamente a busca de produtos.'
                : 'Use a webcam ou câmera do celular para escanear e preencher automaticamente o campo.'}
            </DialogDescription>
          </DialogHeader>

          <BarcodeScanner
            enabled={scannerOpen}
            onDetected={(value) => {
              if (scannerTarget === 'search') {
                setSearch(value);
                toast.success('Código aplicado na busca');
              } else {
                void handleScannedBarcodeForForm(value);
              }
              setScannerOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CnpjProdutos;
