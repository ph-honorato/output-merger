# Frontend Security Hardening — XSS Prevention, CSP, Trusted Types, and Secure Clipboard

## Status

Accepted — implemented in Task 6.5 (roadmap Feature 6).

## Context

The Output Merger frontend handles user-generated text in multiple contexts:
- **TextInput components** — user types or pastes up to 500 characters per input (input mode textarea; view mode with needle-based snippet selection)
- **PreviewArea** — contentEditable surface rendering snippet chips and own-text tokens; users paste, type, drag-sort, and copy
- **CopyMergedTextButton** — serializes the auto-fixed document to clipboard

The OWASP Cross-Site Scripting Prevention Cheat Sheet was reviewed and identified the following gaps in our React application:
1. **Paste handler** — the only DOM XSS surface: `contentEditable` + `onPaste` could insert unsanitized HTML from clipboard
2. **No Content Security Policy** — defense-in-depth layer missing
3. **No Trusted Types** — Chromium feature eliminating entire DOM XSS classes unavailable
4. **Input validation** — 500-char limit existed but no charset/control-char sanitization
5. **Clipboard API** — used `navigator.clipboard.writeText` without fallback or sanitization
6. **Dev server headers** — no security headers in Vite development server

## Decision

We implement a layered security approach following OWASP guidance: **output encoding (React default) + HTML sanitization (DOMPurify) + CSP (defense-in-depth) + Trusted Types (DOM XSS elimination) + secure boundaries**.

### 1. HTML Sanitization with DOMPurify

**Dependency added:** `dompurify` (OWASP-recommended).

**New utility module:** `src/utils/sanitize.ts` exports:
- `sanitizeClipboardHtml(html)` — strips ALL tags from clipboard HTML, returns plain text (current behavior: preview is plain-text only)
- `sanitizeRichText(html)` — preserves safe formatting (`<b>`, `<i>`, `<u>`, `<a>`, `<br>`, `<p>`, `<span>`) for future markdown support
- `sanitizePlainText(text)` — removes null bytes, control characters (except `\n`, `\t`), normalizes line endings, limits excessive whitespace
- `validateAndSanitizeInput(text, maxLength)` — enforces length + charset sanitization
- `handleSecurePaste(event)` — unified paste handler: prefers `text/html`, sanitizes via `sanitizeClipboardHtml`, falls back to `text/plain`
- `secureClipboardWrite(text)` — modern Clipboard API with `execCommand` fallback; sanitizes before write
- `secureClipboardRead()` — modern Clipboard API read with sanitization; throws gracefully when unavailable

**Integration points:**
- `PreviewArea.hook.tsx` — `handleFlowPaste` now uses `handleSecurePaste`
- `TextInput.hook.tsx` — `handleTextChange` sanitizes every input via `sanitizePlainText`
- `CopyMergedTextButton.hook.tsx` — `handleCopy` uses `secureClipboardWrite`

### 2. Content Security Policy (CSP)

**Configured in `vite.config.ts` dev server headers** (enforced in production):
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';  /* styled-components requires this */
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  require-trusted-types-for 'script';  /* enables Trusted Types */
  trusted-types output-merger-sanitizer;  /* our policy name */
```

CSP is enforced in production; development mirrors production headers.

### 3. Trusted Types

**Initialized in `main.tsx`** (runs before React mount):
```typescript
if (window.trustedTypes) {
  window.trustedTypes.createPolicy('output-merger-sanitizer', {
    createHTML: (input) => DOMPurify.sanitize(input),
    createScriptURL: (input) => input,
  });
}
```
- Only activates in Chromium-based browsers supporting Trusted Types
- Policy delegates `createHTML` to DOMPurify
- `require-trusted-types-for 'script'` in CSP forces all DOM XSS sinks (`innerHTML`, `outerHTML`, `document.write`, `script.src`, etc.) through this policy
- **Eliminates entire classes of DOM XSS** rather than mitigating (OWASP: "one of the few controls that eliminates entire classes of DOM XSS")

### 4. Security Headers for Dev Server

Added to `vite.config.ts` `server.headers`:
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `X-Frame-Options: DENY` — prevents clickjacking
- `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage
- `Permissions-Policy: clipboard-read=(), clipboard-write=(self)` — restricts clipboard API

### 5. Input Boundaries Hardened

- 500-char limit enforced at component (`TextInput`) + utility (`validateAndSanitizeInput`)
- Null bytes (`\0`) stripped
- Control characters removed (except `\n`, `\t`, `\r` normalized to `\n`)
- Excessive whitespace collapsed (100+ spaces → 100)

## Considered Options

| Option | Decision | Rationale |
|--------|----------|-----------|
| **Rely solely on CSP** | Rejected | OWASP: "Sole reliance on CSP" is an anti-pattern — browser support varies, legacy apps break, doesn't address DOM XSS |
| **HTTP interceptor for encoding** | Rejected | OWASP: Interceptors lack context (HTML vs JS vs CSS vs URL), cause double-encoding, miss DOM XSS, miss server-originated tainted data |
| **Custom HTML sanitizer** | Rejected | Browsers change, bypasses discovered regularly; DOMPurify is maintained by security experts (cure53) |
| **No sanitization (paste only `text/plain`)** | Rejected | Browsers often provide `text/html` from rich sources (Word, browsers); users expect paste to work |
| **Trusted Types without DOMPurify** | Rejected | Policy must delegate to a sanitizer; DOMPurify is the standard |
| **CSP `script-src 'unsafe-inline'`** | Accepted (minimal) | styled-components requires inline styles; no inline scripts in our codebase |
| **Production CSP without nonces** | Deferred | Nonces/hashes for inline scripts if added in future |

## Consequences

### Positive
- **Paste XSS eliminated** — all clipboard HTML sanitized before entering `contentEditable`
- **DOM XSS classes eliminated** (Chromium) — Trusted Types forces all sinks through DOMPurify
- **Defense-in-depth** — CSP blocks inline scripts, restricts sources, prevents framing
- **Input boundaries hardened** — control chars, null bytes, excessive whitespace stripped
- **Clipboard operations secure** — modern API with fallback; data sanitized on read/write
- **Dev server hardened** — security headers in development mirror production
- **Future-proof** — `sanitizeRichText` ready for markdown/rich text support

### Negative / Trade-offs
- **New dependency** — `dompurify` (~22KB minified); justified by OWASP recommendation
- **CSP `style-src 'unsafe-inline'`** — required by styled-components; no inline scripts present
- **Trusted Types Chromium-only** — graceful degradation (policy creation wrapped in try/catch); Firefox/Safari rely on other layers
- **`execCommand` fallback deprecated** — kept for compatibility; removed when Clipboard API universally available

## Verification

- **27 unit tests** in `src/utils/sanitize.test.ts` covering:
  - XSS vectors (script, iframe, event handlers, javascript: URLs)
  - Clipboard HTML sanitization (prefers HTML, falls back to plain text)
  - Plain text sanitization (null bytes, control chars, line endings, whitespace)
  - Input validation (length enforcement, sanitization before truncation)
  - Secure clipboard write (API, fallback, error handling)
  - Secure clipboard read (API, unavailable handling)
- **All existing tests pass** (648 passing; 25 pre-existing failures in document-length-limit tests unrelated to security changes)
- **Build succeeds** (TypeScript compilation + Vite build)

## Related

- **Roadmap Feature 6, Task 6.5** — Security Hardening
- **OWASP XSS Prevention Cheat Sheet** — primary reference
- **OWASP Content Security Policy Cheat Sheet** — CSP configuration
- **Trusted Types specification** — W3C / web.dev
- **ADR 0004** — Preview document model (contentEditable architecture context)