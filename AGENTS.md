# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains C sources:
  - `src/littleBookOfSemaphores/basic|common|advanced/` for concurrency scenarios.
  - `src/examples/local/` for local demo examples (`termin*`).
  - `src/utils/` shared helpers (for example `watchdog.c`).
  - `src/main.c` scenario runner entrypoint.
- `include/` mirrors headers by domain (`littleBookOfSemaphores/...`, `examples/local/...`, `utils/...`, `viz.h`).
- `scripts/` contains helper scripts (node extraction, scenario artifact generation).
- `tools/vizualize/` is the frontend viewer (Vite + Cytoscape), with prebuilt data in `public/scenarios/`.
- `tests/` contains Criterion-based C tests.

## Build, Test, and Development Commands
- `./build --debug` — configure and build C project (`out/Debug`).
- `./build --debug --run --scenario starvation` — run selected scenario.
- `./build --debug --viz` — build, run current scenario, regenerate `nodes.json` and sample files.
- `./build --debug --viz-all` — generate artifacts for all scenarios into `tools/vizualize/public/scenarios/`.
- `./build --test` — build and run Criterion tests (requires `BUILD_TESTS=ON` path in script).
- Frontend:
  - `cd tools/vizualize && npm ci && npm run dev` — local UI.
  - `npm run build` — production frontend bundle.

## Coding Style & Naming Conventions
- C code uses 4-space indentation, braces on next line, and descriptive `snake_case`.
- Scenario node IDs follow `domain_action_phase` style (example: `pc_producer_post_full_after`).
- Keep `@viz-node` comments directly above matching `VIZ("node_id")` calls.
- Prefer small reusable utilities in `src/utils/` over duplicated logic.

## Testing Guidelines
- Use Criterion for C tests; place tests in `tests/` and name files `test_*.c`.
- Focus on deterministic behavior and synchronization edge cases.
- For visualization changes, validate with `./build --viz-all` and frontend `npm run build`.

## Commit & Pull Request Guidelines
- Use concise, scoped commit messages (examples: `fix: ...`, `chore: ...`, `build: ...`).
- Keep PRs focused: include what changed, why, and affected scenarios.
- For UI changes, attach at least one screenshot.
- If scenario traces change, mention regenerated files (`nodes.json`, `public/scenarios/*`).

## Deployment Notes
- GitHub Pages deploy should publish `tools/vizualize/dist` (not source).
- For subtree flow, use the documented `dist -> gh-pages` commands from `readme.MD`.
