# Skill 使用说明：chat-record-converter

Skill 路径：
- `skills/chat-record-converter/SKILL.md`

## 1. Skill 能做什么

`chat-record-converter` 用来把原始聊天记录转换为本项目输入文件：
- `chat.md`
- `profiles.yml`
- `chat.yml`
- `ui.yml`（多会话模式可选）
- 目录模式下的 `profiles/*.yml`、`articles/*.md`（兼容 `articles/*.yml`）、`story.yml`
- 也支持在已有 chat-framework 项目中增量追加新对话

## 2. 推荐输入格式

给 agent 的输入建议包含：
- 原始聊天文本（按时间顺序）
- 参与者昵称（可选头像）
- 会话类型（单聊/群聊）
- 当前用户是谁（用于 `self`）
- 是否需要微信多会话首页、账号推进、朋友圈、公众号文章
- 是否需要 `wechat` 或 `iterms` 总览页主题
- 若是增量追加：已有项目根目录、新增对话希望归属哪些账号、是否有新增可切换账号

## 3. 推荐提示词模板

```text
请使用 chat-record-converter skill，把以下聊天整理为 chat-framework 的输入文件。
要求：
1) 生成 chat.md、profiles.yml、chat.yml；若是多账号/多会话目录模式，生成 profiles/*.yml、必要的 group yml、ui.yml、story.yml
2) 第一条消息使用绝对时间，后续优先相对时间
3) 识别引用关系并使用 [quote:messageId]
4) 若识别到图片、链接卡片、文章卡片、名片、系统状态提示，分别使用 [image] / [link-card] / [article] / [contact-card] / [status]
5) 若包含朋友圈或公众号文章，生成 profile.moments、profile.officialArticles 与 articles/*.md；已有项目全是 YAML 或我明确要求时才用 articles/*.yml
6) 同一发送者连续纯文本消息优先省略重复 @senderId，用空行分隔为多条消息；带 id/tag 的消息仍写完整消息头
7) 正文里的 @mention 必须使用可匹配的 profile id/name/nickName/identityTimeline/alias；不确定对应谁时先询问我
8) 最后做一致性校验并说明推断字段

原始聊天内容：
<粘贴聊天>
```

增量导入已有项目：

```text
请使用 chat-record-converter skill，把以下新增聊天追加到这个已有 chat-framework 项目。
项目根目录：<路径>
要求：
1) 先读取现有 profiles/story/chatFiles/groupChats/articles
2) 识别新增聊天中的人员是否属于已有 profile；高置信直接复用，疑似匹配先向我确认
3) 新会话文件名使用不冲突编号，例如 06-xxx.md
4) 将新会话追加到对应账号的 chatFiles；群聊补 groupChats
5) 如果有新的可切换账号，默认追加到 story.accountOrder 末尾；普通联系人不要加入 accountOrder
6) 同一发送者连续纯文本消息优先省略重复 @senderId；带 id/tag 的消息仍写完整消息头
7) 正文里的 @mention 必须使用可匹配的 profile id/name/nickName/identityTimeline/alias；不确定对应谁时先询问我
8) 最后列出新增/修改的文件和需要我确认的推断

新增聊天内容：
<粘贴聊天>
```

## 4. 输出检查清单

执行后检查：
- `@senderId` 是否都在 `profiles.yml` 中
- `#messageId` 是否唯一
- 正文里的 `@mention` 是否都能匹配当前会话 profiles；不确定或疑似错别字时是否已询问用户
- 首条时间是否绝对时间
- 引用是否只引用前文
- 同一发送者连续纯文本是否优先使用简写；需要显式 `#messageId` 或 tag 的消息是否仍使用完整消息头
- 原始记录中的系统提示、时间分割、验证提示、折叠提示是否使用 `[status]`；默认“当前聊天已结束”是否没有被重复手动生成
- 需要在同一条文本消息里保留段落空行时，是否避免使用连续纯文本简写
- `chat.yml` 的 `type/self/title/groupInfo.avatar` 是否完整（单聊无需 `peer`，群聊无需 `members/groupInfo.name`）
- 单聊省略 `chat.yml` 时，标题是否能从联系人备注、对方显式 `profile.name` 或按当前阶段时间解析出的 `identityTimeline.name` 推断，不能只依赖 profile id / 文件名
- 目录模式下 `profiles/*.yml` 文件名是否与账号 id 一致，`chatFiles/groupChats/officialArticles` 相对路径是否能解析
- 朋友圈 `publishAt` 与文章 `publishAt` 是否能被阶段时间过滤；非本人朋友圈作者优先写 `author: "@profileId"`
- 公众号文章正文是否优先放在 `articles/*.md`，并用 Markdown frontmatter 写 `title/author/publishAt/summary/cover/images`；profile 中只保留 `officialArticles` 引用
- `build:folder` 的 build report 是否显示合理的账号 `聊天 / 文档 / 社交 / 总计` 文字数；新账号解锁提示名是否来自该账号 `identityTimeline` 的第一个 `name`
- `ui.debug` 默认不要开启；仅用户明确要求调试日志时设为 `true`
- 增量导入时，人员匹配是否采用保守确认：只自动复用 id 完全一致、明确 `@profileId`、唯一同名/昵称命中的 profile
- 新增可切换账号是否已追加到 `story.accountOrder` 末尾；普通联系人是否没有误加入 `accountOrder`
- 新增会话是否已追加到对应 profile 的 `chatFiles`，群聊是否补了 `groupChats`

## 5. 增量导入时需要询问用户的情况

- 新增人员与多个已有 profile 同名或昵称相近。
- 新增人员只通过备注名、群名片、头像或语境疑似匹配到已有人员。
- 新增人员没有匹配 profile，需要确认是新建 profile 还是归入已有 profile。
- 用户要求新增人员成为可切换账号，但没有说明剧情顺序；默认追加到 `story.accountOrder` 末尾。
- 发现同名会话文件、message id、article id 或 moment id 冲突。

## 6. 运行时语义提示

- 会话：当前阶段小时可播放内容未播放完时，会话列表显示红点，底部“对话”显示未完成会话数。
- 文档：进入“文档”tab 不会标记已读；只有点击“阅读全文”才标记该文章已读。底部“文档”显示当前小时未读文章数，未读文章卡片显示红点。
- 社交：进入“社交”tab 不会标记已读；当前小时 moment 卡片进入视口并停留后才标记已读。历史小时内容不会清除当前红点。
- 账号推进：当前账号在当前阶段小时下的会话、文档、社交均消费完成后，才允许推进到下一个有内容的小时；最后一个小时完成后解锁下一个账号。
- `ui.theme` 支持 `wechat` 与 `iterms`；文档正文渲染会随主题适配，`iterms` 风格参考 Glow/TUI 阅读体验。

## 7. 与构建命令衔接

单会话：
```bash
node src/build.js <chat.md路径> <输出html>
```

多会话：
```bash
node src/build-folder.js <目录路径> <输出html>
```
