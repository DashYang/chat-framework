---
name: chat-framework-timeline
description: Build day-level story timelines from chat-framework projects. Use when asked to summarize chat-framework stories by date, create timeline_summary.md, sort events from accountOrder profiles, include chats/documents/moments, resolve participant ids to final profile display names, or extract dated story context from chat.md/article/profile data.
---

# Chat Framework Timeline

Use this skill to turn chat-framework project folders into a day-level story timeline.

## Workflow

1. Read the project-specific request and identify the story root to include.
   - By default, use `<story-root>/story.yml > story.accountOrder` as the account inclusion and discovery order.
   - For each account id in `accountOrder`, load the matching profile from `<story-root>/profiles/<id>.yml` or `profiles.yml`.
   - From that profile, include all dated `chatFiles`, `officialArticles` documents, and `moments`.
   - Only use explicit `--accounts` when the user asks for a subset or override.

2. Run the extraction script from the target story root:

```bash
python3 <skill-dir>/scripts/extract_timeline_context.py \
  --root <story-root> \
  --output /tmp/timeline_context.md
```

Legacy folder scans are still available only as a fallback:

```bash
python3 <skill-dir>/scripts/extract_timeline_context.py \
  --root <story-root> \
  --dirs sister mark police \
  --output /tmp/timeline_context.md
```

3. Read `/tmp/timeline_context.md`.
   - It contains all dated chat, document, and moment context found through `accountOrder -> profile`.
   - Chat entries are grouped by absolute date anchors from chat-framework message headers.
   - Relative times (`+10s`, `+1m`) and omitted times are assigned to the most recent absolute date in the same file.
   - Document entries use article `publishAt` / `time`.
   - Moment entries use `publishAt` / `time`.
   - Sender ids are resolved to final profile display names where possible.

4. Write or update the requested timeline file, usually `timeline_summary.md`.
   - Use one Markdown table with columns: `日期`, `来源`, `事件概述`, `涉及人物`.
   - Sort by date ascending.
   - Keep each event summary to about 100 Chinese characters or less.
   - Use final profile display names in `涉及人物`, not sender ids.
   - Preserve non-profile story entities by their natural story name.

5. Verify the result.
   - Ensure every table row has four columns.
   - Ensure dates are ascending.
   - Search the participant column for unresolved profile ids such as `zhou_police`, `ZhangJingyi`, or `liuxiaoyu`; replace them with final profile names.

## Profile Name Rule

Resolve a profile id from `<story-root>/profiles/<id>.yml` or `profiles.yml`.

Use the final display name in this precedence:

1. Latest `profile.identityTimeline.<date>.name` by date; if dates tie, use the later entry in the file.
2. `profile.name`.
3. The original id, only when no profile file or name exists.

Examples:
- `ZhangJingyi` -> `张医生`
- `zhou_police` -> `周警官`
- `fengquan` -> `冯全`
- `wang` -> `王教授`

## Output Guidance

Read `references/timeline-output.md` when creating a new timeline or changing the output shape.
