import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useSnippets } from '../../../../context/SnippetsContext';

/**
 * Composes i18n, the below-md viewport gate, the empty-preview
 * trigger state, and the modal's own open/close + Escape-guard state.
 * Self-contained by design: the page only places the component
 * inside the toolbar; no props, no external open state, and no new
 * context — snippet state stays solely in SnippetsContext (the modal
 * re-renders the same PreviewArea from it).
 */
export function usePreviewModal() {
  const { t } = useTranslation();
  const theme = useTheme();
  // User decision (2026-10-15): the trigger is hidden below md, so
  // the closed modal is unreachable on mobile; an open dialog
  // survives a viewport shrink by switching to fullScreen.
  const isBelowMd = useMediaQuery(theme.breakpoints.down('md'));
  const { snippets } = useSnippets();
  const [open, setOpen] = useState(false);
  // True while a drag is active in THIS modal's PreviewArea instance
  // (fed by its additive onActiveDragChange callback): Escape then
  // cancels only the drag and leaves the dialog open.
  const [dragActive, setDragActive] = useState(false);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    // The dialog can close while a drag is still in flight (e.g. the
    // rail close button tapped during a pointer drag): dnd-kit cleanup
    // cancels that drag without firing our callback, so reset the
    // guard here — a reopened dialog must close on plain Escape again.
    setDragActive(false);
  }, []);

  const handleActiveDragChange = useCallback((active: boolean) => {
    setDragActive(active);
  }, []);

  /**
   * The Dialog onClose funnel for backdrop and Escape closes.
   *
   * The installed MUI v9.4.0 removed `disableEscapeKeyDown` (the
   * prop the spec's mechanism named) and its modal root both stops
   * Escape propagation and fires onClose before dnd-kit's
   * document-level sensor listeners can receive the key — so an
   * unguarded Escape mid-drag would close the dialog and silently
   * kill the drag via unmount. The guard reimplements the specified
   * behavior on top of what v9 offers: while a drag is active, the
   * escapeKeyDown close is vetoed and a fresh Escape is forwarded to
   * the document so the sensors cancel the drag; every other close
   * path (and Escape with no active drag) closes normally.
   */
  const handleDialogClose = useCallback(
    (_event: unknown, reason: 'backdropClick' | 'escapeKeyDown') => {
      if (reason === 'escapeKeyDown' && dragActive) {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }),
        );
        return;
      }
      handleClose();
    },
    [dragActive, handleClose],
  );

  return {
    t,
    isBelowMd,
    canOpen: snippets.length > 0,
    open,
    dragActive,
    handleOpen,
    handleClose,
    handleDialogClose,
    handleActiveDragChange,
  };
}
