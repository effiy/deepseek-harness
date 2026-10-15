/**
 * Test suite for @deepseek-ai/dsh-llm-xingrui.
 *
 * L1 — extractKey unit tests (23 cases): Headers object / plain object / array / edge cases
 * L2 — patchedFetch integration (8 cases): LLM path interception / passthrough / logging
 * L3 — concurrent safety (4 cases): parallel requests / mixed LLM+non-LLM / onion model
 * L4 — performance benchmarks (3 cases): non-LLM latency / LLM latency / memory stability
 * L5 — security audit (5 cases): key truncation / header-value leak / options immutability
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractKey, headerKeyNames, isLlmPath, LLM_PATHS, normalizeHeaders } from "../src/core.js";
import { apply, inject, name } from "../src/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockCtx() {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    on: vi.fn(),
    emit: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// L1: extractKey unit tests (23 cases)
// ---------------------------------------------------------------------------

describe("extractKey — Headers 对象", () => {
  it("从 x-api-key 提取", () => {
    const h = new Headers({ "x-api-key": "sk-test-123" });
    expect(extractKey(h)).toBe("sk-test-123");
  });

  it("从 Authorization: Bearer 提取", () => {
    const h = new Headers({ Authorization: "Bearer sk-test-456" });
    expect(extractKey(h)).toBe("sk-test-456");
  });

  it("从 Authorization 无 Bearer 前缀提取", () => {
    const h = new Headers({ Authorization: "sk-test-789" });
    expect(extractKey(h)).toBe("sk-test-789");
  });

  it("x-api-key 优先于 Authorization", () => {
    const h = new Headers({
      "x-api-key": "sk-from-x",
      Authorization: "Bearer sk-from-auth",
    });
    expect(extractKey(h)).toBe("sk-from-x");
  });

  it("空 Headers 返回 undefined", () => {
    expect(extractKey(new Headers())).toBeUndefined();
  });
});

describe("extractKey — 普通对象", () => {
  it("从 x-api-key (小写) 提取", () => {
    expect(extractKey({ "x-api-key": "sk-test-123" })).toBe("sk-test-123");
  });

  it("从 X-Api-Key (大小写混合) 提取", () => {
    expect(extractKey({ "X-Api-Key": "sk-test-456" })).toBe("sk-test-456");
  });

  it("从 X-API-KEY (全大写) 提取", () => {
    expect(extractKey({ "X-API-KEY": "sk-test-789" })).toBe("sk-test-789");
  });

  it("从 Authorization: Bearer 提取", () => {
    expect(extractKey({ Authorization: "Bearer sk-test-000" })).toBe("sk-test-000");
  });

  it("从 authorization (小写) 提取", () => {
    expect(extractKey({ authorization: "Bearer sk-test-111" })).toBe("sk-test-111");
  });

  it("从 Bearer 后有多空格提取", () => {
    expect(extractKey({ Authorization: "Bearer    sk-test-222" })).toBe("sk-test-222");
  });

  it("x-api-key 优先于 Authorization (无论声明顺序)", () => {
    // Authorization 在前声明
    expect(extractKey({
      Authorization: "Bearer sk-auth",
      "x-api-key": "sk-x",
    })).toBe("sk-x");

    // x-api-key 在前声明
    expect(extractKey({
      "x-api-key": "sk-x",
      Authorization: "Bearer sk-auth",
    })).toBe("sk-x");
  });

  it("仅非认证 Header 返回 undefined", () => {
    expect(extractKey({
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
    })).toBeUndefined();
  });
});

describe("extractKey — 键值对数组", () => {
  it("从 x-api-key 提取", () => {
    expect(extractKey([["x-api-key", "sk-test-123"]])).toBe("sk-test-123");
  });

  it("从 Authorization 提取", () => {
    expect(extractKey([["Authorization", "Bearer sk-test-456"]])).toBe("sk-test-456");
  });

  it("x-api-key 优先于 Authorization", () => {
    expect(extractKey([
      ["Authorization", "Bearer sk-auth"],
      ["x-api-key", "sk-x"],
    ])).toBe("sk-x");
  });

  it("空数组返回 undefined", () => {
    expect(extractKey([])).toBeUndefined();
  });

  it("数组中有非认证 Header", () => {
    expect(extractKey([
      ["content-type", "application/json"],
      ["x-api-key", "sk-test-789"],
    ])).toBe("sk-test-789");
  });
});

describe("extractKey — 边界值", () => {
  it("headers 为 undefined 返回 undefined", () => {
    expect(extractKey(undefined)).toBeUndefined();
  });

  it("headers 为 null 返回 undefined", () => {
    expect(extractKey(null)).toBeUndefined();
  });

  it("Authorization 值为 'Bearer ' (仅前缀)", () => {
    expect(extractKey({ Authorization: "Bearer " })).toBeUndefined();
  });

  it("x-api-key 值为空字符串时回退到 Authorization", () => {
    const h = new Headers({ "x-api-key": "" });
    const h2 = new Headers({ "x-api-key": "", Authorization: "Bearer sk-xxx" });
    expect(extractKey(h)).toBeUndefined();
    expect(extractKey(h2)).toBe("sk-xxx");
  });

  it("Bearer 前缀大小写混合", () => {
    expect(extractKey({ Authorization: "BEARER sk-xxx" })).toBe("sk-xxx");
    expect(extractKey({ Authorization: "bearer sk-xxx" })).toBe("sk-xxx");
    expect(extractKey({ Authorization: "Bearer sk-xxx" })).toBe("sk-xxx");
  });
});

// ---------------------------------------------------------------------------
// L1b: isLlmPath / normalizeHeaders / headerKeyNames
// ---------------------------------------------------------------------------

describe("isLlmPath", () => {
  it("匹配 /v1/messages", () => {
    expect(isLlmPath("https://api.anthropic.com/v1/messages")).toBe(true);
  });

  it("匹配 /v1/chat/completions", () => {
    expect(isLlmPath("https://api.openai.com/v1/chat/completions")).toBe(true);
  });

  it("匹配带 query string 的 URL", () => {
    expect(isLlmPath("https://api.anthropic.com/v1/messages?beta=true")).toBe(true);
  });

  it("匹配 URL 对象", () => {
    expect(isLlmPath(new URL("https://api.anthropic.com/v1/messages"))).toBe(true);
  });

  it("匹配 Request 对象", () => {
    const req = new Request("https://api.anthropic.com/v1/messages");
    expect(isLlmPath(req)).toBe(true);
  });

  it("不匹配 /v1/models", () => {
    expect(isLlmPath("https://api.anthropic.com/v1/models")).toBe(false);
  });

  it("不匹配非 LLM URL", () => {
    expect(isLlmPath("https://example.com/api/data")).toBe(false);
  });
});

describe("normalizeHeaders", () => {
  it("Headers 对象：set authorization + delete x-api-key", () => {
    const h = new Headers({ "x-api-key": "sk-xxx", "content-type": "application/json" });
    const result = normalizeHeaders(h, "sk-xxx");
    expect(result.get("authorization")).toBe("Bearer sk-xxx");
    expect(result.get("x-api-key")).toBeNull();
    expect(result.get("content-type")).toBe("application/json");
  });

  it("普通对象：浅拷贝 + 删除两种大小写变体", () => {
    const h = { "X-Api-Key": "sk-xxx", "Content-Type": "application/json" };
    const result = normalizeHeaders(h, "sk-xxx");
    expect(result.authorization).toBe("Bearer sk-xxx");
    expect(result["x-api-key"]).toBeUndefined();
    expect(result["X-Api-Key"]).toBeUndefined();
    expect(result["Content-Type"]).toBe("application/json");
  });

  it("数组：filter + append", () => {
    const h = [["x-api-key", "sk-xxx"], ["content-type", "application/json"]];
    const result = normalizeHeaders(h, "sk-xxx");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(["content-type", "application/json"]);
    expect(result[1]).toEqual(["authorization", "Bearer sk-xxx"]);
  });
});

describe("headerKeyNames", () => {
  it("Headers 对象返回 key 名列表", () => {
    const h = new Headers({ "x-api-key": "sk-xxx", "content-type": "application/json" });
    expect(headerKeyNames(h)).toEqual(["x-api-key", "content-type"]);
  });

  it("普通对象返回 key 名列表", () => {
    expect(headerKeyNames({ "x-api-key": "sk-xxx", authorization: "Bearer sk-xxx" }))
      .toEqual(["x-api-key", "authorization"]);
  });

  it("数组返回 key 名列表", () => {
    expect(headerKeyNames([["x-api-key", "sk-xxx"], ["content-type", "application/json"]]))
      .toEqual(["x-api-key", "content-type"]);
  });
});

// ---------------------------------------------------------------------------
// Plugin metadata
// ---------------------------------------------------------------------------

describe("plugin metadata", () => {
  it("name is dsh-llm-xingrui", () => {
    expect(name).toBe("dsh-llm-xingrui");
  });

  it("inject is empty", () => {
    expect(inject).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// L2: patchedFetch integration tests (8 cases)
// ---------------------------------------------------------------------------

describe("patchedFetch — LLM 路径拦截", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("Anthropic /v1/messages + x-api-key → Authorization: Bearer", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    await globalThis.fetch("https://api.anthropic.com/v1/messages", {
      headers: {
        "x-api-key": "sk-ant-test",
        "anthropic-version": "2023-06-01",
      },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [_url, opts] = mockFetch.mock.calls[0] as [string, any];
    expect(opts.headers.authorization).toBe("Bearer sk-ant-test");
    expect(opts.headers["x-api-key"]).toBeUndefined();
    expect(opts.headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("OpenAI /v1/chat/completions + Authorization → 归一化为小写", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    await globalThis.fetch("https://api.openai.com/v1/chat/completions", {
      headers: {
        Authorization: "Bearer sk-openai-test",
        "Content-Type": "application/json",
      },
    });

    const [_url, opts] = mockFetch.mock.calls[0] as [string, any];
    expect(opts.headers.authorization).toBe("Bearer sk-openai-test");
    const ct = opts.headers["Content-Type"] ?? opts.headers["content-type"];
    expect(ct).toBe("application/json");
  });

  it("带 query string 的 URL 正确识别", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    await globalThis.fetch(
      "https://api.anthropic.com/v1/messages?beta=true&model=claude-3",
      { headers: { "x-api-key": "sk-qs-test" } },
    );

    const [_url, opts] = mockFetch.mock.calls[0] as [string, any];
    expect(opts.headers.authorization).toBe("Bearer sk-qs-test");
  });

  it("URL 对象作为 fetch 参数", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    const url = new URL("https://api.anthropic.com/v1/messages");
    await globalThis.fetch(url, { headers: { "x-api-key": "sk-url-obj-test" } });

    const [_url, opts] = mockFetch.mock.calls[0] as [string, any];
    expect(opts.headers.authorization).toBe("Bearer sk-url-obj-test");
  });
});

describe("patchedFetch — 非 LLM 路径透传", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("/v1/models 请求原样透传", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    await globalThis.fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": "sk-keep-me" },
    });

    const [_url, opts] = mockFetch.mock.calls[0] as [string, any];
    expect(opts.headers["x-api-key"]).toBe("sk-keep-me");
    expect(opts.headers.authorization).toBeUndefined();
  });

  it("非 LLM 请求不触发日志中的 intercept", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    await globalThis.fetch("https://example.com/api/data");

    const interceptCalls = (ctx.logger.info as any).mock.calls
      .filter(([msg]: [string]) => msg.includes("intercept"));
    expect(interceptCalls).toHaveLength(0);
  });
});

describe("patchedFetch — 日志输出", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("LLM 请求输出完整的日志链路", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    await globalThis.fetch("https://api.anthropic.com/v1/messages", {
      headers: { "x-api-key": "sk-ant-api03-very-long-key-12345" },
    });

    const logs = (ctx.logger.info as any).mock.calls.map(([msg]: [string]) => msg);

    // 加载日志
    expect(logs.some((l: string) => l.includes("adding Authorization: Bearer"))).toBe(true);

    // 拦截日志包含 header keys
    expect(logs.some((l: string) => l.includes("intercept") && l.includes("x-api-key"))).toBe(true);

    // Key 截断：仅保留前 8 字符
    expect(logs.some((l: string) => l.includes("sk-ant-a") && l.includes("..."))).toBe(true);

    // 不应包含完整 Key
    expect(logs.some((l: string) => l.includes("sk-ant-api03-very-long-key-12345"))).toBe(false);
  });

  it("无 Key 时输出 NO KEY FOUND", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    await globalThis.fetch("https://api.anthropic.com/v1/messages", { headers: {} });

    const logs = (ctx.logger.info as any).mock.calls.map(([msg]: [string]) => msg);
    expect(logs.some((l: string) => l.includes("NO KEY FOUND"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// L3: concurrent safety (4 cases)
// ---------------------------------------------------------------------------

describe("patchedFetch — 并发安全", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("10 个并发 LLM 请求各自独立处理", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    const keys = Array.from({ length: 10 }, (_, i) => `sk-concurrent-${i.toString().padStart(3, "0")}`);

    await Promise.all(keys.map((key) =>
      globalThis.fetch("https://api.anthropic.com/v1/messages", {
        headers: { "x-api-key": key },
      }),
    ));

    const calls = mockFetch.mock.calls as Array<[string, any]>;
    expect(calls).toHaveLength(10);

    const authHeaders = calls.map(([_url, opts]) => opts.headers.authorization);
    keys.forEach((key, i) => {
      expect(authHeaders[i]).toBe(`Bearer ${key}`);
    });
  });

  it("混合 LLM 和非 LLM 请求并发", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    await Promise.all([
      globalThis.fetch("https://api.anthropic.com/v1/messages", {
        headers: { "x-api-key": "sk-llm" },
      }),
      globalThis.fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": "sk-models" },
      }),
      globalThis.fetch("https://example.com"),
    ]);

    const calls = mockFetch.mock.calls as Array<[string, any]>;
    expect(calls).toHaveLength(3);

    const llmCall = calls.find(([url]) => (url as string).includes("/v1/messages"))!;
    expect(llmCall[1].headers.authorization).toBe("Bearer sk-llm");
    expect(llmCall[1].headers["x-api-key"]).toBeUndefined();

    const modelsCall = calls.find(([url]) => (url as string).includes("/v1/models"))!;
    expect(modelsCall[1].headers["x-api-key"]).toBe("sk-models");
    expect(modelsCall[1].headers.authorization).toBeUndefined();
  });

  it("options 为 undefined 时并发不报错", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    await Promise.all(Array.from({ length: 5 }, () =>
      globalThis.fetch("https://api.anthropic.com/v1/messages"),
    ));

    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it("两个插件 patch fetch 后行为正确（洋葱模型验证）", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    // 模拟 dsh-llm-retry 先 patch（外层）
    const outerFetch = globalThis.fetch;
    globalThis.fetch = ((url: any, opts: any) => {
      return outerFetch(url, opts);
    }) as typeof globalThis.fetch;

    // 然后 xingrui patch（内层）
    apply(ctx as any);

    await globalThis.fetch("https://api.anthropic.com/v1/messages", {
      headers: { "x-api-key": "sk-onion-test" },
    });

    const [_url, opts] = mockFetch.mock.calls[0] as [string, any];
    expect(opts.headers.authorization).toBe("Bearer sk-onion-test");
  });
});

// ---------------------------------------------------------------------------
// L4: performance benchmarks (3 cases)
// ---------------------------------------------------------------------------

describe("性能基准", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("非 LLM 请求额外延迟 < 0.1ms", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    // 预热
    for (let i = 0; i < 100; i++) {
      await globalThis.fetch("https://example.com/api/data");
    }

    const ITER = 1000;
    const start = process.hrtime.bigint();
    for (let i = 0; i < ITER; i++) {
      await globalThis.fetch("https://example.com/api/data");
    }
    const end = process.hrtime.bigint();
    const avgNs = Number(end - start) / ITER;
    const avgMs = avgNs / 1_000_000;

    expect(avgMs).toBeLessThan(0.1);
  });

  it("LLM 请求额外延迟 < 0.05ms（不含日志 I/O）", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    // 预热
    for (let i = 0; i < 50; i++) {
      await globalThis.fetch("https://api.anthropic.com/v1/messages", {
        headers: { "x-api-key": "sk-warm" },
      });
    }

    const ITER = 500;
    const start = process.hrtime.bigint();
    for (let i = 0; i < ITER; i++) {
      await globalThis.fetch("https://api.anthropic.com/v1/messages", {
        headers: { "x-api-key": `sk-perf-${i}` },
      });
    }
    const end = process.hrtime.bigint();
    const avgNs = Number(end - start) / ITER - 1000; // 扣除 mock fetch 固有延迟 ~1μs
    const avgMs = avgNs / 1_000_000;

    expect(avgMs).toBeLessThan(0.05);
  });

  it("1000 次调用内存占用稳定（无泄漏）", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    if (typeof global.gc === "function") global.gc();
    const memBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      await globalThis.fetch(
        `https://api.anthropic.com/v1/messages?req=${i}`,
        { headers: { "x-api-key": `sk-mem-${i}` } },
      );
    }

    if (typeof global.gc === "function") global.gc();
    const memAfter = process.memoryUsage().heapUsed;
    const deltaMB = (memAfter - memBefore) / 1024 / 1024;

    expect(deltaMB).toBeLessThan(5);
  });
});

// ---------------------------------------------------------------------------
// L5: security audit (5 cases)
// ---------------------------------------------------------------------------

describe("安全审计", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("日志不包含完整 API Key", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    const longKey = "sk-ant-api03-" + "x".repeat(100);
    await globalThis.fetch("https://api.anthropic.com/v1/messages", {
      headers: { "x-api-key": longKey },
    });

    const allLogs = (ctx.logger.info as any).mock.calls
      .map(([msg]: [string]) => msg)
      .join("\n");

    expect(allLogs).not.toContain(longKey);
    expect(allLogs).toContain(longKey.slice(0, 8) + "...");
  });

  it("Authorization: Bearer 后跟的 Key 不在日志中完整出现", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    const key = "sk-proj-" + "y".repeat(50);
    await globalThis.fetch("https://api.openai.com/v1/chat/completions", {
      headers: { Authorization: `Bearer ${key}` },
    });

    const allLogs = (ctx.logger.info as any).mock.calls
      .map(([msg]: [string]) => msg)
      .join("\n");

    expect(allLogs).not.toContain(key);
    expect(allLogs).toContain(key.slice(0, 8) + "...");
  });

  it("日志中不包含任何 Header 的值", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    await globalThis.fetch("https://api.anthropic.com/v1/messages", {
      headers: {
        "x-api-key": "sk-secret-do-not-leak",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
    });

    const allLogs = (ctx.logger.info as any).mock.calls
      .map(([msg]: [string]) => msg)
      .join("\n");

    expect(allLogs).not.toContain("sk-secret-do-not-leak");
    expect(allLogs).not.toContain("2023-06-01");
    expect(allLogs).not.toContain("application/json");
    expect(allLogs).toContain("x-api-key");
  });

  it("重写后 Headers 中 Key 仅出现在 authorization 字段", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    const key = "sk-unique-key-12345";
    await globalThis.fetch("https://api.anthropic.com/v1/messages", {
      headers: { "x-api-key": key },
    });

    const [_url, opts] = mockFetch.mock.calls[0] as [string, any];
    const headers = opts.headers;

    expect(headers.authorization).toBe(`Bearer ${key}`);

    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() !== "authorization") {
        expect(v).not.toContain(key);
      }
    }
  });

  it("options 原始对象不被修改（防止副作用污染调用方）", async () => {
    const ctx = makeMockCtx();
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch as any;

    apply(ctx as any);

    const originalHeaders = {
      "x-api-key": "sk-original",
      "content-type": "application/json",
    };
    const originalOptions = {
      method: "POST" as const,
      headers: originalHeaders,
      body: JSON.stringify({ test: true }),
    };

    await globalThis.fetch("https://api.anthropic.com/v1/messages", originalOptions);

    expect(originalOptions.headers).toBe(originalHeaders);
    expect(originalHeaders["x-api-key"]).toBe("sk-original");
    expect((originalHeaders as any).authorization).toBeUndefined();
  });
});