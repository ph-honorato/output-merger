import { useTranslation } from 'react-i18next';
import { type MergeSessionPageProps } from './MergeSessionPage.types';
import * as S from './MergeSessionPage.styles';

export function MergeSessionPage(_props: MergeSessionPageProps) {
  const { t } = useTranslation();

  return (
    <S.Wrapper data-testid="merge-session-page">
      <S.Title data-testid="merge-session-title">
        {t('mergeSession.title')}
      </S.Title>
      <S.Subtitle data-testid="merge-session-subtitle">
        {t('mergeSession.description')}
      </S.Subtitle>
    </S.Wrapper>
  );
}

export default MergeSessionPage;