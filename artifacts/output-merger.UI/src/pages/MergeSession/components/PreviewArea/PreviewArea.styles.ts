import styled, { css } from "styled-components";
import { type StyledTheme, CARD_HEIGHT } from "@theme";
import { slideUpFadeIn } from "@utils/animations";

export const PreviewAreaRoot = styled.div<{ $entranceDelay?: string }>`
  flex: 1 1 auto;
  min-width: 0;
  /* One fixed height for every card (the text inputs and the
   * preview match, so the default-view columns align): the card
   * never grows with its content — the flow area fills the fixed
   * card and scrolls internally (the caret auto-scrolls natively
   * while typing at the bottom), and the char counter is ABSOLUTELY
   * pinned at the card's bottom, so no content amount can ever push
   * it out of view. The modal's layout tweak overrides this to its
   * zone bounds. */
  height: ${CARD_HEIGHT};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  /* The absolute counter pin anchors against the card itself. */
  position: relative;
  padding: ${({ theme }) => (theme as StyledTheme).spacing(2)};
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.background.paper};
  border: 1px solid ${({ theme }) => (theme as StyledTheme).palette.divider};
  border-radius: ${({ theme }) => (theme as StyledTheme).borderRadius};
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);

  /* Entrance animation: slide up + fade in (opt-in via $entranceDelay prop) */
  ${({ $entranceDelay }) =>
    $entranceDelay !== undefined
      ? css`
          opacity: 0;
          animation: ${slideUpFadeIn} 800ms ease-out ${$entranceDelay} forwards;

          @media (prefers-reduced-motion: reduce) {
            animation: none;
            opacity: 1;
          }
        `
      : css`
          opacity: 1;
        `}
`;

/**
 * The scrolling text region of the fixed card: takes every remaining
 * pixel and scrolls its own content. The editable flow host (and the
 * drag wiring around it) lives inside. The flex basis is ZERO, never
 * `auto`: the region's share of the card derives from the card's
 * fixed height alone, never from the content — a content-driven
 * basis lets the contentEditable's intrinsic height push the region
 * past the card in a real browser (jsdom computes no layout, so this
 * can only be caught by the content-independent geometry itself).
 * When the card's counter pin renders, the reserved bottom strip
 * keeps the scrolling text clear of it; the modal (which suppresses
 * the in-card counter) reserves nothing.
 */
export const FlowArea = styled.div<{ $reserveCounter?: boolean }>`
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  margin-bottom: ${({ theme, $reserveCounter }) =>
    $reserveCounter ? (theme as StyledTheme).spacing(3.5) : "0px"};
`;

/**
 * The absolutely pinned counter anchor: out of the flow, fixed to
 * the card's bottom-right padding inset — its position derives from
 * the card alone, so no amount of content can move or overlap it
 * (the flow area's reserved strip keeps the text clear).
 */
export const CounterPin = styled.div`
  position: absolute;
  bottom: ${({ theme }) => (theme as StyledTheme).spacing(2)};
  right: ${({ theme }) => (theme as StyledTheme).spacing(2)};
`;

export const EmptyState = styled.div`
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => (theme as StyledTheme).spacing(1)};
  color: ${({ theme }) => (theme as StyledTheme).palette.text.secondary};
`;

export const SegmentFlow = styled.div<{ $editing?: boolean }>`
  display: block;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  text-align: left;

  ${({ $editing }) =>
    $editing
      ? css`
          /* The caret is the editing host's own focus indicator
           *: the UA's default focus
           * outline — a black box around the whole flow on click —
           * is removed for the editing state only. Chips, buttons,
           * and every other focus ring are untouched. */
          outline: none;
          cursor: text;
          min-height: 1.75em;

          /* Empty-document editing: the placeholder hint is a
           * pseudo-element — no DOM, no parse/serialization
           * footprint, so the WYSIWYG invariant never sees it. Known
           * caveat: a stray zero-length text node left by the browser
           * while focused may keep the hint hidden until blur (the
           * absolutely-positioned overlay is the documented
           * fallback). */
          &:empty::before {
            content: attr(data-placeholder);
            color: ${({ theme }) =>
              (theme as StyledTheme).palette.text.secondary};
            pointer-events: none;
          }
        `
      : ""}
`;

export const OverlayChip = styled.span`
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  color: ${({ theme }) => (theme as StyledTheme).palette.text.primary};
  white-space: pre-wrap;
  cursor: grabbing;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
`;

/**
 * Drop-indicator needle rendered between segments while a drag is
 * active, at the landing slot of the dragged snippet. The anchor is a
 * zero-width, zero-height inline-block: it participates in the flow's
 * inline wrapping (at a line-wrap boundary it stays at the end of the
 * earlier line, like any inline content) but takes no space, so it
 * cannot perturb dnd-kit's measured sortable rects or the
 * rectSortingStrategy sibling transforms while it appears, moves, or
 * disappears mid-drag.
 */
export const DropIndicator = styled.span`
  display: inline-block;
  position: relative;
  width: 0px;
  height: 0px;
  pointer-events: none;
`;

/**
 * Visible needle bar, absolutely positioned inside the zero-size
 * anchor: the TextInput needle's shape language (4px wide, 1.5em tall,
 * 2px radius, left edge at the insertion point) in the theme's neutral
 * text.secondary — never a snippet color, never the primary accent.
 * The 1.5em bar spans the flow's 1.6 body line-height (the empty
 * anchor's box sits on the text baseline), with no animation: it
 * appears and disappears instantly.
 */
export const DropIndicatorBar = styled.span`
  position: absolute;
  top: -1.1em;
  left: 0;
  width: 4px;
  height: 1.5em;
  border-radius: 2px;
  background-color: ${({ theme }) =>
    (theme as StyledTheme).palette.text.secondary};
`;

/**
 * Invisible droppable anchor for one insertion gap (before/between/
 * after the snippets). Same zero-width, zero-height footprint
 * discipline as the needle anchor: it participates in the flow's
 * inline wrapping but takes no space and no pointer events, so the
 * sortable rects and transforms stay unperturbed. dnd-kit's
 * rect-center collision pins the anchor's center at the exact
 * insertion point, so a pointer hovering the space between two
 * snippets resolves to this droppable — the needle then renders at
 * that slot and the drop lands exactly there.
 */
export const DropGap = styled.span`
  display: inline-block;
  position: relative;
  width: 0px;
  height: 0px;
  pointer-events: none;
`;
