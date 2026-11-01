import { describe, expect, it } from "vitest";
import { landingKeyboardCoordinates } from "./PreviewArea.hook";

// ---------------------------------------------------------------------------
// the keyboard coordinate getter —
// Left/Right step the raised chip through EVERY droppable landing
// position in reading order (chips AND word-boundary anchors).
//
// REAL-BROWSER GEOMETRY: the
// landing anchors are zero-footprint spans — a real browser returns a
// TRUE 0x0 rect with top === bottom at the text baseline, while the
// chips span the line (top 0, bottom 24). The reading order is DOM
// document order (the registry's node refs), NOT the geometric
// (top, left) order — with mixed tops the geometric sort puts every
// chip before every anchor and scrambles the walk (the exact
// dev-server regression; the old unit table shared top 0 for
// everything, which masked it). These units pin the realistic shape.
// ---------------------------------------------------------------------------

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// The words layout: [Alpha, " text entered_by_user ", Beta]
// with the anchors at their inline positions — 0x0 boxes at the
// baseline (top === bottom === 18), chips at the line top.
const ANCHOR_Y = 18;
const anchorRect = (x: number): Rect => ({ left: x, right: x, top: ANCHOR_Y, bottom: ANCHOR_Y });

interface LayoutEntry {
  id: string;
  rect: Rect;
  anchor: boolean;
}

const LAYOUT: LayoutEntry[] = [
  { id: "preview-landing:g:0", rect: anchorRect(-4), anchor: true },
  { id: "text-1:a1", rect: { left: 0, right: 100, top: 0, bottom: 24 }, anchor: false }, // Alpha (the raised item)
  { id: "preview-landing:s:1:0", rect: anchorRect(104), anchor: true },
  { id: "preview-landing:s:1:5", rect: anchorRect(150), anchor: true },
  { id: "preview-landing:s:1:21", rect: anchorRect(196), anchor: true },
  { id: "preview-landing:s:1:22", rect: anchorRect(204), anchor: true },
  { id: "text-2:b1", rect: { left: 220, right: 320, top: 0, bottom: 24 }, anchor: false }, // Beta
  { id: "preview-landing:g:3", rect: anchorRect(324), anchor: true },
];

// The raised item's TRANSLATED rect: a 100x24 chip box whose top-left
// sits at (x, y) — what collisionRect reports after each move.
const itemRectAt = (x: number, y: number): Rect => ({
  left: x,
  right: x + 100,
  top: y,
  bottom: y + 24,
});

// Builds the flow's DOM: the droppables as connected sibling spans in
// READING ORDER (exactly how PreviewArea renders them).
const buildFlowDom = () => {
  const container = document.createElement("div");
  const nodes = new Map<string, HTMLElement>();
  for (const entry of LAYOUT) {
    const span = document.createElement("span");
    if (entry.anchor) {
      span.dataset.landing = entry.id;
    } else {
      span.dataset.tokenId = entry.id;
    }
    container.appendChild(span);
    nodes.set(entry.id, span);
  }
  return { container, nodes };
};

const keydown = (code: string) =>
  new KeyboardEvent("keydown", { code, key: code, cancelable: true });

// The synthetic sensor context: containers with (optionally) their
// DOM node refs, mirroring RegisterDroppable's `{id, node, disabled}`
// shape. `itemRect` is the raised item's CURRENT translated rect;
// (x, y) are its currentCoordinates (the rect's top-left).
const callGetter = (
  code: string,
  {
    itemRect,
    x,
    y,
    nodes,
    event,
  }: {
    itemRect: Rect | null;
    x: number;
    y: number;
    nodes: Map<string, HTMLElement> | null;
    event?: KeyboardEvent;
  }
) =>
  landingKeyboardCoordinates(event ?? (keydown(code) as KeyboardEvent), {
    active: "text-1:a1",
    currentCoordinates: { x, y },
    context: {
      active: { id: "text-1:a1" },
      collisionRect: itemRect,
      droppableRects: new Map(LAYOUT.map((entry) => [entry.id, entry.rect])),
      droppableContainers: {
        getEnabled: () =>
          LAYOUT.map((entry) => ({
            id: entry.id,
            disabled: false,
            node: { current: nodes ? (nodes.get(entry.id) ?? null) : null },
          })),
      },
      over: null,
      scrollableAncestors: [],
    } as never,
  });

describe("landingKeyboardCoordinates", () => {
  const { nodes } = buildFlowDom();

  it("prevents the arrow keydowns so the caret never moves mid-sort", () => {
    for (const code of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
      const event = keydown(code);
      callGetter(code, { itemRect: itemRectAt(0, 0), x: 0, y: 0, nodes, event });
      expect(event.defaultPrevented).toBe(true);
    }
  });

  it("returns undefined for non-arrow keys (Space/Enter/Escape stay sensor-owned)", () => {
    for (const code of ["Space", "Enter", "Escape", "Tab"]) {
      const event = keydown(code);
      expect(
        callGetter(code, { itemRect: itemRectAt(0, 0), x: 0, y: 0, nodes, event })
      ).toBeUndefined();
      expect(event.defaultPrevented).toBe(false);
    }
  });

  it("steps one landing position per ArrowRight in DOM reading order — chips AND 0x0 anchors alike", () => {
    // From Alpha's origin the walk must go right after Alpha, then
    // word-by-word — the 0x0 anchors sit at the baseline (top 18)
    // and the chips at the line top, so this ordering is only
    // possible via the DOM-order sort (the geometric (top,left)
    // sort hops onto Beta first — the dev-server regression).
    expect(callGetter("ArrowRight", { itemRect: itemRectAt(0, 0), x: 0, y: 0, nodes })).toEqual({ x: 54, y: 6 }); // -> s:1:0
    expect(callGetter("ArrowRight", { itemRect: itemRectAt(54, 6), x: 54, y: 6, nodes })).toEqual({ x: 100, y: 6 }); // -> s:1:5
    expect(callGetter("ArrowRight", { itemRect: itemRectAt(100, 6), x: 100, y: 6, nodes })).toEqual({ x: 146, y: 6 }); // -> s:1:21
    expect(callGetter("ArrowRight", { itemRect: itemRectAt(146, 6), x: 146, y: 6, nodes })).toEqual({ x: 154, y: 6 }); // -> s:1:22
    // Onto the Beta chip: the step tracks BOTH axes (the chip center
    // sits at y 12, the anchor line at y 18).
    expect(callGetter("ArrowRight", { itemRect: itemRectAt(154, 6), x: 154, y: 6, nodes })).toEqual({ x: 220, y: 0 }); // -> Beta
    expect(callGetter("ArrowRight", { itemRect: itemRectAt(220, 0), x: 220, y: 0, nodes })).toEqual({ x: 274, y: 6 }); // -> g:3
  });

  it("steps backward with ArrowLeft through the same positions", () => {
    expect(callGetter("ArrowLeft", { itemRect: itemRectAt(274, 6), x: 274, y: 6, nodes })).toEqual({ x: 220, y: 0 }); // g:3 -> Beta
    expect(callGetter("ArrowLeft", { itemRect: itemRectAt(100, 6), x: 100, y: 6, nodes })).toEqual({ x: 54, y: 6 }); // s:1:5 -> s:1:0
  });

  it("stays put at the first/last landing position (no stepping past the ends)", () => {
    // Already at the first entry (g:0): the item's center sits at
    // (-4, 18); ArrowLeft keeps it.
    expect(callGetter("ArrowLeft", { itemRect: itemRectAt(-54, 6), x: -54, y: 6, nodes })).toBeUndefined();
    // Already at the last entry (g:3): ArrowRight keeps it.
    expect(callGetter("ArrowRight", { itemRect: itemRectAt(274, 6), x: 274, y: 6, nodes })).toBeUndefined();
  });

  it("keeps Up/Down inert (prevented, no movement)", () => {
    expect(callGetter("ArrowUp", { itemRect: itemRectAt(0, 0), x: 0, y: 0, nodes })).toBeUndefined();
    expect(callGetter("ArrowDown", { itemRect: itemRectAt(0, 0), x: 0, y: 0, nodes })).toBeUndefined();
  });

  it("returns undefined without a collision rect", () => {
    expect(
      callGetter("ArrowRight", { itemRect: null, x: 0, y: 0, nodes })
    ).toBeUndefined();
  });

  it("falls back to the geometric (top, left) order when node refs are missing (transient unmount)", () => {
    // Without nodes the sort is geometric: with the realistic mixed
    // tops (chips 0, anchors 18) every chip sorts before every
    // anchor — the walk from Alpha reaches Beta first. This pins the
    // FALLBACK's behavior (defensive only; the real registry always
    // carries nodes — RegisterDroppable dispatches the node ref).
    expect(
      callGetter("ArrowRight", { itemRect: itemRectAt(0, 0), x: 0, y: 0, nodes: null })
    ).toEqual({ x: 220, y: 0 }); // -> Beta (the geometric order)
  });

  it("walks across LINES in DOM reading order (a two-line flow with line breaks)", () => {
    // The reason the fix sorts by DOM order: geometry cannot express
    // reading order once the flow wraps — line 2's positions come
    // AFTER line 1's in reading order but their (top, left) values
    // interleave. Line 1: [g:0, Alpha, s:1:0]; line 2 (top +48):
    // [g:2, Beta, s:2:0].
    const container = document.createElement("div");
    const multi: Array<{ id: string; rect: Rect; anchor: boolean }> = [
      { id: "preview-landing:g:0", rect: anchorRect(-4), anchor: true },
      { id: "text-1:a1", rect: { left: 0, right: 100, top: 0, bottom: 24 }, anchor: false },
      { id: "preview-landing:s:1:0", rect: anchorRect(104), anchor: true },
      { id: "preview-landing:g:2", rect: { left: -4, right: -4, top: 48 + ANCHOR_Y, bottom: 48 + ANCHOR_Y }, anchor: true },
      { id: "text-2:b1", rect: { left: 0, right: 100, top: 48, bottom: 72 }, anchor: false },
      { id: "preview-landing:s:2:0", rect: { left: 104, right: 104, top: 48 + ANCHOR_Y, bottom: 48 + ANCHOR_Y }, anchor: true },
    ];
    const multiNodes = new Map<string, HTMLElement>();
    for (const entry of multi) {
      const span = document.createElement("span");
      if (entry.anchor) {
        span.dataset.landing = entry.id;
      } else {
        span.dataset.tokenId = entry.id;
      }
      container.appendChild(span);
      multiNodes.set(entry.id, span);
    }
    const call = (code: string, itemRect: Rect | null, x: number, y: number) =>
      landingKeyboardCoordinates(keydown(code) as KeyboardEvent, {
        active: "text-1:a1",
        currentCoordinates: { x, y },
        context: {
          active: { id: "text-1:a1" },
          collisionRect: itemRect,
          droppableRects: new Map(multi.map((entry) => [entry.id, entry.rect])),
          droppableContainers: {
            getEnabled: () =>
              multi.map((entry) => ({
                id: entry.id,
                disabled: false,
                node: { current: multiNodes.get(entry.id) ?? null },
              })),
          },
          over: null,
          scrollableAncestors: [],
        } as never,
      });

    // From line 1's last anchor the walk continues DOWN onto line
    // 2's leading anchor — the geometric (top, left) sort can never
    // express this (line 2's g:2 shares left -4 with line 1's g:0).
    expect(call("ArrowRight", itemRectAt(54, 6), 54, 6)).toEqual({ x: -54, y: 54 }); // -> g:2 (line 2)
    expect(call("ArrowRight", itemRectAt(-54, 54), -54, 54)).toEqual({ x: 0, y: 48 }); // -> Beta (line 2)
    expect(call("ArrowRight", itemRectAt(0, 48), 0, 48)).toEqual({ x: 54, y: 54 }); // -> s:2:0 (line 2)
  });
});
