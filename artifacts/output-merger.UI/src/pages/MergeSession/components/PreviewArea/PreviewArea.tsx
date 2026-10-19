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
import { SortableSegment } from '../';
import { buildGapId, usePreviewArea } from './PreviewArea.hook';
import { isSnippetToken } from '../../../../utils/previewDocument';
import { withAlpha } from '../../../../utils/color';
import type { PreviewAreaProps } from './PreviewArea.types';
import * as S from './PreviewArea.styles';

/**
 * Invisible zero-footprint droppable for one insertion gap
 * (before/between/after the snippet chips). While a pointer drag hovers
 * the space between two snippets, dnd-kit reports this anchor as
 * `over`, so the needle renders at that slot and the drop lands
 * exactly there. Decorative collision anchor only: hidden from
 * assistive tech, no text, no layout footprint.
 */
function DropGap({ slot }: { slot: number }) {
  const { setNodeRef } = useDroppable({ id: buildGapId(slot) });
  return (
    <S.DropGap
      ref={setNodeRef}
      data-testid="preview-drop-gap"
      data-gap-slot={slot}
      aria-hidden="true"
    />
  );
}

function PreviewArea(props: PreviewAreaProps) {
  const { className, onActiveDragChange } = props;
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
    dropIndicatorIndex,
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
  // assembled children (tokens with the gap anchors and the needle
  // rendered right before the chip occupying each snippet slot).
  // While the surface is focused and edit is ON these memos do not
  // recompute (the frozen snapshot is unchanged): React then sees
  // identical element references and never reconciles the token
  // children — the focused DOM owns itself (ADR 0004). The gap
  // anchors and the needle are zero-text transparent elements for
  // the parser; the trailing gap exists only while there is at least
  // one chip to drag, so a tokenless flow stays truly :empty and
  // the placeholder hint can render.
  const { flowChildren, renderedSnippetIds } = useMemo(() => {
    const tokenElements = renderedTokens.map((token) => {
      if (isSnippetToken(token)) {
        return (
          <SortableSegment key={token.tokenId} token={token} editing={editEnabled} />
        );
      }
      if (token.kind === 'text') {
        return <Fragment key={token.tokenId}>{token.text}</Fragment>;
      }
      return <Fragment key={token.tokenId}>{'\n'}</Fragment>;
    });

    const needle = (slot: number) =>
      dropIndicatorIndex === slot ? (
        <S.DropIndicator
          key={`needle-${slot}`}
          data-testid="preview-drop-indicator"
          aria-hidden="true"
        >
          <S.DropIndicatorBar />
        </S.DropIndicator>
      ) : null;

    const children: ReactNode[] = [];
    const snippetIds: string[] = [];
    let snippetSlot = 0;
    renderedTokens.forEach((token, tokenIndex) => {
      if (isSnippetToken(token)) {
        const slot = snippetSlot;
        snippetSlot += 1;
        snippetIds.push(token.tokenId);
        children.push(<DropGap key={`gap-${token.tokenId}`} slot={slot} />);
        children.push(needle(slot));
      }
      children.push(tokenElements[tokenIndex]);
    });
    if (snippetSlot > 0) {
      children.push(<DropGap key="gap-trailing" slot={snippetSlot} />);
      children.push(needle(snippetSlot));
    }

    return { flowChildren: children, renderedSnippetIds: snippetIds };
  }, [renderedTokens, dropIndicatorIndex, editEnabled]);

  // Gating matrix (edit OFF/ON × empty/non-empty): edit OFF + empty
  // keeps today's empty state; edit ON renders the editable root even
  // while empty (F3).
  const showEmptyState = !editEnabled && isDocumentEmpty;

  return (
    <S.PreviewAreaRoot data-testid="preview-area" className={className}>
      {showEmptyState ? (
        <S.EmptyState data-testid="preview-empty">
          <PreviewIcon aria-hidden="true" />
          <span>{t('pages.mergeSession.previewArea.empty')}</span>
        </S.EmptyState>
      ) : (
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
      )}
    </S.PreviewAreaRoot>
  );
}

export default PreviewArea;
