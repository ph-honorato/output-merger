import PreviewIcon from '@mui/icons-material/Preview';
import { usePreviewArea, withAlpha } from './PreviewArea.hook';
import type { PreviewAreaProps } from './PreviewArea.types';
import * as S from './PreviewArea.styles';

function PreviewArea(props: PreviewAreaProps) {
  const { className } = props;
  const { t, snippets } = usePreviewArea();

  return (
    <S.PreviewAreaRoot data-testid="preview-area" className={className}>
      {snippets.length === 0 ? (
        <S.EmptyState data-testid="preview-empty">
          <PreviewIcon aria-hidden="true" />
          <span>{t('pages.mergeSession.previewArea.empty')}</span>
        </S.EmptyState>
      ) : (
        <S.SegmentFlow>
          {snippets.map((snippet) => (
            <S.Segment
              key={snippet.id}
              data-testid="preview-snippet"
              style={{ backgroundColor: withAlpha(snippet.color, 0.3) }}
            >
              {snippet.text}
            </S.Segment>
          ))}
        </S.SegmentFlow>
      )}
    </S.PreviewAreaRoot>
  );
}

export default PreviewArea;
