import { CSS } from '@dnd-kit/utilities';
import { useSortableSegment } from './SortableSegment.hook';
import type { SortableSegmentProps } from './SortableSegment.types';
import * as S from './SortableSegment.styles';

function SortableSegment(props: SortableSegmentProps) {
  const { snippet, sortableId, className } = props;
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortableSegment(sortableId);

  return (
    <S.SegmentChip
      ref={setNodeRef}
      data-testid="preview-snippet"
      className={className}
      $color={snippet.color}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { opacity: 0.4 } : {}),
      }}
      {...attributes}
      {...listeners}
    >
      {snippet.text}
    </S.SegmentChip>
  );
}

export default SortableSegment;
