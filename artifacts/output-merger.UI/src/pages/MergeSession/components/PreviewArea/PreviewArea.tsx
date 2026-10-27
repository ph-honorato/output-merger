import PreviewIcon from '@mui/icons-material/Preview';
import { Fragment, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { PreviewCharCount, SortableSegment } from '../';
import { sameLanding, usePreviewArea } from './PreviewArea.hook';
import {
  buildLandingId,
  enumerateLandingAnchors,
  isSnippetToken,
} from '../../../../utils/previewDocument';
import type { Landing } from '../../../../context/SnippetsContext';
import type { PreviewToken } from '../../../../context/SnippetsContext';
import { withAlpha } from '../../../../utils/color';
import type { PreviewAreaProps } from './PreviewArea.types';
import * as S from './PreviewArea.styles';

/**
 * Invisible zero-footprint droppable for one drag LANDING — one of
 * the word-boundary positions a dragged snippet can drop at. The pure
 * enumeration in
 * utils/previewDocument (`enumerateLandingAnchors`) yields one
 * anchor per position — word boundaries inside/beside own text and
 * the token gaps no text edge covers, dedupe included. While a drag
 * hovers a position, dnd-kit reports the anchor as `over`, the
 * needle renders at that exact spot, and the drop lands exactly
 * there. Decorative collision anchor only: hidden from assistive
 * tech, no text, no layout footprint — the parser and the frozen
 * surface treat it exactly like the legacy gap anchors.
 */
function LandingAnchor({ landing }: { landing: Landing }) {
  const id = buildLandingId(landing);
  const { setNodeRef } = useDroppable({ id });
  return (
    <S.DropGap
      ref={setNodeRef}
      data-testid="preview-drop-gap"
      data-landing={id}
      aria-hidden="true"
    />
  );
}

function PreviewArea(props: PreviewAreaProps) {
  const { className, onActiveDragChange, showCharCount = true, $entranceDelay } = props;
  const {
    t,
    editEnabled,
    editingLabel,
    editingPlaceholder,
    renderedTokens,
    renderEpoch,
    isDocumentEmpty,
    flowRef,
    sensors,
    announcements,
    screenReaderInstructions,
    activeSnippet,
    dropLanding,
    handleFlowFocus,
    handleFlowBlur,
    handleFlowInput,
    handleFlowKeyDown,
    handleFlowPaste,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragCancel,
  } = usePreviewArea(onActiveDragChange);

  // The token children as stable element references, plus the flow's
  // assembled children (tokens with the landing anchors and the
  // needle rendered at the marked landing). While the surface is
  // focused and edit is ON these memos do not recompute (the frozen
  // snapshot is unchanged): React then sees identical element
  // references and never reconciles the token children — the focused
  // DOM owns itself. The anchors and the needle are
  // zero-text transparent elements for the parser (text pieces merge
  // back across them); the anchors exist only while there is at
  // least one chip to drag, so a tokenless flow stays truly :empty
  // and the placeholder hint can render.
  const { flowChildren, renderedSnippetIds } = useMemo(() => {
    const snippetCount = renderedTokens.reduce(
      (count, token) => (isSnippetToken(token) ? count + 1 : count),
      0
    );

    const tokenGapAnchors = new Map<number, Landing[]>();
    const splitOffsets = new Map<number, number[]>();
    if (snippetCount > 0) {
      for (const { landing } of enumerateLandingAnchors(renderedTokens)) {
        if (landing.kind === 'token-gap') {
          const list = tokenGapAnchors.get(landing.tokenIndex) ?? [];
          tokenGapAnchors.set(landing.tokenIndex, [...list, landing]);
        } else {
          const list = splitOffsets.get(landing.tokenIndex) ?? [];
          splitOffsets.set(landing.tokenIndex, [
            ...list,
            landing.boundaryOffset,
          ]);
        }
      }
    }

    const needleAt = (landing: Landing) =>
      sameLanding(dropLanding, landing) ? (
        <S.DropIndicator
          key={`needle-${buildLandingId(landing)}`}
          data-testid="preview-drop-indicator"
          aria-hidden="true"
        >
          <S.DropIndicatorBar />
        </S.DropIndicator>
      ) : null;

    // A text token with landing anchors renders as text PIECES with
    // the zero-footprint anchors at their offsets — the anchors sit
    // exactly at the word boundaries without perturbing the text.
    const renderToken = (
      token: PreviewToken,
      tokenIndex: number
    ): ReactNode => {
      if (isSnippetToken(token)) {
        return (
          <SortableSegment key={token.tokenId} token={token} editing={editEnabled} />
        );
      }
      if (token.kind === 'text') {
        const offsets = splitOffsets.get(tokenIndex);
        if (!offsets || offsets.length === 0) {
          return <Fragment key={token.tokenId}>{token.text}</Fragment>;
        }
        const pieces: ReactNode[] = [];
        let cursor = 0;
        offsets.forEach((offset, ordinal) => {
          const piece = token.text.slice(cursor, offset);
          const landing: Landing = {
            kind: 'text-split',
            tokenIndex,
            boundaryOffset: offset,
          };
          pieces.push(
            piece ? (
              <Fragment key={`piece-${ordinal}`}>{piece}</Fragment>
            ) : null
          );
          pieces.push(
            <LandingAnchor key={`anchor-${ordinal}`} landing={landing} />
          );
          pieces.push(needleAt(landing));
          cursor = offset;
        });
        if (cursor < token.text.length) {
          pieces.push(
            <Fragment key="piece-last">{token.text.slice(cursor)}</Fragment>
          );
        }
        return <Fragment key={token.tokenId}>{pieces}</Fragment>;
      }
      return <Fragment key={token.tokenId}>{'\n'}</Fragment>;
    };

    const children: ReactNode[] = [];
    const snippetIds: string[] = [];
    renderedTokens.forEach((token, tokenIndex) => {
      for (const landing of tokenGapAnchors.get(tokenIndex) ?? []) {
        children.push(
          <LandingAnchor
            key={`gap-${token.tokenId}-${tokenIndex}`}
            landing={landing}
          />
        );
        children.push(needleAt(landing));
      }
      if (isSnippetToken(token)) {
        snippetIds.push(token.tokenId);
      }
      children.push(renderToken(token, tokenIndex));
    });
    for (const landing of tokenGapAnchors.get(renderedTokens.length) ?? []) {
      children.push(<LandingAnchor key="gap-trailing" landing={landing} />);
      children.push(needleAt(landing));
    }

    return { flowChildren: children, renderedSnippetIds: snippetIds };
  }, [renderedTokens, dropLanding, editEnabled]);

  // Gating matrix (edit OFF/ON × empty/non-empty): edit OFF + empty
  // keeps today's empty state; edit ON renders the editable root even
  // while empty.
  const showEmptyState = !editEnabled && isDocumentEmpty;

  return (
    <S.PreviewAreaRoot
      data-testid="preview-area"
      className={className}
      $entranceDelay={$entranceDelay}
    >
      {showEmptyState ? (
        <S.EmptyState data-testid="preview-empty">
          <PreviewIcon aria-hidden="true" />
          <span>{t('pages.mergeSession.previewArea.empty')}</span>
        </S.EmptyState>
      ) : (
        <>
          {/* The scrolling text region of the fixed card. Its
              content-independent geometry (basis ZERO) plus the
              absolutely pinned counter below mean no amount of
              content can push the counter out of view; the reserved
              bottom strip keeps the scrolling text clear of it. */}
          <S.FlowArea
            data-testid="preview-flow-area"
            $reserveCounter={showCharCount}
          >
            <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{ announcements, screenReaderInstructions }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={renderedSnippetIds}
            strategy={rectSortingStrategy}
          >
            <S.SegmentFlow
              key={`preview-flow-${renderEpoch}`}
              ref={flowRef}
              data-testid="preview-segment-flow"
              $editing={editEnabled}
              contentEditable={editEnabled || undefined}
              suppressContentEditableWarning
              aria-multiline={editEnabled || undefined}
              aria-label={editEnabled ? editingLabel : undefined}
              data-placeholder={editEnabled ? editingPlaceholder : undefined}
              onFocus={handleFlowFocus}
              onBlur={handleFlowBlur}
              onInput={editEnabled ? handleFlowInput : undefined}
              onKeyDown={editEnabled ? handleFlowKeyDown : undefined}
              onPaste={editEnabled ? handleFlowPaste : undefined}
            >
              {flowChildren}
            </S.SegmentFlow>
          </SortableContext>
          <DragOverlay zIndex={200} dropAnimation={null}>
            {activeSnippet ? (
              <S.OverlayChip
                data-testid="preview-snippet-overlay"
                style={{
                  backgroundColor: withAlpha(activeSnippet.color, 0.3),
                }}
              >
                {activeSnippet.text}
              </S.OverlayChip>
            ) : null}
          </DragOverlay>
            </DndContext>
          </S.FlowArea>
          {/* The char counter, ABSOLUTELY pinned at the card's
              bottom-right padding inset: out of the flow, so no
              amount of content can move or overlap it. The modal
              suppresses it here and renders it as the last element
              of its tools rail instead. */}
          {showCharCount ? (
            <S.CounterPin data-testid="preview-counter-pin">
              <PreviewCharCount />
            </S.CounterPin>
          ) : null}
        </>
      )}
    </S.PreviewAreaRoot>
  );
}

export default PreviewArea;
