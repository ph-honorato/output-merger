import type { Snippet } from '@components';

/**
 * A snippet lifted into the preview document: the source snippet's
 * identity and color plus the text the document currently holds for
 * it (which may include text the user typed inside the chip — the
 * in-snippet integration instead of splitting).
 */
export interface SnippetToken {
  kind: 'snippet';
  /**
   * Globally unique token id (`${sourceId}:${sourceSnippetId}`) —
   * also the sortable/draggable id (only snippet tokens sort)
   */
  tokenId: string;
  /**
   * The id of the source snippet this token references
   */
  sourceSnippetId: string;
  /**
   * The id of the source that emitted the snippet (e.g. "text-1")
   */
  sourceId: string;
  /**
   * The source snippet's highlight color, captured at creation
   */
  color: string;
  /**
   * The token's current text (source text, possibly with typed-in
   * text integrated inside)
   */
  text: string;
  /**
   * True once the user has typed inside this token: text-frozen for
   * reconciliation (resizes no longer rewrite it). Never resets.
   */
  edited: boolean;
}

/**
 * Text typed directly into the preview, not originating from any
 * snippet — including the explicit `" "` join-separator tokens
 * reconciliation inserts between snippet tokens.
 */
export interface OwnTextToken {
  kind: 'text';
  /**
   * Globally unique token id
   */
  tokenId: string;
  /**
   * The token's text — never contains "\n" (the parser splits text
   * runs at line breaks; only snippet tokens may embed newlines)
   */
  text: string;
}

/**
 * A line break typed into the preview document; serializes as "\n".
 */
export interface LineBreakToken {
  kind: 'line-break';
  /**
   * Globally unique token id
   */
  tokenId: string;
}

/**
 * One token of the preview document. Array position IS the merge
 * order — there is no separate order integer.
 */
export type PreviewToken = SnippetToken | OwnTextToken | LineBreakToken;

/**
 * a drag landing — every word
 * boundary of the document is a droppable position. A token-gap
 * landing inserts the chip right before the token at `tokenIndex`
 * (=== tokens.length appends); a text-split landing splits the own
 * text token at `tokenIndex` at `boundaryOffset` and drops the chip
 * inside, with >=1 space on each side.
 */
export type Landing =
  | { kind: 'token-gap'; tokenIndex: number }
  | { kind: 'text-split'; tokenIndex: number; boundaryOffset: number };

/**
 * The preview document: a single ordered token array where position
 * is the merge order.
 */
export type PreviewDocument = PreviewToken[];

/**
 * The reducer state: the document plus the in-memory session state
 * that reconciliation and editing need.
 */
export interface SnippetsState {
  /**
   * The preview document
   */
  tokens: PreviewToken[];
  /**
   * Token ids of snippet tokens the user deleted from the document
   * (in-memory tombstones): later source emissions must not
   * re-append them for the session. Cleared when the source
   * emission no longer reports the id.
   */
  tombstones: string[];
  /**
   * Session-level edit toggle (default OFF): gates text editing on
   * both preview surfaces; dragging is always live in both modes
   */
  editEnabled: boolean;
  /**
   * The UI language tag the case-fix pass derives casing under.
   * Every transition reads this field (never the i18n singleton);
   * the provider updates it when i18n reports a language change,
   * so a runtime switch re-derives the document through the reducer.
   */
  caseFixLanguage: string;
}

export interface SetSourceSnippetsAction {
  type: 'SET_SOURCE_SNIPPETS';
  sourceId: string;
  snippets: Snippet[];
}

export interface MoveTokenAction {
  type: 'MOVE_TOKEN';
  /**
   * 0-based index into the document token array the move starts
   * from (must be a snippet token)
   */
  fromIndex: number;
  /**
   * Insertion point in the CURRENT document token array: the moved
   * token lands right before the token currently at this index
   * (=== tokens.length appends at the end)
   */
  toIndex: number;
}

export interface MoveTokenToLandingAction {
  type: 'MOVE_TOKEN_TO_LANDING';
  fromIndex: number;
  /**
   * A drag landing: a token-gap (the MOVE_TOKEN semantics,
   * used for the positions before chips that no text edge covers) or
   * a text-split (a word boundary inside/beside an own text token —
   * the token splits around the chip with >=1 space each side)
   */
  landing: Landing;
}

export interface SyncDocumentAction {
  type: 'SYNC_DOCUMENT';
  /**
   * The parsed document (from the pure DOM→tokens parser) that
   * replaces the current tokens wholesale
   */
  tokens: PreviewToken[];
}

export interface SetEditEnabledAction {
  type: 'SET_EDIT_ENABLED';
  editEnabled: boolean;
}

export interface SetCaseFixLanguageAction {
  type: 'SET_CASE_FIX_LANGUAGE';
  /**
   * The new active UI language tag (any i18n tag form — the rule
   * table resolves the primary subtag)
   */
  language: string;
}

export type SnippetsAction =
  | SetSourceSnippetsAction
  | MoveTokenAction
  | MoveTokenToLandingAction
  | SyncDocumentAction
  | SetEditEnabledAction
  | SetCaseFixLanguageAction;

export interface SnippetsContextValue {
  /**
   * The preview document, always in merge order
   */
  document: PreviewDocument;
  /**
   * Whether text editing is enabled (shared by both toggle buttons)
   */
  editEnabled: boolean;
  /**
   * The UI language tag the case-fix pass derives casing under —
   * the document transitions and the copy path read the same
   * field, so display and clipboard always derive under one
   * rule set
   */
  caseFixLanguage: string;
  /**
   * Replaces the snippets recorded for one source (diff-by-id
   * reconciliation over the snippet tokens in the document)
   */
  setSourceSnippets: (sourceId: string, snippets: Snippet[]) => void;
  /**
   * Moves a snippet token within the document (token-index splice
   * with no-op guards)
   */
  moveToken: (fromIndex: number, toIndex: number) => void;
  /**
   * moves a snippet token to a drag LANDING — a word
   * boundary of the document (token-gap or text-split with the
   * >=1-space-each-side accounting); no-op guards as moveToken
   */
  moveTokenToLanding: (fromIndex: number, landing: Landing) => void;
  /**
   * Whole-document sync of a parsed edit (one action per input
   * event; computes "edited" flags and snippet tombstones)
   */
  syncDocument: (tokens: PreviewToken[]) => void;
  /**
   * Flips the session-level edit toggle
   */
  setEditEnabled: (editEnabled: boolean) => void;
}
