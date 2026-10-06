---
name: react-ts-app-plan
description: Plan, then implement, a React + TypeScript web application (a new app, a new screen, or a feature) with consistent architecture, code style and styling principles. Use when starting an app or a feature, writing an implementation plan, or briefing agents to build React/TypeScript UI. Produces a staged plan first; builds only after approval.
---

# Planning and building a React + TypeScript web app

Two phases, always in this order: **plan (and get approval) → build in stages.** Nothing is built before the plan is approved.

---

## Phase 1 · Plan

### 1. Gather the sources before deciding anything
List every source and what it owns, and read each one. Typical split:

| source | owns |
|---|---|
| requirements / spec / wireframes | **behaviour**: workflows, actions, states, what not to build |
| field-level specs | **data**: fields, types, required, validation, business rules |
| the design package / design system | **appearance**: tokens, spacing, component anatomy |
| the owner | priorities, trade-offs, anything the sources don't settle |

- **"Not specified here" is not "unspecified".** Before concluding something is unspecified, search every source.
- **When sources conflict, ask; never pick one.** State the conflict, name both, recommend, wait.
- **A screenshot or capture is for the owner's eye, never a build source.** Build from the written spec and the design package; extract literal values (sizes, colours, spacing), don't approximate by eye.
- **Design owns layout and style, not content:** labels, copy and data come from the requirements and the app.

### 2. State ambiguity, don't hide it
List the open questions. Ask them **one at a time, A / B / C with a recommendation**. Front-load them before any build starts.

### 3. Mock up any UI change first
A static HTML mock-up (one frame per state that matters) is cheap; a wrong build is not. Show it, get a pick, then build from the picked frame.

### 4. Write the plan as a stage table
```markdown
# <feature> — implementation plan

**Goal:** one sentence.  **Sources:** the documents above.  **Out of scope:** …

| stage | what | files / folders owned | proof (done when) | est. |
|---|---|---|---|---|
| 1 | data contract + API client + types | `src/api/…`, `src/types/…` | typecheck; unit tests for parsing | 1 h |
| 2 | state (slice / store / query) | `src/features/<x>/state/…` | unit tests for reducers / selectors | 1 h |
| 3 | UI: controls from the component library only | `src/features/<x>/…` | component tests; a capture looked at | 2 h |
| 4 | the screen wired into routing + fixtures for the test harness | … | e2e spec green; live smoke: 0 console errors | 1 h |

**Overlap:** which stages touch the same files (they can't run in parallel).
**Timelines:** sequential vs parallel, so the owner chooses.
**Questions for the owner:** numbered, one at a time.
```

Each stage must be buildable and verifiable on its own, by one agent, with a named owner of its files.

### 5. Choose the execution shape (token efficiency)
A master coordinator (the main session) owns the plan, the questions, the briefs, the reviews and the closing gate. It spends its context on decisions, not on reading or typing code.

| stage looks like | run it as |
|---|---|
| one screen / one fix / one endpoint with clear sources | **one simple builder agent** with a direct brief (the default) |
| 2–3 stages on disjoint files | a parallel wave of 2–3 builders; the coordinator gates once at the end on a quiet tree |
| a broad "where is X / how does Y work" question | one cheap read-only search agent; only its conclusion comes back |
| an uncertain design question | one top-tier agent with the reason stated, before any build |

The direct brief names: the task in one sentence · the tier · the 2–4 files to read first · the files it owns · the behaviour bullets · the proof (typecheck, scoped tests, the one spec, a capture) · scratch data and ports · the report format. Naming files and proof up front stops the agent exploring and stops the coordinator re-checking.

---

## Phase 2 · Build

### Architecture principles

**Layers (imports point downward only):**
```
app shell / routing
  └─ screens / features      (compose; own their state and data)
       └─ shared app components (cross-feature widgets)
            └─ UI kit            (generic controls; no app knowledge)
                 └─ design tokens / theme
contracts / types (shared by client and server; type-only)
```
- **Screens build from the UI kit only.** No third-party control imported straight into a screen; wrap it once in the kit.
- **Look before you build:** search the kit and the shared components for an existing control first.
- **No circular dependencies**; check them in the quality gate and fix them, never suppress.
- **One styling system** (e.g. CSS-in-JS with theme tokens, or CSS modules + tokens). All colours, spacing and type sizes come from tokens; no literals in components.

**State:**
- Keep state **as low as it can live**; lift it only when two siblings need it.
- Server data through one mechanism (a query cache or a store slice with an API layer), never ad-hoc `fetch` in components.
- The URL owns what should survive a reload or be shareable: filters, tabs, the open item. Read it, write it, don't mirror it in local state.
- Derived values are computed (memoised selectors), not stored.

**Data and contracts:**
- One typed contract per endpoint, shared by client and server where possible.
- Validate and narrow untrusted data at the boundary; the rest of the app trusts the types.
- Lists: page on the server, or load fully with memoised sorting **and windowed rendering**. Never render an unbounded list naively.
- Every count shown on a summary screen opens a list with the same filter, so the number and the list agree.

### TypeScript principles
- `strict` on, plus `noUncheckedIndexedAccess`; no `any` (use `unknown` and narrow).
- Model states as **discriminated unions** (`{ status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: E }`), not flags that can contradict each other.
- Prefer `type` aliases and readonly data (`ReadonlyArray<T>`, `Readonly<T>`) for anything passed around.
- One consistent array style (`Array<T>` or `T[]`) and one null style (`== null` for null-or-undefined), enforced by lint.
- Exhaustive `switch` with a `never` check, so a new union member fails the build.
- Named exports; no default exports for components (easier search and refactor).
- Closed sets of ids as string-literal unions or `as const` objects, so a typo fails the typecheck.

### React principles
- **Function components and hooks only.** One component per file for anything non-trivial; file name = component name.
- **No re-render waste:**
  - stable references: shared `EMPTY_ARRAY` / `EMPTY_OBJECT` / `noop` constants, never inline `[]`, `{}` or `() => {}` as props or selector fallbacks;
  - `useCallback` / `useMemo` where a value is passed to a memoised child or used as a dependency, not everywhere;
  - `React.memo` on list rows and other high-count children;
  - selectors return stable values (memoised), never a new array or object per call.
- **Effects are for synchronising with the outside world** only (subscriptions, timers, the DOM). Data derivation is not an effect. Every effect cleans up (timers, listeners, observers, aborted requests).
- **Keys** are stable ids, never array indexes for reorderable lists.
- **Forms:** controlled inputs with one form state object, validation in one place, errors shown next to the field and summarised for screen readers.
- **Error boundaries** around each screen; a failed request shows an inline error state with a retry, never a blank screen.
- **Accessibility is part of done:** semantic elements first; every control keyboard-operable with a visible focus ring; dialogs trap and return focus; roving tabindex for composite widgets; labels for every input; a title tooltip is an *addition*, never the only carrier of information (it's unreachable by keyboard and touch).
- **i18n:** every user-visible string through the translation layer from day one (one language is fine; the plumbing is the point).

### Styling principles
- **Tokens only:** colour, spacing, radius, type scale, shadows, z-index, motion all come from the theme. Lint or a build check fails on literals.
- **Contrast:** every text / background pairing meets WCAG AA (4.5:1 text, 3:1 large text and non-text UI); check it in the build.
- **One spacing scale**; separate with a 1px rule or spacing, not heavy borders and boxes.
- **Layout with flex / grid and intrinsic sizing** (`minmax`, `fr`); test at the narrowest and widest supported widths; long text truncates with an ellipsis *and* stays reachable (a tooltip as an addition), and key identifiers never truncate.
- **Motion:** short, purposeful, and respecting `prefers-reduced-motion`. Be wary of transitions on elements that unmount often (some libraries hold detached DOM while a transition runs).
- **No one-off styling in screens:** if a screen needs a new look, it's a new kit variant or a new token.

### Code principles
1. **Think before coding.** Don't assume; state the ambiguity; present interpretations rather than silently picking one.
2. **Simplicity first.** Nothing beyond what was asked; no abstraction for single-use code; no error handling for impossible cases. Would a senior engineer call it over-complicated? Then rewrite it.
3. **Surgical changes.** Don't "improve" adjacent code; match the surrounding style; every changed line traces to the request. Mention dead code, don't delete it uninvited.
4. **No new dependency without approval**, UI libraries above all; record the approval and the reason.
5. **Comments explain why, not what**; link a requirement or decision id where a rule comes from.
6. **One retry when stuck, then park it** with a diagnosis; never grind a blocker.

### Testing and the quality gate
- **Unit tests** for pure logic: parsing, reducers, selectors, formatting.
- **Component / integration tests** with fixtures and a network guard (no real network in tests).
- **A test harness:** every screen mountable in isolation with fixtures, so end-to-end specs run fast and deterministically. A bug fix ships with a spec that **fails without the fix**.
- **Visual changes:** a capture of the changed screen, looked at by a human or the coordinator beside a sibling screen; assert computed styles in the spec where it matters, don't diff screenshots.
- **The quality gate**, green before anything is called done: typecheck · lint · circular-dependency check · format check · unit tests · the specs of everything changed (and every importer of a changed shared component). The full end-to-end suite on request.
- **Live smoke** before handing over: load each changed screen in a real browser, zero console errors.

### Definition of done (per stage)
- [ ] Built from the sources, with the plan's stage scope only
- [ ] Types strict, no `any`, unions exhaustive
- [ ] Kit controls only; tokens only; contrast passes
- [ ] Keyboard-operable; focus visible; labels present
- [ ] No inline `[]` / `{}` / `() => {}` props; list rows memoised
- [ ] Strings through i18n
- [ ] Tests added (red before green for a fix); quality gate green
- [ ] Live smoke: 0 console errors; capture looked at
- [ ] Report: files ±, decisions, deviations with reasons, counts, the exact spec command
