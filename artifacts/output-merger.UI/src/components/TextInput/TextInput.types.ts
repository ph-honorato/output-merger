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

/**
 * Props for the TextInput component
 * @interface TextInputProps
 */
export interface TextInputProps {
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
