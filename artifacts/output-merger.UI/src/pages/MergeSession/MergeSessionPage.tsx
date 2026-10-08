import { useTranslation } from "react-i18next";
import Grid from "@mui/material/Grid";
import { type MergeSessionPageProps } from "./MergeSessionPage.types";
import * as S from "./MergeSessionPage.styles";
import { TextInput } from "@components/TextInput";
import { ActionsBar } from "@components/ActionsBar";
import { PreviewArea } from "@components/PreviewArea";
import { SnippetsProvider, useSnippets } from "../../context/SnippetsContext";

function MergeSessionWorkspace() {
  const { t } = useTranslation();
  const { setSourceSnippets } = useSnippets();

  return (
    <>
      <ActionsBar align="right">
        <S.StartMergeButton
          variant="contained"
          disabled
          data-testid="merge-session-start-button"
        >
          {t("pages.mergeSession.startMerge")}
        </S.StartMergeButton>
      </ActionsBar>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextInput
            color="#0080FF"
            onChange={(snippets) => setSourceSnippets("text-1", snippets)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextInput
            color="#FF1493"
            onChange={(snippets) => setSourceSnippets("text-2", snippets)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <PreviewArea />
        </Grid>
      </Grid>
    </>
  );
}

export function MergeSessionPage(_props: MergeSessionPageProps) {
  const { t } = useTranslation();

  return (
    <S.Wrapper data-testid="merge-session-page">
      <S.Title data-testid="merge-session-title">
        {t("pages.mergeSession.title")}
      </S.Title>
      <S.Subtitle data-testid="merge-session-subtitle">
        {t("pages.mergeSession.description")}
      </S.Subtitle>

      <SnippetsProvider>
        <MergeSessionWorkspace />
      </SnippetsProvider>
    </S.Wrapper>
  );
}

export default MergeSessionPage;
