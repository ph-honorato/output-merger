import { type Boundary, type PointerHitContext, type Token } from './TextInput.types';
import { resolveHitSide } from './TextInput.geometry';

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
 * Finds the token (word or whitespace run) containing the given char index
 */
export const findTokenAt = (index: number, tokens: Token[]): Token | undefined =>
  tokens.find(
    (token) => index >= token.start && index < token.start + token.value.length
  );

/**
 * Resolves the token and word boundary at a pointer position from a caret char
 * index. The pointer must sit inside the token's line box (as with per-word
 * span hit-testing) and the half-word rule decides between start and end
 * boundary.
 *
 * Browsers resolve the caret to the char boundary closest to the pointer, so a
 * pointer in the right half of a word's last char yields the caret position
 * *after* the word (the following whitespace start, or text end). Such
 * pointers are attributed back to the preceding word whenever they lie inside
 * its rect, keeping word-end boundaries reachable.
 *
 * Whitespace tokens resolve without a boundary so callers can keep snippet
 * hover state alive over the spaces and line breaks inside a snippet. Their
 * clamp is vertical-only: line-break rects are zero-width (the caret already
 * proves the pointer sits in that line's flow), so a horizontal test could
 * never pass, while the vertical test still rejects pointers in the leading
 * between lines.
 */
export const resolvePointerAt = (
  caretIndex: number | null,
  hit: PointerHitContext
): { token: Token; boundary: Boundary | null } | undefined => {
  const { clientX, clientY, tokens, rectFor } = hit;
  if (caretIndex === null) return undefined;
  let token = findTokenAt(caretIndex, tokens);
  if (!token) {
    token = tokens.find((candidate) => candidate.start + candidate.value.length === caretIndex);
    if (!token) return undefined;
  }
  const tokenEnd = token.start + token.value.length;
  if (!token.isWord) {
    const preceding = tokens.find(
      (candidate) => candidate.start + candidate.value.length === token!.start
    );
    if (preceding?.isWord) {
      const wordBoundary = resolveWordPointer(preceding, hit);
      if (wordBoundary !== undefined) {
        return { token: preceding, boundary: wordBoundary };
      }
    }
    const rect = rectFor({ start: token.start, end: tokenEnd });
    if (!rect) return undefined;
    const insideLine = clientY >= rect.top && clientY <= rect.bottom;
    if (!insideLine) return undefined;
    return { token, boundary: null };
  }
  const rect = rectFor({ start: token.start, end: tokenEnd });
  if (!rect) return undefined;
  const hitSide = resolveHitSide(clientX, clientY, rect);
  if (!hitSide) return undefined;
  return { token, boundary: hitSide === 'left' ? token.start : tokenEnd };
};

const resolveWordPointer = (word: Token, hit: PointerHitContext): Boundary | undefined => {
  const { clientX, clientY, rectFor } = hit;
  const rect = rectFor({ start: word.start, end: word.start + word.value.length });
  if (!rect) return undefined;
  const hitSide = resolveHitSide(clientX, clientY, rect);
  if (!hitSide) return undefined;
  return hitSide === 'left' ? word.start : word.start + word.value.length;
};

/**
 * Computes the position of a needle for a char-index boundary, relative to the
 * given origin rect. Word-start boundaries sit at the left edge of the word's
 * first char; word-end boundaries sit at the right edge of the preceding char.
 */
export const computeNeedlePosition = (
  boundary: Boundary,
  hit: Pick<PointerHitContext, 'tokens' | 'rectFor'>,
  origin: { left: number; top: number }
): { left: number; top: number } | undefined => {
  const { tokens, rectFor } = hit;
  const isWordStart = tokens.some((token) => token.isWord && token.start === boundary);
  const rangeStart = isWordStart ? boundary : boundary - 1;
  if (rangeStart < 0) return undefined;
  const rect = rectFor({ start: rangeStart, end: rangeStart + 1 });
  if (!rect) return undefined;
  return {
    left: (isWordStart ? rect.left : rect.right) - origin.left,
    top: rect.top - origin.top,
  };
};
