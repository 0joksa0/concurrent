#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
EXE_PATH="${1:-$ROOT_DIR/out/Debug/concurrent}"
OUT_DIR="$ROOT_DIR/tools/vizualize/public/scenarios"
NODES_PATH="$ROOT_DIR/nodes.json"

if [[ ! -x "$EXE_PATH" ]]; then
  echo "Executable not found: $EXE_PATH"
  exit 1
fi

mkdir -p "$OUT_DIR"
python3 "$ROOT_DIR/scripts/extract_viz_nodes.py" --root "$ROOT_DIR" --output "$NODES_PATH"

SCENARIOS=$("$EXE_PATH" --list-scenarios | tail -n +2 | tr -d '\r')
if [[ -z "$SCENARIOS" ]]; then
  echo "No scenarios found."
  exit 1
fi

while IFS= read -r scenario_raw; do
  scenario=$(echo "$scenario_raw" | xargs)
  [[ -z "$scenario" ]] && continue
  scenario_dir="$OUT_DIR/$scenario"
  mkdir -p "$scenario_dir"

  VIZ_TRACE_FILE="$scenario_dir/trace.jsonl" "$EXE_PATH" --scenario "$scenario" >/dev/null 2>&1
  cp "$NODES_PATH" "$scenario_dir/nodes.json"
done <<< "$SCENARIOS"

python3 - "$OUT_DIR" <<'PY'
import json
import os
import sys

out_dir = sys.argv[1]
entries = []
for name in sorted(os.listdir(out_dir)):
    if name == "index.json":
        continue
    scenario_dir = os.path.join(out_dir, name)
    if not os.path.isdir(scenario_dir):
        continue
    trace = os.path.join(scenario_dir, "trace.jsonl")
    nodes = os.path.join(scenario_dir, "nodes.json")
    if os.path.isfile(trace) and os.path.isfile(nodes):
        entries.append({
            "name": name,
            "trace": f"{name}/trace.jsonl",
            "nodes": f"{name}/nodes.json"
        })

with open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8") as fh:
    json.dump(entries, fh, indent=2)
    fh.write("\n")
PY

# Keep sample aligned with the first generated scenario for quick demo.
first_scenario=$(echo "$SCENARIOS" | head -n1 | xargs)
if [[ -n "$first_scenario" ]]; then
  cp "$OUT_DIR/$first_scenario/trace.jsonl" "$ROOT_DIR/tools/vizualize/public/sample/trace.jsonl"
  cp "$OUT_DIR/$first_scenario/nodes.json" "$ROOT_DIR/tools/vizualize/public/sample/nodes.json"
fi

echo "Generated scenarios in $OUT_DIR"
