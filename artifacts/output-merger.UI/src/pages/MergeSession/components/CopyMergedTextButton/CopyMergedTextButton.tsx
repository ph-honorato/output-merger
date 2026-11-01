import ContentCopy from "@mui/icons-material/ContentCopy";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import { TooltipWrapper } from "@components";
import { useCopyMergedTextButton } from "./CopyMergedTextButton.hook";
import * as S from "./CopyMergedTextButton.styles";
import type { CopyMergedTextButtonProps } from "./CopyMergedTextButton.types";

function CopyMergedTextButton(props: CopyMergedTextButtonProps) {
  const { className } = props;
  const { t, canCopy, handleCopy, toastOpen, handleToastClose } =
    useCopyMergedTextButton();

  return (
    <>
      <TooltipWrapper title={t("pages.mergeSession.previewArea.copy.button")}>
        <IconButton
          data-testid="preview-copy-button"
          className={className}
          aria-label={t("pages.mergeSession.previewArea.copy.button")}
          disabled={!canCopy}
          onClick={handleCopy}
        >
          <ContentCopy />
        </IconButton>
      </TooltipWrapper>
      <Snackbar
        open={toastOpen}
        autoHideDuration={2500}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <S.ToastMessage data-testid="preview-copy-toast">
          {t("pages.mergeSession.previewArea.copy.toast")}
        </S.ToastMessage>
      </Snackbar>
    </>
  );
}

export default CopyMergedTextButton;
