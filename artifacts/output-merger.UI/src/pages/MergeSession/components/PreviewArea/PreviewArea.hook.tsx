import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardCode,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  Announcements,
  ClientRect,
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardCoordinateGetter,
  ScreenReaderInstructions,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { useSnippets } from '../../../../context/SnippetsContext';
import type {
  Landing,
  PreviewToken,
  SnippetToken,
} from '../../../../context/SnippetsContext';
import {
  isSnippetToken,
  landingAfterToken,
  landingBeforeToken,
  parseLandingId,
  parsePreviewDom,
  serialize,
  tokensEqualIgnoringEdited,
} from '../../../../utils/previewDocument';

/**
 * PointerSensor hold-to-drag activation (ADR 0002): the drag starts only
 * when the pointer is held for the delay while moving at most the
 * tolerance — a plain click never starts a drag. Tuning these values is a
 * feel change, not a contract change. While edit mode is ON a quick click
 * therefore falls through as a caret placement (dragging is always live
 * in both modes — F1).
 */
export const SNIPPET_DRAG_ACTIVATION = { delay: 50, tolerance: 5 } as const;

/**
 * Round 7 (user decision 2026-10-19): the needle's landing — which
 * droppable anchor (word boundary or token gap) the drop-indicator
 * needle marks. The droppable-id round-trip and the anchor
 * enumeration live in utils/previewDocument (`buildLandingId`,
 * `parseLandingId`, `enumerateLandingAnchors`); `sameLanding` compares
 * two landings for the needle's render match.
 */
export const sameLanding = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * The resulting 1-based position among the snippet tokens when the
 * chip at `fromIndex` drops at `landing` (the announcement-side
 * landing math): the number of snippet tokens that precede the
 * landing spot, the moved chip excluded, plus one. Best-effort for
 * inert drops (the chip's own neighborhood) — the announcement then
 * reports the unchanged position.
 */
export const landingSnippetPosition = (
  tokens: PreviewToken[],
  fromIndex: number,
  landing: Landing
): number => {
  const target = landing.tokenIndex;
  let seen = 0;
  for (let index = 0; index < target && index < tokens.length; index += 1) {
    if (tokens[index].kind === 'snippet' && index !== fromIndex) {
      seen += 1;
    }
  }
  return seen + 1;
};

/**
 * Round 7 keyboard coordinate getter (user decision 2026-10-19):
 * Left/Right step the raised chip through EVERY droppable landing
 * position in reading order — the snippet chips AND the
 * word-boundary/token-gap anchors — so the user can walk a snippet
 * word-by-word through their own text and drop it exactly where the
 * needle marks. READING ORDER IS DOM ORDER (dev-server correction,
 * 2026-10-19): the flow renders its children in reading order, and
 * the geometric (top, left) sort this getter shipped with is WRONG in
 * a real browser — the zero-footprint anchors are 0x0 boxes sitting
 * at the text baseline while the chips span the line, so their tops
 * differ and the sort put every chip before every anchor, scrambling
 * the walk (the jsdom rect mocks all shared top 0, which masked it;
 * the realistic-geometry harness reproduced the exact scramble).
 * The droppable registry exposes each container's DOM node
 * (RegisterDroppable carries `node`), so the walk sorts by
 * compareDocumentPosition — geometry-independent, line breaks
 * included — with a (top, left) fallback for transient missing
 * nodes. Each step places the raised item's center exactly on the
 * next droppable's center (both axes — the 0x0 anchor centers sit
 * ~6px below the chip centers, and a multi-line walk must track the
 * target's line), so closestCenter resolves `over` to the stepped
 * position at distance 0 and the needle follows word-by-word. The
 * current position resolves by 2D center distance (same metric as
 * the collision). Up/Down are prevented but inert (the caret must
 * never move while a chip is raised). The sensor's own end codes
 * (Space/Enter/Tab) and cancel (Escape) are untouched, as are the
 * round-6 caret-restore and raised-guard contracts.
 */
export const landingKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  {
    currentCoordinates,
    context: { collisionRect, droppableRects, droppableContainers },
  }
) => {
  const code = event.code;
  if (
    code !== KeyboardCode.Left &&
    code !== KeyboardCode.Right &&
    code !== KeyboardCode.Up &&
    code !== KeyboardCode.Down
  ) {
    return undefined;
  }
  // The arrow keydown never reaches the editable host mid-sort: the
  // caret must not move while the chip is raised.
  event.preventDefault();
  const direction =
    code === KeyboardCode.Left ? -1 : code === KeyboardCode.Right ? 1 : 0;
  if (direction === 0 || !collisionRect) {
    return undefined;
  }
  const entries = droppableContainers
    .getEnabled()
    .map((entry) => ({
      id: entry.id,
      rect: droppableRects.get(entry.id),
      node: entry.node?.current ?? null,
    }))
    .filter(
      (
        entry
      ): entry is {
        id: UniqueIdentifier;
        rect: ClientRect;
        node: HTMLElement | null;
      } => entry.rect != null
    )
    .sort((a, b) => {
      if (a.node && b.node) {
        // DOM document order IS the flow's reading order (the
        // droppables are all connected siblings of the flow).
        const position = a.node.compareDocumentPosition(b.node);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
          return -1;
        }
        if (position & Node.DOCUMENT_POSITION_PRECEDING) {
          return 1;
        }
      }
      // Fallback for transient missing/disconnected nodes
      // (mid-unmount): the geometric order of the last resort.
      return a.rect.top - b.rect.top || a.rect.left - b.rect.left;
    });
  if (entries.length === 0) {
    return undefined;
  }
  const centerOf = (rect: ClientRect): { x: number; y: number } => ({
    x: (rect.left + rect.right) / 2,
    y: (rect.top + rect.bottom) / 2,
  });
  const currentCenter = centerOf(collisionRect);
  let currentIndex = 0;
  let bestDistance = Infinity;
  entries.forEach((entry, index) => {
    const center = centerOf(entry.rect);
    const distance = Math.hypot(center.x - currentCenter.x, center.y - currentCenter.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      currentIndex = index;
    }
  });
  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= entries.length) {
    return undefined; // already at the first/last landing position
  }
  const targetCenter = centerOf(entries[targetIndex].rect);
  return {
    x: currentCoordinates.x + (targetCenter.x - currentCenter.x),
    y: currentCoordinates.y + (targetCenter.y - currentCenter.y),
  };
};

/**
 * The selection's current range, when it is usable and inside the
 * flow root (the shared guard of the caret paths). Null otherwise.
 */
const selectionRangeInRoot = (root: HTMLElement): Range | null => {
  const view = root.ownerDocument.defaultView;
  if (!view || typeof view.getSelection !== 'function') {
    return null;
  }
  const selection = view.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) {
    return null;
  }
  return range;
};

/**
 * Inserts a raw text node at the caret (or over the selection) inside
 * the editable flow root. Used for the Enter line break (the native
 * block insertion is prevented and a "\n" text node is created
 * instead — no <br>, the flow's white-space: pre-wrap carries it)
 * and for plain-text paste (multi-line text stays one text node; the
 * parser splits it at the newlines). Returns the created text node,
 * or null when no usable selection exists inside the root (the
 * caller then no-ops).
 */
export const insertTextAtSelection = (
  root: HTMLElement,
  text: string
): Text | null => {
  const view = root.ownerDocument.defaultView;
  if (!view || typeof view.getSelection !== 'function') {
    return null;
  }
  const selection = view.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selectionRangeInRoot(root);
  if (!range) {
    return null;
  }
  range.deleteContents();
  const node = root.ownerDocument.createTextNode(text);
  range.insertNode(node);
  const after = root.ownerDocument.createRange();
  after.setStartAfter(node);
  after.collapse(true);
  selection.removeAllRanges();
  selection.addRange(after);
  return node;
};

/**
 * Where a collapsed caret sits relative to the nearest snippet chip
 * (`[data-token-id]` ancestor, walking up from the range's start
 * container and stopping at the flow root):
 * - `inside-chip-at-end` — at the chip's very end text boundary
 *   (nothing of the chip's content follows the caret);
 * - `inside-chip-at-start` — at offset 0 of the chip's content
 *   (nothing of the chip's content precedes the caret);
 * - `inside-chip-mid` — inside the chip, neither boundary;
 * - `outside-chip` — the caret is not inside any chip (and every
 *   non-collapsed selection: Enter over a selection keeps today's
 *   delete-and-insert path).
 *
 * The Enter handler uses this for the "a line break never enters a
 * snippet" rule (user decision 2026-10-17): only the two boundary
 * cases take the escape path; a mid-chip Enter (and every typed
 * character) keeps the Q3 in-snippet integration contract.
 */
export type CaretChipPosition =
  | 'inside-chip-at-end'
  | 'inside-chip-at-start'
  | 'inside-chip-mid'
  | 'outside-chip';

export interface CaretChipClassification {
  position: CaretChipPosition;
  chip: HTMLElement | null;
}

export const classifyCaretRelativeChip = (
  root: HTMLElement,
  range: Range
): CaretChipClassification => {
  if (!range.collapsed) {
    // Enter over a selection: keep today's path (delete, then insert
    // at the remaining caret). The escape applies to collapsed carets.
    return { position: 'outside-chip', chip: null };
  }
  let node: Node | null = range.startContainer;
  let chip: HTMLElement | null = null;
  while (node && node !== root) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.dataset?.tokenId !== undefined) {
        chip = element;
        break;
      }
    }
    node = node.parentNode;
  }
  if (!chip) {
    return { position: 'outside-chip', chip: null };
  }
  // Boundary probes: the text of the chip's content after (resp.
  // before) the caret. Works for text-node and element containers
  // alike, and is exact about chip content — a trailing space inside
  // the chip keeps the caret "mid" until it moves past it.
  const doc = root.ownerDocument;
  const toEnd = doc.createRange();
  toEnd.setStart(range.startContainer, range.startOffset);
  toEnd.setEndAfter(chip);
  if (toEnd.toString() === '') {
    return { position: 'inside-chip-at-end', chip };
  }
  const toStart = doc.createRange();
  toStart.setStartBefore(chip);
  toStart.setEnd(range.startContainer, range.startOffset);
  if (toStart.toString() === '') {
    return { position: 'inside-chip-at-start', chip };
  }
  return { position: 'inside-chip-mid', chip };
};

/**
 * Plants a raw text node as the chip's SIBLING — right after it
 * (`side === 'after'`) or right before it (`side === 'before'`) —
 * instead of inside the chip's content, WITHOUT touching the
 * selection (the caret stays wherever it is — required by the typing
 * auto-separation rule, which must leave the caret inside the typed
 * run). Content planted here is flow content — own text/line-break
 * tokens after parse — never snippet content.
 */
const plantTextBesideChip = (
  chip: HTMLElement,
  side: 'before' | 'after',
  text: string
): Text => {
  const node = chip.ownerDocument.createTextNode(text);
  chip.parentNode?.insertBefore(
    node,
    side === 'before' ? chip : chip.nextSibling
  );
  return node;
};

/**
 * Plants a raw text node as the chip's SIBLING (see
 * plantTextBesideChip) and places the caret right after the node (the
 * same Range/Selection technique insertTextAtSelection uses). The
 * Enter escape path ("a line break never enters a snippet", user
 * decision 2026-10-17) and the paste escape paths (round 3: the same
 * rule applies to pasted text) build on it.
 */
const insertTextBesideChip = (
  chip: HTMLElement,
  side: 'before' | 'after',
  text: string
): Text => {
  const node = plantTextBesideChip(chip, side, text);
  const doc = chip.ownerDocument;
  const after = doc.createRange();
  after.setStartAfter(node);
  after.collapse(true);
  const view = doc.defaultView;
  const selection = view?.getSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(after);
  }
  return node;
};

const insertLineBreakOutsideChip = (
  chip: HTMLElement,
  side: 'before' | 'after'
): Text => insertTextBesideChip(chip, side, '\n');

/**
 * The at-end split-paste path (user decision 2026-10-17, round 3:
 * "a line break never enters a snippet" applies to pasted text —
 * "pasted text integrates into the snippet only up to its first
 * newline"). The pasted PREFIX (before the first newline) inserts
 * at the caret INSIDE the chip (Q3 integration: the chip's text
 * grows, so its `edited` flag becomes true — the user modified the
 * chip); the first newline and everything after it insert as flow
 * content immediately AFTER the chip element (line-break + own-text
 * tokens after parse). Returns the tail node — the caller runs the
 * trailing-line-anchor bookkeeping and the commit. An empty prefix
 * (the paste starts with the newline) reduces to the round-2 Enter
 * escape: nothing integrates, the whole paste lands after the chip.
 */
export const insertSplitPasteAtChipEnd = (
  chip: HTMLElement,
  range: Range,
  text: string
): Text => {
  const firstNewline = text.indexOf('\n');
  const prefix = text.slice(0, firstNewline);
  if (prefix.length > 0) {
    // Insert at the caret, inside the chip: Range.insertNode splits
    // the chip's text node at the boundary as needed (the same
    // mechanics a typed character relies on).
    range.insertNode(chip.ownerDocument.createTextNode(prefix));
  }
  return insertTextBesideChip(chip, 'after', text.slice(firstNewline));
};

/** The chip element for a token id, or null (the restore path). */
const findChipByTokenId = (
  root: HTMLElement,
  tokenId: string
): HTMLElement | null => {
  const chips = root.querySelectorAll<HTMLElement>('[data-token-id]');
  for (const chip of Array.from(chips)) {
    if (chip.dataset.tokenId === tokenId) {
      return chip;
    }
  }
  return null;
};

/** The chip's text children, in order. */
const textChildrenOf = (chip: HTMLElement): Text[] =>
  Array.from(chip.childNodes).filter(
    (node): node is Text => node.nodeType === Node.TEXT_NODE
  );

/**
 * Round-6 rule B helpers: the saved caret for the keyboard-sort
 * restore (the caret position at Ctrl+Space, so the drop/cancel can
 * put it back inside the sorted snippet). A text-node caret inside
 * the chip saves its exact (text child index, offset); any other
 * caret geometry (the container is the chip ELEMENT — a programmatic
 * or element-boundary caret — or an unresolvable shape) saves the
 * BOUNDARY SENTINEL { textChildIndex: -1, offset: +Infinity }: the
 * restore's index fallback selects the LAST text child and the
 * offset clamp lands at its END — the documented chip-end fallback
 * for the boundary geometry (a tester round-6 finding: returning
 * null here skipped the restore entirely, leaving the host
 * unfocused after the drop's remount).
 */
export interface KeyboardSortCaret {
  tokenId: string;
  textChildIndex: number;
  offset: number;
}

const BOUNDARY_SENTINEL: Pick<KeyboardSortCaret, 'textChildIndex' | 'offset'> = {
  textChildIndex: -1,
  offset: Number.POSITIVE_INFINITY,
};

const savedKeyboardSortCaret = (
  chip: HTMLElement,
  range: Range
): KeyboardSortCaret | null => {
  const tokenId = chip.dataset.tokenId ?? '';
  if (!tokenId) {
    return null;
  }
  const container = range.startContainer;
  if (container.nodeType === Node.TEXT_NODE && chip.contains(container)) {
    const textChildren = textChildrenOf(chip);
    const textChildIndex = textChildren.indexOf(container as Text);
    if (textChildIndex >= 0) {
      return { tokenId, textChildIndex, offset: range.startOffset };
    }
  }
  // Boundary caret or an unresolvable shape: the sentinel restores
  // to the chip's end.
  return { tokenId, ...BOUNDARY_SENTINEL };
};

// ---------------------------------------------------------------------------
// Typing auto-separation + gap collapse (user decision 2026-10-17,
// round 4): "we always have at least one white space between snippets
// and texts".
// ---------------------------------------------------------------------------

const isChipElement = (node: Node): node is HTMLElement =>
  node.nodeType === Node.ELEMENT_NODE &&
  (node as HTMLElement).dataset?.tokenId !== undefined;

/**
 * True for everything the caret boundary walks skip: comments and
 * every element that is not a snippet chip (insertion-gap anchors,
 * the drop-indicator needle, the bogus <br> line anchor, wrapper
 * debris). Text nodes and chips are the only content the walks see —
 * mirroring the parser's transparency for everything that is
 * neither.
 */
const isWalkTransparent = (node: Node): boolean =>
  node.nodeType !== Node.TEXT_NODE && !isChipElement(node);

/**
 * Walks from the caret position toward one side, accumulating the
 * NON-WHITESPACE text it crosses (through parser-transparent
 * elements), until a snippet chip. Any whitespace character between
 * the caret and the chip means a separator exists → { chip: null,
 * crossed: <text-so-far> }. The `crossed` string is the round-5
 * redirect's currency: for an insertText event the just-typed run is
 * exactly `data`, so a chip reached through `crossed === data` abuts
 * the PRE-TYPING caret position directly (chip territory), while a
 * chip reached through longer text is farther away (free territory).
 */
export interface ChipBoundary {
  chip: HTMLElement | null;
  crossed: string;
}

export const chipBoundaryFromCaret = (
  root: HTMLElement,
  container: Node,
  offset: number,
  direction: 'before' | 'after'
): ChipBoundary => {
  void root;
  let crossed = '';

  // Phase 1: the container's own text on the walk's side of the caret.
  if (container.nodeType === Node.TEXT_NODE) {
    const data = (container as Text).data;
    const fragment =
      direction === 'before' ? data.slice(0, offset) : data.slice(offset);
    for (let index = 0; index < fragment.length; index += 1) {
      if (/\s/.test(fragment[index])) {
        return { chip: null, crossed };
      }
      crossed += fragment[index];
    }
  }

  // Phase 2: sibling walk toward the direction.
  let sibling: ChildNode | null;
  if (container.nodeType === Node.TEXT_NODE) {
    sibling =
      direction === 'before'
        ? container.previousSibling
        : container.nextSibling;
  } else {
    const children = (container as HTMLElement).childNodes;
    const index = direction === 'before' ? offset - 1 : offset;
    sibling =
      index >= 0 && index < children.length ? (children[index] ?? null) : null;
  }
  while (sibling !== null) {
    if (sibling.nodeType === Node.TEXT_NODE) {
      const data = (sibling as Text).data;
      for (let index = 0; index < data.length; index += 1) {
        if (/\s/.test(data[index])) {
          return { chip: null, crossed };
        }
        crossed += data[index];
      }
    } else if (isChipElement(sibling)) {
      return { chip: sibling, crossed };
    }
    // Transparent elements: keep walking.
    sibling =
      direction === 'before'
        ? sibling.previousSibling
        : sibling.nextSibling;
  }
  return { chip: null, crossed }; // the flow edge without a chip
};

/**
 * The snippet chip that DIRECTLY abuts the caret on one side, if any
 * (the chip-only view of chipBoundaryFromCaret).
 */
export const abuttingChipFromCaret = (
  root: HTMLElement,
  container: Node,
  offset: number,
  direction: 'before' | 'after'
): HTMLElement | null =>
  chipBoundaryFromCaret(root, container, offset, direction).chip;

/**
 * The flow-text character immediately adjacent to the caret on one
 * side (through transparent elements; empty text nodes keep the
 * walk going). Chips and flow edges return null — a caret between
 * two chips with no text has no adjacent flow character, so typing
 * separation never plants anything into an empty gap.
 */
const adjacentFlowCharacter = (
  container: Node,
  offset: number,
  side: 'before' | 'after'
): string | null => {
  if (
    container.nodeType === Node.TEXT_NODE &&
    (side === 'before' ? offset > 0 : offset < (container as Text).data.length)
  ) {
    const data = (container as Text).data;
    return side === 'before' ? data[offset - 1] : data[offset];
  }
  let sibling: ChildNode | null;
  if (container.nodeType === Node.TEXT_NODE) {
    sibling = side === 'before' ? container.previousSibling : container.nextSibling;
  } else {
    const children = (container as HTMLElement).childNodes;
    const index = side === 'before' ? offset - 1 : offset;
    sibling =
      index >= 0 && index < children.length ? (children[index] ?? null) : null;
  }
  while (sibling !== null) {
    if (sibling.nodeType === Node.TEXT_NODE) {
      const data = (sibling as Text).data;
      if (data.length > 0) {
        return side === 'before' ? data[data.length - 1] : data[0];
      }
    } else if (isChipElement(sibling)) {
      return null;
    }
    sibling =
      side === 'before' ? sibling.previousSibling : sibling.nextSibling;
  }
  return null;
};

/**
 * Places the caret (the shared Range/Selection technique) at a node
 * offset — the redirect, scaffold, and arrow paths use it to move
 * the caret programmatically.
 */
const placeCaret = (node: Node, offset: number): void => {
  const doc = node.ownerDocument;
  if (!doc) {
    return;
  }
  const range = doc.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const view = doc.defaultView;
  const selection = view?.getSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
};

/** The chip's first text child, or null. */
const firstTextChildOf = (chip: HTMLElement): Text | null => {
  const children = chip.childNodes;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child.nodeType === Node.TEXT_NODE) {
      return child as Text;
    }
  }
  return null;
};

/** The chip's last text child, or null. */
const lastTextChildOf = (chip: HTMLElement): Text | null => {
  const children = chip.childNodes;
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const child = children[index];
    if (child.nodeType === Node.TEXT_NODE) {
      return child as Text;
    }
  }
  return null;
};

/**
 * Appends `data` to the chip's text (its last text child, creating
 * one when the chip has no text) and returns that text node.
 */
const appendRunToChip = (chip: HTMLElement, data: string): Text => {
  let text = lastTextChildOf(chip);
  if (!text) {
    text = chip.ownerDocument.createTextNode('');
    chip.appendChild(text);
  }
  text.insertData(text.data.length, data);
  return text;
};

/** Prepends `data` to the chip's text, symmetric to appendRunToChip. */
const prependRunToChip = (chip: HTMLElement, data: string): Text => {
  let text = firstTextChildOf(chip);
  if (!text) {
    text = chip.ownerDocument.createTextNode('');
    chip.insertBefore(text, chip.firstChild ?? null);
  }
  text.insertData(0, data);
  return text;
};

/**
 * Removes the just-typed run from the flow: for an insertText event
 * the browser inserted exactly `data` ending at the caret, so the
 * chars to remove sit in the caret's text node right before the
 * offset (or, for an element-boundary caret, in the text child
 * before it). Exotic DOM shapes return false — the run then stays
 * flow content and the sync still runs (the always-sync contract).
 */
const extractTypedRunEndingAtCaret = (range: Range, data: string): boolean => {
  const { startContainer: container, startOffset: offset } = range;
  if (container.nodeType === Node.TEXT_NODE) {
    const text = container as Text;
    if (
      offset >= data.length &&
      text.data.slice(offset - data.length, offset) === data
    ) {
      text.deleteData(offset - data.length, data.length);
      return true;
    }
    return false;
  }
  if (container.nodeType === Node.ELEMENT_NODE) {
    const children = (container as HTMLElement).childNodes;
    const previous = offset - 1 >= 0 ? children[offset - 1] : undefined;
    if (previous && previous.nodeType === Node.TEXT_NODE) {
      const text = previous as Text;
      if (text.data.endsWith(data)) {
        text.deleteData(text.data.length - data.length, data.length);
        return true;
      }
    }
  }
  return false;
};

/**
 * Round-5 rule A — the chip-territory redirect (user decision
 * 2026-10-18: "every caret position directly abutting a chip is the
 * chip's territory"). When a non-whitespace insertText lands at a
 * caret position that DIRECTLY abutted a chip before typing (the
 * walk from the caret crosses exactly the typed run to a chip on the
 * left, or crosses nothing to a chip on the right), the typed run
 * moves INTO the chip — appended after its text for a left chip,
 * prepended before it for a right chip — and the caret follows inside
 * the chip (subsequent typing integrates natively, Q3). The chip's
 * text grows, so its `edited` flag becomes true on the sync. If the
 * insertion point's far side directly abuts non-whitespace own text
 * (e.g. `mytext|` before the chip), ONE space is planted outside the
 * chip between them (the ≥1-space-between-snippet-and-text rule).
 * The seam — two GLUED chips with the caret exactly between them —
 * keeps the round-4 behavior (agent default): spaces on both sides,
 * the typed run stays own text. Whitespace typing, deletions, bare
 * (data-less) events, and positions not directly abutting a chip are
 * untouched; the caller runs the parse+sync for EVERY input event
 * regardless.
 */
export const redirectTypedRunToChipTerritory = (
  root: HTMLElement,
  range: Range,
  data: string
): void => {
  if (!range.collapsed) {
    return;
  }
  // Typing inside a chip (any position) is native Q3 integration.
  if (classifyCaretRelativeChip(root, range).chip) {
    return;
  }
  const { startContainer, startOffset } = range;
  const before = chipBoundaryFromCaret(root, startContainer, startOffset, 'before');
  const after = chipBoundaryFromCaret(root, startContainer, startOffset, 'after');
  // The pre-typing caret directly abutted the left chip iff the walk
  // crossed exactly the typed run; the right chip iff it crossed
  // nothing (the run sits between the caret and the left content).
  const directLeft = before.chip !== null && before.crossed === data;
  const directRight = after.chip !== null && after.crossed === '';

  if (directLeft && directRight && before.chip && after.chip) {
    // Seam (agent default, kept from round 4): symmetric ambiguity —
    // spaces on both sides, the run stays own text.
    plantTextBesideChip(before.chip, 'after', ' ');
    plantTextBesideChip(after.chip, 'before', ' ');
    return;
  }
  if (directLeft && before.chip) {
    if (!extractTypedRunEndingAtCaret(range, data)) {
      return;
    }
    const chipText = appendRunToChip(before.chip, data);
    placeCaret(chipText, chipText.data.length);
    if (after.crossed.length > 0) {
      // Far side: own text directly abutting the insertion point
      // keeps one space from the grown chip.
      plantTextBesideChip(before.chip, 'after', ' ');
    }
    return;
  }
  if (directRight && after.chip) {
    if (!extractTypedRunEndingAtCaret(range, data)) {
      return;
    }
    const chipText = prependRunToChip(after.chip, data);
    placeCaret(chipText, data.length);
    const farText = before.crossed.slice(0, before.crossed.length - data.length);
    if (farText.length > 0) {
      plantTextBesideChip(after.chip, 'before', ' ');
    }
    return;
  }
  // Free territory: no redirect, no plants (round-4 rule 1 rescoped
  // to the seam and the doc-edge scaffolds).
};

/**
 * The caret's current "gap": a spaces-only (no `\n`, no tabs) run of
 * text DIRECTLY between two snippet chips — the place the user's
 * round-4 rule calls "between two snippets". Null when the caret is
 * not inside such a run (content, edges, line breaks, or runs not
 * bounded by chips on both sides do not count).
 */
export interface CaretGap {
  firstNode: Text;
  lastNode: Text;
  /** The run's total space count (the scaffold arrow rules branch on it). */
  spaces: number;
}

export const findCaretGap = (
  root: HTMLElement,
  container: Node,
  offset: number
): CaretGap | null => {
  void root;
  let spaces = 0;
  let firstNode: Text | null = null;
  let lastNode: Text | null = null;

  // Phase 1: the container's own text around the caret must be
  // spaces only, on both sides.
  if (container.nodeType === Node.TEXT_NODE) {
    const data = (container as Text).data;
    const before = data.slice(0, offset);
    const after = data.slice(offset);
    if (/[^ ]/.test(before) || /[^ ]/.test(after)) {
      return null;
    }
    spaces += before.length + after.length;
    firstNode = container as Text;
    lastNode = container as Text;
  }

  // Phase 2: walk left for the first chip through spaces-only text.
  let sibling: ChildNode | null;
  if (container.nodeType === Node.TEXT_NODE) {
    sibling = container.previousSibling;
  } else {
    const children = (container as HTMLElement).childNodes;
    sibling =
      offset - 1 >= 0 && offset - 1 < children.length
        ? (children[offset - 1] ?? null)
        : null;
  }
  while (sibling !== null) {
    if (sibling.nodeType === Node.TEXT_NODE) {
      const data = (sibling as Text).data;
      if (/[^ ]/.test(data)) {
        return null;
      }
      spaces += data.length;
      firstNode = sibling as Text;
    } else if (isChipElement(sibling)) {
      break;
    }
    sibling = sibling.previousSibling;
  }
  if (sibling === null || !isChipElement(sibling)) {
    return null; // no chip bounds the run on the left
  }

  // Phase 3: walk right, symmetric.
  if (container.nodeType === Node.TEXT_NODE) {
    sibling = container.nextSibling;
  } else {
    const children = (container as HTMLElement).childNodes;
    sibling =
      offset >= 0 && offset < children.length
        ? (children[offset] ?? null)
        : null;
  }
  while (sibling !== null) {
    if (sibling.nodeType === Node.TEXT_NODE) {
      const data = (sibling as Text).data;
      if (/[^ ]/.test(data)) {
        return null;
      }
      spaces += data.length;
      lastNode = sibling as Text;
    } else if (isChipElement(sibling)) {
      break;
    }
    sibling = sibling.nextSibling;
  }
  if (sibling === null || !isChipElement(sibling)) {
    return null; // no chip bounds the run on the right
  }

  if (spaces < 1 || !firstNode || !lastNode) {
    return null;
  }
  return { firstNode, lastNode, spaces };
};

/**
 * Collapses a tracked gap to exactly one space (the user's "keep
 * only one white space"): re-validates the span first — the nodes
 * must still be connected, the run must still be spaces-only text
 * directly between two chips, and hold MORE than one space (a
 * single-space gap and the caret-stays case never collapse). The
 * first text node keeps one space; every other text node of the span
 * is emptied (the parser prunes empty text nodes on the next sync).
 * Returns true when the collapse happened (the caller commits).
 */
export const collapseGapSpaces = (
  root: HTMLElement,
  gap: CaretGap
): boolean => {
  if (!root.contains(gap.firstNode) || !root.contains(gap.lastNode)) {
    return false;
  }
  // Re-validate the span: spaces-only text, nothing else inside.
  let spaces = 0;
  let node: ChildNode | null = gap.firstNode;
  for (;;) {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = (node as Text).data;
      if (/[^ ]/.test(data)) {
        return false; // the user typed content into it
      }
      spaces += data.length;
    } else if (!isWalkTransparent(node)) {
      return false;
    }
    if (node === gap.lastNode) {
      break;
    }
    node = node.nextSibling;
    if (node === null) {
      return false; // the span chain broke
    }
  }
  if (spaces <= 1) {
    return false;
  }
  // Re-validate the chip boundaries around the span.
  let left: ChildNode | null = gap.firstNode.previousSibling;
  while (left !== null && isWalkTransparent(left)) {
    left = left.previousSibling;
  }
  if (left === null || !isChipElement(left)) {
    return false;
  }
  let right: ChildNode | null = gap.lastNode.nextSibling;
  while (right !== null && isWalkTransparent(right)) {
    right = right.nextSibling;
  }
  if (right === null || !isChipElement(right)) {
    return false;
  }
  // Collapse: the first text node keeps exactly one space; the rest
  // are emptied (pruned from the model on the next parse).
  let seenFirst = false;
  node = gap.firstNode;
  for (;;) {
    if (node.nodeType === Node.TEXT_NODE) {
      (node as Text).data = seenFirst ? '' : ' ';
      seenFirst = true;
    }
    if (node === gap.lastNode) {
      break;
    }
    node = node.nextSibling;
    if (node === null) {
      break;
    }
  }
  return true;
};

// ---------------------------------------------------------------------------
// Round 5 (user decision 2026-10-18): the chip-territory redirect
// (above) + the arrow-created free zones ("scaffolds"). Rule B's
// helpers: meaningful-chip scans, single-space gap lookup, chip hops.
// ---------------------------------------------------------------------------

/**
 * The flow's first meaningful chip — every node before it (skipping
 * transparents and empty text nodes) must be that chip; any content
 * before means the text does not "start with a snippet". Null when
 * there is no such chip.
 */
export const firstMeaningfulChip = (root: HTMLElement): HTMLElement | null => {
  const children = root.childNodes;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child.nodeType === Node.TEXT_NODE) {
      // Empty text nodes are parser-pruned strays — skip them; any
      // content means the text does not start with a snippet.
      if ((child as Text).data.length > 0) {
        return null;
      }
      continue;
    }
    if (isChipElement(child)) {
      return child;
    }
    // transparent elements: keep scanning
  }
  return null;
};

/** The flow's last meaningful chip, symmetric to firstMeaningfulChip. */
export const lastMeaningfulChip = (root: HTMLElement): HTMLElement | null => {
  const children = root.childNodes;
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const child = children[index];
    if (child.nodeType === Node.TEXT_NODE) {
      if ((child as Text).data.length > 0) {
        return null;
      }
      continue;
    }
    if (isChipElement(child)) {
      return child;
    }
  }
  return null;
};

/**
 * The single `" "` text node directly on one side of a chip (through
 * transparents) that is itself bounded by another chip on its far
 * side — the one-space between-chips gap. Anything else (no text,
 * multi-space, own text, a flow edge) returns null.
 */
const singleSpaceGapBesideChip = (
  chip: HTMLElement,
  side: 'before' | 'after'
): Text | null => {
  let node: ChildNode | null =
    side === 'before' ? chip.previousSibling : chip.nextSibling;
  while (node !== null && isWalkTransparent(node)) {
    node = side === 'before' ? node.previousSibling : node.nextSibling;
  }
  if (node === null || node.nodeType !== Node.TEXT_NODE) {
    return null;
  }
  const text = node as Text;
  if (text.data !== ' ') {
    return null;
  }
  let beyond: ChildNode | null =
    side === 'before' ? text.previousSibling : text.nextSibling;
  while (beyond !== null && isWalkTransparent(beyond)) {
    beyond = side === 'before' ? beyond.previousSibling : beyond.nextSibling;
  }
  return beyond !== null && isChipElement(beyond) ? text : null;
};

/** The first chip on one side of a node (through transparents). */
const chipBesideNode = (
  node: Node,
  side: 'before' | 'after'
): HTMLElement | null => {
  let sibling: ChildNode | null =
    side === 'before' ? node.previousSibling : node.nextSibling;
  while (sibling !== null && isWalkTransparent(sibling)) {
    sibling = side === 'before' ? sibling.previousSibling : sibling.nextSibling;
  }
  return sibling !== null && isChipElement(sibling) ? sibling : null;
};

/**
 * Round 8 (user decision 2026-10-19): places the caret at the END of
 * the preview text — "the last position of the text" — for the
 * edit-OFF→ON toggle convenience (the equivalent of clicking at the
 * end, ready to type). The walk targets the end of the last
 * MEANINGFUL content: zero-footprint landing anchors, the
 * drop-indicator needle, the bogus `<br>` line anchor, empty text,
 * and comments are skipped. A trailing `"\n"` text node keeps the
 * caret at ITS end — exactly between the newline and the planted
 * `<br>`, the visible-new-line position; a document ending in a chip
 * places the caret inside the chip's last text child at its end (the
 * browser's click-at-end preference — chip territory for typing per
 * round 5); an empty flow lands at position 0 (the F3 placeholder
 * editor).
 */
export const placeCaretAtTextEnd = (root: HTMLElement): void => {
  const children = root.childNodes;
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const node = children[index];
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      if (text.data === '') {
        continue;
      }
      placeCaret(text, text.data.length);
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (isZeroFootprintNode(element) || element.tagName === 'BR') {
        continue;
      }
      // A chip: inside its last text child at the end — the
      // click-at-end browser behavior.
      const texts = textChildrenOf(element);
      if (texts.length > 0) {
        const last = texts[texts.length - 1];
        placeCaret(last, last.data.length);
        return;
      }
      // A chip without text children (unreachable in practice —
      // emptied chips are pruned): right after the chip.
      placeCaret(root, index + 1);
      return;
    }
    // Comments and other non-rendering nodes: keep walking.
  }
  // No meaningful content: the flow's start (the F3 empty editor).
  placeCaret(root, 0);
};

/** The chip bounding a between-chips gap on one side. */
const chipBoundingGapSide = (
  gap: CaretGap,
  side: 'left' | 'right'
): HTMLElement | null =>
  chipBesideNode(
    side === 'left' ? gap.firstNode : gap.lastNode,
    side === 'left' ? 'before' : 'after'
  );

/**
 * True for nodes that contribute neither text nor a rendered line to
 * the flow's end: zero-length text nodes, comments, the zero-footprint
 * landing anchors (round 7's `data-landing` word-boundary anchors and
 * the legacy gap anchors), and the drop-indicator needle. Scans for
 * the block's meaningful end skip these.
 */
const isZeroFootprintNode = (node: Node): boolean => {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node as Text).data === '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return true; // comments and other non-rendering nodes
  }
  const element = node as HTMLElement;
  return (
    element.dataset?.gapSlot !== undefined ||
    element.dataset?.landing !== undefined ||
    element.getAttribute('data-testid') === 'preview-drop-indicator'
  );
};

/**
 * Plants a bogus `<br>` line anchor right after a trailing "\n" text
 * node — Chrome's own native contentEditable technique for pre-wrap
 * blocks (user-reported fix, 2026-10-17): a newline at the very end
 * of the block renders no empty last line, so a caret placed after it
 * has no visible line box and appears stuck on the previous line.
 * The anchor forces the line box; the caret — already placed right
 * after the "\n" by the insertion — sits between the two and renders
 * on the new line. Rules:
 * - planted only when nothing meaningful follows the newline (only
 *   zero-footprint anchors or nothing): content after the newline
 *   renders the line box by itself;
 * - never stacked: an already-planted anchor is enough;
 * - never touches the selection — pure DOM planting, so the re-focus
 *   path can use it without moving a user-placed caret;
 * - invisible to the model: the parser recurses into unknown elements
 *   and flattens to their textContent, and a `<br>` has none — no
 *   token, no serialization footprint, and the WYSIWYG invariant
 *   (`flow.textContent === serialize(document)`) holds even while
 *   focused. The thaw re-render rebuilds the children from the model,
 *   so the anchor self-heals away on blur and on edit-off.
 * A `<br>` is not a droppable/sortable node, so dnd-kit's measured
 * rects are unperturbed.
 */
export const ensureTrailingLineAnchor = (newlineNode: Text): void => {
  const parent = newlineNode.parentNode;
  if (!parent) {
    return;
  }
  let sibling = newlineNode.nextSibling;
  let anchorExists = false;
  while (sibling !== null) {
    if (
      sibling.nodeType === Node.ELEMENT_NODE &&
      (sibling as HTMLElement).tagName === 'BR'
    ) {
      anchorExists = true; // one trailing anchor is enough
    } else if (!isZeroFootprintNode(sibling)) {
      // Meaningful content follows the newline: it renders the line
      // box, no anchor needed.
      return;
    }
    sibling = sibling.nextSibling;
  }
  if (anchorExists) {
    return;
  }
  const anchor = newlineNode.ownerDocument.createElement('br');
  parent.insertBefore(anchor, newlineNode.nextSibling);
};

/**
 * The flow's last meaningful DOM node when it is a text node ending
 * with "\n" (the re-rendered trailing line break), or null. Used on
 * focus: a document that already ends with a line break renders no
 * empty last line either, so clicking back at the end would show the
 * caret on the previous line without an anchor.
 */
export const findTrailingNewlineNode = (root: HTMLElement): Text | null => {
  const children = root.childNodes;
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const node = children[index];
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (
        element.tagName === 'BR' ||
        element.dataset?.gapSlot !== undefined ||
        element.dataset?.landing !== undefined ||
        element.getAttribute('data-testid') === 'preview-drop-indicator'
      ) {
        continue;
      }
      return null; // a chip or unknown element ends the block
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      if (text.data === '') {
        continue;
      }
      return text.data.endsWith('\n') ? text : null;
    }
    // Comments and other non-rendering nodes: keep walking.
  }
  return null;
};

const SORTING_KEYS = {
  instructions: 'pages.mergeSession.previewArea.sorting.instructions',
  started: 'pages.mergeSession.previewArea.sorting.started',
  over: 'pages.mergeSession.previewArea.sorting.over',
  ended: 'pages.mergeSession.previewArea.sorting.ended',
  cancelled: 'pages.mergeSession.previewArea.sorting.cancelled',
} as const;

const EDITING_KEYS = {
  label: 'pages.mergeSession.previewArea.editing.label',
  placeholder: 'pages.mergeSession.previewArea.editing.placeholder',
} as const;

/**
 * Composes i18n, the preview document from SnippetsContext, and this
 * PreviewArea instance's drag-sorting wiring (sensors, announcements,
 * drag lifecycle handlers on token indexes) plus — while edit mode is
 * ON — the editable-surface contract (ADR 0004): the focused surface
 * owns its DOM (its parsed edits dispatch one whole-document sync
 * without React reconciling the token children; the snapshot thaws on
 * blur and on non-text model changes), Enter inserts a "\n" text
 * node, and paste strips to plain text. The optional
 * `onActiveDragChange` callback is additive-only (default no-op): it
 * mirrors this instance's drag lifecycle for consumers such as the
 * preview modal's Escape guard.
 */
export function usePreviewArea(
  onActiveDragChange?: (active: boolean) => void
) {
  const { t } = useTranslation();
  const {
    // Aliased on destructure so the DOM global `document` stays
    // reachable inside this module.
    document: previewDocument,
    editEnabled,
    moveTokenToLanding,
    syncDocument,
    setEditEnabled,
  } = useSnippets();

  const snippetTokens = useMemo(
    () => previewDocument.filter(isSnippetToken),
    [previewDocument]
  );
  const sortableIds = useMemo(
    () => snippetTokens.map((token) => token.tokenId),
    [snippetTokens]
  );

  // Round 6 (user decision 2026-10-18): while edit mode is ON the
  // mouse serves the editor — the pointer sensor is NOT mounted for
  // the editing surface. Both sensor sets are created by separate
  // unconditional hooks (the hooks themselves are never
  // conditionalized); the mounted array is filtered per mode:
  // keyboard-only while editing, pointer + keyboard while not.
  const pointerSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: SNIPPET_DRAG_ACTIVATION,
    })
  );
  const keyboardSensors = useSensors(
    // Round 7: the arrows step through ALL droppable landing
    // positions (chips + word-boundary anchors) in reading order.
    useSensor(KeyboardSensor, {
      coordinateGetter: landingKeyboardCoordinates,
    })
  );
  const sensors = useMemo(
    () =>
      editEnabled
        ? keyboardSensors
        : [...pointerSensors, ...keyboardSensors],
    [editEnabled, pointerSensors, keyboardSensors]
  );

  const [activeSnippet, setActiveSnippet] = useState<SnippetToken | null>(null);
  // Insertion slot of the drop-indicator needle; null keeps it hidden
  // (no active drag, or no target resolves).
  const [dropLanding, setDropLanding] = useState<Landing | null>(null);

  // ---- editable surface state (ADR 0004) ---------------------------

  // The segment-flow root (the contentEditable host while edit is ON).
  const flowRef = useRef<HTMLDivElement | null>(null);
  const [flowFocused, setFlowFocused] = useState(false);
  // The token snapshot the focused surface renders from: frozen while
  // edit is ON and the surface is focused (the browser owns the DOM),
  // null otherwise (children render from the live model).
  const [frozenTokens, setFrozenTokens] = useState<PreviewToken[] | null>(null);
  // Bumped on every thaw (blur, edit toggled OFF) so the flow root's
  // children remount cleanly from the model — React's reconciliation
  // must never run against browser-managed DOM, and the remount is
  // also what resets the native undo stack after a blur.
  const [renderEpoch, setRenderEpoch] = useState(0);
  // The last parse this surface dispatched (kept until the next
  // document change is classified). A NO-OP sync returns
  // reference-identical state — no re-render — so a one-shot flag
  // would stick and wrongly absorb the NEXT external change; the
  // incoming document is instead classified against this parse by
  // content (ignoring `edited`, the reducer's only transform).
  const lastParseRef = useRef<PreviewToken[] | null>(null);
  // The last document this instance has accounted for in a render.
  const modelRef = useRef<PreviewToken[]>(previewDocument);
  // Gap-collapse tracking (user decision 2026-10-17, round 4): the
  // caret's current spaces-only between-chips run, plus whether the
  // document-level selectionchange listener is attached.
  const gapRef = useRef<CaretGap | null>(null);
  const gapListenerActiveRef = useRef(false);
  // Round-5 doc-edge scaffold (user decision 2026-10-18): the space
  // node an arrow created at the document's start/end, by identity —
  // removed on exit when nothing was typed into it.
  const scaffoldRef = useRef<{ node: Text; edge: 'doc-start' | 'doc-end' } | null>(
    null
  );
  // Round-6 keyboard sort (user decision 2026-10-18): while edit mode
  // is ON, Ctrl+Space with the caret inside a snippet lifts it. The
  // ref guards the keydown paths synchronously; the state drives the
  // post-drop/cancel caret restoration effect.
  const keyboardSortActiveRef = useRef(false);
  const [keyboardSortActive, setKeyboardSortActive] = useState(false);
  const savedSortCaretRef = useRef<KeyboardSortCaret | null>(null);
  const pendingCaretRestoreRef = useRef<KeyboardSortCaret | null>(null);

  const indexOfSortableId = useCallback(
    (id: string) =>
      snippetTokens.findIndex((token) => token.tokenId === id),
    [snippetTokens]
  );

  const tokenIndexOf = useCallback(
    (id: string) =>
      previewDocument.findIndex(
        (token) => isSnippetToken(token) && token.tokenId === id
      ),
    [previewDocument]
  );

  // Additive drag-lifecycle notification: fires true when a drag
  // activates in this instance and false when it ends or cancels —
  // on every path, before any early return, so a consumer's guard
  // can never stay stuck on.
  const notifyActiveDragChange = useCallback(
    (active: boolean) => {
      onActiveDragChange?.(active);
    },
    [onActiveDragChange]
  );

  // Dispatches one whole-document sync of the surface's parsed DOM
  // and remembers the parse, so the document-change effect can tell
  // this surface's own edit from an external change.
  const dispatchParsedSync = useCallback(
    (parsed: PreviewToken[]) => {
      lastParseRef.current = parsed;
      syncDocument(parsed);
    },
    [syncDocument]
  );

  const commitFlow = useCallback(() => {
    const root = flowRef.current;
    if (!root) {
      return;
    }
    const parsed = parsePreviewDom(root, modelRef.current);
    // Round 8 (dev-server-safe commits): a content-identical parse
    // dispatches NOTHING. The reducer's SYNC no-op check is
    // id-sensitive (the parse regenerates own-text ids), so even a
    // content-equal commit churns the document REFERENCE — and a
    // reference change remounts any OTHER focused+editing surface
    // (the ADR 0004 external-change contract). With the round-8
    // toggle auto-focus, the sibling surfaces hand focus over on
    // every OFF→ON transition (the visible one wins); the blurred
    // surface's content-equal commit must not ripple a remount into
    // the winner. Skipping the dispatch is semantically exact: the
    // model already matches the DOM, the edited flags and tombstones
    // are preserved either way, and the no-op-sync absorb mechanism
    // only classifies dispatched parses.
    if (tokensEqualIgnoringEdited(modelRef.current, parsed)) {
      return;
    }
    dispatchParsedSync(parsed);
  }, [dispatchParsedSync]);

  // ---- gap collapse on caret exit (user decision 2026-10-17,
  // round 4): a spaces-only run directly between two chips keeps any
  // number of spaces while the caret stays inside it, and collapses
  // to exactly one space the moment the caret leaves it — by click,
  // arrow navigation (selectionchange), or blur. ---------------------

  const handleSelectionChange = useCallback(() => {
    const root = flowRef.current;
    if (!root) {
      return;
    }
    const range = selectionRangeInRoot(root);
    const currentGap =
      range && range.collapsed
        ? findCaretGap(root, range.startContainer, range.startOffset)
        : null;
    const tracked = gapRef.current;
    gapRef.current = currentGap;
    const sameGap =
      tracked !== null &&
      currentGap !== null &&
      tracked.firstNode === currentGap.firstNode &&
      tracked.lastNode === currentGap.lastNode;
    if (tracked && !sameGap && collapseGapSpaces(root, tracked)) {
      // The collapse is a DOM edit: one commit; the focused surface
      // absorbs it as its own parse, the blurred twin re-renders.
      commitFlow();
    }
    // Round-5 doc-edge scaffold: the caret leaving an untouched
    // scaffold (click-away, arrows that did not handle it) removes
    // it — the free zone only exists while the caret occupies it.
    const scaffold = scaffoldRef.current;
    if (scaffold) {
      const inside =
        range !== null && range.collapsed && range.startContainer === scaffold.node;
      if (!inside) {
        scaffoldRef.current = null;
        if (
          root.contains(scaffold.node) &&
          scaffold.node.data === ' '
        ) {
          scaffold.node.remove();
          commitFlow();
        }
      }
    }
  }, [commitFlow]);

  const startGapTracking = useCallback(() => {
    const root = flowRef.current;
    if (!root) {
      return;
    }
    // Seed the tracked gap with the caret that just landed.
    const range = selectionRangeInRoot(root);
    gapRef.current =
      range && range.collapsed
        ? findCaretGap(root, range.startContainer, range.startOffset)
        : null;
    if (!gapListenerActiveRef.current) {
      document.addEventListener('selectionchange', handleSelectionChange);
      gapListenerActiveRef.current = true;
    }
  }, [handleSelectionChange]);

  const stopGapTracking = useCallback((): CaretGap | null => {
    const tracked = gapRef.current;
    gapRef.current = null;
    if (gapListenerActiveRef.current) {
      document.removeEventListener('selectionchange', handleSelectionChange);
      gapListenerActiveRef.current = false;
    }
    return tracked;
  }, [handleSelectionChange]);

  // Safety: the listener never outlives the surface.
  useEffect(
    () => () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    },
    [handleSelectionChange]
  );

  // Mode-aware focused-surface-owns-DOM contract (ADR 0004): an
  // incoming document change is classified against this surface's
  // last dispatched parse — content-equal (ignoring `edited`) means
  // it is the surface's own parsed edit: absorb it (the focused DOM
  // is the source of truth; the frozen children stay; NO-OP syncs
  // never reach this effect at all). Every other change (a completed
  // drag, source-driven reconciliation) is a non-text change — the
  // focused surface re-renders from the model with a clean-slate
  // remount (a possible caret reset after a drag is the accepted
  // trade-off). The shared SnippetsContext document is an external
  // system for this component: the effect is the sanctioned place
  // to synchronize with it.
  useEffect(() => {
    const ownParse = lastParseRef.current;
    // Classified (or consumed): a stale parse must never absorb a
    // later, unrelated change.
    lastParseRef.current = null;
    if (
      ownParse !== null &&
      tokensEqualIgnoringEdited(previewDocument, ownParse)
    ) {
      modelRef.current = previewDocument;
      return;
    }
    if (previewDocument !== modelRef.current) {
      modelRef.current = previewDocument;
      if (editEnabled && flowFocused) {
        // eslint-disable-next-line react/set-state-in-effect -- deliberate: syncing with the external shared-document change
        setFrozenTokens(previewDocument);
        setRenderEpoch((epoch) => epoch + 1);
      }
    }
  }, [previewDocument, editEnabled, flowFocused]);

  // Toggling edit OFF mid-typing commits the focused DOM first (no
  // keystroke is lost), then the read-only flow re-renders from the
  // model — leaving the editor by any means also collapses a >1 gap
  // the caret may still be in. The editEnabled flag lives in the
  // shared context (an external system): the effect is the sanctioned
  // place to sync.
  const previousEditEnabledRef = useRef(editEnabled);
  useEffect(() => {
    const wasEnabled = previousEditEnabledRef.current;
    previousEditEnabledRef.current = editEnabled;
    if (wasEnabled === editEnabled) {
      return;
    }
    if (!editEnabled) {
      const tracked = stopGapTracking();
      if (flowFocused) {
        const root = flowRef.current;
        if (tracked && root) {
          collapseGapSpaces(root, tracked);
        }
        // Round-5: leaving the editor removes an untouched doc-edge
        // scaffold before the commit.
        const scaffold = scaffoldRef.current;
        scaffoldRef.current = null;
        if (root && scaffold && root.contains(scaffold.node) && scaffold.node.data === ' ') {
          scaffold.node.remove();
        }
        commitFlow();
      }
      // eslint-disable-next-line react/set-state-in-effect -- deliberate: syncing with the external edit-toggle change
      setFlowFocused(false);
      setFrozenTokens(null);
      setRenderEpoch((epoch) => epoch + 1);
      return;
    }
    // Round 8 (user decision 2026-10-19): "auto position the caret on
    // the last position of the text in preview area when enabling
    // edit text mode" — the OFF→ON transition focuses this surface's
    // host and places the caret at the text's end, ready to type (the
    // convenience equivalent of clicking at the end). The focus runs
    // the established onFocus machinery (the frozen-snapshot seeding,
    // the round-1 trailing-line-anchor planting, gap tracking);
    // EVERY mounted surface reacts, and the VISIBLE one wins
    // deterministically: React runs this effect in tree order, so
    // with the modal open the modal's portal-subtree effect (the
    // later fiber) focuses last and its host ends up the active
    // element — the pinned observable (rail toggle → the modal's
    // editor focused; toolbar toggle → the inline editor focused).
    // Scope: the transition only — surfaces mounting while already
    // editing keep today's click-to-focus behavior (the ref
    // initializes to the current flag, so no transition fires).
    const root = flowRef.current;
    if (root) {
      root.focus();
      placeCaretAtTextEnd(root);
    }
  }, [editEnabled, flowFocused, commitFlow, stopGapTracking]);

  const handleFlowFocus = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      // Focus bubbles up from the chips: only the editor host itself
      // starts the frozen window.
      if (event.target !== flowRef.current) {
        return;
      }
      setFlowFocused(true);
      setFrozenTokens(modelRef.current);
      // A document that already ends with a line break renders no
      // empty last line either (same pre-wrap quirk as the Enter
      // path): plant the anchor so clicking at the end shows the
      // caret on the new line. Focus opens the frozen window, so
      // React will not reconcile the planted node away until thaw.
      const root = flowRef.current;
      const trailing = root ? findTrailingNewlineNode(root) : null;
      if (trailing) {
        ensureTrailingLineAnchor(trailing);
      }
      // Gap tracking starts with the caret that just landed.
      startGapTracking();
    },
    [startGapTracking]
  );

  const handleFlowBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      // A chip losing focus must not thaw the editor (focus events
      // bubble); only the host itself blurring does.
      if (event.target !== flowRef.current) {
        return;
      }
      // Blur is leaving: collapse the gap the caret may still be in
      // BEFORE the commit, so the commit parses the collapsed DOM.
      const tracked = stopGapTracking();
      const root = flowRef.current;
      if (tracked && root) {
        collapseGapSpaces(root, tracked);
      }
      // Round-5: blur also removes an untouched doc-edge scaffold.
      const scaffold = scaffoldRef.current;
      scaffoldRef.current = null;
      if (root && scaffold && root.contains(scaffold.node) && scaffold.node.data === ' ') {
        scaffold.node.remove();
      }
      commitFlow();
      setFlowFocused(false);
      setFrozenTokens(null);
      setRenderEpoch((epoch) => epoch + 1);
    },
    [commitFlow, stopGapTracking]
  );

  const handleFlowInput = useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      const root = flowRef.current;
      if (!root) {
        return;
      }
      // EVERY input event syncs the model (EDIT-33: one parse + one
      // whole-document sync per input — the round-4 cycle-1 fix is
      // sacred). Real browsers label every input via InputEvent —
      // deletions (deleteContentBackward, deleteByCut, historyUndo,
      // …) and whitespace keystrokes included — so the round-5
      // redirect gates gate ONLY the chip-territory redirect, never
      // the sync below.
      const nativeEvent = event.nativeEvent as InputEvent;
      const inputType = nativeEvent?.inputType;
      const data = nativeEvent?.data;
      const isInsertion = !inputType || inputType.startsWith('insert');
      const hasTypedRun =
        typeof data === 'string' && data.length > 0 && /\S/.test(data);
      const range = selectionRangeInRoot(root);
      if (isInsertion && hasTypedRun && range && range.collapsed) {
        // Round-5 rule A (user decision 2026-10-18): typing at a caret
        // position that directly abutted a chip is the chip's
        // territory — the typed run moves into the chip (or, at a
        // glued seam, keeps the round-4 spaces-both-sides behavior).
        // Bare (data-less) events — the jsdom-driven suites — never
        // redirect: the run cannot be identified safely.
        redirectTypedRunToChipTerritory(root, range, data as string);
      }
      dispatchParsedSync(parsePreviewDom(root, modelRef.current));
    },
    [dispatchParsedSync]
  );

  /**
   * Creates the round-5 doc-edge scaffold: ONE space planted outside
   * the first/last chip, the caret inside it, tracked by node
   * identity. The caret placement makes typing produce the user's
   * pinned results: doc-start at the space's START (the typed run
   * precedes the space → `X Alpha`), doc-end at its END (the run
   * follows the space → `Alpha X`). Leaving the previous zone first:
   * an untouched older scaffold is removed, and the caret's previous
   * between-chips gap collapses (rule 2, the exit path).
   */
  const createDocEdgeScaffold = useCallback(
    (root: HTMLElement, chip: HTMLElement, edge: 'doc-start' | 'doc-end') => {
      const previousScaffold = scaffoldRef.current;
      scaffoldRef.current = null;
      if (
        previousScaffold &&
        root.contains(previousScaffold.node) &&
        previousScaffold.node.data === ' '
      ) {
        previousScaffold.node.remove();
      }
      const trackedGap = gapRef.current;
      gapRef.current = null;
      if (trackedGap && collapseGapSpaces(root, trackedGap)) {
        commitFlow();
      }
      const node = plantTextBesideChip(
        chip,
        edge === 'doc-start' ? 'before' : 'after',
        ' '
      );
      placeCaret(node, edge === 'doc-start' ? 0 : 1);
      scaffoldRef.current = { node, edge };
      commitFlow();
    },
    [commitFlow]
  );

  // Round-5 rule B (user decision 2026-10-18): arrows create the free
  // zones — ArrowLeft/ArrowRight at a between-chips gap edge (or from
  // the adjacent chip's boundary) expand the one-space gap to two
  // with the caret centered; at the document's start/end they
  // scaffold ONE space outside the first/last chip. Arrows leaving a
  // >1-space gap hop directly into the bounding chips' interiors
  // (the gap's edge positions are click-only territory — agent
  // default); the arrow back from an untouched doc-edge scaffold
  // removes it and restores the caret inside the chip. ArrowUp/Down
  // stay native.
  const handleArrowNavigation = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const root = flowRef.current;
      if (!root) {
        return;
      }
      const range = selectionRangeInRoot(root);
      if (!range || !range.collapsed) {
        return;
      }
      const key = event.key;
      const { startContainer, startOffset } = range;

      // 1. The active doc-edge scaffold: the arrow toward its chip on
      //    an UNTOUCHED scaffold removes it and restores the caret
      //    inside the chip (the user's belongs-to-the-snippet flow).
      const scaffold = scaffoldRef.current;
      if (
        scaffold &&
        root.contains(scaffold.node) &&
        range.startContainer === scaffold.node
      ) {
        const towardChip =
          (scaffold.edge === 'doc-start' && key === 'ArrowRight') ||
          (scaffold.edge === 'doc-end' && key === 'ArrowLeft');
        scaffoldRef.current = null; // leaving the scaffold, one way or the other
        if (towardChip && scaffold.node.data === ' ') {
          event.preventDefault();
          const chip = chipBesideNode(
            scaffold.node,
            scaffold.edge === 'doc-start' ? 'after' : 'before'
          );
          scaffold.node.remove();
          if (chip) {
            const chipText =
              scaffold.edge === 'doc-start'
                ? firstTextChildOf(chip)
                : lastTextChildOf(chip);
            if (chipText) {
              placeCaret(
                chipText,
                scaffold.edge === 'doc-start' ? 0 : chipText.data.length
              );
            }
          }
          commitFlow();
          return;
        }
        // Typed content or the far arrow: native (the scaffold is
        // content now; the tracker removes the ref on caret exit).
        return;
      }

      // 2. Inside a >1-space between-chips gap (the scaffold, or
      //    deliberately typed extra spaces): arrows hop into the
      //    bounding chips' interiors; rule 2 collapses the gap on
      //    the exit.
      const gap = findCaretGap(root, startContainer, startOffset);
      if (gap && gap.spaces > 1) {
        let hopped = false;
        if (key === 'ArrowLeft') {
          const leftChip = chipBoundingGapSide(gap, 'left');
          const chipText = leftChip ? lastTextChildOf(leftChip) : null;
          if (chipText) {
            event.preventDefault();
            placeCaret(chipText, chipText.data.length);
            hopped = true;
          }
        } else if (key === 'ArrowRight') {
          const rightChip = chipBoundingGapSide(gap, 'right');
          const chipText = rightChip ? firstTextChildOf(rightChip) : null;
          if (chipText) {
            event.preventDefault();
            placeCaret(chipText, 0);
            hopped = true;
          }
        }
        if (hopped) {
          const tracked = gapRef.current;
          gapRef.current = null;
          if (tracked && collapseGapSpaces(root, tracked)) {
            commitFlow();
          }
        }
        return;
      }

      // 3. A one-space between-chips gap: the arrow INTO the gap
      //    (from either edge) expands it to two spaces with the
      //    caret centered — the scaffolded free zone.
      if (gap && gap.spaces === 1) {
        const after = chipBoundaryFromCaret(root, startContainer, startOffset, 'after');
        const before = chipBoundaryFromCaret(root, startContainer, startOffset, 'before');
        const atRightEdge = after.chip !== null && after.crossed === '';
        const atLeftEdge = before.chip !== null && before.crossed === '';
        if (
          (key === 'ArrowLeft' && atRightEdge) ||
          (key === 'ArrowRight' && atLeftEdge)
        ) {
          event.preventDefault();
          const separator = gap.firstNode;
          separator.insertData(0, ' ');
          placeCaret(separator, 1);
          gapRef.current = findCaretGap(root, separator, 1);
          commitFlow();
        }
        // The arrow toward a chip from an edge stays native.
        return;
      }

      // 4. The caret inside a chip at its boundary: into the adjacent
      //    one-space gap → scaffold; at the document's first/last
      //    position → the doc-edge scaffold.
      const classification = classifyCaretRelativeChip(root, range);
      const chip = classification.chip;
      if (
        chip &&
        key === 'ArrowLeft' &&
        classification.position === 'inside-chip-at-start'
      ) {
        const separator = singleSpaceGapBesideChip(chip, 'before');
        if (separator) {
          event.preventDefault();
          separator.insertData(0, ' ');
          placeCaret(separator, 1);
          gapRef.current = findCaretGap(root, separator, 1);
          commitFlow();
          return;
        }
        if (firstMeaningfulChip(root) === chip) {
          event.preventDefault();
          createDocEdgeScaffold(root, chip, 'doc-start');
        }
        return;
      }
      if (
        chip &&
        key === 'ArrowRight' &&
        classification.position === 'inside-chip-at-end'
      ) {
        const separator = singleSpaceGapBesideChip(chip, 'after');
        if (separator) {
          event.preventDefault();
          separator.insertData(0, ' ');
          placeCaret(separator, 1);
          gapRef.current = findCaretGap(root, separator, 1);
          commitFlow();
          return;
        }
        if (lastMeaningfulChip(root) === chip) {
          event.preventDefault();
          createDocEdgeScaffold(root, chip, 'doc-end');
        }
        return;
      }
      if (chip) {
        return; // interior of a chip: native
      }

      // 5. The flow position directly before the first chip / after
      //    the last chip (the doc-edge free-zone creation).
      if (key === 'ArrowLeft') {
        const first = firstMeaningfulChip(root);
        const after = chipBoundaryFromCaret(root, startContainer, startOffset, 'after');
        const beforeChar = adjacentFlowCharacter(startContainer, startOffset, 'before');
        if (
          first !== null &&
          after.chip === first &&
          after.crossed === '' &&
          beforeChar === null
        ) {
          event.preventDefault();
          createDocEdgeScaffold(root, first, 'doc-start');
        }
        return;
      }
      if (key === 'ArrowRight') {
        const last = lastMeaningfulChip(root);
        const before = chipBoundaryFromCaret(root, startContainer, startOffset, 'before');
        const afterChar = adjacentFlowCharacter(startContainer, startOffset, 'after');
        if (
          last !== null &&
          before.chip === last &&
          before.crossed === '' &&
          afterChar === null
        ) {
          event.preventDefault();
          createDocEdgeScaffold(root, last, 'doc-end');
        }
        return;
      }
    },
    [commitFlow, createDocEdgeScaffold]
  );

  const handleFlowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Space/Enter on a FOCUSED chip is dnd-kit's keyboard pickup
      // (the activator only fires when the keydown target is the
      // activator node); keys with the caret in the editor host
      // (target === host) drive the editor.
      if (event.target !== flowRef.current) {
        return;
      }
      const root = flowRef.current;
      if (!root) {
        return;
      }
      // Round 6: while a snippet is raised (keyboard sort), editing
      // keys are suspended — everything is preventDefaulted so no
      // input fires mid-sort. The sensor-owned keys (bare Space and
      // Enter — both native end codes in the installed 6.3.1 —
      // Escape — cancel — and the arrows — move — plus Tab) still
      // PROPAGATE so the sensor's document-level listeners handle
      // them; every other key is stopped outright. A second
      // Ctrl+Space is a NO-OP by contract, so its ctrl-modified
      // Space code is stopped too — the sensor would otherwise read
      // the bare Space code as a drop.
      if (keyboardSortActiveRef.current) {
        event.preventDefault();
        const code = event.nativeEvent.code;
        const sensorOwnedKey =
          code === 'Space' ||
          code === 'Enter' ||
          code === 'Escape' ||
          code === 'ArrowLeft' ||
          code === 'ArrowRight' ||
          code === 'ArrowUp' ||
          code === 'ArrowDown' ||
          code === 'Tab';
        const ctrlModified =
          (event.ctrlKey || event.metaKey) && event.key === ' ';
        if (!sensorOwnedKey || ctrlModified) {
          event.stopPropagation();
        }
        return;
      }
      // Round 6 (user decision 2026-10-18): Ctrl+Space with the
      // caret inside a snippet lifts it into keyboard sorting. The
      // chip cannot take focus while editing (plain spans), so the
      // activation keydown is dispatched directly on the chip
      // element — the sensor's activator only requires the keydown
      // TARGET to be the activator node (verified in the installed
      // source), and the keyboard activator stays attached while
      // editing (it is the only mounted sensor).
      if (event.key === ' ' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        const range = selectionRangeInRoot(root);
        const classification =
          range && range.collapsed
            ? classifyCaretRelativeChip(root, range)
            : null;
        if (!classification?.chip) {
          return; // caret outside a snippet: no-op
        }
        savedSortCaretRef.current = savedKeyboardSortCaret(
          classification.chip,
          range as Range
        );
        classification.chip.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            bubbles: true,
            cancelable: true,
          })
        );
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        handleArrowNavigation(event);
        return;
      }
      if (event.key !== 'Enter') {
        return;
      }
      event.preventDefault();
      // "A line break never enters a snippet" (user decision
      // 2026-10-17): browsers place a click-at-the-end caret INSIDE
      // the chip's text node, and inserting there would make the
      // newline — and everything typed on the next line — part of
      // the snippet token (the parser takes the chip's whole
      // textContent). At a chip's end/start text boundary the "\n"
      // is therefore planted OUTSIDE the chip, as its sibling; the
      // caret follows it, so the new line's text is own text in the
      // flow. Mid-chip Enters (and every typed character) keep the
      // Q3 in-snippet integration contract.
      const range = selectionRangeInRoot(root);
      const classification = range
        ? classifyCaretRelativeChip(root, range)
        : null;
      let newlineNode: Text | null = null;
      if (
        classification?.position === 'inside-chip-at-end' &&
        classification.chip
      ) {
        newlineNode = insertLineBreakOutsideChip(classification.chip, 'after');
      } else if (
        classification?.position === 'inside-chip-at-start' &&
        classification.chip
      ) {
        newlineNode = insertLineBreakOutsideChip(
          classification.chip,
          'before'
        );
      } else {
        newlineNode = insertTextAtSelection(root, '\n');
      }
      if (newlineNode) {
        // A trailing "\n" renders no empty last line in pre-wrap: the
        // caret would appear stuck on the previous line. Plant the
        // bogus anchor so the new line has a visible line box (when
        // the newline now ends the block, e.g. the chip was last).
        ensureTrailingLineAnchor(newlineNode);
        // Manual DOM edits fire no input event — sync explicitly.
        commitFlow();
      }
    },
    [commitFlow, handleArrowNavigation]
  );

  const handleFlowPaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      // Round 6: pasting is suspended while a snippet is raised.
      if (keyboardSortActiveRef.current) {
        event.preventDefault();
        return;
      }
      // Plain-text paste only: the browser never inserts rich content.
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      if (!text) {
        return;
      }
      const root = flowRef.current;
      if (!root) {
        return;
      }
      // "A line break never enters a snippet" applies to pasted text
      // too (user decision 2026-10-17, round 3: pasted text integrates
      // into the snippet only up to its first newline):
      // - caret OUTSIDE any chip → plain insert (unchanged);
      // - caret inside a chip, paste with NO newline → full
      //   integration (a single-line paste behaves like typed
      //   characters);
      // - caret at the chip's END boundary, paste WITH a newline →
      //   split at the first newline (prefix integrates into the
      //   chip, the newline and everything after land after the chip
      //   as flow content);
      // - caret at the chip's START boundary, paste WITH a newline →
      //   the WHOLE paste lands before the chip as flow content:
      //   integrating the prefix would scramble the pasted reading
      //   order (only the chip's text follows the caret there, so the
      //   tail would render before the prefix without splitting the
      //   chip — the rejected deviation b). Geometric agent default,
      //   recorded in implementation.md;
      // - caret mid-chip, paste WITH a newline → full integration
      //   (unchanged, consistent with mid-chip Enter: an
      //   order-preserving escape is impossible without splitting).
      const firstNewline = text.indexOf('\n');
      const range = selectionRangeInRoot(root);
      let inserted: Text | null = null;
      if (range) {
        const { position, chip } = classifyCaretRelativeChip(root, range);
        if (chip && firstNewline >= 0 && position === 'inside-chip-at-end') {
          inserted = insertSplitPasteAtChipEnd(chip, range, text);
        } else if (
          chip &&
          firstNewline >= 0 &&
          position === 'inside-chip-at-start'
        ) {
          inserted = insertTextBesideChip(chip, 'before', text);
        } else {
          inserted = insertTextAtSelection(root, text);
        }
      } else {
        inserted = insertTextAtSelection(root, text);
      }
      if (!inserted) {
        return;
      }
      // A tail ending in "\n" lands in the same invisible-line
      // situation as the Enter path: anchor the last line (the
      // sibling walk inside no-ops when a separator or chip follows).
      if (inserted.data.endsWith('\n')) {
        ensureTrailingLineAnchor(inserted);
      }
      commitFlow();
    },
    [commitFlow]
  );

  // ---- drag lifecycle (token indexes) ------------------------------

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      notifyActiveDragChange(true);
      const index = indexOfSortableId(String(event.active.id));
      setActiveSnippet(index >= 0 ? snippetTokens[index] : null);
      // Pickup resolves to the dragged item itself: the needle starts
      // at the origin spot (the anchor covering "before the chip").
      setDropLanding(
        index >= 0
          ? landingBeforeToken(previewDocument, tokenIndexOf(String(event.active.id)))
          : null
      );
      // Round 6: a raised snippet suspends editing keydowns while
      // edit mode is on (the guard is inert while edit is off).
      keyboardSortActiveRef.current = true;
      setKeyboardSortActive(true);
    },
    [indexOfSortableId, notifyActiveDragChange, previewDocument, snippetTokens, tokenIndexOf]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      const overId = over ? String(over.id) : null;
      if (overId === null) {
        setDropLanding(null);
        return;
      }

      // Round 7: a landing anchor is hovered — the needle marks
      // exactly that word boundary / token gap. A stale anchor (the
      // document shrank mid-drag) hides the needle: the landing must
      // resolve against the current document.
      const landing = parseLandingId(overId);
      if (landing) {
        let valid = false;
        if (landing.kind === 'token-gap') {
          valid =
            landing.tokenIndex >= 0 &&
            landing.tokenIndex <= previewDocument.length;
        } else {
          const target = previewDocument[landing.tokenIndex];
          valid =
            landing.tokenIndex >= 0 &&
            landing.tokenIndex < previewDocument.length &&
            target?.kind === 'text' &&
            landing.boundaryOffset >= 0 &&
            landing.boundaryOffset <= target.text.length;
        }
        setDropLanding(valid ? landing : null);
        return;
      }

      // A chip is hovered: the needle marks the insertion point the
      // chip-over maps to (the anchor covering "after the over chip"
      // forward / "before it" backward) — the same spot the old
      // slot-based needle marked.
      const fromSnippet = indexOfSortableId(String(active.id));
      const overSnippet = indexOfSortableId(overId);
      const overTokenIndex = tokenIndexOf(overId);
      if (fromSnippet < 0 || overSnippet < 0 || overTokenIndex < 0) {
        setDropLanding(null);
        return;
      }
      setDropLanding(
        fromSnippet < overSnippet
          ? landingAfterToken(previewDocument, overTokenIndex)
          : landingBeforeToken(previewDocument, overTokenIndex)
      );
    },
    [indexOfSortableId, previewDocument, tokenIndexOf]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      notifyActiveDragChange(false);
      setActiveSnippet(null);
      setDropLanding(null);
      // Round 6: the sort ended — schedule the caret restoration
      // (after the drop's re-render; a no-op drop restores into the
      // unchanged chip).
      if (keyboardSortActiveRef.current) {
        keyboardSortActiveRef.current = false;
        setKeyboardSortActive(false);
        pendingCaretRestoreRef.current = savedSortCaretRef.current;
      }
      const { active, over } = event;

      if (!over || active.id === over.id) {
        // Released on the item's own position or with no target: the
        // merge order stays unchanged.
        return;
      }

      const activeId = String(active.id);
      const fromIndex = indexOfSortableId(activeId);
      const fromTokenIndex = tokenIndexOf(activeId);
      const overId = String(over.id);

      if (fromIndex < 0 || fromTokenIndex < 0) {
        // The dragged snippet vanished mid-drag: discard the reorder.
        return;
      }

      // Round 7: a landing anchor — the word-boundary landing model.
      const landing = parseLandingId(overId);
      if (landing) {
        moveTokenToLanding(fromTokenIndex, landing);
        return;
      }

      // A chip-over: map to the insertion landing (before/after the
      // over chip) — the same serialization the old token-gap
      // insertion produced.
      const overTokenIndex = tokenIndexOf(overId);
      const overSnippet = indexOfSortableId(overId);
      if (overTokenIndex < 0 || overSnippet < 0) {
        return;
      }
      moveTokenToLanding(
        fromTokenIndex,
        fromIndex < overSnippet
          ? landingAfterToken(previewDocument, overTokenIndex)
          : landingBeforeToken(previewDocument, overTokenIndex)
      );
    },
    [
      indexOfSortableId,
      moveTokenToLanding,
      notifyActiveDragChange,
      previewDocument,
      tokenIndexOf,
    ]
  );

  const handleDragCancel = useCallback(
    (_event: DragCancelEvent) => {
      notifyActiveDragChange(false);
      setActiveSnippet(null);
      setDropLanding(null);
      // Round 6: cancelled — the snippet never moved; restore the
      // caret right away (the document is unchanged).
      if (keyboardSortActiveRef.current) {
        keyboardSortActiveRef.current = false;
        setKeyboardSortActive(false);
        pendingCaretRestoreRef.current = savedSortCaretRef.current;
      }
    },
    [notifyActiveDragChange]
  );

  // Round 6: after a keyboard sort ends (drop or cancel), restore the
  // host focus and place the caret back inside the sorted snippet —
  // at the position saved at Ctrl+Space when it still resolves, at
  // the chip's end otherwise (agent default). The timer lets the
  // drop's re-render (and the edit-mode remount) commit first.
  useEffect(() => {
    if (keyboardSortActive || !pendingCaretRestoreRef.current) {
      return;
    }
    const pending = pendingCaretRestoreRef.current;
    pendingCaretRestoreRef.current = null;
    const timer = setTimeout(() => {
      const root = flowRef.current;
      if (!root) {
        return;
      }
      root.focus();
      const chip = findChipByTokenId(root, pending.tokenId);
      if (!chip) {
        return; // the snippet vanished: host focus only
      }
      const textChildren = textChildrenOf(chip);
      const target =
        textChildren[pending.textChildIndex] ??
        textChildren[textChildren.length - 1];
      if (target) {
        placeCaret(target, Math.min(pending.offset, target.data.length));
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [keyboardSortActive]);

  const announcements = useMemo<Announcements>(() => {
    // Positions-only announcements: 1-based over the snippet tokens
    // (the draggable population), no snippet text.
    const describePosition = (key: string, id: string) => {
      const index = indexOfSortableId(id);
      return index >= 0
        ? t(key, { index: index + 1, count: snippetTokens.length })
        : undefined;
    };

    return {
      onDragStart: ({ active }) =>
        describePosition(SORTING_KEYS.started, String(active.id)),
      onDragOver: ({ active, over }) =>
        over && over.id !== active.id
          ? describePosition(SORTING_KEYS.over, String(over.id))
          : undefined,
      onDragEnd: ({ active, over }) => {
        if (!over) {
          return t(SORTING_KEYS.cancelled);
        }
        const overId = String(over.id);
        // Round 7: a landing drop (word boundary or token gap)
        // announces the moved chip's resulting position among the
        // snippet tokens — the same position identity chip drops
        // use, no new strings.
        const landing = parseLandingId(overId);
        if (landing) {
          const fromTokenIndex = tokenIndexOf(String(active.id));
          return fromTokenIndex >= 0
            ? t(SORTING_KEYS.ended, {
                index: landingSnippetPosition(
                  previewDocument,
                  fromTokenIndex,
                  landing
                ),
                count: snippetTokens.length,
              })
            : undefined;
        }
        return describePosition(SORTING_KEYS.ended, overId);
      },
      onDragCancel: () => t(SORTING_KEYS.cancelled),
    };
  }, [t, indexOfSortableId, previewDocument, snippetTokens, tokenIndexOf]);

  const screenReaderInstructions = useMemo<ScreenReaderInstructions>(
    () => ({ draggable: t(SORTING_KEYS.instructions) }),
    [t]
  );

  const mergedText = useMemo(() => serialize(previewDocument), [previewDocument]);

  return {
    t,
    document: previewDocument,
    editEnabled,
    // The editable-surface ARIA/attribute values (translated).
    editingLabel: t(EDITING_KEYS.label),
    editingPlaceholder: t(EDITING_KEYS.placeholder),
    // What the flow children render from: the frozen snapshot while
    // edit is ON and the surface is focused, the live document
    // otherwise.
    renderedTokens: frozenTokens ?? previewDocument,
    renderEpoch,
    mergedText,
    isDocumentEmpty: mergedText.length === 0,
    flowRef,
    snippetTokens,
    sortableIds,
    sensors,
    announcements,
    screenReaderInstructions,
    activeSnippet,
    dropLanding,
    handleFlowFocus,
    handleFlowBlur,
    handleFlowInput,
    handleFlowKeyDown,
    handleFlowPaste,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragCancel,
    setEditEnabled,
  };
}
