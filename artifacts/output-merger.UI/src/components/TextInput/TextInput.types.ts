/**
 * A highlighted text snippet created from a drag selection
 * @interface Snippet
 */
export interface Snippet {
  /**
   * Unique identifier generated at creation time
   */
  id: string;
  /**
   * The snippet text as a substring of the source text
   */
  text: string;
  /**
   * Inclusive start char index (word-aligned)
   */
  startIndex: number;
  /**
   * Exclusive end char index (word-aligned)
   */
  endIndex: number;
  /**
   * Highlight color captured at creation time
   */
  color: string;
}

/**
 * Rendering mode of the TextInput component
 */
export type TextInputMode = 'input' | 'view';

import type { EntranceAnimationProps } from "@shared-types/animation";

/**
 * Props for the TextInput component
 * @interface TextInputProps
 */
export interface TextInputProps extends EntranceAnimationProps {
  /**
   * 'input' shows a textarea; 'view' shows plain text with needles. Default 'input'
   */
  mode?: TextInputMode;
  /**
   * Initial text value (uncontrolled after that)
   */
  initialText?: string;
  /**
   * Highlight color used for new snippets. Default '#0080FF'
   */
  color?: string;
  /**
   * Maximum number of characters allowed in input mode. Default 500
   */
  maxCharacters?: number;
  /**
   * Optional heading label rendered above the content
   */
  label?: string;
  /**
   * Optional element id applied to the root element
   */
  id?: string;
  /**
   * Called whenever the text changes (input mode)
   */
  onTextChange?: (text: string) => void;
  /**
   * Called with the full array of snippets whenever snippets change (create/resize/remove)
   */
  onChange?: (snippets: Snippet[]) => void;
}

/**
 * A half-open char range [start, end) within the source text
 * @interface CharRange
 */
export interface CharRange {
  /**
   * Inclusive start char index
   */
  start: number;
  /**
   * Exclusive end char index
   */
  end: number;
}

/**
 * A word-aligned char index used as a snippet or needle boundary: the start
 * or end of a word, or the end of the text
 */
export type Boundary = number;

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
 * Minimal rect shape consumed by boundary and needle positioning logic
 * @interface CharRectLike
 */
export interface CharRectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Resolves the on-screen rect of a char range within the view text
 */
export type CharRectFor = (range: CharRange) => CharRectLike | undefined;

/**
 * The shared context for pointer-driven hit-testing against the tokenized
 * view text: pointer position, tokens, and the char-rect provider
 * @interface PointerHitContext
 */
export interface PointerHitContext {
  /**
   * Pointer viewport x-coordinate
   */
  clientX: number;
  /**
   * Pointer viewport y-coordinate
   */
  clientY: number;
  /**
   * Tokenized view text the pointer is tested against
   */
  tokens: Token[];
  /**
   * Char-rect provider used for hit boxes and needle placement
   */
  rectFor: CharRectFor;
}

/**
 * Needle roles that resize one edge of a committed snippet
 */
export type SnippetNeedleRole = 'snippet-start' | 'snippet-end';

/**
 * A needle handle rendered in view mode
 * @interface NeedleDescriptor
 */
export interface NeedleDescriptor {
  role: 'hover' | 'anchor' | 'current' | SnippetNeedleRole;
  boundary: Boundary;
  snippetId?: string;
  color: string;
  labelKey: string;
}

/**
 * A rendered slice of the view text: plain, or highlighted with a color
 * @interface Segment
 */
export interface Segment extends CharRange {
  color?: string;
  alpha?: number;
}

/**
 * Live drag state: a snippet being created or resized, or null when idle
 */
export type Drag =
  | { type: 'create'; anchor: Boundary; current: Boundary }
  | { type: 'resize'; snippetId: string; edge: 'start' | 'end'; boundary: Boundary }
  | null;
