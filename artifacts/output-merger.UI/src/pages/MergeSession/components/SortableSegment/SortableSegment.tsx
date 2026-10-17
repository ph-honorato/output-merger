import { CSS } from '@dnd-kit/utilities';
import { useSortableSegment } from './SortableSegment.hook';
import type { SortableSegmentProps } from './SortableSegment.types';
import * as S from './SortableSegment.styles';

function SortableSegment(props: SortableSegmentProps) {
  const { token, className } = props;
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortableSegment(token.tokenId);

  return (
    <S.SegmentChip
      ref={setNodeRef}
      data-testid="preview-snippet"
      data-token-id={token.tokenId}
      className={className}
      $color={token.color}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { opacity: 0.4 } : {}),
      }}
      {...attributes}
      {...listeners}
    >
      {token.text}
    </S.SegmentChip>
  );
}

export default SortableSegment;
