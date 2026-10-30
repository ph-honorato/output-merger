import { describe, it, expect, vi } from 'vitest';
import {
  sanitizeClipboardHtml,
  sanitizeRichText,
  sanitizePlainText,
  validateAndSanitizeInput,
  stripHtmlTags,
  handleSecurePaste,
  secureClipboardWrite,
  secureClipboardRead,
} from './sanitize';

describe('sanitize utility', () => {
  describe('sanitizeClipboardHtml', () => {
    it('strips all HTML tags and returns plain text', () => {
      const html = '<script>alert("xss")</script><b>Hello</b> <i>World</i>';
      const result = sanitizeClipboardHtml(html);
      expect(result).toBe('Hello World');
    });

    it('strips dangerous tags like script, iframe', () => {
      const html = '<iframe src="evil.com"></iframe><p>Safe</p>';
      const result = sanitizeClipboardHtml(html);
      expect(result).toBe('Safe');
    });

    it('handles empty and invalid input', () => {
      expect(sanitizeClipboardHtml('')).toBe('');
      expect(sanitizeClipboardHtml(null as any)).toBe('');
      expect(sanitizeClipboardHtml(undefined as any)).toBe('');
    });

    it('strips event handlers', () => {
      const html = '<div onclick="alert(1)">Click me</div>';
      const result = sanitizeClipboardHtml(html);
      expect(result).toBe('Click me');
    });

    it('strips javascript: URLs', () => {
      const html = '<a href="javascript:alert(1)">Link</a>';
      const result = sanitizeClipboardHtml(html);
      expect(result).toBe('Link');
    });
  });

  describe('sanitizeRichText', () => {
    it('preserves allowed formatting tags', () => {
      const html = '<b>Bold</b> <i>Italic</i> <u>Underline</u>';
      const result = sanitizeRichText(html);
      expect(result).toContain('<b>Bold</b>');
      expect(result).toContain('<i>Italic</i>');
      expect(result).toContain('<u>Underline</u>');
    });

    it('strips disallowed tags', () => {
      const html = '<script>alert(1)</script><b>Bold</b>';
      const result = sanitizeRichText(html);
      expect(result).not.toContain('<script>');
      expect(result).toContain('<b>Bold</b>');
    });

    it('allows safe links', () => {
      const html = '<a href="https://example.com" title="tooltip">Link</a>';
      const result = sanitizeRichText(html);
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('title="tooltip"');
    });

    it('strips javascript: links', () => {
      const html = '<a href="javascript:alert(1)">Bad</a>';
      const result = sanitizeRichText(html);
      expect(result).not.toContain('javascript:');
    });
  });

  describe('sanitizePlainText', () => {
    it('removes null bytes', () => {
      const result = sanitizePlainText('Hello\0World');
      expect(result).toBe('HelloWorld');
    });

    it('removes control characters except newline and tab', () => {
      const result = sanitizePlainText('Hello\x00\x01\x02World\n\tTest');
      expect(result).toBe('HelloWorld\n\tTest');
    });

    it('normalizes line endings', () => {
      expect(sanitizePlainText('Hello\r\nWorld')).toBe('Hello\nWorld');
      expect(sanitizePlainText('Hello\rWorld')).toBe('Hello\nWorld');
    });

    it('limits excessive whitespace', () => {
      const result = sanitizePlainText('Hello' + ' '.repeat(150) + 'World');
      expect(result).toBe('Hello' + ' '.repeat(100) + 'World');
    });

    it('handles empty input', () => {
      expect(sanitizePlainText('')).toBe('');
      expect(sanitizePlainText(null as any)).toBe('');
    });
  });

  describe('validateAndSanitizeInput', () => {
    it('enforces max length', () => {
      const result = validateAndSanitizeInput('a'.repeat(600), 500);
      expect(result.length).toBe(500);
    });

    it('sanitizes before truncating', () => {
      const result = validateAndSanitizeInput('Hello\0World', 10);
      expect(result).toBe('HelloWorld');
    });
  });

  describe('stripHtmlTags', () => {
    it('strips all HTML tags', () => {
      const result = stripHtmlTags('<b>Bold</b> <script>bad</script>');
      expect(result).toBe('Bold bad');
    });

    it('handles empty input', () => {
      expect(stripHtmlTags('')).toBe('');
      expect(stripHtmlTags(null as any)).toBe('');
    });
  });

  describe('handleSecurePaste', () => {
    it('extracts and sanitizes plain text from clipboard event', () => {
      const event = {
        clipboardData: {
          getData: (type: string) => (type === 'text/plain' ? 'Hello World' : ''),
        },
      } as unknown as ClipboardEvent;

      const result = handleSecurePaste(event);
      expect(result).toBe('Hello World');
    });

    it('prefers HTML content and sanitizes it', () => {
      const event = {
        clipboardData: {
          getData: (type: string) =>
            type === 'text/html' ? '<b>Bold</b> Text' : 'Plain Text',
        },
      } as unknown as ClipboardEvent;

      const result = handleSecurePaste(event);
      // HTML is sanitized to plain text
      expect(result).toBe('Bold Text');
    });

    it('falls back to plain text when HTML is empty', () => {
      const event = {
        clipboardData: {
          getData: (type: string) =>
            type === 'text/html' ? '' : 'Plain Text',
        },
      } as unknown as ClipboardEvent;

      const result = handleSecurePaste(event);
      expect(result).toBe('Plain Text');
    });

    it('sanitizes malicious HTML from clipboard', () => {
      const event = {
        clipboardData: {
          getData: (type: string) =>
            type === 'text/html'
              ? '<script>alert(1)</script><b>Safe</b>'
              : 'Plain',
        },
      } as unknown as ClipboardEvent;

      const result = handleSecurePaste(event);
      expect(result).toBe('Safe');
    });
  });

  describe('secureClipboardWrite', () => {
    it('uses Clipboard API when available', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });

      await secureClipboardWrite('Test text');
      expect(writeText).toHaveBeenCalledWith('Test text');
    });

    it('falls back to execCommand when Clipboard API fails', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'));
      const execCommand = vi.fn().mockReturnValue(true);

      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      // Mock execCommand on document (available in browser, not in jsdom)
      Object.defineProperty(document, 'execCommand', {
        value: execCommand,
        configurable: true,
        writable: true,
      });

      await secureClipboardWrite('Test text');
      expect(execCommand).toHaveBeenCalledWith('copy');
    });

    it('throws when both methods fail', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'));
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      Object.defineProperty(document, 'execCommand', {
        value: vi.fn().mockReturnValue(false),
        configurable: true,
        writable: true,
      });

      await expect(secureClipboardWrite('Test text')).rejects.toThrow(
        'Failed to copy to clipboard'
      );
    });
  });

  describe('secureClipboardRead', () => {
    it('uses Clipboard API when available', async () => {
      const readText = vi.fn().mockResolvedValue('Clipboard content');
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText },
        configurable: true,
      });

      const result = await secureClipboardRead();
      expect(result).toBe('Clipboard content');
    });

    it('throws when Clipboard API not available', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      });

      await expect(secureClipboardRead()).rejects.toThrow(
        'Clipboard read not available'
      );
    });
  });
});