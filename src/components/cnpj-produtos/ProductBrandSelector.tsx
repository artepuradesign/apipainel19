import React, { useEffect, useMemo, useState } from 'react';

interface ProductBrandSelectorProps {
  value?: string;
  options?: string[];
  onChange: (value: string) => void;
}

const normalizeBrandOptions = (options: string[]) =>
  Array.from(new Set(options.map((item) => item.trim()).filter(Boolean)));

const ProductBrandSelector: React.FC<ProductBrandSelectorProps> = ({ value = '', options = [], onChange }) => {
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const normalizedOptions = useMemo(() => normalizeBrandOptions(options), [options]);
  const allOptions = useMemo(() => normalizeBrandOptions([...normalizedOptions, ...selectedBrands]), [normalizedOptions, selectedBrands]);

  useEffect(() => {
    const parsed = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!parsed.length) {
      setSelectedBrands([]);
      return;
    }

    const nextSelected = [...new Set(parsed)];
    setSelectedBrands(nextSelected);
  }, [value]);

  const syncSelected = (next: string[]) => {
    setSelectedBrands(next);
    onChange(next.join(', '));
  };

  const toggleBrand = (label: string) => {
    const alreadySelected = selectedBrands.some((item) => item.toLowerCase() === label.toLowerCase());
    if (alreadySelected) {
      syncSelected(selectedBrands.filter((item) => item.toLowerCase() !== label.toLowerCase()));
      return;
    }

    syncSelected([...selectedBrands, label]);
  };

  return (
    <div className="space-y-3 [&_label]:text-[13px] sm:[&_label]:text-sm [&_input]:text-sm [&_button]:text-sm">
      <div className="rounded-md border border-border p-3 overflow-visible md:max-h-60 md:overflow-y-auto">
        {allOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma marca disponível no banco ainda.</p>
        ) : (
          <ul className="space-y-1">
            {allOptions.map((brand) => (
              <li key={brand}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-input"
                    checked={selectedBrands.some((item) => item.toLowerCase() === brand.toLowerCase())}
                    onChange={() => toggleBrand(brand)}
                  />
                  <span>{brand}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ProductBrandSelector;