import { useTranslation } from "react-i18next";
import Grid from "@mui/material/Grid";
import { type MergeSessionPageProps } from "./MergeSessionPage.types";
import * as S from "./MergeSessionPage.styles";
import { TextInput } from "@components/TextInput";
import { ActionsBar } from "@components/ActionsBar";
import { PreviewArea } from "@components/PreviewArea";

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
          <TextInput color="#0080FF" />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextInput color="#FF1493" />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <PreviewArea />
        </Grid>
      </Grid>
    </S.Wrapper>
  );
}

export default MergeSessionPage;
