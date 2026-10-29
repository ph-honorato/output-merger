import OpenInFull from "@mui/icons-material/OpenInFull";
import CloseFullscreen from "@mui/icons-material/CloseFullscreen";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import { TooltipWrapper } from "@components/TooltipWrapper";
import { CopyMergedTextButton, PreviewArea, PreviewCharCount, TextEditingToggle } from "../";
import { usePreviewModal } from "./PreviewModal.hook";
import type { PreviewModalProps } from "./PreviewModal.types";
import * as S from "./PreviewModal.styles";

/**
 * Self-contained bigger view of the same preview: renders the toolbar trigger (icon-only, hidden below md,
 * disabled while the preview is empty) and, when open, an MUI Dialog
 * that renders the SAME unmodified PreviewArea from SnippetsContext
 * (zero duplicated snippet state) plus the existing
 * CopyMergedTextButton, a close button, and the edit-text toggle in a
 * bare right-side tools rail (rail order copy → close → toggle, the
 * document char counter last). The modal suppresses the card's own
 * counter row and renders it as the rail's last element instead.
 * No visible title: a visually hidden DialogTitle names the
 * dialog for assistive tech.
 */
function PreviewModal(props: PreviewModalProps) {
  const { className } = props;
  const {
    t,
    isBelowMd,
    canOpen,
    open,
    handleOpen,
    handleClose,
    handleDialogClose,
    handleActiveDragChange,
    openTooltip,
  } = usePreviewModal();

  return (
    <>
      {isBelowMd ? null : (
        <TooltipWrapper title={openTooltip}>
          <IconButton
            className={className}
            data-testid="preview-modal-open-button"
            aria-label={openTooltip}
            disabled={!canOpen}
            onClick={handleOpen}
          >
            <OpenInFull />
          </IconButton>
        </TooltipWrapper>
      )}
      <Dialog
        open={open}
        onClose={handleDialogClose}
        maxWidth="md"
        fullWidth
        fullScreen={isBelowMd}
      >
        <S.VisuallyHiddenTitle>
          {t("pages.mergeSession.previewArea.modal.name")}
        </S.VisuallyHiddenTitle>
        <S.ModalLayout $fullScreen={isBelowMd}>
          <S.PreviewZone>
            <S.ModalPreviewArea
              as={PreviewArea}
              onActiveDragChange={handleActiveDragChange}
              showCharCount={false}
            />
          </S.PreviewZone>
          <S.ToolsRail>
            <CopyMergedTextButton />
            <IconButton
              data-testid="preview-modal-close-button"
              aria-label={t("pages.mergeSession.previewArea.modal.close")}
              onClick={handleClose}
            >
              <CloseFullscreen />
            </IconButton>
            <TextEditingToggle />
            <PreviewCharCount hideLimit />
          </S.ToolsRail>
        </S.ModalLayout>
      </Dialog>
    </>
  );
}

export default PreviewModal;
