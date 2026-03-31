# Repo Instructions

## Core principles

- **Simplicity first**: Make every change as simple as possible. Minimize code touched.
- **No laziness**: Find root causes. Avoid temporary fixes. Hold work to senior-developer standards.
- **Minimal impact**: Change only what is necessary. Avoid side effects and new bugs.

## Workflow orchestration

### 1. Plan mode default

- Enter plan mode for any non-trivial task (roughly three or more steps, or architectural decisions).
- If something goes sideways, stop and re-plan immediately.
- Use plan mode for verification steps, not only for building.
- Write detailed specs up front to reduce ambiguity.

### 2. Subagent strategy

- Use subagents liberally to keep the main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- For complex problems, use more parallel subagent work when it helps.
- One focused task per subagent.

### 3. Self-improvement loop

- After any correction from the user: update `tasks/lessons.md` with the pattern.
- Write rules for yourself that prevent the same mistake.
- Iterate on these lessons until repeat mistakes drop.
- Review lessons at session start when relevant to the project.

### 4. Verification before done

- Do not mark a task complete without proving it works.
- Diff behavior between main and your changes when that matters.
- Ask: would a staff engineer approve this?
- Run tests, check logs, and demonstrate correctness.

### 5. Demand elegance (balanced)

- For non-trivial changes: pause and ask whether there is a more elegant approach.
- If a fix feels hacky: reconsider and implement the clean solution with full context.
- Skip this for simple, obvious fixes—do not over-engineer.
- Challenge your own work before presenting it.

### 6. Autonomous bug fixing

- When given a bug report: fix it; do not ask for hand-holding.
- Use logs, errors, and failing tests—then resolve them.
- Minimize context switching for the user.
- Fix failing CI without being told the exact steps.

## Task management

1. **Plan first**: Write the plan to `tasks/todo.md` with checkable items.
2. **Verify plan**: Check in before starting implementation when appropriate.
3. **Track progress**: Mark items complete as you go.
4. **Explain changes**: Give a high-level summary at each step.
5. **Document results**: Add a short review section to `tasks/todo.md` when the work finishes.
6. **Capture lessons**: Update `tasks/lessons.md` after user corrections.

## Key conventions

### Multi-agent safety — A standout section.
  - Don't create/apply/drop git stash (other agents may be working)
  - Don't switch branches unless explicitly asked
  - On git pull --rebase, never discard other agents' work
  - Focus reports on your own edits; brief "other files present" note only if relevant

  Commit tooling — Uses a custom scripts/committer "<msg>" <file...> wrapper instead of raw git add/git commit to keep staging scoped.

  ### TS Strict guardrails:
  - Never add @ts-nocheck or disable no-explicit-any
  - Never update the Carbon dependency
  - Patching dependencies requires explicit approval
  - Release version changes require operator consent
  - No streaming/partial replies to external messaging (WhatsApp, Telegram)

  Testing discipline:
  - Vitest with 70% coverage thresholds
  - Keep Vitest on forks pool only (no threads/vmThreads) — learned the hard way
  - Don't set test workers above 16
  - Tests must clean up timers, env, globals, mocks so --isolate=false stays green

  Code style:
  - Files under ~500-700 LOC; split when it improves clarity
  - Dynamic import guardrail: never mix await import("x") and static import for the same module
  - No prototype mutation for sharing behavior
  - American English everywhere

  Lint/format churn rule — If diffs are formatting-only, auto-resolve without asking. Only prompt when changes are semantic.

### Instructions and architecture implementations

When implementing a big spec, especially one that is broken down or can be broken down into explicit tasks, implement the spec at the level of smaller, fully encapsulated components. Commit the sub-tasks to ensure clear revision history and reduced change size.

### Documentation

Always use Context7 when library/API documentation, code generation, setup, or configuration steps are needed without the user having to ask explicitly.

### TypeScript checking

The `clients/` monorepo uses bun, not npm. `npx tsc` resolves to the wrong binary. Always use `bunx tsc`:

```sh
cd clients && bunx tsc --noEmit -p apps/studies/tsconfig.json
```

### Frontend

Always try to create discrete components from a shared design system whenever possible. Avoid one-off designs that are mostly similar to the design system. Focus on designing systems for scale.

### Storybook

Any complex UI component with multiple states (empty, loading, single item, many items, error) must have Storybook stories covering all variants. This ensures components work across mobile and desktop viewports before they ship. Stories should include:
- Each visual state the component can be in
- Mobile and desktop decorator variants where layout differs
- Composition stories showing how components work together in a section

### Environment variables

When running commands that need `.env` variables, use `./scripts/with-env.sh`:

```sh
./scripts/with-env.sh go test -tags integration -run TestFoo -v ./pkg/...
```

For a different env file, set `ENV_FILE`:

```sh
ENV_FILE=go/.env ./scripts/with-env.sh go run ./cmd/server
```

Do **not** use `env $(cat .env | grep -v '^\#' | xargs)` or subshell substitution patterns.

### Database migrations

After creating or modifying a goose migration, always verify it with an up/down/up roundtrip:

```sh
./scripts/with-env.sh make db-test-migration
```

This runs `goose up` → `goose down` → `goose up` on the latest migration to confirm the down migration cleanly reverses the up and that re-applying succeeds. Do this before committing the migration.

### Git

- Always run `git add` and `git commit` from the repository root (`/Users/pk/code/go/github.com/ghostcode-ai/stonepine`), not from subdirectories.
- Don't do complex commands with git. Break them into separate lines (ex. cd repo root; git add; git commit
)
