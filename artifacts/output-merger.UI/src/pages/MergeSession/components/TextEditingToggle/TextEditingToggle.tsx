import Title from '@mui/icons-material/Title';
import { useTextEditingToggle } from './TextEditingToggle.hook';
import * as S from './TextEditingToggle.styles';
import type { TextEditingToggleProps } from './TextEditingToggle.types';

/**
 * The "T" edit-text toggle: icon-only, off by default, one shared session state
 * consumed by both the toolbar and the modal's tools rail. While
 * pressed, typing is enabled on both preview surfaces; while not,
 * the preview is today's sort-only flow (dragging is always live in
 * both modes).
 */
function TextEditingToggle(props: TextEditingToggleProps) {
  const { className } = props;
  const { ariaLabel, editEnabled, handleToggle } = useTextEditingToggle();

  return (
    <S.ToggleIconButton
      data-testid="preview-edit-toggle"
      className={className}
      aria-label={ariaLabel}
      aria-pressed={editEnabled}
      onClick={handleToggle}
    >
      <Title />
    </S.ToggleIconButton>
  );
}

export default TextEditingToggle;
