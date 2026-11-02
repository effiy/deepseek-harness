# CHANGELOG

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.1-alpha.2] - 2026-11-02

### Added
- 消息编辑/删除功能闭环交付
  - 助手消息编辑入口（`AssistantMessageActions` 组件，GAP-01）
  - 附件编辑支持：`messageUpdate` API 类型从 `TextBlock[]` 扩展为 `ContentBlock[]`，支持文本、图片、文件三种 block 类型混合编辑（GAP-02）
  - 附件存在性校验：编辑引用已过期/不存在的 attachment 时返回明确错误码
- 项目架构总览文档（`docs/project-overview.zh.md`，660+ 行）
- 增强版 README（400+ 行，含模块全景、前后端架构、测试体系、构建链）
- `CHANGELOG.md`（本文件）

### Changed
- `SessionMessageUpdateRequest.content` 类型从 `TextBlock[]` 放宽为 `ContentBlock[]`
- `QueueAction.edit.content` 同步放宽为 `ContentBlock[]`
- README 新增 Cordis 插件系统、Service Definition、前端 Slot/Bundle 机制、构建链和测试体系章节

### Fixed
- 消息编辑/删除后端校验增强：`image`/`file` block 的 `attachment` 字段做存在性校验，过期/不存在时报 `AttachmentNotFound` 错误码