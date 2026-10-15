import { act, renderHook } from "@testing-library/react";
import { type Snippet } from "@components";
import { SnippetsProvider } from "./SnippetsContext";
import { useSnippets } from "./SnippetsContext.hook";
import { snippetsReducer } from "./SnippetsContext.reducer";
import type { OrderedSnippet, SnippetsState } from "./SnippetsContext.types";

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

const move = (fromIndex: number, toIndex: number) => ({
  type: "MOVE_SNIPPET" as const,
  fromIndex,
  toIndex,
});

const seededInterleaved = (): SnippetsState => {
  const a1 = makeSnippet("a1", "Hello", 0, 5);
  const b1 = makeSnippet("b1", "Alpha", 0, 5);
  const a2 = makeSnippet("a2", "world", 6, 11);

  let state = snippetsReducer([], setSource("text-1", [a1]));
  state = snippetsReducer(state, setSource("text-2", [b1]));
  state = snippetsReducer(state, setSource("text-1", [a1, a2]));
  return state;
};

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

  it("moves a snippet within the global sequence and renumbers it dense 1..n", () => {
    const state = seededInterleaved();

    const next = snippetsReducer(state, move(0, 2));

    expect(next.map((entry) => entry.id)).toEqual(["b1", "a2", "a1"]);
    expect(next.map((entry) => entry.order)).toEqual([1, 2, 3]);
    expect(next.map((entry) => entry.sourceId)).toEqual([
      "text-2",
      "text-1",
      "text-1",
    ]);
  });

  it("moves a snippet across sources without changing its sourceId", () => {
    const state = seededInterleaved();

    const next = snippetsReducer(state, move(1, 0));

    expect(next.map((entry) => entry.id)).toEqual(["b1", "a1", "a2"]);
    expect(next.map((entry) => entry.sourceId)).toEqual([
      "text-2",
      "text-1",
      "text-1",
    ]);
    expect(next.map((entry) => entry.order)).toEqual([1, 2, 3]);
  });

  it("renumbers densely from a state left with order gaps", () => {
    const a1 = makeSnippet("a1", "Hello", 0, 5);
    const b1 = makeSnippet("b1", "Alpha", 0, 5);
    const a2 = makeSnippet("a2", "world", 6, 11);

    let state = snippetsReducer([], setSource("text-1", [a1]));
    state = snippetsReducer(state, setSource("text-2", [b1]));
    state = snippetsReducer(state, setSource("text-1", [a1, a2]));
    state = snippetsReducer(state, setSource("text-1", [a2]));
    expect(state.map((entry) => entry.order)).toEqual([2, 3]);

    const next = snippetsReducer(state, move(1, 0));

    expect(next.map((entry) => entry.id)).toEqual(["a2", "b1"]);
    expect(next.map((entry) => entry.order)).toEqual([1, 2]);
  });

  it("keeps a dense sequence when the same move is applied again", () => {
    let state = seededInterleaved();
    state = snippetsReducer(state, move(0, 2));
    state = snippetsReducer(state, move(0, 2));

    expect(state.map((entry) => entry.order)).toEqual([1, 2, 3]);
    expect(state.map((entry) => entry.id)).toEqual(["a2", "a1", "b1"]);
  });

  it("leaves the state reference untouched when fromIndex equals toIndex", () => {
    const state = seededInterleaved();

    expect(snippetsReducer(state, move(1, 1))).toBe(state);
  });

  it("no-ops when fromIndex is out of bounds", () => {
    const state = seededInterleaved();

    expect(snippetsReducer(state, move(-1, 1))).toBe(state);
    expect(snippetsReducer(state, move(3, 1))).toBe(state);
  });

  it("no-ops when toIndex is out of bounds", () => {
    const state = seededInterleaved();

    expect(snippetsReducer(state, move(0, 3))).toBe(state);
    expect(snippetsReducer(state, move(0, -1))).toBe(state);
  });

  it("no-ops on an empty state", () => {
    expect(snippetsReducer([], move(0, 0))).toEqual([]);
  });

  it("reorders colliding ids across sources by resolving array indexes", () => {
    let state = snippetsReducer([], setSource("text-1", [makeSnippet("x1", "Hello", 0, 5)]));
    state = snippetsReducer(
      state,
      setSource("text-2", [makeSnippet("x1", "Alpha", 0, 5)]),
    );

    const next = snippetsReducer(state, move(1, 0));

    expect(next.map((entry) => entry.sourceId)).toEqual(["text-2", "text-1"]);
    expect(next.map((entry) => entry.text)).toEqual(["Alpha", "Hello"]);
    expect(next.map((entry) => entry.order)).toEqual([1, 2]);
  });

  it("keeps a moved snippet at its reordered position through a later resize", () => {
    const a1Resized = makeSnippet("a1", "Hello,", 0, 6);

    let state = seededInterleaved();
    state = snippetsReducer(state, move(0, 2));
    state = snippetsReducer(state, setSource("text-1", [a1Resized, makeSnippet("a2", "world", 6, 11)]));

    expect(state.map((entry) => entry.id)).toEqual(["b1", "a2", "a1"]);
    expect(state.map((entry) => entry.text)).toEqual(["Alpha", "world", "Hello,"]);
    expect(state.map((entry) => entry.order)).toEqual([1, 2, 3]);
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

  it("reorders snippets through moveSnippet in the global merge sequence", () => {
    const { result } = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });

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

    act(() => {
      result.current.moveSnippet(0, 1);
    });

    expect(result.current.snippets.map((entry) => entry.id)).toEqual([
      "b1",
      "a1",
      "a2",
    ]);
    expect(result.current.snippets.map((entry) => entry.order)).toEqual([1, 2, 3]);
  });

  it("moveSnippet no-ops on equal or out-of-bounds indexes", () => {
    const { result } = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });

    act(() => {
      result.current.setSourceSnippets("text-1", [
        makeSnippet("a1", "Hello", 0, 5),
        makeSnippet("a2", "world", 6, 11),
      ]);
    });
    const before = result.current.snippets;

    act(() => {
      result.current.moveSnippet(1, 1);
    });
    act(() => {
      result.current.moveSnippet(0, 5);
    });
    act(() => {
      result.current.moveSnippet(-1, 0);
    });

    expect(result.current.snippets).toEqual(before);
  });

  it("exposes a stable moveSnippet reference across re-renders and state changes", () => {
    const { result, rerender } = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });

    const first = result.current.moveSnippet;
    rerender();

    expect(result.current.moveSnippet).toBe(first);

    act(() => {
      result.current.setSourceSnippets("text-1", [
        makeSnippet("a1", "Hello", 0, 5),
      ]);
    });

    expect(result.current.moveSnippet).toBe(first);
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
