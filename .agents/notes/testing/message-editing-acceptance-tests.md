# 消息编辑/删除 功能验收用例

本文档是 GAP-01/02/03 的验收测试计划，待开发实现后执行。

---

## GAP-01：助手消息编辑入口（前端）

### 实现前提
- 后端 `messageUpdate` 已支持编辑 `assistant/message`（commands.ts:588-589）
- 前端需在 `packages/client/ui-message-actions/` 新增 `AssistantMessageActions` 组件
- Slot: `conversation.chat.assistant-actions`（对应现有 `conversation.chat.user-actions`）

### 验收用例

| # | 用例 | 测试类型 | 操作 | 预期结果 |
|---|---|---|---|---|
| 1.1 | 助手消息显示编辑按钮 | web snapshot | 打开有助手消息的会话，hover 助手消息行 | 助手消息行右侧出现编辑📝和删除🗑按钮（与用户消息一致） |
| 1.2 | 行内编辑助手消息 | web snapshot | 点击助手消息的编辑按钮 | 助手消息内容切换为 `EditMessageInput` textarea，预填当前内容 |
| 1.3 | 保存编辑（Ctrl+Enter） | web e2e | 在 textarea 中修改内容，按 Ctrl+Enter | 调用 `remote.session.message-update`，编辑模式关闭，消息内容更新 |
| 1.4 | 取消编辑（Escape） | web e2e | 在 textarea 中修改内容，按 Escape | 编辑模式关闭，消息内容恢复原样 |
| 1.5 | 空内容拒绝 | unit (client) | 清空 textarea 所有内容，按 Ctrl+Enter | 不允许提交（必填校验），或后端返回 `gateway/bad-request` |
| 1.6 | 纯空白拒绝 | unit (client) | 填入全空白字符串，按 Ctrl+Enter | 不允许提交，或后端返回 `gateway/bad-request` |
| 1.7 | 删除助手消息（单条） | web e2e | 点击助手消息的删除按钮，确认删除 | 调用 `remote.session.message-delete`（不带 cascade），消息消失 |
| 1.8 | 右键菜单入口 | web e2e | 右键点击助手消息行 | 弹出菜单包含「编辑」「删除」选项 |
| 1.9 | 长按菜单入口（触屏） | web snapshot | 模拟长按助手消息行 | 弹出菜单包含「编辑」「删除」选项 |
| 1.10 | 权限校验：非 owner 不可编辑 | unit (client) | 非本 session owner 点击编辑 | 按钮不可见或 disabled |

### 现有测试复用
- `apps/web/tests/message-actions.e2e.ts` 需更新：新增助手消息编辑/删除场景
- `packages/api/session-controller/tests/commands-message-edit.host.spec.ts` 第 4 个 `messageUpdate` 测试已覆盖 assistant/message 编辑

---

## GAP-02：附件编辑支持（后端 + 前端）

### 实现前提
- 后端 `SessionMessageUpdateRequest.content` 当前类型为 `TextBlock[]`，需扩展为包含 `ImageBlock | FileBlock`
- 前端编辑器需支持附件替换/追加

### 验收用例

#### 后端 API（host spec）
| # | 用例 | 类型 | 输入 | 预期 |
|---|---|---|---|---|
| 2.1 | 编辑为纯图片内容 | host spec | `messageUpdate({ content: [{ type: 'image', attachment: {...} }] })` | 成功，追加 `user/message` replace shadow |
| 2.2 | 编辑为文本+图片混合 | host spec | `messageUpdate({ content: [{ type: 'text', text: '看看这个' }, { type: 'image', attachment: {...} }] })` | 成功 |
| 2.3 | 编辑为文件附件 | host spec | `messageUpdate({ content: [{ type: 'file', attachment: {...} }] })` | 成功 |
| 2.4 | 附件引用校验 | host spec | `messageUpdate` 带未上传的 attachment ref | `session/attachment-invalid` |
| 2.5 | 空内容拒绝（无文本无附件） | host spec | `content: []` 或仅有空 block | `gateway/bad-request` |
| 2.6 | 模型能力校验 | host spec | 编辑为图片但当前模型不支持 image input | `session/attachment-invalid` (MODEL_DOES_NOT_SUPPORT_IMAGES) |

#### 前端（web e2e）
| # | 用例 | 类型 | 操作 | 预期 |
|---|---|---|---|---|
| 2.7 | 编辑消息时追加图片 | web e2e | 进入编辑模式，通过附件按钮上传图片 | 图片出现在编辑区，提交后消息显示新图片 |
| 2.8 | 编辑消息时替换附件 | web e2e | 原生带图片的消息 → 编辑 → 删除旧图片 → 追加新图片 → 提交 | 旧图片消失，新图片显示 |
| 2.9 | 编辑消息时追加文件 | web e2e | 进入编辑模式，上传文件附件 → 提交 | 消息显示文件附件卡片 |

---

## GAP-03：编辑历史 / 撤销支持（全栈）

### 实现前提
- Session 日志中 edit/delete 操作以 `surfaceOp: { op: 'replace' }` 记录
- 需在 UI 层实现 undo（移除 replace shadow）+ 后端可能需支持 `messageRevert` API

### 验收用例

| # | 用例 | 类型 | 操作 | 预期 |
|---|---|---|---|---|
| 3.1 | 撤销编辑恢复原文 | web e2e | 编辑消息 → 提交 → 点击 Undo | 消息恢复编辑前的原文 |
| 3.2 | 撤销删除恢复消息 | web e2e | 删除消息 → 点击 Undo（限时内） | 消息重新出现 |
| 3.3 | 撤销提示自动消失 | web e2e | 编辑/删除后不点击 Undo，等待 5 秒 | Undo 提示自动消失，操作不可撤销 |
| 3.4 | 多步编辑撤销链 | web e2e | 编辑消息 A → 编辑消息 B → Undo → Undo | 先恢复 B，再恢复 A（LIFO） |
| 3.5 | 级联删除撤销 | web e2e | 级联删除一轮对话 → Undo | 用户消息和助手消息一起恢复 |

---

## 回归检查清单

每次修改触及消息编辑功能时，以下测试必须保持通过：

| 现有测试 | 文件 | 覆盖 |
|---|---|---|
| messageDelete 单条删除 | `commands-message-edit.host.spec.ts` | ✅ |
| messageDelete 级联删除 | `commands-message-edit.host.spec.ts` | ✅ |
| messageDelete 非法 seq | `commands-message-edit.host.spec.ts` | ✅ |
| messageDelete 非 surface 事件 | `commands-message-edit.host.spec.ts` | ✅ |
| messageUpdate 内容更新 | `commands-message-edit.host.spec.ts` | ✅ |
| messageUpdate 空内容拒绝 | `commands-message-edit.host.spec.ts` | ✅ |
| UserMessageActions 渲染 | `ui-message-actions` 组件测试 | ✅ |
| 快捷键对话框中的编辑/删除绑定 | `apps/web/tests/shortcuts.e2e.ts` | ✅ |

---

*创建时间: 2026-11-02 · 功能测试·鉴真·DSH*