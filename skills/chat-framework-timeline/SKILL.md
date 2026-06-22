---
name: chat-framework-timeline
description: Build day-level story timelines from chat-framework conversation Markdown. Use when asked to summarize chat-framework chats by date, create timeline_summary.md, sort events from folders such as sister/mark/police, resolve participant ids to final profile display names, or extract dated story context from chat.md files.
---

# Chat Framework Timeline

Use this skill to turn chat-framework conversation folders into a day-level story timeline.

## Workflow

1. Read the project-specific request and identify the conversation folders to include.
   - If no folders are specified, inspect likely story folders and ask only when the scope is ambiguous.
   - Do not include `articles/`, `profiles/`, moments, or generated assets unless the user explicitly asks.

2. Run the extraction script from the target story root:

```bash
python3 <skill-dir>/scripts/extract_timeline_context.py \
  --root <story-root> \
  --dirs sister mark police \
  --output /tmp/timeline_context.md
```

3. Read `/tmp/timeline_context.md`.
   - It groups messages by absolute date anchors from chat-framework message headers.
   - Relative times (`+10s`, `+1m`) and omitted times are assigned to the most recent absolute date in the same file.
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

Resolve a profile id from `<story-root>/profiles/<id>.yml`.

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
