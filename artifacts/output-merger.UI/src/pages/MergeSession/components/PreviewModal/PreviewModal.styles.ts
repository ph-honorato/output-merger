import styled from "styled-components";
import DialogTitle from "@mui/material/DialogTitle";
import type { DefaultTheme } from "styled-components";
import type { Theme } from "@mui/material/styles";

type StyledTheme = DefaultTheme & Theme;

/**
 * Visually hidden DialogTitle (the 1px-clip screen-reader-only
 * pattern). It carries the dialog's accessible name
 * (pages.mergeSession.previewArea.modal.name) without rendering any
 * visible title: MUI's DialogContext auto-wires the dialog's
 * `aria-labelledby` to this element — the spec-verified reason a
 * DialogTitle is required at all (a plain aria-label on the Dialog
 * lands on the Modal root and does NOT name the dialog).
 */
export const VisuallyHiddenTitle = styled(DialogTitle)`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

/**
 * The dialog content as a flex row: the centered preview zone
 * (flex: 1) on the left and the bare tools rail at the right, both
 * top-aligned (mirrors the page's PreviewColumn row). At md+ the
 * layout is fixed at ~90dvh — the Paper hugs it, so the dialog chrome
 * stays stable while long text scrolls inside the preview card;
 * in fullScreen it fills the Paper so the resize edge leaves no gap.
 */
export const ModalLayout = styled.div<{ $fullScreen: boolean }>`
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  height: ${({ $fullScreen }) => ($fullScreen ? "100%" : "90dvh")};
`;

/**
 * Left zone: takes all remaining width (flex: 1) and centers the
 * shared PreviewArea card horizontally at its natural size, up to
 * the zone bounds.
 */
export const PreviewZone = styled.div`
  box-sizing: border-box;
  flex: 1 1 auto;
  min-width: 0;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${({ theme }) => (theme as StyledTheme).spacing(2)};
`;

/**
 * The modal's layout tweak for the shared, unmodified PreviewArea,
 * carried by its existing className prop: the component is rendered
 * via `as={PreviewArea}` (PreviewModal.tsx), so the generated class
 * merges into the PreviewAreaRoot's own class. The shared root is
 * built for the inline column (`flex: 1 1 auto` — fills its parent);
 * inside the modal's centered zone it takes its natural size up to
 * the zone bounds and scrolls internally beyond that, keeping its
 * min-height 400px. It stays the exact same component.
 */
export const ModalPreviewArea = styled.div<{
  onActiveDragChange?: (active: boolean) => void;
}>`
  flex: 1 1 auto;
  width: 100%;
`;

/**
 * Bare vertical tools rail at the Paper's right edge: transparent,
 * no card chrome (deliberately NOT the PreviewToolbar component —
 * no duplicate preview-toolbar testid, no card-inside-card), top-
 * aligned, inset theme.spacing(2) from the right edge so it does
 * not interfere with the centralization of the preview. Rail order
 *: copy on
 * top, close under it, the edit-text toggle last. Stays visible in
 * fullScreen so close remains reachable on the resize edge.
 */
export const ToolsRail = styled.div`
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(0.5)};
  margin: ${({ theme }) => (theme as StyledTheme).spacing(2)}
    ${({ theme }) => (theme as StyledTheme).spacing(2)} 0 0;
`;
