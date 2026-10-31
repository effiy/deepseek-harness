import { Context } from '@deepseek-ai/cordis'
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { describe, expect, it, vi } from 'vitest'
import {
  ApiSessionAgentController,
} from '../src/agent.ts'
import { SessionCommandController } from '../src/commands.ts'
import type {
  SessionMessageDeleteRequest,
  SessionMessageUpdateRequest,
} from '../src/types.ts'
import { installSessionReadTestServices } from './test-remote.ts'

async function baseContext(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  installSessionReadTestServices(ctx)
  ctx.provide('agentDefaultModel', {
    currentSelection: () => ({ provider: 'fixture', model: 'fixture-model' }),
    saveSelection: () => Promise.resolve(),
  } as never)
  return ctx
}

function controllerAgents(overrides: Partial<ApiSessionAgentController> = {}): ApiSessionAgentController {
  return {
    ensureSession: () => Promise.resolve(),
    composeAgent: () => Promise.resolve({ setup: () => {} }),
    presetForSession: () => undefined,
    presetForObservation: () => undefined,
    ...overrides,
  } as unknown as ApiSessionAgentController
}

function completedSession(ctx: Context, id: string): Session {
  const session = ctx.sessions.create(SessionId(id), { meta: {} })
  session.append('turn/start', { turn: 1 })
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' },
  }), { surfaceOp: 'append' })
  session.append('assistant/message', {
    message: { role: 'assistant', content: 'hi there' },
    stream: [],
    turn: 1, step: 1,
  }, { surfaceOp: 'append' })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  return session
}

function sessionAgent(ctx: Context, session: Session): AgentHandle {
  return {
    agent: {
      id: session.id,
      status: 'idle' as const,
      session,
      ctx,
    } as unknown as Agent,
    dispose: () => Promise.resolve(),
  }
}

describe('messageDelete', () => {
  it('deletes a single user message by seq', async () => {
    const ctx = await baseContext()
    const session = completedSession(ctx, 'delete-single')
    const controller = new SessionCommandController(
      ctx,
      controllerAgents({
        resolveAgent: () => Promise.resolve(sessionAgent(ctx, session)),
      }),
      '/default',
    )

    // user/message is at seq 1 (turn/start is seq 0)
    const result = await controller.messageDelete({
      sessionId: session.id,
      messageSeq: 1,
    })
    expect(result).toEqual({ accepted: true })

    // Verify the replacement was appended
    const events = session.snapshotEvents()
    const replacement = events[events.length - 1]
    expect(replacement.type).toBe('user/message')
    expect(replacement.surfaceOp).toMatchObject({ op: 'replace', startSeq: 1, endSeq: 1 })

    await ctx.fiber.dispose()
  })

  it('deletes with cascade: removes the entire exchange', async () => {
    const ctx = await baseContext()
    const session = completedSession(ctx, 'delete-cascade')
    const controller = new SessionCommandController(
      ctx,
      controllerAgents({
        resolveAgent: () => Promise.resolve(sessionAgent(ctx, session)),
      }),
      '/default',
    )

    // cascade delete of user message at seq 1 → deletes user + assistant (seq 1-2)
    const result = await controller.messageDelete({
      sessionId: session.id,
      messageSeq: 1,
      cascade: true,
    })
    expect(result).toEqual({ accepted: true })

    const events = session.snapshotEvents()
    const replacement = events[events.length - 1]
    expect(replacement.surfaceOp).toMatchObject({
      op: 'replace',
      startSeq: 1,
      endSeq: 2,
    })

    await ctx.fiber.dispose()
  })

  it('rejects non-existent message sequence', async () => {
    const ctx = await baseContext()
    const session = completedSession(ctx, 'delete-missing')
    const controller = new SessionCommandController(
      ctx,
      controllerAgents({
        resolveAgent: () => Promise.resolve(sessionAgent(ctx, session)),
      }),
      '/default',
    )

    await expect(controller.messageDelete({
      sessionId: session.id,
      messageSeq: 99,
    })).rejects.toMatchObject({
      code: 'session/message-not-found',
      message: 'no message at seq 99',
    })

    await ctx.fiber.dispose()
  })

  it('rejects delete of non-surface event (turn/start)', async () => {
    const ctx = await baseContext()
    const session = completedSession(ctx, 'delete-non-surface')
    const controller = new SessionCommandController(
      ctx,
      controllerAgents({
        resolveAgent: () => Promise.resolve(sessionAgent(ctx, session)),
      }),
      '/default',
    )

    // turn/start is at seq 0 — not user/message or assistant/message
    await expect(controller.messageDelete({
      sessionId: session.id,
      messageSeq: 0,
    })).rejects.toMatchObject({
      code: 'session/message-not-editable',
    })

    await ctx.fiber.dispose()
  })
})

describe('messageUpdate', () => {
  it('updates message content', async () => {
    const ctx = await baseContext()
    const session = completedSession(ctx, 'update-content')
    const controller = new SessionCommandController(
      ctx,
      controllerAgents({
        resolveAgent: () => Promise.resolve(sessionAgent(ctx, session)),
      }),
      '/default',
    )

    const result = await controller.messageUpdate({
      sessionId: session.id,
      messageSeq: 1,
      content: [{ type: 'text', text: 'updated message' }],
    })
    expect(result).toEqual({ accepted: true })

    const events = session.snapshotEvents()
    const replacement = events[events.length - 1]
    expect(replacement.type).toBe('user/message')
    expect(replacement.surfaceOp).toMatchObject({ op: 'replace', startSeq: 1, endSeq: 1 })
    expect(replacement.seq).toBeGreaterThan(3) // after turn/start, user, assistant, turn/end

    await ctx.fiber.dispose()
  })

  it('rejects empty content', async () => {
    const ctx = await baseContext()
    const session = completedSession(ctx, 'update-empty')
    const controller = new SessionCommandController(
      ctx,
      controllerAgents({
        resolveAgent: () => Promise.resolve(sessionAgent(ctx, session)),
      }),
      '/default',
    )

    await expect(controller.messageUpdate({
      sessionId: session.id,
      messageSeq: 1,
      content: [],
    })).rejects.toMatchObject({
      code: 'gateway/bad-request',
    })

    await expect(controller.messageUpdate({
      sessionId: session.id,
      messageSeq: 1,
      content: [{ type: 'text', text: '   ' }],
    })).rejects.toMatchObject({
      code: 'gateway/bad-request',
    })

    await ctx.fiber.dispose()
  })

  it('rejects non-existent message sequence', async () => {
    const ctx = await baseContext()
    const session = completedSession(ctx, 'update-missing')
    const controller = new SessionCommandController(
      ctx,
      controllerAgents({
        resolveAgent: () => Promise.resolve(sessionAgent(ctx, session)),
      }),
      '/default',
    )

    await expect(controller.messageUpdate({
      sessionId: session.id,
      messageSeq: 99,
      content: [{ type: 'text', text: 'nope' }],
    })).rejects.toMatchObject({
      code: 'session/message-not-found',
      message: 'no message at seq 99',
    })

    await ctx.fiber.dispose()
  })

  it('rejects update of non-surface event (turn/end)', async () => {
    const ctx = await baseContext()
    const session = completedSession(ctx, 'update-non-surface')
    const controller = new SessionCommandController(
      ctx,
      controllerAgents({
        resolveAgent: () => Promise.resolve(sessionAgent(ctx, session)),
      }),
      '/default',
    )

    // turn/end is at seq 3 — not user/message or assistant/message
    await expect(controller.messageUpdate({
      sessionId: session.id,
      messageSeq: 3,
      content: [{ type: 'text', text: 'try edit turn/end' }],
    })).rejects.toMatchObject({
      code: 'session/message-not-editable',
    })

    await ctx.fiber.dispose()
  })
})