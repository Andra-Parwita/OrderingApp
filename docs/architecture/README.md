# Architecture

Pages:
- [overview.md](overview.md): the request path, bindings, live updates, push, scheduled jobs, the client side, the dev flag, local versus production
- [data-model.md](data-model.md): tables (migrations 0001 to 0016), retention, R2 rules, the repository
- [images.md](images.md): kitchen picture slots and sizes, the tall phone banner, and the prompts for creating pictures (ChatGPT, Claude.ai)
- [api.md](api.md): every route with who may call it, role limits and error codes
- [seller-auth.md](seller-auth.md): sign-in as it works now (people, roles, keys, codes, passkeys); the original options kept as history
- [source-layout.md](source-layout.md): how the source is kept: folders, layering rules, conventions, checklists, and what to watch if we restructure
- [state-and-data-flow.md](state-and-data-flow.md): Redux slices and sagas, React contexts, device storage, the live and poll loops, the database trip budget, with diagrams
- **frontend.md** (not written yet): layers, folders, the Redux store and sagas

Every plan that changes `migrations/` or an API route updates these pages in the same change.

Follow the architecture principles in [the planning skill](../../.claude/skills/react-ts-app-plan/SKILL.md).
