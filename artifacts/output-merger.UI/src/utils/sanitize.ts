import DOMPurify from 'dompurify';

/**
 * Sanitization configuration for user-generated content.
 * Strips all dangerous tags/attributes while preserving safe formatting
 * for future markdown support (bold, italic, links).
 */
const SANITIZE_CONFIG = {
  // Allow only safe formatting tags
  ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'a', 'br', 'p', 'span'],
  // Allow only safe attributes
  ALLOWED_ATTR: ['href', 'title', 'rel', 'target', 'style'],
  // Allow safe protocols in href
  ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
  // Keep content of removed tags (unwrap instead of strip)
  KEEP_CONTENT: true,
  // Return a DOM fragment for further processing if needed
  RETURN_DOM_FRAGMENT: false,
  // Strip dangerous attributes globally
  FORBID_TAGS: [
    'script',
    'iframe',
    'frame',
    'frameset',
    'object',
    'embed',
    'applet',
    'meta',
    'link',
    'style',
    'base',
    'form',
    'input',
    'button',
    'textarea',
    'select',
    'option',
  ],
  FORBID_ATTR: [
    'on*',
    'style',
    'xmlns*',
    'form*',
    'data-*',
  ],
};

/**
 * Sanitizes HTML content from clipboard or other untrusted sources.
 * Strips dangerous tags/attributes while preserving safe formatting.
 * @param html - Raw HTML string from clipboard
 * @returns Sanitized plain text (tags stripped) or sanitized HTML if needed
 */
export function sanitizeClipboardHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Use DOMPurify to sanitize - it returns safe HTML
  // We then extract text content to ensure only plain text enters our editor
  // Future: if markdown support is added, return sanitized HTML instead
  const cleanHtml = DOMPurify.sanitize(html, {
    ...SANITIZE_CONFIG,
    // For now, strip ALL tags and return plain text
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });

  // Create a temporary element to extract text content
  // This ensures we get clean plain text without any HTML entities
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = cleanHtml;
  return tempDiv.textContent ?? '';
}

/**
 * Sanitizes HTML while preserving allowed formatting tags.
 * Use this when markdown/rich text support is added.
 * @param html - Raw HTML string
 * @returns Sanitized HTML with only safe tags/attributes
 */
export function sanitizeRichText(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

/**
 * Sanitizes plain text input (for text inputs, not HTML).
 * Strips control characters, null bytes, and normalizes whitespace.
 * @param text - Plain text input
 * @returns Sanitized plain text
 */
export function sanitizePlainText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters except newline, tab, carriage return
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize line endings to \n
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Limit excessive whitespace (optional, based on requirements)
    .replace(/[ \t]{100,}/g, ' '.repeat(100));
}

/**
 * Validates and sanitizes text input for the TextInput component.
 * Enforces character limit and character allowlist.
 * @param text - Input text
 * @param maxLength - Maximum allowed characters (default 500)
 * @returns Sanitized text within limits
 */
export function validateAndSanitizeInput(text: string, maxLength = 500): string {
  const sanitized = sanitizePlainText(text);
  return sanitized.slice(0, maxLength);
}

/**
 * Strips HTML tags from a string, returning only text content.
 * Useful for converting clipboard HTML to plain text.
 * @param html - HTML string
 * @returns Plain text content
 */
export function stripHtmlTags(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent ?? '';
}

/**
 * Secure clipboard write with fallback handling.
 * Uses modern Clipboard API with fallback to execCommand.
 * @param text - Text to write to clipboard
 * @returns Promise that resolves when write completes
 */
export async function secureClipboardWrite(text: string): Promise<void> {
  const sanitized = sanitizePlainText(text);

  // Try modern Clipboard API first
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(sanitized);
      return;
    } catch (error) {
      // Fall through to fallback if permission denied or other error
      console.debug('Clipboard API write failed, falling back:', error);
    }
  }

  // Fallback: use execCommand (deprecated but widely supported)
  // Check if execCommand is available (not available in jsdom/test environments)
  if (typeof document.execCommand === 'function') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = sanitized;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (!successful) {
        throw new Error('execCommand copy failed');
      }
      return;
    } catch (error) {
      console.error('Clipboard write failed:', error);
      throw new Error('Failed to copy to clipboard');
    }
  }

  // No clipboard API available
  throw new Error('Clipboard write not available in this environment');
}

/**
 * Secure clipboard read with sanitization.
 * Uses modern Clipboard API with proper permission handling.
 * @returns Promise resolving to sanitized clipboard text
 */
export async function secureClipboardRead(): Promise<string> {
  // Try modern Clipboard API first
  if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
    try {
      const text = await navigator.clipboard.readText();
      return sanitizePlainText(text);
    } catch (error) {
      // Permission denied or other error - fall through
      console.debug('Clipboard API read failed:', error);
    }
  }

  // Fallback: try to read from a pasted event (not directly possible without user interaction)
  // This is a limitation - we can't read clipboard without user paste action in fallback
  throw new Error('Clipboard read not available - requires user paste action');
}

/**
 * Handles paste event securely - extracts and sanitizes text from clipboard event.
 * @param event - ClipboardEvent from paste handler (React or native)
 * @returns Sanitized plain text from clipboard
 */
export function handleSecurePaste(event: React.ClipboardEvent<HTMLDivElement> | ClipboardEvent): string {
  // Try to get HTML first (for rich text sources), sanitize it
  const html = event.clipboardData?.getData('text/html');
  const plainText = event.clipboardData?.getData('text/plain') ?? '';

  let text = plainText;
  if (html && html.trim().length > 0) {
    // Sanitize HTML from clipboard - strips all tags, returns plain text
    text = sanitizeClipboardHtml(html) || plainText;
  }

  return sanitizePlainText(text);
}