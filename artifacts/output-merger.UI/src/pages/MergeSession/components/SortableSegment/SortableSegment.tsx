import { CSS } from '@dnd-kit/utilities';
import { useSortableSegment } from './SortableSegment.hook';
import type { SortableSegmentProps } from './SortableSegment.types';
import * as S from './SortableSegment.styles';

function SortableSegment(props: SortableSegmentProps) {
  const { token, editing, className } = props;
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortableSegment(token.tokenId);

  // Round 6 (user decision 2026-10-18): while edit mode is ON the
  // chips are plain spans of the editor — no focus/a11y attributes
  // (no tab stop, no button role), text cursor, text selection —
  // while the node ref, the measuring, and the KEYBOARD activator
  // listener stay attached (it is the Ctrl+Space entry: the
  // activator only requires the keydown target to be this element,
  // which cannot take focus while editing). While edit mode is OFF
  // the chip keeps today's full dnd-kit semantics verbatim.
  return (
    <S.SegmentChip
      ref={setNodeRef}
      data-testid="preview-snippet"
      data-token-id={token.tokenId}
      className={className}
      $color={token.color}
      $editing={editing}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { opacity: 0.4 } : {}),
      }}
      {...(editing ? {} : attributes)}
      {...listeners}
    >
      {token.text}
    </S.SegmentChip>
  );
}

export default SortableSegment;
