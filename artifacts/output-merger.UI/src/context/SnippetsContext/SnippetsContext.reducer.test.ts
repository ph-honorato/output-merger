import { initialSnippetsState, snippetsReducer } from './SnippetsContext.reducer';
import type { SnippetsState, SnippetToken } from './SnippetsContext.types';
import type { Landing, PreviewToken } from './SnippetsContext.types';
import {
  enumerateLandingAnchors,
  isSeparatorToken,
  isSnippetToken,
  normalizeTextTokens,
  serialize,
  snippetSlotToTokenIndex,
} from '../../utils/previewDocument';
import type { Snippet } from '@components';

// ---------------------------------------------------------------------------
// Permanent regression suite for MOVE_TOKEN: an exhaustive
// old-join-parity oracle over every (from, to) pair on unedited
// documents, a randomized character-multiset/id-uniqueness sweep over
// edited documents, and the two minimized regression seams (the
// suites' provenance is documented in the implementation record).
// ---------------------------------------------------------------------------

const mkSnippet = (i: number): Snippet => ({
  id: `s${i}`,
  text: String.fromCharCode(65 + i), // A, B, C, ...
  startIndex: 0,
  endIndex: 1,
  color: `color-${i}`,
});

const emit = (state: SnippetsState, ids: number[]): SnippetsState =>
  snippetsReducer(state, {
    type: 'SET_SOURCE_SNIPPETS',
    sourceId: 'text-1',
    snippets: ids.map((i) => mkSnippet(i)),
  });

const buildDoc = (n: number): SnippetsState =>
  emit(initialSnippetsState, [...Array(n).keys()]);

const chipsOf = (tokens: SnippetsState['tokens']) =>
  tokens.filter(isSnippetToken);
const chipTexts = (tokens: SnippetsState['tokens']) =>
  chipsOf(tokens).map((token) => (token as SnippetToken).text);

// Oracle: the expected chip order when MOVE_TOKEN(tokens, from, to)
// runs. Per the types doc the moved token lands right before the
// token currently at `toIndex` (=== length appends) — the old model's
// join(' ') over that order is the pinned parity.
const expectedOrder = (
  tokens: SnippetsState['tokens'],
  from: number,
  to: number,
): string[] => {
  const texts = chipTexts(tokens);
  const pFrom = tokens.slice(0, from + 1).filter(isSnippetToken).length - 1;
  const chipsBeforeTo = tokens.slice(0, to).filter(isSnippetToken).length;
  const pTo = from < to ? chipsBeforeTo - 1 : chipsBeforeTo;
  const rest = texts.slice(0, pFrom).concat(texts.slice(pFrom + 1));
  return rest.slice(0, pTo).concat([texts[pFrom]]).concat(rest.slice(pTo));
};

const idsUnique = (tokens: SnippetsState['tokens']): string[] | null => {
  const ids = tokens.map((token) => token.tokenId);
  return new Set(ids).size === ids.length ? null : ids;
};

const move = (state: SnippetsState, from: number, to: number): SnippetsState =>
  snippetsReducer(state, { type: 'MOVE_TOKEN', fromIndex: from, toIndex: to });

describe('MOVE_TOKEN exhaustive oracle (unedited documents)', () => {
  for (let n = 1; n <= 5; n += 1) {
    it(`keeps old-join parity, chip order, unique ids, and inert semantics for every (from, to) on ${n} chips`, () => {
      const base = buildDoc(n);
      expect(serialize(base.tokens)).toBe(chipTexts(base.tokens).join(' '));

      for (let from = 0; from < base.tokens.length; from += 1) {
        for (let to = 0; to <= base.tokens.length; to += 1) {
          const label = `n=${n} from=${from} to=${to}`;
          if (!isSnippetToken(base.tokens[from])) {
            expect(move(base, from, to), label).toBe(base); // non-chip guard
            continue;
          }
          const next = move(base, from, to);
          const expected = expectedOrder(base.tokens, from, to);
          expect(serialize(next.tokens), label).toBe(expected.join(' '));
          expect(chipTexts(next.tokens), label).toEqual(expected);
          expect(idsUnique(next.tokens), label).toBeNull();
          if (expected.join(',') === chipTexts(base.tokens).join(',')) {
            expect(next, label).toBe(base); // inert: reference-identical
          } else {
            expect(next, label).not.toBe(base);
          }
        }
      }
    });
  }

  it('keeps the bounds/self/no-chip guards reference-identical', () => {
    const base = buildDoc(3);
    for (const [from, to] of [
      [-1, 0],
      [3, 0],
      [1, -1],
      [1, 6],
      [1, 5],
    ]) {
      expect(move(base, from, to)).toBe(base);
    }
    expect(move(base, 1, 1)).toBe(base);
    expect(move(base, 3, 0)).toBe(base); // fromIndex is the separator
  });

  for (let n = 2; n <= 4; n += 1) {
    it(`keeps parity and unique ids through every two-move sequence on ${n} chips`, () => {
      const base = buildDoc(n);
      for (let from1 = 0; from1 < base.tokens.length; from1 += 1) {
        if (!isSnippetToken(base.tokens[from1])) continue;
        for (let to1 = 0; to1 <= base.tokens.length; to1 += 1) {
          const first = move(base, from1, to1);
          if (first === base) continue;
          const expected1 = expectedOrder(base.tokens, from1, to1);
          expect(serialize(first.tokens), `m1:${from1}->${to1}`).toBe(
            expected1.join(' '),
          );
          for (let from2 = 0; from2 < first.tokens.length; from2 += 1) {
            if (!isSnippetToken(first.tokens[from2])) continue;
            for (let to2 = 0; to2 <= first.tokens.length; to2 += 1) {
              const second = move(first, from2, to2);
              const label = `n=${n} m1:${from1}->${to1} m2:${from2}->${to2}`;
              const expected2 = expectedOrder(first.tokens, from2, to2);
              expect(serialize(second.tokens), label).toBe(expected2.join(' '));
              expect(idsUnique(second.tokens), label).toBeNull();
            }
          }
        }
      }
    });
  }
});

describe('MOVE_TOKEN randomized edited-document sweep (multiset + uniqueness)', () => {
  // A randomized sweep (seeded LCG — deterministic).
  let seed = 20261016;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  const randomTokens = (): SnippetsState['tokens'] => {
    const tokens: SnippetsState['tokens'] = [];
    const nChips = 1 + Math.floor(rand() * 4);
    let idc = 0;
    for (let i = 0; i < nChips; i += 1) {
      if (tokens.length > 0 && rand() < 0.6) {
        tokens.push({
          kind: 'text',
          tokenId: `own-text:${(idc += 1)}`,
          text: rand() < 0.4 ? ' ' : pick(['hi ', ' x', 'w', '  ']),
        });
      }
      if (rand() < 0.2) {
        tokens.push({ kind: 'line-break', tokenId: `br:${(idc += 1)}` });
      }
      tokens.push({
        kind: 'snippet',
        tokenId: `text-1:s${i}`,
        sourceSnippetId: `s${i}`,
        sourceId: 'text-1',
        color: 'c',
        text: pick(['A', 'Bee', 'C ']),
        edited: rand() < 0.3,
      });
    }
    if (tokens.length > 0 && rand() < 0.5) {
      tokens.push({
        kind: 'text',
        tokenId: `own-text:${(idc += 1)}`,
        text: pick([' tail', ' ', 'z']),
      });
    }
    return tokens;
  };

  it('preserves the character multiset, id uniqueness, and non-inert semantics over 400 random edited documents', () => {
    const stateWith = (tokens: SnippetsState['tokens']): SnippetsState => ({
      ...initialSnippetsState,
      tokens,
    });

    for (let iter = 0; iter < 400; iter += 1) {
      const tokens = randomTokens();
      const base = stateWith(tokens);
      const baseChars = serialize(tokens).split('').sort().join('');

      for (let from = 0; from < base.tokens.length; from += 1) {
        if (!isSnippetToken(base.tokens[from])) continue;
        for (let to = 0; to <= base.tokens.length; to += 1) {
          const next = snippetsReducer(base, {
            type: 'MOVE_TOKEN',
            fromIndex: from,
            toIndex: to,
          });
          const label = `iter=${iter} from=${from} to=${to} doc=[${serialize(tokens)}]`;
          // 1. Character multiset preserved — a move only relocates.
          expect(
            serialize(next.tokens).split('').sort().join(''),
            label,
          ).toBe(baseChars);
          // 2. No duplicate token ids.
          const ids = next.tokens.map((token) => token.tokenId);
          expect(new Set(ids).size, label).toBe(ids.length);
          // 3. Non-inert moves actually change the chip's position.
          if (next !== base) {
            const position = (state: SnippetsState, id: string) =>
              state.tokens
                .filter(isSnippetToken)
                .findIndex((token) => token.tokenId === id);
            const movedId = base.tokens[from].tokenId;
            expect(position(next, movedId), label).not.toBe(
              position(base, movedId),
            );
          }
          // 4. Two-move sequences (every 7th document): chars + ids.
          if (iter % 7 === 0 && next !== base) {
            for (let f2 = 0; f2 < next.tokens.length; f2 += 1) {
              if (!isSnippetToken(next.tokens[f2])) continue;
              for (let t2 = 0; t2 <= next.tokens.length; t2 += 1) {
                const second = snippetsReducer(next, {
                  type: 'MOVE_TOKEN',
                  fromIndex: f2,
                  toIndex: t2,
                });
                const label2 = `${label} m2:${f2}->${t2}`;
                expect(
                  serialize(second.tokens).split('').sort().join(''),
                  label2,
                ).toBe(baseChars);
                const ids2 = second.tokens.map((token) => token.tokenId);
                expect(new Set(ids2).size, label2).toBe(ids2.length);
              }
            }
          }
        }
      }
    }
  });
});

describe('MOVE_TOKEN regression seams', () => {
  it('preserves the character multiset when a chip is dragged to the trailing gap of an edited document (trailing-gap multiset)', () => {
    // The user typed a line break before the first chip and a trailing
    // space after the second chip, then drags the first chip to the
    // trailing gap: the carried " " must be re-inserted, never dropped.
    let state = snippetsReducer(initialSnippetsState, {
      type: 'SYNC_DOCUMENT',
      tokens: [
        { kind: 'line-break', tokenId: 'br:1' },
        { kind: 'snippet', tokenId: 'text-1:s0', sourceSnippetId: 's0', sourceId: 'text-1', color: 'c', text: 'Bee', edited: false },
        { kind: 'text', tokenId: 'own-text:1', text: ' ' },
        { kind: 'snippet', tokenId: 'text-1:s1', sourceSnippetId: 's1', sourceId: 'text-1', color: 'c', text: 'A', edited: false },
        { kind: 'text', tokenId: 'own-text:2', text: ' ' },
      ],
    });

    const before = serialize(state.tokens);
    state = snippetsReducer(state, { type: 'MOVE_TOKEN', fromIndex: 1, toIndex: 5 });

    const after = serialize(state.tokens);
    expect(after.split('').sort().join('')).toBe(before.split('').sort().join(''));
    expect(after).toBe('\nA Bee ');
  });

  it('keeps token ids unique through the two-move sequence (two-move id uniqueness) with full join parity', () => {
    let state = buildDoc(3); // [A, " ", B, " ", C]

    state = snippetsReducer(state, { type: 'MOVE_TOKEN', fromIndex: 0, toIndex: 4 });
    expect(serialize(state.tokens)).toBe('B A C');

    state = snippetsReducer(state, { type: 'MOVE_TOKEN', fromIndex: 2, toIndex: 0 });
    expect(serialize(state.tokens)).toBe('A B C');

    const ids = state.tokens.map((token) => token.tokenId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// The word-boundary landing contract ("a dragged snippet must be
// droppable at every word boundary of the document") — the
// MOVE_TOKEN_TO_LANDING oracle. Two independent specifications:
//
// 1. A STRING-LEVEL reference implementation (expectedLanding): it
//    splices the serialized string directly — the chip's text and its
//    carried separator leave the string, the landing offset is
//    re-anchored, the maximal whitespace runs around the spot pad the
//    chip (carried first, plants after) — so the expected result never
//    depends on the reducer's token splices, index adjustment, or id
//    minting.
//
// 2. The OLD-SLOT join parity for unedited documents: every landing
//    anchor (including the new separator-edge anchors) serializes
//    byte-identically to the gap-slot join semantics for the slot
//    it sits in.
// ---------------------------------------------------------------------------

const chipTok = (i: number, text?: string): SnippetToken => ({
  kind: 'snippet',
  tokenId: `src1:s${i}`,
  sourceSnippetId: `s${i}`,
  sourceId: 'src1',
  color: `color-${i}`,
  text: text ?? String.fromCharCode(65 + i),
  edited: true,
});
const textTok = (id: string, text: string): PreviewToken => ({
  kind: 'text',
  tokenId: id,
  text,
});
const brTok = (id: string): PreviewToken => ({
  kind: 'line-break',
  tokenId: id,
});
const stateOf = (tokens: PreviewToken[]): SnippetsState => ({
  ...initialSnippetsState,
  tokens,
});

/** String-level token length (line breaks serialize as "\n"). */
const tokenLen = (token: PreviewToken): number =>
  token.kind === 'line-break' ? 1 : token.text.length;
const charOffsetOf = (tokens: PreviewToken[], tokenIndex: number): number =>
  tokens.slice(0, tokenIndex).reduce((sum, token) => sum + tokenLen(token), 0);

const isWs = (ch: string | undefined): boolean =>
  ch === undefined ? false : /\s/.test(ch);

/**
 * The expected serialization when the chip at `fromIndex` drops at a
 * TEXT-SPLIT `landing` — the mirror of the reducer contract at the
 * string level: the carried " " (preceding separator first) leaves
 * with the chip, the boundary's own whitespace runs pad the sides,
 * the carried separator plants the side that lacks one (before
 * first), a side abutting non-whitespace content with no pad and no
 * carried separator gets one planted (the documented multiset
 * exception), and the chip's own carried separator / glued seam edge
 * is inert. Token-gap landings are NOT specified here — they ARE
 * MOVE_TOKEN's semantics, exhaustively oracled above and pinned
 * structurally-identical by the delegation test.
 */
const expectedLanding = (
  tokens: PreviewToken[],
  fromIndex: number,
  landing: Landing,
): string => {
  const original = serialize(tokens);
  const chip = tokens[fromIndex];
  if (!chip || chip.kind !== 'snippet' || landing.kind !== 'text-split') {
    return original;
  }
  const target = tokens[landing.tokenIndex];
  if (
    landing.tokenIndex < 0 ||
    landing.tokenIndex >= tokens.length ||
    !target ||
    target.kind !== 'text' ||
    landing.boundaryOffset < 0 ||
    landing.boundaryOffset > target.text.length
  ) {
    return original;
  }
  const before = fromIndex > 0 ? tokens[fromIndex - 1] : undefined;
  const after =
    fromIndex + 1 < tokens.length ? tokens[fromIndex + 1] : undefined;
  const carriedPreceding = before !== undefined && isSeparatorToken(before);
  const carriedFollowing =
    !carriedPreceding && after !== undefined && isSeparatorToken(after);
  const carriedText = carriedPreceding || carriedFollowing ? ' ' : null;
  const removed = new Set<number>([fromIndex]);
  if (carriedPreceding) {
    removed.add(fromIndex - 1);
  } else if (carriedFollowing) {
    removed.add(fromIndex + 1);
  }
  // Inert: the chip's own carried separator / glued seam edge.
  if (removed.has(landing.tokenIndex)) {
    return original;
  }
  if (
    (landing.tokenIndex === fromIndex - 1 &&
      landing.boundaryOffset === target.text.length) ||
    (landing.tokenIndex === fromIndex + 1 && landing.boundaryOffset === 0)
  ) {
    return original;
  }
  // Splice the chip (and the carried separator) out of the string.
  const chipStart = charOffsetOf(tokens, fromIndex);
  const cutStart = carriedPreceding ? chipStart - 1 : chipStart;
  const cutLen = tokenLen(chip) + (carriedText !== null ? 1 : 0);
  const rest = original.slice(0, cutStart) + original.slice(cutStart + cutLen);
  let offset = charOffsetOf(tokens, landing.tokenIndex) + landing.boundaryOffset;
  if (offset >= cutStart + cutLen) {
    offset -= cutLen;
  }
  const left = rest.slice(0, offset);
  const right = rest.slice(offset);
  const padL = (/\s*$/.exec(left) ?? [''])[0];
  const padR = (/^\s*/.exec(right) ?? [''])[0];
  const coreL = left.slice(0, left.length - padL.length);
  const coreR = right.slice(padR.length);
  // A side abuts content only when non-whitespace characters stand
  // next to the spot (an empty side is a document edge — no plant).
  const beforeAbuts = left.length > 0 && !isWs(left.slice(-1));
  const afterAbuts = right.length > 0 && !isWs(right.slice(0, 1));
  let beforePad = padL;
  let afterPad = padR;
  if (carriedText !== null) {
    if (beforePad === '' && beforeAbuts) {
      beforePad = carriedText;
    } else if (afterPad === '' && afterAbuts) {
      afterPad = carriedText;
    } else {
      beforePad += carriedText;
    }
  }
  if (beforePad === '' && beforeAbuts) {
    beforePad = ' ';
  }
  if (afterPad === '' && afterAbuts) {
    afterPad = ' ';
  }
  return coreL + beforePad + chip.text + afterPad + coreR;
};

/** Character-multiset delta: only spaces may be added, never removed. */
const multisetDelta = (
  before: string,
  after: string
): { added: string[]; removed: string[] } => {
  const count = (value: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (const ch of value) {
      map.set(ch, (map.get(ch) ?? 0) + 1);
    }
    return map;
  };
  const a = count(before);
  const b = count(after);
  const added: string[] = [];
  const removed: string[] = [];
  for (const [ch, n] of b) {
    const delta = n - (a.get(ch) ?? 0);
    for (let i = 0; i < delta; i += 1) added.push(ch);
  }
  for (const [ch, n] of a) {
    const delta = n - (b.get(ch) ?? 0);
    for (let i = 0; i < delta; i += 1) removed.push(ch);
  }
  return { added, removed };
};

const landingMove = (
  state: SnippetsState,
  fromIndex: number,
  landing: Landing
): SnippetsState =>
  snippetsReducer(state, {
    type: 'MOVE_TOKEN_TO_LANDING',
    fromIndex,
    landing,
  });

// Edited documents with own text: varying word counts, space runs,
// edges adjacent to chips/line breaks, and the user's example
// verbatim.
const landingDocuments: Array<[label: string, tokens: PreviewToken[]]> = [
  [
    'user example',
    [
      chipTok(0),
      textTok('t1', ' '),
      textTok('t2', 'text entered_by_user'),
      textTok('t3', ' '),
      chipTok(1),
    ],
  ],
  [
    'single word',
    [
      chipTok(0),
      textTok('t1', ' '),
      textTok('t2', 'word'),
      textTok('t3', ' '),
      chipTok(1),
    ],
  ],
  ['padded multi-word', [chipTok(0), textTok('t1', ' one two three '), chipTok(1)]],
  ['multi-space runs', [chipTok(0), textTok('t1', ' double  gap '), chipTok(1)]],
  ['glued text', [chipTok(0), textTok('t1', 'text'), chipTok(1)]],
  ['text edges', [textTok('t1', 'lead '), chipTok(0), textTok('t2', ' tail')]],
  [
    'line-broken text',
    [chipTok(0), brTok('br1'), textTok('t1', 'after'), brTok('br2'), chipTok(1)],
  ],
  [
    'three chips with words',
    [
      chipTok(0),
      textTok('t1', ' x '),
      chipTok(1),
      textTok('t2', ' y '),
      chipTok(2),
    ],
  ],
  ['chip then trailing word', [chipTok(0), textTok('t1', 'word')]],
];

describe('MOVE_TOKEN_TO_LANDING exhaustive oracle (word-boundary landings)', () => {
  // Every (chip x landing) on the edited documents: the enumerated
  // anchor set PLUS every text-token offset (the reducer accepts any
  // boundary; the anchors are the UI-reachable subset).
  for (const [label, doc] of landingDocuments) {
    it(`lands exactly at the string-level reference for every chip x landing on "${label}"`, () => {
      const state = stateOf(doc);
      let checks = 0;
      // Text-split landings only: the enumerated anchors PLUS every
      // text-token offset (the reducer accepts any boundary; the
      // anchors are the UI-reachable subset). Token-gap landings are
      // MOVE_TOKEN — covered by the delegation test below.
      const landings: Landing[] = [];
      for (const anchor of enumerateLandingAnchors(doc)) {
        if (anchor.landing.kind === 'text-split') {
          landings.push(anchor.landing);
        }
      }
      doc.forEach((token, tokenIndex) => {
        if (token.kind === 'text') {
          for (let offset = 0; offset <= token.text.length; offset += 1) {
            landings.push({
              kind: 'text-split',
              tokenIndex,
              boundaryOffset: offset,
            });
          }
        }
      });
      for (let fromIndex = 0; fromIndex < doc.length; fromIndex += 1) {
        if (!isSnippetToken(doc[fromIndex])) {
          expect(
            landingMove(state, fromIndex, landings[0]),
            `${label} from=${fromIndex}`
          ).toBe(state);
          continue;
        }
        for (const landing of landings) {
          const tag = `${label} from=${fromIndex} landing=${JSON.stringify(landing)}`;
          const next = landingMove(state, fromIndex, landing);
          expect(serialize(next.tokens), tag).toBe(
            expectedLanding(doc, fromIndex, landing)
          );
          expect(idsUnique(next.tokens), tag).toBeNull();
          const { added, removed } = multisetDelta(
            serialize(state.tokens),
            serialize(next.tokens)
          );
          expect(removed, tag).toEqual([]);
          expect(added.every((ch) => ch === ' '), tag).toBe(true);
          expect(added.length, tag).toBeLessThanOrEqual(2);
          checks += 1;
        }
      }
      expect(checks, label).toBeGreaterThan(0);
    });
  }

  it("lands the user's example verbatim with zero characters added or removed", () => {
    // |snippet 1| text entered_by_user |snippet 2| — moving snippet 1
    // between the words yields "text A entered_by_user": the internal
    // space + the carried separator are the two separating spaces.
    const state = stateOf(landingDocuments[0][1]);
    const next = landingMove(state, 0, {
      kind: 'text-split',
      tokenIndex: 2,
      boundaryOffset: 4,
    });
    expect(serialize(next.tokens)).toBe('text A entered_by_user B');
    const delta = multisetDelta(serialize(state.tokens), serialize(next.tokens));
    expect(delta.added).toEqual([]);
    expect(delta.removed).toEqual([]);
  });

  it('keeps >=1 space on each side of a chip dropped between words and at text edges', () => {
    const state = stateOf([
      chipTok(0),
      textTok('t1', ' '),
      textTok('t2', 'one two three'),
      textTok('t3', ' '),
      chipTok(1),
    ]);
    expect(
      serialize(
        landingMove(state, 0, {
          kind: 'text-split',
          tokenIndex: 2,
          boundaryOffset: 4,
        }).tokens
      )
    ).toBe('one A two three B');
    // After the text (before chip B) — the trailing-edge anchor.
    expect(
      serialize(
        landingMove(state, 0, {
          kind: 'text-split',
          tokenIndex: 2,
          boundaryOffset: 13,
        }).tokens
      )
    ).toBe('one two three A B');
    // Before the text — the chip B cross to the text's leading edge.
    expect(
      serialize(
        landingMove(state, 4, {
          kind: 'text-split',
          tokenIndex: 2,
          boundaryOffset: 0,
        }).tokens
      )
    ).toBe('A B one two three');
  });

  it('keeps the old slot join parity for every landing anchor on unedited documents', () => {
    // The exhaustive oracle (above) pins MOVE_TOKEN on
    // unedited documents; the anchors — including the new
    // separator-edge anchors — must serialize byte-identically to
    // the old gap-slot semantics for the slot they sit in.
    let checks = 0;
    for (let n = 1; n <= 5; n += 1) {
      const base = buildDoc(n);
      const anchors = enumerateLandingAnchors(base.tokens);
      const slotOf = (landing: Landing): number => {
        let seen = 0;
        for (let index = 0; index < landing.tokenIndex; index += 1) {
          if (isSnippetToken(base.tokens[index])) {
            seen += 1;
          }
        }
        return seen;
      };
      for (let from = 0; from < base.tokens.length; from += 1) {
        if (!isSnippetToken(base.tokens[from])) continue;
        for (const { landing } of anchors) {
          const tag = `n=${n} from=${from} landing=${JSON.stringify(landing)}`;
          const next = landingMove(base, from, landing);
          const expectedOld = expectedOrder(
            base.tokens,
            from,
            snippetSlotToTokenIndex(base.tokens, slotOf(landing))
          ).join(' ');
          expect(serialize(next.tokens), tag).toBe(expectedOld);
          expect(idsUnique(next.tokens), tag).toBeNull();
          checks += 1;
        }
      }
    }
    expect(checks).toBeGreaterThan(100);
  });

  it('delegates token-gap landings to MOVE_TOKEN (reference-identical)', () => {
    for (const [label, doc] of landingDocuments) {
      const state = stateOf(doc);
      for (let from = 0; from < doc.length; from += 1) {
        if (!isSnippetToken(doc[from])) continue;
        for (let to = 0; to <= doc.length; to += 1) {
          const viaLanding = landingMove(state, from, {
            kind: 'token-gap',
            tokenIndex: to,
          });
          const viaMove = move(state, from, to);
          expect(viaLanding, `${label} from=${from} to=${to}`).toStrictEqual(viaMove);
        }
      }
    }
  });

  it('keeps the guards reference-identical (bounds, non-chip, non-text landing, bad offset)', () => {
    const state = stateOf([
      chipTok(0),
      textTok('t1', ' '),
      textTok('t2', 'word'),
      chipTok(1),
    ]);
    expect(
      landingMove(state, -1, { kind: 'text-split', tokenIndex: 2, boundaryOffset: 0 })
    ).toBe(state);
    expect(
      landingMove(state, 9, { kind: 'text-split', tokenIndex: 2, boundaryOffset: 0 })
    ).toBe(state);
    expect(
      landingMove(state, 1, { kind: 'text-split', tokenIndex: 2, boundaryOffset: 0 })
    ).toBe(state); // text origin
    expect(
      landingMove(state, 0, { kind: 'text-split', tokenIndex: 3, boundaryOffset: 0 })
    ).toBe(state); // chip landing
    expect(
      landingMove(state, 0, { kind: 'text-split', tokenIndex: -1, boundaryOffset: 0 })
    ).toBe(state);
    expect(
      landingMove(state, 0, { kind: 'text-split', tokenIndex: 9, boundaryOffset: 0 })
    ).toBe(state);
    expect(
      landingMove(state, 0, { kind: 'text-split', tokenIndex: 2, boundaryOffset: -1 })
    ).toBe(state);
    expect(
      landingMove(state, 0, { kind: 'text-split', tokenIndex: 2, boundaryOffset: 5 })
    ).toBe(state);
  });

  it('keeps a chip dropped at its own glued seam edge inert (no seam plants)', () => {
    const glued = stateOf([chipTok(0), textTok('t1', 'text'), chipTok(1)]);
    // B is glued right after "text": its own spot — no plants.
    expect(
      landingMove(glued, 2, {
        kind: 'text-split',
        tokenIndex: 1,
        boundaryOffset: 4,
      })
    ).toBe(glued);
    // A is glued right before "text": its own spot.
    expect(
      landingMove(glued, 0, {
        kind: 'text-split',
        tokenIndex: 1,
        boundaryOffset: 0,
      })
    ).toBe(glued);
  });

  it('moves a chip through words even when the snippet order is unchanged', () => {
    // The point: B crosses the own text while A and
    // B keep their relative chip order.
    const state = stateOf([
      chipTok(0),
      textTok('t1', ' '),
      textTok('t2', 'words here'),
      textTok('t3', ' '),
      chipTok(1),
    ]);
    const next = landingMove(state, 4, {
      kind: 'text-split',
      tokenIndex: 2,
      boundaryOffset: 6,
    });
    expect(serialize(next.tokens)).toBe('A words B here');
    expect(next).not.toBe(state);
  });

  it('normalizes adjacent text runs eagerly — the model and every parse agree on shape', () => {
    // The parser merge is serialization-preserving, not
    // shape-preserving: without eager reducer normalization,
    // adjacent DISTINCT text tokens collapse after one render/parse
    // cycle (e.g. [A][" "]["hello"][" "][B] → [A][" hello "][B]), and
    // the same visible document would behave differently depending
    // on the model's merge history. The reducer normalizes every
    // action's result, so adjacency handed to the reducer disappears
    // in one transition and NO behavior can depend on merge history.
    // (A content-equal SYNC is reference-identical by the no-op
    // guard, so the pin drives a state-changing transition.)
    const adjacent = stateOf([
      chipTok(0),
      textTok('t1', ' '),
      textTok('t2', 'hello'),
      textTok('t3', ' '),
      chipTok(1),
    ]);
    const viaEdit = snippetsReducer(adjacent, {
      type: 'SET_EDIT_ENABLED',
      editEnabled: true,
    });
    expect(
      viaEdit.tokens.map((token) =>
        token.kind === 'text' ? token.text : token.kind,
      ),
    ).toEqual(['snippet', ' hello ', 'snippet']);

    // Already-normalized states pass through churn-free
    // (reference-identical when nothing changes).
    const normalized = stateOf([chipTok(0), textTok('t1', ' hello '), chipTok(1)]);
    expect(normalizeTextTokens(normalized.tokens)).toBe(normalized.tokens);
  });

  it('the plain-move carry is deterministic on the normalized model (the former merge-history divergence, pinned)', () => {
    // The former merge-history divergence (a): the visual document
    // "A hello" + a glued chip B used to move differently depending
    // on whether the model kept the standalone separator:
    // [A][" "]["hello"][B] carried the separator ("helloB A"), while
    // the merged [A][" hello"][B] carried nothing. Normalization
    // makes the merged shape THE shape, so the drag has ONE result:
    // A's adjacent token is the merged own text (not a separator), no
    // separator is carried, and A lands at the end glued after B —
    // the never-invent no-carry rule, now shape-independent.
    const state = stateOf([chipTok(0), textTok('t1', ' hello'), chipTok(1)]);
    const next = move(state, 0, 3);
    expect(serialize(next.tokens)).toBe(' helloBA');
    // And the un-normalized hand-built array takes the same path
    // through one transition: normalize-then-move equals the move.
    const adjacent = stateOf([
      chipTok(0),
      textTok('t1', ' '),
      textTok('t2', 'hello'),
      chipTok(1),
    ]);
    const first = snippetsReducer(adjacent, {
      type: 'SET_EDIT_ENABLED',
      editEnabled: true,
    });
    expect(serialize(move(first, 0, 3).tokens)).toBe(' helloBA');
  });

  it('source deletion keeps the space the user saw inside a merged text token (the former divergence, pinned)', () => {
    // The former merge-history divergence (b): deleting chip B from
    // ["x"][" "][B] popped the separator ("x"), while the merged
    // ["x "][B] kept it ("x "). Normalization makes the merged shape
    // THE shape — WYSIWYG-honest: the chip vanishes, the space the
    // user saw stays (it is content of the own-text token, not a
    // reconciliation separator, so the cleanup never takes it).
    const state = stateOf([textTok('t1', 'x '), chipTok(1)]);
    const next = snippetsReducer(state, {
      type: 'SET_SOURCE_SNIPPETS',
      sourceId: 'src1',
      snippets: [],
    });
    expect(serialize(next.tokens)).toBe('x ');
    expect(next.tokens).toHaveLength(1);
    expect(next.tokens[0]).toEqual(
      expect.objectContaining({ kind: 'text', text: 'x ' }),
    );
  });
});
