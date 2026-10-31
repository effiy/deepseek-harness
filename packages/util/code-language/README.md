---
title: "dsh-util-code-language"
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

本仓库唯一的「文件扩展名 → 语法高亮语言」表，供 Client 的文档 Code 预览、diff 审阅与 Host read 工具持久化的 `lang` 提示共同使用。`languageForPath` 以大小写不敏感的方式把文件名或路径映射为规范化 grammar id；`CODE_HIGHLIGHT_EXTENSIONS` 列出预览注册可以声明的全部后缀。`readLangHintForPath` 在同一张表上把 read 卡片的短 id 投影出来：已录制的会话已经持有该后缀的值时保持该持久化值不变，其余后缀取该语言的短名。该包可在浏览器使用，不提供 Cordis service，也不持有运行时状态；真正的分词仍由 Client 高亮器负责。

---

## ⚡ 功能

### 限制

- **只匹配扩展名**——`languageForPath` 只看后缀，因此 `Dockerfile`、`Makefile`、`.gitignore`、`.editorconfig` 这类靠文件名识别的名称仍不表。文件名规则暂缓。
- **不做内容嗅探**——扩展名缺失或未知时，即使字节含义明确也按纯文本处理；本表从不读取内容。
- **精选而非穷举**——本表小于 Shiki 的 grammar 目录与 GitHub linguist；新增语言意味着同时添加扩展名条目与 Client grammar 注册。

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

**npm**: @deepseek-ai/dsh-code-language
