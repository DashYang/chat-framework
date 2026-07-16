# chat-framework (MVP)

根据 `chat.md` 生成类似微信聊天记录网页（单会话页），或将多个 `md` 聚合为功能完备的会话总览页（Conversation Hub）。

## 核心能力

- **单会话页 (Single Conversation Page)**: 支持引用、图片、链接卡片、语音、撤回等全量微信特性，可作为独立页面分享。
- **会话总览页 (Conversation Hub)**: 聚合多会话、朋友圈、文章列表。支持 **账号推进 (Account Progression)** 与 **阶段时间 (Stage Time)** 驱动的沉浸式互动体验。
- **阶段时间 (Stage Time)**: 位于总览页顶部的状态栏中心时间。它不是操作系统时间或现实时钟，而是页面内部的剧情阶段时间；在运行过程中会随当前账号的阶段推进而更新。

## License

本项目采用 **PolyForm Noncommercial License 1.0.0 + 商业授权**。

- 非商业使用：遵循 [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)。
- 商业使用：需要获得单独的书面商业授权。
- 详细条款见 [LICENSE.md](LICENSE.md)。

## 运行

```bash
cd /Users/dash/workspace/chat-framework
npm run build           # 生成单会话页 (dist/index.html)
npm run build:paper     # 生成单会话页 (paper 主题)
npm run build:folder    # 生成会话总览页 (dist/wechat-hub.html)
npm run build:showcase  # 生成全功能预览基线
npm run build:stage-gap # 生成阶段时间跨度提示示例
npm run hooks:install
```

输出文件：
- `dist/index.html`（单会话页，wechat）
- `dist/paper.html`（单会话页，paper）
- `dist/wechat-hub.html`（会话总览页）
- `dist/showcase-wechat-hub.html`（全功能预览基线）
- `dist/stage-gap.html`（阶段时间跨度提示示例）

## 命令行安装

本地全局安装：

```bash
cd /Users/dash/workspace/chat-framework
npm link
```

安装后可在任意目录使用：

```bash
chat-framework build examples/chat.md dist/index.html
chat-framework build:folder examples/showcase dist/showcase-wechat-hub.html
chat-framework build-folder examples/showcase dist/showcase-wechat-hub.html
chat-framework help
```

`npm link` 创建的是全局命令到当前项目的 symlink。后续更新 `chat-framework` 的代码后，命令会直接使用最新本地版本，不需要重新 `npm link`。只有移动项目目录、删除 link、修改命令名或换机器时，才需要重新 link。

`build:folder` 成功后会默认输出 build report：账号/会话/文章/朋友圈/阶段小时摘要、单聊标题来源，以及每个账号下 `聊天 / 文档 / 社交 / 总计` 的文字数。文字数按可读文本字符估算，不统计 URL、资源路径、HTML 标签和内部 id。

## Markdown 格式

```md
---
title: "项目讨论记录"
profiles: "./profiles.yml"
chat: "./chat.yml"
theme: "wechat"
specVersion: "1.0"
require:
  score: 2
  flag: "met_bob"
  scope: "account"
---

@alice #m1 [2026-04-09 10:00:00]
第一条消息必须绝对时间

@bob #m2 [+2m] [quote:m1]
后续可相对时间，并支持引用
```

- 单聊 Markdown 也可直接在 frontmatter 中配置会话级解锁条件：`require.score` 为所需分数，`require.flag`（或 `require.flags`）为所需全局标记；两者同时配置时必须同时满足。`scope` 默认为 `account`，设为 `global` 时使用全局分数。此写法不需要额外的 `chat.yml`。

- 头部语法：`@发送者 #消息ID [可选时间] [可选标签...]`
- 标签：`[image]`、`[link-card]`、`[quote:消息ID]`、`[voice]`、`[recall]`、`[recall:+10s]`、`[article]`、`[contact-card]`、`[status]`、`[highlight]`
- 时间：第一条必须绝对时间；后续可 `+30s/+2m/+1h/+1d`，也可省略（按消息字数自动推导秒数）
- `#消息ID` 可省略（自动生成为 `m1/m2/...`）
- 文本中的 `@mention` 会高亮显示，但必须匹配当前会话 profiles 中的 id、`name`、`nickName`、`identityTimeline.name` 或当前账号 aliases；写错会在构建时报错。`@` 可以贴着中文句子出现，例如 `今天有新同事@周正入职`。
- `[image]` 支持“图 + 文字说明”（图片地址后续行作为说明）
- `[voice]` 支持语音消息（首行是音频 URL/路径，可选 `duration: 秒数` 和转写文本）
- `[recall]` / `[recall:+10s]` 支持撤回效果：无 `#messageId` 的纯文本可用空行拆成多条消息，每条继承撤回延时并依次撤回；带 ID 或其他内容类型 tag 的多行正文会完整显示并一起撤回。详情页回放时若突脸动画正在播放，会在动画结束后再变为“撤回了一条消息”。
- `[article]` 支持在聊天中转发文章卡片，推荐用 `id` 引用 `articles/` 目录中的文章
- `[contact-card]` 支持在聊天中发送联系人名片（头像/姓名/昵称/bio）
- `[status]` 是居中的状态提示（无头像）。正文可用空行分隔多条状态，且每条继承头部标签，避免重复书写：
  ```md
  @wo [status] [require-flag:bad-end]
  格式化开始

  格式化中。。。

  格式化结束
  ```
- `[choice]` 选中后会替换为普通聊天气泡：默认由当前账号发言；可在 `speaker: 账户ID`（与 `options` 同级）指定所有选项共用的回复角色，并在每个选项中用 `text: 台词` 指定展示内容（未填时展示 `label`）。
- `[highlight]` 支持关键短句文字突脸效果，消息出现时自动播放一次，例如“有人在”
- 点击聊天头像可查看 `profiles` 中的名字（`name` 为正式名称）和简介（`bio`）；当配置了 `identityTimeline` 时，系统以其按参考时间解析出的生效名称为准，不再使用顶层的 `profile.name`。`aliases.contacts` 中定义的备注名则用于聊天气泡上方、总览页预览及标题栏。
- 总览页支持“发现 -> 朋友圈”，仅展示文字/图片，并按当前阶段小时过滤未来动态
- 总览页支持“文章 -> 文章列表”，文章正文统一来自 `articles/` 目录；profile 仅保存文章 id 引用。新文章推荐使用 Markdown frontmatter（`.md`/`.markdown`），旧的 YAML article（`.yml`/`.yaml`）继续兼容；正文支持标题、段落、引用、列表、粗体/斜体、链接和图片
- 文章正文由 `markdown-it` 在构建期渲染，原始 HTML 默认禁用；正文图片会自动接入图片预览
- 总览页支持“自动播放未完成红点”：当前阶段小时可播放内容未看完时，会话项显示红点；进入会话播放后，该会话立即从底部“对话”待播放数字中排除，但不会提前持久化为已读；当前小时内容播放完毕后，会话红点立即消失。底部数字按待播放会话数统计，不按消息条数统计，历史已有消息不计入当前小时数字。播放未结束时通过返回或底部导航离开，会先询问是否跳过；确认后剩余消息视为已播放，存在未选择互动选项时不可跳过
- 会话列表预览规则：
  - 当前阶段有新内容的会话会稳定置顶；即使已经播放完毕，也会保持置顶直到进入下一阶段
  - 有未读红点时，预览显示“当前小时第一条可播放消息”
  - 当前小时已读完时，预览显示“当前会话在当前阶段小时下的最后一条消息”

## YAML

- `profiles.yml` 或 `profiles/`：发言人信息（支持目录模式：每个用户一个 yml 文件）
- `articles/`：微信文章内容（推荐每篇一个 md，也兼容 yml；文件名即 article id）
- `chat.yml`：会话元信息（仅群聊推荐保留；单聊可不配置）

推荐文章示例（`articles/a1.md`）：

```md
---
publishAt: "2026-04-29 09:15:00"
title: "一篇支持 Markdown 的文章"
author: "Room"
summary: "列表页摘要仍然用独立字段。"
cover: "https://picsum.photos/seed/article-cover/800/420"
---

# 正文标题

第一段正文，支持 **粗体**、*斜体* 和 [链接](https://example.com)。

> 这里是一段引用。

- 第一条
- 第二条

![正文图片](https://picsum.photos/seed/article-md/800/420)
```

兼容 YAML 文章示例（`articles/a1.yml`）：

```yml
article:
  publishAt: "2026-04-29 09:15:00"
  title: "一篇支持 Markdown 的文章"
  author: "Room"
  summary: "列表页摘要仍然用独立字段。"
  markdown: |
    # 正文标题

    第一段正文，支持 **粗体**、*斜体* 和 [链接](https://example.com)。

    > 这里是一段引用。

    - 第一条
    - 第二条

    ![正文图片](https://picsum.photos/seed/article-md/800/420)
```

### Profile 别名与名称显示规则

```yml
profile:
  version: 1 # 内容更新并希望读者重新消费该账号内容时递增
  # name: "奋斗的西瓜" # 与 identityTimeline 互斥，不建议混合使用
  aliases:
    selfInGroups:
      "Room 功能预览群": "瓜总"
    contacts:
      sister: "老姐"

  identityTimeline:
    2026-04-01:
      name: "奋斗的西瓜"
      bio: "独立游戏开发者"
    2026-04-29:
      name: "西瓜（Room 维护中）"
      bio: "独立游戏开发者 / Room 项目维护者"
```

- **Naming Source Exclusivity**: 账号身份名称必须从 `profile.name` 或 `profile.identityTimeline` 中**择一使用**。若配置了非空的 `identityTimeline`，则必须删除顶层的 `profile.name`。
- **Canonical Nickname**: 账号的正式名称。系统会根据当前参考时间从 `name` 或 `identityTimeline` 中解析。它显示在点击头像弹出的资料卡标题中。
- **Remark (`aliases.contacts`)**: 对好友的备注名。在当前账号视角下，单聊/群聊中别人的发言、会话列表预览、聊天窗口标题都会优先显示备注名。
- **Profile Version**: `profile.version` 是可选的账号内容版本。提升版本号后，该账号的聊天、文档、朋友圈阅读进度会重新开始；账号是否已解锁不会因此重置。未配置版本时沿用旧进度。
- **Group Alias (`aliases.selfInGroups`)**: 在特定群聊中自己的显示名称（群名片）。
- **Date-effective identity (`profile.identityTimeline`)**: 可按日期配置生效中的 `name/bio`。系统会选取“生效日期 <= 当前参考时间”的最新一条。
- **Stage-time Naming**: 在会话总览页中，账号资料卡、单聊标题、会话列表名称的参考时间为当前账号的**阶段时间**。特别地，在“我”界面的账号切换列表中，每个账号卡片的名称都根据**该账号自身的阶段时间**（即该账号当前持久化的阶段小时）解析，从而确保每个账号都以其当前的剧情身份呈现。
- 未配置别名时，回退到解析出的正式名称，最后回退到 `id`。

## 会话总览页模式说明

当你用 `build-folder` 构建时：
- 文件夹内每个 `.md` 表示一个会话。
- **路径解析规则**：
  - **单文件构建 (`npm run build`)**：Markdown 头部 frontmatter 中的 `profiles/chat/articles` 等相对路径，均相对于该 **Markdown 文件所在的目录** 解析。
  - **文件夹构建 (`npm run build:folder`)**：`profiles/` 目录、`profiles.yml`、`ui.yml`、`story.yml` 以及 `chatFiles` 和 `groupChats` 中指定的路径，均相对于传入的 **`inputDir` 目录** 解析。
- 首屏是会话列表，预览按“未读当前小时首条 / 已读当前小时最后一条”动态更新。
- 点击会话后会按消息内容自动估算阅读节奏逐条播放；文本越长，停留越久。播放中点击聊天记录区域可立即刷出下一条消息
- 播放完成后显示小字：`当前聊天已结束`
- 可点击“返回”继续看其他会话
- 聊天窗口支持滚动查看历史与最新消息
- 某个会话完整播放过一次后，再次进入会直接完整展示（基于 `localStorage` 记忆）

参考目录：`examples/multi/`

### 基于 profile 的会话索引（推荐）

在 `profiles/*.yml` 中可直接声明该账号可见的会话文件，`build-folder` 会优先按这个索引加载：

```yml
profile:
  version: 1
  chatFiles: ["01-group.md", "02-single.md"]
  groupChats:
    "01-group.md": "group.yml"
```

- `chatFiles`：该账号视角下要加载的聊天 markdown 文件（相对 `build-folder` 输入目录）
- `groupChats`：仅群聊需要，指定某个 markdown 对应的群聊元信息 yml（只需 `title/groupInfo`）
- `self` 不再写在群聊 yml 中，由当前 profile 的 id 隐含
- 单聊无需 `chat.yml`，系统会从消息参与者自动推断会话对象与标题；标题必须来自当前账号联系人备注、对方显式 `profile.name` 或按当前阶段时间解析出的 `identityTimeline.name`，不会回退到 profile id / 文件名

### 账号推进与切换 (story.yml)

在总览页目录下可选放置 `story.yml`，用于开启“账号解锁 + 切换”的沉浸式体验。

```yml
story:
  accountOrder: ["protagonist", "sister", "admin"]
  title: "我的互动故事"
  favicon: "assets/game-icon.png"
  endInfo: "尘埃落定。"
```

- `accountOrder`：账号（即 `profiles/*.yml` 的文件名 id）的解锁顺序。
- 解锁规则：当前账号在当前分支中已可见的聊天消息、文章与朋友圈均已消费后，才会解锁下一个账号并显示顶部轻提示，同时在“我”上打红点提示；进入“我”可看到已解锁账号列表并随时切换。未满足 `require`、当前分支不可见的内容不会阻塞解锁。
- 解锁提示中的账号名称使用该账号 `identityTimeline` 的第一个 `name`；没有 timeline 名称时回退到显式 `profile.name`，最后回退到账号 id。
- **阶段时间** 与已读状态按账号隔离（同一个 `persistKey` 下记录多个账号的进度）。
- 同一个账号内部推进到下一个阶段小时，如果相邻阶段时间跨满自然月或自然年，会显示 `过 N 月后` / `过 N 年后` 的顶部轻提示；账号解锁造成的不同账号阶段时间差不会触发该提示。
- 选择获得 `true-end*` flag 后，会等待精确依赖该 flag 的内容消费完成，显示 `endInfo` 居中提示；同一 flag 在整个故事中只触发一次，并会将来源会话标记为已读。点击“继续”会播放关机动画并返回账号页，但不会重置进度或额外解锁账号。
- `title`：可选的浏览器网页标题；未配置时使用构建输入目录名。`favicon`：可选的网站图标 URL 或路径，会原样写入 HTML 的 `link rel="icon"`；相对路径以生成 HTML 所在目录解析，构建不会复制图标文件。

补充说明：
- `story.yml` 不是第三种独立渲染模式，而是**会话总览页**里的账号推进配置。
- 顶部状态栏正中的时间建议统一称为 **阶段时间**。它不是操作系统时间或物理世界时间，而是页面内部随着推进变化的剧情阶段时间。

示例：`examples/showcase/story.yml`

### 全功能预览基线（约定）

- 目录：`examples/showcase/`
- 产物：`dist/showcase-wechat-hub.html`
- 目标：集中覆盖当前所有核心功能（聊天、引用、图文、语音、撤回、头像资料卡、朋友圈）
- 约定：后续每新增一个功能，必须同步补充 `examples/showcase` 示例数据，保证可直接预览与回归

### 阶段时间跨度提示示例

- 目录：`examples/stage-gap/`
- 产物：`dist/stage-gap.html`
- 目标：覆盖同账号阶段推进中的 `过 N 月后` / `过 N 年后` 顶部轻提示，不混入 showcase 主线剧情

### 主界面文案配置（ui.yml）

在多会话目录下可选放置 `ui.yml`，用于配置状态栏和标题文案：

```yml
ui:
  statusBar:
    carrier: "中国移动"
    time: "12:21"
    battery: "31%"
  topTitle: "微信"
  persistKey: "room_wechat_seen_v1"
  debug: false
```

- `carrier/time/battery`：顶部状态栏文案
- `topTitle`：顶部标题（如“微信”）
- `persistKey`：浏览器本地记忆键名（用于“已播放会话直接完整展示”）
- `debug`：是否输出 `[chat-debug]` 运行时日志，默认 `false`

## 文档导航

- 输入规范文档：`docs/chat-format-and-config-spec.md`
- Skill 说明：`docs/skill-chat-record-converter.md`
- 系统设计文档：`docs/system-design.md`
- Skill 文件：`skills/chat-record-converter/SKILL.md`
- MR 流程 Skill：`skills/mr-workflow/SKILL.md`
- MR Skill 说明：`docs/skill-mr-workflow.md`
- MR 流程设计文档：`docs/mr-workflow-system-design.md`

## MR 提交流程（新增）

1. 首次安装 hooks：
```bash
npm run hooks:install
```

2. 生成本次提交的增量需求文档：
```bash
bash scripts/generate-requirement-doc.sh "这里填写需求摘要"
```

3. 提交前校验文档同步：
```bash
npm run req:check
```

4. commit message 需要包含：
```text
Req: 这里填写需求摘要
```
