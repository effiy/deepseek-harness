---
title: "host/ — Web GUI 宿主侧"
tags: []
category: "host"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`host/` 组提供 Web GUI 的 HTTP(S) 服务器、服务已构建 Web 壳的 SPA dist 服务器、带原生／浏览／自适应组合包的工作区目录选择 seam、open-in-app 的应用探测与启动路由，只读的插件清单投影以及显式产品事件上报。这些包都是产品包；浏览器传输位于 [`client/`](../client/README.zh.md)，组合应用是 [`apps/cli`](../../apps/cli/README.zh.md)，它启动 [`dsh-base` 组合包](../bundle/base/cordis.patch.yml) 来提供 `apps/web/` 下的 Web 应用。选择器后端可在共享 seam 后互相替换。

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

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`webserver/`](webserver/README.zh.md) | 浏览器 HTTP 服务器：具名路由、upgrade、index 转换与回退席位 | `ctx.webServer` |
| [`frontend-static/`](frontend-static/README.zh.md) | 占据 webserver 回退席位的 SPA dist 服务器 | 消费 `ctx.webServer` |
| [`directory-picker/`](directory-picker/README.zh.md) | 工作区目录选择 seam：能力约定与错误词汇 | `ctx.directoryPicker` |
| [`directory-picker-native/`](directory-picker-native/README.zh.md) | 面向宿主屏幕前操作者的原生 OS 选择器后端 | 注册 `ctx.directoryPicker` |
| [`directory-picker-browse/`](directory-picker-browse/README.zh.md) | 应用内目录浏览器后端，也服务于远程客户端 | 注册 `ctx.directoryPicker` |
| [`directory-picker-auto/`](directory-picker-auto/README.zh.md) | 在启动时挂载匹配后端的宿主自适应选择器 | 挂载一个后端 |
| [`open-in-app/`](open-in-app/README.zh.md) | 在已安装应用中打开 workspace 目录的应用探测、图标与启动路由 | 消费 `ctx.webServer` |
| [`plugin-inventory/`](plugin-inventory/README.zh.md) | 当前 Loader 条目的只读投影 | Remote `pluginInventory/list` |
| [`product-telemetry-otel/`](product-telemetry-otel/README.zh.md) | 通过 OTLP/HTTP 显式上报产品使用事件 | `ctx.productTelemetry` |

---

## 🔗 资源

先从传输与工作区记录的子系统参考读起，再看 Web Client 背后的分层决策。

- [HTTP 服务器子系统](../../docs/subsystems/web-server.zh.md)——webserver 的路由、匹配顺序与配置。
- [工作区子系统](../../docs/subsystems/workspace.zh.md)——目录选择器所喂给的工作区记录。
- [Web 配置树启动与传输分层](../boot/app-boot/README.zh.md)——Web 传输各层的所有权。
- [产品埋点](../../docs/subsystems/product-telemetry.zh.md)——显式提交分析事件。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
