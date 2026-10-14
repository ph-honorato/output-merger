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

export type { CharRectLike, NeedleDescriptor, Segment, Token } from './TextInput.types';
export {
  computeNeedlePosition,
  findTokenAt,
  resolvePointerAt,
  tokenize,
} from './TextInput.tokenize';
export { computeSegments, generateId, trimRangeStart } from './TextInput.snippets';

const MIN_TEXTAREA_ROWS = 4;

/**
 * Computes how many textarea rows fit the remaining vertical space of the root card,
 * so the textarea always shows the maximum number of rows for its height
 */
export const useAutoTextareaRows = (
  rootRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean
) => {
  const [rows, setRows] = useState(MIN_TEXTAREA_ROWS);

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    const compute = () => {
      const textarea = root.querySelector('textarea');
      if (!textarea) return;
      const taStyles = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(taStyles.lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
      const taExtraY =
        parseFloat(taStyles.paddingTop) +
        parseFloat(taStyles.paddingBottom) +
        parseFloat(taStyles.borderTopWidth) +
        parseFloat(taStyles.borderBottomWidth);

      const rootStyles = window.getComputedStyle(root);
      const rootPaddingY =
        parseFloat(rootStyles.paddingTop) + parseFloat(rootStyles.paddingBottom);
      const rowGap = parseFloat(rootStyles.rowGap) || 0;
      const minHeight = parseFloat(rootStyles.minHeight);
      const baseHeight =
        Number.isFinite(minHeight) && minHeight > 0 ? minHeight : root.clientHeight;

      const children = Array.from(root.children) as HTMLElement[];
      const otherHeight = children.reduce((total, child) => {
        if (child.contains(textarea)) return total;
        const childStyles = window.getComputedStyle(child);
        return (
          total +
          child.offsetHeight +
          parseFloat(childStyles.marginTop) +
          parseFloat(childStyles.marginBottom)
        );
      }, 0);
      const gaps = rowGap * Math.max(children.length - 1, 0);

      const available = baseHeight - rootPaddingY - otherHeight - gaps - taExtraY;
      const usableRows = Math.floor(available / lineHeight);
      if (!Number.isFinite(usableRows)) return;
      setRows(Math.max(MIN_TEXTAREA_ROWS, usableRows));
    };

    compute();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(compute);
    observer.observe(root);
    return () => observer.disconnect();
  }, [rootRef, enabled]);

  return rows;
};

/**
 * Hook for managing the TextInput component logic
 * @returns {Object} Object containing text state, tokens, needle descriptors and interaction handlers
 */
export const useTextInput = (props: TextInputProps) => {
  const {
    mode = 'input',
    initialText = '',
    color = '#0080FF',
    maxCharacters = 500,
    onTextChange,
    onChange,
  } = props;

  const [text, setText] = useState(initialText);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [hoverBoundary, setHoverBoundary] = useState<Boundary | null>(null);
  const [hoverSnippetId, setHoverSnippetId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);

  const tokens = useMemo(() => tokenize(text), [text]);

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
    [mode, drag, snippets, resolvePointer, findSnippetAtWord, clampResizeBoundary]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (mode !== 'view') return;
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
    [mode, hoverBoundary, resolvePointer, findSnippetAtWord]
  );

  const commit = useCallback(() => {
    if (!drag) return;
    if (drag.type === 'create') {
      const end = Math.max(drag.anchor, drag.current);
      const start = trimRangeStart(text, Math.min(drag.anchor, drag.current), end);
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
      const next = value.length > maxCharacters ? value.slice(0, maxCharacters) : value;
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
