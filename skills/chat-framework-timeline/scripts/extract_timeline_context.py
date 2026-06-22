#!/usr/bin/env python3
"""Extract dated chat-framework story context for timeline summarization."""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass, field
from pathlib import Path


ABS_HEADER_RE = re.compile(
    r"^@([A-Za-z0-9_]+)\b[^\n\[]*\[(\d{4}-\d{1,2}-\d{1,2})[ T](\d{1,2}:\d{2}(?::\d{2})?)\]"
)
SENDER_RE = re.compile(r"^@([A-Za-z0-9_]+)\b")
PROFILE_NAME_RE = re.compile(r'^\s*name:\s*["\']?([^"\']+)["\']?\s*$')
TIMELINE_DATE_RE = re.compile(r"^\s{4}(\d{4}-\d{1,2}-\d{1,2}):\s*$")


@dataclass
class Segment:
    date: str
    source: str
    line: int
    senders: set[str] = field(default_factory=set)
    lines: list[str] = field(default_factory=list)


def normalize_date(value: str) -> str:
    parts = value.split("-")
    return f"{int(parts[0]):04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"


def strip_noise(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    if stripped == "---":
        return True
    return stripped.startswith(
        (
            "profiles:",
            "theme:",
            "specVersion:",
            "title:",
            "chat:",
            "articles:",
        )
    )


def load_profile_names(root: Path) -> dict[str, str]:
    profiles_dir = root / "profiles"
    names: dict[str, str] = {}
    if not profiles_dir.is_dir():
        return names

    for path in sorted(profiles_dir.glob("*.yml")):
        profile_id = path.stem
        explicit_name: str | None = None
        timeline_names: list[tuple[str, int, str]] = []
        current_timeline_date: str | None = None

        for idx, raw in enumerate(path.read_text(encoding="utf-8").splitlines()):
            date_match = TIMELINE_DATE_RE.match(raw)
            if date_match:
                current_timeline_date = normalize_date(date_match.group(1))
                continue

            name_match = PROFILE_NAME_RE.match(raw)
            if not name_match:
                continue

            name = name_match.group(1).strip()
            if current_timeline_date and raw.startswith("      "):
                timeline_names.append((current_timeline_date, idx, name))
            elif explicit_name is None:
                explicit_name = name

        if timeline_names:
            timeline_names.sort(key=lambda item: (item[0], item[1]))
            names[profile_id] = timeline_names[-1][2]
        elif explicit_name:
            names[profile_id] = explicit_name

    return names


def list_chat_files(root: Path, dirs: list[str]) -> list[Path]:
    files: list[Path] = []
    for dirname in dirs:
        folder = root / dirname
        if not folder.is_dir():
            continue
        files.extend(sorted(folder.glob("*.md"), key=lambda p: natural_key(p.name)))
    return files


def natural_key(value: str) -> tuple:
    return tuple(int(part) if part.isdigit() else part for part in re.split(r"(\d+)", value))


def extract_segments(root: Path, dirs: list[str]) -> list[Segment]:
    segments: list[Segment] = []
    for path in list_chat_files(root, dirs):
        current: Segment | None = None
        rel_source = path.relative_to(root).as_posix()

        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            abs_match = ABS_HEADER_RE.match(line)
            if abs_match:
                if current:
                    segments.append(current)
                current = Segment(
                    date=normalize_date(abs_match.group(2)),
                    source=rel_source,
                    line=line_no,
                    senders={abs_match.group(1)},
                )
                current.lines.append(line)
                continue

            if current is None:
                continue

            sender_match = SENDER_RE.match(line)
            if sender_match:
                current.senders.add(sender_match.group(1))

            if not strip_noise(line):
                current.lines.append(line)

        if current:
            segments.append(current)

    return sorted(segments, key=lambda s: (s.date, s.source, s.line))


def compact_excerpt(lines: list[str], limit: int) -> str:
    text = " ".join(line.strip() for line in lines if line.strip())
    text = re.sub(r"\s+", " ", text)
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "..."


def render_context(root: Path, dirs: list[str], excerpt_chars: int) -> str:
    profile_names = load_profile_names(root)
    segments = extract_segments(root, dirs)
    out: list[str] = []

    out.append("# Timeline Extraction Context")
    out.append("")
    out.append(f"Story root: `{root}`")
    out.append(f"Included dirs: {', '.join(dirs)}")
    out.append("")

    for segment in segments:
        display_names = [profile_names.get(sender, sender) for sender in sorted(segment.senders)]
        out.append(f"## {segment.date} `{segment.source}:{segment.line}`")
        out.append(f"Senders: {', '.join(display_names)}")
        out.append(f"Sender ids: {', '.join(sorted(segment.senders))}")
        out.append("")
        out.append(compact_excerpt(segment.lines, excerpt_chars))
        out.append("")

    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="Story root containing profiles/ and chat folders.")
    parser.add_argument("--dirs", nargs="+", required=True, help="Conversation folders to scan.")
    parser.add_argument("--output", help="Write extracted context to this file.")
    parser.add_argument("--excerpt-chars", type=int, default=900, help="Maximum excerpt chars per date segment.")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    text = render_context(root, args.dirs, args.excerpt_chars)
    if args.output:
        Path(args.output).write_text(text, encoding="utf-8")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

