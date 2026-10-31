# 消息编辑/删除 UI 设计方案

- **日期**: 2026-10-30
- **状态**: 等待后端 API
- **依赖**: Session Controller `editMessage` / `deleteMessage` RPC 方法

## 概述

DS-Bot 聊天会话中用户能编辑和删除自己发送的消息。
- 长按/右键弹出操作菜单（编辑、删除）
- 编辑模式：消息原地变为可编辑输入框
- 删除：二次确认弹窗
- 仅对自己消息显示（桌面端+移动端）

## 架构

```
┌─ packages/client/ui-conversation ─────────────────────────┐
│  records.ts: UserMessageNode 新增 messageId 字段            │
│  message.ts: start() 传递 messageId                        │
└────────────────────────────────────────────────────────────┘
┌─ packages/client/ui-chat ─────────────────────────────────┐
│  register-node-renderers.ts:                                │
│    UserMessageNodeView 注册声明 children slot                │
│  MessageItem.tsx (UserMessageNodeView):                     │
│    - renderSlot('conversation.chat.user-actions', ...)      │
│  slots.ts: 声明 SlotMap['conversation.chat.user-actions']   │
└────────────────────────────────────────────────────────────┘
┌─ packages/client/ui-message-actions (新包) ───────────────┐
│  apply.ts: 注册 EditAction / DeleteAction 到 user-actions   │
│  组件: EditMessageInput, DeleteConfirmModal                 │
│  store: createMessageEditStore (编辑状态)                    │
│  locale.ts: 中/英文字典                                     │
└────────────────────────────────────────────────────────────┘
```

## 实施步骤

### 1. 数据层：UserMessageNode.messageId

**`packages/client/ui-conversation/src/client/contract/records.ts`**:
```typescript
export interface UserMessageNode {
  kind: 'user'
  messageId: MessageId  // ← 新增
  seq: number
  time: number
  content: readonly ContentBlock[]
  source: unknown
}
```

**`packages/client/ui-chat/src/client/conversation-nodes/message.ts`** start() 中 user 分支追加:
```typescript
{
  kind: 'user',
  messageId: event.data.id,  // ← 新增
  seq: event.seq,
  time: event.time,
  content: event.data.content,
  source: event.data.source,
}
```

### 2. Slot 声明

**`packages/client/ui-chat/src/client/contract/slots.ts`**:
```typescript
export interface UserMessageActionOwnerProps {
  messageId: MessageId
  text: string
}

// SlotMap:
'conversation.chat.user-actions': {
  kind: 'list'
  scope: 'session'
  owner: UserMessageActionOwnerProps
}
```

**`register-node-renderers.ts`**: UserMessageNodeView 注册追加 `children`:
```typescript
ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
  name: 'conversation.chat.node', key: 'user', locale: NS,
  children: {
    'conversation.chat.user-actions': { kind: 'list', scope: 'session' },
  },
}, UserMessageNodeView))
```

### 3. `UserMessageNodeView` 改造

**`MessageItem.tsx`**: 通过 `renderSlot` 渲染 user-actions，输出作为 `extraActions` 传入 `MessageIconActions`。

### 4. 新插件包

```
packages/client/ui-message-actions/
├── package.json
├── tsconfig.json / tsdown.config.ts
└── src/
    ├── index.ts
    └── client/
        ├── index.ts / apply.ts
        ├── locale.ts
        ├── store.ts          # createMessageEditStore
        ├── UserMessageActions.tsx
        ├── EditMessageInput.tsx
        ├── DeleteConfirmModal.tsx
        └── *.module.css
```

#### Store

```typescript
createSnapshotStore({
  editingMessageId: null as MessageId | null,
}, {
  beginEdit(id: MessageId),
  cancelEdit(),
})
```

#### Locale

| key | 中文 |
|-----|------|
| `message.edit` | 编辑 |
| `message.delete` | 删除 |
| `message.edit.save` | 保存 |
| `message.edit.cancel` | 取消 |
| `message.delete.confirm.title` | 删除消息 |
| `message.delete.confirm.body` | 确定要删除这条消息吗？此操作不可撤销。 |
| `message.delete.confirm.cancel` | 取消 |
| `message.delete.confirm.ok` | 删除 |

### 5. 后端 API 合约

```typescript
interface IConversation {
  editMessage(sessionId: SessionId, messageId: MessageId, text: string): Promise<void>
  deleteMessage(sessionId: SessionId, messageId: MessageId): Promise<void>
}
```

### 6. Bundle 注册

`web-app/cordis.patch.yml` + `package.json` dependency 追加新行。

## 交互设计

| 场景 | 触发 | 行为 |
|------|------|------|
| 桌面端 | 右键消息气泡 | `MenuSurface` 上下文菜单 |
| 移动端 | 长按 500ms | 底部 sheet / 居中菜单 |
| 编辑模式 | 点击"编辑" | textarea 替换消息文本 |
| 编辑提交 | Ctrl+Enter / 保存按钮 | 调用 API |
| 编辑取消 | Escape / 取消按钮 | 恢复原文本 |
| 删除 | 点击"删除" → 确认 | Modal 确认 → 调用 API |

## 移动端适配

- `pointer: coarse` 最小触摸目标 44×44px
- 长按 500ms + `navigator.vibrate(10)` 触觉反馈
- textarea 全宽 min-height 80px
- Modal 已适配移动端断点（之前 P1-3 修复）

## "自己消息"判断

`UserMessageNode.source.kind === 'user'` 即为人类用户消息。
`message.ts:76` 已将非 user source 路由到 context 节点，不会进入 UserMessageNodeView。
因此所有 `UserMessageNodeView` 渲染的消息都是"自己的"。