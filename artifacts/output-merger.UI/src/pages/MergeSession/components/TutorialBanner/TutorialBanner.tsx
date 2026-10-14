import Close from '@mui/icons-material/Close';
import { useTutorialBanner } from './TutorialBanner.hook';
import { type TutorialBannerProps } from './TutorialBanner.types';
import * as S from './TutorialBanner.styles';

function TutorialBanner(props: TutorialBannerProps) {
  const { onDismiss, className } = props;
  const { t } = useTutorialBanner();

  return (
    <S.TutorialBannerRoot data-testid="merge-session-tutorial" className={className}>
      <S.TutorialHeader>
        <S.TutorialTitle>{t('pages.mergeSession.tutorial.title')}</S.TutorialTitle>
        <S.DismissButton
          data-testid="tutorial-dismiss-button"
          aria-label={t('pages.mergeSession.tutorial.dismiss')}
          onClick={onDismiss}
        >
          <Close />
        </S.DismissButton>
      </S.TutorialHeader>
      <S.TutorialSteps>
        <li>{t('pages.mergeSession.tutorial.step1')}</li>
        <li>{t('pages.mergeSession.tutorial.step2')}</li>
        <li>{t('pages.mergeSession.tutorial.step3')}</li>
        <li>{t('pages.mergeSession.tutorial.step4')}</li>
      </S.TutorialSteps>
    </S.TutorialBannerRoot>
  );
}

export default TutorialBanner;
