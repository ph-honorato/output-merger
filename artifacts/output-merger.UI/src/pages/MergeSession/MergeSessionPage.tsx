import { useTranslation } from "react-i18next";
import { type MergeSessionPageProps } from "./MergeSessionPage.types";
import * as S from "./MergeSessionPage.styles";
import { TextInput } from "@components/TextInput";

export function MergeSessionPage(_props: MergeSessionPageProps) {
  const { t } = useTranslation();

  const LOREM =
    "Lorem ipsum dolor sit amet consectetur adipisicing elit. Architecto iusto natus, beatae velit excepturi eveniet sint voluptate dicta unde, aut molestiae ab rem quo distinctio officiis laudantium ad quam. Enim?";

  return (
    <S.Wrapper data-testid="merge-session-page">
      <S.Title data-testid="merge-session-title">
        {t("mergeSession.title")}
      </S.Title>
      <S.Subtitle data-testid="merge-session-subtitle">
        {t("mergeSession.description")}
      </S.Subtitle>

      <TextInput></TextInput>
      <TextInput
        mode="view"
        initialText={LOREM}
        onChange={(value) => console.log(value)}
      ></TextInput>
    </S.Wrapper>
  );
}

export default MergeSessionPage;
