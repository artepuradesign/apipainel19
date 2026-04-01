import React, { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ProductTagSelectorProps {
  value?: string;
  suggestedTags?: string[];
  onChange: (value: string) => void;
}

const normalizeTags = (raw: string) =>
  raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const uniqueTags = (tags: string[]) => Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));

const ProductTagSelector: React.FC<ProductTagSelectorProps> = ({ value = '', suggestedTags = [], onChange }) => {
  const [tags, setTags] = useState<string[]>([]);
  const [showTagCloud, setShowTagCloud] = useState(false);

  useEffect(() => {
    setTags(uniqueTags(normalizeTags(value)));
  }, [value]);

  const joinedTags = useMemo(() => tags.join(', '), [tags]);
  const cloudTags = useMemo(
    () => uniqueTags(suggestedTags.map((item) => item.trim()).filter(Boolean)),
    [suggestedTags]
  );

  const syncTags = (next: string[]) => {
    const normalized = uniqueTags(next);
    setTags(normalized);
    onChange(normalized.join(', '));
  };

  const addTag = (tag: string) => {
    const clean = tag.trim();
    if (!clean) return;
    syncTags([...tags, clean]);
  };

  const removeTag = (tag: string) => {
    syncTags(tags.filter((item) => item.toLowerCase() !== tag.toLowerCase()));
  };

  return (
    <div className="space-y-3 [&_label]:text-[13px] sm:[&_label]:text-sm [&_input]:text-sm [&_textarea]:text-sm [&_button]:text-sm">
      <div className="space-y-1.5">
        <Label htmlFor="tax-input-product_tag">Adicionar ou remover tags</Label>
        <Textarea
          id="tax-input-product_tag"
          value={joinedTags}
          rows={3}
          onChange={(e) => syncTags(normalizeTags(e.target.value))}
          placeholder="Digite tags separadas por vírgula"
        />
      </div>

      <ul className="flex flex-wrap gap-2" role="list" aria-label="Tags selecionadas">
        {tags.map((tag) => (
          <li key={tag}>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-input bg-muted px-2 py-1 text-xs"
              onClick={() => removeTag(tag)}
              title="Remover tag"
            >
              {tag}
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
      </ul>

      {cloudTags.length > 0 && (
        <div>
          <button type="button" className="text-sm text-primary hover:underline" onClick={() => setShowTagCloud((prev) => !prev)}>
            Escolher das tags disponíveis
          </button>

          {showTagCloud && (
            <ul className="mt-2 flex flex-wrap gap-2 rounded-md border border-border p-3" role="list" aria-label="Nuvem de tags disponíveis">
              {cloudTags.map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => addTag(tag)}
                  >
                    {tag}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductTagSelector;