import PreviewIcon from '@mui/icons-material/Preview';
import { Fragment } from 'react';
import { usePreviewArea } from './PreviewArea.hook';
import { withAlpha } from '../../../../utils/color';
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
        <S.SegmentFlow data-testid="preview-segment-flow">
          {snippets.map((snippet, index) => (
            <Fragment key={snippet.id}>
              {index > 0 ? ' ' : null}
              <S.Segment
                data-testid="preview-snippet"
                style={{ backgroundColor: withAlpha(snippet.color, 0.3) }}
              >
                {snippet.text}
              </S.Segment>
            </Fragment>
          ))}
        </S.SegmentFlow>
      )}
    </S.PreviewAreaRoot>
  );
}

export default PreviewArea;
