import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StyledThemeProvider } from "styled-components";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../../i18n";
import enUS from "../../../../i18n/resources/en-US.json";
import ptBR from "../../../../i18n/resources/pt-BR.json";
import { theme } from "../../../../theme";
import {
  SnippetsProvider,
  useSnippets,
} from "../../../../context/SnippetsContext";
import type { Snippet } from "@components";
import { buildMergedText } from "../CopyMergedTextButton/CopyMergedTextButton.hook";
import PreviewArea from "./PreviewArea";
import { withAlpha } from "../../../../utils/color";

const makeSnippet = (id: string, text: string, color = "#0080FF"): Snippet => ({
  id,
  text,
  startIndex: 0,
  endIndex: text.length,
  color,
});

const Harness = ({ updates }: { updates: Array<[string, Snippet[]]> }) => {
  const { setSourceSnippets } = useSnippets();
  useEffect(() => {
    updates.forEach(([sourceId, snippets]) =>
      setSourceSnippets(sourceId, snippets),
    );
  }, [updates, setSourceSnippets]);
  return <PreviewArea />;
};

const renderWithProviders = (updates: Array<[string, Snippet[]]>) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MuiThemeProvider theme={theme}>
        <StyledThemeProvider theme={theme}>
          <SnippetsProvider>
            <Harness updates={updates} />
          </SnippetsProvider>
        </StyledThemeProvider>
      </MuiThemeProvider>
    </I18nextProvider>,
  );

afterEach(async () => {
  await i18n.changeLanguage("en-US");
});

describe("PreviewArea", () => {
  it("renders the root", () => {
    renderWithProviders([]);
    expect(screen.getByTestId("preview-area")).toBeInTheDocument();
  });

  it("shows the empty state when there are no snippets", () => {
    renderWithProviders([]);
    expect(screen.getByTestId("preview-empty")).toBeInTheDocument();
    expect(
      screen.getByText("Select some snippets on the inputs to start"),
    ).toBeInTheDocument();
    expect(screen.queryAllByTestId("preview-snippet")).toHaveLength(0);
  });

  it("ships the empty-state key in both en-US and pt-BR resources", () => {
    expect(enUS).toHaveProperty(
      "pages.mergeSession.previewArea.empty",
      "Select some snippets on the inputs to start",
    );
    expect(ptBR).toHaveProperty(
      "pages.mergeSession.previewArea.empty",
      "Selecione alguns trechos nas entradas para começar",
    );
  });

  it("updates the empty-state text when the language changes", async () => {
    renderWithProviders([]);

    await act(async () => {
      await i18n.changeLanguage("pt");
    });

    expect(
      screen.getByText("Selecione alguns trechos nas entradas para começar"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Select some snippets on the inputs to start"),
    ).toBeNull();

    await act(async () => {
      await i18n.changeLanguage("en-US");
    });

    expect(
      screen.getByText("Select some snippets on the inputs to start"),
    ).toBeInTheDocument();
  });

  it("renders one segment per snippet in merge order", () => {
    const a1 = makeSnippet("a1", "Hello");
    const b1 = makeSnippet("b1", "Alpha");
    const a2 = makeSnippet("a2", "world");
    renderWithProviders([
      ["text-1", [a1]],
      ["text-2", [b1]],
      ["text-1", [a1, a2]],
    ]);
    const segments = screen.getAllByTestId("preview-snippet");
    expect(segments).toHaveLength(3);
    expect(segments.map((segment) => segment.textContent)).toEqual([
      "Hello",
      "Alpha",
      "world",
    ]);
  });

  it("tints each segment with its snippet color", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Hello", "#0080FF")]]]);
    expect(screen.getAllByTestId("preview-snippet")[0]).toHaveStyle({
      backgroundColor: "rgba(0, 128, 255, 0.3)",
    });
  });

  it("left-aligns multi-line snippet text inside the segment flow", () => {
    renderWithProviders([
      ["text-1", [makeSnippet("a1", "First line\nSecond line")]],
    ]);
    expect(screen.getByTestId("preview-segment-flow")).toHaveStyle({
      textAlign: "left",
    });
  });

  it("lays out the segment flow as a block text container that breaks long words", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Hello")]]]);
    const flow = screen.getByTestId("preview-segment-flow");
    expect(flow).toHaveStyle({ display: "block" });
    expect(flow).toHaveStyle({ overflowWrap: "break-word" });
    expect(screen.getAllByTestId("preview-snippet")[0]).toHaveStyle({
      overflowWrap: "break-word",
    });
  });

  it("renders the flow text exactly as buildMergedText produces it", () => {
    // 'b1' ends with a space: the resulting double space in the join is
    // by-design (clipboard parity — join semantics untouched).
    renderWithProviders([
      ["text-1", [makeSnippet("a1", "Hello")]],
      ["text-2", [makeSnippet("b1", "brave ")]],
      ["text-1", [makeSnippet("a1", "Hello"), makeSnippet("a2", "world")]],
      ["text-2", [makeSnippet("b1", "brave "), makeSnippet("b2", "today")]],
    ]);
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      buildMergedText([
        { ...makeSnippet("a1", "Hello"), sourceId: "text-1", order: 1 },
        { ...makeSnippet("b1", "brave "), sourceId: "text-2", order: 2 },
        { ...makeSnippet("a2", "world"), sourceId: "text-1", order: 3 },
        { ...makeSnippet("b2", "today"), sourceId: "text-2", order: 4 },
      ]),
    );
  });

  it("clears the empty state when a snippet arrives", () => {
    const { rerender } = renderWithProviders([]);
    expect(screen.getByTestId("preview-empty")).toBeInTheDocument();
    const snippet = makeSnippet("a1", "Hello");
    rerender(
      <I18nextProvider i18n={i18n}>
        <MuiThemeProvider theme={theme}>
          <StyledThemeProvider theme={theme}>
            <SnippetsProvider>
              <Harness updates={[["text-1", [snippet]]]} />
            </SnippetsProvider>
          </StyledThemeProvider>
        </MuiThemeProvider>
      </I18nextProvider>,
    );
    expect(screen.queryByTestId("preview-empty")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("preview-snippet")).toHaveLength(1);
  });

  it("withAlpha converts hex colors to rgba and passes through non-hex input", () => {
    expect(withAlpha("#0080FF", 0.3)).toBe("rgba(0, 128, 255, 0.3)");
    expect(withAlpha("#F00", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
    expect(withAlpha("not-a-color", 0.3)).toBe("not-a-color");
  });
});
