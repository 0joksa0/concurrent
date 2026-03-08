#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path

NODE_RE = re.compile(r"@viz-node\b(?P<body>.*)$")
TOKEN_RE = re.compile(r'(\w+)=((?:"[^"\\]*(?:\\.[^"\\]*)*")|(?:\S+))')


def unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == '"' and value[-1] == '"':
        value = value[1:-1]
        return bytes(value, "utf-8").decode("unicode_escape")
    return value


def parse_line(line: str):
    match = NODE_RE.search(line)
    if not match:
        return None

    body = match.group("body")
    fields = {}
    for key, raw_value in TOKEN_RE.findall(body):
        fields[key] = unquote(raw_value)

    if "id" not in fields:
        return None

    return {
        "id": fields["id"],
        "type": fields.get("type", "checkpoint"),
        "label": fields.get("label", fields["id"]),
    }


def iter_sources(root: Path):
    for ext in ("*.c", "*.h"):
        for path in sorted(root.rglob(ext)):
            if any(part in {".git", "out"} for part in path.parts):
                continue
            yield path


def extract_nodes(root: Path):
    nodes = []
    for path in iter_sources(root):
        rel = path.relative_to(root)
        with path.open("r", encoding="utf-8") as fh:
            for idx, line in enumerate(fh, start=1):
                parsed = parse_line(line)
                if parsed is None:
                    continue
                parsed["file"] = str(rel)
                parsed["line"] = idx
                nodes.append(parsed)
    return nodes


def main():
    parser = argparse.ArgumentParser(description="Extract @viz-node annotations into nodes.json")
    parser.add_argument("--root", default=".", help="Repository root to scan")
    parser.add_argument("--output", default="nodes.json", help="Output JSON file")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    output = Path(args.output)
    nodes = extract_nodes(root)

    with output.open("w", encoding="utf-8") as out:
        json.dump(nodes, out, indent=2)
        out.write("\n")

    print(f"Extracted {len(nodes)} nodes into {output}")


if __name__ == "__main__":
    main()
