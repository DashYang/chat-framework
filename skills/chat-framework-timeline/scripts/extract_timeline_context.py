#!/usr/bin/env python3
"""Extract dated chat-framework story context for timeline summarization."""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


ABS_HEADER_RE = re.compile(
    r"^@([A-Za-z0-9_]+)\b[^\n\[]*\[(\d{4}-\d{1,2}-\d{1,2})[ T](\d{1,2}:\d{2}(?::\d{2})?)\]"
)
SENDER_RE = re.compile(r"^@([A-Za-z0-9_]+)\b")
ARTICLE_EXT_RE = re.compile(r"\.(ya?ml|md|markdown)$", re.I)


@dataclass
class Profile:
    id: str
    data: dict[str, Any]
    display_name: str


@dataclass
class TimelineItem:
    kind: str
    account_id: str
    account_name: str
    when: str
    source: str
    line: int = 1
    participants: set[str] = field(default_factory=set)
    participant_ids: set[str] = field(default_factory=set)
    title: str = ""
    excerpt: str = ""

    @property
    def date(self) -> str:
        return self.when[:10]


def strip_quotes(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def split_inline_array(raw: str) -> list[str]:
    inner = raw.strip()[1:-1].strip()
    if not inner:
        return []
    values: list[str] = []
    buf: list[str] = []
    quote = ""
    for ch in inner:
        if ch in {"'", '"'}:
            quote = "" if quote == ch else (quote or ch)
        if ch == "," and not quote:
            values.append(strip_quotes("".join(buf).strip()))
            buf = []
        else:
            buf.append(ch)
    if buf:
        values.append(strip_quotes("".join(buf).strip()))
    return values


def parse_scalar(raw: str) -> Any:
    value = raw.strip()
    if not value:
        return ""
    if value.startswith("[") and value.endswith("]"):
        return split_inline_array(value)
    if value in {"true", "false"}:
        return value == "true"
    if re.fullmatch(r"-?\d+(\.\d+)?", value):
        return float(value) if "." in value else int(value)
    return strip_quotes(value)


def find_mapping_colon(line: str) -> int:
    quote = ""
    for index, ch in enumerate(line):
        if ch in {"'", '"'}:
            quote = "" if quote == ch else (quote or ch)
        elif ch == ":" and not quote:
            return index
    return -1


def parse_simple_yaml(text: str) -> dict[str, Any]:
    lines = text.replace("\r\n", "\n").split("\n")
    root: dict[str, Any] = {}
    stack: list[dict[str, Any]] = [{"indent": -1, "container": root, "type": "object", "last_key": None}]

    index = 0
    while index < len(lines):
        raw = lines[index]
        if not raw.strip() or raw.strip().startswith("#"):
            index += 1
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        line = raw.strip()

        while len(stack) > 1 and indent <= stack[-1]["indent"]:
            stack.pop()

        current = stack[-1]

        if line.startswith("- "):
            item = line[2:].strip()
            if current["type"] != "array":
                parent = current["container"]
                key = current["last_key"]
                if not key:
                    index += 1
                    continue
                parent[key] = []
                stack.append({"indent": current["indent"] + 2, "container": parent[key], "type": "array", "last_key": None})
            stack[-1]["container"].append(parse_scalar(item))
            index += 1
            continue

        colon = find_mapping_colon(line)
        if colon < 0:
            index += 1
            continue

        key = strip_quotes(line[:colon].strip())
        rest = line[colon + 1 :].strip()

        if rest in {"|", ">"}:
            block_lines: list[str] = []
            block_indent: int | None = None
            cursor = index + 1
            while cursor < len(lines):
                block_raw = lines[cursor]
                if not block_raw.strip():
                    block_lines.append("")
                    cursor += 1
                    continue
                block_line_indent = len(block_raw) - len(block_raw.lstrip(" "))
                if block_line_indent <= indent:
                    break
                if block_indent is None:
                    block_indent = block_line_indent
                block_lines.append(block_raw[min(block_indent, len(block_raw)) :])
                cursor += 1
            current["container"][key] = "\n".join(block_lines) if rest == "|" else " ".join(block_lines)
            current["last_key"] = key
            index = cursor
            continue

        if rest == "":
            current["container"][key] = {}
            current["last_key"] = key
            stack.append({"indent": indent, "container": current["container"][key], "type": "object", "last_key": key})
        else:
            current["container"][key] = parse_scalar(rest)
            current["last_key"] = key

        index += 1

    return root


def normalize_datetime(value: Any, end_of_day: bool = False) -> str:
    text = str(value or "").strip()
    match = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?", text)
    if not match:
        return ""
    hour = int(match.group(4) or (23 if end_of_day else 0))
    minute = int(match.group(5) or (59 if end_of_day else 0))
    second = int(match.group(6) or (59 if end_of_day else 0))
    return (
        f"{int(match.group(1)):04d}-{int(match.group(2)):02d}-{int(match.group(3)):02d} "
        f"{hour:02d}:{minute:02d}:{second:02d}"
    )


def compact_excerpt(lines: list[str] | str, limit: int) -> str:
    if isinstance(lines, str):
        text = lines
    else:
        text = " ".join(line.strip() for line in lines if line.strip())
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "..."


def profile_display_name(profile_id: str, data: dict[str, Any]) -> str:
    timeline = data.get("identityTimeline")
    timeline_names: list[tuple[str, str]] = []
    if isinstance(timeline, dict):
        for key, identity in timeline.items():
            if isinstance(identity, dict) and str(identity.get("name") or "").strip():
                when = normalize_datetime(key)
                timeline_names.append((when or str(key), str(identity["name"]).strip()))
    if timeline_names:
        timeline_names.sort(key=lambda item: item[0])
        return timeline_names[-1][1]
    for key in ("name", "nickName"):
        if str(data.get(key) or "").strip():
            return str(data[key]).strip()
    return profile_id


def load_profiles(root: Path) -> dict[str, Profile]:
    profiles: dict[str, Profile] = {}
    profiles_dir = root / "profiles"
    profiles_file = root / "profiles.yml"

    if profiles_dir.is_dir():
        for path in sorted(profiles_dir.glob("*.yml")) + sorted(profiles_dir.glob("*.yaml")):
            parsed = parse_simple_yaml(path.read_text(encoding="utf-8"))
            data = parsed.get("profile", parsed)
            if isinstance(data, dict):
                profiles[path.stem] = Profile(path.stem, data, profile_display_name(path.stem, data))
        return profiles

    if profiles_file.is_file():
        parsed = parse_simple_yaml(profiles_file.read_text(encoding="utf-8"))
        users = parsed.get("users", parsed)
        if isinstance(users, dict):
            for profile_id, data in users.items():
                if isinstance(data, dict):
                    profiles[str(profile_id)] = Profile(str(profile_id), data, profile_display_name(str(profile_id), data))

    return profiles


def load_account_order(root: Path, profiles: dict[str, Profile], requested: list[str] | None) -> list[str]:
    if requested:
        return [item for item in requested if item]

    story_path = root / "story.yml"
    if story_path.is_file():
        parsed = parse_simple_yaml(story_path.read_text(encoding="utf-8"))
        story = parsed.get("story", parsed)
        order = story.get("accountOrder") if isinstance(story, dict) else None
        if isinstance(order, list):
            return [str(item) for item in order]

    return sorted(profiles)


def resolve_ref_path(root: Path, ref: str, default_dir: str = "") -> Path | None:
    value = str(ref or "").strip()
    if not value:
        return None
    path = Path(value)
    candidates = []
    if path.is_absolute():
        candidates.append(path)
    else:
        candidates.append(root / path)
        if default_dir:
            candidates.append(root / default_dir / path)
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return candidates[0] if candidates else None


def article_id_from_ref(ref: str) -> str:
    return ARTICLE_EXT_RE.sub("", Path(str(ref)).name)


def find_article_path(root: Path, ref: str) -> Path | None:
    explicit = resolve_ref_path(root, ref)
    if explicit and explicit.is_file():
        return explicit
    article_id = article_id_from_ref(ref)
    for ext in (".md", ".markdown", ".yml", ".yaml"):
        candidate = root / "articles" / f"{article_id}{ext}"
        if candidate.is_file():
            return candidate
    return None


def parse_markdown_article(text: str) -> tuple[dict[str, Any], str]:
    if text.startswith("---\n"):
        end = text.find("\n---", 4)
        if end != -1:
            data = parse_simple_yaml(text[4:end])
            content = text[text.find("\n", end + 4) + 1 :]
            return data, content.strip()
    heading = ""
    for line in text.splitlines():
        match = re.match(r"^#\s+(.+?)\s*$", line)
        if match:
            heading = match.group(1).strip()
            break
    return ({"title": heading} if heading else {}, text.strip())


def extract_articles(root: Path, account: Profile, excerpt_chars: int) -> list[TimelineItem]:
    refs = account.data.get("officialArticles") or []
    if isinstance(refs, dict):
        refs = list(refs.values())
    if not isinstance(refs, list):
        return []

    items: list[TimelineItem] = []
    for ref in refs:
        path = find_article_path(root, str(ref))
        if not path or not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        if path.suffix.lower() in {".md", ".markdown"}:
            frontmatter, content = parse_markdown_article(text)
            article = frontmatter.get("article", frontmatter)
            if isinstance(article, dict):
                article = {**article, "text": content or article.get("text", "")}
            else:
                article = {"text": content}
        else:
            parsed = parse_simple_yaml(text)
            article = parsed.get("article", parsed)
        if not isinstance(article, dict):
            continue
        when = normalize_datetime(article.get("publishAt") or article.get("time"))
        if not when:
            continue
        rel = path.relative_to(root).as_posix() if path.is_relative_to(root) else str(path)
        title = str(article.get("title") or article_id_from_ref(str(ref))).strip()
        summary = str(article.get("summary") or article.get("desc") or "").strip()
        body = str(article.get("markdown") or article.get("body") or article.get("text") or article.get("content") or "").strip()
        excerpt = compact_excerpt(" ".join(part for part in [summary, body] if part), excerpt_chars)
        participants = {account.display_name}
        author = str(article.get("author") or "").strip()
        if author:
            participants.add(author)
        items.append(
            TimelineItem(
                kind="doc",
                account_id=account.id,
                account_name=account.display_name,
                when=when,
                source=rel,
                participants=participants,
                participant_ids={account.id},
                title=title,
                excerpt=excerpt,
            )
        )
    return items


def extract_moments(account: Profile, excerpt_chars: int) -> list[TimelineItem]:
    moments = account.data.get("moments") or {}
    if not isinstance(moments, dict):
        return []

    items: list[TimelineItem] = []
    for moment_id, moment in moments.items():
        if not isinstance(moment, dict):
            continue
        when = normalize_datetime(moment.get("publishAt") or moment.get("time"))
        if not when:
            continue
        participants = {account.display_name}
        author = moment.get("author")
        if isinstance(author, str) and author.strip():
            participants.add(author.strip())
        elif isinstance(author, dict):
            ref = str(author.get("refId") or author.get("ref") or author.get("id") or author.get("profileId") or "").strip()
            name = str(author.get("name") or "").strip()
            if name:
                participants.add(name)
            elif ref:
                participants.add(ref)
        items.append(
            TimelineItem(
                kind="moment",
                account_id=account.id,
                account_name=account.display_name,
                when=when,
                source=f"profiles/{account.id}.yml#moments.{moment_id}",
                participants=participants,
                participant_ids={account.id},
                title=str(moment_id),
                excerpt=compact_excerpt(str(moment.get("text") or moment.get("content") or ""), excerpt_chars),
            )
        )
    return items


def strip_chat_noise(line: str) -> bool:
    stripped = line.strip()
    if not stripped or stripped == "---":
        return True
    return stripped.startswith(("profiles:", "theme:", "specVersion:", "title:", "chat:", "articles:"))


def extract_chat_file(root: Path, account: Profile, path: Path, profile_names: dict[str, str], excerpt_chars: int) -> list[TimelineItem]:
    if not path.is_file():
        return []

    items: list[TimelineItem] = []
    rel_source = path.relative_to(root).as_posix() if path.is_relative_to(root) else str(path)
    current_lines: list[str] = []
    current_when = ""
    current_line = 1
    senders: set[str] = set()

    def flush() -> None:
        if not current_when or not current_lines:
            return
        participants = {profile_names.get(sender, sender) for sender in senders}
        items.append(
            TimelineItem(
                kind="chat",
                account_id=account.id,
                account_name=account.display_name,
                when=current_when,
                source=rel_source,
                line=current_line,
                participants=participants,
                participant_ids=set(senders),
                excerpt=compact_excerpt(current_lines, excerpt_chars),
            )
        )

    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        abs_match = ABS_HEADER_RE.match(line)
        if abs_match:
            flush()
            current_when = normalize_datetime(f"{abs_match.group(2)} {abs_match.group(3)}")
            current_line = line_no
            senders = {abs_match.group(1)}
            current_lines = [line]
            continue

        if not current_when:
            continue

        sender_match = SENDER_RE.match(line)
        if sender_match:
            senders.add(sender_match.group(1))

        if not strip_chat_noise(line):
            current_lines.append(line)

    flush()
    return items


def extract_chats(root: Path, account: Profile, profile_names: dict[str, str], excerpt_chars: int) -> list[TimelineItem]:
    refs = account.data.get("chatFiles") or []
    if not isinstance(refs, list):
        return []
    items: list[TimelineItem] = []
    for ref in refs:
        path = resolve_ref_path(root, str(ref))
        if path:
            items.extend(extract_chat_file(root, account, path, profile_names, excerpt_chars))
    return items


def extract_legacy_dirs(root: Path, dirs: list[str], profile_names: dict[str, str], excerpt_chars: int) -> list[TimelineItem]:
    account = Profile("__legacy__", {}, "legacy")
    items: list[TimelineItem] = []
    for dirname in dirs:
        folder = root / dirname
        if not folder.is_dir():
            continue
        for path in sorted(folder.glob("*.md"), key=lambda p: natural_key(p.name)):
            items.extend(extract_chat_file(root, account, path, profile_names, excerpt_chars))
    return items


def natural_key(value: str) -> tuple[Any, ...]:
    return tuple(int(part) if part.isdigit() else part for part in re.split(r"(\d+)", value))


def collect_items(root: Path, accounts: list[str], profiles: dict[str, Profile], dirs: list[str], excerpt_chars: int) -> list[TimelineItem]:
    profile_names = {profile_id: profile.display_name for profile_id, profile in profiles.items()}
    items: list[TimelineItem] = []

    for account_id in accounts:
        account = profiles.get(account_id)
        if not account:
            continue
        items.extend(extract_chats(root, account, profile_names, excerpt_chars))
        items.extend(extract_articles(root, account, excerpt_chars))
        items.extend(extract_moments(account, excerpt_chars))

    if not items and dirs:
        items.extend(extract_legacy_dirs(root, dirs, profile_names, excerpt_chars))

    return sorted(items, key=lambda item: (item.when, item.kind, item.source, item.line))


def render_context(root: Path, accounts: list[str], profiles: dict[str, Profile], dirs: list[str], excerpt_chars: int) -> str:
    items = collect_items(root, accounts, profiles, dirs, excerpt_chars)
    out: list[str] = []

    out.append("# Timeline Extraction Context")
    out.append("")
    out.append(f"Story root: `{root}`")
    out.append(f"Account order: {', '.join(accounts) if accounts else '(none)'}")
    out.append("Sources: profile chatFiles, profile officialArticles, profile moments")
    if dirs:
        out.append(f"Legacy dirs fallback: {', '.join(dirs)}")
    out.append("")

    for item in items:
        source = f"{item.source}:{item.line}" if item.kind == "chat" else item.source
        out.append(f"## {item.when} [{item.kind}] `{source}`")
        out.append(f"Account: {item.account_name} ({item.account_id})")
        if item.title:
            out.append(f"Title: {item.title}")
        out.append(f"Participants: {', '.join(sorted(item.participants))}")
        if item.participant_ids:
            out.append(f"Participant ids: {', '.join(sorted(item.participant_ids))}")
        out.append("")
        out.append(item.excerpt or "(empty)")
        out.append("")

    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="Story root containing story.yml, profiles/, chats, and articles/.")
    parser.add_argument("--accounts", nargs="+", help="Account ids to include; defaults to story.accountOrder.")
    parser.add_argument("--dirs", nargs="+", default=[], help="Legacy chat folders to scan only when no account-indexed items are found.")
    parser.add_argument("--output", help="Write extracted context to this file.")
    parser.add_argument("--excerpt-chars", type=int, default=900, help="Maximum excerpt chars per item.")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    profiles = load_profiles(root)
    accounts = load_account_order(root, profiles, args.accounts)
    text = render_context(root, accounts, profiles, args.dirs, args.excerpt_chars)
    if args.output:
        Path(args.output).write_text(text, encoding="utf-8")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
