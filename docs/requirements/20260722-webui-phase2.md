# 增量需求文档

- 生成时间: 20260722
- 分支: codex/webui-studio
- 基线提交: 103e5b7

## 需求摘要

完成可视化创作平台 Phase 2 单会话产品 MVP，并同时补齐 Phase 1 的浏览器端架构链路。

## 变更范围

- 新增 React + TypeScript + Vite Studio 和响应式三栏创作界面
- 新增 `specVersion: "2.0"` Authoring Model 与 Format SDK
- 新增 Markdown/YAML 项目序列化、校验、导入和资产语义往返
- 在 Web Worker 中通过 MemoryProjectSource 和 Shared Compiler 生成实时预览
- 新增 IndexedDB 多项目草稿、自动保存、复制和删除
- 新增参与者、消息、主题、引用、链接卡片、状态和撤回编辑能力
- 新增消息拖拽排序、撤销重做和实体/字段级诊断
- 新增本地图片资产、项目 ZIP 导入导出和独立 HTML 下载
- 移除 Shared Compiler 浏览器构建链路中的 `gray-matter` Node 依赖
- 新增格式编译、语义往返和诊断映射测试
- 修正文档治理脚本在仓库根目录运行时跳过暂存文件的问题

## 文档同步清单

- [x] 已更新 README.md
- [x] 已更新 docs/system-design.md
- [x] 已更新 docs/visual-authoring-platform-design.md
- [x] 本增量文档与提交内容一致

## Commit 摘要（用于 commit message）

Req: Complete Phase 2 single-conversation WebUI Studio
