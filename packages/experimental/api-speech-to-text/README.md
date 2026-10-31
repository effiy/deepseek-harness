---
title: "experimental-api-speech-to-text"
tags: ["deepseek-harness", "experimental", "api-speech-to-text"]
category: "实验性"
created: "2025-01-01"
updated: "2026-10-20"
source: external
type: index
status: stable
lifecycle: active
---

# experimental-api-speech-to-text

💡 概述
`speech` Remote 将浏览器录音连接至 `ctx.speechToText`，提供 Provider 发现和完整录音转写调用。


---

⚡ 功能
「待补充」

---

📊 指标
无，因为录音与准备不进入模型请求；之后的文字由普通用户提交拥有。


---

🏛️ 设计
<details>
<summary>维护者信息 — 点击展开</summary>

`catalog()` 暴露 Provider 标识、默认选择与录音限制。`transcribe()` 在解析指定 Provider 前校验规范 base64 与 16 kHz 单声道 PCM16 WAV。现有网关负责认证和取消传输。音频是临时数据，不成为 Session 事件或附件；只有用户之后的普通提交才记录识别文字。

`follow()` 推送包含准备状态和当前偏好的完整目录。`prepare()` 启动或加入 Host 任务；`cancelPreparation()` 显式取消任务。`configure()` 持久化传入的偏好字段。观察连接断开不会取消准备。

</details>

##### KV 缓存影响
没有直接影响；普通提交拥有消息内容。

### 已知限制与后续工作
- 不提供文件上传、持久化转写历史或流式协议。Base64 会增加传输开销；录音受公布的限制约束。

#### 开发备注
<details>
<summary>维护者信息 — 点击展开</summary>

无。

</details>


---

📁 目录
### 使用此包
与语音服务定义和 Typert 组合。`maxAudioBytes` 与 `maxDurationSeconds` 限制接收的录音。浏览器 UI 启用时挂载本包生成的 `/remote` 贡献。

`prepare(providerId, { downloadSource })` 将公布的一个下载源转发给提供方，省略时保留其配置策略。目录通过 `downloadSources` 提供选择器选项。提供方拒绝不可用的源，以及对进行中任务的源变更。


---

🔗 资源
[语音输入子系统](../../../docs/subsystems/voice-input.zh.md)


---

🚀 快速开始
「待补充」

---

⚙️ 技术栈
「待补充」
