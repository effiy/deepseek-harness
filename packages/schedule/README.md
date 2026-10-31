---
title: "schedule/ — Host 拥有的提醒"
tags: []
category: "schedule"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

为对话创建一次性、固定速率、每日、每周或 cron 提醒，并在 Host 重启后保留它们。无需打开原 Session，即可查看活动和已结束任务。使用 Schedule 创建和投递提醒，使用自动化任务页面跨 Session 查看任务并确认删除。到期提醒作为普通 follow-up 消息进入原对话，而不是电子邮件、短信或推送通知。

---

## ⚡ 功能

「待补充」

---

## 📊 指标

「待补充」

---

## 🏛️ 设计

「待补充」

---

## 📁 目录

| 包 | 职责 |
|---|---|
| [`schedule/`](schedule/README.zh.md) | Host 拥有的提醒持久化、调度、查询与显式删除 |
| [`tool-schedule/`](tool-schedule/README.zh.md) | 基于宿主 `ctx.schedule` 服务的 preset 级 `schedule_create`、`schedule_list`、`schedule_update` 和 `schedule_delete` 工具 |

---

## 🔗 资源

- [Schedule 子系统](../../docs/subsystems/schedule.zh.md)——任务记录、最近一次回执、时间与投递约定。
- [生成的工具目录](../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-schedule)——挂载 preset 所贡献的 `schedule_create`／`schedule_list`／`schedule_update`／`schedule_delete` schema。
- [Schedule 用户指南](../../docs/user/guide/schedule.zh.md)——创建提醒并查看活动或已结束任务。
- [Web 任务页面与提醒目录](../client/ui-schedule/README.zh.md)——在浏览器中查询任务并确认删除。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
