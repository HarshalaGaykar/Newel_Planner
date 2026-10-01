import sanitizeHtml from 'sanitize-html';

/**
 * Rich text authored in the delivery tracker (Status Summary, report covering
 * message) ends up in an outbound email, so it is sanitised on the way out
 * rather than trusted. The whitelist matches exactly what the editor can
 * produce — bold / italic / underline / lists / links — and nothing else.
 */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'span'];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  // Anything else — javascript:, data:, vbscript: — is dropped outright.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
  },
  disallowedTagsMode: 'discard',
};

/**
 * True when the value already carries markup from the rich text editor.
 *
 * Rows saved before the editor existed hold plain text, and rendering those as
 * HTML would collapse their line breaks. Detecting the difference lets both
 * survive without a data migration.
 */
export function isHtml(value: string): boolean {
  return /<\/?(p|br|strong|b|em|i|u|s|ul|ol|li|a|span)\b[^>]*>/i.test(value);
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Inline styles for the tags the editor emits. Outlook drops class selectors and
 * most block-level CSS, so the styling has to ride on each element.
 */
const INLINE_STYLES: Record<string, string> = {
  p: 'margin:0 0 8px 0;',
  ul: 'margin:0 0 8px 0;padding-left:22px;',
  ol: 'margin:0 0 8px 0;padding-left:22px;',
  li: 'margin:0 0 3px 0;',
  a: 'color:#1F3864;text-decoration:underline;',
};

function applyInlineStyles(html: string): string {
  return html.replace(/<(p|ul|ol|li|a)(\s[^>]*)?>/gi, (match, tag: string, attrs = '') => {
    const style = INLINE_STYLES[tag.toLowerCase()];
    if (!style) return match;
    // Never clobber a style the sanitiser preserved — merge onto the front.
    const existing = /style="([^"]*)"/i.exec(attrs || '');
    if (existing) {
      return `<${tag}${(attrs || '').replace(existing[0], `style="${style}${existing[1]}"`)}>`;
    }
    return `<${tag}${attrs || ''} style="${style}">`;
  });
}

/**
 * Sanitise editor HTML (or escape legacy plain text) into markup safe to drop
 * into an email body.
 */
export function renderRichText(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (!isHtml(raw)) {
    // Legacy plain text — escape it and keep its line breaks.
    return escapeHtml(raw).replace(/\r?\n/g, '<br />');
  }
  return applyInlineStyles(sanitizeHtml(raw, SANITIZE_OPTIONS));
}

/**
 * Flatten editor HTML back to plain text, for the Excel workbook — a cell would
 * otherwise print the raw tags.
 */
export function richTextToPlain(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (!isHtml(raw)) return raw;

  const withBreaks = raw
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|li|ul|ol)\s*>/gi, '\n')
    // A list item reads as a bullet once the tags are gone.
    .replace(/<\s*li[^>]*>/gi, '• ');

  const text = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} });

  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}
