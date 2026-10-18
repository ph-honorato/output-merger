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
import type { Snippet } from "@components";
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { TextEditingToggle } from "../";
import {
  isSnippetToken,
  serialize,
} from "../../../../utils/previewDocument";
import {
  buildGapId,
  classifyCaretRelativeChip,
  computeGapMoveIndex,
  computeNeedleIndex,
  insertSplitPasteAtChipEnd,
  parseGapId,
  SNIPPET_DRAG_ACTIVATION,
  usePreviewArea,
} from "./PreviewArea.hook";
import PreviewArea from "./PreviewArea";
import { withAlpha } from "../../../../utils/color";

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

// Gap anchors sit at the insertion points of the seeded layout:
// before Alpha (-4), between Alpha|Beta (110), between Beta|Gamma
// (230), and after Gamma (344). Keyed by the data-gap-slot attribute.
const GAP_SLOT_X: Record<string, number> = {
  "0": -4,
  "1": 110,
  "2": 230,
  "3": 344,
};

// jsdom does not compute layout: give the segment chips deterministic
// rects so dnd-kit's rect-based collision detection works in tests.
// Gap anchors resolve by their slot attribute to the insertion-point
// x; everything else falls back to the textContent-keyed chip rects.
const installSegmentRects = () =>
  vi
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: Element) {
      const gapSlot = (this as HTMLElement).dataset?.gapSlot;
      if (gapSlot !== undefined) {
        const x = GAP_SLOT_X[gapSlot] ?? 0;
        return {
          left: x,
          right: x,
          top: 0,
          bottom: 24,
          width: 0,
          height: 24,
          x,
          y: 0,
        } as DOMRect;
      }
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

  it("renders the flow text exactly as the serialized document (WYSIWYG invariant)", () => {
    // 'b1' ends with a space: the resulting double space in the join is
    // by-design (clipboard parity — join semantics preserved by the
    // explicit separator tokens).
    renderWithProviders([
      ["text-1", [makeSnippet("a1", "Hello")]],
      ["text-2", [makeSnippet("b1", "brave ")]],
      ["text-1", [makeSnippet("a1", "Hello"), makeSnippet("a2", "world")]],
      ["text-2", [makeSnippet("b1", "brave "), makeSnippet("b2", "today")]],
    ]);
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      screen.getByTestId("document-probe").textContent,
    );
    // Byte-identity with the old buildMergedText join for an unedited
    // session (model-migration parity assertion).
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      "Hello brave  world today",
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
      "Alpha",
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

    await pressKey(document, "ArrowRight");
    await pressKey(document, "Space");

    const segments = screen.getAllByTestId("preview-snippet");
    expect(segments.map((segment) => segment.textContent)).toEqual([
      "Beta",
      "Alpha",
      "Gamma",
    ]);
    expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
      "Beta Alpha Gamma",
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

  it("round-trips gap ids and rejects non-gap ids", () => {
    expect(buildGapId(0)).toBe("preview-gap:0");
    expect(buildGapId(3)).toBe("preview-gap:3");
    expect(parseGapId("preview-gap:0")).toBe(0);
    expect(parseGapId("preview-gap:3")).toBe(3);
    expect(parseGapId("text-1:a1")).toBeNull();
    expect(parseGapId("preview-gap:x")).toBeNull();
    expect(parseGapId("")).toBeNull();
  });

  it("drops the chip at the gap slot the needle marks, for every (from, gap) pair", () => {
    // The needle renders AT slot g; the drop must land the chip
    // exactly there. Model the reducer's splice semantics: splice out
    // at from, re-insert at computeGapMoveIndex.
    for (let from = 0; from < 3; from += 1) {
      for (let gap = 0; gap <= 3; gap += 1) {
        const rendered = ["a", "b", "c"];
        const final = [...rendered];
        const [moved] = final.splice(from, 1);
        final.splice(computeGapMoveIndex(from, gap), 0, moved);

        // "Lands at slot g": the elements preceding the moved chip in
        // the final order are exactly the rendered prefix before slot
        // g, dragged chip excluded.
        const prefix = final.slice(0, final.indexOf(moved));
        const expectedPrefix = rendered
          .slice(0, gap)
          .filter((item) => item !== moved);
        expect(prefix).toEqual(expectedPrefix);
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
      expect(flow.textContent).toBe(`${long} ${second}`);
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
      ).toEqual(["Alpha", "Gamma", "Beta"]);
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
      ).toEqual(["Beta", "Alpha", "Gamma"]);
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
      ).toEqual(["Beta", "Gamma", "Alpha"]);
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
      ).toEqual(["Alpha", "Beta", "Gamma"]);
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
    expect(result.current.dropIndicatorIndex).toBeNull();

    // Pickup: the needle starts at the origin slot.
    act(() => {
      result.current.handleDragStart({
        active: { id: "text-1:a1" },
      } as unknown as DragStartEvent);
    });
    expect(result.current.dropIndicatorIndex).toBe(0);
    expect(result.current.activeSnippet?.tokenId).toBe("text-1:a1");

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

    // Over an insertion gap: the needle marks that slot directly.
    act(() => {
      result.current.handleDragOver({
        active: { id: "text-1:a1" },
        over: { id: buildGapId(1) },
      } as unknown as DragOverEvent);
    });
    expect(result.current.dropIndicatorIndex).toBe(1);

    // A stale gap slot (the list shrank mid-drag) hides the needle…
    act(() => {
      result.current.handleDragOver({
        active: { id: "text-1:a1" },
        over: { id: buildGapId(5) },
      } as unknown as DragOverEvent);
    });
    expect(result.current.dropIndicatorIndex).toBeNull();

    // …and its drop is discarded without crashing.
    act(() => {
      result.current.handleDragEnd({
        active: { id: "text-1:a1" },
        over: { id: buildGapId(5) },
      } as unknown as DragEndEvent);
    });
    expect(result.current.dropIndicatorIndex).toBeNull();
    expect(
      result.current.document.filter(isSnippetToken).map((token) => token.tokenId),
    ).toEqual(["text-1:a1", "text-2:b1", "text-1:a2"]);

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
    expect(
      result.current.document.filter(isSnippetToken).map((token) => token.tokenId),
    ).toEqual(["text-1:a1", "text-2:b1", "text-1:a2"]);
  });
});

// ---------------------------------------------------------------------------
// Editable preview text (Feature 3 Task 3): the editable surface, the
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
    // Chips keep dnd-kit's sortable semantics inside the textbox.
    const chip = screen.getAllByTestId("preview-snippet")[0];
    expect(chip).toHaveAttribute("role", "button");
    expect(chip).toHaveAttribute("tabindex", "0");
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
    // own focus indicator (user decision 2026-10-17).
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
      name: "edit ON + empty renders the editable root (F3)",
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

  it("types inside a snippet without splitting it: the text integrates into the token (deviation b)", () => {
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

    // The invisible-line fix (user report 2026-10-17): a trailing
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
  // "A line break never enters a snippet" (user decision 2026-10-17):
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
    expect(screen.getByTestId("document-probe").textContent).toBe("Alpha\n Beta");
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
      "Alpha\nown Beta",
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
  // "A line break never enters a snippet" — the paste extension (user
  // decision 2026-10-17, round 3): pasted text integrates into the
  // snippet only up to its first newline; the newline and everything
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
    // the chip, exactly like the round-2 Enter escape.
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
    // chip (the rejected deviation b): the paste embeds entirely.
    expect(chip.textContent).toBe("Alx\nypha");
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alx\nypha",
    );
  });

  it("plants the bogus <br> when an at-end split paste leaves the tail ending the block with a newline (round-1 rule through the new path)", () => {
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

  it("keeps Enter on a focused chip as dnd-kit's pickup instead of a line break", async () => {
    renderWithProviders(seedInterleaved());
    enableEditing();
    const [alpha] = screen.getAllByTestId("preview-snippet");
    alpha.focus();

    await pressKey(alpha, "Enter");

    expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("document-probe").textContent).toBe(
      "Alpha Beta Gamma",
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
    // Regression (tester finding 3): a one-shot self-edit flag would
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
      await pressKey(document, "ArrowRight");
      await pressKey(document, "Space");

      expect(
        screen.getAllByTestId("preview-snippet").map((s) => s.textContent),
      ).toEqual(["Beta", "Alpha", "Gamma"]);
      // The epoch remount replaces the flow root (a clean re-render
      // from the model): re-query the live node.
      expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
        screen.getByTestId("document-probe").textContent,
      );
      expect(screen.getByTestId("preview-segment-flow").textContent).toBe(
        "Beta Alpha Gamma",
      );
    } finally {
      restoreRects.mockRestore();
    }
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
        "Alpha Beta Gamma",
      );
    });

    it("starts the drag on a held press in edit mode (dragging is always live — F1)", async () => {
      renderWithProviders(seedInterleaved());
      enableEditing();
      const [alpha] = screen.getAllByTestId("preview-snippet");

      pointerDownOn(alpha);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(screen.getByTestId("preview-snippet-overlay")).toBeInTheDocument();

      fireEvent.pointerMove(document, {
        pointerId: 1,
        clientX: 160,
        clientY: 10,
      });
      fireEvent.pointerUp(document, { pointerId: 1 });
      await act(async () => {});

      expect(screen.queryByTestId("preview-snippet-overlay")).toBeNull();
      expect(
        screen.getAllByTestId("preview-snippet").map((s) => s.textContent),
      ).toEqual(["Beta", "Alpha", "Gamma"]);
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
