# Concurrent examples with visualization checkpoints

This repository keeps the original pthread + POSIX semaphore examples and adds a minimal instrumentation PoC.

## What was added

- `include/viz.h` and `src/viz.c`: small runtime logger for checkpoint events in JSON Lines format.
- `VIZ("node_id")` macro: lightweight checkpoint marker.
- Manual thread registration with `viz_thread_register("name")` inside thread functions.
- `@viz-node` comment annotations in selected examples.
- `scripts/extract_viz_nodes.py`: line-based parser that extracts `@viz-node` entries into `nodes.json`.

## Runtime API

- `viz_init(const char *output_path)`: open trace file (e.g. `trace.jsonl`).
- `viz_shutdown(void)`: close trace file.
- `viz_thread_register(const char *thread_name)`: register current thread name and assign numeric id.
- `viz_current_thread_name(void)`: current thread name or `"unregistered"`.
- `viz_current_thread_numeric_id(void)`: internal numeric id or `0` if unregistered.
- `VIZ("node_id")`: writes a checkpoint event with file/line/function and current thread identity.

## Annotation format

Use comments like:

```c
// @viz-node id=wait_empty_before type=sync label="Wait on empty semaphore"
VIZ("wait_empty_before");
```

Extracted node fields:

- `id`
- `type`
- `label`
- `file`
- `line`

## Instrumented examples

- `src/littleBookOfSemaphores/basic/multiplex.c`
- `src/littleBookOfSemaphores/basic/mutex.c`
- `src/littleBookOfSemaphores/basic/rendezvous.c`
- `src/littleBookOfSemaphores/common/dining_philosophers.c`
- `src/littleBookOfSemaphores/common/smoking.c`
- `src/littleBookOfSemaphores/common/producer_consumer.c`
- `src/littleBookOfSemaphores/advanced/deadlock.c`
- `src/littleBookOfSemaphores/advanced/starvation.c`

## Build and run

```bash
cmake -S . -B out/Debug -DCMAKE_BUILD_TYPE=Debug
cmake --build out/Debug
./out/Debug/concurrent
```

This produces `trace.jsonl` in the current working directory.

One-command workflow (build + run + refresh visualization files):

```bash
./build --debug --viz
```

Generate and save visualization artifacts for all scenarios:

```bash
./build --debug --viz-all
```

This writes per-scenario files under:

`tools/vizualize/public/scenarios/<scenario>/{trace.jsonl,nodes.json}`

## Generate nodes JSON

Option 1 (direct script):

```bash
python3 scripts/extract_viz_nodes.py --root . --output nodes.json
```

Option 2 (CMake custom target, if Python3 is found):

```bash
cmake --build out/Debug --target viz_nodes
```

## Frontend viewer

A separate viewer tool is available at `tools/vizualize` (Vite + Cytoscape.js).

```bash
cd tools/vizualize
npm install
npm run dev
```

In the UI you can:

- auto-load prebuilt scenarios from `public/scenarios`
- manually load a single pair (`nodes.json` + `trace.jsonl`)

## Git subtree deploy (GitHub Pages)

Use this when you want to publish only the frontend without deploying the whole repo.

### Important

Push `tools/vizualize/dist` to `gh-pages` (not `tools/vizualize` source), otherwise you can hit MIME errors like blocked `src/main.js`.

### First-time setup

```bash
git remote -v
```

Make sure `origin` points to your GitHub repo.

### Deploy steps

```bash
# 1) Build frontend
cd tools/vizualize
npm ci
npm run build
cd ../..

# 2) Commit built output (dist is usually ignored, so use -f)
git add -f tools/vizualize/dist
git commit -m "build: update frontend dist for gh-pages"

# 3) Create subtree branch from dist
git branch -D viz-dist-ghpages 2>/dev/null || true
git subtree split --prefix=tools/vizualize/dist -b viz-dist-ghpages

# 4) Push subtree branch to gh-pages
git push -f origin viz-dist-ghpages:gh-pages
```

### GitHub Pages settings

- Repository `Settings -> Pages`
- Source: `Deploy from a branch`
- Branch: `gh-pages`
- Folder: `/ (root)`

If your repo is `concurrent`, open:

`https://<username>.github.io/concurrent/`
