# 增量需求文档

- 生成时间: 20260722
- 需求: 将可视化 Studio 推进到 Phase 4

## 变更范围

- Authoring Model 与公开项目契约升级到 `specVersion: "3.0"`
- 自动迁移 Studio v2 单会话草稿
- 新增共享人物、多会话、单聊/群聊和 Conversation Editor
- Studio 预览与 HTML 导出切换到真实 Folder Compiler 和 Hub Runtime
- 新增 Social Editor，支持作者引用、发布时间、文字、多图和条件
- 新增 Article Editor，支持作者引用、发布时间、标题、摘要、封面、Markdown、附图和条件
- 项目包升级为 profiles、conversations、chats、articles、ui 与 assets 目录结构
- 保持 Phase 4 项目包的语义级导入导出
- 更新内置全功能 Demo 与回归测试

## 验收结果

- 多会话、朋友圈和文章均可在 Studio 编辑并实时进入 Hub 预览
- 人物 ID 修改同步更新会话、消息、朋友圈和文章引用
- v3 项目可导出、重新导入并通过 Folder Compiler
- 原有 Node 构建与渲染测试保持通过
