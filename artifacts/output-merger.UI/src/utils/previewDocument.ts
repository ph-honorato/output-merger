import type {
  Landing,
  OwnTextToken,
  PreviewToken,
  SnippetToken,
} from '../context/SnippetsContext';

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
 * every character of the merged output belongs to exactly one token
 *. `buildMergedText`'s successor.
 */
export function serialize(tokens: PreviewToken[]): string {
  let text = '';
  for (const token of tokens) {
    text += token.kind === 'line-break' ? '\n' : token.text;
  }
  return text;
}

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
