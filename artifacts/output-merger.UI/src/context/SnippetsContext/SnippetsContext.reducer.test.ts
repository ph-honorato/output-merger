import { initialSnippetsState, snippetsReducer } from './SnippetsContext.reducer';
import type { SnippetsState, SnippetToken } from './SnippetsContext.types';
import { isSnippetToken, serialize } from '../../utils/previewDocument';
import type { Snippet } from '@components';

// ---------------------------------------------------------------------------
// Permanent regression suite for MOVE_TOKEN, ported from the tester's
// review harnesses (oracle.mjs / fuzz.mjs / repro.mjs / repro2.mjs):
// an exhaustive old-join-parity oracle over every (from, to) pair on
// unedited documents, a randomized character-multiset/id-uniqueness
// fuzz over edited documents, and the two minimized repro seams.
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
  // The tester's fuzz, ported verbatim (seeded LCG — deterministic).
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

describe('MOVE_TOKEN review regression seams', () => {
  it('preserves the character multiset when a chip is dragged to the trailing gap of an edited document (tester repro 2)', () => {
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

  it('keeps token ids unique through the two-move sequence (tester repro 1) with full join parity', () => {
    let state = buildDoc(3); // [A, " ", B, " ", C]

    state = snippetsReducer(state, { type: 'MOVE_TOKEN', fromIndex: 0, toIndex: 4 });
    expect(serialize(state.tokens)).toBe('B A C');

    state = snippetsReducer(state, { type: 'MOVE_TOKEN', fromIndex: 2, toIndex: 0 });
    expect(serialize(state.tokens)).toBe('A B C');

    const ids = state.tokens.map((token) => token.tokenId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
