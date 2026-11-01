import KeyboardReturn from "@mui/icons-material/KeyboardReturn";
import { ReturnConfirmationModal } from "../";
import { useReturnButton } from "./ReturnButton.hook";
import type { ReturnButtonProps } from "./ReturnButton.types";
import * as S from "./ReturnButton.styles";

/**
 * The merge-mode way back: renders the contained Return button (the
 * Start Merge visual with a KeyboardReturn icon before the label)
 * and owns its confirmation dialog. A click with no stored "don't
 * show again" preference opens the dialog — the button disables
 * while the dialog is open; a stored preference proceeds
 * immediately. Confirming (or skipping) hands the reset to the
 * caller's onConfirm.
 */
function ReturnButton(props: ReturnButtonProps) {
  const { onConfirm } = props;
  const {
    t,
    open,
    disabled,
    handleReturnClick,
    handleConfirm,
    handleCancel,
  } = useReturnButton({ onConfirm });

  return (
    <>
      <S.ReturnButtonRoot
        variant="contained"
        startIcon={<KeyboardReturn />}
        disabled={disabled}
        onClick={handleReturnClick}
        data-testid="merge-session-return-button"
      >
        {t("pages.mergeSession.return")}
      </S.ReturnButtonRoot>
      <ReturnConfirmationModal
        open={open}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}

export default ReturnButton;
