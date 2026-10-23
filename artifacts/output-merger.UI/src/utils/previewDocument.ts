import type {
  Landing,
  OwnTextToken,
  PreviewToken,
  SnippetToken,
} from '../context/SnippetsContext';
import { readEnvNumber } from './env';

/**
 * Globally unique token id for a source snippet inside the document
 * (`${sourceId}:${sourceSnippetId}`). Ids are unique within a source
 * only (the reducer tolerates cross-source snippet id collisions),
 * so bare snippet ids cannot key sortable items.
 */
export const buildSnippetTokenId = (
  sourceId: string,
  sourceSnippetId: string,
): string => `${sourceId}:${sourceSnippetId}`;

/**
 * Type guard for snippet tokens (the only sortable token kind).
 */
export const isSnippetToken = (
  token: PreviewToken,
): token is SnippetToken => token.kind === 'snippet';

/**
 * True for a `" "` own-text token — the explicit join separator
 * reconciliation inserts between snippet tokens so an unedited
 * document serializes byte-identically to the old `join(' ')`.
 */
export const isSeparatorToken = (token: PreviewToken): boolean =>
  token.kind === 'text' && token.text === ' ';

/**
 * Builds one `" "` separator token with the given id.
 */
export const makeSeparatorToken = (tokenId: string): OwnTextToken => ({
  kind: 'text',
  tokenId,
  text: ' ',
});

/**
 * Serializes the document: pure concatenation of token texts
 * (line-break tokens → "\n"). No trimming, no implicit separators —
 * every character of the merged output belongs to exactly one token.
 * `buildMergedText`'s successor.
 */
export function serialize(tokens: PreviewToken[]): string {
  let text = '';
  for (const token of tokens) {
    text += token.kind === 'line-break' ? '\n' : token.text;
  }
  return text;
}

/**
 * The document character limit: the serialized document's length
 * (the WYSIWYG invariant makes the flow's DOM text equal it; line
 * breaks count as one character each). At the limit, further
 * printable keystrokes and Enter are prevented and pastes truncate to
 * what fits — the native `maxLength` textarea feel. Deletions always
 * work. The value reads the `VITE_PREVIEW_MAX_LENGTH` environment
 * variable (a finite integer > 0), falling back to 2000.
 */
export const PREVIEW_DOCUMENT_MAX_LENGTH = readEnvNumber(
  'VITE_PREVIEW_MAX_LENGTH',
  2000,
);

/**
 * How many more characters the serialized document may take before
 * hitting the limit (0 when at it, negative over it — the limit is
 * never exceeded through the guarded paths, but a restored source or
 * a sync could momentarily exceed it).
 */
export const remainingDocumentLength = (tokens: PreviewToken[]): number =>
  PREVIEW_DOCUMENT_MAX_LENGTH - serialize(tokens).length;

/**
 * True when the serialized document has no room left for another
 * character.
 */
export const isDocumentAtLimit = (tokens: PreviewToken[]): boolean =>
  remainingDocumentLength(tokens) <= 0;

/**
 * Clamps a parsed document to the character limit by peeling the
 * over-budget tail, k = serialized length − limit units at a time:
 * a trailing text token loses units from its text tail (a fully
 * consumed token — separators included — is dropped whole); a
 * trailing line break costs one unit and is dropped; a trailing
 * snippet token loses units from its TEXT tail only — the chip
 * itself is never removed and its id and structure survive (an
 * exhausted chip keeps its id with the remaining text; the parser
 * prunes an emptied chip on the next parse). The peel repeats until
 * the document fits or nothing remains. Within the limit the input
 * is returned unchanged (same reference); the result always
 * satisfies serialize(result).length <= limit.
 */
export const clampDocumentToLimit = (
  tokens: PreviewToken[],
  limit: number
): { tokens: PreviewToken[]; removedUnits: number } => {
  const overflow = serialize(tokens).length - limit;
  if (overflow <= 0) {
    return { tokens, removedUnits: 0 };
  }
  const result = [...tokens];
  let toRemove = overflow;
  while (toRemove > 0 && result.length > 0) {
    const last = result[result.length - 1];
    if (last.kind === 'line-break') {
      result.pop();
      toRemove -= 1;
      continue;
    }
    const cut = Math.min(last.text.length, toRemove);
    if (cut >= last.text.length && last.kind === 'text') {
      result.pop();
      toRemove -= last.text.length;
      continue;
    }
    result[result.length - 1] = { ...last, text: last.text.slice(0, last.text.length - cut) };
    toRemove -= cut;
    if (cut === 0) {
      // A snippet with no text left to give: never removed — the
      // peel continues with the token before it.
      break;
    }
  }
  return { tokens: result, removedUnits: overflow - toRemove };
};

/**
 * Truncates text to a UTF-16 CODE-UNIT budget (the unit the
 * document limit and its counter measure): slice by units to the
 * budget, then drop a trailing lone high surrogate so a surrogate
 * pair is never split — the result never ends in a broken
 * character (even when the input itself does). The result's length
 * never exceeds the budget.
 */
export const truncateToUtf16Budget = (text: string, budget: number): string => {
  if (budget <= 0) {
    return '';
  }
  let fitting = text.slice(0, budget);
  const last = fitting.charCodeAt(fitting.length - 1);
  if (last >= 0xd800 && last <= 0xdbff && fitting.length > 0) {
    fitting = fitting.slice(0, -1);
  }
  return fitting;
};

/**
 * Content equality for two token arrays (ignores nothing but array
 * identity — ids, kinds, texts, and every snippet field compared).
 * Used for the reducer's no-op guards: a state that would not change
 * keeps its reference.
 */
export function tokensEqual(a: PreviewToken[], b: PreviewToken[]): boolean {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  return a.every((token, index) => {
    const other = b[index];
    if (token.kind !== other.kind || token.tokenId !== other.tokenId) {
      return false;
    }
    if (token.kind === 'snippet') {
      const snippet = other as SnippetToken;
      return (
        token.sourceSnippetId === snippet.sourceSnippetId &&
        token.sourceId === snippet.sourceId &&
        token.color === snippet.color &&
        token.text === snippet.text &&
        token.edited === snippet.edited
      );
    }
    if (token.kind === 'text') {
      return token.text === (other as OwnTextToken).text;
    }
    return true;
  });
}

/**
 * The document index of the snippet token at `snippetSlot` (0-based
 * among snippet tokens — the sortable population), or `tokens.length`
 * for the trailing slot / an empty document. This is the
 * token-index migration of the gap-slot landing math: a drop at gap
 * `slot` lands right before the chip occupying that slot, or at the
 * document end for the trailing gap.
 */
export function snippetSlotToTokenIndex(
  tokens: PreviewToken[],
  snippetSlot: number,
): number {
  let seen = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isSnippetToken(token)) {
      if (seen === snippetSlot) {
        return index;
      }
      seen += 1;
    }
  }
  return tokens.length;
}

// ---------------------------------------------------------------------------
// "a dragged snippet must be
// droppable at every word boundary of the document" — the landing
// model's pure helpers: droppable ids, the anchor enumeration (one
// anchor per position, dedupe included), and the chip-over insertion
// mapping.
// ---------------------------------------------------------------------------

/** Droppable id for a landing anchor (dnd-kit droppable + needle). */
export const buildLandingId = (landing: Landing): string =>
  landing.kind === 'token-gap'
    ? `preview-landing:g:${landing.tokenIndex}`
    : `preview-landing:s:${landing.tokenIndex}:${landing.boundaryOffset}`;

/** Inverse of buildLandingId: the landing, or null for any other id. */
export const parseLandingId = (id: string): Landing | null => {
  const gap = /^preview-landing:g:(\d+)$/.exec(id);
  if (gap) {
    return { kind: 'token-gap', tokenIndex: Number(gap[1]) };
  }
  const split = /^preview-landing:s:(\d+):(\d+)$/.exec(id);
  if (split) {
    return {
      kind: 'text-split',
      tokenIndex: Number(split[1]),
      boundaryOffset: Number(split[2]),
    };
  }
  return null;
};

/** The maximal whitespace-run boundaries of a text token's content. */
export const wordBoundaryOffsets = (text: string): number[] => {
  const offsets: number[] = [];
  for (let index = 1; index < text.length; index += 1) {
    if (/\s/.test(text[index]) && !/\s/.test(text[index - 1])) {
      offsets.push(index);
    }
  }
  return offsets;
};

export interface LandingAnchor {
  landing: Landing;
  id: string;
}

/**
 * The document's droppable landing anchors, in document order — one
 * anchor per position (the dedupe discipline: two anchors in one
 * spot make the collision ambiguous):
 * - a chip's before-anchor renders only when the preceding token is
 *   NOT a text token (doc start, after a chip, after a line break);
 *   when a text token immediately precedes the chip, that token's
 *   trailing-edge anchor IS the before-chip position;
 * - every text token contributes its LEADING edge (when the
 *   preceding token is not text — a preceding text token's
 *   trailing edge covers the spot), one anchor at the start of each
 *   whitespace run between words (the word boundary), and its
 *   TRAILING edge (omitted when the text is the LAST token: the
 *   trailing after-everything anchor covers the document end);
 * - line-break tokens contribute no anchors;
 * - the trailing after-everything anchor (token-gap at tokens.length)
 *   always renders.
 */
export function enumerateLandingAnchors(
  tokens: PreviewToken[]
): LandingAnchor[] {
  const anchors: LandingAnchor[] = [];
  const push = (landing: Landing) => {
    anchors.push({ landing, id: buildLandingId(landing) });
  };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const previous = index > 0 ? tokens[index - 1] : undefined;
    if (isSnippetToken(token)) {
      if (!previous || previous.kind !== 'text') {
        push({ kind: 'token-gap', tokenIndex: index });
      }
      continue;
    }
    if (token.kind === 'text') {
      if (!previous || previous.kind !== 'text') {
        push({ kind: 'text-split', tokenIndex: index, boundaryOffset: 0 });
      }
      for (const offset of wordBoundaryOffsets(token.text)) {
        push({ kind: 'text-split', tokenIndex: index, boundaryOffset: offset });
      }
      if (index < tokens.length - 1) {
        push({
          kind: 'text-split',
          tokenIndex: index,
          boundaryOffset: token.text.length,
        });
      }
    }
    // line-break tokens: no anchors
  }
  push({ kind: 'token-gap', tokenIndex: tokens.length });
  return anchors;
}

/**
 * The anchor landing for "right after token[tokenIndex]" (a chip-over
 * forward drop maps here): the next token's leading edge when it is
 * a text token, else the token-gap insertion after (before the next
 * chip / the trailing anchor).
 */
export const landingAfterToken = (
  tokens: PreviewToken[],
  tokenIndex: number
): Landing => {
  const next = tokens[tokenIndex + 1];
  if (next && next.kind === 'text') {
    return { kind: 'text-split', tokenIndex: tokenIndex + 1, boundaryOffset: 0 };
  }
  return { kind: 'token-gap', tokenIndex: tokenIndex + 1 };
};

/**
 * The anchor landing for "right before token[tokenIndex]" (a
 * chip-over backward drop maps here): the preceding text token's
 * trailing edge when it is a text token, else the token-gap
 * insertion before (the chip's before-anchor position).
 */
export const landingBeforeToken = (
  tokens: PreviewToken[],
  tokenIndex: number
): Landing => {
  const previous = tokenIndex > 0 ? tokens[tokenIndex - 1] : undefined;
  if (previous && previous.kind === 'text') {
    return {
      kind: 'text-split',
      tokenIndex: tokenIndex - 1,
      boundaryOffset: previous.text.length,
    };
  }
  return { kind: 'token-gap', tokenIndex };
};

/**
 * Merges every run of ADJACENT
 * own-text tokens into one token (the first token's id kept, texts
 * concatenated; never across line-break or snippet tokens). The
 * reducer runs this over every action's result so the model and every
 * parse agree on SHAPE, not just serialization — the parser's
 * text-piece merge (same round) makes every parse emit one token per
 * contiguous text run, and the reducer's own transitions (source
 * appends next to typed text, move replants, text-split pads) can
 * produce adjacency; without normalization the same visible document
 * could behave differently depending on its merge history (the
 * the move carry and the source-delete cleanup both read
 * `isSeparatorToken`). Serialization is never changed — merging only
 * concatenates. REFERENCE-IDENTITY GUARD: an array with no adjacent
 * text run is returned as the SAME reference (the no-op-sync absorb
 * mechanism and the memo discipline rely on untouched states never
 * churning).
 */
export function normalizeTextTokens(tokens: PreviewToken[]): PreviewToken[] {
  const hasAdjacentRun = tokens.some(
    (token, index) => token.kind === 'text' && tokens[index + 1]?.kind === 'text',
  );
  if (!hasAdjacentRun) {
    return tokens;
  }
  const merged: PreviewToken[] = [];
  for (const token of tokens) {
    const previous = merged[merged.length - 1];
    if (token.kind === 'text' && previous?.kind === 'text') {
      merged[merged.length - 1] = {
        kind: 'text',
        tokenId: previous.tokenId,
        text: previous.text + token.text,
      };
    } else {
      merged.push(token);
    }
  }
  return merged;
}

/**
 * Content equality ignoring the snippet `edited` flag — the only
 * field the reducer's SYNC_DOCUMENT transform changes on a parsed
 * document (non-snippet tokens pass through untouched; snippet
 * tokens keep their id and text). The focused editable surface uses
 * this to recognize its own parsed edit among incoming document
 * changes: a NO-OP sync returns reference-identical state (no
 * re-render), so a one-shot flag would stick and wrongly absorb the
 * next external change.
 */
export function tokensEqualIgnoringEdited(
  a: PreviewToken[],
  b: PreviewToken[],
): boolean {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  return a.every((token, index) => {
    const other = b[index];
    if (token.kind !== other.kind) {
      return false;
    }
    if (token.kind === 'snippet') {
      const snippet = other as SnippetToken;
      return token.tokenId === snippet.tokenId && token.text === snippet.text;
    }
    if (token.kind === 'text') {
      return token.text === (other as OwnTextToken).text;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// The case-fix pass. A snippet token's casing follows its merged
// context: the first letter of the first word is capitalized at a
// sentence start and lowercased mid-sentence, subject to guards for
// words whose casing carries meaning. Only snippet tokens transform —
// own-text tokens, line-break tokens, and user-edited (frozen) tokens
// are never touched — and the transform is case-only: it replaces the
// first character with its upper/lowercase counterpart of the same
// length, never a longer mapping.
// ---------------------------------------------------------------------------

/**
 * The rule set the case-fix pass runs with, selected by the active UI
 * language tag. All languages share the same engine; the table is the
 * per-language extension point.
 */
export interface CaseFixRuleSet {
  /**
   * The locale tag forwarded to the per-character casing transforms.
   */
  locale: string;
  /**
   * First words the all-caps guard does NOT protect: each listed
   * word follows the general contextual rules instead of staying
   * frozen in its all-caps form.
   */
  allCapsExceptions: readonly string[];
  /**
   * Characters that classify a sentence end when they are the
   * predecessor's last MEANINGFUL character (after trailing
   * whitespace and closing wrappers strip).
   */
  sentenceEndChars: readonly string[];
  /**
   * Trailing closing quotes/brackets/parentheses — stripped together
   * with trailing whitespace before the sentence-end check reads the
   * predecessor's last meaningful character.
   */
  closingWrapperChars: readonly string[];
}

const buildCaseFixRuleSet = (
  locale: string,
  allCapsExceptions: readonly string[],
): CaseFixRuleSet => ({
  locale,
  allCapsExceptions,
  sentenceEndChars: ['.', '!', '?', '…'],
  closingWrapperChars: [')', ']', '}', '"', "'", '”', '’', '»'],
});

// Keyed by the language tag's primary subtag ("en" from "en-US",
// "pt" from "pt-BR" — the i18n instance exposes both forms).
const CASE_FIX_RULE_SETS: Record<string, CaseFixRuleSet> = {
  en: buildCaseFixRuleSet('en-US', ['I']),
  pt: buildCaseFixRuleSet('pt-BR', ['I']),
};

const DEFAULT_CASE_FIX_RULE_SET = CASE_FIX_RULE_SETS.en;

/**
 * The rule set for a UI language tag. An unknown or missing tag falls
 * back to the default rule set.
 */
export function caseFixRuleSetFor(
  languageTag: string | undefined,
): CaseFixRuleSet {
  if (!languageTag) {
    return DEFAULT_CASE_FIX_RULE_SET;
  }
  const primary = languageTag.split('-')[0];
  return CASE_FIX_RULE_SETS[primary] ?? DEFAULT_CASE_FIX_RULE_SET;
}

const isWhitespaceChar = (char: string): boolean => /\s/.test(char);
const isLetterChar = (char: string): boolean => /\p{L}/u.test(char);
const isCasedChar = (char: string): boolean => /\p{Cased}/u.test(char);
const isUppercaseChar = (char: string): boolean => /\p{Uppercase}/u.test(char);

/**
 * The merged-context classification of the token at `index`:
 * - `sentence-start`: the document start, a line-break predecessor,
 *   or a predecessor whose last meaningful character is a sentence
 *   end;
 * - `glued`: the token directly abuts non-whitespace content (no
 *   whitespace boundary) — mid-word casing is context-free, so the
 *   token is left alone;
 * - `mid-sentence`: anything else.
 *
 * The look-back walks past separator/whitespace-only tokens (and
 * tokens whose text is empty) to the last meaningful content; a
 * line-break token found on the walk classifies a sentence start.
 */
export type TokenCaseContext = 'sentence-start' | 'mid-sentence' | 'glued';

export function classifyTokenContext(
  tokens: PreviewToken[],
  index: number,
  ruleSet: CaseFixRuleSet = DEFAULT_CASE_FIX_RULE_SET,
): TokenCaseContext {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const predecessor = tokens[cursor];
    if (predecessor.kind === 'line-break') {
      return 'sentence-start';
    }
    const text = predecessor.text;
    if (cursor === index - 1 && text.length > 0) {
      const lastChar = text[text.length - 1];
      if (!isWhitespaceChar(lastChar)) {
        return 'glued';
      }
    }
    // Strip trailing whitespace and closing wrapper characters until
    // the last meaningful character stands at the end.
    let end = text.length;
    while (
      end > 0 &&
      (isWhitespaceChar(text[end - 1]) ||
        ruleSet.closingWrapperChars.includes(text[end - 1]))
    ) {
      end -= 1;
    }
    if (end === 0) {
      continue; // whitespace-only/empty token: keep looking back
    }
    const lastMeaningful = text[end - 1];
    return ruleSet.sentenceEndChars.includes(lastMeaningful)
      ? 'sentence-start'
      : 'mid-sentence';
  }
  return 'sentence-start'; // only whitespace (or nothing) precedes
}

/**
 * The first word of `text` — the leading run of non-whitespace
 * characters (starts at index 0).
 */
const firstWordOf = (text: string): string => {
  let end = 0;
  while (end < text.length && !isWhitespaceChar(text[end])) {
    end += 1;
  }
  return text.slice(0, end);
};

/**
 * True when the word carries at least one cased character and every
 * cased character is uppercase — acronyms ("NASA", "API") and single
 * initials ("A", "B").
 */
const isAllCapsWord = (word: string): boolean => {
  let sawCased = false;
  for (const char of word) {
    if (isCasedChar(char)) {
      sawCased = true;
      if (!isUppercaseChar(char)) {
        return false;
      }
    }
  }
  return sawCased;
};

/**
 * True when the word has an uppercase cased character AFTER its first
 * character ("iPhone", "eBay", "McDonald's") — an interior uppercase
 * is part of the word's written form, so re-casing the first letter
 * would corrupt it.
 */
const hasInteriorUppercase = (word: string): boolean => {
  for (let index = 1; index < word.length; index += 1) {
    if (isUppercaseChar(word[index])) {
      return true;
    }
  }
  return false;
};

/**
 * The case-fix pass over a whole document: every non-edited snippet
 * token's first character is re-derived from its merged context —
 * `toLocaleUpperCase` at a sentence start, `toLocaleLowerCase`
 * mid-sentence — under the guards:
 * - frozen tokens (`edited === true`) never transform;
 * - an empty text or a non-letter first character never transforms;
 * - a glued token (no whitespace boundary before it) never
 *   transforms;
 * - an all-caps first word never transforms, except a word the
 *   rule set's allCapsExceptions list exempts (it follows the
 *   general contextual rules like any other word);
 * - a first word with an interior uppercase never transforms.
 *
 * The replacement must be a single character of the same length — a
 * casing mapping that expands ("ß" → "SS") is skipped so token
 * lengths (and the document's serialized length) never change.
 *
 * Pure and reference-stable: untouched tokens keep their object
 * references, and a document where nothing transforms returns the
 * SAME array reference. Re-running the pass over its own output
 * yields content-identical tokens (idempotent) — the classification
 * reads only predecessor characters (whitespace/wrapper/sentence-end
 * identity), so a corrected token classifies its successors exactly
 * as the original did.
 */
export function applyCaseFix(
  tokens: PreviewToken[],
  languageTag?: string,
): PreviewToken[] {
  const ruleSet = caseFixRuleSetFor(languageTag);
  let result: PreviewToken[] | null = null;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!isSnippetToken(token) || token.edited) {
      continue;
    }
    const firstChar = token.text[0];
    if (firstChar === undefined || !isLetterChar(firstChar)) {
      continue;
    }
    const context = classifyTokenContext(tokens, index, ruleSet);
    if (context === 'glued') {
      continue;
    }
    const firstWord = firstWordOf(token.text);
    if (!ruleSet.allCapsExceptions.includes(firstWord) && isAllCapsWord(firstWord)) {
      continue;
    }
    if (hasInteriorUppercase(firstWord)) {
      continue;
    }
    const fixed =
      context === 'sentence-start'
        ? firstChar.toLocaleUpperCase(ruleSet.locale)
        : firstChar.toLocaleLowerCase(ruleSet.locale);
    if (fixed.length !== 1 || fixed === firstChar) {
      continue;
    }
    if (result === null) {
      result = [...tokens];
    }
    result[index] = { ...token, text: fixed + token.text.slice(1) };
  }
  return result ?? tokens;
}

/**
 * Content equality of two token arrays in their case-fix-canonical
 * forms: both sides run through the pass (idempotent — an already
 * canonical array returns itself) before the exact content
 * comparison, so two documents that differ only in pass-correctable
 * case compare equal. The no-op guard of snippet reconciliation — a
 * re-emission whose texts differ from the stored tokens only in case
 * is "no change", while a genuine text difference is not.
 */
export function tokensEqualCanonicalCase(
  a: PreviewToken[],
  b: PreviewToken[],
  languageTag?: string,
): boolean {
  return tokensEqual(
    applyCaseFix(a, languageTag),
    applyCaseFix(b, languageTag),
  );
}

/**
 * Parses the editable flow's DOM back into document tokens (the pure
 * DOM→tokens half of the per-input sync). Rules:
 * - element with a `data-token-id` → a snippet token keyed by that
 *   id; its `textContent` is the token text (typed-inside text
 *   integrates into the token instead of splitting). An emptied chip is
 *   pruned (a fully-deleted snippet token vanishes). A duplicate
 *   token id degrades to plain text — the document never carries
 *   corrupt tokens.
 * - text node → own-text tokens, split at every "\n" into text runs
 *   and line-break tokens; every character belongs to exactly one
 *   token; empty artifacts are pruned.
 * - any other element (insertion-gap anchors, the drop-indicator
 *   needle, stray wrapper tags a browser or a text drop created) is
 *   a transparent container: the walk recurses into it, so unknown
 *   DOM flattens to its text content.
 *
 * Snippet metadata not present in the DOM (sourceSnippetId,
 * sourceId, color) is inherited from `previousTokens` by token id;
 * for an id the model has never seen (corrupt DOM) the id is split
 * at its first ":" as a best effort. The `edited` flag is NOT
 * inferred here — the reducer computes it during the sync (the
 * previous model's flag vs the parsed text).
 */
export function parsePreviewDom(
  root: Element,
  previousTokens: PreviewToken[] = [],
): PreviewToken[] {
  const previousSnippetById = new Map<string, SnippetToken>();
  for (const token of previousTokens) {
    if (isSnippetToken(token)) {
      previousSnippetById.set(token.tokenId, token);
    }
  }

  const tokens: PreviewToken[] = [];
  const seenSnippetIds = new Set<string>();
  let generatedId = 0;
  const nextGeneratedId = (prefix: string) => {
    generatedId += 1;
    return `${prefix}:${generatedId}`;
  };

  // consecutive text-node contributions MERGE across
  // transparent elements (the landing anchors render INSIDE text
  // tokens, splitting them into multiple DOM text nodes — without
  // merging, every render/parse cycle would fragment the model's
  // text tokens). The buffer flushes before a snippet token and at
  // the end; line breaks inside the buffer split it as always.
  let pendingText = '';
  const flushPendingText = () => {
    const raw = pendingText;
    pendingText = '';
    if (raw.length === 0) {
      return;
    }
    let start = 0;
    for (let index = 0; index <= raw.length; index += 1) {
      const atNewline = index < raw.length && raw[index] === '\n';
      if (index === raw.length || atNewline) {
        if (index > start) {
          tokens.push({
            kind: 'text',
            tokenId: nextGeneratedId('own-text'),
            text: raw.slice(start, index),
          });
        }
        if (atNewline) {
          tokens.push({
            kind: 'line-break',
            tokenId: nextGeneratedId('line-break'),
          });
        }
        start = index + 1;
      }
    }
  };
  const pushTextContent = (raw: string) => {
    pendingText += raw;
  };

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushTextContent(node.textContent ?? '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const element = node as HTMLElement;
    const tokenId = element.dataset?.tokenId;
    if (tokenId !== undefined && tokenId !== '') {
      if (seenSnippetIds.has(tokenId)) {
        // A duplicated chip is corrupt DOM: degrade to its text
        // content so the document never carries duplicate ids.
        pushTextContent(element.textContent ?? '');
        return;
      }
      seenSnippetIds.add(tokenId);
      const text = element.textContent ?? '';
      if (text.length > 0) {
        flushPendingText();
        const previous = previousSnippetById.get(tokenId);
        const separatorAt = tokenId.indexOf(':');
        tokens.push({
          kind: 'snippet',
          tokenId,
          sourceSnippetId:
            previous?.sourceSnippetId ??
            (separatorAt >= 0 ? tokenId.slice(separatorAt + 1) : tokenId),
          sourceId:
            previous?.sourceId ??
            (separatorAt >= 0 ? tokenId.slice(0, separatorAt) : tokenId),
          color: previous?.color ?? 'transparent',
          text,
          edited: false,
        });
      }
      return;
    }
    node.childNodes.forEach(visit);
  };

  Array.from(root.childNodes).forEach(visit);
  flushPendingText();
  return tokens;
}
