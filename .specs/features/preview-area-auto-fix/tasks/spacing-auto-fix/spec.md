# Spacing Auto-Fix Specification

## Problem Statement

The preview document (ADR 0004) glues chips and typed text into merged contexts, and the whitespace at those seams is regularly wrong: a chip cut with the source's trailing space lands next to a separator and reads `"wordA  B"`, user-typed glue accumulates double spaces, spaces sit before punctuation (`"Hello , world"`), after opening parentheses (`"( foo)"`), and around line breaks (`"A \n B"`), and stray spaces sit at the document edges. Roadmap Feature 4 Task 2 (2.1–2.3) asks for a pure spacing pass — exactly one space between tokens, no space before `.,!;:`, no space after `(` / before `)`, collapse double spaces, trim spaces around line breaks (line breaks themselves preserved) — wired into the same trigger points as the case pass (creation, sort, copy), frozen tokens skipped, with unit rule tables and integration tests. Two grilling rounds (17 answers, all dated 2026-10-23) amend the roadmap: **(1)** the before-set gains `?` — the roadmap's `.,!;:` includes `!` but omits `?`, treated as a typo — plus `…` (aligned with the case pass's sentence enders) and `)` (the roadmap's own "before `)`"); **(2)** the pass EXTENDS the removal-only wording with an insertion rule, the user's explicit divergence from the recommended never-insert policy: "Insert after punctuation" — a missing space after a punctuation-ending token is inserted at token-boundary seams (chip↔own text, own text↔chip, chip↔chip), never inside token interiors, where decimals (`"3.14"`), URLs (`"example.com"`) and abbreviations (`"e.g."`) live; the recorded principle: "the pass fixes seams between materials; glue inside one material is the user's"; **(3)** the trailing-whitespace EDGE of a non-frozen chip is seam material — "Edges are seams" — so chips cut with trailing spaces get their edges corrected while chip interiors are never rewritten; **(4)** the auto-fix pass becomes the composition case → spacing → case: the first case stage sees the exact pre-spacing structure (preserving every pinned Task 1 classification), the spacing stage enforces the whitespace skeleton, and the final case stage re-cases only the chips the insertions un-glued — one application reaches the settled document, keeping the "clipboard is always fully corrected" contract true. Facts verified in the code shape the design: chips can start and end with punctuation and end with trailing whitespace (word tokens are maximal `\S` runs; `trimRangeStart` trims only leading), so the rules genuinely fire at chip boundaries; chip↔chip glue only arises from deliberate edit-mode deletions (reconciliation and moves always plant separators); after the eager `normalizeTextTokens`, separators survive only at chip↔chip seams (they merge into adjacent own text elsewhere); tombstones are snippet-id-only, so removed own-text/separator tokens need none; the case classifier is invariant under the spacing stage's changes except glue detection, which the final case stage settles; and punctuation-initial chips are never case-transformed (the non-letter first-character guard).

## Goals

- [ ] Task 2.1 (as amended): a pure, exported spacing pass in `src/utils/previewDocument.ts` beside the case pass — no space before `.` `,` `!` `?` `;` `:` `…` `)`; no space after `(`; exactly one space between content atoms (collapse every whitespace run of two or more inside own text to one); literal trim of ALL whitespace adjacent to line breaks, both sides (line-break tokens never added or removed); trim of leading/trailing document whitespace; the trailing-whitespace EDGE of a non-frozen chip as seam material (stripped when a rule demands; chip interiors never rewritten); and insertion of one missing space after a punctuation-ending token at token-boundary seams — trigger set = the same eight characters, removal wins conflicts, own-text-side placement, chip-edge or `${rightChipTokenId}:separator` minting at chip↔chip seams, never before a line break or at the document end, insertions beyond `PREVIEW_DOCUMENT_MAX_LENGTH` skipped in document order. The roadmap Task 2.1 before-set `.,!;:` gains `?` (roadmap omission, user decision 2026-10-23; the line annotated at completion).
- [ ] Task 2.2: the composed auto-fix pass — case → spacing → case — wired centrally in the exported `snippetsReducer` wrapper on EVERY transition except `SYNC_DOCUMENT`, after the transition's source-text rewrite and the eager normalization; whole-document recompute; idempotent; reference-stable; one application reaches the settled document (the fixpoint); frozen chips' text — edges included — skipped on every trigger while the spacing around them is corrected; reconciliation's no-op guard canonicalizes through the composed pass (spacing-only re-emissions are reference-identical no-ops) while `SYNC_DOCUMENT`'s edited-detection and the focused-surface comparison stay exact.
- [ ] Task 2.3: tests — unit spacing rule tables (each rule × each seam kind; insertion mechanics including minting and the limit-skip; idempotence + reference-stability rows; the composed-pass fixpoint rows) + integration (creation, sort, copy outputs inline + modal) with the listed deliberate oracle updates: `'\nA bee '` → `'\nA bee'`, whitespace-tolerant multiset guards, double-space collapse expectations, glued seams (`Alphamytext`, `mytext XBeta`, `Xbeta`) re-pinned as deliberate, clean single-space documents unchanged.
- [ ] ADR 0005 amended in place (draft in this spec, dated 2026-10-23; the Developer writes the amendment following the established inline pattern); NO new i18n strings, no GLOSSARY changes, no routes, no DOM/testid changes in production code; the roadmap Task 2.1–2.3 checkoff + the Task 2.1 `?`-addition annotation at completion (orchestrator).

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Undo/review UI for auto-corrections | Deferred — the unchecked Feature 4 "Task 3: Undo auto-corrections" placeholder in `roadmap.md`; spacing corrections would join the same undo surface |
| Insertion inside token interiors (own text `"Hello,world"` typed as one run, chip-internal `"a ,b"`) | Rejected (user decision 2026-10-23, R2-Q1): decimals, URLs, versions and abbreviations live there (`"3.14"`, `"example.com"`, `"e.g."`); insertion is confined to seams between materials |
| Insertion before any glued seam (not just after punctuation) | Rejected: letter-to-letter glue (`Alphamytext`) is deliberate user intent, pinned by the case pass's glued protection and existing oracles |
| Chip-interior whitespace rewrites of any kind | Interiors are the user's/source's — the pass corrects seams and non-frozen chips' trailing EDGE only (user decision 2026-10-23, R1-Q2) |
| Bracket `[ ] { }` and quote-pair spacing rules | Not in the roadmap's set; deferred |
| Abbreviation-aware insertion exemption ("Dr." would not fire) | Abbreviation-blindness accepted (user decision 2026-10-23, R2-Q2), mirroring the case pass's accepted "Dr." capitalization |
| Per-language spacing rule tables | Module constants today (user decision 2026-10-23, R1-Q11); a real divergent rule (e.g. French-style spacing) is the trigger to introduce a table |
| Line-break token insertion/removal | Line breaks are preserved; only their adjacent whitespace is trimmed (roadmap: "line breaks themselves preserved") |
| Modifying the source TextInputs | Sources are the snippets' origin and are never mutated (Feature 4's own preamble) |
| Correcting mid-typing (running the pass on SYNC_DOCUMENT) | The skip stays (ADR 0004's focused-surface contract); the copy path closes the stale window |
| New i18n strings, GLOSSARY changes, routes, DOM/testid changes in production code | None — the pass is model-level and UI-invisible |
| Persistence of correction history | The undo idea is deferred; v0 stores no correction records |
| Writing docs/adr or roadmap.md in the specs phase | The Developer applies the ADR amendment; the orchestrator handles the roadmap checkoff/annotation at completion |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Scope | Task 2 (spacing, 2.1–2.3) only; undo and per-language divergence stay deferred placeholders | User decision R1-Q1, 2026-10-23 ("Task 2 only (Recommended)") | y (grilled 2026-10-23) |
| Structural mutations | The pass rewrites own-text token text, removes separator tokens, drops emptied own-text tokens, and treats non-frozen chips' trailing-whitespace edges as seam material; chip interiors never rewritten; frozen chips fully untouched | User decision R1-Q2, 2026-10-23 ("Edges are seams (Recommended)") — consistent with the architecture: reconcile rewrites non-edited chip text from source every emission, and the case pass already edits chip text | y (grilled 2026-10-23) |
| Punctuation sets | No space before `.` `,` `!` `?` `;` `:` `…` `)`; no space after `(`; `?` is a roadmap-omission fix; brackets/quotes deferred | User decision R1-Q6 + R2-Q2, 2026-10-23 ("Accept proposed set" / "Same 8-char set") | y (grilled 2026-10-23) |
| Line-break trimming | Literal trim: remove ALL whitespace adjacent to line-break tokens, both sides; line-break tokens never added/removed; chips with internal line breaks keep internal padding | User decision R1-Q7, 2026-10-23 ("Literal trim (Recommended)") | y (grilled 2026-10-23) |
| Document edges | Trim leading whitespace at the document start and trailing whitespace at the document end; `'\nA bee '` oracle → `'\nA bee'` | User decision R1-Q8, 2026-10-23 ("Trim both edges (Recommended)") | y (grilled 2026-10-23) |
| Insertion policy | Insert exactly one space when a token ends with a trigger char and the next atom abuts with zero whitespace — at chip↔own text, own text↔chip, and chip↔chip seams; never inside token interiors, never before a line break, never at the document end; non-punctuation glue stays glued; single-material glue is the escape hatch | User decisions R1-Q5 + R2-Q1, 2026-10-23 ("Insert after punctuation" / "All token-boundary seams") — the user's divergence from the recommended never-insert option | y (grilled 2026-10-23) |
| Insertion trigger set + conflicts | Same 8-char set as the before-set; `(` excluded; the removal rule wins conflicts (a follower starting with a before-set char keeps the seam zero-space); abbreviation-blindness accepted | User decision R2-Q2, 2026-10-23 ("Same 8-char set (Recommended)") | y (grilled 2026-10-23) |
| Space placement + minting | Own-text side whenever one exists (prepend to follower / append to predecessor); at chip↔chip: the preceding chip's trailing edge when non-frozen, else a minted `${rightChipTokenId}:separator` token (the reconcile id pattern; deterministic, idempotent, cannot double-mint); chips' leading edges never touched | User decision R2-Q3, 2026-10-23 ("Split policy (Recommended)") | y (grilled 2026-10-23) |
| Pass composition | Case → spacing → case, in the wrapper AND the copy memo; the first case stage sees the exact pre-spacing structure; the final case stage re-cases only insertion-un-glued chips, never reversing earlier corrections; one application reaches the fixpoint | User decisions R1-Q4 + R2-Q4, 2026-10-23 ("Case then spacing" refined to "Case→spacing→case (Recommended)") — keeps Task 1's pinned classifications and the "clipboard always fully corrected" contract | y (grilled 2026-10-23) |
| Central wiring + SYNC skip | The composed pass runs in the exported wrapper on every transition except `SYNC_DOCUMENT`, after the source-text rewrite and eager normalization, no-ops included; idempotent; reference-stable | User decision R1-Q4 + Task 1's Q2 carried over, 2026-10-23 | y (grilled 2026-10-23) |
| Frozen semantics | Frozen = the chip's own text only (edges included — never stripped); all own-text/separator spacing AROUND frozen chips still corrected; accepted consequence: a frozen chip keeps a trailing edge space at doc end / before line breaks | User decision R1-Q3, 2026-10-23 ("Confirm (Recommended)") | y (grilled 2026-10-23) |
| Comparison policy | Reconcile no-op guard canonicalizes through the COMPOSED pass; `SYNC_DOCUMENT` edited-detection stays EXACT; the focused-surface comparison stays EXACT; visibility consequences accepted (flips at triggers, caret reset on focused sorts, stale visible spacing until the next trigger, copy always corrected) | User decision R1-Q9, 2026-10-23 ("Confirm (Recommended)") | y (grilled 2026-10-23) |
| Document limit | Insertions beyond `PREVIEW_DOCUMENT_MAX_LENGTH` are skipped, in document order (deterministic); never clamp user content to make room; removals/rewrites only shrink or preserve; the length-gate memo in `PreviewArea.hook` keeps measuring the model (unchanged) | User decision R2-Q4, 2026-10-23 (limit half) | y (grilled 2026-10-23) |
| Language keying | Spacing rules are language-independent plain module constants (the documented extension point); the wrapper re-runs the composed pass on `SET_CASE_FIX_LANGUAGE` (spacing stage = idempotent no-op) | User decision R1-Q11, 2026-10-23 ("Module constants (Recommended)") | y (grilled 2026-10-23) |
| Records | ADR 0005 amended in place, dated 2026-10-23, per the established inline amendment pattern; no new i18n strings; no GLOSSARY changes; roadmap checkoff + the `?` annotation at completion (orchestrator) | User decision R1-Q12, 2026-10-23 ("Extend ADR 0005 (Recommended)") | y (grilled 2026-10-23) |
| Test policy | Existing oracles at behavior level with only listed deliberate updates ((a) `'\nA bee '` → `'\nA bee'`; (b) whitespace-tolerant multiset guards; (c) deliberate double-space collapses; (d) glued seams re-pinned; (e) clean documents unchanged); new unit rule tables + integration suites | User decision R1-Q13, 2026-10-23 ("Confirm (Recommended)") | y (grilled 2026-10-23) |
| Whitespace identity + collapse target | Whitespace runs are identified by the same `/\s/` predicate the case pass uses; each maximal run inside own text collapses to one U+0020 space | Agent default — determinism requires pinning; no behavioral difference for plain spaces | n (agent default) |
| Collapse survivor mechanism | The serialized observable is pinned ("exactly one space"); recommended deterministic preference matching the placement policy: own-text-side material first, a separator at chip↔chip seams, a non-frozen chip's trailing edge only when it is the seam's only material | Agent default — the observable is what the canonical comparison and tests pin | n (agent default) |
| Canonical-guard mechanism | Extend `tokensEqualCanonicalCase` vs. a sibling helper canonicalizing through the composed pass — Developer latitude; the pinned observable: a spacing-only re-emission returns the reference-identical state (no re-render, no focused-surface remount) | Agent default (mechanism), user decision (policy, R1-Q9) | n (mechanism, agent default) |
| Composed-pass internal structure | Three literal `applyCaseFix`/`applySpacingFix` calls vs. a fused implementation — latitude; the pinned observable is stage order (case on the pre-spacing structure, spacing, case again) | Agent default | n (agent default) |
| Rule-constant shape | One shared constant serving the before-set and the trigger set, or mirrored constants — content pinned, shape free | Agent default | n (agent default) |
| Pass location | Pure functions in `src/utils/previewDocument.ts` (the `serialize`/`applyCaseFix` home); export names are Developer latitude (e.g. `applySpacingFix`, `applyAutoFix`) | Agent default — the established pure-utils home | n (agent default) |
| No UI surface | No new i18n strings, no DOM/testid changes, no styling — the pass is model-level and invisible | Agent default (nothing UI-facing was requested) | n (agent default) |

**Open questions:** none - all resolved or logged above (rows "Whitespace identity", "Collapse survivor mechanism", "Canonical-guard mechanism", "Composed-pass internal structure", "Rule-constant shape", "Pass location", and "No UI surface" are agent defaults, flagged for confirmation during implementation review).

---

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | Empty tokens, whitespace-only tokens, punctuation-only chips, chips with internal line breaks, at-limit documents, and surrogate-pair content all handled safely (the pass only inspects/replaces ASCII-space runs and single whitespace characters — never splits surrogate pairs); `PREVIEW_DOCUMENT_MAX_LENGTH` respected via the insertion skip; the classifier reads only the document's own tokens |
| Failure / partial-failure states | The pass is a pure recompute — no partial application is possible; the limit-skip is deterministic policy (document order), not a failure; clipboard failure paths keep today's catch/no-toast behavior; the pass never throws on unicode content |
| Idempotency / retry / duplicate handling | The composed pass reaches its fixpoint in ONE application (the final case stage settles insertion-un-glued chips; it never reverses earlier corrections); skipped insertions are re-evaluated (not re-fired) at the next trigger; duplicate re-emissions of the same snippets are no-ops via the composed-canonical guard; inserted spaces make their seams non-glued, so insertion never re-fires |
| Auth boundaries & rate limits | N/A because there is no API |
| Concurrency / ordering | Single user, single tab; one reducer serializes every action; the pass runs inside that serialization (the wrapper) and on the copy memo — insertions are applied in document order, so no reordering is possible |
| Data lifecycle / expiry | The corrected document is in-memory session state; no correction history is stored (the undo idea is deferred); persistence is V1 |
| Observability | N/A because V0 has no metrics/logging requirement |
| External-dependency failure | No new dependency; the spacing stage takes no language tag at all; the case stages take the store's `caseFixLanguage` field |
| State-transition integrity | The document is settled after every trigger except mid-typing (the SYNC skip — the stale window); copy always returns the settled payload; the frozen invariant (edited tokens' text untouched, edges included) holds on every path; the WYSIWYG invariant `flow.textContent === serialize(document)` keeps holding (both sides change together at triggers); the pass's output keeps the canonical token shape (no adjacent own-text runs — inserted/prepended material is always flanked by chips; no empty own-text tokens; line-break tokens untouched) |

---

## User Stories

### P1: Seam removal rules (punctuation, parenthesis, line breaks) ⭐ MVP

**User Story**: As a merger, I want misplaced spaces around punctuation, parentheses and line breaks to disappear from the merged text, so the seams between chips and glue read cleanly.

**Why P1**: Roadmap Task 2.1's core rules, as amended (the `?` addition, user decision 2026-10-23); verified reachability — chips can start and end with punctuation, so these rules fire at chip boundaries, not just inside typed text.

**Acceptance Criteria**:

1. WHEN whitespace exists at a seam immediately before an atom whose first character is one of `.` `,` `!` `?` `;` `:` `…` `)` THEN the pass SHALL reduce that seam to zero spaces — wherever the space lives: inside an own-text token (`"Hello ."` → `"Hello."`, `"a )b"` → `"a)b"`), in a separator token before a punctuation-initial chip (`chip "The end"` + `chip "..."` → `"The end..."`), or in the trailing-whitespace edge of a non-frozen chip.
2. WHEN whitespace exists at a seam immediately after an atom whose last character is `(` THEN the pass SHALL reduce the seam to zero spaces (`own "foo ("` + `own "bar)"` → `"foo(bar)"`; `chip "foo("` + separator + chip → the separator is removed).
3. WHEN whitespace exists at a seam adjacent to a line-break token THEN the pass SHALL remove it entirely on both sides (literal trim; `A \n B` → `A\nB`); line-break tokens SHALL never be added or removed.
4. The rules SHALL fire at chip boundaries exactly as at own-text boundaries — chips can start with punctuation (a separator before them is removed) and end with it.
5. The before-set is `.` `,` `!` `?` `;` `:` `…` `)` — the roadmap's `.,!;:` plus `?` (roadmap omission, annotated at completion), `…` (aligned with the case pass's sentence enders), and `)` (the roadmap's own "before `)`"); `(` is the lone opposite; brackets/quotes are deferred. Chip INTERIORS are never rewritten (user decision 2026-10-23, R1-Q2 "Edges are seams").

**Independent Test**: Pure-pass unit tables in the `previewDocument.test.ts` area — every before-set character × every seam kind (own-text interior, own-text edge, separator, non-frozen chip edge); the `(`/`)` rows; the line-break both-sides rows; chip-interior-untouched rows; reducer integration — creation of a punctuation-initial chip after a separator collapses the seam.

---

### P1: Collapse and document-edge rules ⭐ MVP

**User Story**: As a merger, I want exactly one space between words and no stray spaces at the document's edges, so the copied text needs no manual cleanup.

**Why P1**: Roadmap Task 2.1's "exactly one space between tokens" and "collapse double spaces", extended by the document-edge decision (R1-Q8) — the move logic itself can leave double spaces (the carried-separator mid-run-offset case), and the pinned `'\nA bee '` seam ends in a trailing space.

**Acceptance Criteria**:

1. WHEN a maximal whitespace run of length ≥ 2 exists inside an own-text token THEN the pass SHALL collapse it to exactly one space (whitespace identified by the same `/\s/` predicate as the case pass; the collapsed run is U+0020 — agent default).
2. WHEN a seam between two content atoms (chip↔chip, chip↔own text, own text↔chip) holds more than one space of material (a separator plus a non-frozen chip's trailing edge, or a multi-space run) THEN the pass SHALL reduce it to exactly one space, deterministically (the serialized observable is pinned; the surviving-token choice is Developer latitude, with the recommended preference: own-text-side material first, separator at chip↔chip, chip edge only when it is the only material).
3. WHEN the document starts or ends with whitespace (an own-text edge, a separator, a non-frozen chip's trailing edge) THEN the pass SHALL trim it (user decision 2026-10-23, R1-Q8).
4. WHEN an own-text token becomes empty through the pass's removals THEN it SHALL be dropped from the document; tombstones (snippet-id-only, verified) SHALL be unaffected.
5. A trailing line-break token at the document end SHALL be preserved (line breaks are never removed — only their adjacent whitespace is trimmed).

**Independent Test**: Unit collapse tables (interior runs, edge+separator combos, the move-logic double-space shape); document-edge rows (leading own text, trailing separator, trailing chip edge, trailing line break preserved); the reducer's `'\nA bee '` seam updated to `'\nA bee'` and the emptied-token drop rows.

---

### P1: Insertion after punctuation ⭐ MVP

**User Story**: As a merger, I want a missing space after punctuation to be added for me at the seams, so a chip like "Hello," glued to "world" reads "Hello, world" instead of "Hello,world".

**Why P1**: The user's deliberate extension of the roadmap's removal-only wording (user decision 2026-10-23, R1-Q5 "Insert after punctuation" + R2-Q1/Q2/Q3) — the one rule that adds material rather than removing it.

**Acceptance Criteria**:

1. WHEN a token ends with one of `.` `,` `!` `?` `;` `:` `…` `)` and the next atom abuts with ZERO whitespace, and the next atom is not a line break or the document end, and its first character is NOT in the no-space-before set THEN the pass SHALL insert exactly one space at the seam (user decision 2026-10-23, R1-Q5).
2. The insertion SHALL fire at all three token-boundary seam kinds — chip→own text (`chip "Hello,"` + `own "world"` → `"Hello, world"`), own text→chip (`own "Note:"` + `chip "world"` → `"Note: world"`), and chip↔chip (`chip "Hello,"` + `chip "world"` → `"Hello, world"`) — the recorded principle: "the pass fixes seams between materials; glue inside one material is the user's" (R2-Q1).
3. The insertion SHALL NOT fire inside token interiors (own text `"Hello,world"` typed as one run, or inside a chip, stays as typed — decimals, URLs, abbreviations are safe) (R2-Q1); and the non-punctuation glued seams (chip `"Alpha"` + own `"mytext"`) SHALL stay glued.
4. WHEN the follower's first character is in the no-space-before set THEN the removal rule SHALL win and no space is inserted — the seam stays zero-space (`chip "Hello,"` + `own ",more"` → `"Hello,,more"`) (R2-Q2). Abbreviation-blindness is accepted (`"Dr."` + `"Smith"` → `"Dr. Smith"`).
5. Placement (R2-Q3): the inserted space SHALL live in the own-text side whenever one exists (prepend to the following own text; append to the preceding own text — chips' leading edges are never touched, so a frozen follower is no obstacle); at chip↔chip seams, in the preceding chip's trailing edge when non-frozen, else in a MINTED separator token with the id `${rightChipTokenId}:separator` (the existing reconcile id pattern; deterministic, idempotent, cannot double-mint — the id is free because the glue only exists after the original separator was deleted).
6. WHEN an insertion would push the serialized document over `PREVIEW_DOCUMENT_MAX_LENGTH` THEN it SHALL be skipped — insertions are evaluated in document order (deterministic); user content is never clamped to make room; a skipped seam is re-evaluated at the next trigger (R2-Q4). Insertion never fires before a line break or at the document end.

**Independent Test**: Unit insertion tables — seam kind × trigger character (all eight, both `(`-excluded directions), the conflict rows, the frozen-preceding minting rows (id equality + no double-mint), the limit-skip rows (at-limit document, insertion skipped in document order, shrink-then-trigger re-evaluation), the idempotence rows (inserted space makes the seam non-glued → no re-fire); reducer integration — each seam kind corrected at a dispatched trigger.

---

### P1: Frozen chips and boundary corrections ⭐ MVP

**User Story**: As a merger, I want my hand-edited chips to stay exactly as I typed them — including their spacing quirks — while the seams around them still get cleaned up.

**Why P1**: Roadmap Task 2.2's "frozen tokens skipped", resolved by user decision 2026-10-23 (R1-Q3); the `edited` flag exists only on snippet tokens, so own text and separators are never frozen.

**Acceptance Criteria**:

1. WHILE a snippet token's `edited` flag is true THEN its text — including any trailing-whitespace edge — SHALL never be rewritten by the spacing pass on any trigger (frozen = the chip's own text only).
2. WHEN a frozen chip's neighbors need correction THEN the own-text and separator spacing AROUND it SHALL still be corrected: a frozen `chip "Stop"` + `own " !"` → `"Stop!"`; a separator before a punctuation-initial frozen chip is removed; a frozen chip's redundant adjacent separator is removed when the frozen edge itself provides the one space (e.g. frozen `"wordA "` + separator + chip → the separator is dropped).
3. WHEN a chip↔chip insertion's PRECEDING chip is frozen THEN the space SHALL be minted as a `${rightChipTokenId}:separator` token — the frozen text is never the material (Insertion story, criterion 5).
4. Accepted consequences pinned: a frozen chip keeps a trailing edge space at the document end and before line breaks (frozen wins over the edge trims); a frozen chip's internal double spaces and internal punctuation spacing stay as typed.

**Independent Test**: Unit and reducer rows — boundary corrections around frozen chips on both sides; the frozen-edge survival rows (doc end, before line break); the frozen-preceding minting row; the freeze-via-spacing-retyping row (a deliberate spacing change inside a chip sets `edited` via the exact sync comparison, and is then never re-corrected).

---

### P1: Glue preservation ⭐ MVP

**User Story**: As a merger, I want my deliberately joined text to stay joined, so the pass never invents a space where I meant none.

**Why P1**: The R2-Q1 principle "the pass fixes seams between materials; glue inside one material is the user's"; the pinned case-pass oracles (`Alphamytext`, `mytext XBeta`, `Xbeta`) must survive the spacing task byte-identically.

**Acceptance Criteria**:

1. WHEN a zero-space seam's preceding token ends with a character NOT in the trigger set (e.g. chip `"Alpha"` + own `"mytext"`; chip `"Hello"` + own `"NET"`) THEN the seam SHALL stay glued — no insertion.
2. WHEN glue lives inside one material — typed inside a chip's text, or inside a single own-text run — THEN the pass SHALL never insert into it; this is the escape hatch: a user who genuinely wants `"Hello,world"` can keep it by typing it as one own-text run (R2-Q1).
3. WHEN the spacing stage removes a separator before a punctuation-initial chip (making it newly glued) THEN the case stage(s) SHALL leave that chip's case unchanged anyway — its first character is punctuation, which the case pass never transforms (verified code fact; the composed order keeps this inert).
4. The pinned glued seams (`Alphamytext`, `mytext XBeta`, `Xbeta`) SHALL stay byte-identical and get re-pinned as deliberate oracle rows (test policy (d), R1-Q13).

**Independent Test**: Unit rows — non-trigger glue untouched in every context; interior integrity (`"3.14"`, `"example.com"`, `"e.g."` rows); the escape-hatch row (single own-text run with interior glue); integration — the existing PreviewArea glued-seam oracles re-pinned with comments marking them deliberate.

---

### P1: The composed pass — central wiring, idempotence, reference stability, one-application fixpoint ⭐ MVP

**User Story**: As a merger, I want the spacing corrections to land at the same triggers as the case corrections, settle in one step, and be invisible when they have nothing to do — so the preview stays calm and always ends up correct.

**Why P1**: Roadmap Task 2.2's wiring ("the same trigger points"), resolved by R2-Q4 into the case → spacing → case composition; the fixpoint is what keeps "the clipboard is always fully corrected" true under the insertion rule.

**Acceptance Criteria**:

1. The composed auto-fix pass SHALL run centrally in the exported `snippetsReducer` wrapper on EVERY transition except `SYNC_DOCUMENT` — creation, both move actions, `SET_EDIT_ENABLED`, `SET_CASE_FIX_LANGUAGE`, and no-op transitions — after the transition's source-text rewrite and the eager `normalizeTextTokens`, as a whole-document recompute.
2. The FIRST case stage SHALL run on the exact pre-spacing structure (preserving every pinned Task 1 classification); the FINAL case stage SHALL run after the spacing stage and re-case only chips the insertions un-glued — it SHALL never reverse earlier corrections (verified: spacing never changes a predecessor's last meaningful character, so sentence-start/mid-sentence classifications are invariant; only glue detection can flip, and only for insertion-un-glued chips). One application SHALL reach the settled document: `[chip "Hello,"][chip "World"]` → `"Hello, world"` in a SINGLE dispatch (lowercased by the final case stage, not left for a second trigger).
3. IF the composed pass changes nothing THEN the previous state object SHALL be returned (reference-identical); untouched tokens keep their object references; re-running the pass over settled output SHALL yield content-identical tokens (idempotence).
4. The spacing stage's rules SHALL be language-independent module constants (user decision 2026-10-23, R1-Q11) — the documented extension point; the composed pass derives under the state's `caseFixLanguage` field, so a `SET_CASE_FIX_LANGUAGE` dispatch re-runs it (spacing stage = idempotent no-op).
5. The pass's output SHALL keep the canonical token shape — no adjacent own-text runs (inserted/prepended material is flanked by chips or joins an existing own-text token), no empty own-text tokens, line-break tokens untouched — and the pass SHALL never add or remove line-break tokens.
6. `SYNC_DOCUMENT` SHALL keep the mid-typing skip entirely (the eager normalization still runs there; the pass never fights the focused editor between keystrokes).

**Independent Test**: Wrapper sweeps (action type × document shape, including `SET_EDIT_ENABLED`, a no-op move, and `SET_CASE_FIX_LANGUAGE`) asserting reference stability; double-application idempotence units over representative documents (empty, own-text-only, all-frozen, glued, punctuation-seamed, at-the-limit); the fixpoint rows (insertion-then-re-case settled in one application; the composed pass applied to its own output is content-identical); the SYNC stale-window row (spacing stays stale mid-typing, the next trigger settles it).

---

### P1: Copy-time correction (inline + modal) ⭐ MVP

**User Story**: As a merger, I want the clipboard to always carry the fully corrected text even when the visible preview is momentarily stale, so what I paste elsewhere is right.

**Why P1**: Roadmap Feature 4's preamble ("the copied text is always the corrected version") and Task 1's copy contract, carried over; the SYNC skip makes this the guarantee that closes the stale-spacing window.

**Acceptance Criteria**:

1. WHEN copy is activated (the one `CopyMergedTextButton`, toolbar or modal rail) THEN the clipboard payload SHALL be `serialize(applyAutoFix(previewDocument, caseFixLanguage))` — the settled, composed-pass output.
2. The copy path SHALL apply the pass to a transformed copy of the tokens; the context document SHALL NOT be mutated by copying.
3. WHILE the visible document holds stale spacing (mid-typing, since `SYNC_DOCUMENT` skips the pass) THEN the clipboard SHALL still be fully settled — payload and visible text may differ only in pass-correctable spacing/case.
4. The copy gating (`canCopy`), toast, i18n strings, and button behavior SHALL be unchanged; both mounted copy buttons produce the same payload (ADR 0003's shared-state pattern); the memo re-derives on document or language change.

**Independent Test**: `CopyMergedTextButton.test.tsx` — the clipboard equals the settled serialization while the visible document asserts as stale-spaced; the no-mutation pin (token array, object references, content unchanged after copy); copy inside `within(getByRole("dialog"))` yields the same settled payload; a language switch re-derives the memo (spacing identical, case keyed).

---

### P1: The extended comparison policy and visibility consequences ⭐ MVP

**User Story**: As a merger, I want the app to recognize its own spacing corrections when sources re-send their snippets, while still recognizing MY spacing edits as mine — so nothing churns and nothing overrides me.

**Why P1**: Task 1's mixed comparison policy (Q15, 2026-10-22) carried over and extended by R1-Q9 (2026-10-23): the guard must tolerate spacing-only differences (e.g. the source re-sends `"wordA "` while the stored chip was edge-stripped).

**Acceptance Criteria**:

1. WHEN a source re-emission's snippet texts differ from the stored tokens only in pass-correctable spacing THEN reconciliation's no-op guard SHALL treat it as unchanged — comparing composed-pass-canonical forms — and return a reference-identical state: no re-render, no focused-surface remount.
2. The edited-detection comparison (`SYNC_DOCUMENT`: `previous.text !== token.text`) SHALL stay exact — a spacing-only difference inside a chip's text (a deliberate added/removed space) marks the token edited; that is how manual spacing overrides freeze.
3. The focused-surface self-recognition comparison (`tokensEqualIgnoringEdited`) SHALL stay exact — a spacing-induced model change counts as a real change: the surface re-renders from the model, is never mistaken for the surface's own typing, and no stale-spacing chip is falsely frozen by the next keystroke's parse.
4. WHILE edit mode is ON and a surface is focused WHEN a composed-pass model change re-renders it THEN the accepted caret reset (ADR 0004's non-text-change path) applies; the visibility consequences are accepted (user decision 2026-10-23, R1-Q9): corrections visibly flip at triggers, a focused sort resets the caret, and the visible spacing can be stale after typing until the next trigger while copy always settles.

**Independent Test**: Reducer suites — re-emit a trailing-space snippet text after edge-stripping and assert `next === state` (reference identity) and zero re-renders (provider render-count pin); a spacing-only sync diff → edited; the comparison-policy table rows; the stale-window + next-trigger settle row.

---

### P1: Records — the ADR 0005 amendment ⭐ MVP

**User Story**: As a maintainer, I want ADR 0005 to tell the whole auto-fix story — case and spacing — so future work builds on the recorded decisions.

**Why P1**: The case spec's Records decision planned this task to extend ADR 0005; confirmed by user decision 2026-10-23 (R1-Q12).

**Acceptance Criteria**:

1. ADR 0005 SHALL be amended in place by the Developer, dated 2026-10-23, following the established inline amendment pattern (mechanism sentences + consequences bullets, as in ADR 0004's "(ADR 0001 amendment)" style); the draft is this spec's Draft Records Copy; the Task 1 decisions (triggers, guards, case-aware comparisons, dropped guards) are untouched.
2. NO new i18n strings, NO GLOSSARY changes, NO routes, and NO DOM/testid changes in production code SHALL ship with this task.
3. The roadmap Task 2.1–2.3 checkoff and the Task 2.1 line annotation (the `?` addition, user decision 2026-10-23) SHALL happen at completion, by the orchestrator.

**Independent Test**: A records scan — no i18n resource file touched, no GLOSSARY edit; the ADR diff matches the spec's draft (the amendment marker dated 2026-10-23 present; no Task 1 decision text altered).

---

## Draft Records Copy (Developer deliverable)

**ADR 0005 amendment** — applied in place to `docs/adr/0005-preview-auto-fix-pass.md`, dated 2026-10-23, per the established inline amendment pattern. The title and the Task 1 decisions are untouched. Amendments:

**(a) New mechanism text** (inserted after the existing "…capitalized at sentence starts, lowercased mid-sentence." sentence of the main paragraph):

> The pass gained a spacing stage (roadmap Feature 4 Task 2, amended 2026-10-23), and the auto-fix pass is now the composition case → spacing → case. The spacing stage corrects punctuation-adjacent whitespace over the whole document: no space before `.` `,` `!` `?` `;` `:` `…` `)` (the roadmap's `.,!;:` plus `?` — a roadmap omission — `…` aligned with the case pass's sentence enders, and `)` per the roadmap's own rule), no space after `(`, literal trim of all whitespace adjacent to line breaks (line-break tokens themselves never added or removed), collapse of every whitespace run of two or more inside own text to one space, trims of leading and trailing document whitespace, and — a deliberate extension beyond the roadmap's removal-only wording — insertion of one missing space after a punctuation-ending token at token-boundary seams (chip↔own text, own text↔chip, chip↔chip) when word content follows: "the pass fixes seams between materials; glue inside one material is the user's". Token interiors are never rewritten (decimals, URLs, and abbreviations stay intact); the trailing-whitespace edge of a NON-frozen chip is seam material (stripped when a rule demands, and the landing spot for chip↔chip insertions when it is not frozen), while a frozen chip's text — edges included — is never touched, though the spacing around it is corrected. The inserted space lives in the own-text side whenever one exists, else in the preceding chip's trailing edge, else in a minted `${rightChipTokenId}:separator` token (the reconciliation id pattern); the no-space-before rule wins seam conflicts (a follower starting with one of the before-set characters keeps the seam zero-space); and insertions that would exceed the document limit are skipped in document order — the pass never clamps user content to make room for a correction. The final case stage re-cases only the chips the spacing stage's insertions un-glued (it never reverses earlier corrections), so one application of the composed pass reaches the settled document — the first case stage still sees the exact pre-spacing structure, preserving every classification of the case-only pass.

**(b) Mechanism sentence updates** (the review-fixes inline style): the sentence "The pass is wired centrally in the snippetsReducer wrapper after every transition except SYNC_DOCUMENT…" now refers to the composed auto-fix pass (the wiring point and the SYNC skip are unchanged); the reconcile no-op guard sentence becomes "compares the composed pass's canonical forms (case and spacing)" in place of "compares pass-canonical forms".

**(c) New considered options** (appended to Considered Options — all rejected unless chosen):

- **Never inserting a missing space (the removal-only reading of the roadmap)** — rejected by user decision 2026-10-23: a punctuation-ending chip glued to word content ("Hello," + "world") reads as a typo; the user chose "insert after punctuation".
- **Inserting inside token interiors** — rejected: that is where decimals ("3.14"), URLs ("example.com") and abbreviations ("e.g.") live; insertion is confined to seams between materials.
- **Inserting before any glued seam (not just after punctuation)** — rejected: letter-to-letter glue ("Alphamytext") is deliberate user intent, pinned by the case pass's glued protection and existing oracles.
- **Spacing first, then case** — rejected: insertion and removal change which token holds the surviving space and which chips read as glued, so the case classification would depend on the spacing stage's internal mechanism choices; case → spacing → case keeps the Task 1 classifications pinned to the pre-spacing structure while still settling insertion-un-glued chips in one application.
- **Case → spacing with no final case stage** — rejected: an insertion that un-glues a chip follower would leave the document one re-case short of settled for a full trigger cycle, and the copy path could ship a not-fully-corrected payload (violating the "clipboard is always fully corrected" contract).
- **A per-language spacing rule table** — deferred: spacing rules are language-independent module constants today (the documented extension point); a table arrives when a real divergent rule exists (e.g. French-style spacing).
- **Case → spacing → case (the composed pass) + the split placement policy — chosen.**

**(d) New consequences** (appended to Consequences):

- The spacing stage mutates document structure: it rewrites own-text token text, removes separator tokens, strips non-frozen chips' trailing-whitespace edges, drops emptied own-text tokens, and mints `${rightChipTokenId}:separator` tokens for insertions at frozen-preceding chip↔chip seams; tombstones stay snippet-id-only (ADR 0005 amendment, 2026-10-23).
- The character set is `.` `,` `!` `?` `;` `:` `…` `)` before which no space is kept and after which one is inserted when word content follows; `(` is the lone opposite (no space after it, never an insertion trigger). The roadmap Task 2.1 line's `.,!;:` gains `?` (a roadmap omission amended at completion).
- Glue preservation: zero-space seams whose preceding token ends in a non-trigger character stay glued, and glue inside one material (chip interiors, single own-text runs) is never broken — the escape hatch for deliberately joined text ("Hello,world" typed as one run survives every trigger).
- The document limit is respected by skipping over-budget insertions in document order; removals and rewrites only shrink or preserve length otherwise; the preview area's length gate keeps measuring the model.
- The comparison policy carries the composition: reconciliation's no-op guard canonicalizes through the composed pass, while edited-detection and the focused-surface comparison stay exact — a spacing-only source re-emission is a reference-identical no-op, and a deliberate spacing retyping inside a chip still freezes it.
- Spacing corrections flow through ADR 0004's existing non-text-change path while edit-ON+focused (re-freeze + remount, the accepted caret reset); the visible document can hold stale spacing after typing until the next trigger, and the clipboard always carries the settled form.

---

## Edge Cases

- IF a source re-emission differs from the stored tokens only in pass-correctable spacing (the source re-sends `"wordA "` after the chip's edge was stripped) THEN the composed-canonical guard returns the reference-identical state — no re-render, no focused-surface remount.
- IF the user retypes a chip's spacing (adds or removes a space inside its text) THEN the exact sync comparison marks it edited — the chip freezes and is never auto-corrected again, edges included.
- IF a sort happens while edit mode is ON and the surface is focused THEN composed-pass model changes re-freeze/re-render the focused surface and the caret may reset (accepted — ADR 0004's non-text-change path).
- IF copy runs while the visible document holds stale spacing THEN the clipboard still receives the settled serialization; payload and visible text may differ only in pass-correctable spacing/case.
- IF a punctuation-ending chip is glued to word content THEN the insertion fires (`"Hello,"` + `"world"` → `"Hello, world"`) — including chip↔chip seams, where a minted separator or a non-frozen edge carries the space; letter-ending glue stays (`"Alphamytext"`).
- IF the follower at a punctuation-ending seam starts with a before-set character THEN no insertion — the seam stays zero-space (`"Hello,"` + `",more"` → `"Hello,,more"`).
- IF the preceding chip of a chip↔chip insertion is frozen THEN a `${rightChipTokenId}:separator` token is minted (deterministic; re-mints after a re-deletion reproduce the same id; no double-mint because the seam stops being glued).
- IF a frozen chip carries a trailing edge space THEN it survives everywhere (document end, before line breaks) — frozen wins over trims.
- IF an insertion would exceed `PREVIEW_DOCUMENT_MAX_LENGTH` THEN it is skipped (document order); a later shrink re-evaluates it at the next trigger.
- IF an own-text token becomes empty through removals THEN it is dropped; tombstones are unaffected (snippet-id-only).
- IF the document is empty THEN the pass is a reference-identical no-op; IF it holds only whitespace THEN the trims drop it to the empty document (a real, corrected change).
- IF the user deletes a chip↔chip separator in edit mode and the preceding chip ends with a trigger char THEN the pass re-inserts a space at the next trigger; the escape hatch is typing the joined form as a single own-text run.
- IF the move logic leaves a deliberate double space (the carried-separator mid-run-offset case) THEN the pass collapses it to one.
- IF a chip starts with punctuation and a separator precedes it THEN the separator is removed (`chip "The end"` + `chip "..."` → `"The end..."`).
- IF a chip ends with `(` and whitespace follows THEN the whitespace is removed (`"foo ("` + `"bar)"` → `"foo(bar)"`).
- IF the spacing stage's removals make a punctuation-initial chip newly glued THEN its case is unaffected anyway (non-letter first character — never case-transformed).
- IF `"Dr."` precedes a glued chip THEN the insertion fires (`"Dr."` + `"Smith"` → `"Dr. Smith"`) — abbreviation-blindness accepted, mirroring the case pass.
- IF the UI language changes THEN the composed pass re-runs (spacing stage language-independent; case stage keyed by the state's field) — identical spacing outputs today.
- IF both copy buttons are mounted (modal open) THEN both produce the same settled payload from the one document.
- IF the document sits at the limit THEN removals and rewrites still apply (they shrink or preserve length); only insertions are gated.
- IF whitespace runs contain non-U+0020 whitespace (tabs, non-breaking spaces) THEN each maximal run inside own text collapses to one U+0020 (agent default; the `/\s` predicate matches the case pass's).
- IF a chip contains internal line breaks (a multi-word source selection) THEN its internal padding is untouched (interior); only its trailing edge and the seams around it are corrected.

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SPACING-01 | Seam removal rules (before-set, wherever the space lives) | Specify | Pending |
| SPACING-02 | Seam removal rules (after `(`) | Specify | Pending |
| SPACING-03 | Seam removal rules (literal trim around line breaks; line breaks preserved) | Specify | Pending |
| SPACING-04 | Seam removal rules (chip-boundary firing) | Specify | Pending |
| SPACING-05 | Seam removal rules (the amended set: `?` addition, `…`, `)`; `(` opposite; interiors untouched) | Specify | Pending |
| SPACING-06 | Collapse and document-edge rules (interior runs ≥2 → 1) | Specify | Pending |
| SPACING-07 | Collapse and document-edge rules (seam material >1 → 1, deterministic) | Specify | Pending |
| SPACING-08 | Collapse and document-edge rules (document-edge trims — R1-Q8) | Specify | Pending |
| SPACING-09 | Collapse and document-edge rules (emptied own-text tokens dropped; tombstones unaffected) | Specify | Pending |
| SPACING-10 | Collapse and document-edge rules (trailing line break preserved) | Specify | Pending |
| SPACING-11 | Insertion after punctuation (trigger + guard conditions) | Specify | Pending |
| SPACING-12 | Insertion after punctuation (all three seam kinds — R2-Q1) | Specify | Pending |
| SPACING-13 | Insertion after punctuation (never inside interiors; non-punctuation glue stays — R2-Q1) | Specify | Pending |
| SPACING-14 | Insertion after punctuation (conflict priority — removal wins — R2-Q2) | Specify | Pending |
| SPACING-15 | Insertion after punctuation (split placement + `${rightChipTokenId}:separator` minting — R2-Q3) | Specify | Pending |
| SPACING-16 | Insertion after punctuation (limit-skip in document order — R2-Q4; never before line breaks / at doc end) | Specify | Pending |
| SPACING-17 | Frozen chips (text + edges never rewritten) | Specify | Pending |
| SPACING-18 | Frozen chips (boundary corrections around them) | Specify | Pending |
| SPACING-19 | Frozen chips (frozen-preceding insertion mints) | Specify | Pending |
| SPACING-20 | Frozen chips (edge survival at doc end / before line breaks) | Specify | Pending |
| SPACING-21 | Glue preservation (non-trigger glue stays glued) | Specify | Pending |
| SPACING-22 | Glue preservation (interior integrity; the single-run escape hatch) | Specify | Pending |
| SPACING-23 | Glue preservation (newly-glued punctuation chips stay un-cased; pinned seams byte-identical) | Specify | Pending |
| SPACING-24 | The composed pass (central wiring, every transition except SYNC_DOCUMENT) | Specify | Pending |
| SPACING-25 | The composed pass (case on pre-spacing structure; final case settles un-glued chips; one-application fixpoint) | Specify | Pending |
| SPACING-26 | The composed pass (reference stability + idempotence) | Specify | Pending |
| SPACING-27 | The composed pass (language-independent spacing constants; SET_CASE_FIX_LANGUAGE re-derive) | Specify | Pending |
| SPACING-28 | The composed pass (canonical output shape; line-break tokens untouched) | Specify | Pending |
| SPACING-29 | The composed pass (SYNC_DOCUMENT mid-typing skip) | Specify | Pending |
| SPACING-30 | Copy-time correction (settled payload, one component both surfaces) | Specify | Pending |
| SPACING-31 | Copy-time correction (transformed copy; document never mutated) | Specify | Pending |
| SPACING-32 | Copy-time correction (stale visible spacing → settled clipboard) | Specify | Pending |
| SPACING-33 | Copy-time correction (gating/toast/i18n unchanged; memo re-derives) | Specify | Pending |
| SPACING-34 | Extended comparison policy (guard through the composed pass — R1-Q9) | Specify | Pending |
| SPACING-35 | Extended comparison policy (edited-detection exact — spacing retyping freezes) | Specify | Pending |
| SPACING-36 | Extended comparison policy (focused-surface comparison exact) | Specify | Pending |
| SPACING-37 | Extended comparison policy (visibility consequences accepted; caret reset) | Specify | Pending |
| SPACING-38 | Records (ADR 0005 amended in place, dated 2026-10-23) | Specify | Pending |
| SPACING-39 | Records (no i18n/GLOSSARY/routes/DOM changes) | Specify | Pending |
| SPACING-40 | Records (roadmap checkoff + `?` annotation at completion, orchestrator) | Specify | Pending |

**ID format:** `SPACING-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified; additionally **Deviated** (implemented with a changed contract — see `implementation.md`) and **Deferred** (not implemented — see `implementation.md`).

**Coverage:** 40 total. 0 Verified, 0 Deviated, 0 Deferred. Roadmap mapping: 2.1 (the pass + rules, **as amended** — the `?` addition, the insertion policy, edges-as-seams) → SPACING-01–05 (removal), SPACING-06–10 (collapse + edges), SPACING-11–16 (insertion); 2.2 (wiring into the same trigger points; frozen skipped) → SPACING-17–20 (frozen), SPACING-24–29 (composed pass + wiring), SPACING-34–37 (comparison policy — the same mixed policy as Task 1, extended to the composed canonicalization); 2.3 (tests) → every story's Independent Test under the R1-Q13 behavior-level oracle policy. The roadmap Task 2.1 line is annotated at completion to record the `?` addition (user decision 2026-10-23); the insertion policy and the composed order are recorded in ADR 0005's amendment. Per-requirement outcomes: `.specs/features/preview-area-auto-fix/tasks/spacing-auto-fix/implementation.md` (to be created by the Developer sub-agent).

---

## Success Criteria

How we know the feature is successful:

- [ ] A document with spaces before `.` `,` `!` `?` `;` `:`, after `(`, around line breaks, doubled inside own text, or at the document edges is corrected at the next trigger; chips cut with trailing spaces have their edges treated as seam material; chip interiors and frozen chips (edges included) are byte-untouched.
- [ ] A punctuation-ending chip glued to word content gains exactly one space — chip↔own text, own text↔chip, and chip↔chip (edge or minted `${rightChipTokenId}:separator`); letter-ending glue (`Alphamytext`) and single-material interiors stay joined; conflicts resolve to zero spaces; over-budget insertions are skipped deterministically.
- [ ] The composed pass (case → spacing → case) settles the document in ONE application — `[chip "Hello,"][chip "World"]` becomes `"Hello, world"` in a single dispatch — and returns the reference-identical state whenever nothing changes.
- [ ] Copy (toolbar and modal) always writes the settled serialization, even while the visible document holds stale spacing; the context document is never mutated by copy.
- [ ] A spacing-only source re-emission is a reference-identical no-op (no re-render); a deliberate spacing retyping inside a chip freezes it; a correction while edit-ON+focused re-renders the surface (the accepted caret reset).
- [ ] The pinned glued seams (`Alphamytext`, `mytext XBeta`, `Xbeta`) stay byte-identical; the `'\nA bee '` seam reads `'\nA bee'`; every other changed oracle expectation is derived from the rules and listed.
- [ ] ADR 0005 carries the 2026-10-23 amendment exactly as drafted; no new i18n strings, no GLOSSARY changes, no DOM/testid changes in production code; the roadmap checkoff + annotation are applied by the orchestrator at completion.
- [ ] `npx vitest run`, `npm run lint`, and `npx tsc -b` pass; existing oracle suites stay green at the behavior level with only the listed assertion updates; the new unit spacing rule tables + creation/sort/copy integration suites are green.
