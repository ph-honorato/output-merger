import { act, renderHook } from "@testing-library/react";
import { type Snippet } from "@components";
import { SnippetsProvider } from "./SnippetsContext";
import { useSnippets } from "./SnippetsContext.hook";
import { initialSnippetsState, snippetsReducer } from "./SnippetsContext.reducer";
import type { PreviewToken, SnippetsState, SnippetToken } from "./SnippetsContext.types";
import { isSeparatorToken, serialize } from "../../utils/previewDocument";

const makeSnippet = (
  id: string,
  text: string,
  startIndex = 0,
  endIndex = text.length,
  color = "#0080FF",
): Snippet => ({ id, text, startIndex, endIndex, color });

const setSource = (sourceId: string, snippets: Snippet[]) => ({
  type: "SET_SOURCE_SNIPPETS" as const,
  sourceId,
  snippets,
});

const moveToken = (fromIndex: number, toIndex: number) => ({
  type: "MOVE_TOKEN" as const,
  fromIndex,
  toIndex,
});

const syncDocument = (tokens: PreviewToken[]) => ({
  type: "SYNC_DOCUMENT" as const,
  tokens,
});

const setEditEnabled = (editEnabled: boolean) => ({
  type: "SET_EDIT_ENABLED" as const,
  editEnabled,
});

const snippetTexts = (state: SnippetsState) =>
  state.tokens
    .filter((token): token is SnippetToken => token.kind === "snippet")
    .map((token) => token.text);

const snippetTokenIds = (state: SnippetsState) =>
  state.tokens
    .filter((token): token is SnippetToken => token.kind === "snippet")
    .map((token) => token.tokenId);

const kindSignature = (state: SnippetsState) =>
  state.tokens.map((token) => token.kind);

// An own-text token with a fresh id (test-side id space, disjoint
// from the reducer's `${tokenId}:separator` namespace).
const ownText = (text: string): PreviewToken => ({
  kind: "text",
  tokenId: `test-own-${text.length}-${Math.random().toString(36).slice(2, 6)}`,
  text,
});

const lineBreak = (): PreviewToken => ({
  kind: "line-break",
  tokenId: `test-br-${Math.random().toString(36).slice(2, 6)}`,
});

describe("snippetsReducer — document model", () => {
  it("starts as an empty, edit-disabled document with no tombstones", () => {
    expect(initialSnippetsState).toEqual({
      tokens: [],
      tombstones: [],
      editEnabled: false,
    });
  });
});

describe("snippetsReducer — SET_SOURCE_SNIPPETS reconciliation", () => {
  it("registers one emission of two snippets joined by explicit space separator tokens", () => {
    const state = snippetsReducer(
      initialSnippetsState,
      setSource("text-1", [makeSnippet("a1", "Hello"), makeSnippet("a2", "world")]),
    );

    expect(kindSignature(state)).toEqual(["snippet", "text", "snippet"]);
    expect(serialize(state.tokens)).toBe("Hello world");
  });

  it("keeps join parity with the old single-space join across interleaved sources", () => {
    let state = initialSnippetsState;
    state = snippetsReducer(state, setSource("text-1", [makeSnippet("a1", "Hello")]));
    state = snippetsReducer(state, setSource("text-2", [makeSnippet("b1", "Alpha")]));
    state = snippetsReducer(
      state,
      setSource("text-1", [makeSnippet("a1", "Hello"), makeSnippet("a2", "world")]),
    );

    // The old model produced join(' ') over the merge-ordered
    // snippets: "Hello Alpha world".
    expect(serialize(state.tokens)).toBe("Hello Alpha world");
    expect(snippetTokenIds(state)).toEqual(["text-1:a1", "text-2:b1", "text-1:a2"]);
  });

  it("appends a later-emitted snippet at the document end with a preceding separator", () => {
    let state = snippetsReducer(
      initialSnippetsState,
      setSource("text-1", [makeSnippet("a1", "Hello")]),
    );
    state = snippetsReducer(state, setSource("text-2", [makeSnippet("b1", "Alpha")]));

    expect(serialize(state.tokens)).toBe("Hello Alpha");
    expect(kindSignature(state)).toEqual(["snippet", "text", "snippet"]);
  });

  it("preserves user selection order across interleaved sources", () => {
    let state = snippetsReducer(initialSnippetsState, setSource("text-1", [makeSnippet("a1", "Hello")]));
    state = snippetsReducer(state, setSource("text-2", [makeSnippet("b1", "Alpha")]));
    state = snippetsReducer(
      state,
      setSource("text-1", [makeSnippet("a1", "Hello"), makeSnippet("a2", "world")]),
    );

    expect(snippetTexts(state)).toEqual(["Hello", "Alpha", "world"]);
  });

  it("rewrites an unedited token's text in place on resize (position, color, identity unchanged)", () => {
    let state = snippetsReducer(
      initialSnippetsState,
      setSource("text-1", [
        makeSnippet("a1", "Hello", 0, 5),
        makeSnippet("a2", "world", 6, 11),
      ]),
    );
    const tokenBefore = state.tokens[0] as SnippetToken;

    state = snippetsReducer(
      state,
      setSource("text-1", [
        makeSnippet("a1", "Hello,", 0, 6),
        makeSnippet("a2", "world", 6, 11),
      ]),
    );

    const tokenAfter = state.tokens[0] as SnippetToken;
    expect(tokenAfter.text).toBe("Hello,");
    expect(tokenAfter.tokenId).toBe(tokenBefore.tokenId);
    expect(tokenAfter.sourceSnippetId).toBe("a1");
    expect(tokenAfter.color).toBe(tokenBefore.color);
    expect(tokenAfter.edited).toBe(false);
    expect(kindSignature(state)).toEqual(["snippet", "text", "snippet"]);
  });

  it("keeps an edited (typed-in) token text-frozen through a resize", () => {
    let state = snippetsReducer(
      initialSnippetsState,
      setSource("text-1", [makeSnippet("a1", "Hello")]),
    );
    // The user typed inside the chip: the parsed sync integrates the
    // text and marks the token edited.
    state = snippetsReducer(state, syncDocument([
      { kind: "snippet", tokenId: "text-1:a1", sourceSnippetId: "a1", sourceId: "text-1", color: "#0080FF", text: "Hello!", edited: true },
    ]));

    state = snippetsReducer(state, setSource("text-1", [makeSnippet("a1", "Hello there")]));

    expect(snippetTexts(state)).toEqual(["Hello!"]);
    expect((state.tokens[0] as SnippetToken).edited).toBe(true);
  });

  it("removes a source-deleted snippet's token together with its preceding separator and clears its tombstone", () => {
    let state = snippetsReducer(initialSnippetsState, setSource("text-1", [makeSnippet("a1", "Hello")]));
    state = snippetsReducer(state, setSource("text-2", [makeSnippet("b1", "Alpha")]));
    state = snippetsReducer(state, setSource("text-1", [makeSnippet("a1", "Hello"), makeSnippet("a2", "world")]));

    state = snippetsReducer(state, setSource("text-1", [makeSnippet("a2", "world")]));

    expect(serialize(state.tokens)).toBe("Alpha world");
    expect(snippetTokenIds(state)).toEqual(["text-2:b1", "text-1:a2"]);
  });

  it("removes the FOLLOWING separator when the deleted snippet had no preceding one", () => {
    let state = snippetsReducer(
      initialSnippetsState,
      setSource("text-1", [makeSnippet("a1", "Hello"), makeSnippet("a2", "world")]),
    );

    state = snippetsReducer(state, setSource("text-1", [makeSnippet("a2", "world")]));

    // No leading separator may remain: "world", not " world".
    expect(serialize(state.tokens)).toBe("world");
    expect(kindSignature(state)).toEqual(["snippet"]);
  });

  it("keeps old-join parity when a whole source is cleared mid-document", () => {
    let state = snippetsReducer(initialSnippetsState, setSource("text-1", [makeSnippet("a1", "Hello")]));
    state = snippetsReducer(state, setSource("text-2", [makeSnippet("b1", "Alpha")]));
    state = snippetsReducer(state, setSource("text-1", [makeSnippet("a1", "Hello"), makeSnippet("a2", "world")]));

    state = snippetsReducer(state, setSource("text-1", []));

    expect(serialize(state.tokens)).toBe("Alpha");
    expect(snippetTokenIds(state)).toEqual(["text-2:b1"]);
  });

  it("does not re-append a tombstoned id in later emissions", () => {
    let state = snippetsReducer(
      initialSnippetsState,
      setSource("text-1", [makeSnippet("a1", "Hello"), makeSnippet("a2", "world")]),
    );
    // The user deleted the a2 token entirely from the document.
    state = snippetsReducer(state, syncDocument([
      { kind: "snippet", tokenId: "text-1:a1", sourceSnippetId: "a1", sourceId: "text-1", color: "#0080FF", text: "Hello", edited: false },
    ]));
    expect(state.tombstones).toEqual(["text-1:a2"]);

    // The source still reports a2 (a resize emission): no resurrect.
    state = snippetsReducer(
      state,
      setSource("text-1", [makeSnippet("a1", "Hello"), makeSnippet("a2", "worlds")]),
    );

    expect(snippetTokenIds(state)).toEqual(["text-1:a1"]);
    expect(state.tombstones).toContain("text-1:a2");
  });

  it("appends a deleted-and-recreated source snippet (new id) normally", () => {
    let state = snippetsReducer(
      initialSnippetsState,
      setSource("text-1", [makeSnippet("a1", "Hello"), makeSnippet("a2", "world")]),
    );
    state = snippetsReducer(state, syncDocument([
      { kind: "snippet", tokenId: "text-1:a1", sourceSnippetId: "a1", sourceId: "text-1", color: "#0080FF", text: "Hello", edited: false },
    ]));

    // a3 is a NEW id (TextInput generateId): tombstones never block it.
    state = snippetsReducer(
      state,
      setSource("text-1", [makeSnippet("a1", "Hello"), makeSnippet("a3", "recreated")]),
    );

    expect(snippetTokenIds(state)).toEqual(["text-1:a1", "text-1:a3"]);
    expect(serialize(state.tokens)).toBe("Hello recreated");
  });

  it("clears a tombstone once the source emission no longer reports the id", () => {
    let state = snippetsReducer(
      initialSnippetsState,
      setSource("text-1", [makeSnippet("a1", "Hello"), makeSnippet("a2", "world")]),
    );
    state = snippetsReducer(state, syncDocument([
      { kind: "snippet", tokenId: "text-1:a1", sourceSnippetId: "a1", sourceId: "text-1", color: "#0080FF", text: "Hello", edited: false },
    ]));
    expect(state.tombstones).toEqual(["text-1:a2"]);

    state = snippetsReducer(state, setSource("text-1", [makeSnippet("a1", "Hello")]));

    expect(state.tombstones).toEqual([]);
  });

  it("keeps a known position when the id is re-emitted at a different emission index", () => {
    let state = snippetsReducer(
      initialSnippetsState,
      setSource("text-1", [makeSnippet("a1", "Hello")]),
    );
    state = snippetsReducer(
      state,
      setSource("text-1", [makeSnippet("a2", "world", 6, 11), makeSnippet("a1", "Hello")]),
    );

    expect(snippetTokenIds(state)).toEqual(["text-1:a1", "text-1:a2"]);
  });

  it("is content-idempotent for an identical re-dispatch (reference-identical)", () => {
    let state = snippetsReducer(
      initialSnippetsState,
      setSource("text-1", [makeSnippet("a1", "Hello")]),
    );
    const before = state;
    state = snippetsReducer(state, setSource("text-1", [makeSnippet("a1", "Hello")]));
    expect(state).toBe(before);
  });

  it("leaves state unchanged for an empty first update from a new source", () => {
    const state = snippetsReducer(initialSnippetsState, setSource("text-3", []));
    expect(state.tokens).toEqual([]);
  });

  it("tolerates id collisions across sources because token ids are composite", () => {
    let state = snippetsReducer(initialSnippetsState, setSource("text-1", [makeSnippet("x1", "Hello")]));
    state = snippetsReducer(state, setSource("text-2", [makeSnippet("x1", "Alpha")]));

    expect(snippetTokenIds(state)).toEqual(["text-1:x1", "text-2:x1"]);
    expect(serialize(state.tokens)).toBe("Hello Alpha");
  });

  it("appends into a non-empty own-text document with a separator", () => {
    let state = { ...initialSnippetsState, tokens: [ownText("Hi")] };
    state = snippetsReducer(state, setSource("text-1", [makeSnippet("a1", "there")]));

    expect(serialize(state.tokens)).toBe("Hi there");
  });
});

describe("snippetsReducer — MOVE_TOKEN", () => {
  const seeded = (): SnippetsState => {
    let state = snippetsReducer(initialSnippetsState, setSource("text-1", [makeSnippet("a1", "Alpha")]));
    state = snippetsReducer(state, setSource("text-2", [makeSnippet("b1", "Beta")]));
    state = snippetsReducer(state, setSource("text-1", [makeSnippet("a1", "Alpha"), makeSnippet("a2", "Gamma")]));
    return state;
  };

  it("moves a snippet token forward by token index with no renumbering field", () => {
    const state = seeded();
    // Alpha (token index 0) dropped right after Beta (token index 2):
    // insertion point 3.
    const next = snippetsReducer(state, moveToken(0, 3));

    expect(snippetTexts(next)).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(serialize(next.tokens)).toBe("Beta Alpha Gamma");
  });

  it("keeps old-join parity for a backward chip drop", () => {
    const state = seeded();
    // Gamma (index 4) dropped right before Beta (index 2).
    const next = snippetsReducer(state, moveToken(4, 2));

    expect(serialize(next.tokens)).toBe("Alpha Gamma Beta");
  });

  it("lands gap drops exactly at the marked slot with join parity (leading, middle, trailing)", () => {
    // Token indexes: [Alpha, " ", Beta, " ", Gamma] = 0..4.
    const leading = snippetsReducer(seeded(), moveToken(2, 0));
    expect(serialize(leading.tokens)).toBe("Beta Alpha Gamma");

    const middle = snippetsReducer(seeded(), moveToken(4, 2));
    expect(serialize(middle.tokens)).toBe("Alpha Gamma Beta");

    const trailing = snippetsReducer(seeded(), moveToken(0, 5));
    expect(serialize(trailing.tokens)).toBe("Beta Gamma Alpha");
  });

  it("keeps join parity when the chip carries only a following separator (document start)", () => {
    const state = snippetsReducer(
      initialSnippetsState,
      setSource("text-1", [makeSnippet("a1", "Alpha"), makeSnippet("a2", "Beta")]),
    );

    // Move Alpha (index 0, following separator at 1) to the trailing
    // slot: insertion point 3.
    const next = snippetsReducer(state, moveToken(0, 3));

    expect(serialize(next.tokens)).toBe("Beta Alpha");
    expect(kindSignature(next)).toEqual(["snippet", "text", "snippet"]);
  });

  it("is inert for a drop that does not change the snippet order (its own gap)", () => {
    const state = seeded();

    // Alpha dropped at the leading gap (its own position).
    expect(snippetsReducer(state, moveToken(0, 0))).toBe(state);
    // Alpha dropped into the gap right after itself.
    expect(snippetsReducer(state, moveToken(0, 2))).toBe(state);
  });

  it("no-ops on out-of-bounds indexes and non-snippet fromIndex", () => {
    const state = seeded();

    expect(snippetsReducer(state, moveToken(-1, 0))).toBe(state);
    expect(snippetsReducer(state, moveToken(5, 0))).toBe(state);
    expect(snippetsReducer(state, moveToken(0, -1))).toBe(state);
    expect(snippetsReducer(state, moveToken(0, 6))).toBe(state);
    // fromIndex 1 is the " " separator token, not a snippet token.
    expect(snippetsReducer(state, moveToken(1, 3))).toBe(state);
  });

  it("no-ops on an empty document", () => {
    expect(snippetsReducer(initialSnippetsState, moveToken(0, 0))).toBe(initialSnippetsState);
  });

  it("keeps a single snippet draggable but inert", () => {
    const state = snippetsReducer(
      initialSnippetsState,
      setSource("text-1", [makeSnippet("a1", "Only")]),
    );
    expect(snippetsReducer(state, moveToken(0, 1))).toBe(state);
    expect(snippetsReducer(state, moveToken(0, 0))).toBe(state);
  });

  it("never invents or steals separators in an edited document (exact landing)", () => {
    // The user deleted the separator between the chips.
    let state = snippetsReducer(initialSnippetsState, setSource("text-1", [makeSnippet("a1", "Alpha")]));
    state = snippetsReducer(state, setSource("text-2", [makeSnippet("b1", "Beta")]));
    state = snippetsReducer(state, syncDocument([
      { kind: "snippet", tokenId: "text-1:a1", sourceSnippetId: "a1", sourceId: "text-1", color: "#0080FF", text: "Alpha", edited: false },
      { kind: "snippet", tokenId: "text-2:b1", sourceSnippetId: "b1", sourceId: "text-2", color: "#FF1493", text: "Beta", edited: false },
    ]));
    expect(serialize(state.tokens)).toBe("AlphaBeta");

    // Move Beta (index 1) right before Alpha (insertion point 0):
    // exact landing, no separator invented.
    const next = snippetsReducer(state, moveToken(1, 0));
    expect(serialize(next.tokens)).toBe("BetaAlpha");
  });

  it("carries a separator through a move in an edited document that still has one", () => {
    let state = snippetsReducer(initialSnippetsState, setSource("text-1", [makeSnippet("a1", "Alpha")]));
    state = snippetsReducer(state, setSource("text-2", [makeSnippet("b1", "Beta")]));
    // Own text typed after Beta.
    state = snippetsReducer(state, syncDocument([
      { kind: "snippet", tokenId: "text-1:a1", sourceSnippetId: "a1", sourceId: "text-1", color: "#0080FF", text: "Alpha", edited: false },
      { kind: "text", tokenId: "text-1:a1:separator", text: " " },
      { kind: "snippet", tokenId: "text-2:b1", sourceSnippetId: "b1", sourceId: "text-2", color: "#FF1493", text: "Beta", edited: false },
      ownText(" and more"),
    ]));

    // Move Beta (index 2) to the document start (insertion point 0):
    // it carries its preceding separator and replants it after
    // itself.
    const next = snippetsReducer(state, moveToken(2, 0));
    expect(serialize(next.tokens)).toBe("Beta Alpha and more");
  });
});

describe("snippetsReducer — SYNC_DOCUMENT (parsed edits)", () => {
  const seededSnippet = (
    tokenId: string,
    sourceId: string,
    snippetId: string,
    text: string,
    edited = false,
  ): PreviewToken => ({
    kind: "snippet",
    tokenId,
    sourceSnippetId: snippetId,
    sourceId,
    color: "#0080FF",
    text,
    edited,
  });

  it("replaces the tokens with the parsed document", () => {
    let state = snippetsReducer(initialSnippetsState, setSource("text-1", [makeSnippet("a1", "Hello")]));
    state = snippetsReducer(state, syncDocument([
      seededSnippet("text-1:a1", "text-1", "a1", "Hello"),
      ownText(" own"),
    ]));

    expect(serialize(state.tokens)).toBe("Hello own");
  });

  it("marks a snippet token edited when its text changed by typing", () => {
    let state = snippetsReducer(initialSnippetsState, setSource("text-1", [makeSnippet("a1", "Hello")]));
    state = snippetsReducer(state, syncDocument([seededSnippet("text-1:a1", "text-1", "a1", "Hello there")]));

    expect((state.tokens[0] as SnippetToken).edited).toBe(true);
  });

  it("never resets the edited flag once set (unchanged text keeps it)", () => {
    let state = snippetsReducer(initialSnippetsState, setSource("text-1", [makeSnippet("a1", "Hello")]));
    state = snippetsReducer(state, syncDocument([seededSnippet("text-1:a1", "text-1", "a1", "Hello!", true)]));
    state = snippetsReducer(state, syncDocument([seededSnippet("text-1:a1", "text-1", "a1", "Hello!")]));

    expect((state.tokens[0] as SnippetToken).edited).toBe(true);
  });

  it("tombstones a fully-deleted snippet token id", () => {
    let state = snippetsReducer(initialSnippetsState, setSource("text-1", [makeSnippet("a1", "Hello")]));
    state = snippetsReducer(state, syncDocument([ownText("gone")]));

    expect(state.tombstones).toEqual(["text-1:a1"]);
    expect(serialize(state.tokens)).toBe("gone");
  });

  it("parses own text, line breaks, and empty artifacts (line breaks at edges, consecutive)", () => {
    const state = snippetsReducer(initialSnippetsState, syncDocument([
      lineBreak(),
      ownText("a"),
      lineBreak(),
      lineBreak(),
      ownText("b"),
      lineBreak(),
    ]));

    expect(serialize(state.tokens)).toBe("\na\n\nb\n");
  });

  it("is content-idempotent for an identical whole-document sync", () => {
    let state = snippetsReducer(initialSnippetsState, setSource("text-1", [makeSnippet("a1", "Hello")]));
    const tokens = [seededSnippet("text-1:a1", "text-1", "a1", "Hello")];
    state = snippetsReducer(state, syncDocument(tokens));
    const before = state;
    state = snippetsReducer(state, syncDocument(tokens));
    expect(state).toBe(before);
  });

  it("prunes an emptied snippet token entirely (fully deleted)", () => {
    let state = snippetsReducer(
      initialSnippetsState,
      setSource("text-1", [makeSnippet("a1", "Hello"), makeSnippet("a2", "world")]),
    );
    state = snippetsReducer(state, syncDocument([
      seededSnippet("text-1:a2", "text-1", "a2", "world"),
    ]));

    expect(snippetTokenIds(state)).toEqual(["text-1:a2"]);
    expect(state.tombstones).toEqual(["text-1:a1"]);
  });
});

describe("snippetsReducer — SET_EDIT_ENABLED", () => {
  it("flips the session edit flag and no-ops on the same value", () => {
    const on = snippetsReducer(initialSnippetsState, setEditEnabled(true));
    expect(on.editEnabled).toBe(true);
    expect(snippetsReducer(on, setEditEnabled(true))).toBe(on);
    const off = snippetsReducer(on, setEditEnabled(false));
    expect(off.editEnabled).toBe(false);
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

  it("starts with an empty document and editing disabled", () => {
    const { result } = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });

    expect(result.current.document).toEqual([]);
    expect(result.current.editEnabled).toBe(false);
  });

  it("preserves selection order through the provider", () => {
    const { result } = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });

    act(() => {
      result.current.setSourceSnippets("text-1", [makeSnippet("a1", "Hello")]);
    });
    act(() => {
      result.current.setSourceSnippets("text-2", [makeSnippet("b1", "Alpha")]);
    });
    act(() => {
      result.current.setSourceSnippets("text-1", [
        makeSnippet("a1", "Hello"),
        makeSnippet("a2", "world"),
      ]);
    });

    expect(serialize(result.current.document)).toBe("Hello Alpha world");
  });

  it("reorders snippets through moveToken with join parity", () => {
    const { result } = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });

    act(() => {
      result.current.setSourceSnippets("text-1", [makeSnippet("a1", "Hello")]);
    });
    act(() => {
      result.current.setSourceSnippets("text-2", [makeSnippet("b1", "Alpha")]);
    });
    act(() => {
      result.current.setSourceSnippets("text-1", [
        makeSnippet("a1", "Hello"),
        makeSnippet("a2", "world"),
      ]);
    });

    act(() => {
      // Hello (token 0) right after Alpha (token 2).
      result.current.moveToken(0, 3);
    });

    expect(serialize(result.current.document)).toBe("Alpha Hello world");
  });

  it("moveToken no-ops on equal or out-of-bounds indexes", () => {
    const { result } = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });

    act(() => {
      result.current.setSourceSnippets("text-1", [
        makeSnippet("a1", "Hello"),
        makeSnippet("a2", "world"),
      ]);
    });
    const before = result.current.document;

    act(() => {
      result.current.moveToken(1, 1);
    });
    act(() => {
      result.current.moveToken(0, 9);
    });
    act(() => {
      result.current.moveToken(-1, 0);
    });

    expect(result.current.document).toEqual(before);
  });

  it("exposes stable references for all five APIs across re-renders and state changes", () => {
    const { result, rerender } = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });

    const first = {
      setSourceSnippets: result.current.setSourceSnippets,
      moveToken: result.current.moveToken,
      syncDocument: result.current.syncDocument,
      setEditEnabled: result.current.setEditEnabled,
    };
    rerender();

    expect(result.current.setSourceSnippets).toBe(first.setSourceSnippets);
    expect(result.current.moveToken).toBe(first.moveToken);
    expect(result.current.syncDocument).toBe(first.syncDocument);
    expect(result.current.setEditEnabled).toBe(first.setEditEnabled);

    act(() => {
      result.current.setSourceSnippets("text-1", [makeSnippet("a1", "Hello")]);
    });

    expect(result.current.setSourceSnippets).toBe(first.setSourceSnippets);
    expect(result.current.moveToken).toBe(first.moveToken);
    expect(result.current.syncDocument).toBe(first.syncDocument);
    expect(result.current.setEditEnabled).toBe(first.setEditEnabled);
  });

  it("syncs a parsed edit and flips the shared edit flag through the provider", () => {
    const { result } = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });

    act(() => {
      result.current.setEditEnabled(true);
    });
    expect(result.current.editEnabled).toBe(true);

    act(() => {
      result.current.syncDocument([ownText("typed")]);
    });
    expect(serialize(result.current.document)).toBe("typed");

    act(() => {
      result.current.setEditEnabled(false);
    });
    expect(result.current.editEnabled).toBe(false);
  });

  it("discards state when the provider unmounts", () => {
    const { result, unmount } = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });

    act(() => {
      result.current.setSourceSnippets("text-1", [makeSnippet("a1", "Hello")]);
    });
    unmount();

    const second = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });
    expect(second.result.current.document).toEqual([]);
    expect(second.result.current.editEnabled).toBe(false);
  });

  it("separators inserted by reconciliation are recognized as separator tokens", () => {
    const { result } = renderHook(() => useSnippets(), {
      wrapper: SnippetsProvider,
    });

    act(() => {
      result.current.setSourceSnippets("text-1", [makeSnippet("a1", "Hello")]);
    });
    act(() => {
      result.current.setSourceSnippets("text-2", [makeSnippet("b1", "Alpha")]);
    });

    expect(result.current.document.filter(isSeparatorToken)).toHaveLength(1);
  });
});
