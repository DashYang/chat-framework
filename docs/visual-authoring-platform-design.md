# chat-framework 可视化创作平台设计

## 1. 文档定位

本文描述 chat-framework 可视化创作平台的目标架构、前端 Studio 与渲染后端的关系、公共项目格式以及分阶段演进路径。

本文是面向未来实现的架构设计，不替代 `docs/system-design.md` 对当前代码的说明。当前 Markdown/YAML、CLI 和静态 HTML 构建能力继续兼容，并逐步迁移到本文定义的边界内。

## 2. 产品目标

平台面向不熟悉 Markdown、YAML 和源码的内容创作者。用户通过可视化界面创建人物、会话、消息、社交动态、文章、文档、设定和时间线，并即时预览最终作品。

长期目标：

- 完全静态的创作网页可独立部署，不强依赖服务端
- 同一作品内共享人物、资源和剧情状态
- 浏览器预览与 CLI/Node 构建结果一致
- 作品可以导出为独立 HTML 或完整静态网站
- 作品源文件保持开放，可由 Git、文本编辑器和 CLI 继续使用
- Studio 与渲染器通过稳定格式独立演进

第一阶段不追求在线账号、云端协作、多人实时编辑或无损保留任意 YAML 注释与排版。

## 3. 核心架构决策

### 3.1 项目文件是公共契约

版本化的 Markdown/YAML 语法和文件组织是 Studio 与 chat-framework 编译器之间的公开协议。

Studio 不直接依赖 renderer 的内部 JavaScript 对象；renderer 也不依赖 React 组件、表单状态或 IndexedDB。双方只共同遵守项目格式规范。

```text
Visual Studio
  -> Authoring Model
  -> Format SDK
  -> Markdown/YAML Virtual Project
  -> ProjectSource
  -> Shared Compiler
  -> Static HTML
```

格式变化属于显式契约变更，必须通过 `specVersion`、迁移器、兼容测试和能力声明管理。渲染器内部可以自由重构，只要继续兼容声明支持的项目格式。

### 3.2 浏览器与 Node 共享编译核心

浏览器预览和 Node/CLI 最终构建不维护两套渲染实现。解析、校验、归一化和渲染组成环境无关的 Shared Compiler，并分别构建为浏览器和 Node 可用的入口。

- Browser Adapter 从内存或 IndexedDB 虚拟文件系统读取项目
- Node Adapter 从磁盘读取现有项目目录
- 两个 Adapter 调用同一 Shared Compiler
- 浏览器把 HTML 放入沙箱 iframe
- Node 把 HTML 和资源写入输出目录

这样既保持 Studio 与渲染器解耦，也避免“编辑器预览正确但导出页面不同”的漂移。

### 3.3 创作状态与运行状态分离

创作项目只描述作品内容。读者运行时产生的已读状态、互动选择、分数、flag、阶段时间、账号解锁和结局处理状态属于 Site Runtime，不写回创作项目。

编辑器的选中项、面板尺寸、撤销栈等 UI 状态同样不进入公开项目格式。

## 4. 目标架构

```text
┌──────────────── Visual Studio ────────────────┐
│ React UI                                      │
│ Project/Message/Document Editors              │
│ Authoring Commands + Undo/Redo                │
│ IndexedDB Draft Store                         │
└────────────────────┬──────────────────────────┘
                     │ Authoring Model
┌────────────────────▼──────────────────────────┐
│ Format SDK                                    │
│ parse / serialize / validate / migrate        │
│ capability and semantic round-trip support    │
└────────────────────┬──────────────────────────┘
                     │ Virtual Project Files
┌────────────────────▼──────────────────────────┐
│ ProjectSource                                 │
│ Memory / IndexedDB / Node filesystem adapters │
└────────────────────┬──────────────────────────┘
                     │
┌────────────────────▼──────────────────────────┐
│ Shared Compiler                               │
│ load -> parse -> validate -> normalize        │
│ -> render -> diagnostics                      │
└───────────────┬─────────────────┬─────────────┘
                │                 │
       Browser Adapter       Node Adapter
                │                 │
         iframe preview       CLI / export
```

### 4.1 Visual Studio

Visual Studio 使用 React + TypeScript 实现，负责：

- 多项目和草稿管理
- 人物、消息和其他内容的可视化编辑器
- 拖放排序、撤销重做、选中态和快捷键
- 将用户操作转换为稳定的 Authoring Model 命令
- 调用 Format SDK 生成虚拟项目
- 展示 Shared Compiler 返回的结构化诊断

Studio 主外壳通过模块注册机制加载 Conversation、Social、Article 和 Document Editor。增加一种内容类型不应要求重写项目首页、预览容器或存储层。

### 4.2 Format SDK

Format SDK 是 Studio 面向项目格式的唯一入口，提供概念接口：

```ts
interface FormatAdapter {
  parseProject(source: ProjectSource): Promise<AuthoringProject>;
  serializeProject(project: AuthoringProject): Promise<VirtualProject>;
  validateProject(source: ProjectSource): Promise<Diagnostic[]>;
  migrateProject(source: ProjectSource, targetVersion: string): Promise<VirtualProject>;
  getCapabilities(specVersion: string): FormatCapabilities;
}
```

Format SDK 负责语义级往返。导入后再导出必须保留人物、消息、引用、条件和资源关联的含义，但允许规范化 YAML 缩进、字段顺序、Markdown 空行等文本表现。

未知但合法的扩展字段放入 `extensions` 保存。注释和任意原始排版的无损保留不作为初期要求。

### 4.3 ProjectSource

所有加载器通过 `ProjectSource` 访问文件，不直接调用 `fs`：

```ts
interface ProjectSource {
  list(path: string): ProjectEntry[];
  exists(path: string): boolean;
  stat(path: string): ProjectEntryStat;
  readText(path: string): string;
  readBinary(path: string): Uint8Array;
}
```

Shared Compiler 面向一次构建期间不可变的同步快照，以保证确定性。IndexedDB 等异步存储在编译前先将当前项目物化为 `MemoryProjectSource`；持久化 API 不进入 Compiler。

路径统一使用 POSIX 语义。版本化项目限制在项目根目录内；Legacy Node Adapter 继续兼容现有 CLI 的相对和绝对磁盘路径。初期实现：

- `MemoryProjectSource`：最小 Demo 和即时预览
- `NodeProjectSource`：兼容当前 CLI
- `IndexedDbProjectSource`：产品 MVP 的本地草稿

### 4.4 Shared Compiler

Shared Compiler 接收 `ProjectSource`、入口和构建目标，返回：

```ts
interface BuildResult {
  html?: string;
  diagnostics: Diagnostic[];
  referencedAssets: string[];
  metadata: Record<string, unknown>;
}
```

Compiler 不依赖 React、IndexedDB、Node `fs` 或宿主页面 DOM。Node 文件读取、浏览器 Blob URL、iframe 挂载和文件下载均由 Adapter 负责。

### 4.5 结构化诊断

错误不只通过异常字符串返回。`Diagnostic` 至少包含：

- `severity`：error / warning / info
- `code`：稳定错误码
- `message`：面向用户的提示
- `path`：项目文件路径
- `line` / `column`：可定位时提供
- `entityId` / `field`：可映射到可视化表单时提供

Studio 根据诊断定位并高亮对应消息卡片或字段；构建失败时保留最后一次成功预览。

## 5. 统一项目格式

目标目录结构：

```text
project.yml
profiles/
conversations/
social/
articles/
documents/
assets/
ui.yml
story.yml
```

根清单用于版本识别和入口发现，概念结构如下：

```yml
specVersion: "2.0"
project:
  id: demo-project
  title: 示例作品
  defaultEntry:
    type: conversation
    id: main
paths:
  profiles: profiles
  conversations: conversations
  social: social
  articles: articles
  documents: documents
  assets: assets
```

现有没有 `project.yml` 的单文件和文件夹项目由 Legacy Adapter 识别，并映射为相同的内部语义。根清单正式落地前需在格式规范中单独评审字段命名和兼容策略。

### 5.1 稳定实体 ID

人物、会话、消息、动态、文章、文档和时间线事件均使用稳定 ID。显示名称和文件名可以改变，但引用不能依赖名称或数组位置。

例如：

- 会话参与者引用 profile ID
- 社交动态和文章作者引用 profile ID
- 时间线参与者引用 profile ID
- 引用消息使用 message ID
- 文档可以引用人物，同时保存文档专属的身份、状态和长描述

### 5.2 资产管理

项目格式只保存网络 URL 或 `assets/` 下的稳定相对路径。Studio 内部使用 Blob 存储上传文件，预览时由 Browser Adapter 生成临时 URL，导出时选择：

- 小型作品：资源内嵌到独立 HTML
- 完整作品：输出 `index.html + assets/` 静态网站包

网络资源保留原 URL，并提示离线不可用。

### 5.3 版本与迁移

- `specVersion` 管理公开项目格式
- Studio 自身的 UI/草稿版本独立管理
- Shared Compiler 声明支持的格式版本与内容能力
- 新增可选字段优先保持向后兼容
- 不兼容格式必须返回明确诊断，不允许静默错误渲染
- 浏览器草稿迁移前保存可恢复副本

## 6. 前端与渲染后端的关系

### 6.1 即时预览

1. 用户在消息卡片中修改内容
2. Studio 更新 Authoring Model
3. Format SDK 将当前快照序列化到 `MemoryProjectSource`
4. Browser Adapter 在 Web Worker 中调用 Shared Compiler
5. Compiler 解析真实 Markdown/YAML 并生成 HTML
6. Studio 将最新成功结果放入沙箱 iframe
7. 过期请求按序号丢弃，错误映射回编辑字段

预览必须经过真实项目格式和真实 Compiler，不能维护一套绕过 parser 的简化消息渲染器。

### 6.2 Node/CLI 构建

1. CLI 创建 `NodeProjectSource`
2. Legacy Adapter 或版本化 Project Adapter 发现入口
3. Shared Compiler 完成解析、校验和渲染
4. Node Adapter 写入 HTML 和资源

当前 `build`、`build:folder` 和 `build:document` 命令保持兼容；内部逐步改为调用相同 Compiler。

### 6.3 独立演进边界

Studio 可以独立修改布局、交互和 Authoring Model，只要 Format SDK 仍能生成受支持的项目格式。Renderer 可以独立修改模板、运行时和性能，只要继续遵守格式语义和构建结果约束。

项目格式升级时：

1. 先发布格式规范和 Compiler 兼容能力
2. 再更新 Format SDK serializer/parser
3. 最后开放 Studio 中对应的编辑能力

## 7. 分阶段演进

### Phase 0：架构解耦基线

- [x] 为现有单会话、Hub 和集合文档建立固定样例与行为测试
- [x] 引入 `ProjectSource` 和结构化诊断
- [x] 将文件读取从解析、归一化和渲染逻辑中分离
- [x] 让当前 CLI 通过 `NodeProjectSource` 调用共享入口
- [x] 保持现有命令、输入格式和页面行为不变

完成状态：已完成。Shared Compiler 可从 `MemoryProjectSource` 或 `NodeProjectSource` 构建单会话、Hub 和集合文档；核心及核心加载器不直接依赖 `fs`，跨 Source 输出一致性由测试固化。

### Phase 1：最小架构 Demo

- 建立 React + TypeScript + Vite 静态应用
- 实现最小 Authoring Model、Format SDK serializer 和 `MemoryProjectSource`
- 可视化编辑参与者以及文字、图片消息
- 生成真实 Markdown/YAML 虚拟项目
- Browser Adapter 调用 Shared Compiler，iframe 展示结果
- 下载独立 HTML，并可查看生成的规范文件
- 将相同文件写入测试目录后可由 Node 入口构建

完成标志：浏览器和 Node 对同一项目生成等价的聊天页面。

### Phase 2：单会话产品 MVP

- IndexedDB 多项目草稿、自动保存和项目复制
- 正式资产库、上传图片和网络 URL
- 消息卡片排序、撤销重做和字段级错误定位
- 补齐引用、链接卡片、状态、撤回和现有三主题
- 支持规范项目包导出和语义级重新导入

### Phase 3：多会话与 Hub

- 共享人物库、单聊、群聊和多个会话
- Hub 页面与模块化站点导航
- Conversation Editor 作为可注册内容模块

### Phase 4：社交与文章

- 增加 Social Editor 和 Article Editor
- 作者统一引用人物 ID
- 复用发布时间、条件、资产和消费状态语义

### Phase 5：人物、设定与时间线

- 增加人物档案、设定集和时间线编辑器
- 时间线参与者引用人物 ID
- 完整网站增加资料库和跨内容导航
- 现有独立集合文档继续作为单页导出目标

### Phase 6：剧情与完整静态网站

- 抽取条件、分支、阶段时间、消费状态和账号推进 Runtime
- Studio 提供可视化规则编辑和引用校验
- 支持完整 `index.html + assets` 网站包
- 小型项目继续支持独立 HTML 导出

## 8. 最小 Demo 实现定义

最小 Demo 的目标是验证架构链路，不是交付完整产品。

### 8.1 页面能力

- 编辑会话标题和主题
- 添加、修改和删除参与者，指定当前账号
- 添加、修改、删除和拖动排序消息
- 消息类型仅包含文字和图片
- 图片支持 URL 和一个本地上传资源
- 右侧 iframe 自动预览
- 显示结构化错误
- 下载独立 HTML
- 开发模式可查看当前生成的虚拟文件

### 8.2 Demo 数据流

```text
Form State
  -> AuthoringProject
  -> serializeProject()
  -> project.yml + profiles/*.yml + conversations/main.md + assets/*
  -> MemoryProjectSource
  -> buildProject({ target: "conversation" })
  -> BuildResult.html
  -> sandboxed iframe srcdoc
```

### 8.3 Demo 非目标

- 不实现多项目持久化和账号登录
- 不导入任意手写或旧版项目
- 不实现引用、撤回、互动选择和剧情规则
- 不实现 Hub、社交、文章和集合文档编辑器
- 不实现云端发布和多人协作

这些能力不得通过 Demo 专用数据结构封死；`AuthoringProject` 从第一天使用人物集合和 `conversations[]`。

## 9. 测试与架构约束

### 9.1 格式测试

- serializer 生成的项目可被 Compiler 解析
- parse -> serialize -> parse 保持语义一致
- 未知版本、缺失引用和非法路径产生稳定诊断
- Legacy Adapter 持续构建现有 examples

### 9.2 跨环境一致性

- 同一项目通过 Memory 和 Node ProjectSource 得到相同规范模型
- Browser 与 Node 构建的关键 DOM、主题和运行时能力一致
- 浏览器上传资源和磁盘资源解析到等价页面内容

### 9.3 依赖边界

- Studio 不导入 Node `fs/path` 或 renderer 内部模型
- Shared Compiler 不导入 React、IndexedDB 或 Studio 状态
- Format SDK 不操作 iframe 或输出目录
- Adapter 不包含内容语法和业务校验

依赖边界应通过静态检查或模块导入测试固化。

### 9.4 回归要求

- 当前全部 Node 测试持续通过
- `build`、`build:folder`、`build:document` 命令保持兼容
- 人物改名不破坏会话、社交、文章和时间线引用
- 新增内容模块不要求修改 Studio 主外壳、存储协议或已有编辑器

## 10. 已确定事项

- 平台以统一作品项目为长期边界
- 最终产物是包含聊天、社交、文章和资料库的完整静态网站
- Markdown/YAML 项目格式是前端和渲染器的公开契约
- 浏览器与 Node 共享环境无关渲染核心
- 格式往返保证语义，不保证原始文本布局
- 最小 Demo 先验证虚拟项目、真实编译、浏览器预览和 HTML 导出
- React + TypeScript 作为 Studio 默认技术栈；替换 UI 框架不得影响 Format SDK 和 Compiler 边界
