# Agent working conventions

How to run a software project with an AI coordinator and delegated AI agents, so that a human owner can steer it from a distance without losing control of quality, cost or their own decisions.

These conventions are project-neutral. Put the project's own rules (stack, styling, domain rules) in its own instruction file; this file governs **how the work is run**.

---

## 1 · Roles

| role | does | never does |
|---|---|---|
| **Owner** (the human) | rules on decisions, approves builds, owns commits / pushes / tags / deploys / anything outward-facing | — |
| **Coordinator** (the main AI session) | plans, asks, briefs agents, reviews their output, runs the closing gate, keeps the board and the docs current | hand-edits product code (it delegates even one-liners), commits or pushes without being asked |
| **Builder / fixer** (a delegated agent) | builds or fixes exactly what its brief names, verifies within its brief, reports | touches files outside its brief, spawns its own sub-agents, runs the full test suite in a parallel wave |

**An agent's report is a claim, not a fact.** The coordinator checks the result itself before relaying it: reads the diff, runs the gate, looks at the capture.

---

## 2 · Talking to the owner

### Status markers: every message opens with one
The owner reads the terminal from across a room. The marker says what **the owner** must do, not how the work went.

| marker | meaning |
|---|---|
| 🔴🔴🔴 **ACTION NEEDED** | blocked on a decision or check only the owner can do, **or** all work is done and nothing is running (the owner must give the next instruction) |
| 🟡 **HEADS UP** | worth knowing: a finding, a deliverable, a judgement call they may want to overrule |
| 🟢 **NO ACTION** | progress while work is still running |

Spend 🔴 sparingly: three questions go in one 🔴 message, never three messages.

### Asking
- **Decide and report** whatever has a sensible default; ask only when the choice is genuinely the owner's or a mistake would be expensive.
- **One question at a time**, labelled **A / B / C**, with a one-line consequence for each and **one recommendation**. Record the answer, then wait for the owner's "OK" before the next question.
- **Quote the source in full** before asking about it (a reviewer comment, a spec line).
- **Never pick between conflicting sources.** State the conflict, name both sources, recommend, wait.
- **Front-load rulings before a wave.** A ruling mid-wave forces rework; say what it costs when you ask.
- **Mock-ups before builds** for any UI change; show the owner the frames and open them for them.

### Plans
- A plan for a stage or round comes with an **overlap table** (which items touch which files) and **sequential vs parallel timelines**, so the owner chooses the shape.
- Proposals that need persuading can be a rich page; implementation plans are a plain stage table: what, who, how proven, done-when.

---

## 3 · Token efficiency and the master coordinator

### The coordinator is the architect, not the typist
The master coordinator holds the whole picture: the owner's rulings, the plan, the board, what every agent is doing. Its context is the most expensive and the most valuable thing in the session, so it spends it on **decisions, briefs, reviews and the gate**, and delegates the rest.
- It **does not read whole codebases**: a read-only search agent sweeps and returns the conclusion; the coordinator reads only the few lines a decision needs.
- It **does not implement product code**: one builder per task, even for a one-liner (a short brief is cheaper than carrying the edit's context).
- It **keeps its own outputs short**: tables and bullets for the owner, briefs that point to files instead of pasting them.
- **Agent outputs stay out of the coordinator's context**: an agent returns a compact report (§4 Reports), never its transcript or file dumps.

### Pick the smallest shape that succeeds in one pass

| the work | shape | why |
|---|---|---|
| a fact lookup, one known file | the coordinator reads it directly | an agent costs more than the read |
| a docs / plan / board edit | the coordinator does it | it holds the context already |
| a broad search across many files | **one read-only search agent**, cheap tier | the conclusion, not the dumps, comes back |
| **a clear, scoped implementation** (one screen, one fix, one endpoint) | **one simple builder agent**, mid tier, with a direct brief | the common case: no wave, no worktree, no ceremony |
| 2–3 independent features on disjoint files | a parallel wave of 2–3 builders | only when the overlap table shows no shared files |
| long / risky / must survive interruptions | one builder in a separate worktree, with the owner's OK | isolation is worth its setup cost only here |
| genuinely uncertain design | one top-tier agent, reason stated | the only place the top tier earns its cost |

**Default to the single simple agent.** Most work is a direct implementation: one brief naming the files it owns, the sources to read, the proof required, and the report format. A wave or a worktree is the exception, chosen deliberately from the overlap table.

### The direct brief (for the single-agent default)
```
Task: <one sentence>.  Tier: <mid>.
Read first: <the 2–4 files / spec sections that matter, with line numbers if known>.
You own: <files / folders>. Don't touch anything else; if you need to, report instead.
Build: <the behaviour, bullet by bullet, quoting the ruling where it matters>.
Prove: typecheck; <the scoped tests>; <the one spec file> (you are alone on the tree, so run it) ;
        a capture of the changed screen, looked at.
Data / ports: <scratch DB, asserted in the same command>; <ports>; kill only your own processes.
Report: files ±, decisions, deviations with reasons, counts, attempts, the exact spec command.
```
A brief that names the files and the proof up front is the single biggest saving: the agent doesn't explore, and the coordinator doesn't re-check what it already knows.

### Delegation and cost

- **The model tier is a decision, named on every agent call.** Default: a mid-tier model for implementation; the cheapest tier for transcription and captures; the top tier only for genuinely uncertain design, with the reason stated. Omitting the tier silently inherits the most expensive one.
- **Pick the tier that succeeds in one pass.** Efficient beats cheap: a failed cheap run plus a redo costs more.
- **Extract a large source once** into a staging file, and point every downstream task at the extraction. A source re-read per task gets re-interpreted per task. Quote load-bearing prose **verbatim**.
- **Long-running commands write to a log file**; read the file afterwards. Never pipe them through `tail`/`grep` (it buffers, hides progress, and can wedge process teardown).
- **Read with the file tools, not the shell**, when inspecting; reserve the shell for builds, tests, git and servers.

---

## 4 · Running agents

### The brief
Every brief states:
1. **Ownership:** the exact files / folders the agent may edit. Shared files (design tokens, routing, schema, registries, lint config, project docs) are off-limits unless the brief names them. If the brief doesn't name it: **measure, report, don't touch.**
2. **Alone or not:** whether other agents are editing the tree. If unsaid, assume not.
3. **Verification scope:** what to run (typecheck, scoped unit tests, the named spec file) and what **not** to run.
4. **Data and ports:** which scratch database, asserted in the same command; which ports; kill only its own processes.
5. **The report format** (§4 Reports).

New asks for a running agent go in a **fresh brief**, not a mid-task message (an agent rightly treats mid-task instructions with suspicion).

### Waves
- **Cap a wave at ~3 concurrent agents.** Coordination cost grows faster than throughput beyond that.
- **Check the working tree** (`git status` on the folders a wave will touch) before writing its briefs; work may have landed since the plan.
- **In a parallel wave, builders don't run the end-to-end suite.** They write the spec, run typecheck and scoped unit tests, and report the exact spec command. A test run while another agent edits the tree hot-reloads under the test and fails as a false regression.
- **The coordinator gates once, at the end, on a quiet tree:** the specs of everything changed (and every importer of a changed shared component) plus the project's quality check. The full suite only when the owner asks.
- **Serial stages get a cheap gate every 2nd–3rd stage** (typecheck + lint + format): a serial stage ends on a quiet tree, so nothing stops it.
- **A wave with a schema change:** the schema builder applies the change to **every** scratch database the wave uses, because regenerating the shared client breaks every database copy that lacks the column.
- **Bundle 4–6 related items on one surface per round**; it's much cheaper per item than single-item rounds.

### Blockers
- **Two attempts, then park**, and report `attempts: N`. A third only with a named, evidenced new cause. A parked blocker with a sharp diagnosis is a good outcome; a private retry loop is not.
- **Or consult:** ask the coordinator, or say a second opinion would help. An opinion is input, not a directive.
- If a failure might be another agent's half-written file, that is a **report**, not a retry. If files move under you, **stop and say so**.

### Rules for agents
- **No forks or sub-agents from a builder.** A sub-agent with a copy of the brief is a second owner of the same files.
- **Duplication is allowed for parallel speed, never silently:** a marker comment at the duplicate plus a line in the report, so it becomes a refactor candidate.
- **Format the files you changed**, always; it's cheap and stops the closing gate failing on formatting alone.

### Reports (data, not prose)
Files changed (± lines) · decisions made (one line each) · deviations **with reasons** · escalations · counts before → after (tests, captures) · what was verified and how · attempts per blocker · the exact command for the coordinator's gate · the tier used. **Honest deviation beats silent compliance.**

---

## 5 · Verification

- **Development loop:** write → typecheck → the relevant specs → (visual change) capture and **actually look** → (bug fix) prove the new test **fails without the fix** (a guard that can't fail is decoration) → format and lint at the end.
- **Green is not ready for a visible change.** After agents land, **smoke-load each changed screen live** on scratch ports: zero console errors, and a capture the coordinator looks at beside a sibling screen. A component reused somewhere new gets a capture there.
- **Read the content of captures, not only the layout:** names, wording, the right person's data. Demo-looking text and data mismatches pass every test.
- **Observe the real signal, not a proxy:** list actual processes, read the actual file, count the actual rows.
- **The test harness proves; a browser drives.** Browser automation is for walking a workflow the way a demo would and for captures for the owner's eye; the automated tests remain the proof. If the browser extension can't capture (for example the window is hidden), capture with the test framework's own headless browser instead.
- **Flakes:** re-run the failing file alone on a quiet tree before calling it a regression; record the ones that pass alone.

---

## 6 · Safety: data, servers, git

### Data
- **Every database-backed test runs on a scratch copy**, with the target asserted **in the same command** (never a variable set in an earlier call).
- **A script that can destroy state refuses to run without an explicit target**; no default that resolves to the real database.
- **Never bypass a tool's consent or safety guard** (e.g. a data-loss confirmation), even on a disposable copy; if it refuses, report it and let the owner run it.
- **Some data can't be regenerated** (e.g. reviewer feedback). Export it before any reset, never change its model casually, and pull it from a remote only when the owner asks.

### Servers and ports
- Use your own ports, never the owner's. **Kill only the processes you started, by PID**, including orphaned child processes; never kill by name.
- **Stop every server when done.** Nothing is left running at a stop.

### Git
- **Commits, pushes, tags, history rewrites and deploys are the owner's**, unless they say so for that specific step.
- **Checkpoints:** take a file-level snapshot of the uncommitted tree before and after each stage; it's a safety floor when several agents edit an uncommitted tree.
- **Worktrees only with the owner's OK**, one at a time, as sibling folders created from the working branch explicitly; cleaned up after landing.
- **Keep the ignore file current** whenever tooling adds generated or local files; lockfiles are committed.
- **Binary assets:** commit only final assets (e.g. final screenshots); keep working captures in an ignored folder; make generated images deterministic (fixed clock, fixed data) so an unchanged image is byte-identical and git stores nothing new. Large binaries re-committed every round are how a repository's history reaches gigabytes.

---

## 7 · Records and documentation

- **Two homes:** durable docs (committed) and scratch (ignored). Nothing durable lives only in scratch.
- **Decisions** are numbered, quote the owner's words, state the trade-off and a "revisit when" trigger, and get amended (not silently rewritten) when overturned.
- **A live board** per round: a short summary (≤ 5 rows) on top, then every item with agent · tier · started · ETA · landed · diff · state, using **real clock times** at every start and landing.
- **Findings:** a defect found next to the work is **recorded, not fixed** (finish, don't widen), with severity and a fix suggestion.
- **Lessons:** each entry opens with a one-line "do this instead", then what happened and what it cost.
- **A start-here block** for the next session: where things stand, what's pending, and a ready prompt to paste.
- **Persistent memory** (if the assistant has one) holds the owner's working preferences and corrections, with the why; update it when corrected, delete it when wrong.

---

## 8 · Shell and file pitfalls (each cost real time)

- **Keep each file's line endings.** Read and write in binary (or pass an explicit newline mode); a default text write on Windows turns a whole LF file into CRLF and shows every line as changed.
- **Watch the encoding.** Some shells' default writers add a UTF-8 BOM or re-save as a legacy codepage; a BOM can hide the first key of an env file.
- **Backslashes:** escape sequences in scripts (`\a`, `\f`, `\r`, `\t`) silently turn Windows paths into control characters. Write such scripts to a file with the editor tool, use raw strings, or build paths without literal backslashes; then scan the result for control characters.
- **Never chain `cd X && <write>`** in a shell whose working directory persists; a failed `cd` strands the write. Use absolute paths.
- **Package installs can rewrite lockfiles**; compare them with the committed versions afterwards.
