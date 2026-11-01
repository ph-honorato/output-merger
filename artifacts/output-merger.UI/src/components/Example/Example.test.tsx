import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StyledThemeProvider } from "styled-components";
import { theme } from "@theme";
import { i18n } from "@translation";
import { I18nextProvider } from "react-i18next";
import Example from "./Example";

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          {component}
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>
  );
};

describe("Example Component", () => {
  const setup = () => {
    return renderWithProviders(<Example />);
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
});
