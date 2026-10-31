---
title: "@deepseek-ai/dsh-subprocess-local"
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

在任何于宿主机上运行子进程的组合中挂载 `dsh-subprocess-local`。它解析本地可执行文件，为普通 Linux 与 Windows 命令以及受支持的 Linux 终端会话提供由 OS 所有的受管范围，并通过 `node-pty` 提供真实终端会话；不受支持的宿主使用明确披露的较弱 fallback。它没有任何配置，因此每项处置方式、限制、终端尺寸与宽限期都随 spawn 请求来自调用方能力 seam。输出收集在内存中保留一段有界尾部，并可选地用 spill 文件恢复完整流；子进程从清理后的环境起步；dispose（资源释放）会终止并等待每个选定范围或会话完全停稳。

---

## ⚡ 功能

### 限制

这些限制说明本提供方何时不合适，或何时需要特别的运维注意。它们是当前包约束，不是通用平台对比或任务积压。

- **Linux 直接进程退出没有独立截止时间**——直接 `SIGKILL` 获得确认后，不可中断的内核 I/O 可能让 dispose 无限期等待；`graceMs` 和 scope 查询的轮询预算不限制此等待。
- **native ownership 有明确宿主要求**——Linux 需要可读的 user manager 与 `systemd-run --expand-environment=no`；旧版 systemd 使用带告警的 PGID fallback。macOS 因没有受支持的公开 persistent owner，始终使用该 fallback。
- **native 选择具有有界的每次 spawn 成本**——Linux 会重复检查 bootstrap 入口、libc `execve`/`fcntl` bindings、存活的 user manager 与 literal-argv scope 支持，直到这套完整探测首次成功；后续符合条件的普通命令或终端 spawn 只重新检查存活的 user manager。Windows 会在每次普通 spawn 前重新检查 runner 入口、bindings 与当前 Job 支持。Linux 深度探测的成功状态与 fallback 告警去重会在提供方生命周期内持续保留。所有探测都会在用户命令可能运行前完成，子进程探测的超时为 5 秒。每次 Linux 启动都会创建私有请求目录，以 50 毫秒间隔检查尚未确定的 scope 建立状态；scope 已建立且仍 active 后，查询间隔按指数增长，最多为 5 秒。Windows 普通命令会保留一个 runner 与一条 IPC 通道，直到 Job 报告活动进程数为零。目标会直接继承标准句柄，不使用 named-pipe stdio 或结果文件。
- **Windows Job inheritance 有明确排除项**——普通后代默认继承 Job，但 breakaway 进程不在保证范围。目标只在 Job 分配后启动；runner 若在 create-to-assignment 极窄区间遭外力终止，可能留下 suspended target。
- **Windows 终端信号是控制台级的**——SIGINT 以 `\x03` Ctrl-C 输入写入投递，由控制台宿主（Windows 上为 node-pty 自带的 OpenConsole）转为控制台级 CTRL_C 事件；SIGTSTP 与 SIGHUP 被拒绝（不可用）；不带 `/F` 的 `taskkill` 无法终止控制台进程，因此拆卸的 TERM 档是 `/F` 升级前的宽限等待。Windows 就绪没有精确的 stdin-wait 档：prompt-marker 快路径把 shell pid 作为伪前台进程组比较，其余由静默与计时档覆盖。
- **Windows 终端分配依赖 node-pty 自带的控制台宿主资产**——每个 Windows 终端都以 `useConptyDll: true` 启动，分配时按 node-pty 自身 addon 的相对位置解析 `conpty/conpty.dll` 与 `OpenConsole.exe`；资产缺失或解包错误会让 `spawnTerminal` 抛错，而不是回退到操作系统控制台宿主。node-pty 把该选项标为实验性，升级 node-pty 可能改变这一行为。见[自带控制台宿主说明](../../../.agents/notes/implemented/bug-fix/2026-09-28-pty-bundled-console-host.zh.md)。
- **fallback 终端 ownership 仍依赖观察**——在 macOS 或缺少可用 user-systemd 的 Linux 上，子进程如果在任何前台检查快照之前重新设定父进程，或离开自有终端会话，就可能逃出进程表扫描。本地提供方不会新增持续进程表监视器；受支持的 Linux native 模式改由 scope membership 持有这些后代。
- **进程内清理要求退出阶段仍能执行 JavaScript**——直接 `process.exit()`、默认未捕获异常和默认未处理 rejection 会发出 Node 同步 `exit` 事件。未安装 handler 时，`SIGTERM`、`SIGINT` 或 `SIGHUP` 的默认 OS 处置不会发出该事件；应用只有安装执行正常 dispose 或调用 `process.exit()` 的 handler 才能覆盖这些信号。`SIGKILL`、fatal OOM、`process.abort()`、native crash、断电，以及任何无法运行 JavaScript 的故障，都需要外部 supervisor、容器 init 或等价的 OS owner 负责。
- **凭据清除依赖名称启发式规则**——只匹配 `*KEY*`／`*PASSWORD*`／`*SECRET*`／`*TOKEN*`；名称不同的 secret（例如 `*PASSPHRASE*`）会继续传递，对误删变量引入白名单属于已记录的后续工作。
- **不会删除已完成的 spill 文件**——有界的完整输出恢复文件会在 OS tmpdir 下累积，直到外部机制进行清理；每进程私有 spill 目录仅在未持有任何已完成 spill 文件时于 JavaScript 可观察的退出阶段删除。
- **被删除的 spill 目录不会重建**——每进程私有目录只创建一次；被外部清理工具删除后，该进程内之后的每次 spill 都降级为内存尾部并记录一条 `error`，直到宿主重启。在 `ENOENT` 时重新创建一个新的随机目录是待办工作。

---

## 📊 指标

通过消费方 seam（例如 bash 执行器家族）间接影响，它们负责所 spawn 进程的输出与生命周期的全部面向模型渲染。

#### KV Cache 影响

不会直接导致 KV Cache 失效；请求前缀变更由上述消费方负责。

---

## 🏛️ 设计

<details>
<summary>实现细节——点击展开</summary>

本节解释提供方背后的设计决策，并指出实现它们的代码位置；可观察行为已在[使用本包](#use-this-package)中说明。

### 设计理念

每次 spawn 都为信号发送与完全停稳选择同一个 owner。受支持的 Linux 普通命令与终端启动使用临时 user-systemd scope，受支持的 Windows 普通命令使用由 helper 持有、关闭时终止成员的 Job。macOS、旧版或不可用的 user-systemd，以及不可用的 Windows 原生支持使用既有 detached 进程组、`taskkill` 或终端会话观察，并只告警一次。native 路径可能已经启动命令后，本提供方绝不会通过 fallback 重放该命令。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务接线：存活句柄集合、dispose、宿主退出最终清理、可执行文件查找 |
| [`src/spawn.ts`](src/spawn.ts) | 共享进程管道：直接结果、保尾收集、spill 文件与 fallback spawn |
| [`src/managed-owner.ts`](src/managed-owner.ts) | 每个普通句柄使用的私有信号与等待 owner |
| [`src/linux-scope.ts`](src/linux-scope.ts) | Linux user-systemd 能力检查、scope 启动、信号发送与完全停稳 |
| [`src/linux-execve.ts`](src/linux-execve.ts) | Linux libc 进程映像替换与继承标准文件描述符保留 |
| [`src/windows-job.ts`](src/windows-job.ts) | Windows Job 能力检查与 helper 启动 |
| [`src/runner-launch.ts`](src/runner-launch.ts) | source、built 与 packaged 私有 runner 选择 |
| [`src/spawn-runner.ts`](src/spawn-runner.ts) | Linux 一次性 exec bootstrap 与 Windows Job runner |
| [`src/runner-protocol.ts`](src/runner-protocol.ts) | 严格定义的 Linux launch／startup 文件与 Windows IPC 消息 |
| [`src/terminal.ts`](src/terminal.ts) | `node-pty` 终端句柄：Linux scope 绑定、前台检查与 fallback 清理 |
| [`src/process-inspector.ts`](src/process-inspector.ts) | POSIX 进程树与会话检查 |
| [`src/windows-inspector.ts`](src/windows-inspector.ts) | 经 koffi 的 Windows Toolhelp32 进程表检查 |

### 主流程

一次 spawn 会同步校验最终 argv、cwd 与环境，在用户命令可能运行前选择 containment，并在目标身份保持私有的情况下返回句柄。Linux 普通命令与终端启动使用私有的一次性请求；scope 内的 bootstrap 会恢复目标 cwd 与环境、解析可执行文件、清除 fd 0 至 fd 2 及可选控制 fd 7 的 close-on-exec 标记，再以原始 argv 进入 libc `execve()`。Windows 普通命令会隔离 runner 的 fd 0 至 fd 2、把 fd 3 留给 IPC，并用 fd 4 至 fd 6 承载 target stdio，在请求控制时还使用 fd 7；runner 把这些 CRT 描述符解析成 OS handle，以 suspended 状态创建 target，将其加入 Job、恢复运行，再关闭自身的标准流载体及可选 fd-7 载体。`done` 会在 direct command 及其 stdio 屏障结算后完成，`waitForExit()` 则分别等待所选 scope、Job、进程组或已观察会话变空。

### 安全不变式

spill 文件以 `0600` 权限、`O_EXCL` 与随机名称在 `0700` 每进程目录下创建，可抵御共享临时目录中的符号链接植入；打开、追加或最终关闭失败时不公布 spill 路径，且绝不中断收集，因为收集运行在流的 `'data'` 监听器内，抛出的错误会杀死宿主进程。fallback 进程身份携带启动时间，因此清理绝不会跟随 PID 复用。选定的 native 路径失败时会报告错误，而不会通过 fallback 重放 argv；受管范围只有在清理完成后才从存活集合移除，否则失败仍保持可观察。宿主退出最终清理不创建 Promise 或定时器，保留宿主退出码与诊断，分别包含每个目标的失败，也不会声称已经完全停稳。

</details>

---

## 📁 目录

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务接线：存活句柄集合、dispose、宿主退出最终清理、可执行文件查找 |
| [`src/spawn.ts`](src/spawn.ts) | 共享进程管道：直接结果、保尾收集、spill 文件与 fallback spawn |
| [`src/managed-owner.ts`](src/managed-owner.ts) | 每个普通句柄使用的私有信号与等待 owner |
| [`src/linux-scope.ts`](src/linux-scope.ts) | Linux user-systemd 能力检查、scope 启动、信号发送与完全停稳 |
| [`src/linux-execve.ts`](src/linux-execve.ts) | Linux libc 进程映像替换与继承标准文件描述符保留 |
| [`src/windows-job.ts`](src/windows-job.ts) | Windows Job 能力检查与 helper 启动 |
| [`src/runner-launch.ts`](src/runner-launch.ts) | source、built 与 packaged 私有 runner 选择 |
| [`src/spawn-runner.ts`](src/spawn-runner.ts) | Linux 一次性 exec bootstrap 与 Windows Job runner |
| [`src/runner-protocol.ts`](src/runner-protocol.ts) | 严格定义的 Linux launch／startup 文件与 Windows IPC 消息 |
| [`src/terminal.ts`](src/terminal.ts) | `node-pty` 终端句柄：Linux scope 绑定、前台检查与 fallback 清理 |
| [`src/process-inspector.ts`](src/process-inspector.ts) | POSIX 进程树与会话检查 |
| [`src/windows-inspector.ts`](src/windows-inspector.ts) | 经 koffi 的 Windows Toolhelp32 进程表检查 |

---

## 🔗 资源

当提供方级约定不够用时阅读以下页面。它们从穷尽式类型参考逐步进入抽象约定，以及宿主机制背后的决策。

- [子进程子系统](../../../docs/subsystems/subprocess.zh.md)——spawn spec、输出读取器、结果与完整的 `DSH_*` 环境。
- [dsh-subprocess](../subprocess/README.zh.md)——本提供方实现的抽象约定。
- [dsh-bash-local](../../shell/bash-local/README.zh.md)——最大的消费方及其请求的具体 stdio 形态。
- [subprocess seam Agent Note](../../../.agents/notes/archived/architecture/2026-07-26-subprocess-seam.md)——进程部分为何成为独立的 seam。
- [同步子进程退出清理](../../../.agents/notes/archived/bug-fix/2026-08-11-synchronous-subprocess-exit-cleanup.md)——宿主退出最终清理决策及其失败模式。

-----

终端分配通过 TERM 和 node-pty 使用调用者指定的 `terminalType`。动态 resize 更新已有 PTY。输出背压会暂停原生读取，待消费者排空后恢复；显式终止会恢复暂停的读取，以接收退出通知。

---

## 🚀 快速开始

### 配置

```yaml
- name: '@deepseek-ai/dsh-subprocess-local'
- name: '@deepseek-ai/dsh-bash-local'
```

### 参数

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务接线：存活句柄集合、dispose、宿主退出最终清理、可执行文件查找 |
| [`src/spawn.ts`](src/spawn.ts) | 共享进程管道：直接结果、保尾收集、spill 文件与 fallback spawn |
| [`src/managed-owner.ts`](src/managed-owner.ts) | 每个普通句柄使用的私有信号与等待 owner |
| [`src/linux-scope.ts`](src/linux-scope.ts) | Linux user-systemd 能力检查、scope 启动、信号发送与完全停稳 |
| [`src/linux-execve.ts`](src/linux-execve.ts) | Linux libc 进程映像替换与继承标准文件描述符保留 |
| [`src/windows-job.ts`](src/windows-job.ts) | Windows Job 能力检查与 helper 启动 |
| [`src/runner-launch.ts`](src/runner-launch.ts) | source、built 与 packaged 私有 runner 选择 |
| [`src/spawn-runner.ts`](src/spawn-runner.ts) | Linux 一次性 exec bootstrap 与 Windows Job runner |
| [`src/runner-protocol.ts`](src/runner-protocol.ts) | 严格定义的 Linux launch／startup 文件与 Windows IPC 消息 |
| [`src/terminal.ts`](src/terminal.ts) | `node-pty` 终端句柄：Linux scope 绑定、前台检查与 fallback 清理 |
| [`src/process-inspector.ts`](src/process-inspector.ts) | POSIX 进程树与会话检查 |
| [`src/windows-inspector.ts`](src/windows-inspector.ts) | 经 koffi 的 Windows Toolhelp32 进程表检查 |

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-subprocess-local
