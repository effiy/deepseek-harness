---
title: "@deepseek-ai/dsh-settings"
tags: []
category: "settings"
created: 2025-01-01
updated: 2026-10-20
source: external
type: index
status: stable
lifecycle: active
---

## 💡 概述

编辑插件通过 `.volatile()` 声明的字段，并查看其实际值。表单以 profile 条目 id 标识插件、保留秘密值，并拒绝过期写入。更改通过当前 profile 的 Cordis patch 持久化。

---

## ⚡ 功能

### 限制

- 嵌套 Include 独立拥有配置，不能通过当前 profile 的表单编辑。
- 字段重置恢复继承值，不能删除下层配置提供的值。取消设置数组索引会移除该元素。

---

## 📊 指标

通过面向模型的插件读取的配置值间接影响模型。

#### KV Cache 影响

改变请求前缀的消费者决定缓存影响。

## 已知限制与延后工作

---

## 🏛️ 设计

<details>
<summary>实现内部细节——点击展开</summary>

[表单投影](src/schema.ts) 去除运行时引用和普通字段。[服务](src/index.ts) 提供带修订号的描述符，在委托持久化前按完整插件 Config 验证编辑。业务插件直接读取自己的 Config 引用。

秘密角色从实际值、继承值、profile 覆盖值和 schema 默认值中隐藏；客户端接收存在性标记。路径编辑保留客户端未收到的字段。

</details>

---

## 📁 目录

「待补充」

---

## 🔗 资源

- [设置参考](../../../docs/subsystems/settings.zh.md)——表单值与修改。
- [Volatile 配置](../../../vendor/loader/README.md)——引用生命周期与通知。
- [配置编辑器](../../boot/config-editor/README.zh.md)——持久化与重载顺序。

---

## 🚀 快速开始

### 配置

```yaml
- id: settings
  name: '@deepseek-ai/dsh-settings'
```

---

## ⚙️ 技术栈

**npm**: @deepseek-ai/dsh-settings
