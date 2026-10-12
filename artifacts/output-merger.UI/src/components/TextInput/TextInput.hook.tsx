import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Snippet, type TextInputProps } from './TextInput.types';
import { caretIndexFromPoint, rectForRange } from './TextInput.geometry';

/**
 * A single token produced by tokenize: a word or a whitespace run
 * @interface Token
 */
export interface Token {
  /**
   * The raw token text
   */
  value: string;
  /**
   * Char offset of the token start within the source text
   */
  start: number;
  /**
   * True when the token contains non-whitespace characters
   */
  isWord: boolean;
}

/**
 * A needle handle rendered in view mode
 * @interface NeedleDescriptor
 */
export interface NeedleDescriptor {
  role: 'hover' | 'anchor' | 'current' | 'snippet-start' | 'snippet-end';
  boundary: number;
  snippetId?: string;
  color: string;
  labelKey: string;
}

/**
 * A rendered slice of the view text: plain, or highlighted with a color
 * @interface Segment
 */
export interface Segment {
  start: number;
  end: number;
  color?: string;
  alpha?: number;
}

/**
 * Minimal rect shape consumed by boundary and needle positioning logic
 * @interface CharRectLike
 */
export interface CharRectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

type Drag =
  | { type: 'create'; anchor: number; current: number }
  | { type: 'resize'; snippetId: string; edge: 'start' | 'end'; boundary: number }
  | null;

/**
 * Splits text into alternating word and whitespace tokens, each with its char start offset
 */
export const tokenize = (text: string): Token[] => {
  const parts = text.split(/(\s+)/).filter((part) => part.length > 0);
  let offset = 0;
  return parts.map((value) => {
    const token: Token = { value, start: offset, isWord: /\S/.test(value) };
    offset += value.length;
    return token;
  });
};

/**
 * Converts a #RGB or #RRGGBB hex color to an rgba() string with the given alpha
 */
export const withAlpha = (hex: string, alpha: number): string => {
  let value = hex.replace('#', '');
  if (value.length === 3) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('');
  }
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Generates a unique snippet id
 */
export const generateId = (): string =>
  `snippet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Advances a range start past any leading whitespace so snippets never begin with a space
 */
export const trimRangeStart = (text: string, start: number, end: number): number => {
  let trimmed = start;
  while (trimmed < end && /\s/.test(text[trimmed])) {
    trimmed += 1;
  }
  return trimmed;
};

/**
 * Merges committed snippets and the live drag range into an ordered list of
 * disjoint text segments, alternating plain and highlighted slices
 */
export const computeSegments = (
  text: string,
  snippets: Snippet[],
  drag: Drag,
  color: string
): Segment[] => {
  const ranges: Segment[] = [];
  if (drag?.type === 'create') {
    const end = Math.max(drag.anchor, drag.current);
    const start = trimRangeStart(text, Math.min(drag.anchor, drag.current), end);
    if (start !== end) {
      ranges.push({ start, end, color, alpha: 0.2 });
    }
  }
  for (const snippet of snippets) {
    if (drag?.type === 'resize' && drag.snippetId === snippet.id) {
      const start =
        drag.edge === 'start'
          ? trimRangeStart(text, drag.boundary, snippet.endIndex)
          : snippet.startIndex;
      const end = drag.edge === 'end' ? drag.boundary : snippet.endIndex;
      if (start < end) {
        ranges.push({ start, end, color: snippet.color, alpha: 0.3 });
      }
      continue;
    }
    if (snippet.startIndex < snippet.endIndex) {
      ranges.push({
        start: snippet.startIndex,
        end: snippet.endIndex,
        color: snippet.color,
        alpha: 0.3,
      });
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ start: cursor, end: range.start });
    }
    if (range.end > range.start) {
      segments.push(range);
    }
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < text.length) {
    segments.push({ start: cursor, end: text.length });
  }
  return segments;
};

/**
 * Finds the word token containing the given char index
 */
export const findWordTokenAt = (index: number, tokens: Token[]): Token | undefined =>
  tokens.find(
    (token) => token.isWord && index >= token.start && index < token.start + token.value.length
  );

/**
 * Resolves the word boundary at a pointer position from a caret char index.
 * The pointer must sit inside the word's line box (as with per-word span
 * hit-testing) and the half-word rule decides between start and end boundary.
 */
export const resolveBoundaryAt = (
  caretIndex: number | null,
  clientX: number,
  clientY: number,
  tokens: Token[],
  rectFor: (start: number, end: number) => CharRectLike | undefined
): { token: Token; boundary: number } | undefined => {
  if (caretIndex === null) return undefined;
  const token = findWordTokenAt(caretIndex, tokens);
  if (!token) return undefined;
  const wordEnd = token.start + token.value.length;
  const rect = rectFor(token.start, wordEnd);
  if (!rect) return undefined;
  const insideBox =
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom;
  if (!insideBox) return undefined;
  const isLeftHalf = clientX < rect.left + (rect.right - rect.left) / 2;
  return { token, boundary: isLeftHalf ? token.start : wordEnd };
};

/**
 * Computes the position of a needle for a char-index boundary, relative to the
 * given origin rect. Word-start boundaries sit at the left edge of the word's
 * first char; word-end boundaries sit at the right edge of the preceding char.
 */
export const computeNeedlePosition = (
  boundary: number,
  tokens: Token[],
  rectFor: (start: number, end: number) => CharRectLike | undefined,
  origin: { left: number; top: number }
): { left: number; top: number } | undefined => {
  const isWordStart = tokens.some((token) => token.isWord && token.start === boundary);
  const rangeStart = isWordStart ? boundary : boundary - 1;
  if (rangeStart < 0) return undefined;
  const rect = rectFor(rangeStart, rangeStart + 1);
  if (!rect) return undefined;
  return {
    left: (isWordStart ? rect.left : rect.right) - origin.left,
    top: rect.top - origin.top,
  };
};

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
  const [hoverBoundary, setHoverBoundary] = useState<number | null>(null);
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
    (start: number, end: number): CharRectLike | undefined => {
      const root = viewRef.current;
      if (!root) return undefined;
      return rectForRange(root, start, end);
    },
    []
  );

  const resolveEventWord = useCallback(
    (e: React.PointerEvent): { token: Token; boundary: number } | undefined =>
      resolveBoundaryAt(
        caretIndexFromPoint(e.clientX, e.clientY, viewRef.current),
        e.clientX,
        e.clientY,
        tokens,
        getRectFor
      ),
    [tokens, getRectFor]
  );

  const clampResizeBoundary = useCallback(
    (snippet: Snippet, edge: 'start' | 'end', boundary: number): number => {
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
        const boundary = resolveEventWord(e)?.boundary ?? null;
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
      const resolved = resolveEventWord(e);
      if (!resolved) {
        setHoverBoundary(null);
        setHoverSnippetId(null);
        return;
      }
      const wordStart = resolved.token.start;
      const wordEnd = wordStart + resolved.token.value.length;
      if (findSnippetAtWord(wordStart, wordEnd)) {
        setHoverSnippetId(findSnippetAtWord(wordStart, wordEnd)!.id);
        setHoverBoundary(null);
      } else {
        setHoverBoundary(resolved.boundary);
        setHoverSnippetId(null);
      }
    },
    [mode, drag, snippets, resolveEventWord, findSnippetAtWord, clampResizeBoundary]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (mode !== 'view') return;
      const target = e.target as HTMLElement;
      const needle = target.closest('[data-testid="text-input-needle"]');
      if (needle) {
        const role = needle.getAttribute('data-role');
        const boundary = Number(needle.getAttribute('data-boundary'));
        if (role === 'snippet-start' || role === 'snippet-end') {
          setDrag({
            type: 'resize',
            snippetId: needle.getAttribute('data-snippet-id') ?? '',
            edge: role === 'snippet-start' ? 'start' : 'end',
            boundary,
          });
          return;
        }
        if (role === 'hover') {
          setDrag({ type: 'create', anchor: boundary, current: boundary });
          return;
        }
      }
      const resolved = resolveEventWord(e);
      if (!resolved) return;
      const wordStart = resolved.token.start;
      const wordEnd = wordStart + resolved.token.value.length;
      if (findSnippetAtWord(wordStart, wordEnd)) return;
      const boundary = hoverBoundary ?? resolved.boundary;
      setDrag({ type: 'create', anchor: boundary, current: boundary });
    },
    [mode, hoverBoundary, resolveEventWord, findSnippetAtWord]
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
    (boundary: number, origin: { left: number; top: number }): { left: number; top: number } | undefined =>
      computeNeedlePosition(boundary, tokens, getRectFor, origin),
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
        {
          role: 'snippet-start',
          boundary: drag.edge === 'start' ? drag.boundary : snippet.startIndex,
          snippetId: snippet.id,
          color: snippet.color,
          labelKey: 'textInput.needleStart',
        },
        {
          role: 'snippet-end',
          boundary: drag.edge === 'end' ? drag.boundary : snippet.endIndex,
          snippetId: snippet.id,
          color: snippet.color,
          labelKey: 'textInput.needleEnd',
        },
      ];
    }
    if (hoverSnippetId) {
      const snippet = snippets.find((s) => s.id === hoverSnippetId);
      if (!snippet) return [];
      return [
        {
          role: 'snippet-start',
          boundary: snippet.startIndex,
          snippetId: snippet.id,
          color: snippet.color,
          labelKey: 'textInput.needleStart',
        },
        {
          role: 'snippet-end',
          boundary: snippet.endIndex,
          snippetId: snippet.id,
          color: snippet.color,
          labelKey: 'textInput.needleEnd',
        },
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
