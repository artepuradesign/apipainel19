import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingCart, Store, Eye, Copy, MessageCircle, QrCode } from 'lucide-react';
import { cnpjProdutosService, type CnpjProduto } from '@/services/cnpjProdutosService';
import { normalizeProductPhotos, splitStoreSections, STORE_HIGHLIGHT_LABELS, getHighlightFromTags } from '@/components/cnpj-loja/storefrontUtils';
import { toast } from 'sonner';

const formatPrice = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

const VendaLoja = () => {
  const { cnpj } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [empresa, setEmpresa] = useState<{ nome_empresa?: string | null; cnpj?: string | null; avatar_url?: string | null } | null>(null);
  const [produtos, setProdutos] = useState<CnpjProduto[]>([]);
  const [configuracao, setConfiguracao] = useState<{
    store_name?: string | null;
    description?: string | null;
    website?: string | null;
    whatsapp?: string | null;
    pix_enabled?: boolean;
    pix_key_type?: string | null;
    pix_key?: string | null;
    pix_instructions?: string | null;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      const digits = (cnpj || '').replace(/\D+/g, '');
      if (digits.length !== 14) {
        setError('CNPJ inválido para a loja pública.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const result = await cnpjProdutosService.lojaPublica(digits);
      if (!result.success || !result.data) {
        setError(result.error || 'Não foi possível carregar a loja pública.');
        setLoading(false);
        return;
      }

      setEmpresa(result.data.empresa);
      setConfiguracao(result.data.configuracao || null);
      setProdutos(result.data.produtos || []);
      setLoading(false);
    };

    void load();
  }, [cnpj]);

  const sections = useMemo(() => splitStoreSections(produtos), [produtos]);

  const handleCopyPix = async () => {
    const pixKey = configuracao?.pix_key?.trim();
    if (!pixKey) return;

    try {
      await navigator.clipboard.writeText(pixKey);
      toast.success('Chave PIX copiada');
    } catch {
      toast.error('Não foi possível copiar a chave PIX');
    }
  };

  const renderSection = (title: string, items: CnpjProduto[]) => {
    if (items.length === 0) return null;

    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight md:text-2xl">{title}</h2>
          <Badge variant="secondary" className="text-xs">{items.length} produtos</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {items.map((produto) => {
            const image = normalizeProductPhotos(produto)[0] || '';
            const highlight = getHighlightFromTags(produto.tags);

            return (
              <Card key={produto.id} className="group overflow-hidden border-border/60 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="p-0">
                  <div className="relative">
                    {image ? (
                      <img
                        src={image}
                        alt={`Imagem do produto ${produto.nome_produto}`}
                        className="h-36 w-full border-b border-border/60 object-cover transition-transform duration-300 group-hover:scale-[1.02] sm:h-40"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center border-b border-border/60 bg-muted/40 text-xs text-muted-foreground sm:h-40">
                        Sem imagem
                      </div>
                    )}

                    {highlight ? (
                      <Badge className="absolute left-2 top-2 bg-primary text-primary-foreground">
                        {STORE_HIGHLIGHT_LABELS[highlight]}
                      </Badge>
                    ) : null}

                    <Button asChild size="icon" variant="secondary" className="absolute right-2 top-2 h-8 w-8 rounded-full shadow-sm">
                      <Link to={`/vendas/produto/${produto.id}`} aria-label={`Ver ${produto.nome_produto}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>

                  <div className="space-y-2 p-3">
                    <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight">{produto.nome_produto}</h3>
                    <p className="text-lg font-bold text-foreground">{formatPrice(produto.preco)}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{produto.categoria || 'Sem categoria'} • {produto.marca || 'Sem marca'}</p>
                    <Button asChild className="h-8 w-full text-xs" size="sm">
                      <Link to={`/vendas/produto/${produto.id}`}>
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Ver produto
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    );
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-6 md:py-10">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <Skeleton key={idx} className="h-[230px] w-full rounded-xl" />
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto max-w-4xl px-4 py-12 md:px-6">
          <Card>
            <CardContent className="space-y-3 p-6">
              <h1 className="text-xl font-semibold">Loja indisponível</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-7xl space-y-8 overflow-x-hidden px-4 py-8 md:px-6 md:py-10">
        <header className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              {empresa?.avatar_url ? (
                <img src={empresa.avatar_url} alt={`Logomarca da empresa ${empresa?.nome_empresa || 'Loja'}`} className="h-14 w-14 rounded-xl border border-border bg-background object-cover" loading="lazy" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted">
                  <Store className="h-6 w-6 text-muted-foreground" />
                </div>
              )}

              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{empresa?.nome_empresa || 'Loja Online'}</h1>
                <p className="break-all text-sm text-muted-foreground">CNPJ {empresa?.cnpj || '--'} • Catálogo público da empresa</p>
                {configuracao?.description ? (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{configuracao.description}</p>
                ) : null}
              </div>
            </div>

            <Badge variant="outline" className="w-fit">{sections.todos.length} produtos ativos</Badge>
          </div>

          {(configuracao?.pix_enabled && configuracao?.pix_key) || configuracao?.whatsapp || configuracao?.website ? (
            <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-3">
              {configuracao?.pix_enabled && configuracao?.pix_key ? (
                <Card className="border-border/60">
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <QrCode className="h-4 w-4" />
                      Pagamento via PIX
                    </div>
                    <p className="text-xs text-muted-foreground break-all">{configuracao.pix_key}</p>
                    {configuracao?.pix_instructions ? (
                      <p className="text-xs text-muted-foreground">{configuracao.pix_instructions}</p>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" className="w-full" onClick={handleCopyPix}>
                      <Copy className="h-3.5 w-3.5" />
                      Copiar chave PIX
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {configuracao?.whatsapp ? (
                <Card className="border-border/60">
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <MessageCircle className="h-4 w-4" />
                      Atendimento
                    </div>
                    <p className="text-xs text-muted-foreground">WhatsApp: {configuracao.whatsapp}</p>
                    <Button asChild size="sm" variant="outline" className="w-full">
                      <a
                        href={`https://wa.me/${configuracao.whatsapp.replace(/\D+/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Chamar no WhatsApp
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {configuracao?.website ? (
                <Card className="border-border/60">
                  <CardContent className="space-y-2 p-3">
                    <div className="text-sm font-semibold">Site oficial</div>
                    <p className="text-xs text-muted-foreground line-clamp-2 break-all">{configuracao.website}</p>
                    <Button asChild size="sm" variant="outline" className="w-full">
                      <a href={configuracao.website} target="_blank" rel="noreferrer">Acessar website</a>
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}
        </header>

        {sections.todos.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Esta loja ainda não possui produtos ativos no momento.</CardContent>
          </Card>
        ) : (
          <>
            {renderSection('Lançamentos', sections.lancamentos)}
            {renderSection('Mais vendidos', sections.maisVendidos)}
            {renderSection('Ofertas', sections.ofertas)}
          </>
        )}
      </section>
    </main>
  );
};

export default VendaLoja;