import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import SimpleTitleBar from '@/components/dashboard/SimpleTitleBar';
import { ShoppingBag, Star, Eye, Pencil, Trash2, RefreshCw, Package, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cnpjProdutosService, type CnpjProduto } from '@/services/cnpjProdutosService';
import { normalizeProductPhotos, splitStoreSections, STORE_HIGHLIGHT_LABELS, getHighlightFromTags } from '@/components/cnpj-loja/storefrontUtils';
import { toast } from 'sonner';
import { useApiModules } from '@/hooks/useApiModules';

const formatPrice = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const getDiscountByHighlight = (highlight: ReturnType<typeof getHighlightFromTags>) => {
  if (highlight === 'ofertas') return 15;
  if (highlight === 'mais_vendidos') return 10;
  return 0;
};

const getInstallments = (price: number) => {
  if (price >= 400) return 8;
  if (price >= 250) return 6;
  if (price >= 160) return 4;
  return 2;
};

const isValidHttpUrl = (value: string) => {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const PIX_TYPES = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'] as const;

type StoreFormData = {
  store_name: string;
  description: string;
  website: string;
  logo_url: string;
  whatsapp: string;
  instagram: string;
  pix_enabled: boolean;
  pix_key_type: '' | (typeof PIX_TYPES)[number];
  pix_key: string;
  pix_instructions: string;
};

const initialStoreForm: StoreFormData = {
  store_name: '',
  description: '',
  website: '',
  logo_url: '',
  whatsapp: '',
  instagram: '',
  pix_enabled: true,
  pix_key_type: '',
  pix_key: '',
  pix_instructions: '',
};

const storeConfigSchema = z
  .object({
    store_name: z.string().trim().min(2, 'Informe o nome da loja').max(120, 'Máximo de 120 caracteres'),
    description: z.string().trim().max(500, 'Máximo de 500 caracteres').optional().or(z.literal('')),
    website: z
      .string()
      .trim()
      .max(2048, 'Website inválido')
      .optional()
      .or(z.literal(''))
      .refine((value) => isValidHttpUrl(value || ''), 'Informe uma URL válida iniciando com http:// ou https://'),
    logo_url: z
      .string()
      .trim()
      .max(2048, 'URL da logo inválida')
      .optional()
      .or(z.literal(''))
      .refine((value) => isValidHttpUrl(value || ''), 'Informe uma URL válida iniciando com http:// ou https://'),
    whatsapp: z
      .string()
      .trim()
      .max(20, 'WhatsApp inválido')
      .optional()
      .or(z.literal(''))
      .refine((value) => {
        const digits = (value || '').replace(/\D+/g, '');
        return !digits || (digits.length >= 10 && digits.length <= 13);
      }, 'WhatsApp deve ter entre 10 e 13 dígitos (com DDD)'),
    instagram: z
      .string()
      .trim()
      .max(60, 'Instagram inválido')
      .optional()
      .or(z.literal(''))
      .refine((value) => !value || /^@?[a-zA-Z0-9._]+$/.test(value), 'Usuário do Instagram inválido'),
    pix_enabled: z.boolean(),
    pix_key_type: z.enum(PIX_TYPES).optional().or(z.literal('')),
    pix_key: z.string().trim().max(255, 'Chave PIX inválida').optional().or(z.literal('')),
    pix_instructions: z.string().trim().max(240, 'Máximo de 240 caracteres').optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (!data.pix_enabled) return;

    if (!data.pix_key_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pix_key_type'],
        message: 'Selecione o tipo de chave PIX',
      });
      return;
    }

    const key = (data.pix_key || '').trim();
    if (!key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pix_key'],
        message: 'Informe a chave PIX',
      });
      return;
    }

    const digits = key.replace(/\D+/g, '');
    const isValidByType =
      (data.pix_key_type === 'cpf' && digits.length === 11) ||
      (data.pix_key_type === 'cnpj' && digits.length === 14) ||
      (data.pix_key_type === 'email' && z.string().email().safeParse(key).success) ||
      (data.pix_key_type === 'telefone' && digits.length >= 10 && digits.length <= 13) ||
      (data.pix_key_type === 'aleatoria' && /^[a-zA-Z0-9-]{20,80}$/.test(key));

    if (!isValidByType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pix_key'],
        message: 'Chave PIX inválida para o tipo selecionado',
      });
    }
  });

const CnpjLoja = () => {
  const MODULE_ID = 184;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { modules } = useApiModules();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [produtos, setProdutos] = useState<CnpjProduto[]>([]);
  const [storeForm, setStoreForm] = useState<StoreFormData>(initialStoreForm);
  const [savingConfig, setSavingConfig] = useState(false);

  const currentModule = useMemo(
    () => modules.find((module) => Number(module.id) === MODULE_ID) || null,
    [modules]
  );

  const loadProdutos = useCallback(async () => {
    setLoading(true);
    setError('');

    const result = await cnpjProdutosService.list({
      limit: 200,
      offset: 0,
      cnpj: user?.cnpj || undefined,
      status: 'ativo',
    });

    if (!result.success || !result.data) {
      setProdutos([]);
      setError(result.error || 'Não foi possível carregar sua loja.');
      setLoading(false);
      return;
    }

    setProdutos(result.data.data || []);
    setLoading(false);
  }, [user?.cnpj]);

  const loadStoreConfig = useCallback(async () => {
    const result = await cnpjProdutosService.obterConfiguracaoLoja();
    if (!result.success || !result.data) {
      return;
    }

    const config = result.data.configuracao || {};
    setStoreForm({
      store_name: config.store_name || result.data.empresa?.nome_empresa || user?.full_name || '',
      description: config.description || '',
      website: config.website || '',
      logo_url: config.logo_url || '',
      whatsapp: config.whatsapp || '',
      instagram: config.instagram || '',
      pix_enabled: Boolean(config.pix_enabled),
      pix_key_type: (config.pix_key_type as StoreFormData['pix_key_type']) || '',
      pix_key: config.pix_key || '',
      pix_instructions: config.pix_instructions || '',
    });
  }, [user?.full_name]);

  useEffect(() => {
    const loadPageData = async () => {
      await Promise.all([loadProdutos(), loadStoreConfig()]);
    };

    void loadPageData();
  }, [loadProdutos, loadStoreConfig]);

  const sections = useMemo(() => splitStoreSections(produtos), [produtos]);

  const handleOpenOnlineStore = () => {
    const cnpjDigits = (user?.cnpj || '').replace(/\D+/g, '');
    if (cnpjDigits.length !== 14) {
      toast.error('Preencha um CNPJ válido em Dados Pessoais para abrir sua loja online.');
      return;
    }

    window.open(`/vendas/loja/${cnpjDigits}`, '_blank', 'noopener,noreferrer');
  };

  const handleSaveStoreConfig = async () => {
    const parsed = storeConfigSchema.safeParse(storeForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Verifique os dados da loja');
      return;
    }

    setSavingConfig(true);
    try {
      const result = await cnpjProdutosService.salvarConfiguracaoLoja({
        store_name: parsed.data.store_name,
        description: parsed.data.description || '',
        website: parsed.data.website || '',
        logo_url: parsed.data.logo_url || '',
        whatsapp: parsed.data.whatsapp || '',
        instagram: parsed.data.instagram ? parsed.data.instagram.replace('@', '') : '',
        pix_enabled: parsed.data.pix_enabled,
        pix_key_type: parsed.data.pix_key_type || '',
        pix_key: parsed.data.pix_key || '',
        pix_instructions: parsed.data.pix_instructions || '',
      });

      if (!result.success) {
        toast.error(result.error || 'Não foi possível salvar a configuração da loja');
        return;
      }

      toast.success('Configuração da loja salva com sucesso');
      await loadStoreConfig();
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDeleteFromCard = async (produto: CnpjProduto) => {
    const confirmed = window.confirm(`Deseja excluir o produto \"${produto.nome_produto}\"?`);
    if (!confirmed) return;

    const result = await cnpjProdutosService.excluir(produto.id);
    if (!result.success) {
      toast.error(result.error || 'Não foi possível excluir o produto.');
      return;
    }

    setProdutos((prev) => prev.filter((item) => item.id !== produto.id));
    toast.success('Produto excluído com sucesso.');
  };

  const renderSection = (title: string, items: CnpjProduto[]) => {
    if (items.length === 0) return null;

    return (
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/cnpj-gerenciamento-produtos')}>
            Gerenciar
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          {items.map((produto) => {
            const image = normalizeProductPhotos(produto)[0] || '';
            const highlight = getHighlightFromTags(produto.tags);
            const discountPercent = getDiscountByHighlight(highlight);
            const pixPrice = discountPercent > 0 ? produto.preco * (1 - discountPercent / 100) : produto.preco;
            const installments = getInstallments(produto.preco);
            const installmentValue = produto.preco / installments;

            return (
              <Card key={produto.id} className="h-full overflow-hidden rounded-2xl border-border/60 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10">
                <CardContent className="p-0">
                  <div className="group w-full">
                    <div className="relative">
                      {image ? (
                        <img
                          src={image}
                          alt={`Imagem do produto ${produto.nome_produto}`}
                          loading="lazy"
                          className="h-40 w-full border-b border-border/60 object-cover transition-transform duration-300 group-hover:scale-[1.02] sm:h-44"
                        />
                      ) : (
                        <div className="flex h-40 w-full items-center justify-center border-b border-border/60 bg-muted/40 text-xs text-muted-foreground sm:h-44">
                          Sem imagem
                        </div>
                      )}

                      <Badge variant="secondary" className="absolute left-2 top-2 max-w-[62%] truncate text-[10px] shadow-sm">
                        {produto.categoria || 'Sem categoria'}
                      </Badge>

                      <div className="absolute right-2 top-2 flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8 rounded-full shadow-sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            window.open(`/vendas/produto/${produto.id}`, '_blank', 'noopener,noreferrer');
                          }}
                          aria-label={`Visualizar página pública de ${produto.nome_produto}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8 rounded-full shadow-sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate('/dashboard/cnpj-produtos', {
                              state: { editingProduct: produto },
                            });
                          }}
                          aria-label={`Editar ${produto.nome_produto}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8 rounded-full shadow-sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteFromCard(produto);
                          }}
                          aria-label={`Excluir ${produto.nome_produto}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {highlight ? (
                        <Badge className="absolute left-2 top-10 bg-primary text-primary-foreground">
                          {STORE_HIGHLIGHT_LABELS[highlight]}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex h-full flex-col gap-2.5 p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star key={idx} className="h-2.5 w-2.5" />
                        ))}
                        <span>0.0 (0)</span>
                      </div>
                    </div>

                    <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight">{produto.nome_produto}</h3>

                    {discountPercent > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground line-through">{formatPrice(produto.preco)}</span>
                        <Badge variant="outline" className="text-xs">{discountPercent}%</Badge>
                      </div>
                    ) : null}

                    <p className="text-base font-bold text-foreground sm:text-lg">{formatPrice(pixPrice)} no Pix</p>

                    <p className="line-clamp-2 min-h-[2rem] text-[11px] leading-relaxed text-muted-foreground">
                      em {installments}x de {formatPrice(installmentValue)} sem juros no cartão de crédito
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-1 sm:px-0">
      <SimpleTitleBar
        title={currentModule?.title?.toString().trim() || 'Loja Virtual CNPJ'}
        subtitle={
          currentModule?.description?.toString().trim() ||
          'Vitrine da sua empresa com produtos para venda'
        }
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

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Modelo da loja</p>
            <h1 className="text-xl font-semibold tracking-tight">Sua loja online pronta para vender</h1>
            <p className="text-sm text-muted-foreground">Destaque lançamentos, produtos mais vendidos e ofertas com atualização automática.</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
            <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard/cnpj-gerenciamento-produtos')}>Gerenciar produtos</Button>
            <Button className="w-full" onClick={handleOpenOnlineStore}>
              <ShoppingBag className="h-4 w-4" />
              Loja Online
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuração da loja pública</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="store-name">Nome da loja</Label>
              <Input
                id="store-name"
                value={storeForm.store_name}
                onChange={(e) => setStoreForm((prev) => ({ ...prev, store_name: e.target.value }))}
                placeholder="Ex.: Minha Loja Virtual"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="store-website">Website (opcional)</Label>
              <Input
                id="store-website"
                value={storeForm.website}
                onChange={(e) => setStoreForm((prev) => ({ ...prev, website: e.target.value }))}
                placeholder="https://sualoja.com.br"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="store-description">Descrição da loja</Label>
              <Textarea
                id="store-description"
                value={storeForm.description}
                onChange={(e) => setStoreForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva sua loja, nicho e diferenciais"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="store-logo">URL da logo (opcional)</Label>
              <Input
                id="store-logo"
                value={storeForm.logo_url}
                onChange={(e) => setStoreForm((prev) => ({ ...prev, logo_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="store-whatsapp">WhatsApp para contato</Label>
              <Input
                id="store-whatsapp"
                value={storeForm.whatsapp}
                onChange={(e) => setStoreForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="store-instagram">Instagram (opcional)</Label>
              <Input
                id="store-instagram"
                value={storeForm.instagram}
                onChange={(e) => setStoreForm((prev) => ({ ...prev, instagram: e.target.value }))}
                placeholder="@minhaloja"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Pagamento por PIX</h3>
                <p className="text-xs text-muted-foreground">Ative para exibir sua chave PIX na página pública da loja.</p>
              </div>
              <Switch
                checked={storeForm.pix_enabled}
                onCheckedChange={(checked) => setStoreForm((prev) => ({ ...prev, pix_enabled: checked }))}
              />
            </div>

            {storeForm.pix_enabled ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Tipo da chave PIX</Label>
                  <Select
                    value={storeForm.pix_key_type || 'none'}
                    onValueChange={(value) => setStoreForm((prev) => ({ ...prev, pix_key_type: value === 'none' ? '' : (value as StoreFormData['pix_key_type']) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione</SelectItem>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="aleatoria">Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pix-key">Chave PIX</Label>
                  <Input
                    id="pix-key"
                    value={storeForm.pix_key}
                    onChange={(e) => setStoreForm((prev) => ({ ...prev, pix_key: e.target.value }))}
                    placeholder="Digite sua chave"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="pix-instructions">Instruções PIX (opcional)</Label>
                  <Textarea
                    id="pix-instructions"
                    value={storeForm.pix_instructions}
                    onChange={(e) => setStoreForm((prev) => ({ ...prev, pix_instructions: e.target.value }))}
                    rows={2}
                    placeholder="Ex.: Após o pagamento, envie o comprovante no WhatsApp"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={loadStoreConfig} disabled={savingConfig}>
              Recarregar
            </Button>
            <Button onClick={handleSaveStoreConfig} disabled={savingConfig}>
              <Save className="h-4 w-4" />
              {savingConfig ? 'Salvando...' : 'Salvar configuração'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[280px] w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : sections.todos.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Nenhum produto ativo encontrado para a loja.</CardContent>
        </Card>
      ) : (
        <>
          {renderSection('Lançamentos', sections.lancamentos)}
          {renderSection('Mais vendidos', sections.maisVendidos)}
          {renderSection('Ofertas', sections.ofertas)}
        </>
      )}
    </div>
  );
};

export default CnpjLoja;
