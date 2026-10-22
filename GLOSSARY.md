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

**Merged Text**:
The serialized preview document — snippet tokens, own text, and line breaks — in merge order; the session's output.
_Avoid_: Built text, preview text, result, final text

**Own Text**:
Text typed directly into the preview, not originating from any snippet.
_Avoid_: user text, free text, custom text

**Line Break**:
A break typed into the preview document; serializes as a newline in the merged text.
_Avoid_: newline (alone), paragraph, row

**Merge Mode**:
The session state after Start Merge, where sources are read-only and snippet selection is enabled.
_Avoid_: Merge state, started state, active mode
