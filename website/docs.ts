/**
 * Canonical publication manifest for the documentation website.
 *
 * This file re-exports the unified docs-page module that owns every
 * definition for the documentation site: page types, the publication
 * manifest, sidebar functions, Markdown projection, and verification.
 *
 * @deprecated Import directly from `scripts/docs-page.ts` instead.
 */
export {
  type DocsLocale,
  type DocsSidebar,
  type DocsPage,
  type DocsSection,
  type LlmsTxtSite,
  type RewriteMarkdownOptions,
  type ProjectionContext,
  type BrokenSiteFragment,
  type SiteFragmentReport,
  docsPages,
  localeCollections,
  orderedPages,
  sectionSpec,
  routeLink,
  landingLink,
  resolveRepositoryRef,
  rewriteMarkdown,
  addProjectionFrontmatter,
  projectedPageContent,
  publishableImage,
  docsSourceFiles,
  projectDocs,
  rawMarkdownPageContent,
  rawMarkdownFiles,
  emitRawMarkdownPages,
  rawMarkdownRoute,
  llmsTxt,
  inspectSiteFragments,
  missingSiteFiles,
} from '../scripts/docs-page.ts'
