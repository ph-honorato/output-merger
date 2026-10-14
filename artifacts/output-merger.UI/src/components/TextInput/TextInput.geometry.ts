import { type Boundary, type CharRange } from './TextInput.types';

/**
 * Minimal rect shape produced by caret and character-range geometry
 * @interface CharRect
 */
export interface CharRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface CaretPositionLike {
  offsetNode: Node;
  offset: number;
}

type CaretDocument = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
  caretPositionFromPoint?: (x: number, y: number) => CaretPositionLike | null;
};

const globalIndexFromNode = (node: Node, offset: number, root: HTMLElement | null): number | null => {
  if (node.nodeType !== Node.TEXT_NODE) return null;
  if (!root || !root.contains(node)) return null;
  const segmentStart = Number(node.parentElement?.getAttribute('data-segment-start'));
  if (!Number.isInteger(segmentStart)) return null;
  return segmentStart + offset;
};

/**
 * Resolves the global char index of the text caret at the given viewport point,
 * or null when the point resolves outside the root's segment text
 */
export const caretIndexFromPoint = (
  x: number,
  y: number,
  root: HTMLElement | null
): number | null => {
  const doc = document as CaretDocument;
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y);
    return range ? globalIndexFromNode(range.startContainer, range.startOffset, root) : null;
  }
  if (typeof doc.caretPositionFromPoint === 'function') {
    const position = doc.caretPositionFromPoint(x, y);
    return position ? globalIndexFromNode(position.offsetNode, position.offset, root) : null;
  }
  return null;
};

const findSegmentText = (
  root: HTMLElement,
  range: CharRange
): { node: Text; offset: number } | null => {
  const spans = root.querySelectorAll<HTMLElement>('[data-segment-start]');
  for (const span of Array.from(spans)) {
    const segmentStart = Number(span.getAttribute('data-segment-start'));
    const segmentLength = span.textContent?.length ?? 0;
    if (range.start >= segmentStart && range.end <= segmentStart + segmentLength) {
      const node = span.firstChild;
      if (node && node.nodeType === Node.TEXT_NODE) {
        return { node: node as Text, offset: range.start - segmentStart };
      }
    }
  }
  return null;
};

/**
 * Returns the viewport rect of the given char range within the root's segment text
 */
export const rectForRange = (root: HTMLElement, range: CharRange): CharRect | undefined => {
  if (range.end <= range.start) return undefined;
  const segment = findSegmentText(root, range);
  if (!segment) return undefined;
  const domRange = document.createRange();
  domRange.setStart(segment.node, segment.offset);
  domRange.setEnd(segment.node, segment.offset + (range.end - range.start));
  const rect = domRange.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return undefined;
  return rect;
};

/**
 * Resolves which half of a rect a pointer lies in: 'left' for the left half,
 * 'right' for the right half, or undefined when the pointer is outside the
 * rect (inclusive on all edges)
 */
export const resolveHitSide = (
  clientX: number,
  clientY: number,
  rect: Pick<CharRect, 'left' | 'top' | 'right' | 'bottom'>
): 'left' | 'right' | undefined => {
  const insideBox =
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom;
  if (!insideBox) return undefined;
  return clientX < rect.left + (rect.right - rect.left) / 2 ? 'left' : 'right';
};

/**
 * Parses a needle's data-boundary attribute back into a boundary char index.
 * Number() semantics are preserved exactly at every call site: a missing
 * attribute yields NaN via dataset.boundary (undefined) and 0 via
 * getAttribute (null), and any other non-numeric string yields NaN.
 */
export const parseBoundary = (attr: string | null | undefined): Boundary => Number(attr);

/**
 * Serializes a boundary char index for the data-boundary attribute
 */
export const serializeBoundary = (boundary: Boundary): string => String(boundary);
