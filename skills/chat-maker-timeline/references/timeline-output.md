# Timeline Output Reference

## Table Shape

Use this Markdown shape:

```md
# Story Timeline Summary

整理范围：`story.accountOrder` 中账号对应 profile 的 `chatFiles`、`officialArticles`、`moments`。

整理规则：按 `story.accountOrder` 找到账号 profile，并收集其聊天、文档与朋友圈中的时间信息。聊天以消息头中的绝对时间 `[YYYY-MM-DD HH:mm[:ss]]` 为日期锚点；同一文件中后续相对时间或无时间消息继承最近的绝对日期。文档使用 `publishAt` / `time`，朋友圈使用 `publishAt` / `time`。事件按天汇总，必要时同一天拆多行。

| 日期 | 来源 | 事件概述 | 涉及人物 |
|---|---|---|---|
| 2026-04-29 | 03-nextday.md, articles/sister-a1.yml, profiles/sister.yml#moments.s2 | 姐姐账号解锁后补充家庭采购清单模板，并发布自己的朋友圈内容。 | 姐姐, 西瓜（Room 维护中） |
```

## Summarization Rules

- Summarize story movement, not every chat message.
- Split the same date into multiple rows when unrelated plot lines happen on that date.
- Keep source paths compact and relative to the story root.
- Mention documents, images, contact cards, or link cards only when they move the plot.
- Include official articles and moments when their timestamps add story movement or reveal state changes.
- Distinguish actual events from backstory recalled in conversation.
- Use final profile display names in `涉及人物`; keep non-profile entities such as `三只香` or `鬼相机持有者` as natural names.

## What The Extraction Script Does Not Do

The script does not replace human story judgment. It extracts:
- absolute date anchors
- inherited date segments
- official article `publishAt` / `time`
- moment `publishAt` / `time`
- source file and line number
- sender ids and resolved display names
- compact message excerpts

The agent must still read the extracted context and write concise event summaries.
