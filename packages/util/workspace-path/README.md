---
title: "dsh-util-workspace-path"
tags: []
category: "util"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

供 Workspace 相关客户端和控制器包共享、可在浏览器使用的路径辅助函数。该包负责拼接 Workspace 相对路径、缩写用于展示的 POSIX 主目录、从 POSIX 或 Windows 路径提取 Workspace 标题、把路径拆成目录部分与末段供展示，并拥有在 Sidebar 与资源模型之间命名工作区文件的 `dsh-resource://file/…` 地址语法。`relativizeToCwd` 在显示时省略工作区前缀，并保留该目录以外的路径。它不提供 Cordis service，也不持有运行时状态。

---

## ⚡ 功能

### 限制

- **路径解析仅处理字面值**——它识别 POSIX 绝对路径、Windows 盘符路径和 UNC 路径，拼接相对路径时保留 Workspace 路径的分隔符，但不访问文件系统，也不规范化 `.` 与 `..` 路径段。
- **主目录缩写仅支持 POSIX**——Windows 路径保持不变，因为可移植浏览器无法安全推断 Windows 主目录路径等价关系。

---

## 📊 指标

「待补充」

---

## 🏛️ 设计

「待补充」

---

## 📁 目录

「待补充」

---

## 🔗 资源

「待补充」

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-workspace-path
