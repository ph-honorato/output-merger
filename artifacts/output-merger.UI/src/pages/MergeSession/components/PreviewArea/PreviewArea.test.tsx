import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useEffect } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StyledThemeProvider } from "styled-components";
import { I18nextProvider } from "react-i18next";
import { i18n, enUS, ptBR } from "@translation";
import { theme } from '@theme';
import {
  SnippetsProvider,
  useSnippets,
} from "../../../../context/SnippetsContext";
import type { Snippet } from "@components";
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { TextEditingToggle } from "../";
import {
  abuttingChipFromCaret,
  classifyCaretRelativeChip,
  collapseGapSpaces,
  findCaretGap,
  insertSplitPasteAtChipEnd,
  landingSnippetPosition,
  sameLanding,
  SNIPPET_DRAG_ACTIVATION,
  usePreviewArea,
} from "./PreviewArea.hook";
import {
  enumerateLandingAnchors,
  isSnippetToken,
  serialize,
} from '@utils/previewDocument';
import {
  initialSnippetsState,
  snippetsReducer,
} from "../../../../context/SnippetsContext/SnippetsContext.reducer";
import type { PreviewToken } from "../../../../context/SnippetsContext";
import PreviewArea from "./PreviewArea";
import { withAlpha } from '@utils/color';

const makeSnippet = (id: string, text: string, color = "#0080FF"): Snippet => ({
  id,
  text,
  startIndex: 0,
  endIndex: text.length,
  color,
});

// Renders the live serialized document (the model truth) next to the
// surface: asserts the WYSIWYG invariant and the per-input sync
// without reaching into internals.
const DocumentProbe = () => {
  const { document } = useSnippets();
  return (
    <span
      data-testid="document-probe"
      style={{ display: "none" }}
      aria-hidden="true"
    >
      {serialize(document)}
    </span>
  );
};

// Renders the edited flag of the first snippet token (model truth) —
// the paste suites assert that a prefix integration marks the chip
// edited while escape-only paths leave it untouched.
const EditedProbe = () => {
  const { document } = useSnippets();
  const snippet = document.find(isSnippetToken);
  return (
    <span
      data-testid="edited-probe"
      style={{ display: "none" }}
      aria-hidden="true"
    >
      {String(snippet?.edited ?? false)}
    </span>
  );
};

const Harness = ({ updates }: { updates: Array<[string, Snippet[]]> }) => {
  const { setSourceSnippets } = useSnippets();
  useEffect(() => {
    updates.forEach(([sourceId, snippets]) =>
      setSourceSnippets(sourceId, snippets),
    );
  }, [updates, setSourceSnippets]);
  return (
    <>
      <DocumentProbe />
      <EditedProbe />
      <TextEditingToggle />
      <PreviewArea />
    </>
  );
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

const seedInterleaved = (): Array<[string, Snippet[]]> => [
  ["text-1", [makeSnippet("a1", "Alpha")]],
  ["text-2", [makeSnippet("b1", "Beta")]],
  ["text-1", [makeSnippet("a1", "Alpha"), makeSnippet("a2", "Gamma")]],
];

const SORTING_COPY = {
  instructions: {
    "en-US":
      "To pick up a snippet, press Space or Enter. While dragging, use the arrow keys to move it. Press Space or Enter again to drop it, or Escape to cancel. While text editing is on, place the caret inside a snippet and press Ctrl+Space to lift it; Enter drops it and Escape cancels.",
    "pt-BR":
      "Para pegar um trecho, pressione Espaço ou Enter. Enquanto arrasta, use as setas para movê-lo. Pressione Espaço ou Enter novamente para soltá-lo, ou Escape para cancelar. Com a edição de texto ativada, posicione o cursor dentro de um trecho e pressione Ctrl+Espaço para levantá-lo; Enter o solta e Escape cancela.",
  },
  started: { "en-US": "Picked up snippet {{index}} of {{count}}.", "pt-BR": "Trecho {{index}} de {{count}} pego." },
  over: {
    "en-US": "Snippet is now over position {{index}} of {{count}}.",
    "pt-BR": "O trecho agora está sobre a posição {{index}} de {{count}}.",
  },
  ended: {
    "en-US": "Snippet dropped at position {{index}} of {{count}}.",
    "pt-BR": "Trecho solto na posição {{index}} de {{count}}.",
  },
  cancelled: { "en-US": "Snippet reorder cancelled.", "pt-BR": "Reordenação do trecho cancelada." },
} as const;

interface SegmentRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

const SEGMENT_RECTS: Record<string, SegmentRect> = {
  // The case-fix pass lowercases mid-sentence chips, so both casings
  // of the seeded names must resolve to their geometry.
  Alpha: { left: 0, top: 0, right: 100, bottom: 24, width: 100, height: 24, x: 0, y: 0 },
  Beta: { left: 120, top: 0, right: 220, bottom: 24, width: 100, height: 24, x: 120, y: 0 },
  Gamma: { left: 240, top: 0, right: 340, bottom: 24, width: 100, height: 24, x: 240, y: 0 },
  beta: { left: 120, top: 0, right: 220, bottom: 24, width: 100, height: 24, x: 120, y: 0 },
  gamma: { left: 240, top: 0, right: 340, bottom: 24, width: 100, height: 24, x: 240, y: 0 },
};

const ZERO_RECT: SegmentRect = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };

// Landing anchors sit at the droppable word boundaries / token gaps
// of the seeded layouts, keyed by their data-landing id. The 3-chip
// seed [Alpha, " ", Beta, " ", Gamma]: before Alpha (g:0, -4), right
// after Alpha (s:1:0, 104), before Beta (s:1:1, 110 — the old gap-1
// spot), right after Beta (s:3:0, 224), before Gamma (s:3:1, 230 —
// the old gap-2 spot), trailing (g:5, 344). The 2-chip seed's
// trailing anchor (g:3) sits 4px after Beta; the 1-chip seed's
// (g:1) 4px after Alpha.
const LANDING_X: Record<string, number> = {
  "preview-landing:g:0": -4,
  "preview-landing:s:1:0": 104,
  "preview-landing:s:1:1": 110,
  "preview-landing:s:3:0": 224,
  "preview-landing:s:3:1": 230,
  "preview-landing:g:3": 224,
  "preview-landing:g:1": 104,
  "preview-landing:g:5": 344,
};

// jsdom does not compute layout: give the segment chips deterministic
// rects so dnd-kit's rect-based collision detection works in tests.
// Landing anchors resolve by their data-landing id to the
// insertion-point x; everything else falls back to the
// textContent-keyed chip rects. Per-suite overrides (the
// word-document layouts push the trailing chips right of the own
// text) merge over the defaults.
const installSegmentRects = (
  overrides: {
    chips?: Record<string, SegmentRect>;
    landings?: Record<string, number>;
  } = {}
) =>
  vi
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: Element) {
      const landingId = (this as HTMLElement).dataset?.landing;
      if (landingId !== undefined) {
        const x = overrides.landings?.[landingId] ?? LANDING_X[landingId] ?? 0;
        // REAL-BROWSER GEOMETRY:
        // the landing anchors are zero-footprint spans (`width: 0;
        // height: 0`) — a real browser returns a TRUE 0x0 rect with
        // top === bottom at the text baseline, NOT a 24px-tall box.
        // The keyboard walk's reading order sorts by DOM order (not
        // geometry), but the collision distances depend on this
        // shape — these mocks must stay faithful to the real thing.
        return {
          left: x,
          right: x,
          top: 18,
          bottom: 18,
          width: 0,
          height: 0,
          x,
          y: 18,
        } as DOMRect;
      }
      const text = (this as HTMLElement).textContent ?? "";
      return {
        ...(overrides.chips?.[text] ?? SEGMENT_RECTS[text] ?? ZERO_RECT),
      } as DOMRect;
    });

const KEY_FOR_CODE: Record<string, string> = {
  Space: " ",
  Enter: "Enter",
  Escape: "Escape",
  ArrowRight: "ArrowRight",
  ArrowLeft: "ArrowLeft",
};

// Dispatches a keydown and lets the sensor's zero-delay listener
// attachment (setTimeout 0) flush before the next key.
const pressKey = async (target: Element | Document, code: string) => {
  await act(async () => {
    fireEvent.keyDown(target, { code, key: KEY_FOR_CODE[code] ?? code });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

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
      "alpha",
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

  it("renders the flow text exactly as the serialized document (WYSIWYG invariant)", () => {
    // 'b1' ends with a space: the old join produced a double space at
    // the chip-edge + separator seam. The spacing pass collapses that
    // seam to exactly one space (the separator survives as the
    // carried material), so the rendered flow and the model both read
    // the corrected single-space seam.
    renderWithProviders([
      ["text-1", [makeSnippet("a1", "Hello")]],
      ["text-2", [makeSnippet("b1", "brave ")]],
      ["text-1", [makeSnippet("a1", "Hello"), makeSnippet("a2", "world")]],
      ["text-2", [makeSnippet("b1", "brave "), makeSnippet("b2", "today")]],
    ]);
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      screen.getByTestId("document-probe").textContent,
    );
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      "Hello brave world today",
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

describe("PreviewArea sorting affordances", () => {
  it("discards the reorder when the dragged snippet vanished mid-drag or has no target", () => {
    const SeedUpdates = ({ updates }: { updates: Array<[string, Snippet[]]> }) => {
      const { setSourceSnippets } = useSnippets();
      useEffect(() => {
        updates.forEach(([sourceId, snippets]) =>
          setSourceSnippets(sourceId, snippets),
        );
      }, [updates, setSourceSnippets]);
      return null;
    };

    const { result } = renderHook(() => usePreviewArea(), {
      wrapper: ({ children }: { children?: React.ReactNode }) => (
        <I18nextProvider i18n={i18n}>
          <MuiThemeProvider theme={theme}>
            <StyledThemeProvider theme={theme}>
              <SnippetsProvider>
                <SeedUpdates updates={seedInterleaved()} />
                {children}
              </SnippetsProvider>
            </StyledThemeProvider>
          </MuiThemeProvider>
        </I18nextProvider>
      ),
    });
    expect(result.current.document.filter(isSnippetToken)).toHaveLength(3);

    // Dragged id no longer exists: the reorder is discarded.
    act(() => {
      result.current.handleDragEnd({
        active: { id: "text-1:ghost" },
        over: { id: "text-2:b1" },
      } as unknown as DragEndEvent);
    });
    // Released with no target: the reorder is discarded.
    act(() => {
      result.current.handleDragEnd({
        active: { id: "text-1:a1" },
        over: null,
      } as unknown as DragEndEvent);
    });
    // Released on the item's own position: the reorder is discarded.
    act(() => {
      result.current.handleDragEnd({
        active: { id: "text-1:a1" },
        over: { id: "text-1:a1" },
      } as unknown as DragEndEvent);
    });

    expect(
      result.current.document.filter(isSnippetToken).map((token) => token.tokenId),
    ).toEqual(["text-1:a1", "text-2:b1", "text-1:a2"]);
    expect(result.current.activeSnippet).toBeNull();
  });

  it("ships the five sorting keys in both en-US and pt-BR resources", () => {
    (Object.keys(SORTING_COPY) as Array<keyof typeof SORTING_COPY>).forEach((key) => {
      expect(enUS).toHaveProperty(
        `pages.mergeSession.previewArea.sorting.${key}`,
        SORTING_COPY[key]["en-US"],
      );
      expect(ptBR).toHaveProperty(
        `pages.mergeSession.previewArea.sorting.${key}`,
        SORTING_COPY[key]["pt-BR"],
      );
    });
  });

  it("exposes the hold-to-drag activation constant in one place", () => {
    expect(SNIPPET_DRAG_ACTIVATION).toEqual({ delay: 50, tolerance: 5 });
  });

  it("keys snippet tokens by composite token ids that stay unique across colliding snippet ids", () => {
    renderWithProviders([
      ["text-1", [makeSnippet("x1", "Hello")]],
      ["text-2", [makeSnippet("x1", "Alpha")]],
    ]);

    const segments = screen.getAllByTestId("preview-snippet");
    expect(segments.map((segment) => segment.dataset.tokenId)).toEqual([
      "text-1:x1",
      "text-2:x1",
    ]);
    expect(segments.map((segment) => segment.textContent)).toEqual([
      "Hello",
      "alpha",
    ]);
  });

  it("registers every segment as a focusable sortable item with instruction linkage", () => {
    renderWithProviders(seedInterleaved());

    const segments = screen.getAllByTestId("preview-snippet");
    expect(segments).toHaveLength(3);
    segments.forEach((segment) => {
      expect(segment).toHaveAttribute("role", "button");
      expect(segment).toHaveAttribute("tabindex", "0");
      expect(segment).toHaveAttribute("aria-roledescription", "sortable");
      const describedBy = segment.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy ?? "")).toHaveTextContent(
        SORTING_COPY.instructions["en-US"],
      );
    });
  });

  it("applies the drag affordance styles on every segment", () => {
    renderWithProviders(seedInterleaved());

    screen.getAllByTestId("preview-snippet").forEach((segment) => {
      expect(segment).toHaveStyle({ cursor: "grab" });
      expect(segment).toHaveStyle({ "user-select": "none" });
      expect(segment).toHaveStyle({ "touch-action": "none" });
    });
  });

  it("deepens the segment tint slightly on hover and ships no hover outline", () => {
    renderWithProviders([
      ["text-1", [makeSnippet("a1", "Hello", "#0080FF")]],
      ["text-2", [makeSnippet("b1", "Alpha", "#FF1493")]],
    ]);

    const css = Array.from(document.querySelectorAll("style"))
      .map((style) => style.textContent)
      .join("");
    expect(css).toContain("background-color:rgba(0, 128, 255, 0.4)");
    expect(css).toContain("background-color:rgba(255, 20, 147, 0.4)");
    expect(css).not.toContain("outline:1px solid");
  });

  it("mounts no drag wiring while the preview is empty", () => {
    renderWithProviders([]);
    expect(screen.getByTestId("preview-empty")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("updates the linked instructions when the language changes", async () => {
    renderWithProviders(seedInterleaved());
    const segment = screen.getAllByTestId("preview-snippet")[0];

    await act(async () => {
      await i18n.changeLanguage("pt");
    });

    expect(
      document.getElementById(segment.getAttribute("aria-describedby") ?? ""),
    ).toHaveTextContent(SORTING_COPY.instructions["pt-BR"]);

    await act(async () => {
      await i18n.changeLanguage("en-US");
    });

    expect(
      document.getElementById(segment.getAttribute("aria-describedby") ?? ""),
    ).toHaveTextContent(SORTING_COPY.instructions["en-US"]);
  });
});

describe("PreviewArea keyboard sorting", () => {
  beforeEach(() => {
    installSegmentRects();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reorders with Space pickup, arrow move, and Space drop", async () => {
    renderWithProviders(seedInterleaved());
    const [alpha] = screen.getAllByTestId("preview-snippet");
    alpha.focus();

    await pressKey(alpha, "Space");
    expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();
    expect(alpha).toHaveStyle({ opacity: "0.4" });

    // the arrows step through EVERY landing position —
    // from Alpha: the separator's two edge anchors, then the Beta
    // chip itself (the drop target of the old one-arrow test).
    await pressKey(document, "ArrowRight");
    await pressKey(document, "ArrowRight");
    await pressKey(document, "ArrowRight");
    await pressKey(document, "Space");

    const segments = screen.getAllByTestId("preview-snippet");
    expect(segments.map((segment) => segment.textContent)).toEqual([
      "Beta",
      "alpha",
      "gamma",
    ]);
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      "Beta alpha gamma",
    );
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      screen.getByTestId("document-probe").textContent,
    );
    expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
  });

  it("cancels with Escape leaving the merge order unchanged", async () => {
    renderWithProviders(seedInterleaved());
    const [alpha] = screen.getAllByTestId("preview-snippet");
    alpha.focus();

    await pressKey(alpha, "Space");
    await pressKey(document, "ArrowRight");
    await pressKey(document, "Escape");

    expect(screen.getAllByTestId("preview-snippet").map((s) => s.textContent)).toEqual([
      "Alpha",
      "beta",
      "gamma",
    ]);
    expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
  });

  it("keeps a single snippet draggable but inert", async () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Only")]]]);
    const [only] = screen.getAllByTestId("preview-snippet");
    only.focus();

    await pressKey(only, "Space");
    expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();
    await pressKey(document, "Space");

    expect(screen.getAllByTestId("preview-snippet")).toHaveLength(1);
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe("Only");
  });

  it("announces the keyboard drag lifecycle in the live region", async () => {
    renderWithProviders(seedInterleaved());
    const [alpha] = screen.getAllByTestId("preview-snippet");
    alpha.focus();

    await pressKey(alpha, "Space");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Picked up snippet 1 of 3.",
    );

    // stepping onto the Beta chip takes three hops —
    // the arrows walk through the separator's edge anchors first.
    await pressKey(document, "ArrowRight");
    await pressKey(document, "ArrowRight");
    await pressKey(document, "ArrowRight");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Snippet is now over position 2 of 3.",
    );

    await pressKey(document, "Space");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Snippet dropped at position 2 of 3.",
    );
  });

  it("announces cancellation in the live region", async () => {
    renderWithProviders(seedInterleaved());
    const [alpha] = screen.getAllByTestId("preview-snippet");
    alpha.focus();

    await pressKey(alpha, "Space");
    await pressKey(document, "Escape");

    expect(screen.getByRole("status")).toHaveTextContent(
      "Snippet reorder cancelled.",
    );
  });

  it("follows the active language for announcements", async () => {
    await act(async () => {
      await i18n.changeLanguage("pt");
    });
    renderWithProviders(seedInterleaved());
    const [alpha] = screen.getAllByTestId("preview-snippet");
    alpha.focus();

    await pressKey(alpha, "Space");
    expect(screen.getByRole("status")).toHaveTextContent("Trecho 1 de 3 pego.");

    await pressKey(document, "Escape");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reordenação do trecho cancelada.",
    );
  });
});

describe("PreviewArea pointer sorting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installSegmentRects();
  });

  afterEach(() => {
    // dnd-kit removes its document-level click-suppression listener
    // (capture-phase stopPropagation, attached once the activation
    // constraint is met) via a 50ms setTimeout on drag end: drain the
    // fake clock first, or vi.useRealTimers() discards the pending
    // removal and every later fireEvent.click in the file is
    // silently swallowed.
    act(() => {
      vi.advanceTimersByTime(60);
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const pointerDownOn = (element: Element, x = 40, y = 10) =>
    fireEvent.pointerDown(element, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
    });

  it("starts the drag only after a 50ms hold and reorders on release", async () => {
    renderWithProviders(seedInterleaved());
    const [alpha] = screen.getAllByTestId("preview-snippet");

    pointerDownOn(alpha);
    act(() => {
      vi.advanceTimersByTime(25);
    });
    expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(25);
    });
    const overlay = screen.getByTestId("preview-snippet-overlay");
    expect(overlay).toHaveTextContent("Alpha");
    expect(overlay).toHaveStyle({ cursor: "grabbing" });
    expect(overlay).toHaveStyle({
      backgroundColor: "rgba(0, 128, 255, 0.3)",
    });
    expect(alpha).toHaveStyle({ opacity: "0.4" });

    fireEvent.pointerMove(document, { pointerId: 1, clientX: 160, clientY: 10 });
    const [, beta] = screen.getAllByTestId("preview-snippet");
    expect(beta.style.transform).toContain("translate");

    fireEvent.pointerUp(document, { pointerId: 1 });
    await act(async () => {});

    expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Snippet dropped at position 2 of 3.",
    );
    expect(
      screen.getAllByTestId("preview-snippet").map((s) => s.textContent),
    ).toEqual(["Beta", "alpha", "gamma"]);
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      "Beta alpha gamma",
    );
  });

  it("never starts a drag when the pointer is released before the delay", () => {
    renderWithProviders(seedInterleaved());
    const [alpha] = screen.getAllByTestId("preview-snippet");

    pointerDownOn(alpha);
    act(() => {
      vi.advanceTimersByTime(25);
    });
    fireEvent.pointerUp(document, { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(75);
    });

    expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      "Alpha beta gamma",
    );
  });

  it("cancels activation when the pointer moves beyond the tolerance during the hold", () => {
    renderWithProviders(seedInterleaved());
    const [alpha] = screen.getAllByTestId("preview-snippet");

    pointerDownOn(alpha, 40, 10);
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 70, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.pointerUp(document, { pointerId: 1 });

    expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      "Alpha beta gamma",
    );
  });

  it("leaves the order unchanged when released on the item's own position", async () => {
    renderWithProviders(seedInterleaved());
    const [alpha] = screen.getAllByTestId("preview-snippet");

    pointerDownOn(alpha);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.pointerUp(document, { pointerId: 1 });
    await act(async () => {});

    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      "Alpha beta gamma",
    );
    expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
  });

  it("cancels an activated drag with Escape", async () => {
    renderWithProviders(seedInterleaved());
    const [alpha] = screen.getAllByTestId("preview-snippet");

    pointerDownOn(alpha);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();

    fireEvent.keyDown(document, { code: "Escape", key: "Escape" });
    await act(async () => {});

    expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      "Alpha beta gamma",
    );
  });

  it("keeps a single snippet draggable but inert", async () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Only")]]]);
    const [only] = screen.getAllByTestId("preview-snippet");

    pointerDownOn(only);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();

    fireEvent.pointerMove(document, { pointerId: 1, clientX: 500, clientY: 10 });
    fireEvent.pointerUp(document, { pointerId: 1 });
    await act(async () => {});

    expect(screen.getAllByTestId("preview-snippet")).toHaveLength(1);
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe("Only");
  });
});

describe("PreviewArea drop indicator", () => {
  // ---- pure landing helpers -------------------------------------

  it("compares landings structurally for the needle match", () => {
    expect(
      sameLanding(
        { kind: "token-gap", tokenIndex: 2 },
        { kind: "token-gap", tokenIndex: 2 },
      ),
    ).toBe(true);
    expect(
      sameLanding(
        { kind: "text-split", tokenIndex: 2, boundaryOffset: 4 },
        { kind: "text-split", tokenIndex: 2, boundaryOffset: 4 },
      ),
    ).toBe(true);
    expect(
      sameLanding(
        { kind: "token-gap", tokenIndex: 2 },
        { kind: "text-split", tokenIndex: 2, boundaryOffset: 0 },
      ),
    ).toBe(false);
    expect(
      sameLanding(
        { kind: "token-gap", tokenIndex: 2 },
        { kind: "token-gap", tokenIndex: 3 },
      ),
    ).toBe(false);
    expect(
      sameLanding(
        { kind: "text-split", tokenIndex: 2, boundaryOffset: 4 },
        { kind: "text-split", tokenIndex: 2, boundaryOffset: 5 },
      ),
    ).toBe(false);
    expect(sameLanding(null, null)).toBe(true);
    expect(
      sameLanding({ kind: "token-gap", tokenIndex: 1 }, null),
    ).toBe(false);
  });

  it("announces the position the landing move actually produces (reducer agreement)", () => {
    const handChip = (tokenId: string, text: string): PreviewToken => ({
      kind: "snippet",
      tokenId,
      sourceSnippetId: tokenId.split(":")[1] ?? tokenId,
      sourceId: tokenId.split(":")[0] ?? tokenId,
      color: "#0080FF",
      text,
      edited: true,
    });
    const handText = (tokenId: string, text: string): PreviewToken => ({
      kind: "text",
      tokenId,
      text,
    });
    let unedited = initialSnippetsState;
    unedited = snippetsReducer(unedited, {
      type: "SET_SOURCE_SNIPPETS",
      sourceId: "text-1",
      snippets: [
        makeSnippet("a1", "Alpha"),
        makeSnippet("a2", "Beta"),
        makeSnippet("a3", "Gamma"),
      ],
    });
    const edited: typeof initialSnippetsState = {
      ...initialSnippetsState,
      tokens: [
        handChip("text-1:a1", "Alpha"),
        handText("t1", " "),
        handText("t2", "one two"),
        handText("t3", " "),
        handChip("text-2:b1", "Beta"),
      ],
    };
    for (const [label, state] of [
      ["unedited", unedited],
      ["edited", edited],
    ] as const) {
      for (let from = 0; from < state.tokens.length; from += 1) {
        if (!isSnippetToken(state.tokens[from])) continue;
        const movedId = state.tokens[from].tokenId;
        for (const { landing } of enumerateLandingAnchors(state.tokens)) {
          const tag = `${label} from=${from} landing=${JSON.stringify(landing)}`;
          const next = snippetsReducer(state, {
            type: "MOVE_TOKEN_TO_LANDING",
            fromIndex: from,
            landing,
          });
          const order = next.tokens
            .filter(isSnippetToken)
            .map((token) => token.tokenId);
          expect(landingSnippetPosition(state.tokens, from, landing), tag).toBe(
            order.indexOf(movedId) + 1,
          );
        }
      }
    }
  });

  // ---- resources / empty state -------------------------------------------

  it("ships zero new i18n keys: the sorting copy stays exactly the five sorting keys", () => {
    const sortingKeys = (resource: object) =>
      Object.keys(resource)
        .filter((key) =>
          key.startsWith("pages.mergeSession.previewArea.sorting."),
        )
        .sort();

    expect(sortingKeys(enUS)).toEqual([
      "pages.mergeSession.previewArea.sorting.cancelled",
      "pages.mergeSession.previewArea.sorting.ended",
      "pages.mergeSession.previewArea.sorting.instructions",
      "pages.mergeSession.previewArea.sorting.over",
      "pages.mergeSession.previewArea.sorting.started",
    ]);
    expect(sortingKeys(ptBR)).toEqual(sortingKeys(enUS));
    expect(
      Object.keys(enUS).some((key) => /drop|indicator/i.test(key)) ||
        Object.keys(ptBR).some((key) => /drop|indicator/i.test(key)),
    ).toBe(false);
  });

  it("never renders the needle while the preview is empty", () => {
    renderWithProviders([]);
    expect(screen.getByTestId("preview-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  // ---- keyboard drags (same onDragOver path as pointer drags) -------------

  describe("keyboard drags", () => {
    beforeEach(() => {
      installSegmentRects();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("shows the needle at the origin landing on pickup and hops through every landing position with the arrow keys", async () => {
      renderWithProviders(seedInterleaved());
      const [alpha] = screen.getAllByTestId("preview-snippet");
      alpha.focus();

      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();

      // The needle renders right after its landing anchor — the
      // anchor's data-landing identifies the marked position.
      const needleLanding = () =>
        (screen.getByTestId("preview-drop-indicator")
          .previousSibling as HTMLElement).dataset.landing;

      await pressKey(alpha, "Space");
      // Pickup: the origin spot — the anchor before Alpha (the flow
      // start).
      expect(needleLanding()).toBe("preview-landing:g:0");

      // the arrows walk EVERY landing position in reading
      // order — the separator's two edge anchors, then the Beta chip.
      await pressKey(document, "ArrowRight");
      expect(needleLanding()).toBe("preview-landing:s:1:0");
      await pressKey(document, "ArrowRight");
      expect(needleLanding()).toBe("preview-landing:s:1:1");
      await pressKey(document, "ArrowRight");
      // Over Beta: the needle marks the insertion after it (the
      // anchor right after Beta, before the separator that precedes
      // Gamma).
      expect(needleLanding()).toBe("preview-landing:s:3:0");

      // Back through the same positions to the origin.
      await pressKey(document, "ArrowLeft");
      expect(needleLanding()).toBe("preview-landing:s:1:1");
      await pressKey(document, "ArrowLeft");
      expect(needleLanding()).toBe("preview-landing:s:1:0");
      await pressKey(document, "ArrowLeft");
      expect(needleLanding()).toBe("preview-landing:g:0");

      await pressKey(document, "Escape");
      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();
      expect(
        screen.getAllByTestId("preview-snippet").map((s) => s.textContent),
      ).toEqual(["Alpha", "beta", "gamma"]);
    });

    it("renders the identical needle slot for the same (active, over) pair from keyboard and pointer", async () => {
      const keyboardRender = renderWithProviders(seedInterleaved());
      const [alpha, beta, gamma] = screen.getAllByTestId("preview-snippet");
      const slotSignature = (needle: Element) =>
        [
          !!(
            beta.compareDocumentPosition(needle) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
          !!(
            needle.compareDocumentPosition(gamma) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
        ].join(":");

      // Keyboard: Alpha picked up, moved over Beta → after Beta, before
      // Gamma. reaching the Beta chip takes three hops —
      // the arrows walk through the separator's edge anchors first.
      alpha.focus();
      await pressKey(alpha, "Space");
      await pressKey(document, "ArrowRight");
      await pressKey(document, "ArrowRight");
      await pressKey(document, "ArrowRight");
      expect(
        slotSignature(screen.getByTestId("preview-drop-indicator")),
      ).toBe("true:true");
      await pressKey(document, "Escape");
      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();
      keyboardRender.unmount();

      // Pointer: the same (active, over) pair must render the needle in
      // the identical DOM position.
      renderWithProviders(seedInterleaved());
      const [dragged] = screen.getAllByTestId("preview-snippet");
      fireEvent.pointerDown(dragged, {
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX: 40,
        clientY: 10,
      });
      await act(async () => {
        // Real timers: hold past the 50ms activation delay.
        await new Promise((resolve) => setTimeout(resolve, 60));
      });
      fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 160,
        clientY: 10,
      });
      expect(
        slotSignature(screen.getByTestId("preview-drop-indicator")),
      ).toBe("true:true");

      fireEvent.pointerUp(document, { pointerId: 1 });
      await act(async () => {});
      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();
    });

    it("renders as an inline element of the flow and preserves text parity while visible", async () => {
      const long =
        "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore";
      const second = `${long} two`;
      // jsdom computes no layout: give the two wrap-capable snippets
      // distinct rects so the pickup collision resolves to the dragged
      // chip itself. Replaces the describe-level mock for this test.
      vi.restoreAllMocks();
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
        function (this: Element) {
          const text = (this as HTMLElement).textContent ?? "";
          // The case-fix pass lowercases the mid-sentence chip, so the
          // rect lookup matches either casing.
          const folded = text.toLocaleLowerCase("en-US");
          if (folded === long.toLocaleLowerCase("en-US")) {
            return {
              ...ZERO_RECT,
              left: 0,
              top: 0,
              right: 100,
              bottom: 24,
              width: 100,
              height: 24,
              x: 0,
              y: 0,
            } as DOMRect;
          }
          if (folded === second.toLocaleLowerCase("en-US")) {
            return {
              ...ZERO_RECT,
              left: 120,
              top: 0,
              right: 220,
              bottom: 24,
              width: 100,
              height: 24,
              x: 120,
              y: 0,
            } as DOMRect;
          }
          return { ...ZERO_RECT } as DOMRect;
        },
      );

      renderWithProviders([
        ["text-1", [makeSnippet("a1", long), makeSnippet("a2", second)]],
      ]);
      const [first, secondChip] = screen.getAllByTestId("preview-snippet");
      secondChip.focus();

      await pressKey(secondChip, "Space");
      const needle = screen.getByTestId("preview-drop-indicator");
      const flow = screen.getByTestId("preview-segment-flow");

      // Inline element of the SegmentFlow: in-flow (not coordinate-
      // positioned against the container), wrapping with the text.
      expect(needle.tagName).toBe("SPAN");
      expect(needle.parentElement).toBe(flow);
      expect(needle).toHaveStyle({ display: "inline-block" });
      expect(needle).toHaveStyle({ position: "relative" });
      // The origin slot of the second snippet sits between the two.
      expect(
        first.compareDocumentPosition(needle) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        needle.compareDocumentPosition(secondChip) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      // No text: the merged-text parity holds while the needle renders.
      expect(needle.textContent).toBe("");
      // The second chip renders lowercase-first (mid-sentence).
      expect(flow.textContent).toBe(`${long} l${second.slice(1)}`);
      expect(flow.textContent).toBe(
        screen.getByTestId("document-probe").textContent,
      );

      await pressKey(document, "Escape");
      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();
    });

    it("keeps the needle at the origin slot during a single-snippet inert drag", async () => {
      renderWithProviders([["text-1", [makeSnippet("a1", "Only")]]]);
      const [only] = screen.getAllByTestId("preview-snippet");
      only.focus();

      await pressKey(only, "Space");
      const needle = screen.getByTestId("preview-drop-indicator");
      expect(
        needle.compareDocumentPosition(only) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      // Nothing to move over: the drag is inert and the needle can only
      // ever sit at the origin slot.
      await pressKey(document, "ArrowRight");
      await pressKey(document, "ArrowLeft");
      const still = screen.getByTestId("preview-drop-indicator");
      expect(
        still.compareDocumentPosition(only) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      await pressKey(document, "Space");
      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();
      expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
        "Only",
      );
    });

    it("mirrors the TextInput needle shape in the neutral theme color and stays decorative", async () => {
      renderWithProviders(seedInterleaved());
      const [alpha] = screen.getAllByTestId("preview-snippet");
      alpha.focus();

      await pressKey(alpha, "Space");
      const needle = screen.getByTestId("preview-drop-indicator");

      // Decorative and inert: hidden from assistive tech, not focusable,
      // no sortable semantics, no pointer affordance.
      expect(needle).toHaveAttribute("aria-hidden", "true");
      expect(needle).not.toHaveAttribute("role");
      expect(needle).not.toHaveAttribute("tabindex");
      expect(needle).not.toHaveAttribute("aria-roledescription");
      expect(needle).not.toHaveAttribute("aria-describedby");
      expect(needle).toHaveStyle({ pointerEvents: "none" });

      // Zero-width, zero-height inline anchor: no flow footprint, so
      // dnd-kit's measured sortable rects stay untouched mid-drag.
      expect(needle).toHaveStyle({ width: "0px" });
      expect(needle).toHaveStyle({ height: "0px" });

      // The bar: TextInput-needle shape language (4px × 1.5em, 2px
      // radius) in the theme's neutral text.secondary — never a snippet
      // color, never the primary accent.
      const bar = needle.firstElementChild;
      expect(bar).not.toBeNull();
      expect(bar).toHaveStyle({ position: "absolute" });
      expect(bar).toHaveStyle({ width: "4px" });
      // jsdom resolves 1.5em against the default 16px root font.
      expect(bar).toHaveStyle({ height: "24px" });
      expect(bar).toHaveStyle({ borderRadius: "2px" });
      expect(bar).toHaveStyle({
        backgroundColor: theme.palette.text.secondary,
      });
      expect(bar).not.toHaveStyle({
        backgroundColor: theme.palette.primary.main,
      });
      expect(bar).not.toHaveStyle({
        backgroundColor: "rgba(0, 128, 255, 0.3)",
      });

      // The shape dimensions ship in em/px exactly as specified.
      const css = Array.from(document.querySelectorAll("style"))
        .map((style) => style.textContent)
        .join("");
      const barClass = (bar as Element).className
        .split(" ")
        .find((cls) => css.includes(`.${cls}{`));
      expect(barClass).toBeTruthy();
      const barRule = css.slice(css.indexOf(`.${barClass}{`));
      expect(barRule).toContain("width:4px");
      expect(barRule).toContain("height:1.5em");
      expect(barRule).toContain("border-radius:2px");
      expect(barRule).toContain(
        `background-color:${theme.palette.text.secondary}`,
      );

      // Instant appear/disappear: no animation.
      const barStyles = window.getComputedStyle(bar as Element);
      expect(barStyles.animationName).toBe("none");
      expect(barStyles.transitionDuration).toBe("0s");
    });
  });

  // ---- pointer drags --------------------------------------------------------

  describe("pointer drags", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      installSegmentRects();
    });

    afterEach(() => {
      // Same drain as the pointer-sorting suite: dnd-kit's delayed
      // document-listener removal must fire before the fake clock is
      // discarded, or later clicks in the file stop propagating.
      act(() => {
        vi.advanceTimersByTime(60);
      });
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    const pointerDownOn = (element: Element, x = 40, y = 10) =>
      fireEvent.pointerDown(element, {
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: y,
      });

    it("shows the needle only while the drag is active and removes it on drop", async () => {
      renderWithProviders(seedInterleaved());
      const [alpha, beta, gamma] = screen.getAllByTestId("preview-snippet");

      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();

      pointerDownOn(alpha);
      act(() => {
        vi.advanceTimersByTime(25);
      });
      // Below the hold delay: no drag, no needle.
      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();

      act(() => {
        vi.advanceTimersByTime(25);
      });
      const needle = screen.getByTestId("preview-drop-indicator");
      // Pickup: the origin slot precedes the dragged chip itself.
      expect(
        needle.compareDocumentPosition(alpha) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      // The needle complements the drag feedback: the overlay chip
      // still renders and the origin still dims.
      expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();
      expect(alpha).toHaveStyle({ opacity: "0.4" });

      // Move over Beta (forward): the needle lands after it, before Gamma.
      fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 160,
        clientY: 10,
      });
      const hopped = screen.getByTestId("preview-drop-indicator");
      expect(
        beta.compareDocumentPosition(hopped) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        hopped.compareDocumentPosition(gamma) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      // Siblings still shift to make room while the needle is visible.
      expect(beta.style.transform).toContain("translate");

      fireEvent.pointerUp(document, { pointerId: 1 });
      await act(async () => {});

      // Removed together with the overlay chip in the same lifecycle step.
      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();
      expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
      // The drop landed exactly at the slot the needle marked (slot 2).
      expect(
        screen.getAllByTestId("preview-snippet").map((s) => s.textContent),
      ).toEqual(["Beta", "alpha", "gamma"]);
    });

    it("removes the needle together with the overlay chip when Escape cancels the drag", async () => {
      renderWithProviders(seedInterleaved());
      const [alpha] = screen.getAllByTestId("preview-snippet");

      pointerDownOn(alpha);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(screen.getByTestId("preview-drop-indicator")).toBeInTheDocument();

      fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 160,
        clientY: 10,
      });
      expect(screen.getByTestId("preview-drop-indicator")).toBeInTheDocument();

      fireEvent.keyDown(document, { code: "Escape", key: "Escape" });
      await act(async () => {});

      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();
      expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
      expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
        "Alpha beta gamma",
      );
    });

    it("renders the needle before the hovered snippet when moving backward", async () => {
      renderWithProviders(seedInterleaved());
      const [, beta, gamma] = screen.getAllByTestId("preview-snippet");

      pointerDownOn(gamma, 290, 10);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      const origin = screen.getByTestId("preview-drop-indicator");
      expect(
        origin.compareDocumentPosition(gamma) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 160,
        clientY: 10,
      });
      const needle = screen.getByTestId("preview-drop-indicator");
      // Backward over Beta: the needle precedes it.
      expect(
        needle.compareDocumentPosition(beta) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      fireEvent.pointerUp(document, { pointerId: 1 });
      await act(async () => {});

      // moveSnippet(2, 1): Gamma lands exactly at the slot marked.
      expect(
        screen.getAllByTestId("preview-snippet").map((s) => s.textContent),
      ).toEqual(["Alpha", "gamma", "beta"]);
      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();
    });

    it("renders the needle after the last snippet when moving forward past it", async () => {
      renderWithProviders(seedInterleaved());
      const [alpha, , gamma] = screen.getAllByTestId("preview-snippet");

      pointerDownOn(alpha);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 290,
        clientY: 10,
      });

      const needle = screen.getByTestId("preview-drop-indicator");
      // Forward past the last snippet: the trailing slot follows it.
      expect(
        gamma.compareDocumentPosition(needle) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      // The needle renders no text: the merged-text parity holds mid-drag.
      expect(needle.textContent).toBe("");
      expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
        "Alpha beta gamma",
      );

      fireEvent.pointerUp(document, { pointerId: 1 });
      await act(async () => {});

      // moveSnippet(0, 2): Alpha lands at the trailing slot it marked.
      expect(
        screen.getAllByTestId("preview-snippet").map((s) => s.textContent),
      ).toEqual(["Beta", "gamma", "alpha"]);
      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();
    });

    it("marks the gap between two snippets and lands the chip exactly there", async () => {
      renderWithProviders(seedInterleaved());
      const [alpha, beta, gamma] = screen.getAllByTestId("preview-snippet");

      pointerDownOn(gamma, 290, 10);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(screen.getByTestId("preview-drop-indicator")).toBeInTheDocument();

      // Into the space between Alpha and Beta (gap slot 1): the needle
      // renders exactly there — after Alpha, before Beta.
      fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 110,
        clientY: 10,
      });
      const needle = screen.getByTestId("preview-drop-indicator");
      expect(
        alpha.compareDocumentPosition(needle) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        needle.compareDocumentPosition(beta) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      fireEvent.pointerUp(document, { pointerId: 1 });
      await act(async () => {});

      // moveSnippet(2, computeGapMoveIndex(2, 1) = 1): Gamma lands at
      // the slot the needle marked.
      expect(
        screen.getAllByTestId("preview-snippet").map((s) => s.textContent),
      ).toEqual(["Alpha", "gamma", "beta"]);
      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();
    });

    it("marks the leading gap before the first snippet", async () => {
      renderWithProviders(seedInterleaved());
      const [alpha, beta] = screen.getAllByTestId("preview-snippet");

      pointerDownOn(beta, 170, 10);
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Into the leading gap (slot 0, before Alpha).
      fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: -4,
        clientY: 10,
      });
      const needle = screen.getByTestId("preview-drop-indicator");
      expect(
        needle.compareDocumentPosition(alpha) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      fireEvent.pointerUp(document, { pointerId: 1 });
      await act(async () => {});

      // moveSnippet(1, computeGapMoveIndex(1, 0) = 0): Beta lands at
      // the leading slot marked.
      expect(
        screen.getAllByTestId("preview-snippet").map((s) => s.textContent),
      ).toEqual(["Beta", "alpha", "gamma"]);
    });

    it("marks the trailing gap after the last snippet and announces the landing", async () => {
      renderWithProviders(seedInterleaved());
      const [alpha] = screen.getAllByTestId("preview-snippet");

      pointerDownOn(alpha);
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Into the trailing gap (slot 3, after Gamma).
      fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 344,
        clientY: 10,
      });
      const needle = screen.getByTestId("preview-drop-indicator");
      const [, , gamma] = screen.getAllByTestId("preview-snippet");
      expect(
        gamma.compareDocumentPosition(needle) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      fireEvent.pointerUp(document, { pointerId: 1 });
      await act(async () => {});

      // moveSnippet(0, computeGapMoveIndex(0, 3) = 2): Alpha lands at
      // the trailing slot, and the gap drop announces the landing
      // position with the existing ended key — no new strings.
      expect(
        screen.getAllByTestId("preview-snippet").map((s) => s.textContent),
      ).toEqual(["Beta", "gamma", "alpha"]);
      expect(screen.getByRole("status")).toHaveTextContent(
        "Snippet dropped at position 3 of 3.",
      );
    });

    it("treats the gaps around the dragged chip's own position as a no-op", async () => {
      renderWithProviders(seedInterleaved());
      const [alpha] = screen.getAllByTestId("preview-snippet");

      pointerDownOn(alpha);
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // The gap right after the dragged chip (slot 1 == from + 1):
      // the chip already sits between the same neighbors.
      fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 110,
        clientY: 10,
      });
      const needle = screen.getByTestId("preview-drop-indicator");
      const [, beta] = screen.getAllByTestId("preview-snippet");
      expect(
        needle.compareDocumentPosition(beta) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      fireEvent.pointerUp(document, { pointerId: 1 });
      await act(async () => {});

      // moveSnippet(0, computeGapMoveIndex(0, 1) = 0): same index —
      // the reducer's no-op guard keeps the order.
      expect(
        screen.getAllByTestId("preview-snippet").map((s) => s.textContent),
      ).toEqual(["Alpha", "beta", "gamma"]);
    });
  });

  // ---- hook-level lifecycle (vanish / no target / stability) --------------

  it("hides the needle when the active or hovered snippet vanishes mid-drag and discards the reorder", () => {
    const SeedUpdates = ({ updates }: { updates: Array<[string, Snippet[]]> }) => {
      const { setSourceSnippets } = useSnippets();
      useEffect(() => {
        updates.forEach(([sourceId, snippets]) =>
          setSourceSnippets(sourceId, snippets),
        );
      }, [updates, setSourceSnippets]);
      return null;
    };

    const { result } = renderHook(() => usePreviewArea(), {
      wrapper: ({ children }: { children?: React.ReactNode }) => (
        <I18nextProvider i18n={i18n}>
          <MuiThemeProvider theme={theme}>
            <StyledThemeProvider theme={theme}>
              <SnippetsProvider>
                <SeedUpdates updates={seedInterleaved()} />
                {children}
              </SnippetsProvider>
            </StyledThemeProvider>
          </MuiThemeProvider>
        </I18nextProvider>
      ),
    });
    expect(result.current.document.filter(isSnippetToken)).toHaveLength(3);

    // A vanished active id hides the needle from the start.
    act(() => {
      result.current.handleDragStart({
        active: { id: "text-1:ghost" },
      } as unknown as DragStartEvent);
    });
    expect(result.current.dropLanding).toBeNull();

    // Pickup: the needle starts at the origin spot — the anchor
    // covering "before Alpha" (the document start).
    act(() => {
      result.current.handleDragStart({
        active: { id: "text-1:a1" },
      } as unknown as DragStartEvent);
    });
    expect(result.current.dropLanding).toEqual({
      kind: "token-gap",
      tokenIndex: 0,
    });
    expect(result.current.activeSnippet?.tokenId).toBe("text-1:a1");

    // Over Beta moving forward: the needle marks the anchor covering
    // "right after Beta" — the following separator's leading edge —
    // stable across repeated events.
    act(() => {
      result.current.handleDragOver({
        active: { id: "text-1:a1" },
        over: { id: "text-2:b1" },
      } as unknown as DragOverEvent);
    });
    expect(result.current.dropLanding).toEqual({
      kind: "text-split",
      tokenIndex: 3,
      boundaryOffset: 0,
    });
    act(() => {
      result.current.handleDragOver({
        active: { id: "text-1:a1" },
        over: { id: "text-2:b1" },
      } as unknown as DragOverEvent);
    });
    expect(result.current.dropLanding).toEqual({
      kind: "text-split",
      tokenIndex: 3,
      boundaryOffset: 0,
    });

    // The hovered snippet vanished mid-drag: hide, no crash.
    act(() => {
      result.current.handleDragOver({
        active: { id: "text-1:a1" },
        over: { id: "text-2:ghost" },
      } as unknown as DragOverEvent);
    });
    expect(result.current.dropLanding).toBeNull();

    // No target resolves: hidden (a no-target drop is a cancel today).
    act(() => {
      result.current.handleDragOver({
        active: { id: "text-1:a1" },
        over: null,
      } as unknown as DragOverEvent);
    });
    expect(result.current.dropLanding).toBeNull();

    // Over a landing anchor: the needle marks exactly that word
    // boundary / token gap.
    act(() => {
      result.current.handleDragOver({
        active: { id: "text-1:a1" },
        over: { id: "preview-landing:s:1:1" },
      } as unknown as DragOverEvent);
    });
    expect(result.current.dropLanding).toEqual({
      kind: "text-split",
      tokenIndex: 1,
      boundaryOffset: 1,
    });

    // A stale landing id (the list shrank mid-drag) hides the needle…
    act(() => {
      result.current.handleDragOver({
        active: { id: "text-1:a1" },
        over: { id: "preview-landing:s:9:9" },
      } as unknown as DragOverEvent);
    });
    expect(result.current.dropLanding).toBeNull();

    // …and its drop is discarded without crashing.
    act(() => {
      result.current.handleDragEnd({
        active: { id: "text-1:a1" },
        over: { id: "preview-landing:s:9:9" },
      } as unknown as DragEndEvent);
    });
    expect(result.current.dropLanding).toBeNull();
    expect(
      result.current.document.filter(isSnippetToken).map((token) => token.tokenId),
    ).toEqual(["text-1:a1", "text-2:b1", "text-1:a2"]);

    // Drag end clears the needle together with the overlay state and
    // keeps the discard path (order unchanged).
    act(() => {
      result.current.handleDragEnd({
        active: { id: "text-1:a1" },
        over: null,
      } as unknown as DragEndEvent);
    });
    expect(result.current.dropLanding).toBeNull();
    expect(result.current.activeSnippet).toBeNull();
    expect(
      result.current.document.filter(isSnippetToken).map((token) => token.tokenId),
    ).toEqual(["text-1:a1", "text-2:b1", "text-1:a2"]);
  });
});

// ---------------------------------------------------------------------------
// Editable preview text: the editable surface, the
// gating matrix, editing workflows, and the click-vs-drag contract on
// the editable surface. Typing is simulated the way jsdom allows
// (direct DOM mutation + a dispatched input event) — the parser,
// reducer, and serializer suites carry the per-keystroke contract;
// caret feel stays a manual dev-server item (spec's flagged fallback).
// ---------------------------------------------------------------------------

const enableEditing = () =>
  fireEvent.click(screen.getByTestId("preview-edit-toggle"));

// Simulates the browser's caret typing: a new text node lands inside
// the editing host, then the input event fires. Returns the created
// node so tests can assert React never reconciled it away.
const typeIntoFlow = (flow: HTMLElement, text: string) => {
  const typedNode = document.createTextNode(text);
  flow.appendChild(typedNode);
  fireEvent.input(flow);
  return typedNode;
};

const collapseSelectionAtEnd = (root: HTMLElement): boolean => {
  const view = root.ownerDocument.defaultView;
  if (!view || typeof view.getSelection !== "function") {
    return false;
  }
  const selection = view.getSelection();
  if (!selection || typeof selection.addRange !== "function") {
    return false;
  }
  const range = root.ownerDocument.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
};

describe("PreviewArea editable surface", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en-US");
  });

  it("renders no editing attributes while edit mode is OFF (today's flow)", () => {
    renderWithProviders(seedInterleaved());
    const flow = screen.getByTestId("preview-segment-flow");
    expect(flow).not.toHaveAttribute("contenteditable");
    expect(flow).not.toHaveAttribute("aria-multiline");
    expect(flow).not.toHaveAttribute("aria-label");
    expect(flow).not.toHaveAttribute("data-placeholder");
  });

  it("turns the flow into a labelled multiline editable host when edit is ON", () => {
    renderWithProviders(seedInterleaved());
    enableEditing();

    const flow = screen.getByTestId("preview-segment-flow");
    expect(flow).toHaveAttribute("contenteditable", "true");
    expect(flow).toHaveAttribute("aria-multiline", "true");
    expect(flow).toHaveAttribute("aria-label", "Merged text editor");
    expect(flow).toHaveAttribute(
      "data-placeholder",
      "Type here to add your own text",
    );
    // The implicit textbox role comes from contentEditable itself.
    expect(flow.getAttribute("role")).toBeNull();
    // while editing, chips are
    // PLAIN SPANS of the editor — no focus/a11y attributes, no tab
    // stop, no button role (the Ctrl+Space-from-caret entry replaces
    // the focused-chip pickup; the keyboard activator listener stays
    // attached as its mechanism). Edit OFF keeps the full semantics
    // (asserted by the sorting-affordances suite).
    const chip = screen.getAllByTestId("preview-snippet")[0];
    expect(chip.getAttribute("role")).toBeNull();
    expect(chip.getAttribute("tabindex")).toBeNull();
    expect(chip.getAttribute("aria-roledescription")).toBeNull();
    // The editor affordances: text cursor, text selection, no drag
    // affordances (the pointer sensor is not mounted while editing).
    expect(chip).toHaveStyle({ cursor: "text" });
    expect(chip).toHaveStyle({ userSelect: "text" });
    expect(chip).toHaveStyle({ touchAction: "auto" });
    // micro-fix: the snippet
    // highlight colors are NEVER removed while editing — hover keeps
    // the BASE 0.3 tint (only the deepening is off), and the base
    // rule is unchanged (the :hover rule must never compile to
    // transparent, which would strip the tint).
    const css = Array.from(document.querySelectorAll("style"))
      .map((style) => style.textContent)
      .join("");
    const chipClass = (chip.getAttribute("class") ?? "")
      .split(" ")
      .find((cls) => css.includes(`.${cls}:hover{`));
    expect(chipClass).toBeTruthy();
    const hoverStart = css.indexOf(`.${chipClass}:hover{`);
    const hoverRule = css.slice(hoverStart, css.indexOf("}", hoverStart));
    expect(hoverRule).toContain("background-color:rgba(0, 128, 255, 0.3)");
    expect(hoverRule).not.toContain("transparent");
    // The resting rule keeps the base tint verbatim.
    expect(chip).toHaveStyle({
      backgroundColor: "rgba(0, 128, 255, 0.3)",
    });
  });

  it("does not warn about contentEditable children (warning suppressed)", () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    renderWithProviders(seedInterleaved());
    enableEditing();
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("contentEditable"),
    );
    consoleSpy.mockRestore();
  });

  it("ships the editable cursor/min-height/outline styles and the placeholder rule only in edit mode", () => {
    renderWithProviders(seedInterleaved());
    const css = () =>
      Array.from(document.querySelectorAll("style"))
        .map((style) => style.textContent)
        .join("");

    expect(screen.getByTestId("preview-segment-flow")).not.toHaveStyle({
      cursor: "text",
    });

    enableEditing();

    const flow = screen.getByTestId("preview-segment-flow");
    expect(flow).toHaveStyle({
      cursor: "text",
    });
    expect(flow).toHaveStyle({
      minHeight: "28px",
    });
    // The UA's default focus outline (a black box around the flow on
    // click) is removed for the editing host only — the caret is its
    // own focus indicator.
    expect(flow).toHaveStyle({
      outlineStyle: "none",
    });
    expect(css()).toContain("outline:none");
    expect(css()).toContain(":empty::before");
    expect(css()).toContain("content:attr(data-placeholder)");
    // Chip focus rings are untouched.
    expect(css()).toContain(":focus-visible");
  });

  it("follows the active language for the editor label and placeholder", async () => {
    renderWithProviders(seedInterleaved());
    enableEditing();
    await act(async () => {
      await i18n.changeLanguage("pt");
    });

    const flow = screen.getByTestId("preview-segment-flow");
    expect(flow).toHaveAttribute("aria-label", "Editor de texto mesclado");
    expect(flow).toHaveAttribute(
      "data-placeholder",
      "Digite aqui para adicionar seu próprio texto",
    );
  });
});

interface GatingQuadrant {
  name: string;
  edit: boolean;
  updates: Array<[string, Snippet[]]>;
  emptyState: boolean;
  editable: boolean;
}

describe("PreviewArea gating matrix (edit OFF/ON × empty/non-empty)", () => {
  const quadrants: GatingQuadrant[] = [
    {
      name: "edit OFF + empty renders today's empty state",
      edit: false,
      updates: [],
      emptyState: true,
      editable: false,
    },
    {
      name: "edit OFF + non-empty renders today's read-only flow",
      edit: false,
      updates: [["text-1", [makeSnippet("a1", "Hello")]]],
      emptyState: false,
      editable: false,
    },
    {
      name: "edit ON + empty renders the editable root",
      edit: true,
      updates: [],
      emptyState: false,
      editable: true,
    },
    {
      name: "edit ON + non-empty renders the editable flow",
      edit: true,
      updates: [["text-1", [makeSnippet("a1", "Hello")]]],
      emptyState: false,
      editable: true,
    },
  ];

  it.each(quadrants)("$name", ({ edit, updates, emptyState, editable }) => {
    renderWithProviders(updates);
    if (edit) {
      enableEditing();
    }

    expect(Boolean(screen.queryByTestId("preview-empty"))).toBe(emptyState);
    const flow = screen.queryByTestId("preview-segment-flow");
    expect(Boolean(flow)).toBe(!emptyState);
    if (flow) {
      if (editable) {
        expect(flow).toHaveAttribute("contenteditable", "true");
      } else {
        expect(flow).not.toHaveAttribute("contenteditable");
      }
    }
  });

  it("edit ON + empty renders the editable root with the placeholder hint and no empty-state block", () => {
    renderWithProviders([]);
    enableEditing();

    expect(screen.queryByTestId("preview-empty")).toBeNull();
    const flow = screen.getByTestId("preview-segment-flow");
    expect(flow).toHaveAttribute("contenteditable", "true");
    expect(flow).toHaveAttribute(
      "data-placeholder",
      "Type here to add your own text",
    );
    // No gap anchors either: a tokenless flow stays truly :empty.
    expect(flow.childNodes).toHaveLength(0);
  });

  it("toggling edit OFF while empty restores today's empty state", () => {
    renderWithProviders([]);
    enableEditing();
    enableEditing();

    expect(screen.getByTestId("preview-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("preview-segment-flow")).toBeNull();
  });
});

describe("PreviewArea editing workflows", () => {
  it("types own text into an empty document: first keystroke creates an own-text token, the model syncs live, and the focused DOM is not reconciled", () => {
    renderWithProviders([]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });
    expect(flow).toHaveFocus();

    const typedNode = typeIntoFlow(flow, "my words");

    // The model holds the typed text after every input event…
    expect(screen.getByTestId("document-probe").textContent).toBe("my words");
    // …while the browser-created text node is still the SAME node
    // (reference identity): React did not reconcile the focused
    // surface's children.
    expect(flow.lastChild).toBe(typedNode);
    expect((flow.lastChild as Text).data).toBe("my words");
    // WYSIWYG invariant.
    expect(flow.textContent).toBe(
      screen.getByTestId("document-probe").textContent,
    );
  });

  it("types inside a snippet without splitting it: the text integrates into the token", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    // The focused surface must own its DOM: the typed "!" survives as
    // browser content, unreconciled by React (freeze contract).
    act(() => {
      flow.focus();
    });

    const chip = screen.getByTestId("preview-snippet");
    const typedNode = document.createTextNode("!");
    chip.appendChild(typedNode);
    fireEvent.input(flow);

    // One chip, its text grew, no new chip appeared — and the typed
    // node is still the same node (no reconciliation inside the chip).
    expect(screen.getAllByTestId("preview-snippet")).toHaveLength(1);
    expect(screen.getByTestId("preview-snippet").textContent).toBe("Alpha!");
    expect(screen.getByTestId("document-probe").textContent).toBe("Alpha!");
    expect(chip.lastChild).toBe(typedNode);
    expect(
      screen.getAllByTestId("preview-snippet")[0].dataset.tokenId,
    ).toBe("text-1:a1");
  });

  it("creates a line break on Enter (preventDefault, \\n text node) with the caret on the new line", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    expect(collapseSelectionAtEnd(flow)).toBe(true);

    const keydown = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      flow.dispatchEvent(keydown);
    });
    expect(keydown.defaultPrevented).toBe(true);

    // A "\n" text node landed at the caret and synced into the model.
    expect(flow.textContent).toContain("\n");
    expect(screen.getByTestId("document-probe").textContent).toBe("Alpha\n");

    // The invisible-line fix: a trailing
    // "\n" renders no empty last line in pre-wrap, so the handler
    // plants exactly one bogus <br> line anchor right after the
    // newline (Chrome's own contentEditable technique) and leaves the
    // caret logically BETWEEN the two — on the new line.
    const newlineNode = Array.from(flow.childNodes).find(
      (node) => node.nodeType === Node.TEXT_NODE && (node as Text).data === "\n",
    );
    expect(newlineNode).toBeDefined();
    expect(flow.querySelectorAll("br")).toHaveLength(1);
    expect(newlineNode?.nextSibling?.nodeName).toBe("BR");
    // Parser/serialization neutrality: the anchor contributes no
    // textContent and no token — the WYSIWYG invariant holds even
    // while focused.
    expect(flow.textContent).toBe("Alpha\n");
    expect(screen.getByTestId("document-probe").textContent).toBe("Alpha\n");
    // The caret is a collapsed selection right after the "\n" —
    // between the newline and the anchor.
    const selection = window.getSelection();
    expect(selection?.rangeCount).toBe(1);
    const range = selection?.getRangeAt(0);
    expect(range?.collapsed).toBe(true);
    expect(range?.startContainer).toBe(flow);
    expect(flow.childNodes[range ? range.startOffset - 1 : -1]).toBe(
      newlineNode,
    );
    expect(flow.childNodes[range ? range.startOffset : -1].nodeName).toBe("BR");
  });

  it("does not stack the line anchor: repeated Enter at the end keeps exactly one", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    // Collapse to the end ONCE (the real caret then stays after each
    // inserted newline — between it and the anchor — like a browser).
    expect(collapseSelectionAtEnd(flow)).toBe(true);
    const pressEnter = () => {
      const keydown = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        flow.dispatchEvent(keydown);
      });
    };
    pressEnter();
    pressEnter();
    pressEnter();

    // One anchor serves every trailing newline.
    expect(flow.querySelectorAll("br")).toHaveLength(1);
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha\n\n\n",
    );
    expect(flow.textContent).toBe("Alpha\n\n\n");
  });

  it("plants no line anchor when content follows the newline (Enter between chips)", () => {
    renderWithProviders([
      ["text-1", [makeSnippet("a1", "Alpha")]],
      ["text-2", [makeSnippet("b1", "Beta")]],
    ]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    // Caret right after the first chip (a boundary between two
    // children of the flow root).
    const chipAlpha = screen.getAllByTestId("preview-snippet")[0];
    const caretOffset = Array.from(flow.childNodes).indexOf(chipAlpha) + 1;
    const range = document.createRange();
    range.setStart(flow, caretOffset);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const keydown = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      flow.dispatchEvent(keydown);
    });

    // The following separator/chips render the line box: no anchor.
    expect(flow.querySelectorAll("br")).toHaveLength(0);
    expect(screen.getByTestId("document-probe").textContent).toContain("\n");
  });

  it("replants the line anchor on re-focus when the document ends with a line break (and thaw removes it)", () => {
    renderWithProviders([]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });
    typeIntoFlow(flow, "line");
    expect(collapseSelectionAtEnd(flow)).toBe(true);
    const keydown = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      flow.dispatchEvent(keydown);
    });
    expect(flow.querySelectorAll("br")).toHaveLength(1);

    // Blur: the commit parses (the anchor is invisible to the model)
    // and the thaw remount rebuilds the children from the model —
    // the anchor self-heals away.
    act(() => {
      flow.blur();
    });
    const afterBlur = screen.getByTestId("preview-segment-flow");
    expect(afterBlur.querySelectorAll("br")).toHaveLength(0);
    expect(afterBlur.textContent).toBe("line\n");
    expect(screen.getByTestId("document-probe").textContent).toBe("line\n");

    // Focus back: the re-rendered trailing "\n" has no line box of
    // its own, so the focus handler plants the anchor again —
    // clicking at the end shows the caret on the empty last line.
    act(() => {
      afterBlur.focus();
    });
    const refocused = screen.getByTestId("preview-segment-flow");
    expect(refocused).toBe(afterBlur); // focus does not remount
    expect(refocused.querySelectorAll("br")).toHaveLength(1);
    expect(refocused.textContent).toBe("line\n");
  });

  // -----------------------------------------------------------------
  // "A line break never enters a snippet":
  // clicking right at the end of a snippet's text places the caret
  // INSIDE the chip span; Enter must plant the "\n" OUTSIDE the chip
  // so the next line's typing is own text, never snippet content.
  // Mid-chip Enters (and every typed character) keep the Q3
  // in-snippet integration contract.
  // -----------------------------------------------------------------

  const caretInsideChip = (chip: HTMLElement, offset: number) => {
    // The React-rendered chip holds its text as a single text node.
    const textNode = chip.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, offset);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const pressEnterOnFlow = (flow: HTMLElement) => {
    const keydown = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      flow.dispatchEvent(keydown);
    });
    return keydown;
  };

  it("escapes the chip when Enter hits the end boundary: the line break and the next line's typing are never snippet content", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    // The caret INSIDE the chip, right after its last character —
    // exactly where a browser places a click at the snippet's end.
    const chip = screen.getByTestId("preview-snippet");
    caretInsideChip(chip, "Alpha".length);
    pressEnterOnFlow(flow);

    // The "\n" is the chip's SIBLING, not part of its content…
    expect(chip.textContent).toBe("Alpha");
    expect(chip.nextSibling?.nodeType).toBe(Node.TEXT_NODE);
    expect((chip.nextSibling as Text).data).toBe("\n");
    // …the model keeps the snippet token unchanged with a line-break
    // token after it.
    expect(screen.getByTestId("document-probe").textContent).toBe("Alpha\n");
    // The newline ends the block (the chip was last): the bogus <br>
    // anchor is planted after it, and the caret sits between the two.
    expect(flow.querySelectorAll("br")).toHaveLength(1);
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    expect(range?.startContainer).toBe(flow);
    expect(flow.childNodes[range ? range.startOffset - 1 : -1]).toBe(
      chip.nextSibling,
    );

    // Typing on the new line lands as own text, never in the snippet.
    const newlineNode = chip.nextSibling as Text;
    flow.insertBefore(document.createTextNode("next line"), newlineNode.nextSibling);
    fireEvent.input(flow);
    expect(chip.textContent).toBe("Alpha");
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha\nnext line",
    );
  });

  it("escapes the chip at the end boundary even when a separator follows (no anchor planted)", () => {
    renderWithProviders([
      ["text-1", [makeSnippet("a1", "Alpha")]],
      ["text-2", [makeSnippet("b1", "Beta")]],
    ]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    const chip = screen.getAllByTestId("preview-snippet")[0];
    caretInsideChip(chip, "Alpha".length);
    pressEnterOnFlow(flow);

    // The separator stays content: the newline sits between the chip
    // and its separator, the snippet token is unchanged…
    expect(chip.textContent).toBe("Alpha");
    expect((chip.nextSibling as Text).data).toBe("\n");
    expect(screen.getByTestId("document-probe").textContent).toBe("Alpha\n beta");
    // …and the separator means the newline does not end the block: no
    // bogus anchor.
    expect(flow.querySelectorAll("br")).toHaveLength(0);

    // Typing after the newline is own text between the line break and
    // the separator — not snippet content.
    const newlineNode = chip.nextSibling as Text;
    flow.insertBefore(document.createTextNode("own"), newlineNode.nextSibling);
    fireEvent.input(flow);
    expect(chip.textContent).toBe("Alpha");
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha\nown beta",
    );
  });

  it("escapes the chip when Enter hits the start boundary (symmetric case): the line break precedes the snippet", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    const chip = screen.getByTestId("preview-snippet");
    caretInsideChip(chip, 0);
    pressEnterOnFlow(flow);

    // The "\n" is the chip's PRECEDING sibling; the snippet token is
    // unchanged; the chip's content follows the newline, so no anchor.
    expect(chip.textContent).toBe("Alpha");
    expect(chip.previousSibling?.nodeType).toBe(Node.TEXT_NODE);
    expect((chip.previousSibling as Text).data).toBe("\n");
    expect(screen.getByTestId("document-probe").textContent).toBe("\nAlpha");
    expect(flow.querySelectorAll("br")).toHaveLength(0);

    // Typing lands on the new line BEFORE the chip as own text.
    const newlineNode = chip.previousSibling as Text;
    flow.insertBefore(document.createTextNode("prefix "), newlineNode.nextSibling);
    fireEvent.input(flow);
    expect(chip.textContent).toBe("Alpha");
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "\nprefix Alpha",
    );
  });

  it("keeps mid-chip Enter integrated into the snippet text (the rejected split stays rejected)", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    const chip = screen.getByTestId("preview-snippet");
    caretInsideChip(chip, 2);
    pressEnterOnFlow(flow);

    // The newline embeds INSIDE the chip (Q3 integration): the token
    // text grows with it and no sibling "\n" appears.
    expect(chip.textContent).toBe("Al\npha");
    expect(chip.nextSibling?.nodeType).not.toBe(Node.TEXT_NODE);
    expect(chip.previousSibling?.nodeType).not.toBe(Node.TEXT_NODE);
    expect(screen.getByTestId("document-probe").textContent).toBe("Al\npha");
  });

  // -----------------------------------------------------------------
  // "A line break never enters a snippet" — the paste extension:
  // pasted text integrates into the snippet only up to its first
  // newline; the newline and everything
  // after it land outside the chip. Single-line pastes behave exactly
  // like typed characters (full integration).
  // -----------------------------------------------------------------

  const pasteIntoFlow = (flow: HTMLElement, text: string) => {
    fireEvent.paste(flow, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? text : ""),
      },
    });
  };

  it("splits an at-end multi-line paste at the first newline: the prefix integrates, the tail is flow content after the snippet, and the chip becomes edited", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    const chip = screen.getByTestId("preview-snippet");
    caretInsideChip(chip, "Alpha".length);
    pasteIntoFlow(flow, "past\nsecond\nthird");

    // The prefix (before the first newline) integrates into the chip…
    expect(chip.textContent).toBe("Alphapast");
    // …and the chip is marked edited (the user modified its text).
    expect(screen.getByTestId("edited-probe").textContent).toBe("true");
    // The first newline and everything after it are the chip's
    // following SIBLING — flow content, never snippet content.
    expect(chip.nextSibling?.nodeType).toBe(Node.TEXT_NODE);
    expect((chip.nextSibling as Text).data).toBe("\nsecond\nthird");
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alphapast\nsecond\nthird",
    );
    // The caret sits logically after the inserted content.
    const range = window.getSelection()?.getRangeAt(0);
    expect(range?.startContainer).toBe(flow);
    expect(flow.childNodes[range ? range.startOffset - 1 : -1]).toBe(
      chip.nextSibling,
    );
  });

  it("treats an at-end paste starting with a newline as the Enter escape: the chip is untouched and unedited", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    const chip = screen.getByTestId("preview-snippet");
    caretInsideChip(chip, "Alpha".length);
    pasteIntoFlow(flow, "\nnext");

    // Empty prefix: nothing integrates — the whole paste lands after
    // the chip, exactly like the Enter escape.
    expect(chip.textContent).toBe("Alpha");
    expect(screen.getByTestId("edited-probe").textContent).toBe("false");
    expect((chip.nextSibling as Text).data).toBe("\nnext");
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha\nnext",
    );
  });

  it("still fully integrates an at-end single-line paste (single-line pastes behave like typed characters)", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    const chip = screen.getByTestId("preview-snippet");
    caretInsideChip(chip, "Alpha".length);
    pasteIntoFlow(flow, "suffix");

    expect(chip.textContent).toBe("Alphasuffix");
    expect(chip.nextSibling?.nodeType).not.toBe(Node.TEXT_NODE);
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alphasuffix",
    );
    expect(screen.getByTestId("edited-probe").textContent).toBe("true");
  });

  it("lands an at-start multi-line paste wholly before the chip, reading order preserved (geometric default)", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    const chip = screen.getByTestId("preview-snippet");
    caretInsideChip(chip, 0);
    pasteIntoFlow(flow, "head\nline2");

    // Integrating the prefix at the start boundary would scramble
    // the pasted reading order (the tail would render before the
    // prefix without splitting the chip), so the WHOLE paste lands
    // before the chip as flow content.
    expect(chip.textContent).toBe("Alpha");
    expect(screen.getByTestId("edited-probe").textContent).toBe("false");
    expect(chip.previousSibling?.nodeType).toBe(Node.TEXT_NODE);
    expect((chip.previousSibling as Text).data).toBe("head\nline2");
    // Reading order: the pasted lines, then the snippet.
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "head\nline2Alpha",
    );
    // The caret sits after the inserted content.
    const range = window.getSelection()?.getRangeAt(0);
    expect(range?.startContainer).toBe(flow);
    expect(flow.childNodes[range ? range.startOffset - 1 : -1]).toBe(
      chip.previousSibling,
    );
  });

  it("still fully integrates an at-start single-line paste", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    const chip = screen.getByTestId("preview-snippet");
    caretInsideChip(chip, 0);
    pasteIntoFlow(flow, "pre ");

    expect(chip.textContent).toBe("pre Alpha");
    expect(chip.previousSibling?.nodeType).not.toBe(Node.TEXT_NODE);
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "pre Alpha",
    );
  });

  it("keeps a mid-chip multi-line paste fully integrated (unchanged, like mid-chip Enter)", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    const chip = screen.getByTestId("preview-snippet");
    caretInsideChip(chip, 2);
    pasteIntoFlow(flow, "x\ny");

    // An order-preserving escape is impossible without splitting the
    // chip (the rejected chip split): the paste embeds entirely.
    expect(chip.textContent).toBe("Alx\nypha");
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alx\nypha",
    );
  });

  it("plants the bogus <br> when an at-end split paste leaves the tail ending the block with a newline (the trailing-anchor rule through the new path)", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    const chip = screen.getByTestId("preview-snippet");
    caretInsideChip(chip, "Alpha".length);
    pasteIntoFlow(flow, "tail\n");

    // Prefix integrates; the tail "\n" ends the block (the chip was
    // last) → exactly one bogus anchor after it.
    expect(chip.textContent).toBe("Alphatail");
    expect((chip.nextSibling as Text).data).toBe("\n");
    expect(flow.querySelectorAll("br")).toHaveLength(1);
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alphatail\n",
    );
    // WYSIWYG through the new path.
    expect(flow.textContent).toBe("Alphatail\n");
  });

  // -----------------------------------------------------------------
  // "we always have at least one
  // white space between snippets and texts" — typing auto-separation
  // (Rule 1) and gap collapse on caret exit (Rule 2).
  // -----------------------------------------------------------------

  // Realistic typing: insert characters into a text node at a caret
  // offset, move the caret after the typed text, fire input.
  const typeIntoNode = (
    flow: HTMLElement,
    node: Text,
    offset: number,
    text: string,
  ) => {
    node.insertData(offset, text);
    setCaretInNode(node, offset + text.length);
    fireEvent.input(flow);
  };

  const setCaretInNode = (node: Node, offset: number) => {
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const dispatchSelectionChange = () => {
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
  };

  const pressArrow = (flow: HTMLElement, key: "ArrowLeft" | "ArrowRight") => {
    const keydown = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      flow.dispatchEvent(keydown);
    });
    return keydown;
  };

  // Realistic input: dispatch an InputEvent with inputType/data — the
  // real-browser event shape (the redirect's currency).
  const realisticInput = (
    flow: HTMLElement,
    init: { inputType?: string; data?: string | null },
  ) => {
    act(() => {
      flow.dispatchEvent(
        new window.InputEvent("input", { bubbles: true, ...init }),
      );
    });
  };

  // Realistic typing: the browser's insertText with data — insert the
  // chars, move the caret after them, fire the realistic input.
  const typeRealistic = (
    flow: HTMLElement,
    node: Text,
    offset: number,
    data: string,
  ) => {
    node.insertData(offset, data);
    setCaretInNode(node, offset + data.length);
    realisticInput(flow, { inputType: "insertText", data });
  };

  const seedTwoChips = (): Array<[string, Snippet[]]> => [
    ["text-1", [makeSnippet("a1", "Alpha")]],
    ["text-2", [makeSnippet("b1", "Beta")]],
  ];

  const separatorNodeOf = (flow: HTMLElement) =>
    Array.from(flow.childNodes).find(
      (node) => node.nodeType === Node.TEXT_NODE,
    ) as Text;

  describe("chip-territory redirect", () => {
    it("redirects text typed at the gap's LEFT edge into the left snippet (append, caret inside, edited)", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // The user's case 1: typing at the left edge of the gap space
      // joins the CURRENT (left) snippet.
      const chipAlpha = screen.getAllByTestId("preview-snippet")[0];
      const chipText = chipAlpha.firstChild as Text;
      typeRealistic(flow, separatorNodeOf(flow), 0, "text");

      // The run moved INTO chipA: its text grew, the separator stays,
      // the chip is edited, and the caret sits inside the chip after
      // the run (subsequent typing integrates natively, Q3).
      expect(chipAlpha.textContent).toBe("Alphatext");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alphatext beta",
      );
      expect(screen.getByTestId("edited-probe").textContent).toBe("true");
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(chipText);
      expect(range?.startOffset).toBe("Alphatext".length);

      // Continued typing integrates into the chip without a second
      // redirect (the caret is already chip territory).
      typeRealistic(flow, chipText, chipText.data.length, "Z");
      expect(chipAlpha.textContent).toBe("AlphatextZ");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "AlphatextZ beta",
      );
    });

    it("redirects text typed at the gap's RIGHT edge into the right snippet (prepend)", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const chipBeta = screen.getAllByTestId("preview-snippet")[1];
      const chipText = chipBeta.firstChild as Text;
      typeRealistic(flow, separatorNodeOf(flow), 1, "text");

      expect(chipBeta.textContent).toBe("textbeta");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha textbeta",
      );
      expect(flow.textContent).toBe("Alpha textbeta");
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(chipText);
      expect(range?.startOffset).toBe("text".length);
    });

    it("redirects a multi-character run as one unit", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const chipAlpha = screen.getAllByTestId("preview-snippet")[0];
      typeRealistic(flow, separatorNodeOf(flow), 0, "abc");

      expect(chipAlpha.textContent).toBe("Alphaabc");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alphaabc beta",
      );
    });

    it("keeps the seam behavior: typing between GLUED snippets plants spaces on both sides", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // The user deleted the separator: glue the chips first.
      const separator = separatorNodeOf(flow);
      separator.remove();
      fireEvent.input(flow);
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alphabeta",
      );

      // Type at the boundary right after the first chip (realistic
      // insertText — the seam needs the run's data).
      const chipAlpha = screen.getAllByTestId("preview-snippet")[0];
      const boundary = Array.from(flow.childNodes).indexOf(chipAlpha) + 1;
      const typed = document.createTextNode("");
      flow.insertBefore(typed, flow.childNodes[boundary] ?? null);
      typeRealistic(flow, typed, 0, "X");

      // Symmetric ambiguity: spaces both sides, the run stays own
      // text, the caret stays inside it.
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha X beta",
      );
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(typed);
      expect(range?.startOffset).toBe(1);
    });

    it("redirects typing at the flow start into the first snippet and at the flow end into the last", () => {
      renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // Flow start, directly before the chip: chip territory — the
      // browser inserts the run into the flow at the boundary.
      const chip = screen.getByTestId("preview-snippet");
      const chipText = chip.firstChild as Text;
      const boundary = Array.from(flow.childNodes).indexOf(chip);
      const typedStart = document.createTextNode("X");
      flow.insertBefore(typedStart, flow.childNodes[boundary] ?? null);
      setCaretInNode(typedStart, 1);
      realisticInput(flow, { inputType: "insertText", data: "X" });

      expect(chip.textContent).toBe("XAlpha");
      expect(screen.getByTestId("document-probe").textContent).toBe("XAlpha");
      expect(screen.getByTestId("edited-probe").textContent).toBe("true");

      // Flow end, directly after the chip: append. The caret is
      // already inside the chip's text (the redirect moved it there).
      typeRealistic(flow, chipText, chipText.data.length, "Y");
      expect(chip.textContent).toBe("XAlphaY");
      expect(screen.getByTestId("document-probe").textContent).toBe("XAlphaY");
    });

    it("redirects typing at a chip edge with own text on the far side: the run joins the chip, one space parts it from the own text", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // The user deleted the separator and has own text glued to the
      // first chip; the caret sits at offset 0 of that text — the
      // position directly abuts chipA on the left.
      const separator = separatorNodeOf(flow);
      separator.data = "hello";
      fireEvent.input(flow);
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alphahellobeta",
      );

      const chipAlpha = screen.getAllByTestId("preview-snippet")[0];
      typeRealistic(flow, separator, 0, "X");

      // X joins chipA; the far side ("hello") keeps one space from
      // the grown chip.
      expect(chipAlpha.textContent).toBe("AlphaX");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "AlphaX hellobeta",
      );
      expect(screen.getByTestId("edited-probe").textContent).toBe("true");
    });

    it("keeps `mytext|` + chip territory: the char joins the chip, a space parts it from the own text (single-chip)", () => {
      renderWithProviders([["text-2", [makeSnippet("b1", "Beta")]]]);
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // Own text glued directly before the chip; the caret at its end
      // directly abuts chipB on the right.
      const chip = screen.getByTestId("preview-snippet");
      const myText = document.createTextNode("mytext");
      flow.insertBefore(myText, chip);
      fireEvent.input(flow);
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "mytextBeta",
      );

      typeRealistic(flow, myText, myText.data.length, "X");

      // "mytext XBeta" is a DELIBERATE spacing oracle: the single
      // space at the seam is exactly what the rules keep, and the
      // chip's leading edge is never touched (a frozen follower is no
      // obstacle for corrections around it).
      expect(chip.textContent).toBe("XBeta");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "mytext XBeta",
      );
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(chip.firstChild as Text);
      expect(range?.startOffset).toBe(1);
    });

    it("keeps chip + `|mytext` symmetric: the run joins the chip, a space parts the own text", () => {
      renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const chip = screen.getByTestId("preview-snippet");
      const myText = document.createTextNode("mytext");
      flow.appendChild(myText);
      fireEvent.input(flow);
      // "Alphamytext" is a DELIBERATE spacing oracle: letter-ending
      // glue never gains a space (no trigger character ends the
      // chip), mid-typing and through every later trigger alike.
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alphamytext",
      );

      // The caret at offset 0 of the own text directly abuts chipA.
      typeRealistic(flow, myText, 0, "X");

      expect(chip.textContent).toBe("AlphaX");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "AlphaX mytext",
      );
    });

    it("treats a line break between the caret and a chip as separation on that side only", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const separator = separatorNodeOf(flow);
      separator.data = "\n\n";
      fireEvent.input(flow);
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha\n\nbeta",
      );

      // Between the two newlines: free territory — typing is own text.
      typeRealistic(flow, separator, 1, "X");
      expect(screen.getAllByTestId("preview-snippet")[0].textContent).toBe(
        "Alpha",
      );
      expect(screen.getAllByTestId("preview-snippet")[1].textContent).toBe(
        "beta",
      );
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha\nX\nbeta",
      );

      // Right before the chip (after the second newline): chip
      // territory — the run redirects into the chip's start.
      typeRealistic(flow, separator, separator.data.length, "Y");
      expect(screen.getAllByTestId("preview-snippet")[1].textContent).toBe(
        "Ybeta",
      );
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha\nX\nYbeta",
      );
    });

    it("never redirects a bare (data-less) input event: the run stays flow content", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // The jsdom-typical bare event cannot identify the typed run —
      // no redirect, no plants; the sync still runs.
      typeIntoNode(flow, separatorNodeOf(flow), 0, "X");
      expect(screen.getAllByTestId("preview-snippet")[0].textContent).toBe(
        "Alpha",
      );
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "AlphaX beta",
      );
    });

    it("does not auto-space typing inside a chip (Q3 integration stays glued)", () => {
      renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const chip = screen.getByTestId("preview-snippet");
      const chipText = chip.firstChild as Text;
      typeIntoNode(flow, chipText, "Alpha".length, "X");
      expect(chip.textContent).toBe("AlphaX");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "AlphaX",
      );

      typeIntoNode(flow, chipText, 2, "Y");
      expect(chip.textContent).toBe("AlYphaX");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "AlYphaX",
      );
    });

    it("does not auto-space whitespace typing in the gap (the user manages spacing)", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      typeIntoNode(flow, separatorNodeOf(flow), 0, " ");

      // No spaces planted — the gap just grows.
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha  beta",
      );
      expect(flow.textContent).toBe("Alpha  beta");
    });

    it("keeps the caret stable on continued seam typing (the planted spaces block re-firing)", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // Glue the chips, then type at the seam (realistic data).
      const separator = separatorNodeOf(flow);
      separator.remove();
      fireEvent.input(flow);

      const chipAlpha = screen.getAllByTestId("preview-snippet")[0];
      const boundary = Array.from(flow.childNodes).indexOf(chipAlpha) + 1;
      const typed = document.createTextNode("");
      flow.insertBefore(typed, flow.childNodes[boundary] ?? null);
      typeRealistic(flow, typed, 0, "X");

      // The caret is right after the typed text, BEFORE the trailing
      // space — the leading space precedes the run (it sits after the
      // zero-footprint landing anchors).
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(typed);
      expect(range?.startOffset).toBe(1);
      expect((typed.previousSibling as Text).data).toBe(" ");
      // the removed separator's landing anchors (its two
      // edge anchors) are zero-footprint elements that may sit between
      // the run and the trailing planted space — walk to the next TEXT
      // sibling instead of assuming one element hop.
      const nextTextSibling = (node: Node): Text | null => {
        let current = node.nextSibling;
        while (current) {
          if (current.nodeType === Node.TEXT_NODE) {
            return current as Text;
          }
          current = current.nextSibling;
        }
        return null;
      };
      expect(nextTextSibling(typed)?.data).toBe(" ");

      // Continued typing flows into the run; the planted spaces block
      // re-firing (no double spacing).
      typeRealistic(flow, typed, 1, "Y");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha XY beta",
      );
      expect(flow.textContent).toBe("Alpha XY beta");
    });

    // -----------------------------------------------------------------
    // Realistic InputEvent regression:
    // real browsers label EVERY input event via InputEvent.inputType —
    // deletions (deleteContentBackward, deleteByCut, historyUndo, …)
    // and whitespace keystrokes included. The per-input contract
    // holds for all of them: the auto-separation gates gate
    // ONLY the space planting, never the model sync.
    // -----------------------------------------------------------------

    it("syncs the model on a real-browser deletion input (deleteContentBackward)", () => {
      renderWithProviders([["text-1", [makeSnippet("a1", "Hello")]]]);
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // The user backspaces one character of the chip's text: the
      // browser's input event is deleteContentBackward (data null).
      const chip = screen.getByTestId("preview-snippet");
      const chipText = chip.firstChild as Text;
      chipText.data = "Hell";
      setCaretInNode(chipText, "Hell".length);
      realisticInput(flow, { inputType: "deleteContentBackward", data: null });

      // Every input event parses and syncs — the model holds
      // the deletion, not the pre-edit text.
      expect(screen.getByTestId("document-probe").textContent).toBe("Hell");
      expect(flow.textContent).toBe("Hell");
    });

    it("syncs the model on a whitespace-only insertText input and plants nothing", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // The user types a space into the gap: insertText with data ' ' —
      // synced like any other input, but never auto-separated.
      const separator = separatorNodeOf(flow);
      separator.insertData(0, " ");
      setCaretInNode(separator, 1);
      realisticInput(flow, { inputType: "insertText", data: " " });

      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha  beta",
      );
      expect(flow.textContent).toBe("Alpha  beta");
    });

    it("redirects a realistic non-whitespace insertText typed at a glued run's chip edge (and syncs)", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // Glue the chips with an own-text run first.
      const separator = separatorNodeOf(flow);
      separator.data = "text";
      fireEvent.input(flow);
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alphatextbeta",
      );

      // The browser types "X" at the run's end — the position directly
      // abuts chipB (the right chip): chip territory.
      separator.insertData(separator.data.length, "X");
      setCaretInNode(separator, separator.data.length);
      realisticInput(flow, { inputType: "insertText", data: "X" });

      // The run redirected into chipB (prepend) and one space parts
      // the own text from the grown chip. The "Alphatext Xbeta" seam
      // is a DELIBERATE spacing oracle: "text" ends in a non-trigger
      // letter, so the spacing pass never inserts after it — the
      // single space is exactly what the seam rules keep.
      expect(
        screen.getAllByTestId("preview-snippet")[1].textContent,
      ).toBe("Xbeta");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alphatext Xbeta",
      );
      expect(flow.textContent).toBe("Alphatext Xbeta");
    });

    it("control: a bare input event (jsdom-typical, no inputType) still syncs", () => {
      renderWithProviders([["text-1", [makeSnippet("a1", "Hello")]]]);
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const chip = screen.getByTestId("preview-snippet");
      (chip.firstChild as Text).data = "Hell";
      fireEvent.input(flow);

      expect(screen.getByTestId("document-probe").textContent).toBe("Hell");
    });
  });

  describe("gap collapse on caret exit", () => {
    it("leaves the visited one-space gap unchanged when no text is typed (case 2 verbatim)", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // Click into the gap: visit it, then leave — nothing changes.
      const separator = separatorNodeOf(flow);
      setCaretInNode(separator, 0);
      dispatchSelectionChange();
      setCaretInNode(separator, 1);
      dispatchSelectionChange();
      const chipText = (screen.getAllByTestId("preview-snippet")[0]
        .firstChild as Text);
      setCaretInNode(chipText, 2);
      dispatchSelectionChange();

      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha beta",
      );
      expect(flow.textContent).toBe("Alpha beta");
    });

    it("keeps the scaffold's two spaces while the caret stays, collapses them to one on exit (scaffold interplay)", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // ArrowLeft from the gap's right edge scaffolds the free zone:
      // the run becomes two spaces, the caret centered.
      const separator = separatorNodeOf(flow);
      setCaretInNode(separator, 1);
      const keydown = pressArrow(flow, "ArrowLeft");
      expect(keydown.defaultPrevented).toBe(true);
      expect(separator.data).toBe("  ");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha  beta",
      );
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(separator);
      expect(range?.startOffset).toBe(1);

      // The caret stays in the scaffold (the caret-position signal):
      // the two spaces remain.
      dispatchSelectionChange();
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha  beta",
      );

      // Leave the place by moving the caret: the scaffold collapses
      // to one space and the model resyncs (rule 2, exit path).
      const chipText = (screen.getAllByTestId("preview-snippet")[0]
        .firstChild as Text);
      setCaretInNode(chipText, 2);
      dispatchSelectionChange();

      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha beta",
      );
      expect(flow.textContent).toBe("Alpha beta");
    });

    it("collapses deliberately typed extra spaces on caret exit (shape-based, not provenance-based)", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const separator = separatorNodeOf(flow);
      typeIntoNode(flow, separator, 0, "  ");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha   beta",
      );

      // The caret still inside: no collapse.
      dispatchSelectionChange();
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha   beta",
      );

      // Leave: collapse to one.
      const chipText = (screen.getAllByTestId("preview-snippet")[0]
        .firstChild as Text);
      setCaretInNode(chipText, 1);
      dispatchSelectionChange();

      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha beta",
      );
    });

    it("collapses the gap on blur when the caret leaves by blurring inside it", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const separator = separatorNodeOf(flow);
      typeIntoNode(flow, separator, 0, "  ");
      setCaretInNode(separator, 2);
      // The caret-position signal seeds the tracker with the gap…
      dispatchSelectionChange();

      act(() => {
        flow.blur();
      });

      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha beta",
      );
      expect(flow.textContent).toBe("Alpha beta");
    });

    it("never collapses a run containing a newline", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const separator = separatorNodeOf(flow);
      separator.data = " \n ";
      fireEvent.input(flow);
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha \n beta",
      );

      // "Leave" the caret from inside the run: nothing collapses —
      // newlines are content, not gap spaces.
      setCaretInNode(separator, 3);
      dispatchSelectionChange();
      const chipText = (screen.getAllByTestId("preview-snippet")[0]
        .firstChild as Text);
      setCaretInNode(chipText, 1);
      dispatchSelectionChange();

      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha \n beta",
      );
    });

    it("never collapses a whitespace run that is not between two chips (document end)", () => {
      renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const trailing = document.createTextNode("  ");
      flow.appendChild(trailing);
      setCaretInNode(trailing, 1);
      fireEvent.input(flow);
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha  ",
      );

      // Enter the run and leave it: it is not bounded by chips on
      // both sides — no collapse ever.
      dispatchSelectionChange();
      setCaretInNode(trailing, 2);
      dispatchSelectionChange();
      const chipText = (screen.getByTestId("preview-snippet")
        .firstChild as Text);
      setCaretInNode(chipText, 1);
      dispatchSelectionChange();

      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha  ",
      );
    });

    it("does not collapse while the caret moves within the same gap", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const separator = separatorNodeOf(flow);
      typeIntoNode(flow, separator, 0, "  ");

      // Move around inside the same run: still three spaces.
      setCaretInNode(separator, 2);
      dispatchSelectionChange();
      setCaretInNode(separator, 1);
      dispatchSelectionChange();
      setCaretInNode(separator, 3);
      dispatchSelectionChange();

      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha   beta",
      );
    });

    it("resyncs the blurred twin surface when the gap collapses", () => {
      const TwoFlows = ({ updates }: { updates: Array<[string, Snippet[]]> }) => {
        const { setSourceSnippets } = useSnippets();
        useEffect(() => {
          updates.forEach(([sourceId, snippets]) =>
            setSourceSnippets(sourceId, snippets),
          );
        }, [updates, setSourceSnippets]);
        return (
          <>
            <DocumentProbe />
            <TextEditingToggle />
            <PreviewArea />
            <PreviewArea />
          </>
        );
      };
      render(
        <I18nextProvider i18n={i18n}>
          <MuiThemeProvider theme={theme}>
            <StyledThemeProvider theme={theme}>
              <SnippetsProvider>
                <TwoFlows updates={seedTwoChips()} />
              </SnippetsProvider>
            </StyledThemeProvider>
          </MuiThemeProvider>
        </I18nextProvider>,
      );
      enableEditing();
      const flowAt = (index: number) =>
        screen.getAllByTestId("preview-segment-flow")[index];

      act(() => {
        flowAt(0).focus();
      });
      const separator = separatorNodeOf(flowAt(0));
      separator.data = "   ";
      setCaretInNode(separator, 1);
      fireEvent.input(flowAt(0));
      expect(flowAt(1).textContent).toBe("Alpha   beta");

      // The caret-position signal seeds the tracker with the
      // three-space gap; the twin shows it live.
      dispatchSelectionChange();

      // Leave the gap: the collapse commits, and the blurred twin
      // re-renders from the model.
      const chipText = (screen.getAllByTestId("preview-snippet")[0]
        .firstChild as Text);
      setCaretInNode(chipText, 1);
      dispatchSelectionChange();

      expect(flowAt(1).textContent).toBe("Alpha beta");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha beta",
      );
    });
  });

  describe("arrow scaffolds", () => {
    it("scaffolds the between-chips gap from both chip boundaries and both gap edges", () => {
      // From chip2's start (inside the chip at offset 0), ArrowLeft.
      {
        const { unmount } = renderWithProviders(seedTwoChips());
        enableEditing();
        const flow = screen.getByTestId("preview-segment-flow");
        act(() => {
          flow.focus();
        });
        const [, chipBeta] = screen.getAllByTestId("preview-snippet");
        setCaretInNode(chipBeta.firstChild as Text, 0);
        const keydown = pressArrow(flow, "ArrowLeft");
        expect(keydown.defaultPrevented).toBe(true);
        const separator = separatorNodeOf(flow);
        expect(separator.data).toBe("  ");
        const range = window.getSelection()?.getRangeAt(0);
        expect(range?.startContainer).toBe(separator);
        expect(range?.startOffset).toBe(1);
        expect(screen.getByTestId("document-probe").textContent).toBe(
          "Alpha  beta",
        );
        unmount();
      }
      // From chip1's end (inside the chip at its text end), ArrowRight.
      {
        const { unmount } = renderWithProviders(seedTwoChips());
        enableEditing();
        const flow = screen.getByTestId("preview-segment-flow");
        act(() => {
          flow.focus();
        });
        const [chipAlpha] = screen.getAllByTestId("preview-snippet");
        setCaretInNode(chipAlpha.firstChild as Text, "Alpha".length);
        const keydown = pressArrow(flow, "ArrowRight");
        expect(keydown.defaultPrevented).toBe(true);
        const separator = separatorNodeOf(flow);
        expect(separator.data).toBe("  ");
        expect(screen.getByTestId("document-probe").textContent).toBe(
          "Alpha  beta",
        );
        unmount();
      }
      // From the gap's left edge (separator offset 0), ArrowRight.
      {
        const { unmount } = renderWithProviders(seedTwoChips());
        enableEditing();
        const flow = screen.getByTestId("preview-segment-flow");
        act(() => {
          flow.focus();
        });
        const separator = separatorNodeOf(flow);
        setCaretInNode(separator, 0);
        const keydown = pressArrow(flow, "ArrowRight");
        expect(keydown.defaultPrevented).toBe(true);
        expect(separator.data).toBe("  ");
        unmount();
      }
    });

    it("typing in the scaffold is spaced own text (no redirect), and typing disarms the collapse", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const separator = separatorNodeOf(flow);
      setCaretInNode(separator, 1);
      pressArrow(flow, "ArrowLeft");
      expect(separator.data).toBe("  ");

      // Type at the center: own text with spaces both sides — the
      // chips never grow (no redirect: scaffold territory).
      separator.insertData(1, "mid");
      setCaretInNode(separator, 4);
      realisticInput(flow, { inputType: "insertText", data: "mid" });
      expect(
        screen.getAllByTestId("preview-snippet")[0].textContent,
      ).toBe("Alpha");
      expect(
        screen.getAllByTestId("preview-snippet")[1].textContent,
      ).toBe("beta");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha mid beta",
      );

      // Typed content disarms rule 2: leaving keeps the text.
      const chipText = (screen.getAllByTestId("preview-snippet")[0]
        .firstChild as Text);
      setCaretInNode(chipText, 1);
      dispatchSelectionChange();
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha mid beta",
      );
    });

    it("arrows leaving the scaffold hop into the chips' interiors and collapse it (rule 2)", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const separator = separatorNodeOf(flow);
      setCaretInNode(separator, 1);
      pressArrow(flow, "ArrowLeft");

      // ArrowLeft again: hop into chip1's text END, the gap collapses.
      const [chipAlpha, chipBeta] = screen.getAllByTestId("preview-snippet");
      const keydown = pressArrow(flow, "ArrowLeft");
      expect(keydown.defaultPrevented).toBe(true);
      let range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(chipAlpha.firstChild as Text);
      expect(range?.startOffset).toBe("Alpha".length);
      expect(separator.data).toBe(" ");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha beta",
      );

      // Scaffold again from the right edge and hop right: into
      // chip2's text START, same collapse.
      setCaretInNode(separator, 1);
      pressArrow(flow, "ArrowLeft");
      expect(separator.data).toBe("  ");
      const keydownRight = pressArrow(flow, "ArrowRight");
      expect(keydownRight.defaultPrevented).toBe(true);
      range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(chipBeta.firstChild as Text);
      expect(range?.startOffset).toBe(0);
      expect(separator.data).toBe(" ");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha beta",
      );
    });

    it("doc start: ArrowLeft at the first position scaffolds a leading space; typing is own text; ArrowRight back removes it and typing joins the snippet", () => {
      renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // The caret inside the first chip at offset 0, ArrowLeft.
      const chip = screen.getByTestId("preview-snippet");
      const chipText = chip.firstChild as Text;
      setCaretInNode(chipText, 0);
      const keydown = pressArrow(flow, "ArrowLeft");
      expect(keydown.defaultPrevented).toBe(true);

      // One space before the snippet; the caret at the space's start.
      const scaffold = Array.from(flow.childNodes).find(
        (node) => node.nodeType === Node.TEXT_NODE,
      ) as Text;
      expect(scaffold.data).toBe(" ");
      expect(flow.firstChild === scaffold || scaffold === chip.previousSibling)
        .toBe(true);
      let range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(scaffold);
      expect(range?.startOffset).toBe(0);
      expect(screen.getByTestId("document-probe").textContent).toBe(" Alpha");

      // Typing is OWN TEXT (scaffold territory — no redirect) and the
      // scaffold space becomes its trailing separator.
      typeRealistic(flow, scaffold, 0, "X");
      expect(chip.textContent).toBe("Alpha");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "X Alpha",
      );

      // Typed: everything stays (content) — the caret moved on
      // natively and the space is no longer removable.
      setCaretInNode(chipText, 1);
      dispatchSelectionChange();
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "X Alpha",
      );
      void scaffold;
    });

    it("doc start untouched scaffold: ArrowRight removes it, restores the caret at chip1's start, and typing integrates again", () => {
      renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const chip = screen.getByTestId("preview-snippet");
      const chipText = chip.firstChild as Text;
      setCaretInNode(chipText, 0);
      pressArrow(flow, "ArrowLeft");
      const scaffold = chip.previousSibling as Text;
      expect(scaffold.data).toBe(" ");

      // Nothing typed: ArrowRight removes the space and the caret is
      // back at the chip's offset 0 — typing belongs to the snippet.
      const keydown = pressArrow(flow, "ArrowRight");
      expect(keydown.defaultPrevented).toBe(true);
      expect(scaffold.isConnected).toBe(false);
      expect(screen.getByTestId("document-probe").textContent).toBe("Alpha");
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(chipText);
      expect(range?.startOffset).toBe(0);

      typeRealistic(flow, chipText, 0, "X");
      expect(chip.textContent).toBe("XAlpha");
      expect(screen.getByTestId("document-probe").textContent).toBe("XAlpha");
    });

    it("doc start scaffold: click-away and blur remove the untouched space", () => {
      // Click-away (the caret leaves via the selectionchange path).
      {
        const { unmount } = renderWithProviders([
          ["text-1", [makeSnippet("a1", "Alpha")]],
        ]);
        enableEditing();
        const flow = screen.getByTestId("preview-segment-flow");
        act(() => {
          flow.focus();
        });
        const chip = screen.getByTestId("preview-snippet");
        const chipText = chip.firstChild as Text;
        setCaretInNode(chipText, 0);
        pressArrow(flow, "ArrowLeft");
        const scaffold = chip.previousSibling as Text;

        setCaretInNode(chipText, 2);
        dispatchSelectionChange();
        expect(scaffold.isConnected).toBe(false);
        expect(screen.getByTestId("document-probe").textContent).toBe("Alpha");
        unmount();
      }
      // Blur removes it too (the commit parses the removed DOM).
      {
        renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
        enableEditing();
        const flow = screen.getByTestId("preview-segment-flow");
        act(() => {
          flow.focus();
        });
        const chip = screen.getByTestId("preview-snippet");
        const chipText = chip.firstChild as Text;
        setCaretInNode(chipText, 0);
        pressArrow(flow, "ArrowLeft");
        const scaffold = chip.previousSibling as Text;

        act(() => {
          flow.blur();
        });
        expect(scaffold.isConnected).toBe(false);
        expect(screen.getByTestId("document-probe").textContent).toBe("Alpha");
      }
    });

    it("doc start: ArrowLeft from the flow-start position (directly before the first chip) also scaffolds", () => {
      renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const chip = screen.getByTestId("preview-snippet");
      const chipIndex = Array.from(flow.childNodes).indexOf(chip);
      setCaretInNode(flow, chipIndex);
      const keydown = pressArrow(flow, "ArrowLeft");
      expect(keydown.defaultPrevented).toBe(true);
      const scaffold = chip.previousSibling as Text;
      expect(scaffold.data).toBe(" ");
      expect(screen.getByTestId("document-probe").textContent).toBe(" Alpha");
    });

    it("doc end: ArrowRight at the last position scaffolds a trailing space; typing is own text; ArrowLeft back removes it", () => {
      renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // From inside the last chip at its text end.
      const chip = screen.getByTestId("preview-snippet");
      const chipText = chip.firstChild as Text;
      setCaretInNode(chipText, chipText.data.length);
      const keydown = pressArrow(flow, "ArrowRight");
      expect(keydown.defaultPrevented).toBe(true);

      const scaffold = chip.nextSibling as Text;
      expect(scaffold.data).toBe(" ");
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(scaffold);
      expect(range?.startOffset).toBe(1);
      expect(screen.getByTestId("document-probe").textContent).toBe("Alpha ");

      // Typing is own text; the scaffold space becomes its leading
      // separator (`Alpha X`).
      typeRealistic(flow, scaffold, 1, "X");
      expect(chip.textContent).toBe("Alpha");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha X",
      );
    });

    it("doc end untouched scaffold: ArrowLeft removes it and restores the caret at the chip's end", () => {
      renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const chip = screen.getByTestId("preview-snippet");
      const chipText = chip.firstChild as Text;
      setCaretInNode(chipText, chipText.data.length);
      pressArrow(flow, "ArrowRight");
      const scaffold = chip.nextSibling as Text;

      const keydown = pressArrow(flow, "ArrowLeft");
      expect(keydown.defaultPrevented).toBe(true);
      expect(scaffold.isConnected).toBe(false);
      expect(screen.getByTestId("document-probe").textContent).toBe("Alpha");
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(chipText);
      expect(range?.startOffset).toBe(chipText.data.length);

      // Typing at the restored position joins the snippet again.
      typeRealistic(flow, chipText, chipText.data.length, "Y");
      expect(chip.textContent).toBe("AlphaY");
    });

    it("native arrows stay native: ArrowUp/ArrowDown and arrows into chip interiors do nothing special", () => {
      renderWithProviders(seedTwoChips());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // ArrowLeft at chip1's INTERIOR (not offset 0): native — no
      // preventDefault, no scaffold.
      const [chipAlpha] = screen.getAllByTestId("preview-snippet");
      setCaretInNode(chipAlpha.firstChild as Text, 2);
      const keydown = pressArrow(flow, "ArrowLeft");
      expect(keydown.defaultPrevented).toBe(false);
      expect(separatorNodeOf(flow).data).toBe(" ");
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha beta",
      );
    });
  });

  // -----------------------------------------------------------------
  // Keyboard sorting via Ctrl+Space while editing: the pointer
  // sensor is unmounted in edit mode and the chips cannot take
  // focus, so the keyboard sort is entered by Ctrl+Space with the
  // caret inside a snippet — the snippet lifts, arrows move it,
  // Enter drops, Escape returns it to its original place.
  // -----------------------------------------------------------------

  describe("keyboard sorting via Ctrl+Space", () => {
    beforeEach(() => {
      installSegmentRects();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const pressCtrlSpace = (flow: HTMLElement) => {
      const keydown = new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        flow.dispatchEvent(keydown);
      });
      return keydown;
    };

    // A keydown on the HOST during a raised sort — the honest user
    // path (the host holds focus; the event bubbles to the sensor's
    // document-level listeners).
    const hostKey = (flow: HTMLElement, key: string, code: string) => {
      const keydown = new KeyboardEvent("keydown", {
        key,
        code,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        flow.dispatchEvent(keydown);
      });
      return keydown;
    };

    const flushSensor = async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    };

    it("lifts the snippet at the caret: pickup, announcements, raised overlay; a second Ctrl+Space is a no-op; typing is suspended", async () => {
      renderWithProviders(seedInterleaved());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // The caret inside Alpha's text, offset 2.
      const [alpha] = screen.getAllByTestId("preview-snippet");
      setCaretInNode(alpha.firstChild as Text, 2);

      const keydown = pressCtrlSpace(flow);
      expect(keydown.defaultPrevented).toBe(true);
      expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(
        "Picked up snippet 1 of 3.",
      );
      await flushSensor();

      // A second Ctrl+Space: no-op (still one raised snippet).
      pressCtrlSpace(flow);
      expect(screen.getAllByTestId("preview-snippet-overlay")).toHaveLength(1);

      // Typing is suspended: a character keydown on the host is
      // preventDefaulted, nothing enters the model.
      const typed = hostKey(flow, "x", "KeyX");
      expect(typed.defaultPrevented).toBe(true);
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha beta gamma",
      );

      // Escape cancels: the snippet returns, order unchanged.
      const escape = hostKey(flow, "Escape", "Escape");
      expect(escape.defaultPrevented).toBe(true);
      await flushSensor();
      expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
      expect(screen.getAllByTestId("preview-snippet").map((s) => s.textContent)).toEqual([
        "Alpha",
        "beta",
        "gamma",
      ]);
    });

    it("Enter drops at the arrows' landing: order committed, needle behaves, and the caret returns inside the sorted snippet", async () => {
      renderWithProviders(seedInterleaved());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const [alpha] = screen.getAllByTestId("preview-snippet");
      setCaretInNode(alpha.firstChild as Text, 2);
      pressCtrlSpace(flow);
      await flushSensor();

      // Arrows move the raised snippet (the needle follows):
      // reaching the Beta chip takes three hops — the arrows
      // walk through the separator's edge anchors first.
      const arrow = hostKey(flow, "ArrowRight", "ArrowRight");
      expect(arrow.defaultPrevented).toBe(true);
      hostKey(flow, "ArrowRight", "ArrowRight");
      hostKey(flow, "ArrowRight", "ArrowRight");
      expect(screen.getByTestId("preview-drop-indicator")).toBeInTheDocument();

      const enter = hostKey(flow, "Enter", "Enter");
      expect(enter.defaultPrevented).toBe(true);
      await flushSensor();
      // The restore effect's timer.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // The drop committed through the moveToken path.
      expect(screen.getAllByTestId("preview-snippet").map((s) => s.textContent)).toEqual([
        "Beta",
        "alpha",
        "gamma",
      ]);
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Beta alpha gamma",
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "Snippet dropped at position 2 of 3.",
      );

      // The host is focused again and the caret sits back INSIDE the
      // sorted snippet, at the saved offset.
      expect(document.activeElement).toBe(
        screen.getByTestId("preview-segment-flow"),
      );
      const sortedAlpha = screen
        .getAllByTestId("preview-snippet")
        .find((chip) => chip.textContent === "alpha") as HTMLElement;
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(sortedAlpha.firstChild as Text);
      expect(range?.startOffset).toBe(2);
    });

    it("Escape returns the snippet to its original place (cancel) with the caret restored", async () => {
      renderWithProviders(seedInterleaved());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const [alpha] = screen.getAllByTestId("preview-snippet");
      setCaretInNode(alpha.firstChild as Text, 3);
      pressCtrlSpace(flow);
      await flushSensor();
      hostKey(flow, "ArrowRight", "ArrowRight");
      hostKey(flow, "Escape", "Escape");
      await flushSensor();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Cancelled: NO moveToken — the order never changed.
      expect(screen.getAllByTestId("preview-snippet").map((s) => s.textContent)).toEqual([
        "Alpha",
        "beta",
        "gamma",
      ]);
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha beta gamma",
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "Snippet reorder cancelled.",
      );
      expect(document.activeElement).toBe(
        screen.getByTestId("preview-segment-flow"),
      );
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(alpha.firstChild as Text);
      expect(range?.startOffset).toBe(3);
    });

    it("Ctrl+Space outside a snippet is a prevented no-op (own text, flow edges)", () => {
      renderWithProviders(seedInterleaved());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      // The caret in the gap between the first two snippets.
      const separator = separatorNodeOf(flow);
      setCaretInNode(separator, 0);
      const keydown = pressCtrlSpace(flow);
      expect(keydown.defaultPrevented).toBe(true);
      expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha beta gamma",
      );
    });

    it("single-snippet document: Ctrl+Space lifts it, arrows are inert, Enter puts it back", async () => {
      renderWithProviders([["text-1", [makeSnippet("a1", "Only")]]]);
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const only = screen.getByTestId("preview-snippet");
      setCaretInNode(only.firstChild as Text, 2);
      pressCtrlSpace(flow);
      expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();
      await flushSensor();

      hostKey(flow, "ArrowRight", "ArrowRight");
      hostKey(flow, "Enter", "Enter");
      await flushSensor();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
      expect(screen.getAllByTestId("preview-snippet")).toHaveLength(1);
      expect(screen.getByTestId("document-probe").textContent).toBe("Only");
    });

    it("a BARE Space mid-sort drops (the sensor's native end code — not a typed space)", async () => {
      renderWithProviders(seedInterleaved());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const [alpha] = screen.getAllByTestId("preview-snippet");
      setCaretInNode(alpha.firstChild as Text, 2);
      pressCtrlSpace(flow);
      await flushSensor();

      // Move, then drop with a BARE Space on the host: the raised
      // guard preventDefaults it (no typed space) but propagates it —
      // the sensor reads Space as its native END code and commits.
      // three hops reach the Beta chip.
      hostKey(flow, "ArrowRight", "ArrowRight");
      hostKey(flow, "ArrowRight", "ArrowRight");
      hostKey(flow, "ArrowRight", "ArrowRight");
      const space = hostKey(flow, " ", "Space");
      expect(space.defaultPrevented).toBe(true);
      await flushSensor();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getAllByTestId("preview-snippet").map((s) => s.textContent)).toEqual([
        "Beta",
        "alpha",
        "gamma",
      ]);
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Beta alpha gamma",
      );
    });

    it("a paste event mid-sort inserts nothing (suspended; the sort continues)", () => {
      renderWithProviders(seedInterleaved());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const [alpha] = screen.getAllByTestId("preview-snippet");
      setCaretInNode(alpha.firstChild as Text, 2);
      pressCtrlSpace(flow);
      expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();

      fireEvent.paste(flow, {
        clipboardData: {
          getData: (type: string) => (type === "text/plain" ? "pasted" : ""),
        },
      });

      // The raised guard no-ops the paste: nothing inserted, the
      // model untouched, and the sort is still raised.
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha beta gamma",
      );
      expect(flow.textContent).toBe("Alpha beta gamma");
      expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();
    });

    it("toggling edit OFF mid-sort: Enter still drops, no crash, the restore no-ops harmlessly", async () => {
      renderWithProviders(seedInterleaved());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const [alpha] = screen.getAllByTestId("preview-snippet");
      setCaretInNode(alpha.firstChild as Text, 2);
      pressCtrlSpace(flow);
      await flushSensor();
      // three hops reach the Beta chip.
      hostKey(flow, "ArrowRight", "ArrowRight");
      hostKey(flow, "ArrowRight", "ArrowRight");
      hostKey(flow, "ArrowRight", "ArrowRight");

      // Toggle edit OFF while the sort is raised (the toggle's own
      // commit + thaw run; the sensor's document listeners survive —
      // the sort is still live).
      enableEditing();
      expect(screen.queryByTestId("preview-edit-toggle")).toBeInTheDocument();

      // Enter on the now read-only host: no editor handler is
      // attached while OFF, so the key reaches the sensor — the
      // drop lands through the same moveToken path.
      hostKey(screen.getByTestId("preview-segment-flow"), "Enter", "Enter");
      await flushSensor();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getAllByTestId("preview-snippet").map((s) => s.textContent)).toEqual([
        "Beta",
        "alpha",
        "gamma",
      ]);
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Beta alpha gamma",
      );
      // The read-only flow renders the committed order.
      expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
        "Beta alpha gamma",
      );
    });
  });

  it("keeps Enter on a focused chip as dnd-kit's pickup instead of a line break", async () => {
    renderWithProviders(seedInterleaved());
    enableEditing();
    const [alpha] = screen.getAllByTestId("preview-snippet");
    alpha.focus();

    await pressKey(alpha, "Enter");

    expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha beta gamma",
    );
    await pressKey(document, "Escape");
  });

  it("commits and thaws on blur: the flow re-renders from the model with nothing lost", () => {
    renderWithProviders([]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });
    typeIntoFlow(flow, "typed before blur");
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "typed before blur",
    );

    act(() => {
      flow.blur();
    });

    // The thaw remounts the flow root: re-query the live node.
    const liveFlow = screen.getByTestId("preview-segment-flow");
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "typed before blur",
    );
    expect(liveFlow.textContent).toBe("typed before blur");
    expect(liveFlow).toHaveAttribute("contenteditable", "true");
  });

  it("commits the focused DOM before freezing when edit is toggled OFF mid-typing", () => {
    renderWithProviders([]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });
    typeIntoFlow(flow, "kept text");

    // Toggle OFF while the surface still holds unsynced DOM? Every
    // input event already synced; the toggle must lose nothing.
    enableEditing();

    // The read-only flow remounts from the committed model: re-query.
    const liveFlow = screen.getByTestId("preview-segment-flow");
    expect(screen.getByTestId("document-probe").textContent).toBe("kept text");
    expect(liveFlow).not.toHaveAttribute("contenteditable");
    expect(liveFlow.textContent).toBe("kept text");
  });

  it("still re-renders the focused surface from the model when a source change follows a NO-OP sync", () => {
    // Regression: a one-shot self-edit flag would
    // stick on a no-op sync (the reducer returns reference-identical
    // state, so no re-render drains it) and wrongly absorb the NEXT
    // external change. The classification must drain by comparing the
    // incoming document against the last dispatched parse instead.
    const { rerender } = renderWithProviders([
      ["text-1", [makeSnippet("a1", "Alpha")]],
    ]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    // A no-op sync: an input event over an unchanged DOM parses to
    // the current model, so the reducer returns the same state (no
    // re-render happens at all).
    fireEvent.input(flow);
    expect(screen.getByTestId("document-probe").textContent).toBe("Alpha");

    // An external change arrives while the surface is focused: it
    // must NOT be absorbed — the focused surface re-renders from the
    // model (the resize must be visible in the live flow).
    rerender(
      <I18nextProvider i18n={i18n}>
        <MuiThemeProvider theme={theme}>
          <StyledThemeProvider theme={theme}>
            <SnippetsProvider>
              <Harness
                updates={[["text-1", [makeSnippet("a1", "Alpha resized")]]]}
              />
            </SnippetsProvider>
          </StyledThemeProvider>
        </MuiThemeProvider>
      </I18nextProvider>,
    );

    const liveFlow = screen.getByTestId("preview-segment-flow");
    expect(liveFlow).toHaveTextContent("Alpha resized");
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha resized",
    );
  });

  it("deletes a snippet token entirely: the chip vanishes and the id is tombstoned (source untouched)", () => {
    renderWithProviders([
      ["text-1", [makeSnippet("a1", "Alpha")]],
      ["text-2", [makeSnippet("b1", "Beta")]],
    ]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    // Backspace eats the chip and the separator (native textarea-like
    // deletion simulated as DOM mutation + input).
    const chip = screen.getAllByTestId("preview-snippet")[1];
    chip.remove();
    flow.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent === " ") {
        node.remove();
      }
    });
    fireEvent.input(flow);

    expect(screen.getAllByTestId("preview-snippet")).toHaveLength(1);
    expect(screen.getByTestId("document-probe").textContent).toBe("Alpha");
  });

  it("strips paste to plain text and preserves multi-line content as line breaks", () => {
    renderWithProviders([]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });
    expect(collapseSelectionAtEnd(flow)).toBe(true);

    fireEvent.paste(flow, {
      clipboardData: {
        getData: (type: string) =>
          type === "text/plain" ? "line one\n<b>bold</b>\nline three" : "",
      },
    });

    // Plain text only: the clipboard's text/plain payload is inserted
    // verbatim (the browser never renders the HTML), each newline a
    // line-break token.
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "line one\n<b>bold</b>\nline three",
    );
    expect(flow.textContent).toContain("\n");
    // The paste does not END with a newline — the last line has
    // content, no line anchor is needed.
    expect(flow.querySelectorAll("br")).toHaveLength(0);
  });

  it("anchors the last line when a paste ends with a newline (same invisible-line rule as Enter)", () => {
    renderWithProviders([]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });
    expect(collapseSelectionAtEnd(flow)).toBe(true);

    fireEvent.paste(flow, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "top\nbottom\n" : ""),
      },
    });

    expect(screen.getByTestId("document-probe").textContent).toBe(
      "top\nbottom\n",
    );
    // Exactly one anchor after the pasted node's trailing "\n".
    expect(flow.querySelectorAll("br")).toHaveLength(1);
    expect(flow.textContent).toBe("top\nbottom\n");
  });

  it("no-ops a paste with no text data", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });

    fireEvent.paste(flow, {
      clipboardData: { getData: () => "" },
    });

    expect(screen.getByTestId("document-probe").textContent).toBe("Alpha");
  });

  it("keeps the blurred twin surface live: typing in one instance updates the other on its next render", () => {
    const TwoFlows = ({ updates }: { updates: Array<[string, Snippet[]]> }) => {
      const { setSourceSnippets } = useSnippets();
      useEffect(() => {
        updates.forEach(([sourceId, snippets]) =>
          setSourceSnippets(sourceId, snippets),
        );
      }, [updates, setSourceSnippets]);
      return (
        <>
          <DocumentProbe />
          <TextEditingToggle />
          <PreviewArea />
          <PreviewArea />
        </>
      );
    };
    render(
      <I18nextProvider i18n={i18n}>
        <MuiThemeProvider theme={theme}>
          <StyledThemeProvider theme={theme}>
            <SnippetsProvider>
              <TwoFlows updates={[["text-1", [makeSnippet("a1", "Alpha")]]]} />
            </SnippetsProvider>
          </StyledThemeProvider>
        </MuiThemeProvider>
      </I18nextProvider>,
    );
    enableEditing();
    const flowAt = (index: number) =>
      screen.getAllByTestId("preview-segment-flow")[index];

    // Direction 1: typing in the focused first instance updates the
    // blurred second one live.
    act(() => {
      flowAt(0).focus();
    });
    typeIntoFlow(flowAt(0), " own");
    expect(flowAt(1).textContent).toBe("Alpha own");
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha own",
    );

    // Direction 2: focus moves to the second instance (the first
    // thaws and re-renders from the model), and typing there updates
    // the now-blurred first one.
    act(() => {
      flowAt(1).focus();
    });
    typeIntoFlow(flowAt(1), " words");
    expect(flowAt(0).textContent).toBe("Alpha own words");
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha own words",
    );
  });

  it("keeps a completed drag working on the focused editable surface (a non-text change re-renders it)", async () => {
    // jsdom computes no layout: the arrow-key move needs deterministic
    // chip rects to resolve the drop target.
    const restoreRects = installSegmentRects();
    try {
      renderWithProviders(seedInterleaved());
      enableEditing();
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });

      const [alpha] = screen.getAllByTestId("preview-snippet");
      await pressKey(alpha, "Space");
      // three hops reach the Beta chip (the arrows
      // walk through the separator's edge anchors first).
      await pressKey(document, "ArrowRight");
      await pressKey(document, "ArrowRight");
      await pressKey(document, "ArrowRight");
      await pressKey(document, "Space");

      expect(
        screen.getAllByTestId("preview-snippet").map((s) => s.textContent),
      ).toEqual(["Beta", "alpha", "gamma"]);
      // The epoch remount replaces the flow root (a clean re-render
      // from the model): re-query the live node.
      expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
        screen.getByTestId("document-probe").textContent,
      );
      expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
        "Beta alpha gamma",
      );
    } finally {
      restoreRects.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// "a dragged snippet must be
// droppable at every word boundary of the document" —
// |snippet 1| text entered_by_user |snippet 2| — the five marked
// positions (before snippet 1, after it/before the text, between the
// words, after the text/before snippet 2, after snippet 2) plus the
// word anchors. The reducer oracle (SnippetsContext.reducer.test.ts)
// pins the landing semantics exhaustively; here the surface must
// resolve the anchors, mark them with the needle, and land exactly
// where the needle marks — in both drag modes.
// ---------------------------------------------------------------------------

describe("PreviewArea word-boundary landings", () => {
  const seedTwoChips = (): Array<[string, Snippet[]]> => [
    ["text-1", [makeSnippet("a1", "Alpha")]],
    ["text-2", [makeSnippet("b1", "Beta")]],
  ];

  // The user's example layout: own text between two chips —
  // [Alpha, " text entered_by_user ", Beta] — single-space word
  // boundary, edge pads. Beta's rect is pushed right of the text so
  // the reading order (the keyboard walk) is geometric.
  const WORDS_TEXT = " text entered_by_user ";
  const betaRect = (left: number): SegmentRect => ({
    left,
    top: 0,
    right: left + 100,
    bottom: 24,
    width: 100,
    height: 24,
    x: left,
    y: 0,
  });
  const wordsLayout = () =>
    installSegmentRects({
      // The case-fix pass lowercases the mid-sentence chip: both
      // casings resolve to the same pushed-right rect.
      chips: { Beta: betaRect(220), beta: betaRect(220) },
      landings: {
        "preview-landing:s:1:0": 104,
        "preview-landing:s:1:5": 150,
        "preview-landing:s:1:21": 196,
        "preview-landing:s:1:22": 204,
        "preview-landing:g:3": 324,
      },
    });

  const separatorNodeOf = (flow: HTMLElement) =>
    Array.from(flow.childNodes).find(
      (node) => node.nodeType === Node.TEXT_NODE,
    ) as Text;

  // Rewrites the seeded separator into the user's own text, syncs
  // the model, and (optionally) thaws to the read-only surface.
  const seedWordsDoc = ({ editOff = true } = {}) => {
    renderWithProviders(seedTwoChips());
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });
    const separator = separatorNodeOf(flow);
    separator.data = WORDS_TEXT;
    fireEvent.input(flow);
    if (editOff) {
      enableEditing();
    }
    return flow;
  };

  const anchorIdsOf = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('[data-testid="preview-drop-gap"]')).map(
      (element) => (element as HTMLElement).dataset.landing,
    );

  const needleLandingOf = () =>
    (screen.getByTestId("preview-drop-indicator")
      .previousSibling as HTMLElement).dataset.landing;

  // ---- anchor enumeration + dedupe + transparency --------------------------

  it("renders exactly the deduped landing anchors: the text's edges and word boundary, no before-chip duplicate", () => {
    seedWordsDoc();

    const flow = screen.getByTestId("preview-segment-flow");
    expect(anchorIdsOf(flow)).toEqual([
      "preview-landing:g:0", // before Alpha (doc start)
      "preview-landing:s:1:0", // right after Alpha — the text's leading edge
      "preview-landing:s:1:5", // between "text" and "entered_by_user"
      "preview-landing:s:1:21", // the trailing run's start (after the last word)
      "preview-landing:s:1:22", // the text's trailing edge — before Beta
      "preview-landing:g:3", // after Beta — the trailing anchor
    ]);
    // The dedupe: Beta's own before-anchor is omitted (the preceding
    // text token's trailing edge covers that spot) — exactly one
    // anchor marks each before-chip position.
    expect(
      anchorIdsOf(flow).filter((id) => id?.startsWith("preview-landing:g:2")),
    ).toEqual([]);
  });

  it("keeps the anchors parser-transparent: no text, WYSIWYG, one own-text token in the model", () => {
    seedWordsDoc();

    const flow = screen.getByTestId("preview-segment-flow");
    // Zero-footprint: the anchors contribute no text and no chips.
    Array.from(flow.querySelectorAll('[data-testid="preview-drop-gap"]')).forEach(
      (anchor) => {
        expect(anchor.textContent).toBe("");
      },
    );
    expect(flow.textContent).toBe("Alpha text entered_by_user beta");
    // WYSIWYG: the flow text is exactly the serialized document.
    expect(flow.textContent).toBe(
      screen.getByTestId("document-probe").textContent,
    );
  });

  // ---- pointer drops -------------------------------------------------------

  describe("pointer drops", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      wordsLayout();
    });

    afterEach(() => {
      // Drain dnd-kit's delayed document click-listener removal.
      act(() => {
        vi.advanceTimersByTime(60);
      });
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    const pointerDownOn = (element: Element, x = 40, y = 10) =>
      fireEvent.pointerDown(element, {
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: y,
      });

    // Hold past the 50ms activation, move, release.
    const dragAlphaTo = async (x: number) => {
      const [alpha] = screen.getAllByTestId("preview-snippet");
      pointerDownOn(alpha);
      act(() => {
        vi.advanceTimersByTime(60);
      });
      fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: x,
        clientY: 10,
      });
    };

    it("marks the word gap with the needle while hovering mid-text and lands the chip between the words", async () => {
      seedWordsDoc();

      await dragAlphaTo(150);
      // The needle renders at the word-boundary anchor (snaps to the
      // closest anchor while hovering mid-text).
      expect(screen.getByTestId("preview-drop-indicator")).toBeInTheDocument();
      expect(needleLandingOf()).toBe("preview-landing:s:1:5");

      fireEvent.pointerUp(document, { pointerId: 1, clientX: 150, clientY: 10 });

      // The text token split around the chip: one space each side
      // (the boundary's own run pads the right side, the planted
      // space — no separator was carried — the left; the documented
      // multiset exception). Alpha lands between the words, and the
      // text's leading run — now at the document start — trims.
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "text alpha entered_by_user beta",
      );
      expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
        "text alpha entered_by_user beta",
      );
      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();
    });

    it("lands the chip before Beta (the text's trailing edge) and at the document's trailing anchor", async () => {
      seedWordsDoc();

      // After the text, before Beta.
      await dragAlphaTo(204);
      expect(needleLandingOf()).toBe("preview-landing:s:1:22");
      fireEvent.pointerUp(document, { pointerId: 1, clientX: 204, clientY: 10 });
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "text entered_by_user alpha beta",
      );

      // Reset: drain dnd-kit's delayed click-suppression removal
      // (the known fake-timer landmine — without the drain the
      // reseed's toggle click is silently swallowed), then a fresh
      // document.
      act(() => {
        vi.advanceTimersByTime(60);
      });
      cleanup();
      seedWordsDoc();
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha text entered_by_user beta",
      );
      await dragAlphaTo(324);
      expect(needleLandingOf()).toBe("preview-landing:g:3");
      fireEvent.pointerUp(document, { pointerId: 1, clientX: 324, clientY: 10 });
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "text entered_by_user betaAlpha",
      );
    });

    it("announces the landed position among the snippet tokens for a mid-text drop", async () => {
      seedWordsDoc();

      await dragAlphaTo(150);
      fireEvent.pointerUp(document, { pointerId: 1, clientX: 150, clientY: 10 });

      // Alpha lands between the words: still the FIRST of the two
      // snippet tokens.
      expect(screen.getByRole("status")).toHaveTextContent(
        "Snippet dropped at position 1 of 2.",
      );
    });
  });

  // ---- keyboard word walk (edit ON, Ctrl+Space) -----------------------------

  describe("keyboard word walk", () => {
    beforeEach(() => {
      wordsLayout();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const hostKey = (flow: HTMLElement, key: string, code: string) => {
      const keydown = new KeyboardEvent("keydown", {
        key,
        code,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        flow.dispatchEvent(keydown);
      });
      return keydown;
    };

    const pressCtrlSpace = (flow: HTMLElement) => {
      const keydown = new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        flow.dispatchEvent(keydown);
      });
      return keydown;
    };

    const flushSensor = async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    };

    it("steps the raised chip word-by-word through the own text and Enter drops it between the words", async () => {
      const flow = seedWordsDoc({ editOff: false });
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha text entered_by_user beta",
      );

      // The focused surface is FROZEN with the seeded snapshot's
      // anchors: thaw and re-focus so the frozen surface
      // (and its landing anchors) re-render from the synced words
      // model before lifting. The blur REMOUNTS the flow (the thaw
      // epoch) — re-query the live node.
      const staleFlow = flow;
      act(() => {
        fireEvent.blur(staleFlow);
      });
      const liveFlow = screen.getByTestId("preview-segment-flow");
      expect(liveFlow).not.toBe(staleFlow);
      act(() => {
        liveFlow.focus();
      });

      const [alpha] = screen.getAllByTestId("preview-snippet");
      const setCaretInNode = (node: Node, offset: number) => {
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      };
      setCaretInNode(alpha.firstChild as Text, 2);
      const lift = pressCtrlSpace(liveFlow);
      expect(lift.defaultPrevented).toBe(true);
      await flushSensor();

      expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();

      // Pickup: the needle at the origin spot (before Alpha).
      expect(needleLandingOf()).toBe("preview-landing:g:0");

      // The arrows walk EVERY landing position in reading order —
      // word-by-word through the own text.
      hostKey(liveFlow, "ArrowRight", "ArrowRight");
      expect(needleLandingOf()).toBe("preview-landing:s:1:0");
      hostKey(liveFlow, "ArrowRight", "ArrowRight");
      expect(needleLandingOf()).toBe("preview-landing:s:1:5");
      hostKey(liveFlow, "ArrowRight", "ArrowRight");
      expect(needleLandingOf()).toBe("preview-landing:s:1:21");
      hostKey(liveFlow, "ArrowRight", "ArrowRight");
      expect(needleLandingOf()).toBe("preview-landing:s:1:22");
      hostKey(liveFlow, "ArrowRight", "ArrowRight");
      // Onto the Beta chip: the needle marks the insertion after it.
      expect(needleLandingOf()).toBe("preview-landing:g:3");
      hostKey(liveFlow, "ArrowRight", "ArrowRight");
      // One more hop: past the chip onto the trailing anchor itself.
      expect(needleLandingOf()).toBe("preview-landing:g:3");

      // Walk back to the word gap and drop there.
      hostKey(liveFlow, "ArrowLeft", "ArrowLeft");
      hostKey(liveFlow, "ArrowLeft", "ArrowLeft");
      hostKey(liveFlow, "ArrowLeft", "ArrowLeft");
      hostKey(liveFlow, "ArrowLeft", "ArrowLeft");
      expect(needleLandingOf()).toBe("preview-landing:s:1:5");
      const enter = hostKey(liveFlow, "Enter", "Enter");
      expect(enter.defaultPrevented).toBe(true);
      await flushSensor();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Alpha drops between the words: the text's leading run — now at
      // the document start — trims.
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "text alpha entered_by_user beta",
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "Snippet dropped at position 1 of 2.",
      );
      // The caret returns inside the sorted snippet. The drop is a
      // non-text change: the flow remounts (epoch) — query the live
      // node.
      expect(document.activeElement).toBe(
        screen.getByTestId("preview-segment-flow"),
      );
      const sortedAlpha = screen
        .getAllByTestId("preview-snippet")
        .find((chip) => chip.textContent === "alpha") as HTMLElement;
      const range = window.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(sortedAlpha.firstChild as Text);
      expect(range?.startOffset).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// "I want you to auto position the
// caret on the last position of the text in preview area when enabling
// edit text mode" — the OFF→ON toggle focuses the host and places the
// caret at the text's end (the convenience equivalent of clicking at
// the end, ready to type). Scope: the transition only; surfaces
// mounting while already editing keep click-to-focus.
// ---------------------------------------------------------------------------

describe("edit-toggle caret auto-positioning", () => {
  const seedTwoChips = (): Array<[string, Snippet[]]> => [
    ["text-1", [makeSnippet("a1", "Alpha")]],
    ["text-2", [makeSnippet("b1", "Beta")]],
  ];

  const selectionShape = (): { container: Node; offset: number } | null => {
    const range = window.getSelection()?.getRangeAt(0);
    return range ? { container: range.startContainer, offset: range.startOffset } : null;
  };

  // The live flow's last non-empty text node (the thaw epoch remounts
  // the flow on every OFF — always re-query, never hold node refs
  // across a toggle).
  const lastTextChildOf = (flow: HTMLElement): Text | null => {
    for (let index = flow.childNodes.length - 1; index >= 0; index -= 1) {
      const node = flow.childNodes[index];
      if (node.nodeType === Node.TEXT_NODE && (node as Text).data !== "") {
        return node as Text;
      }
    }
    return null;
  };

  // Realistic typing at the caret's node — the browser's insertText
  // (mirrors the editing-workflow suite's typeRealistic).
  const typeAtCaret = (
    flow: HTMLElement,
    node: Text,
    offset: number,
    data: string,
  ) => {
    node.insertData(offset, data);
    const range = document.createRange();
    range.setStart(node, offset + data.length);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    act(() => {
      flow.dispatchEvent(
        new window.InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data,
        }),
      );
    });
  };

  const appendFlowText = (flow: HTMLElement, text: string) => {
    const typed = document.createTextNode(text);
    flow.appendChild(typed);
    fireEvent.input(flow);
    return typed;
  };

  it("toggling edit ON focuses the host and places the caret at the text's end — typing immediately appends", () => {
    renderWithProviders(seedTwoChips());
    enableEditing();

    const flow = screen.getByTestId("preview-segment-flow");
    // The host is focused and the freeze window is open (the toggle
    // routed through the established onFocus machinery).
    expect(document.activeElement).toBe(flow);
    const [, beta] = screen.getAllByTestId("preview-snippet");
    // The document ends with the Beta chip: the caret sits INSIDE the
    // chip's last text child at its end (the browser's click-at-end
    // preference — chip territory for typing).
    expect(selectionShape()).toEqual({
      container: beta.firstChild,
      offset: 4,
    });

    // End-to-end: the first keystroke appends right there.
    typeAtCaret(flow, beta.firstChild as Text, 4, "!");
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha beta!",
    );
    expect(flow.textContent).toBe("Alpha beta!");
  });

  it("places the caret at the end of a document that ends with own text", () => {
    renderWithProviders(seedTwoChips());
    enableEditing();
    appendFlowText(screen.getByTestId("preview-segment-flow"), " tail");
    enableEditing(); // OFF — commits "Alpha beta tail"
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha beta tail",
    );

    enableEditing(); // ON again
    // The OFF toggle remounts the flow (the thaw epoch): re-query the
    // live host and its live text nodes.
    const flow = screen.getByTestId("preview-segment-flow");
    expect(document.activeElement).toBe(flow);
    const tail = lastTextChildOf(flow) as Text;
    expect(tail.data).toBe(" tail");
    // The last meaningful content is the own text " tail": the caret
    // at its end, NOT inside the chip.
    expect(selectionShape()).toEqual({ container: tail, offset: 5 });

    typeAtCaret(flow, tail, 5, "X");
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha beta tailX",
    );
  });

  it("a document ending with a line break gets the anchor planted and the caret between the newline and the <br>", () => {
    renderWithProviders(seedTwoChips());
    enableEditing();
    appendFlowText(screen.getByTestId("preview-segment-flow"), "\n");
    enableEditing(); // OFF — commits "Alpha Beta\n"
    enableEditing(); // ON

    const flow = screen.getByTestId("preview-segment-flow");
    expect(document.activeElement).toBe(flow);
    // The focus machinery planted the bogus <br> line anchor.
    const anchor = flow.querySelector("br");
    expect(anchor).not.toBeNull();
    // The caret sits at the END of the trailing "\n" text node —
    // exactly between the newline and the anchor (the visible
    // new-line position), NOT after the <br>.
    const newline = lastTextChildOf(flow) as Text;
    expect(newline.data).toBe("\n");
    expect(selectionShape()).toEqual({ container: newline, offset: 1 });
    expect(
      newline.compareDocumentPosition(anchor as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("the empty document: focused, caret at position 0, the placeholder editor intact", () => {
    renderWithProviders([]);
    enableEditing();

    const flow = screen.getByTestId("preview-segment-flow");
    expect(document.activeElement).toBe(flow);
    expect(selectionShape()).toEqual({ container: flow, offset: 0 });
    // The caret placement adds no nodes: the flow stays truly :empty
    // and the placeholder keeps rendering.
    expect(flow.childNodes).toHaveLength(0);
    expect(flow).toHaveAttribute(
      "data-placeholder",
      "Type here to add your own text",
    );
    expect(screen.queryByTestId("preview-empty")).toBeNull();
  });

  it("OFF→ON→OFF→ON cycles keep every commit, re-land the caret at the new end, and never stack anchors", () => {
    renderWithProviders(seedTwoChips());
    enableEditing();
    appendFlowText(screen.getByTestId("preview-segment-flow"), " one");
    enableEditing(); // OFF — commits
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha beta one",
    );

    enableEditing(); // ON — the caret at the NEW end
    let flow = screen.getByTestId("preview-segment-flow");
    expect(document.activeElement).toBe(flow);
    const one = lastTextChildOf(flow) as Text;
    expect(one.data).toBe(" one");
    expect(selectionShape()).toEqual({ container: one, offset: 4 });
    typeAtCaret(flow, one, 4, " two");
    enableEditing(); // OFF — commits
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha beta one two",
    );

    // The line-break cycle: the anchor plants exactly once per ON.
    enableEditing(); // ON
    appendFlowText(screen.getByTestId("preview-segment-flow"), "\n");
    enableEditing(); // OFF
    enableEditing(); // ON
    flow = screen.getByTestId("preview-segment-flow");
    const anchors = flow.querySelectorAll("br");
    expect(anchors).toHaveLength(1);
    const newline = lastTextChildOf(flow) as Text;
    expect(newline.data).toBe("\n");
    expect(selectionShape()).toEqual({ container: newline, offset: 1 });
  });

  it("does not fire on a mount while already editing (the modal-opening scope is pinned in the modal suite)", () => {
    // A surface that mounts with edit ON must not grab the caret: the
    // ref initializes to the current flag, so no OFF→ON transition is
    // detected. Component-level proxy: unmounting and remounting the
    // whole tree mid-edit leaves the focus where the user put it.
    const { unmount } = renderWithProviders(seedTwoChips());
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    expect(document.activeElement).toBe(flow);
    unmount();

    const second = renderWithProviders(seedTwoChips());
    enableEditing(); // OFF (fresh context) -> ON
    const flowTwo = screen.getByTestId("preview-segment-flow");
    expect(document.activeElement).toBe(flowTwo);
    // The transition semantics survive a full remount.
    expect(selectionShape()?.offset).toBe(4);
    second.unmount();
  });
});

// ---------------------------------------------------------------------------
// Document length limit: the serialized document caps at 2000
// characters. At the limit printable keystrokes and Enter are
// prevented (nothing more lands), deletions free space, and pastes
// truncate to what fits — the native maxLength textarea feel. The
// limit measures the ONE shared document, so every surface inherits
// it; the modal-scoped pin lives in the PreviewModal suite.
// ---------------------------------------------------------------------------

describe("document length limit", () => {
  const seedTwoChips = (): Array<[string, Snippet[]]> => [
    ["text-1", [makeSnippet("a1", "Alpha")]],
    ["text-2", [makeSnippet("b1", "Beta")]],
  ];

  // Builds a committed document whose serialized length is exactly
  // `length` ("A" + " " + "B" + tail), then re-enters edit mode — the
  // toggle auto-caret places the caret at the text's end, ready to
  // type.
  const seedAtLength = (length: number) => {
    renderWithProviders(seedTwoChips());
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    // "Alpha" + " " + "Beta" serialize to 10 characters.
    const tail = "x".repeat(Math.max(0, length - 10));
    flow.appendChild(document.createTextNode(tail));
    fireEvent.input(flow);
    enableEditing(); // OFF — commit
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(
      length,
    );
    enableEditing(); // ON — the caret at the end
    return screen.getByTestId("preview-segment-flow");
  };

  const keyDown = (flow: HTMLElement, init: Record<string, unknown>) => {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    act(() => {
      flow.dispatchEvent(event);
    });
    return event;
  };

  const awaitFlush = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const lastTail = (flow: HTMLElement) => {
    const node = Array.from(flow.childNodes)
      .reverse()
      .find(
        (child) => child.nodeType === Node.TEXT_NODE && (child as Text).data !== "",
      ) as Text;
    return node;
  };

  // Simulates the browser's native insertion for an allowed
  // keystroke: the character lands at the caret (the end) and the
  // realistic input event fires.
  const landChar = (flow: HTMLElement, data: string) => {
    const node = lastTail(flow);
    node.insertData(node.data.length, data);
    const range = document.createRange();
    range.setStart(node, node.data.length);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    act(() => {
      flow.dispatchEvent(
        new window.InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data,
        }),
      );
    });
  };

  // Simulates the browser's native deletion for an allowed Backspace.
  const landBackspace = (flow: HTMLElement) => {
    const node = lastTail(flow);
    node.deleteData(node.data.length - 1, 1);
    const range = document.createRange();
    range.setStart(node, node.data.length);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    act(() => {
      flow.dispatchEvent(
        new window.InputEvent("input", {
          bubbles: true,
          inputType: "deleteContentBackward",
          data: null,
        }),
      );
    });
  };

  it("the 2000th character lands; the 2001st keystroke is prevented with the model unchanged", () => {
    const flow = seedAtLength(1999);

    // At 1999 there is room for exactly one more character.
    const allowed = keyDown(flow, { key: "a", code: "KeyA" });
    expect(allowed.defaultPrevented).toBe(false);
    landChar(flow, "a");
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);

    // At 2000 the next printable keystroke is prevented before the
    // browser can insert it: no DOM change, no input event, no
    // redirect, the model unchanged.
    const blocked = keyDown(flow, { key: "b", code: "KeyB" });
    expect(blocked.defaultPrevented).toBe(true);
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
    expect(flow.textContent).toHaveLength(2000);
  });

  it("Backspace frees space and typing resumes", () => {
    const flow = seedAtLength(2000);

    landBackspace(flow);
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(1999);

    const allowed = keyDown(flow, { key: "b", code: "KeyB" });
    expect(allowed.defaultPrevented).toBe(false);
    landChar(flow, "b");
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
  });

  it("Enter is inert at the limit and inserts at one below it", () => {
    // At 2000 Enter does nothing: the guard returns before the
    // line-break insertion, so the document keeps its exact length.
    const flow = seedAtLength(2000);
    keyDown(flow, { key: "Enter", code: "Enter" });
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
    expect(screen.getByTestId("document-probe").textContent).not.toContain(
      "\n",
    );

    // At 1999 the newline lands (one character) and the document
    // reaches the limit.
    cleanup();
    const flowTwo = seedAtLength(1999);
    keyDown(flowTwo, { key: "Enter", code: "Enter" });
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
  });

  it("modifier combos and navigation are never blocked at the limit", () => {
    const flow = seedAtLength(2000);

    // Ctrl+key (select-all, shortcuts) passes.
    const ctrl = keyDown(flow, { key: "a", code: "KeyA", ctrlKey: true });
    expect(ctrl.defaultPrevented).toBe(false);
    // Meta+key passes.
    const meta = keyDown(flow, { key: "a", code: "KeyA", metaKey: true });
    expect(meta.defaultPrevented).toBe(false);
    // Multi-character keys (Backspace, Tab, F5) pass the guard.
    const backspace = keyDown(flow, { key: "Backspace", code: "Backspace" });
    expect(backspace.defaultPrevented).toBe(false);
    const tab = keyDown(flow, { key: "Tab", code: "Tab" });
    expect(tab.defaultPrevented).toBe(false);
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
  });

  it("keyboard sorting still lifts at the limit (sorting never adds characters)", async () => {
    const flow = seedAtLength(2000);
    const [alpha] = screen.getAllByTestId("preview-snippet");
    const setCaretInNode = (node: Node, offset: number) => {
      const range = document.createRange();
      range.setStart(node, offset);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    };
    setCaretInNode(alpha.firstChild as Text, 1);

    const event = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      flow.dispatchEvent(event);
    });
    await awaitFlush();
    expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();
    act(() => {
      flow.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await awaitFlush();
    expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
  });

  it("a bare Space mid-sort at the limit still drops: the sensor's end key commits the move, never a character", async () => {
    // The rect mocks drive the arrow step's collision walk.
    const restoreRects = installSegmentRects();
    try {
      const flow = seedAtLength(2000);
      const [alpha] = screen.getAllByTestId("preview-snippet");
      const setCaretInNode = (node: Node, offset: number) => {
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      };
      setCaretInNode(alpha.firstChild as Text, 1);

      const lift = new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        flow.dispatchEvent(lift);
      });
      await awaitFlush();
      expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();

      // One arrow hop (the raised-sort movement path — allowed at
      // the cap, sorting never adds characters).
      keyDown(flow, { key: "ArrowRight", code: "ArrowRight" });

      // A BARE Space is the sensor's native end key: the raised
      // guard preventDefaults it (no character is typed — the
      // browser never inserts a space) and propagates it, so the
      // sensor DROPS the snippet even at the document limit. The
      // cap guard never sees it (the raised guard returns first).
      const drop = keyDown(flow, { key: " ", code: "Space" });
      expect(drop.defaultPrevented).toBe(true);
      await awaitFlush();

      // The sort ended: the overlay is gone, the document keeps its
      // exact length, and the move committed through the landing
      // path (here: the chip's own separator edge — the inert
      // landing, the order unchanged).
      expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
      expect(screen.getByTestId("document-probe").textContent).toHaveLength(
        2000,
      );
      expect(screen.getByTestId("document-probe").textContent).toContain(
        "Alpha beta",
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "Snippet dropped at position 1 of 2.",
      );
    } finally {
      restoreRects.mockRestore();
    }
  });

  it("a two-unit emoji key is prevented at the limit AND one unit below it, allowed at two", () => {
    // At the limit (remaining 0): the emoji key is prevented before
    // the browser can insert it, no input event, nothing lands.
    let flow = seedAtLength(2000);
    const blockedAtLimit = keyDown(flow, { key: "\ud83d\ude00", code: "" });
    expect(blockedAtLimit.defaultPrevented).toBe(true);
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);

    // One unit below the limit (remaining 1): a two-unit emoji
    // cannot fit — prevented (the near-limit hole a plain
    // at-limit-only guard would miss).
    cleanup();
    flow = seedAtLength(1999);
    const blockedAtOne = keyDown(flow, { key: "\ud83d\ude00", code: "" });
    expect(blockedAtOne.defaultPrevented).toBe(true);
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(1999);

    // Two units below (remaining 2): the emoji fits exactly and the
    // document lands exactly at the limit; the next key is prevented.
    cleanup();
    flow = seedAtLength(1998);
    const allowed = keyDown(flow, { key: "\ud83d\ude00", code: "" });
    expect(allowed.defaultPrevented).toBe(false);
    landChar(flow, "\ud83d\ude00");
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
    const afterEmoji = keyDown(flow, { key: "x", code: "KeyX" });
    expect(afterEmoji.defaultPrevented).toBe(true);
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
  });

  it("a one-unit key is still allowed at remaining 1 and blocked at 0", () => {
    const flow = seedAtLength(1999);
    const allowed = keyDown(flow, { key: "x", code: "KeyX" });
    expect(allowed.defaultPrevented).toBe(false);
    landChar(flow, "x");
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
    const blocked = keyDown(flow, { key: "y", code: "KeyY" });
    expect(blocked.defaultPrevented).toBe(true);
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
  });

  it("paste cuts surrogate-safely: a pair is never split and never overshoots the cap", () => {
    // Remaining 2, pasting a lone emoji: the full pair fits and the
    // document lands exactly at the limit.
    cleanup();
    let flow = seedAtLength(1998);
    fireEvent.paste(flow, {
      clipboardData: {
        getData: (type: string) =>
          type === "text/plain" ? "\ud83d\ude00" : "",
      },
    });
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);

    // Remaining 1, pasting "emoji x": the budget cuts inside the
    // pair — the lone high surrogate is dropped and NOTHING
    // insertable remains; the document stays unchanged.
    cleanup();
    flow = seedAtLength(1999);
    fireEvent.paste(flow, {
      clipboardData: {
        getData: (type: string) =>
          type === "text/plain" ? "\ud83d\ude00x" : "",
      },
    });
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(1999);

    // Remaining 3, pasting "a emoji b c": the surrogate-safe cut
    // lands "a" + the full pair ("a\ud83d\ude00" = 3 units).
    cleanup();
    flow = seedAtLength(1997);
    fireEvent.paste(flow, {
      clipboardData: {
        getData: (type: string) =>
          type === "text/plain" ? "a\ud83d\ude00bc" : "",
      },
    });
    expect(screen.getByTestId("document-probe").textContent?.endsWith("a\ud83d\ude00")).toBe(
      true,
    );
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);

    // Remaining 2, the same paste: the cut lands only "a" (1 unit) —
    // the pair does not fit and is never split.
    cleanup();
    flow = seedAtLength(1998);
    fireEvent.paste(flow, {
      clipboardData: {
        getData: (type: string) =>
          type === "text/plain" ? "a\ud83d\ude00bc" : "",
      },
    });
    expect(screen.getByTestId("document-probe").textContent?.endsWith("a")).toBe(
      true,
    );
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(1999);
  });

  // Native beforeinput: the insertion-family safety net for
  // user-agent insertions that carry NO measurable keydown key
  // (emoji-panel clicks, voice input, extension insertions). The
  // events are dispatched natively on the flow root with
  // cancelable: true so defaultPrevented reflects the guard.
  const dispatchBeforeInput = (
    flow: HTMLElement,
    init: { inputType: string; data?: string | null; dataTransfer?: unknown }
  ) => {
    const event = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: init.inputType,
      data: init.data ?? null,
    });
    if (init.dataTransfer !== undefined) {
      // jsdom's InputEvent init does not carry dataTransfer — assign
      // after construction (insertFromDrop's carrier).
      Object.defineProperty(event, "dataTransfer", {
        value: init.dataTransfer,
      });
    }
    act(() => {
      flow.dispatchEvent(event);
    });
    return event;
  };

  const selectUnitsAtTail = (flow: HTMLElement, units: number) => {
    const node = lastTail(flow);
    const start = Math.max(0, node.data.length - units);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, node.data.length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  it("blocks emoji-panel insertions at the cap, repeatedly (the unbounded-overshoot scenario)", () => {
    const flow = seedAtLength(2000);
    for (let click = 0; click < 3; click += 1) {
      const event = dispatchBeforeInput(flow, {
        inputType: "insertText",
        data: "\ud83d\ude00",
      });
      expect(event.defaultPrevented).toBe(true);
    }
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
  });

  it("blocks a two-unit insertion at remaining 1, allows it at remaining 2 (lands exactly at the limit)", () => {
    let flow = seedAtLength(1999);
    const blocked = dispatchBeforeInput(flow, {
      inputType: "insertText",
      data: "\ud83d\ude00",
    });
    expect(blocked.defaultPrevented).toBe(true);
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(1999);

    cleanup();
    flow = seedAtLength(1998);
    const allowed = dispatchBeforeInput(flow, {
      inputType: "insertText",
      data: "\ud83d\ude00",
    });
    expect(allowed.defaultPrevented).toBe(false);
    landChar(flow, "\ud83d\ude00");
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
    const next = dispatchBeforeInput(flow, { inputType: "insertText", data: "x" });
    expect(next.defaultPrevented).toBe(true);
  });

  it("budgets the NET units: selection replacements pass when they do not grow the document", () => {
    // 3 units selected at the cap, an emoji replaces them (net -1):
    // allowed.
    let flow = seedAtLength(2000);
    selectUnitsAtTail(flow, 3);
    let event = dispatchBeforeInput(flow, {
      inputType: "insertText",
      data: "\ud83d\ude00",
    });
    expect(event.defaultPrevented).toBe(false);

    // 1 unit selected at the cap, an emoji replaces it (net 1 > 0):
    // prevented.
    cleanup();
    flow = seedAtLength(2000);
    selectUnitsAtTail(flow, 1);
    event = dispatchBeforeInput(flow, {
      inputType: "insertText",
      data: "\ud83d\ude00",
    });
    expect(event.defaultPrevented).toBe(true);

    // 1 unit selected at the cap, 'x' replaces it (net 0): allowed —
    // a neutral replacement never grows the document.
    cleanup();
    flow = seedAtLength(2000);
    selectUnitsAtTail(flow, 1);
    event = dispatchBeforeInput(flow, { inputType: "insertText", data: "x" });
    expect(event.defaultPrevented).toBe(false);
  });

  it("excludes composition, paste, deletions, and paragraph insertions on purpose", () => {
    const flow = seedAtLength(2000);
    // Mid-IME composition: never blocked (breaking a composition
    // session corrupts the input) — the documented limitation.
    expect(
      dispatchBeforeInput(flow, {
        inputType: "insertCompositionText",
        data: "\ud83d\ude00",
      }).defaultPrevented,
    ).toBe(false);
    // Plain-text paste: the paste handler's truncation owns the
    // budget.
    expect(
      dispatchBeforeInput(flow, {
        inputType: "insertFromPaste",
        data: "\ud83d\ude00",
      }).defaultPrevented,
    ).toBe(false);
    // Deletions and history always pass.
    expect(
      dispatchBeforeInput(flow, { inputType: "deleteContentBackward" })
        .defaultPrevented,
    ).toBe(false);
    expect(
      dispatchBeforeInput(flow, { inputType: "historyUndo" }).defaultPrevented,
    ).toBe(false);
    // Enter's paragraph event carries null data (net <= 0) — the
    // keydown guard owns Enter.
    expect(
      dispatchBeforeInput(flow, { inputType: "insertParagraph" })
        .defaultPrevented,
    ).toBe(false);
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
  });

  it("budgets native text drops via dataTransfer (insertFromDrop)", () => {
    const flow = seedAtLength(2000);
    const event = dispatchBeforeInput(flow, {
      inputType: "insertFromDrop",
      dataTransfer: { getData: (type: string) => (type === "text/plain" ? "ab" : "") },
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not guard while edit mode is off (the listener is detached)", () => {
    renderWithProviders(seedTwoChips());
    enableEditing();
    enableEditing(); // OFF — the native listener detaches
    const flow = screen.getByTestId("preview-segment-flow");
    const event = dispatchBeforeInput(flow, {
      inputType: "insertText",
      data: "\ud83d\ude00",
    });
    expect(event.defaultPrevented).toBe(false);
  });

  // The REAL panel stream, simulated end-to-end: the OS
  // text-services pipeline fires compositionstart → beforeinput
  // (insertCompositionText, NON-cancelable in Chromium) → input
  // (isComposing true) → compositionend. The pre-insertion guards
  // all pass by design; the limit is enforced by the post-commit
  // clamp on compositionend.
  const dispatchCompositionCommit = (flow: HTMLElement, emoji: string) => {
    act(() => {
      flow.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true })
      );
      const beforeInput = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: false,
        inputType: "insertCompositionText",
        data: emoji,
      });
      flow.dispatchEvent(beforeInput);
      // The panel insertion lands in the DOM (the suite's DOM
      // driving — the browser writes the committed text itself).
      const tail = Array.from(flow.childNodes)
        .reverse()
        .find(
          (child) =>
            child.nodeType === Node.TEXT_NODE && (child as Text).data !== ""
        ) as Text;
      tail.insertData(tail.data.length, emoji);
      const input = new window.InputEvent("input", {
        bubbles: true,
        inputType: "insertCompositionText",
        data: emoji,
      });
      Object.defineProperty(input, "isComposing", { value: true });
      flow.dispatchEvent(input);
      flow.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true })
      );
    });
  };

  it("clamps composition commits at the cap: the panel emoji lands, gets trimmed back to the limit, and the flow re-renders (WYSIWYG)", () => {
    const flow = seedAtLength(2000);
    const before = screen.getByTestId("document-probe").textContent;
    expect(before).toHaveLength(2000);

    // The beforeinput of a composition is non-cancelable and
    // excluded — nothing prevents it (mirrors the real event).
    const probe = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: false,
      inputType: "insertCompositionText",
      data: "\ud83d\ude00",
    });
    act(() => {
      flow.dispatchEvent(probe);
    });
    expect(probe.defaultPrevented).toBe(false);

    // The full stream: the emoji lands (over cap), the
    // mid-composition input does NOT clamp, and the compositionend
    // clamp trims the overflow back to exactly the limit.
    dispatchCompositionCommit(flow, "\ud83d\ude00");

    const probeText = screen.getByTestId("document-probe").textContent;
    expect(probeText).toHaveLength(2000);
    // The over-cap emoji is gone from the model AND the re-rendered
    // DOM (the clamp's re-render restored the WYSIWYG invariant).
    expect(probeText?.endsWith("x")).toBe(true);
    const liveFlow = screen.getByTestId("preview-segment-flow");
    expect(liveFlow.textContent).toBe(probeText);
    // The caret sits at the cut point — the document end.
    expect(document.activeElement).toBe(liveFlow);
    const range = window.getSelection()?.getRangeAt(0);
    expect(range?.collapsed).toBe(true);
  });

  it("the repeat scenario: every further panel emoji at the cap is committed and trimmed back — the document never grows", () => {
    const flow = seedAtLength(2000);
    for (let click = 0; click < 3; click += 1) {
      dispatchCompositionCommit(flow, "\ud83d\ude00");
      expect(screen.getByTestId("document-probe").textContent).toHaveLength(
        2000,
      );
    }
  });

  it("mid-composition inputs never clamp — the in-progress state survives until compositionend", () => {
    const flow = seedAtLength(2000);
    act(() => {
      flow.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true })
      );
      const tail = Array.from(flow.childNodes)
        .reverse()
        .find(
          (child) =>
            child.nodeType === Node.TEXT_NODE && (child as Text).data !== ""
        ) as Text;
      tail.insertData(tail.data.length, "\ud83d\ude00");
      const input = new window.InputEvent("input", {
        bubbles: true,
        inputType: "insertCompositionText",
        data: "\ud83d\ude00",
      });
      Object.defineProperty(input, "isComposing", { value: true });
      flow.dispatchEvent(input);
    });
    // Mid-composition: NO clamp — the in-progress state holds the
    // over-cap text (the IME UX is untouched).
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(
      2002,
    );

    // The session commits: the clamp trims the overflow.
    act(() => {
      flow.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true })
      );
    });
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(
      2000,
    );
  });

  it("a composition commit below the cap lands without any clamp", () => {
    const flow = seedAtLength(1998);
    dispatchCompositionCommit(flow, "\ud83d\ude00");
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(
      2000,
    );
    expect(
      screen.getByTestId("document-probe").textContent?.endsWith("\ud83d\ude00"),
    ).toBe(true);
  });

  it("clamps the chip-boundary separator overshoot: a 1-unit keystroke landing +2 at remaining 1 trims back to exactly the limit", () => {
    // The auto-separator edge: a single-unit keystroke the keydown
    // guard allows at remaining 1 lands TWO units when the caret
    // sits OUTSIDE a chip but directly abutting it, with own text on
    // the far side (chip-territory rule A) — the redirect moves the
    // character into the chip AND plants the missing separator. The
    // RAW commit nets +2 (2001 at a 1-unit budget); the post-commit
    // clamp peels the 1-unit over-budget tail back to exactly 2000,
    // and the re-rendered flow restores the WYSIWYG invariant. This
    // pins the clamped outcome (the former bounded residual is
    // closed by the same clamp).
    const flow = seedAtLength(1999);
    // seedAtLength ends with [A, " ", B, tail] — B abuts the tail
    // with no separator. The chip-territory caret sits in the FLOW
    // right after B's element (outside any chip), not inside B's
    // text (inside-chip typing integrates natively and plants
    // nothing).
    const chips = screen.getAllByTestId("preview-snippet");
    const beta = chips[chips.length - 1];
    const flowOffset = Array.from(flow.childNodes).indexOf(beta) + 1;
    const before = screen.getByTestId("document-probe").textContent;
    expect(before).toHaveLength(1999);

    // The browser's native typing: the character lands in a fresh
    // text node at the caret (outside the chip) and the realistic
    // input event runs the redirect + the clamp.
    const typed = document.createTextNode("x");
    flow.insertBefore(typed, flow.childNodes[flowOffset] ?? null);
    const caret = document.createRange();
    caret.setStart(typed, 1);
    caret.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caret);
    act(() => {
      flow.dispatchEvent(
        new window.InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: "x",
        }),
      );
    });

    // The raw commit netted +2 (the character + the planted
    // separator); the clamp peeled the 1-unit over-budget tail: the
    // document is EXACTLY at the limit, the chip keeps the
    // redirected character and its planted separator, and the
    // re-rendered flow matches the model (WYSIWYG).
    const after = screen.getByTestId("document-probe").textContent;
    expect(after).toHaveLength(2000);
    expect(after?.includes("betax ")).toBe(true);
    const liveFlow = screen.getByTestId("preview-segment-flow");
    expect(liveFlow.textContent).toBe(after);

    // At the limit again: every further insertion is blocked.
    const blockedKey = keyDown(liveFlow, { key: "x", code: "KeyX" });
    expect(blockedKey.defaultPrevented).toBe(true);
    const blockedNative = dispatchBeforeInput(liveFlow, {
      inputType: "insertText",
      data: "x",
    });
    expect(blockedNative.defaultPrevented).toBe(true);
  });

  it("paste truncates to what fits; at the limit nothing lands", () => {
    // At 1995 a 10-character paste lands only its 5-character
    // fitting prefix.
    const flow = seedAtLength(1995);
    fireEvent.paste(flow, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "abcdefghij" : ""),
      },
    });
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
    expect(
      screen.getByTestId("document-probe").textContent?.endsWith("abcde"),
    ).toBe(true);

    // At 2000 the same paste inserts nothing.
    cleanup();
    const flowTwo = seedAtLength(2000);
    fireEvent.paste(flowTwo, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "abcdefghij" : ""),
      },
    });
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
    expect(flowTwo.textContent?.endsWith("x")).toBe(true);
  });

  it("the chip-territory redirect is blocked at the limit: a redirected character is still a character", () => {
    const flow = seedAtLength(2000);
    // Place the caret inside the LAST chip's text end — chip
    // territory, where a typed character would normally redirect
    // into the chip.
    const chips = screen.getAllByTestId("preview-snippet");
    const beta = chips[chips.length - 1];
    const range = document.createRange();
    range.setStart(
      beta.firstChild as Text,
      (beta.firstChild as Text).data.length,
    );
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const blocked = keyDown(flow, { key: "z", code: "KeyZ" });
    expect(blocked.defaultPrevented).toBe(true);
    // Nothing landed: the chip's text is unchanged (the redirect
    // never ran) and the document keeps its exact length.
    expect(beta.textContent).toBe("beta");
    expect(screen.getByTestId("document-probe").textContent).toHaveLength(2000);
  });
});

// ---------------------------------------------------------------------------
// The fixed card: one fixed height for every card (the text inputs
// and the preview match) — the flow area scrolls internally, the
// char counter row stays pinned below it, and the card never grows
// with its content. The modal's tweak fills its zone instead.
// ---------------------------------------------------------------------------

describe("fixed card height with the counter row", () => {
  it("the card is fixed-height: the flow area scrolls internally and the counter row stays below", () => {
    renderWithProviders(seedInterleaved());
    const root = screen.getByTestId("preview-area");
    const flowArea = screen.getByTestId("preview-flow-area");
    const css = () =>
      Array.from(document.querySelectorAll("style"))
        .map((style) => style.textContent)
        .join("");
    // One fixed height for every card; the root itself no longer
    // scrolls (the flow area owns the scroll so the counter row
    // never scrolls away).
    expect(root).toHaveStyle({ height: "400px" });
    expect(css()).toContain("height:400px");
    expect(css()).not.toContain("max-height:70vh");
    expect(flowArea).toHaveStyle({ overflow: "auto" });
    // The counter is ABSOLUTELY pinned at the card's bottom-right
    // padding inset — out of the flow, structurally OUTSIDE the
    // scroll container, so no amount of content can push or overlap
    // it (the content-independent basis-ZERO flow share plus the
    // reserved bottom strip keep the text clear).
    const pin = screen.getByTestId("preview-counter-pin");
    expect(root).toContainElement(pin);
    expect(flowArea.contains(pin)).toBe(false);
    expect(pin).toHaveStyle({ position: "absolute" });
    expect(pin).toHaveStyle({ bottom: "16px" });
    expect(pin).toHaveStyle({ right: "16px" });
    expect(root).toHaveStyle({ position: "relative" });
    const counter = screen.getByTestId("preview-char-count");
    expect(pin).toContainElement(counter);
    // The flow region's share derives from the card's fixed height
    // alone: basis ZERO, never `auto`.
    expect(flowArea).toHaveStyle({ flex: "1 1 0" });
    expect(flowArea).toHaveStyle({ minHeight: "0px" });
    expect(flowArea).toHaveStyle({ marginBottom: "28px" });
  });

  it("the empty state fills the fixed card on a content-independent basis", () => {
    renderWithProviders([]);
    const empty = screen.getByTestId("preview-empty");
    expect(empty).toHaveStyle({ flex: "1 1 0" });
  });
});

describe("classifyCaretRelativeChip + insertSplitPasteAtChipEnd (line-break escape helpers)", () => {
  // Pure-DOM units: the classifier takes a root and a range, no
  // React and no selection global needed.
  const buildRoot = () => {
    const root = document.createElement("div");
    const chip = document.createElement("span");
    chip.dataset.tokenId = "text-1:a1";
    chip.textContent = "Alpha";
    root.appendChild(document.createTextNode("lead "));
    root.appendChild(chip);
    root.appendChild(document.createTextNode(" tail"));
    return { root, chip };
  };

  const rangeAt = (root: HTMLElement, node: Node, offset: number) => {
    const range = root.ownerDocument.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    return range;
  };

  it("classifies a caret inside the chip at its end text boundary (text-node and element containers)", () => {
    const { root, chip } = buildRoot();
    const chipText = chip.firstChild as Text;
    expect(classifyCaretRelativeChip(root, rangeAt(root, chipText, 5)).position).toBe(
      "inside-chip-at-end",
    );
    expect(classifyCaretRelativeChip(root, rangeAt(root, chip, 1)).position).toBe(
      "inside-chip-at-end",
    );
    // The classification carries the chip for the escape path.
    expect(classifyCaretRelativeChip(root, rangeAt(root, chipText, 5)).chip).toBe(
      chip,
    );
  });

  it("classifies a caret inside the chip at its start text boundary (text-node and element containers)", () => {
    const { root, chip } = buildRoot();
    const chipText = chip.firstChild as Text;
    expect(classifyCaretRelativeChip(root, rangeAt(root, chipText, 0)).position).toBe(
      "inside-chip-at-start",
    );
    expect(classifyCaretRelativeChip(root, rangeAt(root, chip, 0)).position).toBe(
      "inside-chip-at-start",
    );
  });

  it("classifies a mid-chip caret as inside-chip-mid — including just before trailing chip content", () => {
    const { root, chip } = buildRoot();
    const chipText = chip.firstChild as Text;
    expect(classifyCaretRelativeChip(root, rangeAt(root, chipText, 2)).position).toBe(
      "inside-chip-mid",
    );
    // Exactness: a chip whose text ends with a space (by-design
    // double spaces exist) keeps the caret "mid" until it moves past
    // that space — the space is chip content.
    chip.textContent = "Alpha ";
    const withSpace = chip.firstChild as Text;
    expect(
      classifyCaretRelativeChip(root, rangeAt(root, withSpace, 5)).position,
    ).toBe("inside-chip-mid");
    expect(
      classifyCaretRelativeChip(root, rangeAt(root, withSpace, 6)).position,
    ).toBe("inside-chip-at-end");
  });

  it("classifies carets outside any chip as outside-chip", () => {
    const { root, chip } = buildRoot();
    const lead = root.firstChild as Text;
    const tail = root.lastChild as Text;
    expect(classifyCaretRelativeChip(root, rangeAt(root, lead, 2)).position).toBe(
      "outside-chip",
    );
    expect(classifyCaretRelativeChip(root, rangeAt(root, tail, 1)).position).toBe(
      "outside-chip",
    );
    // A caret at a child boundary of the root, right next to the chip,
    // is still outside it (container is the root).
    expect(
      classifyCaretRelativeChip(
        root,
        rangeAt(root, root, Array.from(root.childNodes).indexOf(chip) + 1),
      ).position,
    ).toBe("outside-chip");
    // Enter over a non-collapsed selection keeps today's path.
    const selectionRange = root.ownerDocument.createRange();
    selectionRange.setStart(lead, 0);
    selectionRange.setEnd(tail, 2);
    expect(classifyCaretRelativeChip(root, selectionRange).position).toBe(
      "outside-chip",
    );
    expect(classifyCaretRelativeChip(root, selectionRange).chip).toBeNull();
  });

  it("splits a paste at the chip's end: prefix inside the chip, tail as the following sibling (unit)", () => {
    // Pure-DOM unit of the at-end split mechanics.
    const root = document.createElement("div");
    const chip = document.createElement("span");
    chip.dataset.tokenId = "text-1:a1";
    chip.textContent = "Alpha";
    root.appendChild(chip);
    const caret = root.ownerDocument.createRange();
    const chipText = chip.firstChild as Text;
    caret.setStart(chipText, "Alpha".length);
    caret.collapse(true);

    const tail = insertSplitPasteAtChipEnd(chip, caret, "past\nsecond");

    expect(chip.textContent).toBe("Alphapast");
    expect(chip.nextSibling).toBe(tail);
    expect(tail.data).toBe("\nsecond");
    expect(root.textContent).toBe("Alphapast\nsecond");

    // Empty prefix reduces to the escape: nothing integrates.
    const root2 = document.createElement("div");
    const chip2 = document.createElement("span");
    chip2.dataset.tokenId = "text-1:b1";
    chip2.textContent = "Beta";
    root2.appendChild(chip2);
    const caret2 = root2.ownerDocument.createRange();
    caret2.setStart(chip2.firstChild as Text, "Beta".length);
    caret2.collapse(true);
    const tail2 = insertSplitPasteAtChipEnd(chip2, caret2, "\nnext");
    expect(chip2.textContent).toBe("Beta");
    expect(tail2.data).toBe("\nnext");
    expect(root2.textContent).toBe("Beta\nnext");
  });

  it("walks caret boundaries to abutting chips and computes caret gaps (pure units)", () => {
    const root = document.createElement("div");
    const chipA = document.createElement("span");
    chipA.dataset.tokenId = "text-1:a1";
    chipA.textContent = "Alpha";
    const sep = document.createTextNode(" ");
    const chipB = document.createElement("span");
    chipB.dataset.tokenId = "text-2:b1";
    chipB.textContent = "Beta";
    const gap = document.createElement("span"); // a transparent anchor
    gap.dataset.gapSlot = "1";
    root.append(chipA, gap, sep, chipB);

    // The caret inside "text" glued between the chips (no separator).
    sep.data = "text";
    expect(abuttingChipFromCaret(root, sep, 1, "before")).toBe(chipA);
    expect(abuttingChipFromCaret(root, sep, 1, "after")).toBe(chipB);
    // A whitespace anywhere between the caret and the chip blocks.
    sep.data = "a b";
    expect(abuttingChipFromCaret(root, sep, 3, "before")).toBeNull();
    expect(abuttingChipFromCaret(root, sep, 2, "after")).toBe(chipB);
    // The walker reports the abutting chip even with no text between
    // (the caret at offset 0 walks through the transparent anchor to
    // chipA); the PLANT gate is the adjacent-character check in
    // ensureTypedTextSeparation, not the walker.
    expect(abuttingChipFromCaret(root, sep, 0, "before")).toBe(chipA);
    // Gap computation: a spaces-only run between two chips is a gap.
    sep.data = "  ";
    const gapSpan = findCaretGap(root, sep, 1);
    expect(gapSpan?.firstNode).toBe(sep);
    expect(gapSpan?.lastNode).toBe(sep);
    // A newline in the run disqualifies it.
    sep.data = " \n ";
    expect(findCaretGap(root, sep, 1)).toBeNull();
    // Not bounded by chips on both sides: no gap.
    const lone = document.createElement("div");
    const loneText = document.createTextNode("  ");
    lone.appendChild(loneText);
    expect(findCaretGap(lone, loneText, 1)).toBeNull();
    // Collapse: two spaces → one (returns true), one space → no-op.
    sep.data = "  ";
    const span = findCaretGap(root, sep, 1);
    expect(span && collapseGapSpaces(root, span)).toBe(true);
    expect(sep.data).toBe(" ");
    const single = findCaretGap(root, sep, 1);
    expect(single && collapseGapSpaces(root, single)).toBe(false);
    expect(sep.data).toBe(" ");
  });
});

describe("PreviewArea click-vs-drag on the editable surface", () => {
  describe("pointer holds", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      installSegmentRects();
    });

    afterEach(() => {
      // Same drain as the pointer-sorting suite: dnd-kit's delayed
      // document-listener removal must fire before the fake clock is
      // discarded, or later clicks in the file stop propagating.
      act(() => {
        vi.advanceTimersByTime(60);
      });
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    const pointerDownOn = (element: Element, x = 40, y = 10) =>
      fireEvent.pointerDown(element, {
        pointerId: 1,
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: y,
      });

    it("still never starts a drag when the pointer is released before the delay (click = caret)", () => {
      renderWithProviders(seedInterleaved());
      enableEditing();
      const [alpha] = screen.getAllByTestId("preview-snippet");

      pointerDownOn(alpha);
      act(() => {
        vi.advanceTimersByTime(25);
      });
      fireEvent.pointerUp(document, { pointerId: 1 });
      act(() => {
        vi.advanceTimersByTime(75);
      });

      expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha beta gamma",
      );
    });

    it("never starts a pointer drag while edit mode is ON — the mouse serves the editor", async () => {
      // pointer sorting is
      // disabled while editing — the PointerSensor is not mounted,
      // so even a full hold-drag sequence never raises the snippet.
      renderWithProviders(seedInterleaved());
      enableEditing();
      const [alpha] = screen.getAllByTestId("preview-snippet");

      pointerDownOn(alpha);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();

      fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 160,
        clientY: 10,
      });
      fireEvent.pointerUp(document, { pointerId: 1 });
      await act(async () => {});

      // No drag, no reorder — the document is untouched.
      expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
      expect(screen.getAllByTestId("preview-snippet").map((s) => s.textContent)).toEqual([
        "Alpha",
        "beta",
        "gamma",
      ]);
      expect(screen.getByTestId("document-probe").textContent).toBe(
        "Alpha beta gamma",
      );
    });
  });

  describe("keyboard pickup split", () => {
    beforeEach(() => {
      installSegmentRects();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("keeps keyboard pickup on a focused chip while editing: Space picks the chip up, not the root", async () => {
      renderWithProviders(seedInterleaved());
      enableEditing();

      // Space with a FOCUSED chip: dnd-kit's activator owns the key
      // and preventDefaults it (verified in the installed 6.3.1).
      const [alpha] = screen.getAllByTestId("preview-snippet");
      act(() => {
        alpha.focus();
      });
      const spaceOnChip = new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        alpha.dispatchEvent(spaceOnChip);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(spaceOnChip.defaultPrevented).toBe(true);
      expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();
      await pressKey(document, "Escape");

      // Space with the caret in the root (target = the host): the
      // activator declines (its keydown target is not the activator
      // node), no drag starts, typing proceeds.
      const flow = screen.getByTestId("preview-segment-flow");
      act(() => {
        flow.focus();
      });
      const spaceOnRoot = new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        flow.dispatchEvent(spaceOnRoot);
      });
      expect(spaceOnRoot.defaultPrevented).toBe(false);
      expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// The case-fix pass on the visible document: creation-time correction
// and the sort-time flips (the moved chip and the chips whose
// predecessors changed re-fit their merged context).
// ---------------------------------------------------------------------------

describe("case-fix pass — creation and sort flips (inline)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installSegmentRects({
      // The seeded chips resolve by their rendered text — the pass
      // may re-case them across the drags, so both casings map to
      // the same geometry.
      chips: {
        "Just words": { left: 0, top: 0, right: 100, bottom: 24, width: 100, height: 24, x: 0, y: 0 },
        "just words": { left: 0, top: 0, right: 100, bottom: 24, width: 100, height: 24, x: 0, y: 0 },
        "Uppercase arrives": { left: 120, top: 0, right: 220, bottom: 24, width: 100, height: 24, x: 120, y: 0 },
        "uppercase arrives": { left: 120, top: 0, right: 220, bottom: 24, width: 100, height: 24, x: 120, y: 0 },
        Hello: { left: 0, top: 0, right: 100, bottom: 24, width: 100, height: 24, x: 0, y: 0 },
        hello: { left: 0, top: 0, right: 100, bottom: 24, width: 100, height: 24, x: 0, y: 0 },
        Paris: { left: 120, top: 0, right: 220, bottom: 24, width: 100, height: 24, x: 120, y: 0 },
      },
    });
  });

  afterEach(() => {
    act(() => {
      vi.advanceTimersByTime(60);
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const pointerDownOn = (element: Element, x = 40, y = 10) =>
    fireEvent.pointerDown(element, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
    });

  it("capitalizes a chip created after a sentence-ending predecessor", () => {
    renderWithProviders([
      ["text-1", [makeSnippet("a1", "First sentence.")]],
      ["text-2", [makeSnippet("b1", "second sentence")]],
    ]);
    // The second chip lands right after "." — the pass capitalizes it
    // at creation.
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "First sentence. Second sentence",
    );
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      "First sentence. Second sentence",
    );
  });

  it("lowercases a chip created mid-sentence", () => {
    renderWithProviders([
      ["text-1", [makeSnippet("a1", "Just words")]],
      ["text-2", [makeSnippet("b1", "Uppercase arrives")]],
    ]);
    // The second chip lands mid-sentence — the pass lowercases it.
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Just words uppercase arrives",
    );
    expect(
      screen.getAllByTestId("preview-snippet")[1].textContent,
    ).toBe("uppercase arrives");
  });

  it("flips the letters across a context change — the moved chip and the displaced chip both re-fit, in both directions", async () => {
    renderWithProviders([
      ["text-1", [makeSnippet("a1", "Just words")]],
      ["text-2", [makeSnippet("b1", "Uppercase arrives")]],
    ]);
    // Creation: the second chip lands mid-sentence — lowercased.
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Just words uppercase arrives",
    );
    const [, upper] = screen.getAllByTestId("preview-snippet");
    expect(upper.textContent).toBe("uppercase arrives");

    // Drag it to the leading gap: the moved chip capitalizes at the
    // document start and the displaced chip re-classifies
    // mid-sentence — both letters visibly flip.
    pointerDownOn(upper, 130, 10);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: -4, clientY: 10 });
    fireEvent.pointerUp(document, { pointerId: 1 });
    await act(async () => {});

    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Uppercase arrives just words",
    );
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      screen.getByTestId("document-probe").textContent,
    );

    // Drag it back to the trailing gap: both letters flip back.
    const [head] = screen.getAllByTestId("preview-snippet");
    expect(head.textContent).toBe("Uppercase arrives");
    pointerDownOn(head, 40, 10);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 224, clientY: 10 });
    fireEvent.pointerUp(document, { pointerId: 1 });
    await act(async () => {});

    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Just words uppercase arrives",
    );
    const [first, last] = screen.getAllByTestId("preview-snippet");
    expect(first.textContent).toBe("Just words");
    expect(last.textContent).toBe("uppercase arrives");
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      screen.getByTestId("document-probe").textContent,
    );
  });

  it("keeps a frozen chip's hand-fixed casing through a sort (the pass always skips edited tokens)", async () => {
    // Creation: the second chip lands mid-sentence and is
    // auto-lowercased — the accepted wrongness the user fixes by
    // hand; the fix arrives through a parsed sync and freezes the
    // chip (the exact edited-detection comparison).
    renderWithProviders([
      ["text-1", [makeSnippet("a1", "Hello")]],
      ["text-2", [makeSnippet("b1", "Paris")]],
    ]);
    expect(screen.getByTestId("document-probe").textContent).toBe("Hello paris");

    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });
    const [, paris] = screen.getAllByTestId("preview-snippet");
    (paris.firstChild as Text).data = "Paris";
    fireEvent.input(flow);
    expect(screen.getByTestId("document-probe").textContent).toBe("Hello Paris");

    // Toggle edit OFF (commits the surface) — pointer sorting is
    // live again; the toggle's thaw remounts the flow, so re-query.
    enableEditing();

    // Sort the frozen chip to the document start: its hand-fixed
    // casing survives — the pass never re-corrects an edited token,
    // while the displaced chip re-classifies mid-sentence.
    const frozenChip = screen.getAllByTestId("preview-snippet")[1];
    pointerDownOn(frozenChip, 130, 10);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: -4, clientY: 10 });
    fireEvent.pointerUp(document, { pointerId: 1 });
    await act(async () => {});

    expect(screen.getByTestId("document-probe").textContent).toBe("Paris hello");
    const [frozen] = screen.getAllByTestId("preview-snippet");
    expect(frozen.textContent).toBe("Paris");
  });
});

// ---------------------------------------------------------------------------
// The spacing-fix pass on the visible document: creation-time and
// sort-time corrections land through the wrapper's whole-document
// recompute, the surfaces re-render from the settled model (WYSIWYG
// parity), and deliberately glued seams survive every trigger.
// ---------------------------------------------------------------------------

describe("spacing-fix pass — visible corrections (inline)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("collapses a chip-edge + separator seam at creation (the flow renders the settled model)", () => {
    renderWithProviders([
      ["text-1", [makeSnippet("a1", "brave ")]],
      ["text-2", [makeSnippet("b1", "today")]],
    ]);
    // The chip cut with a trailing space lands beside a separator:
    // the two spaces collapse to one, and the document-start chip
    // capitalizes — the probe (model) and the flow (DOM) agree.
    expect(screen.getByTestId("document-probe").textContent).toBe("Brave today");
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      screen.getByTestId("document-probe").textContent,
    );
  });

  it("keeps a deliberately glued seam through a trigger (the pinned glue shape stays byte-identical)", () => {
    renderWithProviders([["text-1", [makeSnippet("a1", "Alpha")]]]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });
    // Own text glued directly after the chip: letter-ending glue is
    // deliberate user intent.
    flow.appendChild(document.createTextNode("mytext"));
    fireEvent.input(flow);
    expect(screen.getByTestId("document-probe").textContent).toBe("Alphamytext");

    // Toggling edit OFF commits the focused DOM and runs the composed
    // pass: the glue gains no space (no trigger character ends the
    // chip) — the seam stays byte-identical, the escape hatch for
    // deliberately joined text.
    enableEditing();
    expect(screen.getByTestId("document-probe").textContent).toBe("Alphamytext");
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe("Alphamytext");
  });

  it("settles stale spacing through a keyboard sort — the drop's whole-document recompute corrects the mid-typing document", async () => {
    installSegmentRects({
      chips: {
        alpha: SEGMENT_RECTS.Alpha,
      },
      landings: {
        "preview-landing:s:1:0": 104,
        "preview-landing:s:1:5": 150,
        "preview-landing:s:1:12": 204,
        "preview-landing:g:3": 224,
      },
    });
    renderWithProviders([
      ["text-1", [makeSnippet("a1", "Alpha")]],
      ["text-2", [makeSnippet("b1", "Beta")]],
    ]);
    enableEditing();
    const flow = screen.getByTestId("preview-segment-flow");
    act(() => {
      flow.focus();
    });
    // The user retypes the separator into own words carrying a
    // doubled interior run: the mid-typing sync keeps the stale
    // spacing while the focused surface owns its DOM.
    const separator = Array.from(flow.childNodes).find(
      (node) => node.nodeType === Node.TEXT_NODE,
    ) as Text;
    separator.data = " text  more ";
    fireEvent.input(flow);
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha text  more beta",
    );

    // Thaw and re-focus so the words' landing anchors re-render from
    // the synced model before lifting (the blur remounts the flow —
    // re-query the live node).
    act(() => {
      fireEvent.blur(flow);
    });
    const liveFlow = screen.getByTestId("preview-segment-flow");
    expect(liveFlow).not.toBe(flow);
    act(() => {
      liveFlow.focus();
    });

    const hostKey = (key: string, code: string) => {
      const keydown = new KeyboardEvent("keydown", {
        key,
        code,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        liveFlow.dispatchEvent(keydown);
      });
      return keydown;
    };
    const setCaretInNode = (node: Node, offset: number) => {
      const range = document.createRange();
      range.setStart(node, offset);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    };
    const needleLandingOf = () =>
      (screen.getByTestId("preview-drop-indicator")
        .previousSibling as HTMLElement).dataset.landing;

    const [alpha] = screen.getAllByTestId("preview-snippet");
    setCaretInNode(alpha.firstChild as Text, 2);
    act(() => {
      liveFlow.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: " ",
          code: "Space",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();
    expect(needleLandingOf()).toBe("preview-landing:g:0");

    // Walk to the word boundary at the doubled run's start and drop
    // there: the move runs the whole-document recompute, so the
    // doubled run collapses and the document-start run trims — the
    // surface re-renders from the settled model.
    hostKey("ArrowRight", "ArrowRight");
    expect(needleLandingOf()).toBe("preview-landing:s:1:0");
    hostKey("ArrowRight", "ArrowRight");
    expect(needleLandingOf()).toBe("preview-landing:s:1:5");
    const enter = hostKey("Enter", "Enter");
    expect(enter.defaultPrevented).toBe(true);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId("document-probe").textContent).toBe(
      "text alpha more beta",
    );
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      screen.getByTestId("document-probe").textContent,
    );
  });
});
