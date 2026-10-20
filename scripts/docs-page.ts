/**
 * Documentation-site page manifest, projection, and verification.
 *
 * This module owns every definition that produces the documentation site:
 * the canonical page manifest, the build-time Markdown projection into
 * VitePress, post-build fragment verification, and raw-Markdown emission.
 */

import {
  copyFileSync, existsSync, globSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, posix, relative, resolve, sep } from 'node:path'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import type { Nodes } from 'mdast'
import { JSDOM } from 'jsdom'
import {
  isExternalOrAbsoluteMarkdownUrl,
  markdownDestination,
  splitMarkdownUrlTarget,
} from './markdown.ts'

// ---------------------------------------------------------------------------
// Canonical page manifest and sidebar types
// ---------------------------------------------------------------------------

/** Locale key used by the VitePress site. */
export type DocsLocale = 'root' | 'en'

/** Sidebar collection rendered for one locale and top-level module. */
export type DocsSidebar =
  | 'zh-guide'
  | 'zh-develop'
  | 'zh-reference'
  | 'en-guide'
  | 'en-develop'
  | 'en-reference'

/** A page projected into the VitePress source tree. */
export interface DocsPage {
  /** VitePress locale whose route tree owns this projection. */
  locale: DocsLocale
  /** Language of the canonical source currently projected at this route. */
  contentLocale: 'zh-CN' | 'en-US'
  /** Repository-relative canonical Markdown source. */
  source: string
  /** VitePress route, including the `.md` suffix. */
  route: string
  /** Navigation label shown in the sidebar. */
  label: string
  /** Sidebar collection that owns the page, or null for a locale home page. */
  sidebar: DocsSidebar | null
  /** Section label within the sidebar. */
  section: string
  /** Stable order within the section. */
  order: number
  /** Heading levels included in this page's VitePress outline. */
  outline?: number | readonly [number, number] | 'deep' | false
  /** Additional repository paths that resolve to this page. */
  sourceAliases?: string[]
}

interface MirroredPage {
  source: string | Record<DocsLocale, string>
  route: string
  contentLocale: DocsPage['contentLocale'] | Record<DocsLocale, DocsPage['contentLocale']>
  label: Record<DocsLocale, string>
  sidebar: Record<DocsLocale, DocsSidebar | null>
  section: Record<DocsLocale, string>
  order: number
  outline?: DocsPage['outline']
  sourceAliases?: string[] | Partial<Record<DocsLocale, string[]>>
}

type PairedPage = Omit<MirroredPage, 'source' | 'contentLocale' | 'sourceAliases'> & {
  /** English side of a sibling `foo.md` / `foo.zh.md` pair. */
  source: string
  /** Language-neutral repository aliases, such as the directory of an index page. */
  sourceAliases?: string[]
}

function localized<T>(value: T | Record<DocsLocale, T>, locale: DocsLocale): T {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<DocsLocale, T>)[locale]
    : value
}

function mirroredPages(pages: MirroredPage[]): DocsPage[] {
  return pages.flatMap(page => (['root', 'en'] as const).map((locale) => {
    const aliases = page.sourceAliases === undefined
      ? undefined
      : Array.isArray(page.sourceAliases) ? page.sourceAliases : page.sourceAliases[locale]
    return {
      locale,
      contentLocale: localized(page.contentLocale, locale),
      source: localized(page.source, locale),
      route: locale === 'root' ? page.route : `en/${page.route}`,
      label: page.label[locale],
      sidebar: page.sidebar[locale],
      section: page.section[locale],
      order: page.order,
      ...(page.outline === undefined ? {} : { outline: page.outline }),
      ...(aliases === undefined ? {} : { sourceAliases: aliases }),
    }
  }))
}

function pairedPages(pages: PairedPage[]): DocsPage[] {
  return mirroredPages(pages.map((page) => {
    const chineseSource = page.source.replace(/\.md$/, '.zh.md')
    const sharedAliases = page.sourceAliases ?? []
    return {
      ...page,
      source: { root: chineseSource, en: page.source },
      contentLocale: { root: 'zh-CN', en: 'en-US' },
      sourceAliases: {
        root: [...sharedAliases, page.source],
        en: [...sharedAliases, chineseSource],
      },
    }
  }))
}

const homeAndGuide = pairedPages([
  {
    source: 'docs/user/index.md',
    route: 'index.md',
    label: { root: 'DeepSeek Harness', en: 'DeepSeek Harness' },
    sidebar: { root: null, en: null },
    section: { root: '首页', en: 'Home' },
    order: 0,
  },
  {
    source: 'docs/user/guide/index.md',
    route: 'guide/quickstart.md',
    label: { root: '使用 Web UI', en: 'Use the Web UI' },
    sidebar: { root: 'zh-guide', en: 'en-guide' },
    section: { root: '入门', en: 'Guide' },
    order: 1,
    sourceAliases: ['docs/user/guide'],
  },
  {
    source: 'docs/user/guide/providers.md',
    route: 'guide/providers.md',
    label: { root: '配置模型', en: 'Configure models' },
    sidebar: { root: 'zh-guide', en: 'en-guide' },
    section: { root: '入门', en: 'Guide' },
    order: 2,
  },
  {
    source: 'docs/user/guide/network-proxy.md',
    route: 'guide/network-proxy.md',
    label: { root: '网络代理', en: 'Network proxy' },
    sidebar: { root: 'zh-guide', en: 'en-guide' },
    section: { root: '入门', en: 'Guide' },
    order: 3,
  },
  {
    source: 'docs/user/guide/public-deployments.md',
    route: 'guide/public-deployments.md',
    label: { root: '公开部署', en: 'Public deployments' },
    sidebar: { root: 'zh-guide', en: 'en-guide' },
    section: { root: '入门', en: 'Guide' },
    order: 4,
  },
  {
    source: 'docs/user/guide/python-sdk.md',
    route: 'guide/python-sdk.md',
    label: { root: 'Python', en: 'Python' },
    sidebar: { root: 'zh-guide', en: 'en-guide' },
    section: { root: 'SDK', en: 'SDK' },
    order: 1,
  },
  {
    source: 'docs/user/guide/github-review.md',
    route: 'guide/github-review.md',
    label: { root: 'GitHub 评审会话', en: 'GitHub review sessions' },
    sidebar: { root: 'zh-guide', en: 'en-guide' },
    section: { root: '自动化', en: 'Automation' },
    order: 1,
  },
  {
    source: 'docs/user/guide/schedule.md',
    route: 'guide/schedule.md',
    label: { root: '会话内提醒', en: 'Session reminders' },
    sidebar: { root: 'zh-guide', en: 'en-guide' },
    section: { root: '自动化', en: 'Automation' },
    order: 2,
  },
  {
    source: 'docs/user/guide/mcp-memory.md',
    route: 'guide/mcp-memory.md',
    label: { root: '记忆 MCP', en: 'Memory MCP' },
    sidebar: { root: 'zh-guide', en: 'en-guide' },
    section: { root: '集成', en: 'Integrations' },
    order: 1,
  },
])

const develop = pairedPages([
  {
    source: 'docs/user/develop/basic/index.md',
    route: 'develop/basic/index.md',
    label: { root: '第一个 Harness 插件', en: 'Your first Harness plugin' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '基础', en: 'Basics' },
    order: 1,
    sourceAliases: ['docs/user/develop/basic'],
  },
  {
    source: 'docs/user/develop/basic/tool.md',
    route: 'develop/basic/tool.md',
    label: { root: '开发一个 Tool', en: 'Build a tool' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '基础', en: 'Basics' },
    order: 2,
  },
  {
    source: 'docs/user/develop/basic/config.md',
    route: 'develop/basic/config.md',
    label: { root: '插件配置', en: 'Plugin configuration' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '基础', en: 'Basics' },
    order: 3,
  },
  {
    source: 'docs/user/develop/basic/publish.md',
    route: 'develop/basic/publish.md',
    label: { root: '打包与安装插件', en: 'Package and install' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '基础', en: 'Basics' },
    order: 4,
  },
  {
    source: 'docs/user/develop/framework/index.md',
    route: 'develop/framework/index.md',
    label: { root: '插件与生命周期', en: 'Plugin lifecycle' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '框架能力', en: 'Framework' },
    order: 1,
    sourceAliases: ['docs/user/develop/framework'],
  },
  {
    source: 'docs/user/develop/framework/service.md',
    route: 'develop/framework/service.md',
    label: { root: '服务与依赖', en: 'Services and dependencies' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '框架能力', en: 'Framework' },
    order: 2,
  },
  {
    source: 'docs/user/develop/framework/events.md',
    route: 'develop/framework/events.md',
    label: { root: '事件系统', en: 'Event system' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '框架能力', en: 'Framework' },
    order: 3,
  },
  {
    source: 'docs/user/develop/practice/index.md',
    route: 'develop/practice/index.md',
    label: { root: '能力的三层拆分', en: 'Capability layering' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '实战', en: 'Practice' },
    order: 1,
    sourceAliases: ['docs/user/develop/practice'],
  },
  {
    source: 'docs/user/develop/practice/llm-adapter.md',
    route: 'develop/practice/llm-adapter.md',
    label: { root: 'LLM 适配器', en: 'LLM adapter' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '实战', en: 'Practice' },
    order: 2,
  },
  {
    source: 'docs/user/develop/practice/dynamic-cordis.md',
    route: 'develop/practice/dynamic-cordis.md',
    label: { root: '持久化 Harness 插件', en: 'Persistent Harness plugins' },
    sidebar: { root: 'zh-develop', en: 'en-develop' },
    section: { root: '实战', en: 'Practice' },
    order: 3,
  },
])

const cordisTutorial = pairedPages(([
  ['index.md', '总览', 'Overview'],
  ['01-first-plugin.md', '1. 第一个插件', '1. Your first plugin'],
  ['02-lifecycle-and-effects.md', '2. 生命周期与副作用', '2. Lifecycle and effects'],
  ['03-services.md', '3. 服务', '3. Services'],
  ['04-events.md', '4. 事件', '4. Events'],
  ['05-config.md', '5. 配置', '5. Configuration'],
  ['06-composition-and-hmr.md', '6. 组合与热重载', '6. Composition and HMR'],
  ['07-into-the-harness.md', '7. 进入 Harness', '7. Into the harness'],
] as const).map(([file, rootLabel, enLabel], order): PairedPage => ({
  source: `docs/cordis-tutorial/${file}`,
  route: `develop/cordis-tutorial/${file}`,
  label: { root: rootLabel, en: enLabel },
  sidebar: { root: 'zh-develop', en: 'en-develop' },
  section: { root: 'Cordis 框架教程', en: 'Cordis framework tutorial' },
  order,
  ...(file === 'index.md' ? { sourceAliases: ['docs/cordis-tutorial'] } : {}),
})))

const cordisPrimerReference = pairedPages([
  {
    source: 'docs/cordis-primer.md',
    route: 'reference/cordis-primer.md',
    label: { root: 'Cordis 入门', en: 'Cordis primer' },
    sidebar: { root: 'zh-reference', en: 'en-reference' },
    section: { root: '概念', en: 'Concepts' },
    order: 1,
  },
])

/**
 * Subsystem pages grouped by the concern they document, as `[Chinese section,
 * English section, pages]`. One flat list of every subsystem pushed the rest of
 * the reference sidebar below the fold.
 */
const subsystemGroups = [
  ['总览', 'Overview', [
    ['README.md', '子系统', 'Subsystems'],
  ]],
  ['内核与作用域', 'Core and scopes', [
    ['core.md', '核心', 'Core'],
    ['scope.md', '作用域', 'Scopes'],
  ]],
  ['会话与持久化', 'Sessions and persistence', [
    ['session.md', '会话', 'Sessions'],
    ['session-query.md', '会话查询', 'Session query'],
    ['session-reference.md', '会话引用', 'Session references'],
    ['session-title.md', '会话标题', 'Session titles'],
    ['session-projection.md', '会话投影', 'Session projections'],
    ['persistence.md', '会话持久化', 'Session persistence'],
    ['spill.md', 'Spill 存储', 'Spill storage'],
    ['session-telemetry.md', '遥测', 'SessionTelemetryBackend'],
  ]],
  ['模型与上下文', 'Model and context', [
    ['llm-streaming.md', 'LLM 流式响应', 'LLM streaming'],
    ['token-meter.md', 'Token 计量', 'Token metering'],
    ['system-prompt.md', '系统提示词', 'System prompts'],
    ['compaction.md', '上下文压缩', 'Compaction'],
  ]],
  ['执行与工具', 'Execution and tools', [
    ['tools.md', '工具', 'Tools'],
    ['shell.md', 'Bash 执行', 'Bash execution'],
    ['subprocess.md', '子进程', 'Subprocesses'],
    ['terminal.md', 'PTY 会话', 'PTY sessions'],
    ['jobs.md', '后台任务', 'Background jobs'],
    ['filesystem.md', '文件系统', 'Filesystem'],
    ['lsp.md', 'LSP 导航', 'LSP navigation'],
    ['ptc-runtime.md', 'PTC 运行时', 'PTC runtime'],
    ['web.md', 'Web 访问', 'Web access'],
    ['skills.md', '技能', 'Skills'],
    ['workflow.md', '工作流', 'Workflows'],
    ['subagent.md', '子智能体', 'Subagents'],
  ]],
  ['策略与交互', 'Policy and interaction', [
    ['approval.md', '审批', 'Approvals'],
    ['permission-presets.md', '权限预设', 'Permission presets'],
    ['sandbox.md', '沙箱', 'Sandboxing'],
    ['plan.md', '计划模式', 'Plan mode'],
    ['user-questions.md', '用户交互', 'User interaction'],
    ['commands.md', '命令', 'Human commands'],
    ['goal.md', '目标', 'Goals'],
    ['schedule.md', '定时提醒', 'Scheduled reminders'],
  ]],
  ['平台与接入', 'Platform and access', [
    ['web-server.md', 'HTTP 服务器', 'HTTP server'],
    ['web-client.md', 'Web Client 架构', 'Web Client architecture'],
    ['client-modules.md', '客户端模块', 'Client modules'],
    ['slots.md', '客户端 Slots', 'Client slots'],
    ['client-resources.md', '客户端资源', 'Client resources'],
    ['sidebar-right.md', '右侧 Sidebar', 'Right Sidebar'],
    ['conversation.md', 'Conversation 组装', 'Conversation assembly'],
    ['typert.md', 'Typert', 'Typert'],
    ['storage.md', '存储', 'Storage'],
    ['workspace.md', '工作区', 'Workspaces'],
    ['settings.md', '用户设置', 'User settings'],
    ['credentials.md', '用户凭据', 'User credentials'],
  ]],
] as const

const subsystemsReference = subsystemGroups.flatMap(([rootSection, enSection, files]) => pairedPages(
  files.map(([file, rootLabel, enLabel], order): PairedPage => ({
    source: `docs/subsystems/${file}`,
    route: file === 'README.md' ? 'reference/subsystems/index.md' : `reference/subsystems/${file}`,
    label: { root: rootLabel, en: enLabel },
    sidebar: { root: 'zh-reference', en: 'en-reference' },
    section: { root: rootSection, en: enSection },
    order,
    // Subsystem pages carry long third-level sections a two-level outline reaches.
    outline: [2, 3],
    ...(file === 'README.md' ? { sourceAliases: ['docs/subsystems'] } : {}),
  })),
))

const reference = [
  // `docs/deepseek-llm-api-wire-extensions.md` is a repository-only provider protocol reference.
  // Projected links intentionally resolve to its GitHub source instead of a public site route.
  ...pairedPages(([
    ['docs/architecture.md', 'reference/index.md', '架构', 'Architecture', 0],
  ] as const).map(([source, route, rootLabel, enLabel, order]): PairedPage => ({
    source,
    route,
    label: { root: rootLabel, en: enLabel },
    sidebar: { root: 'zh-reference', en: 'en-reference' },
    section: { root: '概念', en: 'Concepts' },
    order,
  }))),
  ...pairedPages(([
    ['docs/capability-seams.md', 'reference/capability-seams.md', '能力服务', 'Capability services', 2],
    ['docs/agent-lifecycle.md', 'reference/agent-lifecycle.md', 'Agent 生命周期', 'Agent lifecycle', 3],
    ['docs/tool-execution-pipeline.md', 'reference/tool-execution-pipeline.md', 'Tool 执行', 'Tool execution', 4],
    ['docs/api-gateway.md', 'reference/api-gateway.md', 'API Gateway', 'API Gateway', 5],
  ] as const).map(([source, route, rootLabel, enLabel, order]): PairedPage => ({
    source,
    route,
    label: { root: rootLabel, en: enLabel },
    sidebar: { root: 'zh-reference', en: 'en-reference' },
    section: { root: '概念', en: 'Concepts' },
    order,
  }))),
  ...pairedPages(([
    ['docs/config-catalog.md', 'reference/config-catalog.md', '插件配置', 'Plugin configuration'],
    ['docs/tool-catalog.md', 'reference/tool-catalog.md', 'Tool Schema', 'Tool schemas'],
    ['docs/persistence-catalog.md', 'reference/persistence-catalog.md', '持久化事件', 'Persistence events', 'deep'],
    ['docs/experimental-persistence-catalog.md', 'reference/experimental-persistence-catalog.md', '实验性持久化记录', 'Experimental persistence'],
  ] as const).map(([source, route, rootLabel, enLabel, outline], order): PairedPage => ({
    source,
    route,
    label: { root: rootLabel, en: enLabel },
    sidebar: { root: 'zh-reference', en: 'en-reference' },
    section: { root: '生成参考', en: 'Generated reference' },
    order,
    ...(outline === undefined ? {} : { outline }),
  }))),
  ...pairedPages(([
    ['context.md', 'Context', 'Context'],
    ['events.md', 'Events', 'Events'],
    ['fiber.md', 'Fiber', 'Fiber'],
    ['registry.md', 'Plugin Registry', 'Plugin Registry'],
    ['service.md', 'Service', 'Service'],
  ] as const).map(([file, rootLabel, enLabel], order): PairedPage => ({
    source: `docs/cordis-api/${file}`,
    route: `reference/cordis-api/${file}`,
    label: { root: rootLabel, en: enLabel },
    sidebar: { root: 'zh-reference', en: 'en-reference' },
    section: { root: 'Cordis API', en: 'Cordis Core API' },
    order,
  }))),
  ...mirroredPages(([
    ['inherited.md', '继承接口面', 'Inherited surface'],
  ] as const).map(([file, rootLabel, enLabel], order): MirroredPage => ({
    source: `docs/cordis-api/${file}`,
    route: `reference/cordis-api/${file}`,
    contentLocale: 'en-US',
    label: { root: rootLabel, en: enLabel },
    sidebar: { root: 'zh-reference', en: 'en-reference' },
    section: { root: 'Cordis API', en: 'Cordis Core API' },
    order: order + 5,
  }))),
  ...pairedPages(([
    ['adding-a-package.md', '新增 Package', 'Adding a package'],
    ['adding-a-tool.md', '新增 Tool', 'Adding a tool'],
    ['adding-an-llm-adapter.md', '新增 LLM Adapter', 'Adding an LLM adapter'],
    ['adding-a-settings-card.md', '新增设置页', 'Adding a settings page'],
    ['extension-cookbook.md', '扩展模式', 'Extension patterns'],
  ] as const).map(([file, rootLabel, enLabel], order): PairedPage => ({
    source: `docs/cookbook/${file}`,
    route: `reference/cookbook/${file}`,
    label: { root: rootLabel, en: enLabel },
    sidebar: { root: 'zh-reference', en: 'en-reference' },
    section: { root: '开发手册', en: 'Cookbook' },
    order,
  }))),
]

/**
 * Sidebar collections of each locale, in the order the site's navigation
 * presents them. The navigation bar and the llms.txt index both read this
 * sequence, so a new collection lands in both surfaces together.
 */
export const localeCollections = {
  root: ['zh-guide', 'zh-develop', 'zh-reference'],
  en: ['en-guide', 'en-develop', 'en-reference'],
} as const satisfies Record<DocsLocale, readonly DocsSidebar[]>

/** A sidebar group, matched to pages by `label`. */
export interface DocsSection {
  /** Group heading, equal to the `section` field of every page it holds. */
  label: string
  /** Render the group collapsed until it holds the page being read. */
  collapsed?: boolean
}

/**
 * Every sidebar group, in the order its locale renders it.
 *
 * The subsystem groups collapse because together they outnumber the rest of the
 * reference sidebar; expanded, they push every other group below the fold.
 */
const sections: Record<DocsLocale, readonly DocsSection[]> = {
  root: [
    { label: '入门' }, { label: 'SDK' }, { label: '自动化' }, { label: '集成' },
    { label: '基础' }, { label: '框架能力' }, { label: '实战' }, { label: 'Cordis 框架教程' },
    { label: '概念' }, { label: '生成参考' }, { label: 'Cordis API' }, { label: '开发手册' },
    { label: '总览' },
    { label: '内核与作用域', collapsed: true },
    { label: '会话与持久化', collapsed: true },
    { label: '模型与上下文', collapsed: true },
    { label: '执行与工具', collapsed: true },
    { label: '策略与交互', collapsed: true },
    { label: '平台与接入', collapsed: true },
  ],
  en: [
    { label: 'Guide' }, { label: 'SDK' }, { label: 'Automation' }, { label: 'Integrations' },
    { label: 'Basics' }, { label: 'Framework' }, { label: 'Practice' }, { label: 'Cordis framework tutorial' },
    { label: 'Concepts' }, { label: 'Generated reference' }, { label: 'Cordis Core API' }, { label: 'Cookbook' },
    { label: 'Overview' },
    { label: 'Core and scopes', collapsed: true },
    { label: 'Sessions and persistence', collapsed: true },
    { label: 'Model and context', collapsed: true },
    { label: 'Execution and tools', collapsed: true },
    { label: 'Policy and interaction', collapsed: true },
    { label: 'Platform and access', collapsed: true },
  ],
}

/**
 * Placement and collapse behavior of one sidebar group.
 *
 * @param locale - Route tree whose sidebar is being built.
 * @param label - Section label carried by the pages in the group.
 * @returns The declared group, plus its zero-based position in the locale.
 * @throws When the locale declares no placement for the label. Ranking by list
 *   membership alone would sort an undeclared group silently ahead of every
 *   declared one.
 */
export function sectionSpec(locale: DocsLocale, label: string): DocsSection & { index: number } {
  const declared = sections[locale]
  const section = declared.find(candidate => candidate.label === label)
  if (section === undefined) throw new Error(`Sidebar section "${label}" has no placement in the ${locale} locale.`)
  return { ...section, index: declared.indexOf(section) }
}

/** Every canonical page published by the documentation website. */
export const docsPages: DocsPage[] = [
  ...homeAndGuide,
  ...develop,
  ...cordisTutorial,
  ...cordisPrimerReference,
  ...subsystemsReference,
  ...reference,
]

/**
 * Pages of one sidebar collection, in the order the sidebar lists them.
 *
 * @param locale - Route tree whose sidebar is being built.
 * @param collection - Sidebar collection to read.
 * @returns The collection's pages, ordered by section placement then by `order`.
 */
export function orderedPages(locale: DocsLocale, collection: DocsSidebar): DocsPage[] {
  return docsPages
    .filter(page => page.locale === locale && page.sidebar === collection)
    .sort((left, right) => (
      sectionSpec(locale, left.section).index - sectionSpec(locale, right.section).index
      || left.order - right.order
    ))
}

/**
 * Site-relative link for a published route.
 *
 * @param route - Manifest route, including its `.md` suffix.
 * @returns The link VitePress serves the route at.
 */
export function routeLink(route: string): string {
  return `/${route.replace(/(?:index)?\.md$/, '')}`
}

/**
 * Where a top-level navigation item lands.
 *
 * The target is derived rather than written down: a collection whose first page
 * is renamed or reordered would otherwise leave the navigation bar pointing at
 * a route the manifest no longer publishes.
 *
 * @param locale - Route tree the navigation item belongs to.
 * @param collection - Sidebar collection the item opens.
 * @returns Site-relative link of the collection's first page.
 * @throws When the collection publishes no page.
 */
export function landingLink(locale: DocsLocale, collection: DocsSidebar): string {
  const first = orderedPages(locale, collection)[0]
  if (first === undefined) throw new Error(`Sidebar collection "${collection}" publishes no page.`)
  return routeLink(first.route)
}

// ---------------------------------------------------------------------------
// Build-time Markdown projection
// ---------------------------------------------------------------------------

const REPOSITORY_URL = 'https://github.com/deepseek-ai/deepseek-harness'
const root = resolve(import.meta.dirname, '..')
const generatedRoot = resolve(root, 'website/.generated')

/**
 * Resolve the public repository ref used by projected source links.
 *
 * @param environment Build environment containing an optional explicit public ref.
 * @returns The configured public ref, or `master`.
 */
export function resolveRepositoryRef(environment: NodeJS.ProcessEnv): string {
  return environment.DOCS_REPOSITORY_REF ?? 'master'
}

interface Replacement {
  start: number
  end: number
  value: string
}

type RewritableNode = Extract<Nodes, { type: 'link' | 'image' | 'definition' }>

/** Inputs for rewriting one canonical Markdown page. */
export interface RewriteMarkdownOptions {
  locale: DocsLocale
  sourcePath: string
  route: string
  pages: DocsPage[]
  repoRoot: string
  repositoryRef: string
  /**
   * Place one referenced image beside the projected page and return the URL to
   * reach it from that page. A GitHub raw URL cannot serve this repository —
   * `raw.githubusercontent.com` answers 404 for a private one, and no reader of
   * the site is authenticated to it — so an image travels into the generated
   * tree and Vite bundles it like any other site asset. Omitted by callers that
   * only rewrite text, which then leave images pointing at the repository.
   */
  placeImage?: (absPath: string) => string
}

function repoPath(absPath: string, repoRoot: string): string {
  return relative(repoRoot, absPath).split(sep).join('/')
}

// `#fragment` suffixes pass through verbatim. Generated cordis-surface
// headings carry explicit `<a id>` anchors with the GitHub slug, so those
// fragments resolve on the published site too; hand-written headings rely on
// VitePress's own slugger, which differs from GitHub's for punctuation-heavy
// text — hand-authored cross-page fragments should prefer plain-text headings
// or explicit anchors.
function decodePath(path: string): string {
  try {
    return decodeURIComponent(path)
  } catch {
    throw new Error(`docs-page: malformed percent escape in ${JSON.stringify(path)}.`)
  }
}

function routeTarget(fromRoute: string, toRoute: string, suffix: string): string {
  const target = posix.relative(posix.dirname(fromRoute), toRoute)
  return `${target.startsWith('.') ? target : `./${target}`}${suffix}`
}

function sourceMap(pages: DocsPage[]): Map<string, Map<DocsLocale, DocsPage>> {
  const map = new Map<string, Map<DocsLocale, DocsPage>>()
  for (const page of pages) {
    for (const source of [page.source, ...(page.sourceAliases ?? [])]) {
      const localized = map.get(source) ?? new Map<DocsLocale, DocsPage>()
      if (localized.has(page.locale)) {
        throw new Error(`docs-page: duplicate source or alias ${JSON.stringify(source)} for locale ${JSON.stringify(page.locale)}.`)
      }
      localized.set(page.locale, page)
      map.set(source, localized)
    }
  }
  return map
}

function counterpartSource(source: string): string {
  return source.endsWith('.zh.md')
    ? source.replace(/\.zh\.md$/, '.md')
    : source.replace(/\.md$/, '.zh.md')
}

function resolveRepositoryTarget(sourceAbs: string, rawPath: string, repoRoot: string): { absPath: string; line?: number } {
  const decoded = decodePath(rawPath)
  let absPath = resolve(dirname(sourceAbs), decoded)
  if (existsSync(absPath)) return { absPath }

  const lineMatch = decoded.match(/:(\d+)$/)
  if (lineMatch !== null) {
    const lineText = lineMatch[1]
    if (lineText === undefined) throw new Error('docs-page: line suffix matched without a line number.')
    absPath = resolve(dirname(sourceAbs), decoded.slice(0, -lineMatch[0].length))
    if (existsSync(absPath)) return { absPath, line: Number.parseInt(lineText, 10) }
  }

  if (extname(decoded) === '') {
    const markdown = resolve(dirname(sourceAbs), `${decoded}.md`)
    if (existsSync(markdown)) return { absPath: markdown }
    const index = resolve(dirname(sourceAbs), decoded, 'index.md')
    if (existsSync(index)) return { absPath: index }
  }

  throw new Error(`docs-page: ${repoPath(sourceAbs, repoRoot)} links to missing path ${JSON.stringify(rawPath)}.`)
}

function githubTarget(
  absPath: string,
  line: number | undefined,
  suffix: string,
  repositoryRef: string,
  repoRoot: string,
  image: boolean,
): string {
  const path = repoPath(absPath, repoRoot)
  if (image) return `https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/${repositoryRef}/${path}${suffix}`
  const kind = lstatSync(absPath).isDirectory() ? 'tree' : 'blob'
  const lineSuffix = line === undefined ? suffix : `#L${line}`
  return `${REPOSITORY_URL}/${kind}/${repositoryRef}/${path}${lineSuffix}`
}

/**
 * Rewrite repository-relative links without reserializing Markdown.
 *
 * @param source Markdown text from the canonical file.
 * @param options Source, route, manifest, and repository context.
 * @returns Markdown whose published links resolve inside the site or to GitHub.
 */
export function rewriteMarkdown(source: string, options: RewriteMarkdownOptions): string {
  const sourceAbs = resolve(options.repoRoot, options.sourcePath)
  const published = sourceMap(options.pages)
  const tree = fromMarkdown(source, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
  const replacements: Replacement[] = []

  const rewrite = (node: RewritableNode): void => {
    if (isExternalOrAbsoluteMarkdownUrl(node.url)) return
    const { path, suffix } = splitMarkdownUrlTarget(node.url)
    if (path === '') return
    const { absPath, line } = resolveRepositoryTarget(sourceAbs, path, options.repoRoot)
    const targetPath = repoPath(absPath, options.repoRoot)
    const isLanguageSwitcher = targetPath === counterpartSource(options.sourcePath)
    const targetLocale: DocsLocale = isLanguageSwitcher
      ? options.locale === 'root' ? 'en' : 'root'
      : options.locale
    const page = published.get(targetPath)?.get(targetLocale)
    const nextUrl = page !== undefined
      ? routeTarget(options.route, page.route, suffix)
      : node.type === 'image' && options.placeImage !== undefined
        // The suffix rides along exactly as the GitHub branch keeps it: an SVG
        // view fragment or a Vite query changes what the reference means.
        ? `${options.placeImage(absPath)}${suffix}`
        : githubTarget(absPath, line, suffix, options.repositoryRef, options.repoRoot, node.type === 'image')

    const destination = markdownDestination(source, node)
    replacements.push({
      start: destination.start,
      end: destination.end,
      value: nextUrl,
    })
  }

  const visit = (node: Nodes): void => {
    if ((node.type === 'link' || node.type === 'image' || node.type === 'definition') && 'url' in node) rewrite(node)
    if ('children' in node) {
      for (const child of node.children) visit(child)
    }
  }
  visit(tree)

  let projected = source
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    projected = projected.slice(0, replacement.start) + replacement.value + projected.slice(replacement.end)
  }
  return projected
}

/**
 * Record canonical edit and raw-Markdown targets in VitePress frontmatter.
 *
 * @param markdown Projected Markdown content.
 * @param page Publication manifest entry for the content.
 * @returns Markdown with projection-owned frontmatter fields.
 */
export function addProjectionFrontmatter(markdown: string, page: Pick<DocsPage, 'source' | 'outline' | 'route' | 'sidebar'>): string {
  const fields = [
    `editSource: ${JSON.stringify(page.source)}`,
    ...(page.sidebar === null ? [] : [`rawMarkdownPath: ${JSON.stringify(page.route)}`]),
    ...(page.outline === undefined ? [] : [`outline: ${JSON.stringify(page.outline)}`]),
  ].join('\n')
  if (markdown.startsWith('---\n')) return markdown.replace('---\n', `---\n${fields}\n`)
  return `---\n${fields}\n---\n\n${markdown}`
}

/** The switcher line a canonical page carries so its GitHub reader can reach the other language. */
const LANGUAGE_SWITCHER = /^(?:English \| \[中文\]\([^)]*\)|\[English\]\([^)]*\) \| 中文)$/

/** The repository badge a canonical page carries for its GitHub reader. */
const REPOSITORY_BADGE = /^\[!\[[^\]]*\]\(https:\/\/img\.shields\.io\/[^)]*\)\]\([^)]*\)$/

/**
 * Drop the lines that address a canonical page's GitHub reader.
 *
 * The site carries a locale switcher in its navigation bar and links the
 * repository from every page, so projecting these lines would repeat both — the
 * switcher as the first element under each heading.
 *
 * @param markdown Rewritten canonical Markdown content.
 * @returns The content without the switcher line or the repository badge.
 */
function withoutRepositoryChrome(markdown: string): string {
  const lines = markdown.split('\n')
  const switcher = lines.findIndex(line => LANGUAGE_SWITCHER.test(line))
  // Only the switcher introducing the page qualifies; further down the same
  // text is prose or a sample rather than the page's own header.
  if (switcher !== -1 && switcher < 8) {
    lines.splice(switcher, lines[switcher + 1] === '' ? 2 : 1)
  }
  const badge = lines.findLastIndex(line => REPOSITORY_BADGE.test(line))
  if (badge !== -1) {
    lines.splice(lines[badge - 1] === '' ? badge - 1 : badge, lines[badge - 1] === '' ? 2 : 1)
  }
  return lines.join('\n')
}

/**
 * Select the Markdown rendered for one published page.
 *
 * @param markdown Rewritten canonical Markdown content.
 * @param page Publication manifest entry for the content.
 * @returns Full Markdown for ordinary pages or frontmatter-only Markdown for a locale home page.
 */
export function projectedPageContent(markdown: string, page: DocsPage): string {
  if (page.sidebar !== null) return withoutRepositoryChrome(markdown)
  if (!markdown.startsWith('---\n')) {
    throw new Error(`docs-page: locale home source ${JSON.stringify(page.source)} must start with YAML frontmatter.`)
  }
  const closingDelimiter = '\n---\n'
  const closing = markdown.indexOf(closingDelimiter, 4)
  if (closing === -1) {
    throw new Error(`docs-page: locale home source ${JSON.stringify(page.source)} has unclosed YAML frontmatter.`)
  }
  return markdown.slice(0, closing + closingDelimiter.length)
}

/**
 * The repository file one image reference resolves to, or `undefined` when the
 * target is not a local file this build may publish.
 * @param absPath - resolved image target.
 * @param repoRoot - repository root every published image must stay inside.
 * @returns the file's real path, or `undefined` when it must not be copied.
 *
 * Only a regular file whose real path stays inside the repository qualifies.
 * Publication copies the bytes into the site, so a reference escaping the
 * repository — `../../.ssh/id_rsa`, or a symlink pointing out of the tree —
 * would put a build-machine file on the site; `existsSync` alone, which is all
 * link resolution needs, does not answer that.
 */
export function publishableImage(absPath: string, repoRoot: string): string | undefined {
  const real = realpathSync(absPath)
  const inside = real === repoRoot || real.startsWith(`${repoRoot}${sep}`)
  return inside && statSync(real).isFile() ? real : undefined
}

/** Every local image a published page references, resolved to its repository file. */
function referencedImages(): string[] {
  const found = new Set<string>()
  for (const page of docsPages) {
    const sourceAbs = resolve(root, page.source)
    if (!existsSync(sourceAbs)) continue
    rewriteMarkdown(readFileSync(sourceAbs, 'utf8'), {
      sourcePath: page.source,
      locale: page.locale,
      route: page.route,
      pages: docsPages,
      repoRoot: root,
      repositoryRef: 'master',
      placeImage: (absPath) => {
        const real = publishableImage(absPath, root)
        if (real !== undefined) found.add(real)
        return ''
      },
    })
  }
  return [...found]
}

/**
 * Files watched by the local VitePress dev server: every canonical Markdown
 * source, plus the images they publish. Without the images, replacing a
 * screenshot leaves the previous copy in the generated tree until something
 * touches the Markdown beside it.
 */
export function docsSourceFiles(): string[] {
  return [...new Set([...docsPages.map(page => resolve(root, page.source)), ...referencedImages()])]
}

/** Manifest and repository inputs for one projection pass. */
export interface ProjectionContext {
  /** Pages to project. */
  pages: DocsPage[]
  /** Repository root every source and placed image must live under. */
  repoRoot: string
  /** Public ref used by projected GitHub links. */
  repositoryRef: string
}

function defaultProjectionContext(): ProjectionContext {
  return { pages: docsPages, repoRoot: root, repositoryRef: resolveRepositoryRef(process.env) }
}

/**
 * Project every page and its images into one target tree.
 *
 * `entries` are what gets emitted; link resolution always reads the canonical
 * `context.pages`, so an alias entry sharing a source with its index route
 * emits at its own path while links keep targeting canonical routes.
 */
function projectPagesInto(
  targetRoot: string,
  context: ProjectionContext,
  pageContent: (markdown: string, page: DocsPage) => string,
  entries: DocsPage[] = context.pages,
): void {
  const routes = new Set<string>()
  /** Projected path to the repository file that claimed it, pages and images alike. */
  const claimed = new Map<string, string>()

  /** Reserve one projected path, refusing a second source for it. */
  const claim = (target: string, sourceAbs: string): void => {
    const holder = claimed.get(target)
    if (holder !== undefined && holder !== sourceAbs) {
      throw new Error(
        `docs-page: ${repoPath(sourceAbs, context.repoRoot)} and ${repoPath(holder, context.repoRoot)}`
        + ` both project to ${relative(targetRoot, target).split(sep).join('/')}.`,
      )
    }
    // A file the projection did not claim is another producer's output — in
    // the twin pass, the build VitePress just wrote, including `public/`
    // copies. Overwriting one would silently corrupt the site.
    if (holder === undefined && existsSync(target)) {
      throw new Error(
        `docs-page: ${repoPath(sourceAbs, context.repoRoot)} would overwrite existing build file`
        + ` ${relative(targetRoot, target).split(sep).join('/')}.`,
      )
    }
    claimed.set(target, sourceAbs)
  }

  for (const page of entries) {
    if (routes.has(page.route)) throw new Error(`docs-page: duplicate route ${JSON.stringify(page.route)}.`)
    routes.add(page.route)
    const sourceAbs = resolve(context.repoRoot, page.source)
    if (!existsSync(sourceAbs) || !lstatSync(sourceAbs).isFile()) {
      throw new Error(`docs-page: source ${JSON.stringify(page.source)} does not exist or is not a file.`)
    }
    const output = resolve(targetRoot, page.route)
    // Claimed before the images are placed: a page and an image landing on one
    // path would otherwise overwrite each other in whichever order they ran.
    claim(output, sourceAbs)
    mkdirSync(dirname(output), { recursive: true })
    const markdown = readFileSync(sourceAbs, 'utf8')
    const projected = rewriteMarkdown(markdown, {
      sourcePath: page.source,
      locale: page.locale,
      route: page.route,
      pages: context.pages,
      repoRoot: context.repoRoot,
      repositoryRef: context.repositoryRef,
      placeImage: (absPath) => {
        const real = publishableImage(absPath, context.repoRoot)
        if (real === undefined) {
          throw new Error(
            `docs-page: ${page.source} references image ${repoPath(absPath, context.repoRoot)},`
            + ' which is not a regular file inside the repository.',
          )
        }
        // Beside the page that references it, under its own basename: each
        // locale's route tree gets its own copy, so one relative URL is correct
        // from both.
        const name = basename(real)
        const target = resolve(dirname(output), name)
        claim(target, real)
        copyFileSync(real, target)
        // Encoded because the destination is a Markdown inline target, where an
        // unescaped space would end it early.
        return `./${encodeURI(name)}`
      },
    })
    writeFileSync(output, pageContent(projected, page))
  }
}

/** Rebuild the disposable VitePress source tree from the publication manifest. */
export function projectDocs(): void {
  rmSync(generatedRoot, { recursive: true, force: true })
  projectPagesInto(generatedRoot, defaultProjectionContext(), (markdown, page) =>
    addProjectionFrontmatter(projectedPageContent(markdown, page), page))
}

/**
 * Strip the leading YAML frontmatter of a projected page.
 *
 * @param markdown Rewritten canonical Markdown content.
 * @param source Repository-relative page source, named by the failure.
 * @returns The content after the frontmatter block, or the input when none opens it.
 */
function withoutFrontmatter(markdown: string, source: string): string {
  if (!markdown.startsWith('---\n')) return markdown
  const closingDelimiter = '\n---\n'
  const closing = markdown.indexOf(closingDelimiter, 4)
  if (closing === -1) {
    throw new Error(`docs-page: ${JSON.stringify(source)} has unclosed YAML frontmatter.`)
  }
  return markdown.slice(closing + closingDelimiter.length).replace(/^\n+/, '')
}

/**
 * The raw-Markdown twin of one published page.
 *
 * Frontmatter is VitePress rendering configuration and is dropped. A locale
 * home page therefore keeps its body here, while the rendered site truncates
 * it to the frontmatter redirect.
 *
 * @param markdown Rewritten canonical Markdown content.
 * @param source Repository-relative page source, named by frontmatter failures.
 * @returns Plain Markdown without frontmatter or repository chrome.
 */
export function rawMarkdownPageContent(markdown: string, source: string): string {
  return withoutRepositoryChrome(withoutFrontmatter(markdown, source))
}

/**
 * Parent-level alias route of an index route, or `undefined` for other routes.
 *
 * The rendered site shows an index route as a directory URL, so "append
 * `.md`" naturally lands on `<dir>.md` once the trailing slash is dropped.
 * The root `index.md` has no parent to alias into.
 */
function indexAliasRoute(route: string): string | undefined {
  const match = /^(.+)\/index\.md$/.exec(route)
  return match?.[1] === undefined ? undefined : `${match[1]}.md`
}

/**
 * Site-relative Markdown files the raw-Markdown projection emits: every
 * route, plus one parent-level alias per index route.
 *
 * @param pages Pages to project, defaulting to the publication manifest.
 * @returns The emitted paths, routes first.
 */
export function rawMarkdownFiles(pages: DocsPage[] = docsPages): string[] {
  const aliases = pages.map(page => indexAliasRoute(page.route)).filter(alias => alias !== undefined)
  return [...pages.map(page => page.route), ...aliases]
}

/**
 * Emit the raw-Markdown twin of every published route into a built site, so
 * static hosting serves the page's URL, minus any trailing slash, plus `.md`
 * as plain Markdown. Each index route also emits a parent-level alias twin,
 * projected over the alias route so its relative links stay correct.
 * Referenced images are copied beside the pages, keeping the same relative
 * URLs valid in both trees. Existing build files stay in place, and a name
 * collision with one fails the emission. Markdown files carry a UTF-8 BOM so
 * browser navigation decodes them even when static hosting omits a charset.
 *
 * @param outDir Build output directory to emit into.
 * @param context Manifest and repository inputs, defaulting to this repository.
 */
export function emitRawMarkdownPages(outDir: string, context: ProjectionContext = defaultProjectionContext()): void {
  const aliases = context.pages.flatMap((page) => {
    const alias = indexAliasRoute(page.route)
    return alias === undefined ? [] : [{ ...page, route: alias }]
  })
  projectPagesInto(
    outDir,
    context,
    (markdown, page) => `\uFEFF${rawMarkdownPageContent(markdown, page.source)}`,
    [...context.pages, ...aliases],
  )
}

/**
 * Raw Markdown served for one site route.
 *
 * Dev-server counterpart of {@link emitRawMarkdownPages}: images are not
 * copied because the generated tree already serves them beside the page.
 *
 * @param route Manifest route, including its `.md` suffix.
 * @param context Manifest and repository inputs, defaulting to this repository.
 * @returns The projected page, or `undefined` when the manifest does not publish the route.
 */
export function rawMarkdownRoute(route: string, context: ProjectionContext = defaultProjectionContext()): string | undefined {
  const page = context.pages.find(candidate => candidate.route === route)
  if (page === undefined) return undefined
  const markdown = readFileSync(resolve(context.repoRoot, page.source), 'utf8')
  return rawMarkdownPageContent(rewriteMarkdown(markdown, {
    sourcePath: page.source,
    locale: page.locale,
    route: page.route,
    pages: context.pages,
    repoRoot: context.repoRoot,
    repositoryRef: context.repositoryRef,
    placeImage: absPath => `./${encodeURI(basename(absPath))}`,
  }), page.source)
}

/** Site identity written into llms.txt. */
export interface LlmsTxtSite {
  /** Site base path, carrying the leading and trailing slashes VitePress requires. */
  base: string
  /** Site title. */
  title: string
  /** Site description. */
  description: string
}

/** Locale groups llms.txt lists, in the order the site's navigation presents them. */
const llmsTxtLocales: readonly { heading: string; locale: DocsLocale }[] = [
  { heading: '简体中文', locale: 'root' },
  { heading: 'English', locale: 'en' },
]

/**
 * The llms.txt index of every published page's raw-Markdown twin.
 *
 * Links are site-absolute so an agent resolves them against the host it
 * fetched llms.txt from; locale home pages stay out because this file is the
 * agent-facing entry point itself.
 *
 * @param site Site identity and base path.
 * @returns llms.txt content listing both locale trees.
 */
export function llmsTxt(site: LlmsTxtSite): string {
  const lines = [
    `# ${site.title}`,
    '',
    `> ${site.description}`,
    '',
    '页面 URL 去掉末尾斜杠再加 `.md` 即为该页原始 Markdown(根路径用 `/index.md`);下方列表是各页精确地址。Drop any trailing slash and append `.md` to a page URL for its raw Markdown (the site root is `/index.md`); the list below carries the exact addresses.',
  ]
  for (const { heading, locale } of llmsTxtLocales) {
    lines.push('', `## ${heading}`, '')
    for (const collection of localeCollections[locale]) {
      for (const page of orderedPages(locale, collection)) {
        lines.push(`- [${page.label}](${site.base}${page.route}): ${page.section}`)
      }
    }
  }
  return `${lines.join('\n')}\n`
}

// ---------------------------------------------------------------------------
// Post-build fragment verification
// ---------------------------------------------------------------------------

/** One fragment reference that does not resolve in the built site. */
export interface BrokenSiteFragment {
  /** HTML file containing the link. */
  source: string
  /** Link value as emitted by VitePress. */
  href: string
  /** Built HTML target, or `undefined` when the route was not emitted. */
  target?: string
  /** Decoded fragment id requested by the link. */
  fragment: string
}

/** Result of checking every fragment-bearing anchor in a built site. */
export interface SiteFragmentReport {
  /** Number of internal fragment references inspected. */
  checked: number
  /** References whose route or fragment id is absent. */
  broken: BrokenSiteFragment[]
}

interface BuiltPage {
  file: string
  route: string
  ids: Set<string>
  document: Document
}

function posixPath(path: string): string {
  return path.split(sep).join('/')
}

function routeFor(file: string): string {
  if (file === 'index.html') return '/'
  if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`
  return `/${file.slice(0, -'.html'.length)}`
}

function aliasesFor(page: BuiltPage): string[] {
  if (page.route === '/') return ['/', '/index', '/index.html']
  if (page.route.endsWith('/')) {
    const stem = page.route.slice(0, -1)
    return [page.route, stem, `${stem}/index`, `${stem}/index.html`]
  }
  return [page.route, `${page.route}.html`]
}

function decodedFragment(hash: string): string {
  try {
    return decodeURIComponent(hash.slice(1))
  } catch (error) {
    if (!(error instanceof URIError)) throw error
    // URIError means malformed percent encoding; preserve the literal id for comparison.
    return hash.slice(1)
  }
}

/**
 * Check fragment-bearing links in a VitePress output directory.
 *
 * @param distRoot - Directory containing generated HTML files.
 * @returns Counted internal links and every unresolved target.
 */
export function inspectSiteFragments(distRoot: string): SiteFragmentReport {
  const files = globSync('**/*.html', { cwd: distRoot }).map(posixPath).sort()
  if (files.length === 0) {
    throw new Error(`docs-page: no HTML files found under ${distRoot}; run docs:build first.`)
  }
  const pages: BuiltPage[] = files.map((file) => {
    const document = new JSDOM(readFileSync(resolve(distRoot, file), 'utf8')).window.document
    const ids = new Set<string>()
    for (const element of document.querySelectorAll<HTMLElement>('[id]')) ids.add(element.id)
    for (const element of document.querySelectorAll<HTMLAnchorElement>('a[name]')) {
      const name = element.getAttribute('name')
      if (name !== null) ids.add(name)
    }
    return { file, route: routeFor(file), ids, document }
  })

  const byRoute = new Map<string, BuiltPage>()
  for (const page of pages) {
    for (const alias of aliasesFor(page)) {
      const existing = byRoute.get(alias)
      if (existing !== undefined && existing !== page) {
        throw new Error(
          `docs-page: built pages ${existing.file} and ${page.file} share route ${JSON.stringify(alias)}.`,
        )
      }
      byRoute.set(alias, page)
    }
  }

  const origin = 'https://dsh-docs.invalid'
  const broken: BrokenSiteFragment[] = []
  let checked = 0
  for (const page of pages) {
    for (const anchor of page.document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const href = anchor.getAttribute('href')
      if (href === null || !href.includes('#')) continue
      let targetUrl: URL
      try {
        targetUrl = new URL(href, `${origin}${page.route}`)
      } catch (error) {
        throw new Error(
          `docs-page: ${page.file} has invalid fragment href ${JSON.stringify(href)}.`,
          { cause: error },
        )
      }
      if (targetUrl.origin !== origin || targetUrl.hash === '') continue
      const fragment = decodedFragment(targetUrl.hash)
      if (fragment === '') continue
      checked++
      const target = byRoute.get(targetUrl.pathname)
      if (target === undefined || !target.ids.has(fragment)) {
        broken.push({
          source: page.file,
          href,
          ...(target === undefined ? {} : { target: target.file }),
          fragment,
        })
      }
    }
  }
  return { checked, broken }
}

/**
 * Expected files a build did not emit.
 *
 * @param distRoot - Directory containing the built site.
 * @param expected - Site-relative files the build must carry.
 * @returns The absent files, in the given order.
 */
export function missingSiteFiles(distRoot: string, expected: readonly string[]): string[] {
  return expected.filter(file => !existsSync(resolve(distRoot, file)))
}

function main(): number {
  const distRoot = resolve(root, 'website/.dist')
  const report = inspectSiteFragments(distRoot)
  const expected = rawMarkdownFiles()
  const missing = missingSiteFiles(distRoot, [...expected, 'llms.txt'])
  if (report.broken.length === 0 && missing.length === 0) {
    console.log(
      `docs-page: ${report.checked} internal fragment reference(s) resolve;`
      + ` ${expected.length} raw-Markdown file(s) and llms.txt emitted.`,
    )
    return 0
  }

  if (report.broken.length > 0) {
    console.error(`docs-page: ${report.broken.length} broken fragment reference(s):`)
    for (const item of report.broken) {
      const target = item.target === undefined ? 'target route was not built' : `${item.target} has no id ${JSON.stringify(item.fragment)}`
      console.error(`  ${item.source}: ${JSON.stringify(item.href)} (${target})`)
    }
  }
  if (missing.length > 0) {
    console.error(`docs-page: ${missing.length} expected raw-Markdown file(s) missing from the build:`)
    for (const file of missing) console.error(`  ${file}`)
  }
  return 1
}

if (import.meta.main) process.exitCode = main()
