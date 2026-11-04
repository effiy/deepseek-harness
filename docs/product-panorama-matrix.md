# DSH 产品全景矩阵

> 梳理时间：2026-11-04 | 梳理人：产品管家·招财
> 覆盖范围：`packages/` · `docs/subsystems/` · `.agents/notes/` · `packages/experimental/`

---

## 概览

| 维度 | 数量 |
|:--|--:|
| 📦 核心包 (`packages/`) | 50+ |
| 📖 已文档化子系统 (`docs/subsystems/`) | 66 |
| ✅ 已交付功能（implemented feature notes） | 34 |
| 📝 规划中功能（proposed feature） | 10 |
| 🏗️ 规划中架构变更（proposed architecture） | 13 |
| 🧪 实验性功能（`packages/experimental/`） | 47 |
| ✂️ 规划中简化（proposed simplification） | 9 |
| 🐛 待修复 Bug（proposed bug-fix） | 1 |
| 🧪 规划中测试提升 | 2 |

---

## 一、核心 Agent 基础设施

| 功能 | 状态 | 来源 |
|------|:--:|------|
| Agent 接口与生命周期 (`dsh-core-agent`) | ✅ | packages |
| Agent Loop 默认驱动 (`dsh-core-agent-loop`) | ✅ | packages |
| Session 追加日志与内存存储 | ✅ | packages |
| System Prompt 组装 | ✅ | packages |
| Tool 注册与执行管线 | ✅ | packages |
| Scope 化注册原语 | ✅ | packages |
| 并行工具调用执行 | ✅ | feature note |
| Tool 执行前重写机制 | 📝 | proposed |
| 可回溯压缩（Recallable Compaction） | 📝 | proposed |
| Task Surface 结构化交互 | 📝 | proposed |

## 二、LLM / 模型适配

| 功能 | 状态 | 来源 |
|------|:--:|------|
| 消息与流式词汇 + 适配器接缝 | ✅ | packages |
| DeepSeek Messages 适配器 | ✅ | feature note |
| Token 计量 | ✅ | subsystem |
| 流式 LLM 协议 | ✅ | subsystem |
| Agent 步骤内 System Prompt 替换 | ✅ | feature note |
| Context Form 词汇 | ✅ | feature note |

## 三、会话与持久化

| 功能 | 状态 | 来源 |
|------|:--:|------|
| 持久化存储 | ✅ | packages |
| Session 查询/浏览/导出 (`dsh-session-query`) | ✅ | packages |
| 跨进程 Session 写入租约 | ✅ | feature note |
| Session Inspector | ✅ | feature note |
| 归档停止运行中工作 | ✅ | feature note |
| 归档读取已存储任务 | ✅ | feature note |
| Session 投影与命令日志 | 📝 | proposed |
| 逻辑 Session 存储重建 | 📝 | proposed |
| Session 能力协议 | 📝 | proposed |
| Session 数据兼容 | 📝 | proposed |
| Session 迁移跟随重定向 | 📝 | proposed |

## 四、执行引擎

| 功能 | 状态 | 来源 |
|------|:--:|------|
| Shell 命令执行 (`dsh-shell`) | ✅ | packages |
| 子进程管理 (`dsh-subprocess`) | ✅ | packages |
| SSH 执行 (`dsh-ssh`) | ✅ | packages |
| 终端管理 (`dsh-terminal`) | ✅ | packages |
| PTC 运行时 (`dsh-ptc-runtime`) | ✅ | packages |
| PTC 类型化工具返回 | ✅ | feature note |
| 持久 PTY 会话 | ✅ | feature note |
| LSP 集成 (`dsh-lsp`) | ✅ | packages |

## 五、UI / 客户端

| 功能 | 状态 | 来源 |
|------|:--:|------|
| Web 客户端 (`apps/web`, `packages/client`) | ✅ | subsystem |
| Web 服务端 | ✅ | subsystem |
| Desktop 应用 (`apps/desktop`) | ✅ | subsystem |
| Desktop 主运行时 | ✅ | feature note |
| Desktop 浏览器 WebView | ✅ | feature note |
| 右侧边栏停靠基础设施 | ✅ | feature note |
| Web 侧边栏终端 | ✅ | feature note |
| 侧边栏浏览器 | ✅ | feature note |
| 侧边栏文件/目录自动刷新 | ✅ | feature note |
| 对话 UI | ✅ | subsystem |
| 用户问题面板 | ✅ | subsystem |
| 消息编辑/删除 UI | 📝 | proposed |
| 交互式侧会话与合并 | 📝 | proposed |
| 语音输入 | 🧪 | experimental |
| 办公文件转 PDF | ✅ | subsystem |
| Excel 预览 | ✅ | feature note |

## 六、安全与沙箱

| 功能 | 状态 | 来源 |
|------|:--:|------|
| 沙箱 (`dsh-sandbox`) | ✅ | packages |
| Guard 守护 (`dsh-guard`) | ✅ | packages |
| 批准机制（Approval Seam） | ✅ | feature note |
| 凭证管理 (`dsh-credentials`) | ✅ | packages |
| 权限预设 | ✅ | subsystem |
| Windows ACL 受限令牌沙箱 | ✅ | feature note |
| Windows ACL 强制完整性限制 | ✅ | feature note |
| 产品 Subagent 非交互权限 | ✅ | feature note |
| 用户授权 Subagent 模型路由 | ✅ | feature note |
| Auto-Review 用户批准回退 | ✅ | feature note |

## 七、协作与 Multi-Agent

| 功能 | 状态 | 来源 |
|------|:--:|------|
| Agent Teams | ✅ | feature note |
| Subagent 委派 (`dsh-subagent`) | ✅ | packages |
| Subagent 角色/工具过滤与深度 | ✅ | feature note |
| 可延续 Subagent 对话 | ✅ | feature note |
| 反馈机制 (`dsh-feedback`) | ✅ | subsystem |
| 交互机制 (`dsh-interaction`) | ✅ | subsystem |
| Agent Team 实验性增强 | 🧪 | experimental |

## 八、工作区与文件

| 功能 | 状态 | 来源 |
|------|:--:|------|
| 文件系统访问 (`dsh-fs`) | ✅ | packages |
| 附件 (`dsh-attachment`) | ✅ | packages |
| 工作区 (`dsh-workspace`) | ✅ | packages |
| 通用文件上传 | ✅ | feature note |
| 展示工作区源文件 | ✅ | feature note |
| 显式工作树创建 | ✅ | feature note |
| 交付物（Deliverables） | ✅ | subsystem |
| 附件读取隔离 | 🐛 | proposed bug-fix |

## 九、集成与外部工具

| 功能 | 状态 | 来源 |
|------|:--:|------|
| MCP 服务器 | ✅ | packages |
| Web 搜索/抓取 | ✅ | packages |
| 浏览器使用 | ✅ | packages |
| 计算机使用 | ✅ | packages |
| Webhook | 🧪 | experimental |
| GitHub Webhook | 🧪 | experimental |
| Claude Code 修改 | ✅ | subsystem |
| Claude Code Hooks | 🧪 | experimental |
| Codex Hooks | 🧪 | experimental |
| Hook 协议 | 🧪 | experimental |

## 十、SDK 与开发

| 功能 | 状态 | 来源 |
|------|:--:|------|
| TypeScript SDK | ✅ | packages |
| Python SDK | ✅ | subsystem |
| CLI 工具 | ✅ | subsystem |
| 扩展机制 (`dsh-extensions`) | ✅ | packages |
| Skill 加载 (`dsh-skill`) | ✅ | packages |
| 配置文件 Schema 验证 | ✅ | feature note |
| Pi 扩展桥接（11,000+ npm 包兼容） | 📝 | proposed |
| Pi 插件兼容分级支持 | 📝 | proposed |
| 插件市场索引格式 | 📝 | proposed |

## 十一、运维与部署

| 功能 | 状态 | 来源 |
|------|:--:|------|
| Boot 启动 | ✅ | packages |
| Profiles 与 Bundles | ✅ | architecture |
| Preset 组合 | ✅ | packages |
| 插件管理 | ✅ | architecture |
| 遥测（Telemetry） | ✅ | subsystem |
| OpenTelemetry | ✅ | subsystem |
| Desktop 强制更新 API | 📝 | proposed |
| Desktop 更新策略与安装 | 📝 | proposed |
| Desktop 更新后续扩展 | 📝 | proposed |

## 十二、任务与计划

| 功能 | 状态 | 来源 |
|------|:--:|------|
| Todo 任务 (`dsh-todo`) | ✅ | packages |
| Plan 规划 (`dsh-plan`) | ✅ | packages |
| Goal 目标 (`dsh-goal`) | ✅ | packages |
| Schedule 调度 (`dsh-schedule`) | ✅ | packages |
| Jobs 后台任务 (`dsh-jobs`) | ✅ | packages |
| Workflow 工作流 (`dsh-workflow`) | ✅ | packages |

## 十三、实验性功能（`packages/experimental/`）

| 功能 | 描述 |
|------|------|
| 语音转文字（SenseVoice） | 多语种语音识别 → 模型输入 |
| Inspector | DSH 内部状态检查器 |
| Session Search | 跨 Session 全文搜索 |
| Session Inspector | Session 数据可视化 |
| Agent Team 配置 | Agent Team 组合预设 |
| Ralph Loop | 替代 Agent Loop 实现 |
| Badge Skill Bundle | AI Skill 打包和分发 |
| WebWorker 运行时 | 浏览器端隔离执行环境 |
| 浏览器 Playwright/Stagehand MCP | 浏览器自动化集成 |
| 计算机使用 CUA Driver | 本地/远程桌面操控 |
| Claude Code Mods | Claude Code 修改桥接 |
| 翻译器 | 多语种翻译工具 |
| Terminal Bundle | 终端增强包 |
| 自动 Review | AI 自动代码审查 |
| Skill Badge | Skill 能力标记 |
| Voice Input Bundle | 语音输入增强 |
| Webhook | 外部 Webhook 集成 |
| Worktree | 工作树管理 |
| WebWorker Packer | Worker 打包工具 |
| Hook Protocol | 模型交互钩子协议 |

---

## 📊 统计数据

| 状态 | 数量 | 占比 |
|:--|--:|--:|
| ✅ 已交付（核心能力） | ~56 | 基准 |
| 📝 规划中（Agent Notes） | ~23 | — |
| 🧪 实验性（experimental/） | 47 | — |
| 🐛 待修复 | 1 | — |

---

## 🔑 关键洞察

### 1. 压缩（Compaction）是最大单点风险
核心基础设施已交付，但"可回溯压缩"仍为 proposed 状态。当前压缩不可逆——被摘要遮蔽的内容模型无法访问，重复压缩进一步加剧 prompt-cache miss 和摘要质量退化。

### 2. Desktop 更新链路
3 个 proposed 互相依赖：强制更新 API → 策略安装 → 后续扩展。需协同推进，初期可先完成最基础的强制更新 API。

### 3. Pi 生态兼容战略价值高
2 个 proposed 瞄准 11,000+ npm 包的扩展/插件兼容。可实现性取决于桥接层复杂度，建议分阶段：先做扩展桥接基础，再做插件兼容。

### 4. 实验性模块积压严重
47 个实验性包中 voice-input、webhook、inspector、auto-review 等已有较成熟形态。建议建立"实验→稳定"转正评估机制，每季度评估一批。

### 5. 文档覆盖率优秀
66 个子系统文档覆盖几乎所有核心包，体现了团队对文档纪律的重视。与 50+ 核心包的映射关系清晰。

### 6. 当前通宵冲刺重点
- DSH 移动端优化：响应式断点、触控适配、离线缓存、暗黑模式审计
- YiVad 页面管理：竖屏适配、ProTable 迁移、暗黑 token 交叉审计
- 跨项目对齐：断点体系统一、暗黑模式对标、DSH Bridge 稳定性

---

*关联文档*：`YiKnowledge/roles/product/reports/overnight-delivery-manifest-2026-11-04.md`（通宵交付清单）