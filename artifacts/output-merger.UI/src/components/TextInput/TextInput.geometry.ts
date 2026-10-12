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
  start: number,
  end: number
): { node: Text; offset: number } | null => {
  const spans = root.querySelectorAll<HTMLElement>('[data-segment-start]');
  for (const span of Array.from(spans)) {
    const segmentStart = Number(span.getAttribute('data-segment-start'));
    const segmentLength = span.textContent?.length ?? 0;
    if (start >= segmentStart && end <= segmentStart + segmentLength) {
      const node = span.firstChild;
      if (node && node.nodeType === Node.TEXT_NODE) {
        return { node: node as Text, offset: start - segmentStart };
      }
    }
  }
  return null;
};

/**
 * Returns the viewport rect of the char range [start, end) within the root's segment text
 */
export const rectForRange = (
  root: HTMLElement,
  start: number,
  end: number
): CharRect | undefined => {
  if (end <= start) return undefined;
  const segment = findSegmentText(root, start, end);
  if (!segment) return undefined;
  const range = document.createRange();
  range.setStart(segment.node, segment.offset);
  range.setEnd(segment.node, segment.offset + (end - start));
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return undefined;
  return rect;
};
