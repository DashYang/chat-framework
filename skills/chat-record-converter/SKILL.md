---
name: chat-record-converter
description: 将原始聊天记录、朋友圈与文章素材转换为 chat-framework 所需的 chat.md、profiles.yml、chat.yml、ui.yml、story.yml、profiles/*.yml、articles/*.md（兼容 articles/*.yml），并自动补齐时间、引用、会话配置与总览页消费状态语义。
---

# Chat Record Converter

用于把“类似聊天记录”的内容标准化为本项目可渲染的输入文件。

## 适用场景

当用户提出以下请求时触发本 skill：
- “把这段聊天整理成可渲染的 md/yaml”
- “把微信群聊天导出转成项目格式”
- “把这份对话日志生成 chat.md + 配置”
- “在这个已有项目里新增一段对话”
- “把新聊天追加到现有 chat-framework 项目”

输入可以是：
- 文本聊天记录
- OCR 后文字
- 半结构化清单（谁说了什么 + 大致时间）

## 输出目标

最少输出 3 个文件：
- `chat.md`
- `profiles.yml`
- `chat.yml`

若用户要求多会话首页微信风格，则额外输出：
- `ui.yml`

若用户要求多账号/目录模式、朋友圈或公众号文章，则优先输出目录结构：
- `profiles/<accountId>.yml`
- `articles/<articleId>.md`（兼容既有 `articles/<articleId>.yml`）
- `story.yml`（需要账号解锁顺序时）
- 多个会话 `*.md` 与必要的群聊 `*.yml`

## 执行流程

1. 识别会话边界
- 判断是单会话还是多会话
- 多会话时按主题/群组拆分成多个 `*.md`

2. 提取参与者与画像
- 汇总所有发言人 `senderId`
- 为每个 sender 生成稳定 id（建议小写英文或拼音）
- 填充 `name/avatar/bio`；缺失时用占位并在结果说明中标记

3. 时间归一化
- 第一条消息必须转为绝对时间
- 后续优先使用相对时间（`+30s/+2m`）
- 原始时间缺失时：按消息顺序以默认步长（30s 或 1m）递增

4. 消息类型识别
- 纯文本 -> 默认文本
- 图片链接/本地路径 -> `[image]`
- 明确卡片信息 -> `[link-card]`
- 转发公众号文章 -> `[article]`，并把正文实体优先放入 `articles/*.md`
- 用户名片/资料卡 -> `[contact-card]`
- 系统提示、时间分割、验证提示、折叠提示 -> `[status]`
- 恐怖提示、关键短句、需要文字突脸强调的内容 -> `[highlight]`
- 引用关系明显 -> `[quote:<messageId>]`

5. 会话配置生成
- 单聊：`chat.type = single`，补 `self/peer`
- 群聊：`chat.type = group`，补 `groupInfo`
- folder 模式下，群聊不要写 `self`，单聊可省略 `chat.yml`；当前账号由 profile id 隐含
- 单聊标题不能回退到 profile id / 文件名；若省略 `chat.yml`，必须确保当前账号 `aliases.contacts.<peerId>`、对方 `profile.name` 或按当前阶段时间解析出的 `identityTimeline.name` 至少有一个可用于标题，否则先询问用户补齐

6. 总览页素材生成
- 朋友圈写入 `profiles/<id>.yml > profile.moments`
- 非本人朋友圈作者优先用 `author: "@<profileId>"` 引用 profile，方便运行时按阶段时间解析头像和名称
- 公众号文章优先写入 `articles/*.md`，使用 Markdown frontmatter 表达元信息；如果已有项目全是 YAML 或用户明确要求保持 YAML，则继续写 `articles/*.yml`
- 账号推进需要 `story.yml > story.accountOrder`

7. 生成并校验
- 生成 `chat.md/profiles.yml/chat.yml(/ui.yml)` 或目录模式文件
- 检查：sender 是否存在、messageId 唯一、引用是否有效、首条时间是否绝对时间、相对路径是否能解析

## chat.md 输出风格

生成 `chat.md` 时优先使用连续纯文本简写，减少重复 sender 头。

同一发送者连续多条纯文本消息时，只写一次 `@senderId`，后续消息用空行分隔：

```md
@chen_director
说个事

今天新同事入职
```

若第一条需要显式时间，可把时间写在这个 sender 头上：

```md
@chen_director [2026-04-10 09:00:00]
说个事

今天新同事入职
```

规则：
- 该简写只用于纯文本消息；纯 URL 文本也可以使用，parser 会自动转为链接卡片。
- 后续文本块由 parser 自动生成 message id，并按现有规则推导时间。
- 如果某条消息需要显式 `#messageId`，必须为该消息单独写完整消息头。
- 如果某条消息带任意 tag（如 `[quote]`、`[image]`、`[voice]`、`[link-card]`、`[article]`、`[contact-card]`、`[status]`、`[highlight]`），必须为该消息单独写完整消息头。
- `[status]` 用于原始记录中真实存在的系统状态提示；默认“当前聊天已结束”由渲染器自动追加，不需要手动生成。
- `[highlight]` 用于关键短句的文字突脸效果，正文就是突脸文字；它是独立消息类型，不要和 `[image]`、`[link-card]`、`[article]`、`[contact-card]`、`[status]` 等内容型 tag 混用。
- 如果需要在同一条纯文本消息里保留段落空行，使用完整消息头；简写中的空行表示下一条同发送者消息。
- 正文中的 `@mention` 必须匹配当前会话 profiles 中的 profile id、`name`、`nickName`、`identityTimeline.name`，或当前账号的 `aliases.contacts` / `aliases.selfInGroups`。不确定对应哪个 profile 时先询问用户；不要生成无法匹配的 @ 文本，因为构建器会报错。

## 增量导入已有项目

当用户要求在已有项目中新增对话时，不要直接从零生成整套文件。先读取项目根目录并建立索引，再询问必要决策，最后只修改或新增相关文件。

### 1. 读取现有项目

检查项目根目录：
- `profiles/` 或 `profiles.yml`
- `story.yml`
- 现有 `*.md` 会话文件
- 现有群聊 `*.yml`
- `articles/`
- `ui.yml`

建立已有人员索引：
- profile id（目录模式下即 `profiles/<id>.yml` 文件名）
- `name`
- `nickName`
- `identityTimeline` 中出现过的 `name`
- `aliases.contacts`
- `aliases.selfInGroups`
- 已有会话中的 sender id

### 2. 识别新增内容

从新增聊天中提取：
- 新会话标题、会话类型（single/group）和首条绝对时间
- 发言人昵称、可能的头像、备注、群名片
- 图片、链接卡片、文章卡片、名片、引用关系
- 朋友圈或公众号文章素材
- 用户是否明确要求某个新增人员成为可切换账号

### 3. 匹配已有人员

默认采用保守确认策略。

可直接复用已有 profile 的高置信情况：
- id 完全一致
- 用户明确写出 `@profileId`
- 唯一命中已有 `name` 或 `nickName`

必须向用户列候选确认的情况：
- 同名但头像、简介或语境不一致
- 昵称相近但不完全一致
- 只通过备注名或群名片疑似匹配
- 多个已有 profile 都可能匹配

无匹配时：
- 询问用户是新建 profile，还是归入某个已有 profile
- 若用户选择新建但缺少头像或简介，允许使用占位值，并在结果说明中标记为推断/待补

### 4. 增量写入规则

- 新会话文件使用不冲突命名，优先按现有编号递增，例如 `06-<slug>.md`。
- 群聊新增或复用对应 group yml；把会话 markdown 追加到相关账号的 `chatFiles`，并在 `groupChats` 中写入群聊 yml 映射。
- 单聊优先不创建单聊 `chat.yml`；仅在单文件模式、已有项目已采用单聊 yml，或用户明确要求时创建。
- 新文章默认写入 `articles/<articleId>.md`，并追加到对应 profile 的 `officialArticles`；已有项目全是 YAML 或用户明确要求保持 YAML 时才写 `articles/<articleId>.yml`。
- 新朋友圈写入对应 profile 的 `moments`；第三方作者优先写 `author: "@<profileId>"`。
- 不删除或重排已有 `chatFiles`、`officialArticles`、`moments`、`accountOrder`，除非用户明确要求。

### 5. accountOrder 规则

- 新增人员只是联系人或群成员时，不加入 `story.accountOrder`。
- 新增人员需要成为可切换账号时，默认追加到已有 `story.accountOrder` 末尾。
- 如果用户表达剧情插入顺序，询问插入到哪个账号之前或之后。
- 如果缺少 `story.yml` 且用户需要账号推进，创建 `story.yml` 并把现有可切换账号与新增账号按确认顺序写入 `accountOrder`。

### 6. 增量导入完成后校验

- 新会话中的所有 sender 都能解析到 profile。
- 新会话文件名、message id、article id、moment id 不与现有项目冲突。
- 所有追加到 `chatFiles/groupChats/officialArticles` 的路径能从项目根目录解析。
- 若新增可切换账号，`story.accountOrder` 包含该账号且默认位于末尾。
- 若新增普通联系人，确认没有误加入 `story.accountOrder`。

## 字段映射规则

原始信息 -> 目标字段：
- 发言人昵称 -> `profiles.yml > users.<id>.name`
- 发言人头像（若有）-> `profiles.yml > users.<id>.avatar`
- 个人描述（若有）-> `profiles.yml > users.<id>.bio`
- 会话名称 -> `chat.yml > chat.title`
- 群名/群头像 -> `chat.yml > chat.groupInfo`
- 每条发言 -> `chat.md` 消息块
- 回复/引用关系 -> `chat.md` 的 `[quote:msgId]`
- 公众号文章 -> `articles/<id>.md` + `profiles/<accountId>.yml > profile.officialArticles`
- 朋友圈动态 -> `profiles/<accountId>.yml > profile.moments`
- 朋友圈第三方作者 -> `moment.author: "@<profileId>"`
- 账号推进顺序 -> `story.yml > story.accountOrder`
- 增量新增会话 -> 对应 profile 的 `chatFiles`，群聊还要补 `groupChats`
- 新可切换账号 -> `profiles/<accountId>.yml` + `story.yml > story.accountOrder`

## 输出模板

### chat.md

```md
---
title: "<会话标题>"
profiles: "./profiles.yml"
chat: "./chat.yml"
theme: "wechat"
specVersion: "1.0"
---

@<senderId> [2026-04-10 09:00:00]
<纯文本消息1>

<同一发送者的纯文本消息2>

@<otherSenderId> #m3 [+1m] [quote:m1]
<带 id 或 tag 的消息仍使用完整消息头>
```

### profiles.yml

```yml
users:
  <senderId>:
    name: "<显示名>"
    avatar: "<头像URL或占位URL>"
    bio: "<介绍>"
    identityTimeline:
      - effectiveAt: "2026-04-10 00:00:00"
        name: "<阶段显示名>"
        avatar: "<阶段头像>"
```

### chat.yml

```yml
chat:
  type: "group"
  title: "<会话标题>"
  groupInfo:
    avatar: "<群头像>"
```

说明：folder 模式下群聊 yml 只保留 `type/title/groupInfo.avatar` 即可；单文件模式需要在 `chat.yml` 中明确 `self`。

### ui.yml（可选）

```yml
ui:
  statusBar:
    carrier: "中国移动"
    time: "12:21"
    battery: "31%"
  topTitle: "微信"
  theme: "wechat"
  persistKey: "chat_seen_v1"
  debug: false
```

### profiles/<accountId>.yml（目录模式可选）

```yml
profile:
  version: 1
  name: "<账号显示名>"
  avatar: "<头像URL>"
  chatFiles: ["01-group.md", "02-single.md"]
  groupChats:
    "01-group.md": "group.yml"
  officialArticles: ["./articles/a1.md"]
  moments:
    m1:
      publishAt: "2026-04-10 09:30:00"
      author: "@friendId"
      text: "<朋友圈文字>"
      images: ["https://example.com/1.jpg"]
```

### articles/<articleId>.md（目录模式可选，推荐）

```md
---
publishAt: "2026-04-10 08:30:00"
title: "<文章标题>"
author: "<公众号名称>"
cover: "<封面URL>"
summary: "<摘要>"
---

# <正文标题>

正文支持 Markdown，并会按 wechat / iterms 主题渲染。
```

### articles/<articleId>.yml（目录模式可选，兼容）

```yml
article:
  publishAt: "2026-04-10 08:30:00"
  title: "<文章标题>"
  author: "<公众号名称>"
  cover: "<封面URL>"
  summary: "<摘要>"
  markdown: |
    # <正文标题>

    正文支持 Markdown，并会按 wechat / iterms 主题渲染。
```

### story.yml（可选）

```yml
story:
  accountOrder: ["protagonist", "friend"]
```

## 质量门槛

转换完成后必须满足：
- 第一条消息时间为绝对时间
- 所有 `@senderId` 在 `profiles.yml` 中可解析
- `#messageId` 不重复
- 引用只引用前文消息
- `chat.yml` 与会话类型一致（single/group）
- folder 模式下 `profiles/<accountId>.yml` 文件名与账号 id 一致
- `chatFiles/groupChats/officialArticles` 使用可解析的相对路径；新文章引用优先指向 `.md`
- 朋友圈 `publishAt`、文章 `publishAt` 可按阶段时间过滤
- `build:folder` 的 build report 中，每个账号的 `聊天 / 文档 / 社交 / 总计` 文字数应能反映创作规模；明显异常为 0 时需检查 `chatFiles`、`officialArticles` 或 `moments`
- 新账号解锁提示使用账号 `identityTimeline` 的第一个 `name`；如果希望提示显示某个旧身份，应把它放在 timeline 的最早生效项
- 如果修改了已发布账号的聊天、文档或朋友圈，并希望读者重新消费该账号内容，递增该账号的 `profile.version`；普通新增草稿或不希望重置进度时不要改版本
- `ui.debug` 默认 `false`；只有用户明确要求调试日志时才设为 `true`
- 增量导入时，新可切换账号默认追加到 `story.accountOrder` 末尾；普通联系人不加入 `accountOrder`

## 运行时语义

- 会话：当前阶段小时可播放内容未完成时显示红点；底部“对话”显示未完成会话数。
- 文档：进入“文档”tab 不标记已读；点击“阅读全文”后才标记对应文章已读。底部“文档”显示当前小时未读文章数，未读文章卡片显示红点。
- 社交：进入“社交”tab 不标记已读；当前小时 moment 卡片进入视口并停留后才标记已读。旧小时内容不会清除当前小时红点。
- 账号推进：当前账号在当前阶段小时下的会话、文档、社交均消费完成后才推进到下一个有内容的小时；最后一个小时完成后解锁下一个账号。
- `ui.theme` 支持 `wechat` 与 `iterms`；文档正文会按主题适配，`iterms` 呈现偏 Glow/TUI 阅读风格。

## 失败与降级策略

- 时间缺失严重：按顺序补默认相对时间，并在结果说明中标注“时间为推断值”
- 引用不明确：不强行生成 `[quote:...]`，保留普通文本
- 头像缺失：使用占位头像 URL
- 文章正文缺失：生成文章卡片元信息并在结果说明中标记“正文待补”
- 朋友圈作者无法匹配 profile：保留作者文本；能匹配时优先改为 `@profileId`
