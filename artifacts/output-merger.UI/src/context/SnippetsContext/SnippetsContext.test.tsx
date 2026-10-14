import { act, renderHook } from "@testing-library/react";
import { type Snippet } from "@components";
import { SnippetsProvider } from "./SnippetsContext";
import { useSnippets } from "./SnippetsContext.hook";
import { snippetsReducer } from "./SnippetsContext.reducer";
import type { OrderedSnippet } from "./SnippetsContext.types";

const makeSnippet = (
  id: string,
  text: string,
  startIndex: number,
  endIndex: number,
  color = "#0080FF",
): Snippet => ({ id, text, startIndex, endIndex, color });

const setSource = (sourceId: string, snippets: Snippet[]) => ({
  type: "SET_SOURCE_SNIPPETS" as const,
  sourceId,
  snippets,
});

describe("snippetsReducer", () => {
  it("registers entries for a new source with sequential orders", () => {
    const a1 = makeSnippet("a1", "Hello", 0, 5);
    const a2 = makeSnippet("a2", "world", 6, 11);

    const state = snippetsReducer([], setSource("text-1", [a1, a2]));

    expect(state).toEqual([
      { ...a1, sourceId: "text-1", order: 1 },
      { ...a2, sourceId: "text-1", order: 2 },
    ]);
  });

  it("preserves user selection order across interleaved sources", () => {
    const a1 = makeSnippet("a1", "Hello", 0, 5);
    const b1 = makeSnippet("b1", "Alpha", 0, 5);
    const a2 = makeSnippet("a2", "world", 6, 11);

    let state = snippetsReducer([], setSource("text-1", [a1]));
    state = snippetsReducer(state, setSource("text-2", [b1]));
    state = snippetsReducer(state, setSource("text-1", [a1, a2]));

    expect(state.map((entry) => entry.id)).toEqual(["a1", "b1", "a2"]);
    expect(state.map((entry) => entry.order)).toEqual([1, 2, 3]);
  });

  it("updates content on resize while keeping the assigned order", () => {
    const a1 = makeSnippet("a1", "Hello", 0, 5);

    let state = snippetsReducer([], setSource("text-1", [a1]));
    state = snippetsReducer(
      state,
      setSource("text-1", [makeSnippet("a1", "Hello,", 0, 6)]),
    );

    expect(state).toEqual([
      { ...makeSnippet("a1", "Hello,", 0, 6), sourceId: "text-1", order: 1 },
    ]);
  });

  it("removes deleted snippets and keeps surviving orders (gaps)", () => {
    const a1 = makeSnippet("a1", "Hello", 0, 5);
    const b1 = makeSnippet("b1", "Alpha", 0, 5);
    const a2 = makeSnippet("a2", "world", 6, 11);

    let state = snippetsReducer([], setSource("text-1", [a1]));
    state = snippetsReducer(state, setSource("text-2", [b1]));
    state = snippetsReducer(state, setSource("text-1", [a1, a2]));
    state = snippetsReducer(state, setSource("text-1", [a2]));

    expect(state.map((entry) => entry.id)).toEqual(["b1", "a2"]);
    expect(state.map((entry) => entry.order)).toEqual([2, 3]);
  });

  it("assigns max + 1 to a new snippet created after a deletion", () => {
    const a1 = makeSnippet("a1", "Hello", 0, 5);
    const b1 = makeSnippet("b1", "Alpha", 0, 5);

    let state = snippetsReducer([], setSource("text-1", [a1]));
    state = snippetsReducer(state, setSource("text-2", [b1]));
    state = snippetsReducer(state, setSource("text-1", []));
    state = snippetsReducer(
      state,
      setSource("text-1", [makeSnippet("a2", "world", 0, 5)]),
    );

    expect(state.map((entry) => entry.id)).toEqual(["b1", "a2"]);
    expect(state.map((entry) => entry.order)).toEqual([2, 3]);
  });

  it("clears only the emitting source, keeping other sources untouched", () => {
    const a1 = makeSnippet("a1", "Hello", 0, 5);
    const b1 = makeSnippet("b1", "Alpha", 0, 5);

    let state = snippetsReducer([], setSource("text-1", [a1]));
    state = snippetsReducer(state, setSource("text-2", [b1]));
    state = snippetsReducer(state, setSource("text-1", []));

    expect(state).toEqual([{ ...b1, sourceId: "text-2", order: 2 }]);
  });

  it("keeps a known order when the id is re-emitted at a different position", () => {
    const a1 = makeSnippet("a1", "Hello", 0, 5);

    let state = snippetsReducer([], setSource("text-1", [a1]));
    state = snippetsReducer(
      state,
      setSource("text-1", [makeSnippet("a2", "world", 6, 11), a1]),
    );

    const byId = new Map(state.map((entry) => [entry.id, entry] as const));
    expect(byId.get("a1")?.order).toBe(1);
    expect(byId.get("a2")?.order).toBe(2);
  });

  it("is content-idempotent for an identical re-dispatch", () => {
    const a1 = makeSnippet("a1", "Hello", 0, 5);

    let state = snippetsReducer([], setSource("text-1", [a1]));
    const before: OrderedSnippet[] = state;
    state = snippetsReducer(state, setSource("text-1", [a1]));

    expect(state).toEqual(before);
  });

  it("leaves state unchanged for an empty first update from a new source", () => {
    const state = snippetsReducer([], setSource("text-3", []));
    expect(state).toEqual([]);
  });

  it("tolerates id collisions across sources because diffing is scoped", () => {
    const shared = makeSnippet("x1", "Hello", 0, 5);

    let state = snippetsReducer([], setSource("text-1", [shared]));
    state = snippetsReducer(
      state,
      setSource("text-2", [makeSnippet("x1", "Alpha", 0, 5)]),
    );

    expect(state).toHaveLength(2);
    expect(state.map((entry) => entry.sourceId)).toEqual(["text-1", "text-2"]);
    expect(state.map((entry) => entry.order)).toEqual([1, 2]);
  });
});

describe("useSnippets", () => {
  it("throws a descriptive error outside the provider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useSnippets())).toThrow(
      "useSnippets must be used within a SnippetsProvider",
    );
    consoleSpy.mockRestore();
  });

  it("starts empty and preserves selection order through the provider", () => {
    const { result } = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });

    expect(result.current.snippets).toEqual([]);

    act(() => {
      result.current.setSourceSnippets("text-1", [
        makeSnippet("a1", "Hello", 0, 5),
      ]);
    });
    act(() => {
      result.current.setSourceSnippets("text-2", [
        makeSnippet("b1", "Alpha", 0, 5),
      ]);
    });
    act(() => {
      result.current.setSourceSnippets("text-1", [
        makeSnippet("a1", "Hello", 0, 5),
        makeSnippet("a2", "world", 6, 11),
      ]);
    });

    expect(result.current.snippets.map((entry) => entry.id)).toEqual([
      "a1",
      "b1",
      "a2",
    ]);
    expect(result.current.snippets.map((entry) => entry.order)).toEqual([
      1, 2, 3,
    ]);
  });

  it("exposes a stable setter reference across re-renders", () => {
    const { result, rerender } = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });

    const first = result.current.setSourceSnippets;
    rerender();

    expect(result.current.setSourceSnippets).toBe(first);
  });

  it("discards state when the provider unmounts", () => {
    const { result, unmount } = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });

    act(() => {
      result.current.setSourceSnippets("text-1", [
        makeSnippet("a1", "Hello", 0, 5),
      ]);
    });
    unmount();

    const second = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });
    expect(second.result.current.snippets).toEqual([]);
  });
});
