---
title: "@deepseek-ai/dsh-skill-office"
tags: []
category: "skill"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

Agent（智能体）可以加载 Word、PowerPoint 和 Excel 工作流，默认使用内置 Python 环境，并遵循用户或 AGENTS.md 明确指定的环境。这些 skill（技能）涵盖创建、局部编辑、结构检查和文件交付。环境提供 LibreOffice Kit CLI 时，可直接渲染选定页面或工作表区域、转换所需 PDF，并将重新计算后的工作簿保存为新文件。视觉检查要求模型支持图片输入，复用源文件未变时的预览，并在适用检查通过后结束；普通交付不要求安装渲染器。

---

## ⚡ 功能

### 限制

- 提供方依赖 LibreOffice Kit，但不安装 Python 或编写库。检查器要求 Python 3.9 或更高版本。
- 结构检查不判断分页、裁切、字体、图表外观或 Excel 重算。
- 检查器只接受 DOCX、PPTX 和 XLSX；传统格式、加密文件和启用宏的格式需要合适的其他工作流。

---

## 📊 指标

通过 `dsh-tool-skill` 间接呈现，由其渲染目录项与选中的指令正文。

#### KV 缓存影响

挂载提供方会增加三个目录项；加载 skill 时，其正文进入既有 skill 工具的插入位置。提供方不另增提示词分区。

## 已知限制与暂缓事项

---

## 🏛️ 设计

## 了解实现

<details>
<summary>实现细节——点击展开</summary>

提供方注册三个内置候选项，并在激活时从随包 YAML frontmatter 读取描述。加载后的指令正文不包含这些元数据。加载后的每个 skill 暴露自己的文件系统目录，因此执行工具可以定位共享检查器，而不依赖任务工作目录。可配置的外部资源支持 Python 无法读取应用归档的分发方式。

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 提供方注册与配置资源路径。 |
| [`assets/`](assets/) | 三种工作流和只读 OOXML 检查器。 |

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

## 延伸阅读

- [skill 注册表](../skill/README.zh.md)——发现与优先级。
- [skill 工具](../tool-skill/README.zh.md)——模型可见目录与正文。
- [文件交付](../../deliverables/tool-present/README.zh.md)——当前源路径交付。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-skill-office'
```

### 参数

| 字段 | 默认值 | 含义 |
|---|---|---|
| `assetRoot` | 包内的 `assets/` | 包含三个 skill 文件夹和共享 `scripts/` 的绝对资源目录；部署可将其放在应用归档之外。 |
| `node` | 当前独立 Node 进程 | Node 可执行文件的绝对路径；Electron 和独立 SDK 可执行文件必须显式提供。 |
| `cli` | 已安装 kit 的 `lib/cli.js` | CLI 入口的绝对路径；`false` 显式禁用 CLI。 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-skill-office
