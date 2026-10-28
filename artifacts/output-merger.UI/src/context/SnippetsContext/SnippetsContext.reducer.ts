import { i18n } from '@translation';
import {
  applyAutoFix,
  buildSnippetTokenId,
  isSeparatorToken,
  isSnippetToken,
  makeSeparatorToken,
  normalizeTextTokens,
  serialize,
  tokensEqual,
  tokensEqualCanonicalCase,
} from '@utils/previewDocument';
import type {
  Landing,
  PreviewToken,
  SetSourceSnippetsAction,
  SnippetsAction,
  SnippetsState,
  SnippetToken,
} from './SnippetsContext.types';

/**
 * The initial session state: an empty document, no tombstones,
 * editing off. The case-fix language seeds from the ambient UI
 * language once, here at store creation; afterwards the language
 * rides in state and every transition derives from the field.
 */
export const initialSnippetsState: SnippetsState = {
  tokens: [],
  tombstones: [],
  editEnabled: false,
  caseFixLanguage: i18n.language,
};

const sameStringSets = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value) => b.includes(value));

/**
 * SET_SOURCE_SNIPPETS — diff-by-id reconciliation over the
 * document's snippet tokens:
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

  // No-op guard, canonical through the composed auto-fix pass: the
  // would-be tokens are compared to the stored ones in their
  // pass-canonical forms (case and spacing), so a re-emission whose
  // snippet texts differ from the stored ones only in what the pass
  // corrects — case, or seam/edge spacing — is "no change" and keeps
  // the reference-identical state (no re-render, no focused-surface
  // remount). A genuine text difference still transitions.
  if (
    tokensEqualCanonicalCase(tokens, state.tokens, state.caseFixLanguage) &&
    sameStringSets(tombstones, state.tombstones)
  ) {
    return state;
  }
  return { ...state, tokens, tombstones };
}

interface ChipExtraction {
  token: SnippetToken;
  reduced: PreviewToken[];
  removedOriginalIndexes: number[];
  carriedSeparator: PreviewToken | null;
}

/**
 * extraction, shared by MOVE_TOKEN and the landing move
 * move: the chip leaves with ONE adjacent " " separator (the
 * preceding when present, else the following — the same object, id
 * and identity) and the removals are recorded for landing-index
 * adjustment.
 */
function extractChipWithSeparator(
  tokens: PreviewToken[],
  fromIndex: number,
): ChipExtraction | null {
  const token = tokens[fromIndex];
  if (!isSnippetToken(token)) {
    return null;
  }
  const before = fromIndex > 0 ? tokens[fromIndex - 1] : undefined;
  const after = fromIndex + 1 < tokens.length ? tokens[fromIndex + 1] : undefined;
  const carriedPreceding = before !== undefined && isSeparatorToken(before);
  const carriedFollowing =
    !carriedPreceding && after !== undefined && isSeparatorToken(after);
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
  return { token, reduced, removedOriginalIndexes, carriedSeparator };
}

/** The chip's 0-based position among the snippet tokens (-1 absent). */
const snippetPositionOf = (arr: PreviewToken[], tokenId: string): number => {
  let seen = 0;
  for (const candidate of arr) {
    if (isSnippetToken(candidate)) {
      if (candidate.tokenId === tokenId) {
        return seen;
      }
      seen += 1;
    }
  }
  return -1;
};

/** Splits raw text into its trailing/leading whitespace runs. */
const whitespacePads = (raw: string): { pad: string; core: string } => {
  const padMatch = /\s*$/.exec(raw);
  const pad = padMatch ? padMatch[0] : '';
  return { pad, core: raw.slice(0, raw.length - pad.length) };
};
const whitespacePadsReversed = (raw: string): { pad: string; core: string } => {
  const padMatch = /^\s*/.exec(raw);
  const pad = padMatch ? padMatch[0] : '';
  return { pad, core: raw.slice(pad.length) };
};

/**
 * MOVE_TOKEN_TO_LANDING, the text-split half — a dragged snippet
 * drops at every word boundary. The chip leaves with its carried
 * separator and
 * lands INSIDE the target text token, splitting it at the boundary:
 * the boundary's own whitespace runs pad the sides that have them,
 * the carried separator plants the side that lacks one, and a side
 * with neither pad nor carried separator gets one planted (the
 * documented multiset exception — the global >=1-space rule
 * justifies adding; never-steal holds everywhere). A landing on a
 * token the carry removed (the chip's own separator) is the chip's
 * own neighborhood: the move no-ops. Space accounting against the
 * neighbors: a side needs a space only when it abuts non-whitespace
 * TEXT content (a chip-adjacent or line-break-adjacent side glues
 * like today's seams — no invented spaces beyond the pads, the
 * carried, and the text-abutting plants).
 */
function moveTokenToTextSplit(
  state: SnippetsState,
  fromIndex: number,
  landing: { tokenIndex: number; boundaryOffset: number },
): SnippetsState {
  const tokens = state.tokens;
  if (fromIndex < 0 || fromIndex >= tokens.length) {
    return state;
  }
  const target = tokens[landing.tokenIndex];
  if (
    landing.tokenIndex < 0 ||
    landing.tokenIndex >= tokens.length ||
    !target ||
    target.kind !== 'text'
  ) {
    return state;
  }
  if (landing.boundaryOffset < 0 || landing.boundaryOffset > target.text.length) {
    return state;
  }
  const extraction = extractChipWithSeparator(tokens, fromIndex);
  if (!extraction) {
    return state;
  }
  const { token, reduced, removedOriginalIndexes, carriedSeparator } = extraction;
  if (removedOriginalIndexes.includes(landing.tokenIndex)) {
    // The landing token was the chip's own carried separator: its
    // anchors ceased to exist with the removal — the chip returns to
    // its neighborhood (inert).
    return state;
  }
  // Own-adjacent spot: the chip is GLUED to the landing text token's
  // facing edge (its own seam, separator-free) — the chip already
  // sits exactly at the marked spot, so the drop is inert and must
  // not even plant the missing seam spaces.
  if (
    (landing.tokenIndex === fromIndex - 1 &&
      landing.boundaryOffset === target.text.length) ||
    (landing.tokenIndex === fromIndex + 1 && landing.boundaryOffset === 0)
  ) {
    return state;
  }
  const adjusted =
    landing.tokenIndex -
    removedOriginalIndexes.filter((index) => index < landing.tokenIndex).length;
  const textToken = reduced[adjusted];
  if (!textToken || textToken.kind !== 'text') {
    return state;
  }

  const raw = textToken.text;
  const left = raw.slice(0, landing.boundaryOffset);
  const right = raw.slice(landing.boundaryOffset);
  const { pad: padL, core: coreL } = whitespacePads(left);
  const { pad: padR, core: coreR } = whitespacePadsReversed(right);

  // A side needs a separating space iff the chip would abut
  // non-whitespace content on it: the split's own core, or — when
  // the core is empty — the adjacent token being a text token whose
  // edge character is not whitespace, or a chip (the plain move
  // plants between chips too; a line-break or document edge separates by
  // itself and never triggers a plant).
  const beforeNeighbor = adjusted > 0 ? reduced[adjusted - 1] : undefined;
  const beforeAbutsContent =
    coreL.length > 0 ||
    (beforeNeighbor !== undefined &&
      ((beforeNeighbor.kind === 'text' &&
        !/\s/.test(beforeNeighbor.text.slice(-1))) ||
        beforeNeighbor.kind === 'snippet'));
  const afterNeighbor =
    adjusted + 1 < reduced.length ? reduced[adjusted + 1] : undefined;
  const afterAbutsContent =
    coreR.length > 0 ||
    (afterNeighbor !== undefined &&
      ((afterNeighbor.kind === 'text' &&
        !/\s/.test(afterNeighbor.text.slice(0, 1))) ||
        afterNeighbor.kind === 'snippet'));

  let beforePad = padL;
  let afterPad = padR;
  // The carried separator always lands (it is never dropped): a
  // needing side first, else the before side keeps it (a multiset-
  // preserving append for exotic mid-run offsets).
  if (carriedSeparator !== null && carriedSeparator.kind === 'text') {
    if (beforePad === '' && beforeAbutsContent) {
      beforePad = carriedSeparator.text;
    } else if (afterPad === '' && afterAbutsContent) {
      afterPad = carriedSeparator.text;
    } else {
      beforePad += carriedSeparator.text;
    }
  }
  // The documented multiset exception: a side abutting content
  // with no pad and no carried separator gets one planted — the
  // global >=1-space rule justifies adding; never-steal holds.
  if (beforePad === '' && beforeAbutsContent) {
    beforePad = ' ';
  }
  if (afterPad === '' && afterAbutsContent) {
    afterPad = ' ';
  }

  // Minted split ids: unique per document state (a chip may move into
  // text splits repeatedly; the counter scans the surviving
  // `${tokenId}:split-`-prefixed ids so no two tokens ever share an
  // id — the React keys and the token-id uniqueness stay safe).
  const splitPrefix = `${token.tokenId}:split-`;
  let splitCounter = 0;
  for (const candidate of reduced) {
    if (candidate.kind === 'text' && candidate.tokenId.startsWith(splitPrefix)) {
      const suffix = Number(candidate.tokenId.slice(splitPrefix.length));
      if (Number.isFinite(suffix) && suffix > splitCounter) {
        splitCounter = suffix;
      }
    }
  }
  const mintId = (label: string) => `${splitPrefix}${(splitCounter += 1)}-${label}`;
  const group: PreviewToken[] = [];
  if (coreL.length > 0) {
    group.push({ kind: 'text', tokenId: mintId('left'), text: coreL });
  }
  if (beforePad.length > 0) {
    group.push({ kind: 'text', tokenId: mintId('pad-left'), text: beforePad });
  }
  group.push(token);
  if (afterPad.length > 0) {
    group.push({ kind: 'text', tokenId: mintId('pad-right'), text: afterPad });
  }
  if (coreR.length > 0) {
    group.push({ kind: 'text', tokenId: mintId('right'), text: coreR });
  }
  reduced.splice(adjusted, 1, ...group);

  // Inert: the chip's content arrangement did not change (it only
  // crossed its own separator material, or landed back on its own
  // spot) — the serialization and the snippet order are both
  // unchanged, so the state stays reference-identical. The snippet
  // order ALONE is not the test: a real text-split move crosses own
  // text with the chip order intact ("A B text..."), and the
  // serialization ALONE is not either — a plant at a glued seam
  // changes it without a real move.
  if (
    serialize(reduced) === serialize(tokens) &&
    snippetPositionOf(tokens, token.tokenId) ===
      snippetPositionOf(reduced, token.tokenId)
  ) {
    return state;
  }
  return { ...state, tokens: reduced };
}

/**
 * MOVE_TOKEN — a token-index move with NO
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
  const extraction = extractChipWithSeparator(tokens, fromIndex);
  if (!extraction) {
    return state;
  }
  const { token, reduced, removedOriginalIndexes, carriedSeparator } = extraction;

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
  if (
    snippetPositionOf(tokens, token.tokenId) ===
    snippetPositionOf(reduced, token.tokenId)
  ) {
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

/**
 * The canonical token shape of the reseed text: split at every "\n"
 * into own-text tokens separated by line-break tokens (an own-text
 * token never carries a "\n"; empty runs produce no token, so an
 * empty or whitespace-only seed yields no text tokens). Ids mint
 * deterministically per ordinal — the ids are free after every
 * clear, so repeated resets produce the same shape.
 */
function buildSeedTokens(seedText: string): PreviewToken[] {
  const tokens: PreviewToken[] = [];
  let textRun = 0;
  let lineBreak = 0;
  const pushTextRun = (text: string) => {
    if (text.length === 0) {
      return;
    }
    textRun += 1;
    tokens.push({
      kind: 'text',
      tokenId: `return-seed:text-${textRun}`,
      text,
    });
  };
  const lines = seedText.split('\n');
  pushTextRun(lines[0]);
  for (let index = 1; index < lines.length; index += 1) {
    lineBreak += 1;
    tokens.push({
      kind: 'line-break',
      tokenId: `return-seed:line-break-${lineBreak}`,
    });
    pushTextRun(lines[index]);
  }
  return tokens;
}

/**
 * RESET_ALL — the return transition: every document token and every
 * tombstone clears (editEnabled and caseFixLanguage pass through
 * untouched), then the document re-seeds with the given text as
 * plain own text in its canonical model shape. An empty seed is the
 * empty document. The transition runs as a normal non-SYNC
 * transition, so the wrapper's composed auto-fix pass settles the
 * seed's spacing (interior runs, document edges, line-break-adjacent
 * whitespace); its case never changes — the case pass touches
 * snippet tokens only, and the seed carries none.
 */
function resetAndReseedDocument(
  state: SnippetsState,
  seedText: string,
): SnippetsState {
  const tokens = buildSeedTokens(seedText);
  if (tokens.length === 0) {
    return state.tokens.length === 0 && state.tombstones.length === 0
      ? state
      : { ...state, tokens: [], tombstones: [] };
  }
  return { ...state, tokens, tombstones: [] };
}

const snippetsReducerTransition = (
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
    case 'MOVE_TOKEN_TO_LANDING': {
      const { fromIndex, landing }: { fromIndex: number; landing: Landing } = action;
      if (landing.kind === 'token-gap') {
        return moveTokenInDocument(state, fromIndex, landing.tokenIndex);
      }
      return moveTokenToTextSplit(state, fromIndex, landing);
    }
    case 'SYNC_DOCUMENT': {
      return syncParsedDocument(state, action.tokens);
    }
    case 'RESET_ALL': {
      return resetAndReseedDocument(state, action.seedText);
    }
    case 'SET_EDIT_ENABLED': {
      return action.editEnabled === state.editEnabled
        ? state
        : { ...state, editEnabled: action.editEnabled };
    }
    case 'SET_CASE_FIX_LANGUAGE': {
      return action.language === state.caseFixLanguage
        ? state
        : { ...state, caseFixLanguage: action.language };
    }
    default:
      return state;
  }
};

export const snippetsReducer = (
  state: SnippetsState,
  action: SnippetsAction,
): SnippetsState => {
  const next = snippetsReducerTransition(state, action);
  // Eager normalization — the model's shape is canonical (one own-text token per contiguous
  // run), so the model and every parse agree and no behavior can
  // depend on merge history. Serialization never changes; the
  // reference-identity guard keeps no-op transitions churn-free.
  let base = next;
  if (next !== state) {
    const tokens = normalizeTextTokens(next.tokens);
    if (tokens !== next.tokens) {
      base = { ...next, tokens };
    }
  }
  // SYNC_DOCUMENT is the mid-typing sync: the focused surface owns
  // its DOM, so the auto-fix pass never runs there (a correction
  // between keystrokes would fight the editor) — the copy path closes
  // the stale window.
  if (action.type === 'SYNC_DOCUMENT') {
    return next === state ? state : base;
  }
  // Whole-document auto-fix recompute (case → spacing → case) on
  // every other transition — creation, both moves, the edit toggle,
  // the language update, and no-op transitions included: a state that
  // enters this transition with stale case or spacing (left by a
  // SYNC) is corrected by the next trigger, whatever it is. The pass
  // runs after the transition's text rewrite and the eager
  // normalization, so it only sees canonical shapes, and derives
  // under the state's own language field — so the
  // SET_CASE_FIX_LANGUAGE transition (the provider's languageChanged
  // dispatch) re-derives the whole document under the new language
  // through this same path (the spacing stage is language-independent
  // and an idempotent no-op there).
  const tokens = applyAutoFix(base.tokens, base.caseFixLanguage);
  if (tokens === base.tokens) {
    return next === state ? state : base;
  }
  return { ...base, tokens };
};
