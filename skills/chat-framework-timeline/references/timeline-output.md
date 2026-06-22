# Timeline Output Reference

## Table Shape

Use this Markdown shape:

```md
# Story Timeline Summary

整理范围：`sister/*.md`、`mark/*.md`、`police/*.md`。

整理规则：以消息头中的绝对时间 `[YYYY-MM-DD HH:mm[:ss]]` 为日期锚点；同一文件中后续相对时间或无时间消息继承最近的绝对日期。事件按天汇总，必要时同一天拆多行。

| 日期 | 来源 | 事件概述 | 涉及人物 |
|---|---|---|---|
| 2024-03-05 | police/1.md, police/2.md | 周正入职警局，陈局安排他协助孟凡调查异常猝死案。 | 周警官, 陈局, 孟凡 |
```

## Summarization Rules

- Summarize story movement, not every chat message.
- Split the same date into multiple rows when unrelated plot lines happen on that date.
- Keep source paths compact and relative to the story root.
- Mention documents, images, contact cards, or link cards only when they move the plot.
- Distinguish actual events from backstory recalled in conversation.
- Use final profile display names in `涉及人物`; keep non-profile entities such as `三只香` or `鬼相机持有者` as natural names.

## What The Extraction Script Does Not Do

The script does not replace human story judgment. It extracts:
- absolute date anchors
- inherited date segments
- source file and line number
- sender ids and resolved display names
- compact message excerpts

The agent must still read the extracted context and write concise event summaries.

