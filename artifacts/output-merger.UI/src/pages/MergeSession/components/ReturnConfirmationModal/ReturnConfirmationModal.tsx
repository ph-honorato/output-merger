import Dialog from "@mui/material/Dialog";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import { useReturnConfirmationModal } from "./ReturnConfirmationModal.hook";
import type { ReturnConfirmationModalProps } from "./ReturnConfirmationModal.types";
import * as S from "./ReturnConfirmationModal.styles";

/**
 * The return confirmation: a fully controlled, presentational MUI
 * Dialog — title, warning message, "Don't show this again" checkbox
 * (unchecked on every open), and Confirm/Cancel buttons. The
 * backdrop click and the Escape key close through the same path as
 * Cancel; Confirm reports the checkbox flag to the parent.
 */
function ReturnConfirmationModal(props: ReturnConfirmationModalProps) {
  const { open } = props;
  const {
    t,
    dontShowAgain,
    handleCheckboxChange,
    handleConfirm,
    handleCancel,
  } = useReturnConfirmationModal(props);

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="xs"
      fullWidth
      data-testid="return-confirmation-dialog"
    >
      <S.Title>{t("pages.mergeSession.returnConfirmation.title")}</S.Title>
      <S.Content>
        <S.Message>
          {t("pages.mergeSession.returnConfirmation.message")}
        </S.Message>
        <FormControlLabel
          control={
            <Checkbox
              checked={dontShowAgain}
              onChange={handleCheckboxChange}
              data-testid="return-confirmation-checkbox"
            />
          }
          label={t("pages.mergeSession.returnConfirmation.dontShowAgain")}
        />
      </S.Content>
      <S.Actions>
        <S.CancelButton
          onClick={handleCancel}
          data-testid="return-confirmation-cancel-button"
        >
          {t("pages.mergeSession.returnConfirmation.cancel")}
        </S.CancelButton>
        <S.ConfirmButton
          variant="contained"
          onClick={handleConfirm}
          data-testid="return-confirmation-confirm-button"
        >
          {t("pages.mergeSession.returnConfirmation.confirm")}
        </S.ConfirmButton>
      </S.Actions>
    </Dialog>
  );
}

export default ReturnConfirmationModal;
