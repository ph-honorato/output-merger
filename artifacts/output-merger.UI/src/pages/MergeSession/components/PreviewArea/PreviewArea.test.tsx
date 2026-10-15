import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useEffect } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StyledThemeProvider } from "styled-components";
import { I18nextProvider } from "react-i18next";
import { i18n, enUS, ptBR } from "@translation";
import { theme } from "../../../../theme";
import {
  SnippetsProvider,
  useSnippets,
} from "../../../../context/SnippetsContext";
import type { OrderedSnippet } from "../../../../context/SnippetsContext";
import type { Snippet } from "@components";
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { buildMergedText } from "../CopyMergedTextButton/CopyMergedTextButton.hook";
import PreviewArea from "./PreviewArea";
import {
  buildSortableId,
  computeNeedleIndex,
  SNIPPET_DRAG_ACTIVATION,
  usePreviewArea,
} from "./PreviewArea.hook";
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

const seedInterleaved = (): Array<[string, Snippet[]]> => [
  ["text-1", [makeSnippet("a1", "Alpha")]],
  ["text-2", [makeSnippet("b1", "Beta")]],
  ["text-1", [makeSnippet("a1", "Alpha"), makeSnippet("a2", "Gamma")]],
];

const SORTING_COPY = {
  instructions: {
    "en-US":
      "To pick up a snippet, press Space or Enter. While dragging, use the arrow keys to move it. Press Space or Enter again to drop it, or Escape to cancel.",
    "pt-BR":
      "Para pegar um trecho, pressione Espaço ou Enter. Enquanto arrasta, use as setas para movê-lo. Pressione Espaço ou Enter novamente para soltá-lo, ou Escape para cancelar.",
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
  Alpha: { left: 0, top: 0, right: 100, bottom: 24, width: 100, height: 24, x: 0, y: 0 },
  Beta: { left: 120, top: 0, right: 220, bottom: 24, width: 100, height: 24, x: 120, y: 0 },
  Gamma: { left: 240, top: 0, right: 340, bottom: 24, width: 100, height: 24, x: 240, y: 0 },
};

const ZERO_RECT: SegmentRect = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };

// jsdom does not compute layout: give the segment chips deterministic
// rects so dnd-kit's rect-based collision detection works in tests.
const installSegmentRects = () =>
  vi
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: Element) {
      const text = (this as HTMLElement).textContent ?? "";
      return { ...(SEGMENT_RECTS[text] ?? ZERO_RECT) } as DOMRect;
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
    expect(result.current.snippets).toHaveLength(3);

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

    expect(result.current.snippets.map((snippet) => snippet.id)).toEqual([
      "a1",
      "b1",
      "a2",
    ]);
    expect(result.current.snippets.map((snippet) => snippet.order)).toEqual([
      1, 2, 3,
    ]);
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

  it("builds composite sortable ids that stay unique across colliding source ids", () => {
    const first: OrderedSnippet = {
      ...makeSnippet("x1", "Hello"),
      sourceId: "text-1",
      order: 1,
    };
    const second: OrderedSnippet = {
      ...makeSnippet("x1", "Alpha"),
      sourceId: "text-2",
      order: 2,
    };

    expect(buildSortableId(first)).toBe("text-1:x1");
    expect(buildSortableId(second)).toBe("text-2:x1");
    expect(buildSortableId(first)).not.toBe(buildSortableId(second));
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

    await pressKey(document, "ArrowRight");
    await pressKey(document, "Space");

    const segments = screen.getAllByTestId("preview-snippet");
    expect(segments.map((segment) => segment.textContent)).toEqual([
      "Beta",
      "Alpha",
      "Gamma",
    ]);
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      buildMergedText([
        { ...makeSnippet("b1", "Beta"), sourceId: "text-2", order: 1 },
        { ...makeSnippet("a1", "Alpha"), sourceId: "text-1", order: 2 },
        { ...makeSnippet("a2", "Gamma"), sourceId: "text-1", order: 3 },
      ]),
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
      "Beta",
      "Gamma",
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
    ).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      "Beta Alpha Gamma",
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
      "Alpha Beta Gamma",
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
      "Alpha Beta Gamma",
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
      "Alpha Beta Gamma",
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
      "Alpha Beta Gamma",
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
  // ---- pure placement helper ---------------------------------------------

  it("computes the needle slot for every placement branch", () => {
    // Moving forward: the needle lands AFTER the hovered snippet.
    expect(computeNeedleIndex(0, 1)).toBe(2);
    expect(computeNeedleIndex(1, 2)).toBe(3);
    // Moving backward: the needle lands BEFORE the hovered snippet.
    expect(computeNeedleIndex(2, 1)).toBe(1);
    expect(computeNeedleIndex(3, 0)).toBe(0);
    // Hovering the dragged snippet itself (including the pickup
    // instant): the origin slot.
    expect(computeNeedleIndex(0, 0)).toBe(0);
    expect(computeNeedleIndex(1, 1)).toBe(1);
    // Edges: forward over the last snippet → the trailing slot;
    // backward onto the first snippet → the leading slot.
    expect(computeNeedleIndex(0, 2)).toBe(3);
    expect(computeNeedleIndex(2, 0)).toBe(0);
  });

  it("hides the needle when there is no target or an index is unresolved", () => {
    // over resolves to nothing (a no-target drop is a cancel today).
    expect(computeNeedleIndex(0, null)).toBeNull();
    // The dragged snippet vanished mid-drag.
    expect(computeNeedleIndex(-1, 1)).toBeNull();
    // The hovered snippet vanished mid-drag.
    expect(computeNeedleIndex(0, -1)).toBeNull();
  });

  it("always agrees with the gap moveSnippet drops the snippet into", () => {
    for (let from = 0; from < 3; from += 1) {
      for (let over = 0; over < 3; over += 1) {
        const current = ["a", "b", "c"];
        const final = [...current];
        const [moved] = final.splice(from, 1);
        final.splice(over, 0, moved);

        // The needle slot is a gap in the CURRENT render order (the
        // dragged chip still renders at its origin): right before the
        // current item that follows the dropped chip in the final
        // order, or at the end of the flow when nothing follows it.
        // Hovering the dragged snippet itself keeps the chip home.
        const follows = final[final.indexOf(moved) + 1];
        const expected =
          from === over
            ? from
            : follows === undefined
              ? current.length
              : current.indexOf(follows);

        expect(computeNeedleIndex(from, over)).toBe(expected);
      }
    }
  });

  // ---- resources / empty state -------------------------------------------

  it("ships zero new i18n keys: the sorting copy stays exactly the five Task 1 keys", () => {
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

    it("shows the needle at the origin slot on pickup and hops with the arrow keys", async () => {
      renderWithProviders(seedInterleaved());
      const [alpha, beta, gamma] = screen.getAllByTestId("preview-snippet");
      alpha.focus();

      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();

      await pressKey(alpha, "Space");
      const needle = screen.getByTestId("preview-drop-indicator");
      // Pickup: the origin slot sits between the preceding neighbor and
      // the dragged chip (Alpha is first, so the flow start).
      expect(
        needle.compareDocumentPosition(alpha) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      await pressKey(document, "ArrowRight");
      // Over Beta moving forward: the needle lands after it, before Gamma.
      const hopped = screen.getByTestId("preview-drop-indicator");
      expect(
        beta.compareDocumentPosition(hopped) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        hopped.compareDocumentPosition(gamma) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      await pressKey(document, "ArrowLeft");
      // Back over the dragged snippet itself: the needle returns to the
      // origin slot.
      const home = screen.getByTestId("preview-drop-indicator");
      expect(
        home.compareDocumentPosition(alpha) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      await pressKey(document, "Escape");
      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();
      expect(
        screen.getAllByTestId("preview-snippet").map((s) => s.textContent),
      ).toEqual(["Alpha", "Beta", "Gamma"]);
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

      // Keyboard: Alpha picked up, moved over Beta → after Beta, before Gamma.
      alpha.focus();
      await pressKey(alpha, "Space");
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
          if (text === long) {
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
          if (text === second) {
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
      expect(flow.textContent).toBe(
        buildMergedText([
          { ...makeSnippet("a1", long), sourceId: "text-1", order: 1 },
          { ...makeSnippet("a2", second), sourceId: "text-1", order: 2 },
        ]),
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
      // The needle complements the Task 1 feedback: the overlay chip
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
      ).toEqual(["Beta", "Alpha", "Gamma"]);
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
        "Alpha Beta Gamma",
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
      ).toEqual(["Alpha", "Gamma", "Beta"]);
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
        "Alpha Beta Gamma",
      );

      fireEvent.pointerUp(document, { pointerId: 1 });
      await act(async () => {});

      // moveSnippet(0, 2): Alpha lands at the trailing slot it marked.
      expect(
        screen.getAllByTestId("preview-snippet").map((s) => s.textContent),
      ).toEqual(["Beta", "Gamma", "Alpha"]);
      expect(screen.queryByTestId("preview-drop-indicator")).toBeNull();
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
    expect(result.current.snippets).toHaveLength(3);

    // A vanished active id hides the needle from the start.
    act(() => {
      result.current.handleDragStart({
        active: { id: "text-1:ghost" },
      } as unknown as DragStartEvent);
    });
    expect(result.current.dropIndicatorIndex).toBeNull();

    // Pickup: the needle starts at the origin slot.
    act(() => {
      result.current.handleDragStart({
        active: { id: "text-1:a1" },
      } as unknown as DragStartEvent);
    });
    expect(result.current.dropIndicatorIndex).toBe(0);
    expect(result.current.activeSnippet?.id).toBe("a1");

    // Over Beta moving forward: after it — stable across repeated events.
    act(() => {
      result.current.handleDragOver({
        active: { id: "text-1:a1" },
        over: { id: "text-2:b1" },
      } as unknown as DragOverEvent);
    });
    expect(result.current.dropIndicatorIndex).toBe(2);
    act(() => {
      result.current.handleDragOver({
        active: { id: "text-1:a1" },
        over: { id: "text-2:b1" },
      } as unknown as DragOverEvent);
    });
    expect(result.current.dropIndicatorIndex).toBe(2);

    // The hovered snippet vanished mid-drag: hide, no crash.
    act(() => {
      result.current.handleDragOver({
        active: { id: "text-1:a1" },
        over: { id: "text-2:ghost" },
      } as unknown as DragOverEvent);
    });
    expect(result.current.dropIndicatorIndex).toBeNull();

    // No target resolves: hidden (a no-target drop is a cancel today).
    act(() => {
      result.current.handleDragOver({
        active: { id: "text-1:a1" },
        over: null,
      } as unknown as DragOverEvent);
    });
    expect(result.current.dropIndicatorIndex).toBeNull();

    // Drag end clears the needle together with the overlay state and
    // keeps the Task 1 discard path (order unchanged).
    act(() => {
      result.current.handleDragEnd({
        active: { id: "text-1:a1" },
        over: null,
      } as unknown as DragEndEvent);
    });
    expect(result.current.dropIndicatorIndex).toBeNull();
    expect(result.current.activeSnippet).toBeNull();
    expect(result.current.snippets.map((snippet) => snippet.id)).toEqual([
      "a1",
      "b1",
      "a2",
    ]);
  });
});
