import type {
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
 * (ADR 0004). `buildMergedText`'s successor.
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
 *   integrates into the token — deviation b). An emptied chip is
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

  const pushTextContent = (raw: string) => {
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
  return tokens;
}
