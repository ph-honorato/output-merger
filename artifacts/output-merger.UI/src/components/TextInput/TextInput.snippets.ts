import {
  type Drag,
  type NeedleDescriptor,
  type Segment,
  type Snippet,
  type SnippetNeedleRole,
} from './TextInput.types';

/**
 * Maps each snippet needle role to the snippet edge it controls
 */
export const NEEDLE_ROLE_TO_EDGE: Record<SnippetNeedleRole, 'start' | 'end'> = {
  'snippet-start': 'start',
  'snippet-end': 'end',
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
 * Builds the needle descriptor for one edge of a snippet needle pair
 */
export const buildSnippetNeedle = (
  snippet: Snippet,
  role: SnippetNeedleRole,
  boundary: number
): NeedleDescriptor => ({
  role,
  boundary,
  snippetId: snippet.id,
  color: snippet.color,
  labelKey: NEEDLE_ROLE_TO_EDGE[role] === 'start' ? 'textInput.needleStart' : 'textInput.needleEnd',
});
