import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Eraser,
  Indent,
  Italic,
  Keyboard,
  Link2,
  List,
  ListOrdered,
  Minus,
  MoreHorizontal,
  Outdent,
  Palette,
  Quote,
  Redo2,
  Settings2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ProductDescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const ProductDescriptionEditor: React.FC<ProductDescriptionEditorProps> = ({ value, onChange, disabled = false }) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'visual' | 'codigo'>('visual');
  const [showAdvancedToolbar, setShowAdvancedToolbar] = useState(true);

  const ToolbarIconButton = ({
    label,
    onClick,
    icon,
  }: {
    label: string;
    onClick: () => void;
    icon: React.ReactNode;
  }) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 w-8 p-0"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </Button>
  );

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const applyCommand = (command: string, commandValue?: string) => {
    if (disabled || !editorRef.current) return;

    editorRef.current.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current.innerHTML);
  };

  const insertLink = () => {
    if (disabled) return;
    const url = window.prompt('Informe a URL do link (https://...)');
    if (!url) return;
    applyCommand('createLink', url);
  };

  const insertMoreTag = () => {
    if (disabled || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertHTML', false, '<!--more-->');
    onChange(editorRef.current.innerHTML);
  };

  const chooseTextColor = () => {
    if (disabled) return;
    const color = window.prompt('Informe uma cor em HEX (ex: #111827)')?.trim();
    if (!color) return;
    applyCommand('foreColor', color);
  };

  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editorRef.current) return;

    const localUrl = URL.createObjectURL(file);
    editorRef.current.focus();
    document.execCommand('insertImage', false, localUrl);
    onChange(editorRef.current.innerHTML);

    event.target.value = '';
  };

  const wordCount = value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean).length;

  return (
    <div className="rounded-md border border-input bg-card">
      <div className="border-b border-border px-4 py-3">
        <Label className="text-sm font-semibold">Descrição do produto</Label>
      </div>

      <div className="px-4 py-3 space-y-0 border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => mediaInputRef.current?.click()} disabled={disabled}>
            Adicionar mídia
          </Button>

          <div className="inline-flex items-center rounded-md border border-input overflow-hidden">
            <button
              type="button"
              className={`px-3 py-1.5 text-xs ${mode === 'visual' ? 'bg-muted text-foreground' : 'bg-background text-muted-foreground'}`}
              onClick={() => setMode('visual')}
              disabled={disabled}
            >
              Visual
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-xs border-l border-input ${mode === 'codigo' ? 'bg-muted text-foreground' : 'bg-background text-muted-foreground'}`}
              onClick={() => setMode('codigo')}
              disabled={disabled}
            >
              Código
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-border py-2">
          <button
            type="button"
            className="h-8 inline-flex items-center gap-2 rounded-sm border border-input bg-background px-2 text-xs"
            onClick={() => applyCommand('formatBlock', 'p')}
            disabled={disabled}
          >
            Parágrafo
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <ToolbarIconButton label="Negrito" onClick={() => applyCommand('bold')} icon={<Bold className="h-4 w-4" />} />
          <ToolbarIconButton label="Itálico" onClick={() => applyCommand('italic')} icon={<Italic className="h-4 w-4" />} />
          <ToolbarIconButton label="Lista com marcadores" onClick={() => applyCommand('insertUnorderedList')} icon={<List className="h-4 w-4" />} />
          <ToolbarIconButton label="Lista numerada" onClick={() => applyCommand('insertOrderedList')} icon={<ListOrdered className="h-4 w-4" />} />
          <ToolbarIconButton label="Bloco de citação" onClick={() => applyCommand('formatBlock', 'blockquote')} icon={<Quote className="h-4 w-4" />} />
          <ToolbarIconButton label="Alinhar à esquerda" onClick={() => applyCommand('justifyLeft')} icon={<AlignLeft className="h-4 w-4" />} />
          <ToolbarIconButton label="Alinhar ao centro" onClick={() => applyCommand('justifyCenter')} icon={<AlignCenter className="h-4 w-4" />} />
          <ToolbarIconButton label="Alinhar à direita" onClick={() => applyCommand('justifyRight')} icon={<AlignRight className="h-4 w-4" />} />
          <ToolbarIconButton label="Inserir/editar link" onClick={insertLink} icon={<Link2 className="h-4 w-4" />} />
          <ToolbarIconButton label="Inserir tag leia mais" onClick={insertMoreTag} icon={<MoreHorizontal className="h-4 w-4" />} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`h-8 w-8 p-0 ${showAdvancedToolbar ? 'bg-muted' : ''}`}
            aria-label="Alternar barra avançada"
            onClick={() => setShowAdvancedToolbar((prev) => !prev)}
            disabled={disabled}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>

        {showAdvancedToolbar && (
          <div className="flex flex-wrap items-center gap-1 pt-2">
            <ToolbarIconButton label="Riscado" onClick={() => applyCommand('strikeThrough')} icon={<Strikethrough className="h-4 w-4" />} />
            <ToolbarIconButton label="Linha horizontal" onClick={() => applyCommand('insertHorizontalRule')} icon={<Minus className="h-4 w-4" />} />
            <ToolbarIconButton label="Sublinhado" onClick={() => applyCommand('underline')} icon={<Underline className="h-4 w-4" />} />
            <ToolbarIconButton label="Cor do texto" onClick={chooseTextColor} icon={<Palette className="h-4 w-4" />} />
            <ToolbarIconButton label="Limpar formatação" onClick={() => applyCommand('removeFormat')} icon={<Eraser className="h-4 w-4" />} />
            <ToolbarIconButton label="Símbolos" onClick={() => applyCommand('insertText', 'Ω')} icon={<span className="text-sm">Ω</span>} />
            <ToolbarIconButton label="Diminuir recuo" onClick={() => applyCommand('outdent')} icon={<Outdent className="h-4 w-4" />} />
            <ToolbarIconButton label="Aumentar recuo" onClick={() => applyCommand('indent')} icon={<Indent className="h-4 w-4" />} />
            <ToolbarIconButton label="Desfazer" onClick={() => applyCommand('undo')} icon={<Undo2 className="h-4 w-4" />} />
            <ToolbarIconButton label="Refazer" onClick={() => applyCommand('redo')} icon={<Redo2 className="h-4 w-4" />} />
            <ToolbarIconButton
              label="Atalhos"
              onClick={() => window.alert('Atalhos: Ctrl+B, Ctrl+I, Ctrl+K, Ctrl+Z, Ctrl+Y')}
              icon={<Keyboard className="h-4 w-4" />}
            />
          </div>
        )}
      </div>

      <input ref={mediaInputRef} type="file" accept="image/*" className="hidden" onChange={handleMediaSelect} />

      <div className="px-4 py-3">
        {mode === 'visual' ? (
          <div
            ref={editorRef}
            contentEditable={!disabled}
            suppressContentEditableWarning
            className="min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onInput={(event) => onChange((event.target as HTMLDivElement).innerHTML)}
            onBlur={() => onChange(editorRef.current?.innerHTML || '')}
          />
        ) : (
          <Textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="<p>Descreva o produto aqui...</p>"
            className="min-h-[300px] font-mono text-xs"
            disabled={disabled}
          />
        )}
      </div>

      <div className="flex flex-col gap-1 border-t px-3 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>Solte arquivos ou use “Adicionar mídia” para inserir imagem no conteúdo.</span>
        <span>Palavras: {wordCount}</span>
      </div>
    </div>
  );
};

export default ProductDescriptionEditor;