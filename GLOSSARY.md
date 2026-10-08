# Output Merger

Output Merger is an AI output comparison platform: users compose source texts, select fragments of them, and merge those fragments into a single output with live preview.

## Language

**Merge Session**:
The working instance where a user composes sources, selects snippets, and builds the merged output.
_Avoid_: Session (ambiguous once v1 persists sessions), workspace

**Source**:
A text input that contributes snippets to a merge session.
_Avoid_: Text input, column, entry, text

**Snippet**:
A user-selected, word-aligned fragment of a source text, destined for the merged output.
_Avoid_: Highlight, selection, fragment, quote

**Merge Order**:
The sequence in which snippets appear in the merged output. Defaults to the order snippets were selected in; editable in the preview.
_Avoid_: Order (alone), sequence, sort, position
