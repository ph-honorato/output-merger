import type { PreviewToken, SnippetToken } from '../context/SnippetsContext';
import {
  buildSnippetTokenId,
  isSeparatorToken,
  isSnippetToken,
  makeSeparatorToken,
  parsePreviewDom,
  serialize,
  snippetSlotToTokenIndex,
  tokensEqual,
  tokensEqualIgnoringEdited,
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

    expect(
      tokens.map((token) =>
        token.kind === 'line-break' ? '\n' : token.kind === 'snippet' ? token.text : token.text,
      ),
    ).toEqual(['pre ', 'Alpha', ' post', ' end']);
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
