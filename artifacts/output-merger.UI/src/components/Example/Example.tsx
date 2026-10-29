import * as styled from "./Example.styles";
import { useExample } from "./Example.hook";
import { type ExampleProps } from "./Example.types";

function Example(_props: ExampleProps) {
  const { clickCount, handleClick } = useExample();

  return (
    <styled.Wrapper data-testid="example-wrapper">
      <styled.Button onClick={handleClick} data-testid="example-button">
        Click me
      </styled.Button>
      <styled.CounterText data-testid="example-counter">
        Clicks: {clickCount}
      </styled.CounterText>
    </styled.Wrapper>
  );
}

export default Example;