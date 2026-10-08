import { usePreviewArea } from './PreviewArea.hook';
import { type PreviewAreaProps } from './PreviewArea.types';
import * as S from './PreviewArea.styles';

function PreviewArea(props: PreviewAreaProps) {
  const { className } = props;
  usePreviewArea();

  return <S.PreviewAreaRoot data-testid="preview-area" aria-hidden="true" className={className} />;
}

export default PreviewArea;
