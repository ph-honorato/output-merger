import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Example from "./Example";

describe("Example Component", () => {
  const setup = (theme: "light" | "dark" = "light") => {
    return render(<Example theme={theme} />);
  };

  it("should render example component", () => {
    setup();
    const wrapper = screen.getByTestId("example-wrapper");
    const button = screen.getByTestId("example-button");
    const counter = screen.getByTestId("example-counter");

    expect(wrapper).toBeInTheDocument();
    expect(button).toBeInTheDocument();
    expect(counter).toHaveTextContent("Clicks: 0");
  });

  it("should increment counter on button click", async () => {
    setup();
    const button = screen.getByTestId("example-button");
    const counter = screen.getByTestId("example-counter");
    const user = userEvent.setup();

    expect(counter).toHaveTextContent("Clicks: 0");

    await user.click(button);
    expect(counter).toHaveTextContent("Clicks: 1");

    await user.click(button);
    expect(counter).toHaveTextContent("Clicks: 2");
  });

  it("should render with dark theme", () => {
    setup("dark");
    const wrapperDark = screen.getByTestId("example-wrapper");
    expect(wrapperDark).toBeInTheDocument();
    expect(wrapperDark).toHaveStyle({ backgroundColor: "#1a1a1a" });
  });
});
