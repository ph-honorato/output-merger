import {
  buildSnippetTokenId,
  isSeparatorToken,
  isSnippetToken,
  makeSeparatorToken,
  tokensEqual,
} from '../../utils/previewDocument';
import type {
  PreviewToken,
  SetSourceSnippetsAction,
  SnippetsAction,
  SnippetsState,
  SnippetToken,
} from './SnippetsContext.types';

/**
 * The initial session state: an empty document, no tombstones,
 * editing off.
 */
export const initialSnippetsState: SnippetsState = {
  tokens: [],
  tombstones: [],
  editEnabled: false,
};

const sameStringSets = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value) => b.includes(value));

/**
 * SET_SOURCE_SNIPPETS — diff-by-id reconciliation (ADR 0001), now
 * over snippet tokens inside the document (ADR 0004):
 * - known ids update in place (a resize rewrites an unedited
 *   token's text; edited tokens are text-frozen; position, color,
 *   and identity never change);
 * - missing ids are removed together with ONE adjacent `" "`
 *   separator token (the preceding one when present, else the
 *   following one) so an unedited flow keeps serializing like the
 *   old join — and the snippet's tombstone, if any, clears (the
 *   emission no longer reports it);
 * - new ids append at the document end, in emission order, each
 *   preceded by one `" "` separator token — unless tombstoned
 *   (a user-deleted snippet is never resurrected);
 * - a tombstoned id that the emission still reports keeps its
 *   tombstone (it blocks re-append for the session).
 */
function reconcileSourceSnippets(
  state: SnippetsState,
  action: SetSourceSnippetsAction,
): SnippetsState {
  const { sourceId, snippets } = action;

  const incomingByKey = new Map(
    snippets.map((snippet) => [
      buildSnippetTokenId(sourceId, snippet.id),
      snippet,
    ] as const),
  );
  const incomingIds = new Set(snippets.map((snippet) => snippet.id));

  const tokens: PreviewToken[] = [];
  const keptSnippetKeys = new Set<string>();
  // Set when a removed snippet's adjacent separator must be taken
  // from the tokens that FOLLOW it (no preceding one existed).
  let skipFollowingSeparator = false;

  for (const token of state.tokens) {
    if (skipFollowingSeparator) {
      skipFollowingSeparator = false;
      if (isSeparatorToken(token)) {
        continue;
      }
    }
    if (isSnippetToken(token) && token.sourceId === sourceId) {
      const incoming = incomingByKey.get(token.tokenId);
      if (!incoming) {
        // Source snippet deleted: drop the token together with one
        // adjacent separator (preceding when present, else the next
        // one) so an unedited flow keeps serializing like the join.
        if (tokens.length > 0 && isSeparatorToken(tokens[tokens.length - 1])) {
          tokens.pop();
        } else {
          skipFollowingSeparator = true;
        }
        continue;
      }
      keptSnippetKeys.add(token.tokenId);
      tokens.push(token.edited ? token : { ...token, text: incoming.text });
      continue;
    }
    tokens.push(token);
  }

  // New snippet ids append at the document end, in emission order,
  // each preceded by one " " separator token once the document has
  // any content — the join-parity rule. Tombstoned ids never
  // re-append.
  for (const [key, snippet] of incomingByKey) {
    if (keptSnippetKeys.has(key) || state.tombstones.includes(key)) {
      continue;
    }
    if (tokens.length > 0) {
      tokens.push(makeSeparatorToken(`${key}:separator`));
    }
    tokens.push({
      kind: 'snippet',
      tokenId: key,
      sourceSnippetId: snippet.id,
      sourceId,
      color: snippet.color,
      text: snippet.text,
      edited: false,
    });
  }

  // Tombstone hygiene: a tombstone for an id this emission no longer
  // reports clears (the source deleted the snippet); a tombstone for
  // an id it still reports stays (it keeps blocking re-append).
  const prefix = `${sourceId}:`;
  const tombstones = state.tombstones.filter(
    (key) => !key.startsWith(prefix) || incomingIds.has(key.slice(prefix.length)),
  );

  if (
    tokensEqual(tokens, state.tokens) &&
    sameStringSets(tombstones, state.tombstones)
  ) {
    return state;
  }
  return { ...state, tokens, tombstones };
}

/**
 * MOVE_TOKEN — the Task 1 reorder migrated onto the document
 * (ADR 0004 / ADR 0001 amendment): a token-index move with NO
 * renumbering (array position IS the order). `toIndex` is an
 * insertion point into the current array (insert before the token
 * at that index; === length appends).
 *
 * Separator hygiene (forced by the pinned WYSIWYG parity — an
 * unedited document keeps serializing byte-identically to the old
 * `join(' ')` across reorders): the moved chip takes ONE adjacent
 * `" "` separator with it (the preceding one when present, else the
 * following one) and re-inserts THAT SAME TOKEN OBJECT (id and
 * identity preserved — ids are never minted here, so they stay
 * unique across any sequence of moves) on whichever side of the
 * landing point lacks a separator — before the chip when the token
 * before the landing point is not a separator, after the chip when
 * it is (or at the document start). The carried separator is NEVER
 * dropped: a move only ever relocates content, so the document's
 * character multiset is preserved in edited documents too.
 *
 * A move that does not change the chip's position among snippet
 * tokens (its own gap, a drop on itself) is inert: content-identical
 * state.
 */
function moveTokenInDocument(
  state: SnippetsState,
  fromIndex: number,
  toIndex: number,
): SnippetsState {
  const tokens = state.tokens;
  if (fromIndex < 0 || fromIndex >= tokens.length || toIndex < 0 || toIndex > tokens.length) {
    return state;
  }
  const token = tokens[fromIndex];
  if (!isSnippetToken(token)) {
    return state;
  }

  const before = fromIndex > 0 ? tokens[fromIndex - 1] : undefined;
  const after = fromIndex + 1 < tokens.length ? tokens[fromIndex + 1] : undefined;
  const carriedPreceding = before !== undefined && isSeparatorToken(before);
  const carriedFollowing =
    !carriedPreceding && after !== undefined && isSeparatorToken(after);
  // The actual adjacent separator token that travels with the chip:
  // the very same object (and id) is re-inserted at the landing
  // point — nothing is minted, nothing is dropped.
  const carriedSeparator: PreviewToken | null = carriedPreceding
    ? (before ?? null)
    : carriedFollowing
      ? (after ?? null)
      : null;

  const reduced = [...tokens];
  const removedOriginalIndexes = [fromIndex];
  if (carriedPreceding) {
    reduced.splice(fromIndex - 1, 2);
    removedOriginalIndexes.push(fromIndex - 1);
  } else if (carriedFollowing) {
    reduced.splice(fromIndex, 2);
    removedOriginalIndexes.push(fromIndex + 1);
  } else {
    reduced.splice(fromIndex, 1);
  }

  // The insertion point shifts by every removal that happened
  // before it (the reducer owns what computeGapMoveIndex used to
  // compute at the call site).
  const landingIndex =
    toIndex - removedOriginalIndexes.filter((index) => index < toIndex).length;

  const insert: PreviewToken[] = [token];
  if (carriedSeparator !== null) {
    const landsAfterSeparator =
      landingIndex > 0 && isSeparatorToken(reduced[landingIndex - 1]);
    // Left side covered (or the chip lands at the document start):
    // replant on the right; otherwise plant before the chip. Either
    // way the carried token is re-inserted — a move never deletes
    // content, even when the landing's other side already has a
    // separator of its own.
    if (landsAfterSeparator || landingIndex === 0) {
      insert.push(carriedSeparator);
    } else {
      insert.unshift(carriedSeparator);
    }
  }
  reduced.splice(landingIndex, 0, ...insert);

  // Inert move: the chip's position among the snippet tokens did
  // not change (its own gap, a drop back onto itself) — the state
  // stays reference-identical.
  const snippetPositionOf = (arr: PreviewToken[]): number => {
    let seen = 0;
    for (const candidate of arr) {
      if (isSnippetToken(candidate)) {
        if (candidate.tokenId === token.tokenId) {
          return seen;
        }
        seen += 1;
      }
    }
    return -1;
  };
  if (snippetPositionOf(tokens) === snippetPositionOf(reduced)) {
    return state;
  }

  if (tokensEqual(reduced, tokens)) {
    return state;
  }
  return { ...state, tokens: reduced };
}

/**
 * SYNC_DOCUMENT — the whole-document parsed-edit sync: one action
 * per input event replaces the tokens wholesale. The reducer owns
 * what the pure parser cannot infer:
 * - a snippet token whose text changed vs the previous model token
 *   with the same id becomes "edited" (typed inside; never resets —
 *   unchanged text keeps the previous flag);
 * - every snippet token id the parse no longer contains was fully
 *   deleted by the user: its id is tombstoned so later source
 *   emissions cannot resurrect it (in-memory only).
 */
function syncParsedDocument(
  state: SnippetsState,
  parsedTokens: PreviewToken[],
): SnippetsState {
  const previousSnippetById = new Map<string, SnippetToken>();
  for (const token of state.tokens) {
    if (isSnippetToken(token)) {
      previousSnippetById.set(token.tokenId, token);
    }
  }

  const tokens = parsedTokens.map((token) => {
    if (!isSnippetToken(token)) {
      return token;
    }
    const previous = previousSnippetById.get(token.tokenId);
    if (!previous) {
      return token;
    }
    if (previous.text !== token.text) {
      return { ...token, edited: true };
    }
    return { ...token, edited: previous.edited };
  });

  const tombstones = [...state.tombstones];
  for (const tokenId of previousSnippetById.keys()) {
    const stillPresent = parsedTokens.some(
      (token) => isSnippetToken(token) && token.tokenId === tokenId,
    );
    if (!stillPresent && !tombstones.includes(tokenId)) {
      tombstones.push(tokenId);
    }
  }

  if (
    tokensEqual(tokens, state.tokens) &&
    sameStringSets(tombstones, state.tombstones)
  ) {
    return state;
  }
  return { ...state, tokens, tombstones };
}

export const snippetsReducer = (
  state: SnippetsState,
  action: SnippetsAction,
): SnippetsState => {
  switch (action.type) {
    case 'SET_SOURCE_SNIPPETS': {
      return reconcileSourceSnippets(state, action);
    }
    case 'MOVE_TOKEN': {
      return moveTokenInDocument(state, action.fromIndex, action.toIndex);
    }
    case 'SYNC_DOCUMENT': {
      return syncParsedDocument(state, action.tokens);
    }
    case 'SET_EDIT_ENABLED': {
      return action.editEnabled === state.editEnabled
        ? state
        : { ...state, editEnabled: action.editEnabled };
    }
    default:
      return state;
  }
};
