# Subtasks for Task 6.5: Security Hardening

**Implementation Path:** `.specs/features/06-ui-ux-adjustments/tasks/6.5-security-hardening/` (folder to be created when planned)

## Subtasks

- [x] **Task 6.5.1: Paste Handler Sanitization** — Audit and harden `handleFlowPaste` in PreviewArea.hook.tsx
  - Add DOMPurify dependency and sanitize pasted HTML before parsing
  - Strip dangerous tags/attributes (`script`, `iframe`, `on*`, `style`, `javascript:` URLs)
  - Preserve safe formatting (bold, italic, links) if markdown support added later
  - Unit tests for paste sanitization (XSS vectors, edge cases)

- [x] **Task 6.5.2: Content Security Policy (CSP)** — Configure CSP headers for defense-in-depth
  - Define strict CSP policy (script-src 'self', style-src 'self' 'unsafe-inline', img-src data: https:, connect-src 'self')
  - Add CSP to Vite dev server via `server.headers` in `vite.config.ts`
  - Document production CSP requirements (nonce/hash for inline scripts if needed)
  - CSP enforced in production; dev mirrors production headers

- [x] **Task 6.5.3: Trusted Types** — Enable Trusted Types to eliminate DOM XSS classes (Chromium)
  - Add `require-trusted-types-for 'script'` to CSP
  - Create Trusted Types policy delegating to DOMPurify for `createHTML`
  - Policy name: `output-merger-sanitizer`
  - Test in Chromium; graceful degradation for non-supporting browsers

- [x] **Task 6.5.4: Input Validation & Sanitization** — Harden text input boundaries
  - Enforce 500-char limit at component + context level (already present, verify)
  - Add character allowlist validation (strip control chars, null bytes)
  - Sanitize on paste in TextInput (reuse DOMPurify utility)
  - Unit tests for input boundary conditions

- [x] **Task 6.5.5: Secure Clipboard API** — Harden clipboard read/write operations
  - Use `navigator.clipboard.readText()`/`writeText()` with feature detection
  - Fallback to `document.execCommand('copy')` for older browsers
  - Sanitize clipboard data on read (strip HTML, keep plain text)
  - Handle clipboard permission errors gracefully

- [x] **Task 6.5.6: Security Headers for Dev Server** — Harden Vite development server
  - Add `X-Content-Type-Options: nosniff`
  - Add `X-Frame-Options: DENY`
  - Add `Referrer-Policy: strict-origin-when-cross-origin`
  - Add `Permissions-Policy: clipboard-read=(), clipboard-write=(self)`
  - Configure in `vite.config.ts` server.headers

---

**Note:** This task is completed but the implementation folder uses a different structure (security hardening was implemented across multiple files). A dedicated folder `6.5-security-hardening` can be created if needed for future reference.