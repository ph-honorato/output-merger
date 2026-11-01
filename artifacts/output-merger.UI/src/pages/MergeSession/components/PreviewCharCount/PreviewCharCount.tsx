import { usePreviewCharCount } from './PreviewCharCount.hook';
import type { PreviewCharCountProps } from './PreviewCharCount.types';
import * as S from './PreviewCharCount.styles';

/**
 * The preview document's character counter, styled like the text
 * inputs' counter and turning red at the document limit. The
 * default renders `count/limit`; the number-only variant
 * (`hideLimit`) drops the limit suffix. Inside the preview card it
 * sits in an absolutely pinned row at the card's bottom (nothing can
 * push it out of view); in the modal's tools rail it is the last
 * element, centered on the rail's width.
 */
function PreviewCharCount(props: PreviewCharCountProps) {
  const { className, hideLimit = false } = props;
  const { count, max, atLimit, label } = usePreviewCharCount();
  return (
    <S.PreviewCharCount
      data-testid="preview-char-count"
      aria-label={label}
      className={className}
      $atLimit={atLimit}
    >
      {hideLimit ? count : `${count}/${max}`}
    </S.PreviewCharCount>
  );
}

export default PreviewCharCount;
