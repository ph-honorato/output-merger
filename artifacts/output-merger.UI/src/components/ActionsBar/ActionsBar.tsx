import { useActionsBar } from './ActionsBar.hook';
import { type ActionsBarProps } from './ActionsBar.types';
import * as S from './ActionsBar.styles';

function ActionsBar(props: ActionsBarProps) {
  const { align = 'right', children, className } = props;
  const { justifyContent } = useActionsBar(align);

  return (
    <S.ActionsBarRoot
      data-testid="actions-bar-root"
      className={className}
      $justifyContent={justifyContent}
    >
      {children}
    </S.ActionsBarRoot>
  );
}

export default ActionsBar;
