import type { PreviewToken, SnippetToken } from '../context/SnippetsContext';
import {
  buildLandingId,
  buildSnippetTokenId,
  clampDocumentToLimit,
  enumerateLandingAnchors,
  isDocumentAtLimit,
  isSeparatorToken,
  isSnippetToken,
  landingAfterToken,
  landingBeforeToken,
  makeSeparatorToken,
  normalizeTextTokens,
  parseLandingId,
  parsePreviewDom,
  PREVIEW_DOCUMENT_MAX_LENGTH,
  remainingDocumentLength,
  serialize,
  snippetSlotToTokenIndex,
  tokensEqual,
  tokensEqualIgnoringEdited,
  truncateToUtf16Budget,
  wordBoundaryOffsets,
} from './previewDocument';

const snippetToken = (
  tokenId: string,
  text: string,
  overrides: Partial<SnippetToken> = {},
): SnippetToken => ({
  kind: 'snippet',
  tokenId,
  sourceSnippetId: tokenId.split(':')[1] ?? tokenId,
  sourceId: tokenId.split(':')[0] ?? tokenId,
  color: '#0080FF',
  text,
  edited: false,
  ...overrides,
});

const ownText = (tokenId: string, text: string): PreviewToken => ({
  kind: 'text',
  tokenId,
  text,
});

const lineBreak = (tokenId: string): PreviewToken => ({
  kind: 'line-break',
  tokenId,
});

describe('serialize', () => {
  it('returns the empty string for an empty document', () => {
    expect(serialize([])).toBe('');
  });

  it('is byte-identical to the old single-space join for an unedited build', () => {
    const tokens: PreviewToken[] = [
      snippetToken('text-1:a1', 'Hello'),
      makeSeparatorToken('text-2:b1:separator'),
      snippetToken('text-2:b1', 'brave '),
      makeSeparatorToken('text-1:a2:separator'),
      snippetToken('text-1:a2', 'world'),
      makeSeparatorToken('text-2:b2:separator'),
      snippetToken('text-2:b2', 'today'),
    ];

    expect(serialize(tokens)).toBe(
      ['Hello', 'brave ', 'world', 'today'].join(' '),
    );
  });

  it('maps line-break tokens to "\\n" without any trimming', () => {
    const tokens: PreviewToken[] = [
      lineBreak('br1'),
      ownText('t1', 'a'),
      lineBreak('br2'),
      lineBreak('br3'),
      ownText('t2', 'b'),
      lineBreak('br4'),
    ];

    expect(serialize(tokens)).toBe('\na\n\nb\n');
  });

  it('serializes snippet tokens with embedded newlines and own text verbatim', () => {
    const tokens: PreviewToken[] = [
      snippetToken('text-1:a1', 'First line\nSecond line'),
      ownText('t1', ' tail'),
    ];

    expect(serialize(tokens)).toBe('First line\nSecond line tail');
  });

  it('serializes an own-text-only document', () => {
    expect(
      serialize([ownText('t1', 'just my words'), lineBreak('br1'), ownText('t2', 'more')]),
    ).toBe('just my words\nmore');
  });
});

describe('token helpers', () => {
  it('builds composite snippet token ids unique across colliding snippet ids', () => {
    expect(buildSnippetTokenId('text-1', 'x1')).toBe('text-1:x1');
    expect(buildSnippetTokenId('text-2', 'x1')).toBe('text-2:x1');
  });

  it('recognizes separator tokens exactly (" " own text only)', () => {
    expect(isSeparatorToken(makeSeparatorToken('s1'))).toBe(true);
    expect(isSeparatorToken(ownText('t1', '  '))).toBe(false);
    expect(isSeparatorToken(ownText('t1', 'a b'))).toBe(false);
    expect(isSeparatorToken(snippetToken('text-1:a1', 'a'))).toBe(false);
    expect(isSeparatorToken(lineBreak('br1'))).toBe(false);
  });

  it('guards snippet tokens by kind', () => {
    expect(isSnippetToken(snippetToken('text-1:a1', 'a'))).toBe(true);
    expect(isSnippetToken(ownText('t1', 'a'))).toBe(false);
    expect(isSnippetToken(lineBreak('br1'))).toBe(false);
  });

  it('compares token arrays by content, not reference', () => {
    const a: PreviewToken[] = [snippetToken('text-1:a1', 'Hello'), ownText('t1', ' x')];
    expect(tokensEqual(a, [...a])).toBe(true);
    expect(
      tokensEqual(a, [snippetToken('text-1:a1', 'Hello!', { edited: true }), ownText('t1', ' x')]),
    ).toBe(false);
    expect(tokensEqual(a, [a[0]])).toBe(false);
  });

  it('compares content ignoring the snippet edited flag (self-sync recognition)', () => {
    const parse: PreviewToken[] = [
      snippetToken('text-1:a1', 'Hello!', { edited: false }),
      ownText('t1', ' x'),
      lineBreak('br1'),
    ];
    const model: PreviewToken[] = [
      snippetToken('text-1:a1', 'Hello!', { edited: true }),
      ownText('t1', ' x'),
      lineBreak('br1'),
    ];
    expect(tokensEqualIgnoringEdited(model, parse)).toBe(true);
    // A changed text or a different chip id is NOT the same parse.
    expect(
      tokensEqualIgnoringEdited(
        [snippetToken('text-1:a1', 'Hello', { edited: true })],
        parse,
      ),
    ).toBe(false);
    expect(
      tokensEqualIgnoringEdited(
        [snippetToken('text-1:a2', 'Hello!', { edited: true })],
        parse,
      ),
    ).toBe(false);
    // Length differences are never the same parse.
    expect(tokensEqualIgnoringEdited(parse.slice(0, 2), parse)).toBe(false);
  });

  it('resolves snippet slots to document token indexes (leading, middle, trailing, empty)', () => {
    const tokens: PreviewToken[] = [
      ownText('t0', 'hi '),
      snippetToken('text-1:a1', 'A'),
      ownText('t1', ' '),
      snippetToken('text-2:b1', 'B'),
      ownText('t2', ' tail'),
    ];

    expect(snippetSlotToTokenIndex(tokens, 0)).toBe(1);
    expect(snippetSlotToTokenIndex(tokens, 1)).toBe(3);
    expect(snippetSlotToTokenIndex(tokens, 2)).toBe(5); // trailing slot
    expect(snippetSlotToTokenIndex([], 0)).toBe(0);
  });
});

describe('parsePreviewDom', () => {
  const buildFlow = (children: Node[]): HTMLElement => {
    const root = document.createElement('div');
    children.forEach((child) => root.appendChild(child));
    return root;
  };

  const chip = (tokenId: string, text: string): HTMLElement => {
    const element = document.createElement('span');
    element.dataset.tokenId = tokenId;
    element.textContent = text;
    return element;
  };

  const textNode = (text: string): Text => document.createTextNode(text);

  it('parses chips into snippet tokens keyed by their data-token-id', () => {
    const previous: PreviewToken[] = [snippetToken('text-1:a1', 'Alpha')];
    const root = buildFlow([chip('text-1:a1', 'Alpha'), textNode(' '), chip('text-2:b1', 'Beta')]);

    const tokens = parsePreviewDom(root, previous);

    expect(tokens).toHaveLength(3);
    expect(tokens.map((token) => token.kind)).toEqual(['snippet', 'text', 'snippet']);
    const [first, , third] = tokens as SnippetToken[];
    expect(first.tokenId).toBe('text-1:a1');
    expect(first.sourceSnippetId).toBe('a1');
    expect(first.sourceId).toBe('text-1');
    expect(first.color).toBe('#0080FF');
    expect(third.tokenId).toBe('text-2:b1');
    // The reducer — not the parser — computes the edited flag.
    expect(first.edited).toBe(false);
  });

  it('infers source ids for an unknown chip by splitting the token id and defaults color', () => {
    const root = buildFlow([chip('text-3:weird', 'x')]);

    const [token] = parsePreviewDom(root) as SnippetToken[];

    expect(token.sourceId).toBe('text-3');
    expect(token.sourceSnippetId).toBe('weird');
    expect(token.color).toBe('transparent');
  });

  it('prunes an emptied chip (a fully-deleted snippet token vanishes)', () => {
    const root = buildFlow([chip('text-1:a1', ''), textNode('kept')]);

    const tokens = parsePreviewDom(root);

    expect(tokens).toEqual([expect.objectContaining({ kind: 'text', text: 'kept' })]);
  });

  it('splits text nodes at newlines into text runs and line-break tokens', () => {
    const root = buildFlow([textNode('ab\ncd\n\nef')]);

    const tokens = parsePreviewDom(root);

    expect(
      tokens.map((token) => (token.kind === 'line-break' ? '\n' : token.text)),
    ).toEqual(['ab', '\n', 'cd', '\n', '\n', 'ef']);
    expect(serialize(tokens)).toBe('ab\ncd\n\nef');
    // Own text tokens never contain a newline.
    tokens
      .filter((token) => token.kind === 'text')
      .forEach((token) => expect(token.text).not.toContain('\n'));
  });

  it('flattens unknown elements transparently, including nested chips', () => {
    const wrapper = document.createElement('div');
    wrapper.appendChild(textNode('pre '));
    wrapper.appendChild(chip('text-1:a1', 'Alpha'));
    wrapper.appendChild(textNode(' post'));
    const root = buildFlow([wrapper, textNode(' end')]);

    const tokens = parsePreviewDom(root, [snippetToken('text-1:a1', 'Alpha')]);

    // adjacent text nodes MERGE across transparent
    // boundaries into one own-text token — the landing anchors render
    // INSIDE text tokens (splitting them into multiple DOM text
    // nodes), so without merging every render/parse cycle would
    // fragment the model's text tokens. The wrapper still flattens
    // and the chip still lifts out.
    expect(
      tokens.map((token) =>
        token.kind === 'line-break' ? '\n' : token.kind === 'snippet' ? token.text : token.text,
      ),
    ).toEqual(['pre ', 'Alpha', ' post end']);
  });

  it('merges text pieces split by landing anchors into one token', () => {
    // The word anchors sit INSIDE a text token, splitting it
    // into DOM text pieces; the parse merges them back so the model
    // keeps one token per text run (WYSIWYG and the anchor indexes
    // stay stable).
    const gap = document.createElement('span');
    gap.setAttribute('data-landing', 'preview-landing:s:0:3');
    const root = buildFlow([
      textNode('one'),
      gap,
      textNode(' two'),
      textNode(' three'),
    ]);

    const tokens = parsePreviewDom(root);

    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual(
      expect.objectContaining({ kind: 'text', text: 'one two three' })
    );
  });

  it('parse(render(model)) matches the normalized shape for adjacent-text models', () => {
    // The parser merge is serialization-preserving, not
    // shape-preserving: without eager reducer normalization, adjacent
    // DISTINCT text tokens collapse after one render/parse cycle.
    // The reducer now normalizes eagerly, so the normalizer's shape
    // and every parse's shape must agree: one own-text token per
    // contiguous run, chips and line breaks as boundaries.
    const adjacent = [
      snippetToken('text-1:a1', 'A'),
      ownText('t1', ' '),
      ownText('t2', 'hello'),
      ownText('t3', ' '),
      snippetToken('text-2:b1', 'B'),
    ];
    const normalized = normalizeTextTokens(adjacent);
    expect(
      normalized.map((token) => (token.kind === 'text' ? token.text : token.kind)),
    ).toEqual(['snippet', ' hello ', 'snippet']);

    // parse∘render of the same visible document yields the same
    // shape (kind + boundaries; parse ids are regenerated).
    const root = buildFlow([
      chip('text-1:a1', 'A'),
      textNode(' hello '),
      chip('text-2:b1', 'B'),
    ]);
    const parsed = parsePreviewDom(root);
    expect(
      parsed.map((token) => (token.kind === 'text' ? token.text : token.kind)),
    ).toEqual(
      normalized.map((token) => (token.kind === 'text' ? token.text : token.kind))
    );
  });

  it('merges adjacent text runs keeping the first id, never across chips or line breaks', () => {
    const a = ownText('t1', 'x ');
    const b = ownText('t2', 'y');
    const c = ownText('t3', ' z');
    const chipA = snippetToken('text-1:a1', 'A');
    const br = lineBreak('br1');
    const merged = normalizeTextTokens([chipA, a, b, br, c]);
    expect(merged).toHaveLength(4);
    expect(merged[1]).toEqual({ kind: 'text', tokenId: 't1', text: 'x y' });
    // The line break blocks the merge; the trailing run stands alone.
    expect(merged[2]).toEqual(br);
    expect(merged[3]).toEqual(c);
    // Untouched tokens keep their object references.
    expect(merged[0]).toBe(chipA);
    expect(merged[2]).toBe(br);
    expect(merged[3]).toBe(c);
  });

  it('returns the SAME reference for already-normalized arrays (the no-op guard)', () => {
    const tokens = [
      snippetToken('text-1:a1', 'A'),
      ownText('t1', ' one two '),
      lineBreak('br1'),
      snippetToken('text-2:b1', 'B'),
    ];
    expect(normalizeTextTokens(tokens)).toBe(tokens);
    expect(normalizeTextTokens([])).toEqual([]);
  });

  it('treats zero-footprint anchors (gap spans, needle) as transparent', () => {
    const gap = document.createElement('span');
    gap.dataset.gapSlot = '1';
    gap.setAttribute('aria-hidden', 'true');
    const needle = document.createElement('span');
    needle.setAttribute('data-testid', 'preview-drop-indicator');
    const root = buildFlow([
      chip('text-1:a1', 'Alpha'),
      gap,
      needle,
      textNode(' '),
      chip('text-2:b1', 'Beta'),
    ]);

    const tokens = parsePreviewDom(root, [
      snippetToken('text-1:a1', 'Alpha'),
      snippetToken('text-2:b1', 'Beta'),
    ]);

    expect(serialize(tokens)).toBe('Alpha Beta');
    expect(tokens).toHaveLength(3);
  });

  it('treats a bogus <br> line anchor as parser-neutral (no token, no text)', () => {
    // The invisible-line fix plants a <br>
    // after a trailing "\n" so the caret gets a visible line box. The
    // parser must never see it: it flattens unknown elements to their
    // textContent, and a <br> has none — no token, no serialization
    // footprint, and textContent stays equal to serialize(document).
    const br = document.createElement('br');
    const root = buildFlow([chip('text-1:a1', 'Alpha'), textNode('\n'), br]);

    const tokens = parsePreviewDom(root, [snippetToken('text-1:a1', 'Alpha')]);

    expect(root.textContent).toBe('Alpha\n');
    expect(serialize(tokens)).toBe('Alpha\n');
    expect(tokens.map((token) => token.kind)).toEqual(['snippet', 'line-break']);
  });

  it('degrades a duplicated chip id to plain text (never corrupt tokens)', () => {
    const root = buildFlow([chip('text-1:a1', 'Alpha'), chip('text-1:a1', 'Alpha')]);

    const tokens = parsePreviewDom(root, [snippetToken('text-1:a1', 'Alpha')]);

    expect(tokens.filter((token) => token.kind === 'snippet')).toHaveLength(1);
    expect(serialize(tokens)).toBe('AlphaAlpha');
  });

  it('round-trips serialize∘parse over the React-rendered structure of representative documents', () => {
    const cases: PreviewToken[][] = [
      [],
      [ownText('t1', 'just own text')],
      [lineBreak('br1'), ownText('t1', 'a'), lineBreak('br2')],
      [lineBreak('br1'), lineBreak('br2'), ownText('t1', 'a'), lineBreak('br3')],
      [snippetToken('text-1:a1', 'A'), snippetToken('text-2:b1', 'B')],
      [
        snippetToken('text-1:a1', 'A'),
        makeSeparatorToken('sep'),
        snippetToken('text-2:b1', 'B'),
        ownText('t1', ' tail'),
        lineBreak('br1'),
        snippetToken('text-1:a2', 'C\nD'),
      ],
    ];

    const renderTokens = (tokens: PreviewToken[]): HTMLElement => {
      const root = document.createElement('div');
      for (const token of tokens) {
        if (token.kind === 'snippet') {
          root.appendChild(chip(token.tokenId, token.text));
        } else if (token.kind === 'text') {
          root.appendChild(textNode(token.text));
        } else {
          root.appendChild(textNode('\n'));
        }
      }
      return root;
    };

    for (const tokens of cases) {
      const dom = renderTokens(tokens);
      const parsed = parsePreviewDom(dom, tokens);
      expect(serialize(parsed)).toBe(serialize(tokens));
      expect(parsed.map((token) => token.kind)).toEqual(
        tokens.map((token) => token.kind),
      );
      expect(serialize(parsePreviewDom(renderTokens(parsed), parsed))).toBe(
        serialize(tokens),
      );
    }
  });

  it('round-trips parse∘serialize: a typed multi-line string survives as-is', () => {
    const typed = 'start\n\nmiddle line\nend';
    const root = buildFlow([textNode(typed)]);

    const tokens = parsePreviewDom(root);

    expect(serialize(tokens)).toBe(typed);
  });

  it('generates unique token ids within one parse', () => {
    const root = buildFlow([textNode('a'), textNode('\n'), textNode('b'), textNode('\n')]);

    const tokens = parsePreviewDom(root);
    const ids = tokens.map((token) => token.tokenId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// "a dragged snippet must be
// droppable at every word boundary of the document" — the landing
// model's pure helpers.
// ---------------------------------------------------------------------------

describe('landing ids', () => {
  it('round-trips token-gap and text-split landings', () => {
    expect(buildLandingId({ kind: 'token-gap', tokenIndex: 0 })).toBe(
      'preview-landing:g:0'
    );
    expect(buildLandingId({ kind: 'token-gap', tokenIndex: 5 })).toBe(
      'preview-landing:g:5'
    );
    expect(
      buildLandingId({ kind: 'text-split', tokenIndex: 2, boundaryOffset: 5 })
    ).toBe('preview-landing:s:2:5');

    expect(parseLandingId('preview-landing:g:0')).toEqual({
      kind: 'token-gap',
      tokenIndex: 0,
    });
    expect(parseLandingId('preview-landing:s:2:5')).toEqual({
      kind: 'text-split',
      tokenIndex: 2,
      boundaryOffset: 5,
    });
  });

  it('rejects foreign ids (chips, corrupt strings)', () => {
    expect(parseLandingId('text-1:a1')).toBeNull();
    expect(parseLandingId('preview-gap:0')).toBeNull();
    expect(parseLandingId('preview-landing:x')).toBeNull();
    expect(parseLandingId('preview-landing:s:x:5')).toBeNull();
    expect(parseLandingId('')).toBeNull();
  });
});

describe('wordBoundaryOffsets', () => {
  it('anchors at the start of each whitespace run between words', () => {
    expect(wordBoundaryOffsets('text entered_by_user')).toEqual([4]);
    expect(wordBoundaryOffsets('a b c')).toEqual([1, 3]);
    expect(wordBoundaryOffsets('a  double  gap')).toEqual([1, 9]);
  });

  it('contributes no boundaries for single words and pure runs', () => {
    expect(wordBoundaryOffsets('word')).toEqual([]);
    expect(wordBoundaryOffsets('  ')).toEqual([]);
    expect(wordBoundaryOffsets('')).toEqual([]);
  });
});

describe('enumerateLandingAnchors', () => {
  // The canonical five-position example:
  // |snippet 1| text entered_by_user |snippet 2|
  // The five marked positions are all droppable — plus the word
  // anchors between the text's words and the two separator-edges the
  // user's coarse diagram folds into the spot after each chip.
  const example = (): PreviewToken[] => [
    snippetToken('s1:alpha', 'Alpha'),
    ownText('t1', ' '),
    ownText('t2', 'text entered_by_user'),
    ownText('t3', ' '),
    snippetToken('s2:beta', 'Beta'),
  ];

  const landingsOf = (tokens: PreviewToken[]): string[] =>
    enumerateLandingAnchors(tokens).map((anchor) =>
      JSON.stringify(anchor.landing)
    );

  it('marks the five user positions and the word boundary', () => {
    const ids = landingsOf(example());
    expect(ids).toContain(JSON.stringify({ kind: 'token-gap', tokenIndex: 0 }));
    expect(ids).toContain(
      JSON.stringify({
        kind: 'text-split',
        tokenIndex: 2,
        boundaryOffset: 4,
      })
    );
    expect(ids).toContain(
      JSON.stringify({ kind: 'token-gap', tokenIndex: 5 })
    );
  });

  it('dedupes: a text-adjacent chip keeps no before-anchor (the text edge covers it)', () => {
    const anchors = enumerateLandingAnchors(example());
    // Beta (token 4) is preceded by the " " text token: no chip
    // before-anchor at index 4 — the separator's trailing edge
    // (s:3:1) IS the before-chip position.
    expect(
      anchors.find((a) => a.landing.kind === 'token-gap' && a.landing.tokenIndex === 4)
    ).toBeUndefined();
    expect(anchors.find((a) => a.id === 'preview-landing:s:3:1')).toBeDefined();
  });

  it('dedupes: adjacent text tokens share one anchor (the predecessor keeps the spot)', () => {
    // [chip, " ", "text"] — the " " and "text" are adjacent: the
    // text's leading edge is omitted, the separator's trailing edge
    // covers the spot.
    const tokens: PreviewToken[] = [
      snippetToken('s1:alpha', 'Alpha'),
      ownText('t1', ' '),
      ownText('t2', 'text'),
    ];
    const ids = landingsOf(tokens);
    expect(ids).not.toContain(
      JSON.stringify({ kind: 'text-split', tokenIndex: 2, boundaryOffset: 0 })
    );
    expect(ids).toContain(
      JSON.stringify({ kind: 'text-split', tokenIndex: 1, boundaryOffset: 1 })
    );
  });

  it('omits the last text token trailing edge (the trailing anchor covers the document end)', () => {
    const tokens: PreviewToken[] = [
      snippetToken('s1:alpha', 'Alpha'),
      ownText('t1', ' tail'),
    ];
    const ids = landingsOf(tokens);
    expect(ids).not.toContain(
      JSON.stringify({ kind: 'text-split', tokenIndex: 1, boundaryOffset: 5 })
    );
    expect(ids).toContain(JSON.stringify({ kind: 'token-gap', tokenIndex: 2 }));
  });

  it('keeps chip before-anchors at the doc start, after chips, and after line breaks', () => {
    const tokens: PreviewToken[] = [
      snippetToken('s1:alpha', 'Alpha'),
      lineBreak('br1'),
      snippetToken('s2:beta', 'Beta'),
    ];
    const ids = landingsOf(tokens);
    expect(ids).toContain(JSON.stringify({ kind: 'token-gap', tokenIndex: 0 }));
    expect(ids).toContain(JSON.stringify({ kind: 'token-gap', tokenIndex: 2 }));
  });

  it('contributes no anchors for line breaks, and one trailing anchor for an all-chip doc', () => {
    const tokens: PreviewToken[] = [
      snippetToken('s1:alpha', 'Alpha'),
      ownText('t1', ' '),
      snippetToken('s2:beta', 'Beta'),
    ];
    const anchors = enumerateLandingAnchors(tokens);
    expect(anchors.map((a) => a.id)).toEqual([
      'preview-landing:g:0',
      'preview-landing:s:1:0',
      'preview-landing:s:1:1',
      'preview-landing:g:3',
    ]);
  });
});

describe('chip-over insertion mapping', () => {
  const tokens = (): PreviewToken[] => [
    snippetToken('s1:alpha', 'Alpha'),
    ownText('t1', ' '),
    snippetToken('s2:beta', 'Beta'),
  ];

  it('maps "after a chip" to the next text token leading edge, else the token gap', () => {
    expect(landingAfterToken(tokens(), 0)).toEqual({
      kind: 'text-split',
      tokenIndex: 1,
      boundaryOffset: 0,
    });
    expect(landingAfterToken(tokens(), 2)).toEqual({
      kind: 'token-gap',
      tokenIndex: 3,
    });
  });

  it('maps "before a chip" to the preceding text token trailing edge, else the token gap', () => {
    expect(landingBeforeToken(tokens(), 2)).toEqual({
      kind: 'text-split',
      tokenIndex: 1,
      boundaryOffset: 1,
    });
    expect(landingBeforeToken(tokens(), 0)).toEqual({
      kind: 'token-gap',
      tokenIndex: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Document length limit: the serialized document's character count
// is capped; the helpers drive the typing/Enter/paste guards.
// ---------------------------------------------------------------------------

describe('document length limit helpers', () => {
  it('the limit constant and the remaining/at-limit math over token kinds', () => {
    expect(PREVIEW_DOCUMENT_MAX_LENGTH).toBe(2000);

    // An empty document has full room.
    expect(remainingDocumentLength([])).toBe(2000);
    expect(isDocumentAtLimit([])).toBe(false);

    // Near the limit there is exactly one room left; at it, none.
    const near = [ownText('t1', 'a'.repeat(1999))];
    expect(remainingDocumentLength(near)).toBe(1);
    expect(isDocumentAtLimit(near)).toBe(false);
    const at = [ownText('t1', 'a'.repeat(2000))];
    expect(remainingDocumentLength(at)).toBe(0);
    expect(isDocumentAtLimit(at)).toBe(true);

    // Chips count their text; line breaks count one character each.
    const mixed = [
      snippetToken('text-1:a1', 'abc'),
      lineBreak('br1'),
      ownText('t1', 'de'),
    ];
    expect(serialize(mixed)).toBe('abc\nde');
    expect(remainingDocumentLength(mixed)).toBe(2000 - 6);
  });
});

// ---------------------------------------------------------------------------
// Surrogate-safe truncation: the paste budget is UTF-16 code units,
// and a cut must never split a surrogate pair.
// ---------------------------------------------------------------------------

describe('truncateToUtf16Budget', () => {
  it('cuts by code units and never splits a surrogate pair ("a\ud83d\ude00b" across all budgets)', () => {
    const text = 'a\ud83d\ude00b'; // "a", GRINNING FACE, "b"
    // Budget 2 would slice into the pair — the lone high surrogate
    // is dropped so a broken character never lands.
    expect(truncateToUtf16Budget(text, 0)).toBe('');
    expect(truncateToUtf16Budget(text, 1)).toBe('a');
    expect(truncateToUtf16Budget(text, 2)).toBe('a');
    expect(truncateToUtf16Budget(text, 3)).toBe('a\ud83d\ude00');
    expect(truncateToUtf16Budget(text, 4)).toBe('a\ud83d\ude00b');
    // The length invariant holds everywhere.
    for (let budget = 0; budget <= 5; budget += 1) {
      expect(truncateToUtf16Budget(text, budget).length).toBeLessThanOrEqual(
        budget,
      );
    }
  });

  it('drops a pair-leading cut at the text start too ("\ud83d\ude00ab" across all budgets)', () => {
    const text = '\ud83d\ude00ab'; // GRINNING FACE, "a", "b"
    expect(truncateToUtf16Budget(text, 0)).toBe('');
    // Budget 1 cuts inside the pair: nothing insertable remains.
    expect(truncateToUtf16Budget(text, 1)).toBe('');
    expect(truncateToUtf16Budget(text, 2)).toBe('\ud83d\ude00');
    expect(truncateToUtf16Budget(text, 3)).toBe('\ud83d\ude00a');
    for (let budget = 0; budget <= 4; budget += 1) {
      expect(truncateToUtf16Budget(text, budget).length).toBeLessThanOrEqual(
        budget,
      );
    }
  });

  it('leaves BMP text untouched up to the budget', () => {
    expect(truncateToUtf16Budget('abcdef', 4)).toBe('abcd');
    expect(truncateToUtf16Budget('abcdef', 10)).toBe('abcdef');
  });

  it('returns empty on zero and negative budgets', () => {
    expect(truncateToUtf16Budget('abc', 0)).toBe('');
    expect(truncateToUtf16Budget('abc', -2)).toBe('');
    expect(truncateToUtf16Budget('', 5)).toBe('');
  });

  it('never emits a trailing lone high surrogate, even when the input is already corrupt', () => {
    // A trailing lone high surrogate in the pasted text itself is
    // dropped rather than landed.
    expect(truncateToUtf16Budget('a\ud83d', 5)).toBe('a');
    // A COMPLETE pair at the end is kept whole (its last unit is the
    // low half — the drop check must not fire).
    expect(truncateToUtf16Budget('a\ud83d\ude00', 3)).toBe('a\ud83d\ude00');
  });
});

// ---------------------------------------------------------------------------
// The post-commit document clamp: peeling the over-budget tail so a
// parsed document fits the character limit.
// ---------------------------------------------------------------------------

describe('clampDocumentToLimit', () => {
  it('is a no-op within the limit (same reference, zero removed)', () => {
    const tokens = [snippetToken('text-1:a1', 'Alpha'), ownText('t1', ' tail')];
    const result = clampDocumentToLimit(tokens, 20);
    expect(result.tokens).toBe(tokens);
    expect(result.removedUnits).toBe(0);
  });

  it('cuts the trailing text token\'s tail by the overflow', () => {
    const tokens = [ownText('t1', 'abcdefgh')];
    const { tokens: clamped, removedUnits } = clampDocumentToLimit(tokens, 5);
    expect(serialize(clamped)).toBe('abcde');
    expect(removedUnits).toBe(3);
  });

  it('drops a trailing separator whole when it fits the overflow', () => {
    const tokens = [snippetToken('text-1:a1', 'Alpha'), ownText('t1', ' ')];
    const { tokens: clamped } = clampDocumentToLimit(tokens, 5);
    // 1 unit over: the separator is dropped whole, the chip keeps its
    // text and its id.
    expect(serialize(clamped)).toBe('Alpha');
    expect(clamped[0]).toEqual(expect.objectContaining({ tokenId: 'text-1:a1' }));
  });

  it('cuts a trailing chip\'s TEXT tail — the chip survives with its id', () => {
    const tokens = [snippetToken('text-1:a1', 'Alphabc')];
    const { tokens: clamped, removedUnits } = clampDocumentToLimit(tokens, 5);
    expect(serialize(clamped)).toBe('Alpha');
    expect(removedUnits).toBe(2);
    expect(clamped).toHaveLength(1);
    expect(clamped[0]).toEqual(
      expect.objectContaining({ kind: 'snippet', tokenId: 'text-1:a1', text: 'Alpha' })
    );
  });

  it('peels across multiple tokens in one overflow (text + separator + chip text)', () => {
    // "AB x" at limit 2 — overflow 2: the tail text drops whole and
    // the separator drops whole; the chip survives with its id.
    const crossing = [
      snippetToken('text-1:a1', 'AB'),
      ownText('t1', ' '),
      ownText('t2', 'x'),
    ];
    const first = clampDocumentToLimit(crossing, 2);
    expect(serialize(first.tokens)).toBe('AB');
    expect(first.removedUnits).toBe(2);
    expect(first.tokens[0]).toEqual(
      expect.objectContaining({ kind: 'snippet', tokenId: 'text-1:a1' })
    );

    // "ABCDE x" at limit 4 — overflow 3: the tail text drops whole,
    // the separator drops whole, and the chip loses 1 text unit —
    // the chip survives with its id and a shortened text.
    const deep = [
      snippetToken('text-1:a1', 'ABCDE'),
      ownText('t1', ' '),
      ownText('t2', 'x'),
    ];
    const second = clampDocumentToLimit(deep, 4);
    expect(serialize(second.tokens)).toBe('ABCD');
    expect(second.removedUnits).toBe(3);
    expect(second.tokens).toHaveLength(1);
    expect(second.tokens[0]).toEqual(
      expect.objectContaining({ kind: 'snippet', tokenId: 'text-1:a1', text: 'ABCD' })
    );
  });

  it('drops trailing line breaks one unit each', () => {
    const tokens = [ownText('t1', 'ab'), lineBreak('br1'), lineBreak('br2')];
    const { tokens: clamped } = clampDocumentToLimit(tokens, 2);
    expect(serialize(clamped)).toBe('ab');
    expect(clamped).toEqual([expect.objectContaining({ kind: 'text', text: 'ab' })]);
  });

  it('yields the empty document when the overflow exceeds everything (text-only)', () => {
    const tokens = [ownText('t1', 'abc'), ownText('t2', 'de')];
    const { tokens: clamped, removedUnits } = clampDocumentToLimit(tokens, 0);
    expect(clamped).toEqual([]);
    expect(serialize(clamped)).toBe('');
    expect(removedUnits).toBe(5);
  });

  it('never exceeds the limit and never removes a chip', () => {
    const cases: PreviewToken[][] = [
      [ownText('t1', 'x'.repeat(30))],
      [snippetToken('text-1:a1', 'y'.repeat(20)), ownText('t1', ' ')],
      [ownText('t1', ' '), snippetToken('text-1:a1', 'z'.repeat(20))],
      [
        snippetToken('text-1:a1', 'chip'),
        ownText('t1', ' '),
        ownText('t2', 'tail words'),
        lineBreak('br1'),
      ],
    ];
    for (const tokens of cases) {
      const { tokens: clamped } = clampDocumentToLimit(tokens, 7);
      expect(serialize(clamped).length).toBeLessThanOrEqual(7);
      for (const token of clamped) {
        if (isSnippetToken(token)) {
          // A chip is never removed, whatever the overflow.
          expect(tokens.some((original) => original.tokenId === token.tokenId)).toBe(true);
        }
      }
    }
  });
});
