---
title: "@deepseek-ai/dsh-atomic-write"
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

使用 `dsh-atomic-write` 替换文件时，不会暴露部分内容，也不会跟随临时路径上的符号链接。它的写锁会跨进程串行化读-修改-写入循环，因此并发写入方不会用陈旧状态相互覆盖。每次替换都会在全新 inode 上使用调用方选择的权限位，从而安全地收窄现有文件的权限。这个零依赖库只接受字符串；它不提供 `cordis.yml` 插件，也不保证崩溃持久性，因为它不调用 `fsync`。

---

## ⚡ 功能

### 限制

这些限制说明本包何时不是合适的工具。它们是当前包约束，不是任务积压。

- **原子但不保证持久**——不对文件或其所在目录做 `fsync`，因此崩溃后可能观察到 rename 被回退。此处的文件型存储在启动时重新读取并重新发布，把持久性留作调用方的策略。
- **仅支持字符串内容**——在有消费方需要之前，不提供 `Buffer` 或流式形态。
- **部分遗留锁需要操作者恢复**——锁记录为空或不完整，或其 PID 已被存活进程复用时，锁会留在原地；后续写入方超时也不会删除它。竞争者若在创建认领文件与移除锁之间结束，会同时留下 `<filename>.lock` 和 `<filename>.lock.takeover-<记录哈希>`，由操作者删除两者。
- **单一主机与单一 PID 命名空间**——探测在竞争者所在主机上进行。多台主机通过网络文件系统共享、或多个容器共享同一卷时，写入方可能把存活持有者视为已退出，接管其锁并与之同时写入。

---

## 📊 指标

无：本包是纯文件系统写入原语，不注册任何面向模型的内容。

#### KV Cache 影响

此处没有任何内容进入请求前缀，因此提供方缓存复用不受影响。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本包遵循一项职责分离：原子提交负责交换，写锁负责跨进程排序。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `writeFileAtomic` 与 `withFileLock`，即本包的全部接口 |

### 写入路径

`writeFileAtomic` 先以独占创建（`wx`）打开一个随机后缀的同级文件并写入内容，然后 rename 到目标上。独占打开拒绝跟随预先埋在可猜测临时路径上的符号链接；同目录兄弟文件保证 rename 落在同一文件系统上；rename 替换的是目标位置的符号链接本身，绝不写穿到该链接指向的文件。Windows 重试会保留同一份完整的兄弟文件，并采用有界指数退避，因此协作式写锁之外的软件瞬时占用目标时，不会让安全替换立即失败；已归档的[重试决策记录](../../../.agents/notes/archived/bug-fix/2026-08-29-windows-atomic-replace-retry.md)记录了最初的理由与被拒绝的替代方案。

`withFileLock` 以 `wx` 创建 `<filename>.lock` 同级文件。`EEXIST` 直接表示竞争；只有一次新的 `lstat` 确认锁路径存在时，`EPERM` 才表示竞争，从而兼容 Windows 的独占创建行为，又不掩盖无关的权限故障。锁以 `<pid>\n` 记录创建者的 PID，由持有者在 `finally` 中移除。竞争者读到的记录若经信号探测报告该 PID 不存在（`ESRCH`），就以 `wx` 创建 `<filename>.lock.takeover-<记录哈希>` 认领文件，重新读取锁并再次探测其 PID，仅当锁仍是同一条记录且该 PID 仍不存在时才移除它，随后移除认领文件并立即重试。以其他用户身份存在的持有者（`EPERM`）和指向竞争者自身进程的记录会继续等待。读到同一条记录的竞争者争用同一个认领文件，第二次探测会排除复用了已退出 PID 的持有者，因此接管绝不会移除另一个竞争者在已退出持有者之后获得的锁。接管只能证明记录中的进程已退出；启动了其他写入者的操作要为后继者留下找到它们的途径，[Plugin Manager](../../boot/plugin-manager/README.zh.md) 对其 pnpm 运行就是这样做的。竞争按指数退避，在每次调用声明的 `waitMs` 期限（默认两秒）过后失败；[历史接管决策记录](../../../.agents/notes/archived/bug-fix/2026-09-24-exited-holder-lock-takeover.md)负责说明理由。

### 交换为何安全

- **全新 inode，调用方声明的权限位**——临时文件带着 `mode` 走完 rename，因此收窄权限过宽的文件没有 chmod 竞态。`mode` 为必填，让权限决策始终可见于每个调用点。
- **读取方从不竞争**——rename 提交是原子的，读取方无需加锁。
- **竞争者只移除已退出持有者的锁**——文件存续时间无法区分已崩溃的所有者与暂停但仍存活的写入方，但进程已不存在可以区分。

</details>

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

一种对文件及其父目录执行 `fsync`、并在 Windows 上保留仅属主权限的持久性替换方案仍未实现（在源码中记录为 `settings-atomic-durability`）。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `writeFileAtomic` 与 `withFileLock`，即本包的全部接口 |

---

## 🔗 资源

当你需要了解使用本原语的存储或它所属的工具家族时，阅读以下页面。

- [用户设置文件存储](../../boot/config-editor/README.zh.md)——每次写入都通过本包替换的设置文档。
- [凭据存储](../../credentials/credentials-local/README.zh.md)——本包加锁并替换的凭据文件。
- [util 组映射](../README.zh.md)——本包所属的零依赖工具家族。

---

## 🚀 快速开始

```ts
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'

declare const text: string
await writeFileAtomic('/home/u/.dsh/cordis.patch.yml', text, { mode: 0o600 })
```

```ts
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'

declare const render: (previous: string) => string
declare const readCurrent: () => Promise<string>

await withFileLock('/home/u/.dsh/cordis.patch.yml', async () => {
  const previous = await readCurrent()
  await writeFileAtomic('/home/u/.dsh/cordis.patch.yml', render(previous), { mode: 0o600 })
})
```

原子写入文件



父目录会按需创建，读取方只会观察到旧内容或完整的新内容。在 Windows 上，报告为 `EACCES`、`EBUSY` 或 `EPERM` 的瞬时替换干扰会在有界时间内重试；任何剩余失败都会移除临时文件，并保持目标文件不变。

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-atomic-write
