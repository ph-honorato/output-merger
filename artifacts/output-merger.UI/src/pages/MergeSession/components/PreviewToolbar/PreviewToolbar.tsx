import { usePreviewToolbar } from './PreviewToolbar.hook';
import { type PreviewToolbarProps } from './PreviewToolbar.types';
import * as S from './PreviewToolbar.styles';

function PreviewToolbar(props: PreviewToolbarProps) {
  const { children, className, $entranceDelay } = props;
  usePreviewToolbar();

  return (
    <S.PreviewToolbarRoot data-testid="preview-toolbar" className={className} $entranceDelay={$entranceDelay}>
      {children}
    </S.PreviewToolbarRoot>
  );
}

export default PreviewToolbar;
