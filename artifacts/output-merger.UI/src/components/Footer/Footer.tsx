import { useTranslation } from "react-i18next";
import { GitHub } from "@mui/icons-material";
import { type FooterProps } from "./Footer.types";
import * as S from "./Footer.styles";

const GITHUB_URL = "https://github.com/ph-honorato";
const ISSUES_URL = "https://github.com/ph-honorato/output-merger/issues";

function Footer(props: FooterProps) {
  const { className } = props;
  const { t } = useTranslation();

  return (
    <S.StyledFooter className={className} data-testid="footer">
      <S.FooterContent>
        <S.GitHubLink
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("footer.github")}
          data-testid="footer-github-link"
        >
          <GitHub fontSize="small" />
          <S.GitHubLabel>ph-honorato</S.GitHubLabel>
        </S.GitHubLink>
        <S.Separator aria-hidden="true">•</S.Separator>
        <S.IssueText>
          {t("footer.issuePrompt")}{" "}
          <S.IssueLink
            href={ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="footer-issue-link"
          >
            {t("footer.reportHere")}
          </S.IssueLink>
          .
        </S.IssueText>
      </S.FooterContent>
    </S.StyledFooter>
  );
}

export default Footer;
