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
  PreviewModal,
  TextEditingToggle,
  TutorialBanner,
  ReturnButton,
  writeTutorialDismissed,
} from "./components";
import { SnippetsProvider, useSnippets } from "../../context/SnippetsContext";
import { serialize } from '@utils/previewDocument';

/** Stagger delays for entrance animation (ms) */
const ENTRANCE_DELAYS = {
  textInput1: "50ms",
  textInput2: "250ms",
  previewArea: "450ms",
  previewToolbar: "550ms",
} as const;

function MergeSessionWorkspace() {
  const { t } = useTranslation();
  const {
    setSourceSnippets,
    document: previewDocument,
    resetAll,
  } = useSnippets();
  const [mergeStarted, setMergeStarted] = useState(false);
  const [sourceTexts, setSourceTexts] = useState<Record<string, string>>({});
  // Bumped once per confirmed return: the value rides each source's
  // remount key, so every return remounts its TextInput (fresh
  // snippet-free state, text restored through initialText) while the
  // Start Merge mode flip keeps the same key and never remounts.
  const [returnEpoch, setReturnEpoch] = useState(0);

  const handleTextChange = useCallback((sourceId: string, text: string) => {
    setSourceTexts((previous) => ({ ...previous, [sourceId]: text }));
  }, []);

  const canStartMerge = Object.values(sourceTexts).some(
    (text) => text.trim().length > 0,
  );

  // The return's page-owned sequence: capture the raw visible
  // serialization BEFORE the reset (the clear destroys the tokens),
  // then clear-and-reseed the document, flip the mode, and bump the
  // remount epoch — one commit.
  const handleReturnConfirm = useCallback(() => {
    const mergedText = serialize(previewDocument);
    resetAll(mergedText);
    setMergeStarted(false);
    setReturnEpoch((epoch) => epoch + 1);
  }, [previewDocument, resetAll]);

  return (
    <>
      <ActionsBar align="right">
        {mergeStarted ? (
          <ReturnButton onConfirm={handleReturnConfirm} />
        ) : (
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
            key={`text-1:${returnEpoch}`}
            color="#0080FF"
            mode={mergeStarted ? "view" : "input"}
            initialText={sourceTexts["text-1"] ?? ""}
            onTextChange={(text) => handleTextChange("text-1", text)}
            onChange={(snippets) => setSourceSnippets("text-1", snippets)}
            $entranceDelay={returnEpoch === 0 ? ENTRANCE_DELAYS.textInput1 : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextInput
            key={`text-2:${returnEpoch}`}
            color="#FF1493"
            mode={mergeStarted ? "view" : "input"}
            initialText={sourceTexts["text-2"] ?? ""}
            onTextChange={(text) => handleTextChange("text-2", text)}
            onChange={(snippets) => setSourceSnippets("text-2", snippets)}
            $entranceDelay={returnEpoch === 0 ? ENTRANCE_DELAYS.textInput2 : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <S.PreviewColumn>
            <PreviewArea $entranceDelay={returnEpoch === 0 ? ENTRANCE_DELAYS.previewArea : undefined} />
            <PreviewToolbar $entranceDelay={returnEpoch === 0 ? ENTRANCE_DELAYS.previewToolbar : undefined}>
              <CopyMergedTextButton />
              <PreviewModal />
              <TextEditingToggle />
            </PreviewToolbar>
          </S.PreviewColumn>
        </Grid>
      </Grid>
    </>
  );
}

export function MergeSessionPage(_props: MergeSessionPageProps) {
  const { t } = useTranslation();
  const [tutorialVisible, setTutorialVisible] = useState(false);

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
