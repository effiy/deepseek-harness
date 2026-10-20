---
title: "@deepseek-ai/dsh-win32-process"
tags: []
category: "subprocess"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

供 Windows ACL 沙箱与普通子进程 Job runner 消费的底层 Win32 进程库。它唯一拥有仓库中可复用 process、stdio 与 Job Object 操作的 Koffi 绑定表；它不是 Cordis 服务，也不决定沙箱策略或公共 child 行为。维护任一原生进程路径或检查句柄生命周期限制时，请阅读本页。

---

## ⚡ 功能

### 限制

- **仅在 Windows 原生加载** — 导入通用类型可跨平台进行，但解析绑定表会加载 Windows DLL，并在其他宿主失败。跨平台测试注入绑定表，不加载原生 API。
- **没有公共进程服务** — 本包刻意不把原语包装成 Cordis 或 Node 流。消费方必须拥有自己的策略、异步调度、输出上限、取消与最终句柄关闭。
- **restricted-token null 环境** — `CreateProcessAsUserW` 沙箱原语传入 null 环境块，并先通过 `SetEnvironmentVariableW` 建立改动，因为经 Koffi 传入显式环境块会以 `ERROR_INVALID_PARAMETER` 失败。ordinary `CreateProcessW` runner 则要求完整 target 环境，并传入排序、双 NUL 结尾的 UTF-16LE 块，其中包括 `=X:` 驱动器条目，而不修改自身环境。
- **没有 standalone process API** — 本包只暴露当前沙箱与 ordinary-runner 消费方所需的操作，不拥有 Node 流、公共句柄、输出策略、取消或 durable state。
- **创建到分配之间的中断** — 目标以 suspended 状态启动，不能在 Job 分配前执行，但 runner 若在进程创建到分配之间的极窄区间被外力终止，可能留下 suspended target。本包不声明原子 Job 附加保证。
- **header 证据限定架构** — 已提交的 ABI probe 与布局常量覆盖仓库当前 64 位 Windows 目标。支持新的指针宽度或不兼容 Windows ABI 前，必须先更新 probe。

---

## 📊 指标

### 进程原语

#### 模型看到什么

没有直接内容。本包向沙箱与 ordinary runner 提供 `Win32ProcessBindings`、`CurrentTokenProcessBindings` 与进程原语；两者拥有全部模型可见工具、输出与诊断，本包不贡献提示词或工具 schema。

#### Token 影响

没有直接影响。消费方决定进程输出是否进入工具结果或后续模型请求。

#### KV Cache 影响

本包不贡献稳定请求前缀，因此不会使模型 KV Cache 失效。

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

**npm**: @deepseek-ai/dsh-win32-process
