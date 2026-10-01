import * as styled from "./Example.styles";
import { useExample } from "./Example.hook";
import { type ExampleProps } from "./Example.types";

function Example(props: ExampleProps) {
  const { theme } = props;
  const { clickCount, handleClick } = useExample();

  return (
    <styled.Wrapper theme={theme} data-testid="example-wrapper">
      <styled.Button onClick={handleClick} data-testid="example-button">
        Click me
      </styled.Button>
      <styled.CounterText theme={theme} data-testid="example-counter">
        Clicks: {clickCount}
      </styled.CounterText>
    </styled.Wrapper>
  );
}

export default Example;
