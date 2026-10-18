import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  Announcements,
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  ScreenReaderInstructions,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useSnippets } from '../../../../context/SnippetsContext';
import type { PreviewToken, SnippetToken } from '../../../../context/SnippetsContext';
import {
  isSnippetToken,
  parsePreviewDom,
  serialize,
  snippetSlotToTokenIndex,
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
 * Landing slot of the dragged snippet, as a gap in the CURRENT render
 * order (0..n — the dragged chip still renders at its origin slot), or
 * null while the drop-indicator needle is hidden. Indexes are positions
 * among SNIPPET tokens (the sortable population). Moving forward lands
 * the needle AFTER the hovered snippet, moving backward BEFORE it, and
 * hovering the dragged snippet itself (including the pickup instant)
 * lands at the origin slot — the needle can never contradict the drop
 * outcome. A null target or an unresolved index (-1: the snippet
 * vanished mid-drag) hides the needle.
 */
export const computeNeedleIndex = (
  fromIndex: number,
  overIndex: number | null
): number | null => {
  if (overIndex === null || fromIndex < 0 || overIndex < 0) {
    return null;
  }
  return fromIndex < overIndex ? overIndex + 1 : overIndex;
};

/**
 * Droppable id for the insertion gap at `slot` (0..n): the invisible
 * in-flow anchors rendered before/between/after the snippet chips. While
 * a pointer drag hovers a gap, dnd-kit reports it as `over`, so the
 * needle renders at that slot — the needle then never hides or
 * misplaces while the cursor sits in the space between two snippets.
 */
export const buildGapId = (slot: number): string => `preview-gap:${slot}`;

/**
 * Inverse of buildGapId: the encoded slot, or null for any other id
 * (sortable chips, unresolved targets).
 */
export const parseGapId = (id: string): number | null => {
  const match = /^preview-gap:(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
};

/**
 * Position among the snippet tokens where a drop at gap `slot` lands
 * the dragged chip (0-based). The reducer splices the chip out of
 * the document before re-inserting it, so slots past the removed chip
 * map one position lower. This is the announcement-side half of the
 * token-index gap math; the drop itself lands at
 * snippetSlotToTokenIndex and the reducer owns the removal
 * adjustment.
 */
export const computeGapMoveIndex = (
  fromIndex: number,
  slot: number
): number => (slot > fromIndex ? slot - 1 : slot);

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
 * instead of inside the chip's content, and places the caret right
 * after the node (the same Range/Selection technique
 * insertTextAtSelection uses). The Enter escape path
 * ("a line break never enters a snippet", user decision 2026-10-17)
 * and the paste escape paths (round 3: the same rule applies to
 * pasted text) build on it; content planted here is flow content —
 * own text/line-break tokens after parse — never snippet content.
 */
const insertTextBesideChip = (
  chip: HTMLElement,
  side: 'before' | 'after',
  text: string
): Text => {
  const doc = chip.ownerDocument;
  const node = doc.createTextNode(text);
  chip.parentNode?.insertBefore(
    node,
    side === 'before' ? chip : chip.nextSibling
  );
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

/**
 * True for nodes that contribute neither text nor a rendered line to
 * the flow's end: zero-length text nodes, comments, the zero-footprint
 * insertion-gap anchors, and the drop-indicator needle. Scans for the
 * block's meaningful end skip these.
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
    moveToken,
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: SNIPPET_DRAG_ACTIVATION,
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [activeSnippet, setActiveSnippet] = useState<SnippetToken | null>(null);
  // Insertion slot of the drop-indicator needle; null keeps it hidden
  // (no active drag, or no target resolves).
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(
    null
  );

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
    dispatchParsedSync(parsePreviewDom(root, modelRef.current));
  }, [dispatchParsedSync]);

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
  // model. The editEnabled flag lives in the shared context (an
  // external system): the effect is the sanctioned place to sync.
  const previousEditEnabledRef = useRef(editEnabled);
  useEffect(() => {
    const wasEnabled = previousEditEnabledRef.current;
    previousEditEnabledRef.current = editEnabled;
    if (wasEnabled === editEnabled) {
      return;
    }
    if (!editEnabled) {
      if (flowFocused) {
        commitFlow();
      }
      // eslint-disable-next-line react/set-state-in-effect -- deliberate: syncing with the external edit-toggle change
      setFlowFocused(false);
      setFrozenTokens(null);
      setRenderEpoch((epoch) => epoch + 1);
    }
  }, [editEnabled, flowFocused, commitFlow]);

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
    },
    []
  );

  const handleFlowBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      // A chip losing focus must not thaw the editor (focus events
      // bubble); only the host itself blurring does.
      if (event.target !== flowRef.current) {
        return;
      }
      commitFlow();
      setFlowFocused(false);
      setFrozenTokens(null);
      setRenderEpoch((epoch) => epoch + 1);
    },
    [commitFlow]
  );

  const handleFlowInput = useCallback(() => {
    const root = flowRef.current;
    if (!root) {
      return;
    }
    dispatchParsedSync(parsePreviewDom(root, modelRef.current));
  }, [dispatchParsedSync]);

  const handleFlowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter') {
        return;
      }
      // Space/Enter on a FOCUSED chip is dnd-kit's keyboard pickup
      // (the activator only fires when the keydown target is the
      // activator node); Enter with the caret in the editor host
      // (target === host) creates a line break.
      if (event.target !== flowRef.current) {
        return;
      }
      event.preventDefault();
      const root = flowRef.current;
      if (!root) {
        return;
      }
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
    [commitFlow]
  );

  const handleFlowPaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
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
      // at the origin slot.
      setDropIndicatorIndex(index >= 0 ? index : null);
    },
    [indexOfSortableId, notifyActiveDragChange, snippetTokens]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      const fromIndex = indexOfSortableId(String(active.id));
      const overId = over ? String(over.id) : null;
      const gapSlot = overId === null ? null : parseGapId(overId);

      if (gapSlot !== null) {
        // Gap anchors exist for slots 0..snippetTokens.length; a stale
        // slot (the list shrank mid-drag) hides the needle.
        setDropIndicatorIndex(
          gapSlot >= 0 && gapSlot <= snippetTokens.length ? gapSlot : null
        );
        return;
      }

      const overIndex = overId === null ? null : indexOfSortableId(overId);
      setDropIndicatorIndex(computeNeedleIndex(fromIndex, overIndex));
    },
    [indexOfSortableId, snippetTokens.length]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      notifyActiveDragChange(false);
      setActiveSnippet(null);
      setDropIndicatorIndex(null);
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
      const gapSlot = parseGapId(overId);

      if (gapSlot !== null) {
        // Released over an insertion gap: the chip lands exactly at
        // the slot the needle marked (a stale slot after a mid-drag
        // shrink discards the reorder).
        if (
          fromIndex < 0 ||
          fromTokenIndex < 0 ||
          gapSlot < 0 ||
          gapSlot > snippetTokens.length
        ) {
          return;
        }
        moveToken(
          fromTokenIndex,
          snippetSlotToTokenIndex(previewDocument, gapSlot)
        );
        return;
      }

      const overIndex = indexOfSortableId(overId);
      const overTokenIndex = tokenIndexOf(overId);

      if (fromIndex < 0 || overIndex < 0 || fromTokenIndex < 0 || overTokenIndex < 0) {
        // The dragged snippet vanished mid-drag: discard the reorder.
        return;
      }

      // Forward drops land right AFTER the hovered chip, backward
      // drops right BEFORE it — exactly where the needle marked.
      moveToken(
        fromTokenIndex,
        fromIndex < overIndex ? overTokenIndex + 1 : overTokenIndex
      );
    },
    [
      previewDocument,
      indexOfSortableId,
      moveToken,
      notifyActiveDragChange,
      snippetTokens.length,
      tokenIndexOf,
    ]
  );

  const handleDragCancel = useCallback(
    (_event: DragCancelEvent) => {
      notifyActiveDragChange(false);
      setActiveSnippet(null);
      setDropIndicatorIndex(null);
    },
    [notifyActiveDragChange]
  );

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
        const gapSlot = parseGapId(overId);
        if (gapSlot !== null) {
          // Gap drop: announce the landing position — the same
          // position identity chip drops use, no new strings.
          const fromIndex = indexOfSortableId(String(active.id));
          return fromIndex >= 0 && gapSlot <= snippetTokens.length
            ? t(SORTING_KEYS.ended, {
                index: computeGapMoveIndex(fromIndex, gapSlot) + 1,
                count: snippetTokens.length,
              })
            : undefined;
        }
        return describePosition(SORTING_KEYS.ended, overId);
      },
      onDragCancel: () => t(SORTING_KEYS.cancelled),
    };
  }, [t, indexOfSortableId, snippetTokens]);

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
    dropIndicatorIndex,
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
