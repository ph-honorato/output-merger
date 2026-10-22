export interface PreviewCharCountProps {
  /** An optional className to position the counter (e.g. inside the modal's tools rail). */
  className?: string;
  /**
   * When true the counter renders the current count only (`1234`);
   * the default renders `count/limit` (`1234/2000`). The preview
   * modal's rail uses the number-only variant.
   */
  hideLimit?: boolean;
}
