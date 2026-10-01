'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Link as LinkIcon, Undo, Redo,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Small rich text editor for content that ends up in an outbound email.
 *
 * Deliberately limited to bold / italic / underline / lists / links: images,
 * tables and headings either break or render inconsistently in Outlook, which is
 * where these reports are read. The backend sanitises the HTML again on save —
 * this component is convenience, not a security boundary.
 */

const TOOLBAR_BUTTON =
  'p-1.5 rounded transition-colors text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none';

function ToolbarButton({ onClick, active, disabled, label, children }: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()} // keep the selection while clicking
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(TOOLBAR_BUTTON, active && 'bg-muted text-foreground')}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1.5">
      <ToolbarButton
        label="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
      >
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
      >
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
      >
        <UnderlineIcon size={14} />
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        label="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
      >
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
      >
        <ListOrdered size={14} />
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton label="Link" onClick={setLink} active={editor.isActive('link')}>
        <LinkIcon size={14} />
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo size={14} />
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo size={14} />
      </ToolbarButton>
    </div>
  );
}

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Tailwind min-height for the writing area, e.g. "min-h-32". */
  minHeight?: string;
}

export default function RichTextEditor({
  value, onChange, placeholder, disabled, className, minHeight = 'min-h-32',
}: RichTextEditorProps) {
  const editor = useEditor({
    // Next.js renders this on the server first; without this flag TipTap warns
    // about an SSR/client mismatch.
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        // Email clients render headings and code blocks inconsistently, and a
        // horizontal rule inside a table cell breaks Outlook outright.
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
    ],
    content: value || '',
    onUpdate: ({ editor: e }) => {
      // TipTap emits "<p></p>" for an empty document; report that as empty so
      // required-field checks upstream behave as expected.
      const html = e.getHTML();
      onChange(e.isEmpty ? '' : html);
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose-sm max-w-none px-3 py-2 focus:outline-none',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_a]:text-primary [&_a]:underline',
          '[&_p]:my-1',
          minHeight,
        ),
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
  });

  // Keep the editor in sync when the value is replaced from outside (a form
  // reset, or settings loaded after first paint). Guarded on inequality so
  // typing does not fight the parent's state.
  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (incoming !== editor.getHTML() && !(editor.isEmpty && incoming === '')) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return (
      <div className={cn('rounded-lg border border-border bg-background', className)}>
        <div className={cn('px-3 py-2 text-xs text-muted-foreground', minHeight)}>Loading editor…</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background overflow-hidden',
        'focus-within:ring-2 focus-within:ring-ring/40',
        disabled && 'opacity-60',
        className,
      )}
    >
      {!disabled && <Toolbar editor={editor} />}
      {/* Placeholder is an overlay rather than a TipTap plugin, to avoid pulling
          in another extension just for a line of grey text. */}
      <div className="relative">
        <EditorContent editor={editor} className="text-xs text-foreground" />
        {placeholder && editor.isEmpty && (
          <p className="pointer-events-none absolute left-3 top-2 text-xs text-muted-foreground" aria-hidden>
            {placeholder}
          </p>
        )}
      </div>
    </div>
  );
}
