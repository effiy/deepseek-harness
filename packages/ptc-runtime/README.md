---
title: "ptc-runtime/——PTC 执行能力族"
tags: []
category: "ptc-runtime"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

`ptc-runtime/` 组让模型编写一个程序，以普通异步调用的方式调用宿主提供的函数，然后只返回程序的打印输出和返回值。如需在全新 Node 进程中按所配沙箱策略执行，请选择 TypeScript 后端；如需 CPython 进程，请选择实验性 Python 后端。每次运行都不会保留之前程序的状态。失败会作为结果返回，供调用方诊断或提供给模型。

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

| 包 | 角色 | ctx 键 |
|---|---|---|
| [`ptc-runtime/`](ptc-runtime/README.zh.md) | 定义 PTC 运行时做什么：针对宿主提供的绑定运行一个程序，并报告其打印和返回的内容 | `ctx.ptcRuntime` |
| [`ptc-runtime-node/`](ptc-runtime-node/README.zh.md) | 在全新受管 Node 进程中按已解析沙箱策略执行 TypeScript | 注册 `ctx.ptcRuntime` |
| [`experimental/ptc-runtime-python/`](../experimental/ptc-runtime-python/README.zh.md) | 实验性 Python 后端：负责 Node 宿主与 CPython 子进程之间的 fd-3 协议，以及 CPython 运行时实现 | — |

---

## 🔗 资源

先从子系统参考了解服务约定，再看消费此能力的 PTC mode 设计，以及它所遵循的能力 seam 模型。

- [PTC 运行时子系统参考](../../docs/subsystems/ptc-runtime.zh.md)——请求／结果词汇、绑定与 `ctx.ptcRuntime` 的 Cordis 接口面。
- [PTC mode Agent Note](../../.agents/notes/implemented/feature/2026-06-15-ptc.zh.md)——工具注册表如何把 `run_code` 呈现给模型。
- [能力 seam](../../docs/capability-seams.zh.md)——本家族遵循的 Service Definition / Service Provider / Consumer 拆分。

---

## 🚀 快速开始

「待补充」

---

## ⚙️ 技术栈

「待补充」
