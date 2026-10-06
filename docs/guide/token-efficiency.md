# Token efficiency

Applies to every session and every agent. The full rules are in §3 of [agent-working-conventions.md](agent-working-conventions.md); this page is the project's short version.

The main session is the **coordinator**: it spends its context on decisions, briefs, reviews and the gate, not on reading or typing code.

- **Name the model tier on every agent call.** Leaving it out silently inherits the most expensive one.
  - `haiku`: read-only search (Explore agent), transcription, captures
  - `sonnet`: builders and fixers (the default for implementation)
  - `opus`: only for a genuinely uncertain design question, with the reason stated
- **Default to one simple builder with a direct brief** (template in §3 of the conventions). The brief names the files to read first, the files it owns, the behaviour, the proof and the report format, so the agent doesn't explore. Use a parallel wave (max 3) only when the overlap table shows disjoint files. Use a worktree only with the owner's OK.
- **Point briefs at docs, don't paste them.** Name the one or two docs pages and sections an agent needs, never "read all of docs/".
- **Don't read whole codebases.** A search agent returns the conclusion; the coordinator reads only the lines a decision needs.
- **Read the concept brief once per planning round** and quote the parts that matter into briefs. Don't have every agent re-read it.
- **Agent reports are compact data:** files ±, decisions, deviations with reasons, counts, the exact gate command. Never transcripts or file dumps.
- **Batch independent tool calls in one turn. Don't re-run a check that passed until code changes.**
- **Long commands** (Playwright, builds) write to a log file in `scratch/`, and you read the file afterwards. Don't poll, and don't pipe through `tail` or `grep`.
- **Run tests narrowly:** the scoped unit tests and the one changed spec while building; the full Playwright suite only when the owner asks.
- **Keep owner-facing output short:** tables and bullets, with links to files instead of pasting them.
