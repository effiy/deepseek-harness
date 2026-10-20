---
title: "@deepseek-ai/dsh-http-proxy"
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

使用本包可为采用 Node 内置 `fetch` 的 Harness 请求应用一份出站 HTTP 代理策略，包括 LLM（大语言模型）、web 搜索与 HTTP MCP 流量。启动器只读取一次标准代理环境变量，普通 `fetch` 调用方无需额外引入或改动。loopback 流量保持直连；不受支持的代理 URL 会被报告，并针对受影响的协议跳过。公共辅助函数可让调用方路由采用自有代理设置的传输、准备子进程环境，或为隔离回放清除代理变量。

---

## ⚡ 功能

### 限制

这些限制界定了本包不适用的场景，属于当前的包级约束。

- **不支持 SOCKS、PAC 或操作系统代理探测**——只接受来自环境的 `http(s)://` 代理 URL。不会读取 macOS 或 Windows 的系统代理设置，因此仅在代理软件里拨了开关的用户仍须导出环境变量；SOCKS URL 会被报告，且该协议保持直连，不会借用另一协议的代理。
- **不支持自定义证书颁发机构**——做 TLS 拦截的企业代理需要在启动前为进程设置 `NODE_EXTRA_CA_CERTS`，本包既不设置也不校验它。
- **spawn 出的子进程只在足够新的运行时上遵循策略，且仅当它继承的每个值都是 Node 接受的**——它通过 Node 的 `NODE_USE_ENV_PROXY` 读取已发布的环境（22.21+、24+），而 engines 范围允许 22.19 与 22.20，在这两个版本上这样的子进程保持直连。若用户环境里还有 SOCKS 或其他被拒的代理，所有子 Node 都保持直连：不设置该标志，子进程才起得来。子进程还会按 Node 自己的 `NO_PROXY` 规则匹配绕过条目，其分隔符与 IPv4 区间处理与本包不同。本进程内不依赖任何 Node 版本：每一次进程内请求都会落到全局 dispatcher。
- **遥测按设计直连**——OTLP 导出器通过 `node:http` 投递，全局 dispatcher 触及不到。要让它走代理，要么依赖 `http.Agent` 的 `proxyEnv`，而该选项晚于本项目支持的最低 Node 版本；要么改用 SDK 的 `fetch` 传输，但它没有压缩能力，而随附配置启用了 gzip。遥测是唯一一条丢失后不会让用户付出任何代价的通道，因此维持原状；`DSH_TELEMETRY_MODE=DISABLED` 可关闭它。
- **模型编写的程序不接收代理配置**——Node ptc-runtime 进程与 workflow worker 不继承可能含有 `user:password` 的代理 URL。其直接请求需要自行配置，并继续受到执行沙箱的约束。
- **防回归门禁只看源码，看不到依赖内部**——`verify-no-bare-dispatcher` 解析 `packages/*/*/src` 与 `apps/*/src`；测试、脚本以及第三方 SDK 的内部都在其之外。这正是每个出网点还各配一份 `egress.spec.ts` 的原因。

---

## 📊 指标

无。本包只承担传输策略：它改变字节如何抵达网络，不注册任何提示词、schema 或结果文本。

#### KV Cache 影响

不会直接失效：本包不贡献任何请求 token，也从不改变请求前缀，因此提供方缓存复用不受影响。

---

## 🏛️ 设计

### 设计理念

**一次解析，一个匹配器。** `proxyForUrl()` 与已安装的 dispatcher 绝不能对同一个 URL 给出不同答案，否则 `dsh-web-fetch-http` 会把 dispatcher 本打算隧道转发的连接固定到某个地址上。因此该 dispatcher 是一个 `Agent`，其按 origin 调用的 `factory` 自身调用 `proxyForUrl()`，不存在可能与第一个解析器产生漂移的第二个解析器。undici 的 `EnvHttpProxyAgent` 在此无法胜任：没有 `HTTPS_PROXY` 时它让 `https:` 复用 HTTP 代理，于是本包在拒绝用户为该 scheme 指定的 URL 后本应保持直连的 scheme 仍会被隧道转发。

**子进程继承用户自己的值，以及用户未设置部分的解析结果。** 用户以任一大小写指定过的 scheme，会以他们书写的形式原样传给子进程，因此用户为 `curl` 设置的 SOCKS 代理绝不会被替换成为其他 scheme 指定的 HTTP 代理。两种大小写都未指定的 scheme 则携带解析值，否则子进程的路由会与父进程分歧：Node 的 `NODE_USE_ENV_PROXY` 不读 `ALL_PROXY`。绕过列表始终采用解析结果——它只会追加 loopback 条目，用户写下的内容不会丢失。让父子进程只有一个路由答案的代价是：`curl` 也会看到本包由 HTTP 代理推导出的 `https:` 代理。有一处例外是为了保护子进程自身：当子进程收到的某个值是本包拒绝过的——比如为 `curl` 保留的 SOCKS URL——就不再设置 `NODE_USE_ENV_PROXY`，因为 Node 在该标志下会在运行程序之前先解析 `HTTP_PROXY` 与 `HTTPS_PROXY`，遇到这类值直接退出。此时子 Node 直连（本进程已为该协议如此报告），而不是根本起不来。

### 源码地图

| 文件 | 承载 |
|---|---|
| `src/policy.ts` | 解析与绕过匹配；诊断只点名变量，从不带出它的值。不引入任何传输实现，因此在没有 undici 的环境中仍可加载。 |
| `src/install.ts` | 全局 dispatcher、生效策略记录、路由与子进程环境。动态引入 undici。 |
| `src/index.ts` | 本包的对外接口：四个函数与一个类型。 |

### 绕过匹配

一个条目写的是主机名，它连同其下所有子域名一起匹配：`NO_PROXY=example.com` 也会放行 `api.example.com`。前缀 `.` 或 `*.` 可以写，含义相同。条目可带 `:port`，`*` 则放行全部。带方括号与裸写的 IPv6 字面量都能匹配——裸写的 `::1` **不会**被读成主机 `:` 端口 `1`，而 undici 自带的匹配器正是这样出错的，这也是解析结果中同时携带 `::1` 与 `[::1]` 的原因。CIDR 不参与匹配：操作系统的绕过列表常含 `10.0.0.0/8`，必须改写成后缀形式。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>面向维护者的工作上下文——点击展开</summary>

userland undici 能触及 Node 内置的 `fetch`，依赖的是两者都会写入 legacy 的 `Symbol.for('undici.globalDispatcher.1')` 槽位。那是跨版本的隐式耦合，不是约定——参见 [corepack#834](https://github.com/nodejs/corepack/issues/834) 中它失效的实例。`tests/install.spec.ts` 断言真实请求会抵达一个 loopback 代理，因此破坏该耦合的版本升级会在那里失败，而不是流到线上。

</details>

---

## 📁 目录

| 文件 | 承载 |
|---|---|
| `src/policy.ts` | 解析与绕过匹配；诊断只点名变量，从不带出它的值。不引入任何传输实现，因此在没有 undici 的环境中仍可加载。 |
| `src/install.ts` | 全局 dispatcher、生效策略记录、路由与子进程环境。动态引入 undici。 |
| `src/index.ts` | 本包的对外接口：四个函数与一个类型。 |

---

## 🔗 资源

- [网络代理指南](../../../docs/user/guide/network-proxy.zh.md)——需要导出什么，以及为什么浏览器走代理而终端不走。
- [`dsh-web-fetch-http`](../../web/web-fetch-http/README.zh.md)——唯一一个安全规则会因代理而改变的消费方。

---

## 🚀 快速开始

无需挂载，也无需配置。`dsh` 启动器会在第一个插件加载之前，为每个 profile 解析并安装策略，因此导出了 `HTTPS_PROXY` 的用户在所有位置都会走代理。本包是库而非插件，因为传输策略每个进程只有一个答案：没有第二个实现可替换，也没有比进程更窄的作用域可赋予。

### 编写新的出站调用

普通 `fetch()` 会走代理，任何使用 `globalThis.fetch` 的 SDK 也一样——MCP HTTP 传输与 pi-ai 提供方栈都使用它。应验证每个 SDK 的实际传输；例外见[已知限制与延后工作](#known-limitations-and-deferred-w

...（详见功能章节）

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-http-proxy
