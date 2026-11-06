---
title: "@deepseek-ai/dsh-structured-logging"
tags: []
category: "boot"
created: 2026-11-06
source: internal
type: index
status: stable
lifecycle: active
---

## 💡 概述

把进程日志以 JSON Lines 格式（每行一个 JSON 对象）追加写入文件，供日志聚合系统（Loki/ELK 等）消费。捕获经由 Cordis logger 服务发出的各级别记录，按大小轮转并保留有限份数的归档。未配置文件路径时插件不注册任何行为。

## ⚡ 功能

- 输出：JSON Lines，每行一条记录，字段：
  - `time`（ISO 8601）/ `ts`（毫秒时间戳）/ `sn`（序号）/ `level`（error|info|warn|debug）/ `name`（logger 名）/ `message`（printf 风格格式化文本）/ `args`（JSON 安全化后的原始参数）
- 安全序列化：循环引用标记为 `"[Circular]"`；bigint/symbol/function 转为字符串；Error 保留 `name`/`message`/`stack`/`cause`；参数先安全化再格式化，sink 对任意参数不抛错
- 大小轮转：`app.log` → `app.log.1` → … → `app.log.<maxFiles>`，最旧归档被覆盖，磁盘占用上界为 `maxFileSizeBytes × (maxFiles + 1)`
- 重启追加：重新挂载同一路径继续追加，继承的文件大小计入轮转
- 生命周期：exporter 与文件句柄挂在插件 fiber 上，HMR 卸载时先移除 exporter 再关闭句柄
- 配置在加载时经 schemastery 校验，非法值（如 `level: 4`）令插件 fiber 加载失败；不可用路径（如目录）同样失败报响

### 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `file` | 无（插件保持惰性） | 日志文件路径；相对路径按进程工作目录解析 |
| `maxFileSizeBytes` | 10485760（10 MiB） | 单文件轮转阈值 |
| `maxFiles` | 5 | 保留的归档文件数（不含活动文件） |
| `level` | 2 | 捕获阈值：0=仅 error，1=+info，2=+warn，3=+debug |

### 限制

- 仅捕获经 Cordis `ctx.logger` 的记录；包内直接调用 `console.*` 的输出不进入文件（此类调用多在浏览器侧）。
- `message` 字段受 Cordis 默认 `maxLength`（10240 字符/行）截断；`args` 保留完整结构。
- 单行超过 `maxFileSizeBytes` 时仍会写入，轮转是按行近似的尽力而为。
- 同步写（`writeSync`）；极高频日志会阻塞事件循环，聚合场景应通过 `level` 控制量级。

## 📊 指标

无；本包观察日志流，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 🚀 快速开始

base bundle 已接线，环境变量启用：

```bash
DSH_LOG_FILE=/var/log/dsh/app.log dsh web
```

或在 bundle/cordis.patch.yml 中添加：

```yaml
- id: structured-logging
  name: '@deepseek-ai/dsh-structured-logging'
  config:
    file: /var/log/dsh/app.log
    maxFileSizeBytes: 10485760
    maxFiles: 5
    level: 2
```

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-structured-logging
