# 聊天记录 Markdown 与配置规范（v1.0）

本文档定义 `chat-framework` 的输入格式，包含：
- 聊天内容文件：`chat.md`
- 发送者配置：`profiles.yml`
- 会话配置：`chat.yml`
- 界面配置（仅会话总览页）：`ui.yml`
- 剧情推进配置（仅会话总览页）：`story.yml`

## 1. 核心概念与渲染产品

`chat-framework` 提供三类主要的渲染产物：

1. **单会话页 (Single Conversation Page)**:
   - 对应 `npm run build`。
   - 渲染单个 `chat.md`。
   - 包含完整的聊天详情，支持回放模式。

2. **会话总览页 (Conversation Hub)**:
   - 对应 `npm run build:folder`。
   - 聚合目录下所有的 `chat.md`。
   - 提供类微信的主界面、会话列表、发现（朋友圈）、文章列表及账号切换能力。

3. **剧情页 (Story Page)**:
   - 通过 `renderWechatStoryHtml` 以编程方式调用。
   - 串联多个会话总览场景，当前场景看完后支持触屏右滑或按钮点击进入下一幕。

### 1.1 阶段时间 (Stage Time)

在会话总览页中，顶部状态栏中心显示的时间被称为 **阶段时间**。
- **非实时时间**: 它不是操作系统时间，也不是真实的挂钟时间，而是由当前剧情阶段驱动的逻辑时间。
- **阶段驱动**: 在会话总览页运行时，阶段时间会根据当前阶段自动更新。当用户完成当前阶段的必要互动后，阶段时间会自动推移到下一阶段。
- **与 `story.yml` 的关系**: `story.yml` 用于定义账号推进顺序；它会影响“当前账号正在走哪条推进线”，但阶段时间本身来自当前账号的阶段小时，而不是来自真实物理时间。
- **显示格式**: 会话总览页初始会显示 `ui.yml` 中的 `statusBar.time`，进入运行态后会展示当前阶段小时。

### 1.2 账号推进 (Account Progression)

这是一种进阶的互动机制，通过 `story.yml` 定义。它允许开发者控制多个账号的解锁顺序，并基于用户的阅读进度推进不同账号各自的阶段时间与可见内容。

---

## 2. 文件组织

**单会话页**（生成单个聊天页面）：

```text
conversation-a/
├── chat.md
├── profiles.yml
└── chat.yml
```

会话总览页模式（一个文件夹内多个会话）：

```text
multi/
├── ui.yml
├── profiles.yml
├── group.yml
├── single.yml
├── 01-group.md
└── 02-single.md
```

## 2. chat.md 规范

### 2.1 Frontmatter 字段

`chat.md` 顶部支持 YAML frontmatter：

```md
---
title: "会话标题"
profiles: "./profiles.yml"
chat: "./chat.yml"
articles: "./articles"
theme: "wechat"
specVersion: "1.0"
---
```

字段说明：
- `title`：会话标题（可选）
- `profiles`：发送者配置路径，默认 `./profiles.yml`
- `chat`：会话配置路径，默认 `./chat.yml`
- `articles`：文章目录路径，默认 `./articles`（单会话页中用于解析文章中引用的 `[article]` 消息）
- `theme`：单会话页主题，可选 `wechat`（默认）、`paper`、`iterms`（绿黑终端风格）
- `specVersion`：规范版本，建议固定 `1.0`

### 2.2 消息头语法

每条消息默认以消息头开始：

```text
@senderId #messageId [optional-timeRaw] [optional-tags...]
```

也支持一种**仅限纯文本**的简化写法：

```text
@senderId
text block 1

text block 2
```

或者给第一条显式写时间：

```text
@senderId [2026-04-10 09:00:00]
text block 1

text block 2
```

在这种简化写法里：
- 同一个 `@senderId` 头下面，**每个用空行分隔的文本块**都会被解析成一条独立消息
- 该形式只适用于纯文本消息（包括纯 URL 文本，它仍会自动转为链接卡片）
- 该形式允许第一条显式写时间；拆分后**只有第一段**继承这个时间，后续段落按现有规则自动推导时间
- 如果某条消息需要 `#messageId`、或任意 tag（如 `[quote]`、`[image]`、`[voice]`、`[link-card]`、`[status]`、`[highlight]`），则仍然必须为该消息单独写完整消息头
- 在简化写法里，空行不再表示“同一条消息的分段”，而是表示“下一条同发送者消息”

示例：

```md
@alice #m1 [2026-04-10 09:00:00]
大家早上好

@bob #m2 [+2m] [quote:m1]
收到

@alice
我先补 parser。

然后补文档说明。

@alice [2026-04-10 09:30:00]
这是新日期下的第一段。

这是同一发送者在新日期下自动拆开的第二段。
```

约束：
- `senderId`：必须存在于 `profiles.yml` 的 `users` 中
- `messageId`：会话内唯一。可选；省略时系统会自动生成（`m1/m2/...`）
- 第一条消息时间必须是绝对时间
- 后续消息可用绝对时间、相对时间，或省略时间
- 省略时间时，系统会按“该条消息非空白字符数 N => +Ns”自动推导（最少 `+1s`）

### 2.3 时间格式

支持两类：
- 绝对时间：`YYYY-MM-DD HH:mm` 或 `YYYY-MM-DD HH:mm:ss`
- 相对时间：`+Ns` / `+Nm` / `+Nh` / `+Nd`

示例：
- `2026-04-10 09:00:00`
- `+30s`
- `+2m`
- `+1h`

### 2.4 标签（Tag）

支持标签：
- `[image]`：消息体为图片 URL 或路径
- `[link-card]`：消息体为键值对卡片配置
- `[quote:<messageId>]`：引用前文消息
- `[voice]`：语音消息（支持时长与转写）
- `[recall]` / `[recall:+10s]`：消息撤回（可设置撤回延时）
- `[article]`：微信文章转发卡片
- `[contact-card]`：联系人名片
- `[status]`：居中状态提示，正文为提示文案，样式与默认“当前聊天已结束”一致
- `[highlight]`：关键短句文字突脸效果，正文为突脸文字，消息出现时自动播放一次
- `[heartbeat:1]` / `[heartbeat:2]` / `[heartbeat:3]`：自动播放时将背景心跳声切换为对应节奏档位（1=慢、2=中、3=快）
- `[heartbeat:end]`：恢复默认正常节奏心跳
- `[choice]`：固定选项选择题，播放到该消息时暂停，用户只能从配置选项中选择
- `[require-score:N]` / `[require-score:N:global]`：单句分数解锁，默认使用当前账号分数，`:global` 使用全局分数

#### 文本消息（默认）

```md
@bob #m3 [+1m]
这是普通文本，URL 会自动转可点击链接。
```

#### 图片消息

```md
@alice #m4 [+30s] [image]
https://picsum.photos/seed/demo/460/320
这是一条图片说明文字（可选）
```

说明：`[image]` 下第一行视为图片地址，后续行视为图片说明文本。

#### 链接卡片消息

```md
@bob #m5 [+1m] [link-card]
url: https://example.com/post
title: 示例文章
site: example.com
desc: 这是一个链接卡片示例。
```

#### 引用消息

```md
@alice #m6 [+1m] [quote:m5]
这条是对 m5 的回复。
```

#### 语音消息

```md
@bob #m7 [+20s] [voice]
./audio/demo.mp3
duration: 8
这是语音的转写内容（可选）
```

说明：
- 第一行为音频 URL/相对路径，或使用 `url: ...`
- 可选 `duration: 秒数`，用于语音气泡显示
- 其余行作为转写文本（可选）

#### 撤回消息

```md
@alice #m8 [+10s] [recall]
这条消息会立即撤回

@bob #m9 [+10s] [recall:+12s]
这条消息会在 12 秒后撤回
```

#### 微信文章转发卡片

```md
@alice #m10 [+10s] [article]
id: a1
```

#### 状态提示

```md
@system #m11 [+5s] [status]
对方开启了朋友验证
```

#### 联系人名片

```md
@bob #m11 [+10s] [contact-card]
name: 周警官
nickName: zhou_police
avatar: https://example.com/a.jpg
bio: 社区民警
```

#### 高亮突脸

```md
@alice #m12 [+10s] [highlight]
有人在
```

说明：`[highlight]` 正文是要突脸显示的文字。消息出现时会自动播放一次全屏文字突脸效果；它是独立消息类型，不与 `[image]`、`[link-card]`、`[article]`、`[contact-card]`、`[status]` 等内容型标签混用。

#### 固定选择

```md
@system #c1 [+1m] [choice]
prompt: "你要怎么回复？"
scope: account
options:
  trust:
    label: "相信她"
    score: 2
  doubt:
    label: "先保持怀疑"
    score: 0
```

说明：
- 用户界面只显示 `label`，不会展示 `score`
- `scope: account` 表示分数加到当前账号；`scope: global` 表示整部故事共享分数
- 同一个选择题只会加分一次；刷新或重进聊天会显示已选状态，不会重复加分

#### 单句分数解锁

```md
@sister #m13 [+1m] [require-score:4]
这句话只有当前账号分数达到 4 才显示。

@admin #m14 [+1m] [require-score:8:global]
这句话使用全局分数判断。
```

### 2.5 文本增强效果

- `@mention` 会高亮显示，但必须匹配当前会话 profiles 中的 profile id、`name`、`nickName`、`identityTimeline.name`，或当前账号的 `aliases.contacts` / `aliases.selfInGroups`。构建器会按名称长度降序匹配，所以 `今天有新同事@周正入职` 可正确高亮 `@周正`；若 `@` 后的名称无法匹配已知 profile，构建会报错。
- 文本中的 URL 会自动转为可点击链接
- 点击头像可查看用户的资料卡（包含 `name`、`bio` 等）。其中 `name` 是正式名称（Canonical Nickname），作为资料卡标题显示。

## 3. profiles.yml 规范

发送者（用户）配置定义了账号的基本信息及视角下的关系。支持两种方式：
- 单文件：`profiles.yml`（`users` 字典）
- 目录模式：`profiles/`，每个用户一个文件（如 `alice.yml`、`bob.yml`）

```yml
users:
  alice:
    name: "Alice"
    nickName: "小A"
    avatar: "https://example.com/a.jpg"
    bio: "产品经理"
    aliases:
      contacts:
        bob: "Bob备注"
  bob:
    name: "Bob"
    avatar: "https://example.com/b.jpg"
    bio: "前端工程师"
```

### 3.1 字段说明

- **`users.<id>.name`**: **正式名称 (Canonical Nickname)**。这是账号的官方昵称，用于点击头像后弹出的资料卡标题。
- **互斥规则**: `name` 与 `identityTimeline` 必须**择一使用**。若定义了 `identityTimeline`，则不得在顶层定义 `name`，否则加载时会报错。
- `users.<id>.avatar`: 头像 URL 或路径。
- `users.<id>.bio`: 简介，显示在资料卡中。
- `users.<id>.nickName`: 展示昵称（可选）。资料卡中的"昵称"字段，默认为 `name`。
- `users.<id>.aliases`: 别名/名称覆盖配置（可选）。
  - `contacts.<targetId>`: **备注名 (Remark)**。当前视角账号对好友 `<targetId>` 的备注。在聊天气泡上方、标题栏、会话列表中优先显示该备注名。
  - `selfInGroups.<groupTitle>`: **群名片**。当前账号在该群聊中的自定义昵称。
- **`users.<id>.identityTimeline`**: 随日期变化的身份信息。
  - **时间基准**: 
    - 在单会话页回放中，随当前消息的时间戳动态变化。
    - 在会话总览页中，随当前账号的**阶段时间**动态变化。
    - 在账号切换列表（“我”Tab）中，每个账号卡片根据**该账号自身当前阶段时间**解析身份。
  - 支持字段：`name`、`bio`、`avatar`。其中 `avatar` 用于需要按剧情日期变化头像的资料展示与社交作者展示。


### 3.2 目录模式示例（推荐）

`chat.md` frontmatter:
```md
---
profiles: "./profiles"
---
```

`profiles/alice.yml`:
```yml
profile:
  version: 1
  name: "Alice"
  avatar: "https://example.com/a.jpg"
  bio: "产品经理"
  aliases:
    selfInGroups:
      "Room MVP 群": "Alice-群昵称"
    contacts:
      bob: "Bob备注"
  moments:
    m1:
      publishAt: "2026-04-30 09:00:00"
      author: "@bob"
      text: "今天开了个好会"
      images: ["https://example.com/1.jpg", "https://example.com/2.jpg"]
      requireScore:
        score: 2
        scope: account
```

说明：
- `version` 可选；当该账号内容更新并希望读者重新消费时递增。提升版本后，该账号聊天、文档、朋友圈阅读进度和阶段进度会重新开始，账号解锁状态不受影响
- 未配置 `version` 时沿用旧存储 key，旧项目不会被动丢失进度
- 朋友圈只支持文字和图片
- `publishAt` 所在小时晚于当前阶段小时（由账号推进驱动）时不会显示
- `requireScore` 可选；配置后还要求对应分数达标才显示，数字简写如 `requireScore: 2` 等价于 `score: 2, scope: account`
- `author` 为可选字段；未填写时默认使用所属 profile 的当前生效 `name/avatar`
- `author: "@<profileId>"` 可引用另一个 profile，渲染时会按当前阶段小时解析该 profile 的 `identityTimeline.name/avatar`
- `author` 也可写成对象（如 `name/avatar/bio` 或 `refId/id/profileId`），对象引用同样会按当前阶段小时解析对应 profile

### 3.2 微信文章配置

文章实体统一放在 `articles/` 目录下，profile 中保存文章文件路径引用。新文章推荐使用 Markdown frontmatter；旧 YAML article 文件继续兼容：

```yml
profile:
  officialArticles: ["./articles/a1.md", "./articles/a2.yml"]
```

`articles/a1.md`（推荐）:

```md
---
publishAt: "2026-04-27 08:30:00"
title: "文章标题"
author: "公众号名称"
cover: "https://example.com/cover.jpg"
summary: "文章摘要（可选）"
images: ["https://example.com/1.jpg", "https://example.com/2.jpg"]
requireScore:
  score: 2
  scope: account
---

正文第一段，支持 **粗体**、*斜体* 和 [链接](https://example.com)。

## 小标题

![正文图片](https://example.com/body.jpg)
```

`articles/a1.yml`（兼容）:

```yml
article:
  publishAt: "2026-04-27 08:30:00"
  title: "文章标题"
  author: "公众号名称"
  cover: "https://example.com/cover.jpg"
  summary: "文章摘要（可选）"
  requireScore:
    score: 2
    scope: account
  text: "文章正文（支持换行）"
  images: ["https://example.com/1.jpg", "https://example.com/2.jpg"]
```

说明：
- 入口在会话总览页底部“文章”
- `officialArticles` 推荐直接填写文章文件路径，也可以填写无扩展 article id；folder build 下相对路径以输入根目录解析，single-file build 下相对路径以 markdown 所在目录解析
- Markdown 文章的 frontmatter 字段与 YAML 文章字段语义一致；frontmatter 之后的正文作为文章正文渲染
- 如果 Markdown 文章没有 frontmatter，会取第一个 H1 作为标题，否则使用文件名 id；其他元信息可为空
- 文章正文由 `markdown-it` 在构建期渲染，支持常见 Markdown/GFM 表格与删除线；原始 HTML 默认禁用，会作为文本显示
- 仅展示 `publishAt` 所在小时 `<= 当前阶段小时` 的文章
- `requireScore` 可选；配置后还要求对应分数达标才显示，数字简写默认使用当前账号分数
- 支持文字+图片

## 4. chat.yml 规范

### 4.1 群聊

```yml
chat:
  type: "group"
  title: "Room MVP 群"
  groupInfo:
    avatar: "https://example.com/group.jpg"
```

### 4.2 单聊

```yml
chat:
  type: "single"
  self: "alice"
  title: "Bob"
  requireScore:
    score: 2
    scope: account
  requireScoreByHour:
    "2026-04-28 14:00":
      score: 4
      scope: account
```

字段说明：
- `type`：`group` 或 `single`
- `title`：会话标题（列表和详情头部）
- `self`：当前用户视角的 sender id（**单文件构建时必须指定**；folder 模式下由 profile id 自动推断）
- 群聊 yml 只需保留 `title/groupInfo`；`self` 由当前 profile 视角隐含
- 单聊**在 folder 构建模式下**可不配置 `chat.yml`，自动由消息参与者推断 `peer/title`；**单文件构建模式下必须配置** `self`
- 单聊标题不会回退到 profile id / 文件名；若未配置 `chat.title`，则必须能从当前账号 `aliases.contacts.<peerId>`、对方 `profile.name` 或按当前阶段时间解析出的 `identityTimeline.name` 推断，否则构建失败
- 单聊不需要配置 `peer`（自动由消息参与者推断）
- 群聊不需要配置 `members`，`groupInfo.name` 也不需要（直接使用 `title`）
- `requireScore` 可选；配置后隐藏整个会话入口，直到对应分数达标
- `requireScoreByHour` 可选；按阶段小时隐藏该小时新增消息，历史消息仍可显示
- 聊天解锁优先级为：会话级 `requireScore` → 小时级 `requireScoreByHour` → 单句 `[require-score]`

### 4.3 profile 中声明会话文件（推荐）

```yml
profile:
  version: 1
  chatFiles: ["01-group.md", "02-single.md"]
  groupChats:
    "01-group.md": "group.yml"
```

说明：
- `chatFiles`：该账号可见的会话 markdown 列表（相对 `build-folder` 输入目录）
- `groupChats`：群聊 markdown 到群聊 yml 的映射（单聊无需配置）
- 构建时会检查当前 profile id 是否出现在消息 sender 列表中，且所有 sender 都能在 profiles 中找到

## 5. ui.yml 规范（总览页模式）

`build-folder` 会尝试读取输入目录下的 `ui.yml`。

```yml
ui:
  statusBar:
    carrier: "中国移动"
    time: "12:21"  # 仅在未启用 story.yml 的静态展示下生效
    battery: "31%"
  topTitle: "微信"
  theme: "wechat"
  persistKey: "chat_framework_seen_v1"
  debug: false
```

字段说明：
- `statusBar.carrier`：状态栏运营商文案
- `statusBar.time`：状态栏初始时间文案（若启用 `story.yml`，此字段会被剧情驱动的阶段时间覆盖）
- `statusBar.battery`：状态栏电量文案
- `topTitle`：总览页主界面标题（默认“微信”）
- `theme`：总览页主题，可选 `wechat`（默认）、`iterms`（绿黑终端风格）。`paper` 主题仅单会话页可用
- `persistKey`：回放完成状态的本地存储键（默认 `"chat_framework_seen_v1"`）
- `debug`：是否输出 `[chat-debug]` 运行时日志（默认 `false`；设为 `true` 时启用）

## 5.2 story.yml 规范（账号推进/切换）

`build-folder` 会尝试读取输入目录下的 `story.yml`。该文件用于定义账号推进顺序，并在页面底部“我”中提供账号切换入口。

```yml
story:
  accountOrder: ["protagonist", "sister", "admin"]
```

字段说明：
- `accountOrder`：账号 id 列表（账号 id 即 `profiles/*.yml` 文件名），用于定义解锁顺序与展示顺序。

运行时行为：
- 初始仅解锁第一个账号。
- 当当前账号时间轴推进到最后一个小时，且该账号在当前阶段小时下“微信/文章/发现”的未读全部清零，会解锁下一个账号，并显示顶部轻提示、在“我”Tab 显示红点提示。
- 解锁轻提示中的账号名使用该账号 `identityTimeline` 按生效时间排序后的第一个 `name`；没有 timeline 名称时回退到显式 `profile.name`，最后回退到账号 id。
- 已解锁账号可在“我”中随时切换；阶段时间进度与已读状态按账号隔离。
- 同一个账号内部推进到下一个阶段小时，如果相邻阶段时间跨满自然月或自然年，会显示 `过 N 月后` / `过 N 年后` 的顶部轻提示；账号解锁造成的不同账号阶段时间差不会触发该提示。

## 5.3 Build report

`build:folder` 成功后会在命令行打印默认简报，包括账号数、会话数、文章数、朋友圈数、阶段小时数、story 账号顺序、单聊标题来源，以及每个账号下 `聊天 / 文档 / 社交 / 总计` 的文字数。

文字数用于创作规模参考，按可读文本字符估算：聊天统计消息正文、caption、卡片摘要和状态文案；文档统计文章标题、摘要和正文 Markdown 原文；社交统计朋友圈作者展示名与正文。URL、图片/音频路径、HTML 标签和内部 id 不计入。


## 5.4 会话自动播放红点

- 会话列表中，当前小时有“可自动播放但未播放完”的消息时，会话项显示小红点。
- 播放完当前小时内容后，该会话红点消失。
- 未达到 `requireScore` 的会话、小时消息、单句消息、文章和朋友圈不产生红点，也不阻塞阶段推进。
- 达分后新解锁的历史内容会显示在对应列表或聊天记录中，但不会回退已经推进过的阶段。

## 6. 完整示例

请直接参考：
- `examples/spec-demo/chat.md`
- `examples/spec-demo/profiles.yml`
- `examples/spec-demo/chat.yml`
- `examples/spec-demo/ui.yml`

## 7. 路径解析规则

`chat-framework` 根据构建模式的不同，采用不同的路径解析逻辑。

### 7.1 单文件构建 (`npm run build`)

当对单个 Markdown 文件进行构建时：
- Frontmatter 中的 `profiles`、`chat`、`articles` 等相对路径，均相对于该 **Markdown 文件所在的目录** 解析。

### 7.2 文件夹构建 (`npm run build:folder`)

当对整个文件夹进行构建（生成会话总览页）时：
- 以下路径均相对于传入的 **`inputDir` 目录** 解析：
    - `profiles/` 目录或 `profiles.yml` 文件。
    - `ui.yml` 与 `story.yml`。
    - `profiles` 中 `chatFiles` 列表里的 Markdown 路径。
    - `profiles` 中 `groupChats` 映射里的 YAML 路径。

## 8. 常见错误与排查

- 首条消息使用了相对时间：改成绝对时间
- `Unknown sender`：`chat.md` 的 `@senderId` 不在 `profiles.yml`
- `Duplicate message id`：重复的 `#messageId`
- 引用不存在：`[quote:x]` 的 `x` 必须在前文出现
- 页面列表为空：检查浏览器控制台是否有语法错误并重新构建
