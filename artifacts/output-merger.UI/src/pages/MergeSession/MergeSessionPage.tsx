import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import Grid from "@mui/material/Grid";
import HelpOutlined from "@mui/icons-material/HelpOutlined";
import { type MergeSessionPageProps } from "./MergeSessionPage.types";
import * as S from "./MergeSessionPage.styles";
import { TextInput, ActionsBar } from "@components";
import {
  PreviewArea,
  PreviewToolbar,
  CopyMergedTextButton,
  TutorialBanner,
  readTutorialDismissed,
  writeTutorialDismissed,
} from "./components";
import { SnippetsProvider, useSnippets } from "../../context/SnippetsContext";

function MergeSessionWorkspace() {
  const { t } = useTranslation();
  const { setSourceSnippets } = useSnippets();
  const [mergeStarted, setMergeStarted] = useState(false);
  const [sourceTexts, setSourceTexts] = useState<Record<string, string>>({});

  const handleTextChange = useCallback((sourceId: string, text: string) => {
    setSourceTexts((previous) => ({ ...previous, [sourceId]: text }));
  }, []);

  const canStartMerge = Object.values(sourceTexts).some(
    (text) => text.trim().length > 0,
  );

  return (
    <>
      <ActionsBar align="right">
        {mergeStarted ? null : (
          <S.StartMergeButton
            variant="contained"
            disabled={!canStartMerge}
            onClick={() => setMergeStarted(true)}
            data-testid="merge-session-start-button"
          >
            {t("pages.mergeSession.startMerge")}
          </S.StartMergeButton>
        )}
      </ActionsBar>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextInput
            color="#0080FF"
            mode={mergeStarted ? "view" : "input"}
            onTextChange={(text) => handleTextChange("text-1", text)}
            onChange={(snippets) => setSourceSnippets("text-1", snippets)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextInput
            color="#FF1493"
            mode={mergeStarted ? "view" : "input"}
            onTextChange={(text) => handleTextChange("text-2", text)}
            onChange={(snippets) => setSourceSnippets("text-2", snippets)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <S.PreviewColumn>
            <PreviewArea />
            <PreviewToolbar>
              <CopyMergedTextButton />
            </PreviewToolbar>
          </S.PreviewColumn>
        </Grid>
      </Grid>
    </>
  );
}

export function MergeSessionPage(_props: MergeSessionPageProps) {
  const { t } = useTranslation();
  const [tutorialVisible, setTutorialVisible] = useState(
    () => !readTutorialDismissed(),
  );

  const handleTutorialDismiss = useCallback(() => {
    writeTutorialDismissed();
    setTutorialVisible(false);
  }, []);

  const handleTutorialHelp = useCallback(() => {
    setTutorialVisible(true);
  }, []);

  return (
    <S.Wrapper data-testid="merge-session-page">
      <S.TitleRow>
        <S.Title data-testid="merge-session-title">
          {t("pages.mergeSession.title")}
        </S.Title>
        {tutorialVisible ? null : (
          <S.HelpButton
            data-testid="merge-session-help-button"
            aria-label={t("pages.mergeSession.tutorial.help")}
            onClick={handleTutorialHelp}
          >
            <HelpOutlined />
          </S.HelpButton>
        )}
      </S.TitleRow>
      {tutorialVisible ? (
        <TutorialBanner onDismiss={handleTutorialDismiss} />
      ) : null}

      <SnippetsProvider>
        <MergeSessionWorkspace />
      </SnippetsProvider>
    </S.Wrapper>
  );
}

export default MergeSessionPage;
