import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Boundary,
  type CharRange,
  type CharRectLike,
  type Drag,
  type NeedleDescriptor,
  type Snippet,
  type TextInputProps,
  type Token,
} from './TextInput.types';
import { caretIndexFromPoint, parseBoundary, rectForRange } from './TextInput.geometry';
import {
  buildSnippetNeedle,
  computeSegments,
  generateId,
  NEEDLE_ROLE_TO_EDGE,
  trimRangeStart,
} from './TextInput.snippets';
import { computeNeedlePosition, resolvePointerAt, tokenize } from './TextInput.tokenize';
import { readEnvNumber } from '@utils/env';
import { sanitizePlainText } from '@utils/sanitize';

export type { CharRectLike, NeedleDescriptor, Segment, Token } from './TextInput.types';
export {
  computeNeedlePosition,
  findTokenAt,
  resolvePointerAt,
  tokenize,
} from './TextInput.tokenize';
export { computeSegments, generateId, trimRangeStart } from './TextInput.snippets';

/**
 * The textarea's fixed row baseline. The input area's CSS stretches
 * the textarea to the card's full fixed height (`.MuiInputBase-input
 * { height: 100% }` inside the flex column), so this is only the
 * pre-CSS baseline.
 */
export const TEXTAREA_BASELINE_ROWS = 4;

/**
 * Each text input's default character limit. Reads the
 * `VITE_TEXT_INPUT_MAX_LENGTH` environment variable (a finite
 * integer > 0), falling back to 500.
 */
export const TEXT_INPUT_MAX_CHARACTERS = readEnvNumber(
  'VITE_TEXT_INPUT_MAX_LENGTH',
  500,
);

/**
 * Hook for managing the TextInput component logic
 * @returns {Object} Object containing text state, tokens, needle descriptors and interaction handlers
 */
const MOBILE_LONG_PRESS_MS = 400;
const MOBILE_MOVE_THRESHOLD = 8;

type MobilePendingDrag =
  | { kind: 'create'; anchor: Boundary; boundary: Boundary }
  | { kind: 'resize'; snippetId: string; edge: 'start' | 'end'; boundary: Boundary };

export const useTextInput = (props: TextInputProps & { maxCharacters: number; isMobile?: boolean }) => {
  const {
    mode = 'input',
    initialText = '',
    color = '#0080FF',
    maxCharacters,
    onTextChange,
    onChange,
    isMobile = false,
  } = props;

  const [text, setText] = useState(initialText);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [hoverBoundary, setHoverBoundary] = useState<Boundary | null>(null);
  const [hoverSnippetId, setHoverSnippetId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const pendingMobileDragRef = useRef<MobilePendingDrag | null>(null);
  const mobilePointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const mobileCancelRef = useRef<(() => void) | null>(null);

  const tokens = useMemo(() => tokenize(text), [text]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (mobileCancelRef.current) {
        window.removeEventListener('pointerup', mobileCancelRef.current);
        mobileCancelRef.current = null;
      }
    };
  }, []);

  const cancelMobilePending = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pendingMobileDragRef.current = null;
    mobilePointerStartRef.current = null;
    if (mobileCancelRef.current) {
      window.removeEventListener('pointerup', mobileCancelRef.current);
      mobileCancelRef.current = null;
    }
  }, []);

  const findSnippetAtWord = useCallback(
    (wordStart: number, wordEnd: number): Snippet | undefined =>
      snippets.find((snippet) => wordStart >= snippet.startIndex && wordEnd <= snippet.endIndex),
    [snippets]
  );

  const getRectFor = useCallback(
    (range: CharRange): CharRectLike | undefined => {
      const root = viewRef.current;
      if (!root) return undefined;
      return rectForRange(root, range);
    },
    []
  );

  const resolvePointer = useCallback(
    (e: React.PointerEvent): { token: Token; boundary: Boundary | null } | undefined =>
      resolvePointerAt(caretIndexFromPoint(e.clientX, e.clientY, viewRef.current), {
        clientX: e.clientX,
        clientY: e.clientY,
        tokens,
        rectFor: getRectFor,
      }),
    [tokens, getRectFor]
  );

  const clampResizeBoundary = useCallback(
    (snippet: Snippet, edge: 'start' | 'end', boundary: Boundary): Boundary => {
      if (edge === 'start') {
        let clamped = Math.max(0, Math.min(boundary, snippet.endIndex));
        const prev = snippets
          .filter((s) => s.id !== snippet.id && s.endIndex <= snippet.startIndex)
          .sort((a, b) => b.endIndex - a.endIndex)[0];
        if (prev) {
          clamped = Math.max(clamped, prev.endIndex);
        }
        return clamped;
      }
      let clamped = Math.min(text.length, Math.max(boundary, snippet.startIndex));
      const next = snippets
        .filter((s) => s.id !== snippet.id && s.startIndex >= snippet.endIndex)
        .sort((a, b) => a.startIndex - b.startIndex)[0];
      if (next) {
        clamped = Math.min(clamped, next.startIndex);
      }
      return clamped;
    },
    [snippets, text.length]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (mode !== 'view') return;
      if (isMobile && longPressTimerRef.current !== null && mobilePointerStartRef.current) {
        const dx = e.clientX - mobilePointerStartRef.current.x;
        const dy = e.clientY - mobilePointerStartRef.current.y;
        if (Math.hypot(dx, dy) > MOBILE_MOVE_THRESHOLD) {
          cancelMobilePending();
        }
      }
      if (drag) {
        const boundary = resolvePointer(e)?.boundary ?? null;
        if (boundary === null) return;
        if (drag.type === 'create') {
          let current = boundary;
          if (current > drag.anchor) {
            const blockingStarts = snippets
              .filter((s) => s.startIndex >= drag.anchor)
              .map((s) => s.startIndex);
            if (blockingStarts.length > 0) {
              current = Math.min(current, Math.min(...blockingStarts));
            }
          } else if (current < drag.anchor) {
            const blockingEnds = snippets
              .filter((s) => s.endIndex <= drag.anchor)
              .map((s) => s.endIndex);
            if (blockingEnds.length > 0) {
              current = Math.max(current, Math.max(...blockingEnds));
            }
          }
          setDrag({ ...drag, current });
        } else {
          const snippet = snippets.find((s) => s.id === drag.snippetId);
          if (!snippet) return;
          setDrag({ ...drag, boundary: clampResizeBoundary(snippet, drag.edge, boundary) });
        }
        return;
      }
      if ((e.target as HTMLElement).closest('[data-testid="text-input-needle"]')) {
        return;
      }
      const resolved = resolvePointer(e);
      if (!resolved) {
        setHoverBoundary(null);
        setHoverSnippetId(null);
        return;
      }
      const tokenStart = resolved.token.start;
      const tokenEnd = tokenStart + resolved.token.value.length;
      const snippet = findSnippetAtWord(tokenStart, tokenEnd);
      if (snippet) {
        setHoverSnippetId(snippet.id);
        setHoverBoundary(null);
      } else if (resolved.boundary !== null) {
        setHoverBoundary(resolved.boundary);
        setHoverSnippetId(null);
      } else {
        setHoverBoundary(null);
        setHoverSnippetId(null);
      }
    },
    [mode, drag, snippets, resolvePointer, findSnippetAtWord, clampResizeBoundary, isMobile, cancelMobilePending]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (mode !== 'view') return;
      if (isMobile) {
        cancelMobilePending();
        const target = e.target as HTMLElement;
        const needle = target.closest('[data-testid="text-input-needle"]');
        if (needle) {
          const role = needle.getAttribute('data-role');
          const boundary = parseBoundary(needle.getAttribute('data-boundary'));
          if (role === 'snippet-start' || role === 'snippet-end') {
            setDrag({
              type: 'resize',
              snippetId: needle.getAttribute('data-snippet-id') ?? '',
              edge: NEEDLE_ROLE_TO_EDGE[role],
              boundary,
            });
            return;
          }
        }
        const resolved = resolvePointer(e);
        if (!resolved) return;
        const tokenStart = resolved.token.start;
        const tokenEnd = tokenStart + resolved.token.value.length;
        const snippet = findSnippetAtWord(tokenStart, tokenEnd);
        if (snippet) {
          const isStartEdge = tokenStart === snippet.startIndex;
          const isEndEdge = tokenEnd === snippet.endIndex;
          if (!isStartEdge && !isEndEdge) return;
          const edge = isStartEdge ? 'start' : 'end';
          const boundary = isStartEdge ? snippet.startIndex : snippet.endIndex;
          mobilePointerStartRef.current = { x: e.clientX, y: e.clientY };
          pendingMobileDragRef.current = {
            kind: 'resize',
            snippetId: snippet.id,
            edge,
            boundary,
          };
          const timer = window.setTimeout(() => {
            const pending = pendingMobileDragRef.current;
            if (pending?.kind === 'resize') {
              setDrag({
                type: 'resize',
                snippetId: pending.snippetId,
                edge: pending.edge,
                boundary: pending.boundary,
              });
            }
            pendingMobileDragRef.current = null;
            longPressTimerRef.current = null;
            mobilePointerStartRef.current = null;
            if (mobileCancelRef.current) {
              window.removeEventListener('pointerup', mobileCancelRef.current);
              mobileCancelRef.current = null;
            }
          }, MOBILE_LONG_PRESS_MS);
          longPressTimerRef.current = timer;
          const cancel = () => {
            if (longPressTimerRef.current !== null) {
              window.clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
            pendingMobileDragRef.current = null;
            mobilePointerStartRef.current = null;
            window.removeEventListener('pointerup', cancel);
            mobileCancelRef.current = null;
          };
          mobileCancelRef.current = cancel;
          window.addEventListener('pointerup', cancel);
          return;
        }
        if (resolved.boundary === null) return;
        const wordStart = resolved.token.start;
        const wordEnd = wordStart + resolved.token.value.length;
        mobilePointerStartRef.current = { x: e.clientX, y: e.clientY };
        pendingMobileDragRef.current = {
          kind: 'create',
          anchor: wordStart,
          boundary: wordEnd,
        };
        const createTimer = window.setTimeout(() => {
          const pending = pendingMobileDragRef.current;
          if (pending?.kind === 'create') {
            setDrag({
              type: 'create',
              anchor: pending.anchor,
              current: pending.boundary,
              baseStart: pending.anchor,
              baseEnd: pending.boundary,
            });
          }
          pendingMobileDragRef.current = null;
          longPressTimerRef.current = null;
          mobilePointerStartRef.current = null;
          if (mobileCancelRef.current) {
            window.removeEventListener('pointerup', mobileCancelRef.current);
            mobileCancelRef.current = null;
          }
        }, MOBILE_LONG_PRESS_MS);
        longPressTimerRef.current = createTimer;
        const cancelCreate = () => {
          if (longPressTimerRef.current !== null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          pendingMobileDragRef.current = null;
          mobilePointerStartRef.current = null;
          window.removeEventListener('pointerup', cancelCreate);
          mobileCancelRef.current = null;
        };
        mobileCancelRef.current = cancelCreate;
        window.addEventListener('pointerup', cancelCreate);
        return;
      }

      const target = e.target as HTMLElement;
      const needle = target.closest('[data-testid="text-input-needle"]');
      if (needle) {
        const role = needle.getAttribute('data-role');
        const boundary = parseBoundary(needle.getAttribute('data-boundary'));
        if (role === 'snippet-start' || role === 'snippet-end') {
          setDrag({
            type: 'resize',
            snippetId: needle.getAttribute('data-snippet-id') ?? '',
            edge: NEEDLE_ROLE_TO_EDGE[role],
            boundary,
          });
          return;
        }
        if (role === 'hover') {
          setDrag({ type: 'create', anchor: boundary, current: boundary });
          return;
        }
      }
      const resolved = resolvePointer(e);
      if (!resolved) return;
      const tokenStart = resolved.token.start;
      const tokenEnd = tokenStart + resolved.token.value.length;
      if (findSnippetAtWord(tokenStart, tokenEnd)) return;
      if (resolved.boundary === null) return;
      const boundary = hoverBoundary ?? resolved.boundary;
      setDrag({ type: 'create', anchor: boundary, current: boundary });
    },
    [mode, hoverBoundary, resolvePointer, findSnippetAtWord, isMobile, cancelMobilePending]
  );

  const commit = useCallback(() => {
    if (!drag) return;
    if (drag.type === 'create') {
      const baseStart = drag.baseStart ?? drag.anchor;
      const baseEnd = drag.baseEnd ?? drag.anchor;
      const end = Math.max(baseEnd, drag.current, drag.anchor);
      const start = trimRangeStart(text, Math.min(baseStart, drag.current, drag.anchor), end);
      if (start !== end) {
        const snippet: Snippet = {
          id: generateId(),
          text: text.substring(start, end),
          startIndex: start,
          endIndex: end,
          color,
        };
        const next = [...snippets, snippet];
        setSnippets(next);
        onChange?.(next);
      }
    } else {
      const snippet = snippets.find((s) => s.id === drag.snippetId);
      if (snippet) {
        const clamped = clampResizeBoundary(snippet, drag.edge, drag.boundary);
        const boundary =
          drag.edge === 'start'
            ? trimRangeStart(text, clamped, snippet.endIndex)
            : clamped;
        const isRemoved =
          drag.edge === 'start' ? boundary >= snippet.endIndex : boundary <= snippet.startIndex;
        const next = isRemoved
          ? snippets.filter((s) => s.id !== snippet.id)
          : snippets.map((s) => {
              if (s.id !== snippet.id) return s;
              if (drag.edge === 'start') {
                return { ...s, startIndex: boundary, text: text.substring(boundary, s.endIndex) };
              }
              return { ...s, endIndex: boundary, text: text.substring(s.startIndex, boundary) };
            });
        setSnippets(next);
        onChange?.(next);
      }
    }
    setDrag(null);
  }, [drag, snippets, text, color, onChange, clampResizeBoundary]);

  const isDragging = drag !== null;

  useEffect(() => {
    if (!isDragging) return;
    const handleUp = () => commit();
    window.addEventListener('pointerup', handleUp);
    return () => window.removeEventListener('pointerup', handleUp);
  }, [isDragging, commit]);

  const handleTextChange = useCallback(
    (value: string) => {
      // Sanitize input: strip control chars, null bytes, normalize whitespace
      const sanitized = sanitizePlainText(value);
      const next = sanitized.length > maxCharacters ? sanitized.slice(0, maxCharacters) : sanitized;
      setText(next);
      onTextChange?.(next);
      if (snippets.length > 0) {
        setSnippets([]);
        onChange?.([]);
      }
    },
    [maxCharacters, onTextChange, onChange, snippets.length]
  );

  const positionNeedle = useCallback(
    (boundary: Boundary, origin: { left: number; top: number }): { left: number; top: number } | undefined =>
      computeNeedlePosition(boundary, { tokens, rectFor: getRectFor }, origin),
    [tokens, getRectFor]
  );

  const segments = mode === 'view' ? computeSegments(text, snippets, drag, color) : [];

  const getNeedles = (): NeedleDescriptor[] => {
    if (mode !== 'view') return [];
    if (isMobile) {
      const result: NeedleDescriptor[] = [];
      if (drag) {
        if (drag.type === 'create') {
          // On mobile the live create range is shown as a highlight only;
          // needles (handles) appear after release.
          // (No needle rendering during mobile create drag.)
        } else {
          const snippet = snippets.find((s) => s.id === drag.snippetId);
          if (snippet) {
            result.push(
              buildSnippetNeedle(
                snippet,
                'snippet-start',
                drag.edge === 'start' ? drag.boundary : snippet.startIndex
              ),
              buildSnippetNeedle(
                snippet,
                'snippet-end',
                drag.edge === 'end' ? drag.boundary : snippet.endIndex
              )
            );
          }
        }
      }
      for (const snippet of snippets) {
        if (drag?.type === 'resize' && drag.snippetId === snippet.id) continue;
        result.push(buildSnippetNeedle(snippet, 'snippet-start', snippet.startIndex));
        result.push(buildSnippetNeedle(snippet, 'snippet-end', snippet.endIndex));
      }
      // Hover needles are desktop-only; mobile has no hover affordance.
      return result;
    }
    if (drag) {
      if (drag.type === 'create') {
        return [
          { role: 'anchor', boundary: drag.anchor, color, labelKey: 'textInput.needleHover' },
          { role: 'current', boundary: drag.current, color, labelKey: 'textInput.needleHover' },
        ];
      }
      const snippet = snippets.find((s) => s.id === drag.snippetId);
      if (!snippet) return [];
      return [
        buildSnippetNeedle(
          snippet,
          'snippet-start',
          drag.edge === 'start' ? drag.boundary : snippet.startIndex
        ),
        buildSnippetNeedle(
          snippet,
          'snippet-end',
          drag.edge === 'end' ? drag.boundary : snippet.endIndex
        ),
      ];
    }
    if (hoverSnippetId) {
      const snippet = snippets.find((s) => s.id === hoverSnippetId);
      if (!snippet) return [];
      return [
        buildSnippetNeedle(snippet, 'snippet-start', snippet.startIndex),
        buildSnippetNeedle(snippet, 'snippet-end', snippet.endIndex),
      ];
    }
    if (hoverBoundary !== null) {
      return [{ role: 'hover', boundary: hoverBoundary, color, labelKey: 'textInput.needleHover' }];
    }
    return [];
  };

  return {
    mode,
    text,
    tokens,
    segments,
    needles: getNeedles(),
    isDragging,
    viewRef,
    handleTextChange,
    handlePointerMove,
    handlePointerDown,
    positionNeedle,
  };
};
