import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type ProductType = 'simple' | 'grouped' | 'external' | 'variable';
type ProductDataTab = 'geral' | 'estoque' | 'entrega' | 'relacionados' | 'atributos' | 'avancado';
type BackordersMode = 'no' | 'notify' | 'yes';
type StockStatus = 'instock' | 'outofstock' | 'onbackorder';

type ProductAttribute = {
  id: number;
  name: string;
  values: string;
  visible: boolean;
  variation: boolean;
};

type ProductDataValues = {
  sku: string;
  codigo_barras: string;
  preco: number;
  estoque: number;
  controlar_estoque: boolean;
};

type ProductDataPanelProps = {
  value: ProductDataValues;
  onChange: (next: Partial<ProductDataValues>) => void;
};

const tabs: { id: ProductDataTab; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'entrega', label: 'Entrega' },
  { id: 'relacionados', label: 'Produtos relacionados' },
  { id: 'atributos', label: 'Atributos' },
  { id: 'avancado', label: 'Avançado' },
];

export default function ProductDataPanel({ value, onChange }: ProductDataPanelProps) {
  const [productType, setProductType] = useState<ProductType>('simple');
  const [activeTab, setActiveTab] = useState<ProductDataTab>('geral');
  const [isVirtual, setIsVirtual] = useState(false);
  const [isDownloadable, setIsDownloadable] = useState(false);
  const [backordersMode, setBackordersMode] = useState<BackordersMode>('no');
  const [stockStatus, setStockStatus] = useState<StockStatus>('instock');
  const [soldIndividually, setSoldIndividually] = useState(false);
  const [reviewsEnabled, setReviewsEnabled] = useState(true);
  const [visibleInPos, setVisibleInPos] = useState(true);
  const [attributes, setAttributes] = useState<ProductAttribute[]>([
    { id: 1, name: '', values: '', visible: true, variation: false },
  ]);

  return (
    <div className="rounded-md border border-input bg-card [&_label]:text-[13px] sm:[&_label]:text-sm [&_input]:text-sm [&_textarea]:text-sm [&_select]:text-sm [&_legend]:text-[13px] sm:[&_legend]:text-sm">
      <div className="border-b border-border px-4 py-3 space-y-3">
        <Label className="text-sm font-semibold tracking-tight">Dados do produto</Label>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="product-type">Tipo de produto</Label>
            <select
              id="product-type"
              value={productType}
              onChange={(event) => setProductType(event.target.value as ProductType)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="simple">Produto simples</option>
              <option value="grouped">Grupo de produto</option>
              <option value="external">Produto externo/afiliado</option>
              <option value="variable">Produto variável</option>
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={isVirtual}
              onChange={(event) => setIsVirtual(event.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Virtual
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={isDownloadable}
              onChange={(event) => setIsDownloadable(event.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Baixável
          </label>
        </div>
      </div>

      <div className="border-b border-border px-3 pt-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className={cn('h-8 text-[13px] sm:text-sm', activeTab === tab.id && 'bg-muted text-foreground')}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {activeTab === 'geral' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="regular_price">Preço (R$)</Label>
                <Input
                  id="regular_price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={value.preco}
                  onChange={(event) => {
                    const normalizedValue = event.target.value.replace(',', '.').trim();
                    if (!normalizedValue) {
                      onChange({ preco: 0 });
                      return;
                    }
                    const parsedPrice = Number(normalizedValue);
                    if (Number.isFinite(parsedPrice) && parsedPrice >= 0) {
                      onChange({ preco: parsedPrice });
                    }
                  }}
                  placeholder="0,00"
                />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sale_price">Preço promocional (R$)</Label>
              <Input id="sale_price" placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sale_from">De</Label>
              <Input id="sale_from" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sale_to">Até</Label>
              <Input id="sale_to" type="date" />
            </div>
          </div>
        )}

        {activeTab === 'estoque' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inventory_sku">SKU</Label>
                <Input
                  id="inventory_sku"
                  value={value.sku}
                  onChange={(event) => onChange({ sku: event.target.value })}
                  placeholder="Código interno"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="global_unique_id">GTIN, UPC, EAN ou ISBN</Label>
                <Input
                  id="global_unique_id"
                  value={value.codigo_barras}
                  onChange={(event) => onChange({ codigo_barras: event.target.value.replace(/\s+/g, '') })}
                  placeholder="Código de barras / identificador"
                />
                <p className="text-xs text-muted-foreground">Insira um identificador exclusivo para este produto.</p>
              </div>
            </div>

            {productType === 'variable' && (
              <div className="rounded-md border border-input bg-muted/40 p-3 text-xs text-muted-foreground">
                As configurações abaixo se aplicam às variações sem gerenciamento manual de estoque ativado.
              </div>
            )}

            <div className="rounded-md border border-input p-3 space-y-3">
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={value.controlar_estoque}
                  onChange={(event) => onChange({ controlar_estoque: event.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                Gestão de estoque
              </label>
              <p className="text-xs text-muted-foreground">Acompanhe a quantidade de estoque para este produto.</p>

              {value.controlar_estoque && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="stock_qty">Quantidade</Label>
                    <Input
                      id="stock_qty"
                      type="number"
                      min={0}
                      value={value.estoque}
                      onChange={(event) => {
                        const normalizedValue = event.target.value.trim();
                        if (!normalizedValue) {
                          onChange({ estoque: 0 });
                          return;
                        }
                        const parsedStock = Number.parseInt(normalizedValue, 10);
                        if (Number.isFinite(parsedStock) && parsedStock >= 0) {
                          onChange({ estoque: parsedStock });
                        }
                      }}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="low_stock">Limiar de estoque baixo</Label>
                    <Input id="low_stock" type="number" min={0} placeholder="2" />
                  </div>
                </div>
              )}

              {value.controlar_estoque && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Permitir encomendas?</legend>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="backorders"
                        checked={backordersMode === 'no'}
                        onChange={() => setBackordersMode('no')}
                        className="h-4 w-4"
                      />
                      Não permitir
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="backorders"
                        checked={backordersMode === 'notify'}
                        onChange={() => setBackordersMode('notify')}
                        className="h-4 w-4"
                      />
                      Permitir, mas informar o cliente
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="backorders"
                        checked={backordersMode === 'yes'}
                        onChange={() => setBackordersMode('yes')}
                        className="h-4 w-4"
                      />
                      Permitir
                    </label>
                  </div>
                </fieldset>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Status do estoque</legend>
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="stock_status"
                    checked={stockStatus === 'instock'}
                    onChange={() => setStockStatus('instock')}
                    className="h-4 w-4"
                  />
                  Em estoque
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="stock_status"
                    checked={stockStatus === 'outofstock'}
                    onChange={() => setStockStatus('outofstock')}
                    className="h-4 w-4"
                  />
                  Fora de estoque
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="stock_status"
                    checked={stockStatus === 'onbackorder'}
                    onChange={() => setStockStatus('onbackorder')}
                    className="h-4 w-4"
                  />
                  Sob encomenda
                </label>
              </div>
            </fieldset>

            <div className="rounded-md border border-input p-3 space-y-2">
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={soldIndividually}
                  onChange={(event) => setSoldIndividually(event.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Vendido individualmente
              </label>
              <p className="text-xs text-muted-foreground">Limitar compras para 1 item por pedido.</p>
            </div>
          </div>
        )}

        {activeTab === 'entrega' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="peso">Peso (g)</Label>
                <Input id="peso" type="number" min={0} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Dimensões (cm)</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input id="comprimento" placeholder="Comprimento" />
                  <Input id="largura" placeholder="Largura" />
                  <Input id="altura" placeholder="Altura" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="shipping_class">Classe de entrega</Label>
              <select
                id="shipping_class"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                defaultValue="-1"
              >
                <option value="-1">Nenhuma classe de entrega</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'relacionados' && (
          <div className="space-y-2">
            <Label htmlFor="upsell">Upsells</Label>
            <Input id="upsell" placeholder="Pesquisar produtos para sugerir" />
            <Label htmlFor="crosssell">Venda cruzada</Label>
            <Input id="crosssell" placeholder="Pesquisar produtos para carrinho" />
          </div>
        )}

        {activeTab === 'atributos' && (
          <div className="space-y-4">
            <div className="rounded-md border border-input bg-muted/40 p-3 text-xs text-muted-foreground">
              Adicione informações descritivas que clientes podem usar para pesquisar este produto, como material ou tamanho.
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm">Expandir</Button>
                <Button type="button" variant="outline" size="sm">Fechar</Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAttributes((prev) => [...prev, { id: Date.now(), name: '', values: '', visible: true, variation: false }])}
              >
                Adicionar novo
              </Button>
            </div>

            <div className="space-y-3">
              {attributes.map((attribute, index) => (
                <div key={attribute.id} className="rounded-md border border-input p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Atributo {index + 1}</p>
                    {attributes.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAttributes((prev) => prev.filter((item) => item.id !== attribute.id))}
                      >
                        Remover
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`attribute_name_${attribute.id}`}>Nome</Label>
                      <Input
                        id={`attribute_name_${attribute.id}`}
                        value={attribute.name}
                        onChange={(event) => setAttributes((prev) => prev.map((item) => (item.id === attribute.id ? { ...item, name: event.target.value } : item)))}
                        placeholder="Ex: Material"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`attribute_values_${attribute.id}`}>Valor(es)</Label>
                      <Textarea
                        id={`attribute_values_${attribute.id}`}
                        value={attribute.values}
                        onChange={(event) => setAttributes((prev) => prev.map((item) => (item.id === attribute.id ? { ...item, values: event.target.value } : item)))}
                        placeholder="Use | para separar valores"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={attribute.visible}
                        onChange={(event) => setAttributes((prev) => prev.map((item) => (item.id === attribute.id ? { ...item, visible: event.target.checked } : item)))}
                        className="h-4 w-4 rounded border-input"
                      />
                      Visível na página de produto
                    </label>

                    {productType === 'variable' && (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={attribute.variation}
                          onChange={(event) => setAttributes((prev) => prev.map((item) => (item.id === attribute.id ? { ...item, variation: event.target.checked } : item)))}
                          className="h-4 w-4 rounded border-input"
                        />
                        Usado para variações
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm">Salvar atributos</Button>
            </div>
          </div>
        )}

        {activeTab === 'avancado' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="purchase_note">Observação de compra</Label>
              <Textarea id="purchase_note" placeholder="Mensagem opcional enviada ao cliente após a compra" rows={3} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="menu_order">Ordem do menu</Label>
              <Input id="menu_order" type="number" min={0} defaultValue={0} />
            </div>

            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={reviewsEnabled}
                  onChange={(event) => setReviewsEnabled(event.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Ativar avaliações
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={visibleInPos}
                  onChange={(event) => setVisibleInPos(event.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Available for POS
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}