/** One retained Markdown renderer over the document owner's accumulated text. */
import { lazy, Suspense, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { MarkdownDelegateProvider, MarkdownText, type MarkdownLabels, type MarkdownPathImages } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { isAbsoluteWorkspacePath } from '@deepseek-ai/dsh-util-workspace-path'
import type { DocumentPreviewProps } from '../document/contract.ts'
import { splitFrontmatter } from './frontmatter.ts'
import type { FrontmatterFieldsProps } from './frontmatter-fields.tsx'
import { markdownImageUrl } from './path-images.ts'
import type {} from './locales.ts'
import css from './MarkdownBody.module.css'

/**
 * Resolve a file-relative path containing `..` segments against a base file's
 * directory.  Absolute and already-normalised paths are handled upstream.
 * @param basePath - absolute path of the base file (e.g. `/home/a/b/c.md`).
 * @param relativePath - relative destination (e.g. `../../d/e.md`).
 * @returns the joined and normalised absolute path.
 */
function resolveRelativePath(basePath: string, relativePath: string): string {
  // Strip the filename from the base path.
  const baseDir = basePath.replace(/\\/g, '/').replace(/\/[^/]*$/, '')
  const parts = baseDir.split('/')
  for (const segment of relativePath.replace(/\\/g, '/').split('/')) {
    if (segment === '..') {
      if (parts.length > 1) parts.pop()
    } else if (segment !== '.' && segment !== '') {
      parts.push(segment)
    }
  }
  return parts.join('/')
}

/** Show the verbatim frontmatter when the field-list chunk cannot load. */
function FrontmatterFallback({ fallback }: FrontmatterFieldsProps): ReactNode {
  return fallback
}

const FrontmatterFields = lazy(() => import('./frontmatter-fields.tsx').then(
  module => ({ default: module.FrontmatterFields }),
  // The failed chunk only removes the field layout; the body and verbatim metadata stay usable.
  () => ({ default: FrontmatterFallback }),
))

/** Standard document inputs and this implementation's locale. */
export type MarkdownBodyProps = DocumentPreviewProps & PropsLocale<'documentMarkdown'>

/**
 * Render one accumulated document; EOF completes the primitive's full parse.
 * A leading YAML frontmatter block renders as a field list instead of Markdown; its
 * verbatim source stands in while the field-list chunk loads or when it fails.
 * File-relative link destinations are resolved against this file's directory
 * and opened through the Sidebar preview.
 * @param props - owner-loaded contents, file opener, and localized primitive labels.
 * @returns Markdown content, or nothing for a non-text delivery.
 */
export function MarkdownBody({ content, resourceAddress, useResource, openFile, t }: MarkdownBodyProps): ReactNode {
  const absolutePath = useResource<'file'>(resourceAddress).value?.absolutePath
  // Resolve file-relative Markdown link destinations against this file's
  // directory; absolute paths are used as-is.  When the base file's absolute
  // path is still unknown the relative path stays unresolved (the Host will
  // resolve it against the workspace root).
  const resolvedOpenFile = useCallback((path: string, options?: { line?: number }) => {
    const resolved = absolutePath !== undefined && !isAbsoluteWorkspacePath(path)
      ? resolveRelativePath(absolutePath, path)
      : path
    openFile(resolved, options)
  }, [absolutePath, openFile])
  const pathImages = useMemo<MarkdownPathImages>(() => ({
    resolve: value => markdownImageUrl(document.baseURI, absolutePath, value),
  }), [absolutePath])
  const copyLabel = t('code.copy')
  const copiedLabel = t('code.copied')
  const footnotes = t('footnotes')
  const codeLabel = t('codeBlock.title')
  const wrapLabel = t('codeBlock.wrap')
  const unwrapLabel = t('codeBlock.unwrap')
  const labels = useMemo<MarkdownLabels>(() => ({
    code: { copyLabel, copiedLabel, toolbarLabels: { codeLabel, wrapLabel, unwrapLabel } }, footnotes,
  }), [copyLabel, copiedLabel, footnotes, codeLabel, wrapLabel, unwrapLabel])
  const text = content.kind === 'text' ? content.text : ''
  const split = useMemo(() => splitFrontmatter(text), [text])
  if (content.kind !== 'text') return null
  return (
    <div className={css.document} data-document-markdown>
      {split === undefined ? null : <FrontmatterBox source={split.source} />}
      <MarkdownDelegateProvider openFile={resolvedOpenFile}>
        <MarkdownText text={split?.body ?? text} streaming={!content.eof} labels={labels} pathImages={pathImages} />
      </MarkdownDelegateProvider>
    </div>
  )
}

/**
 * Frame one frontmatter block and choose its field list or verbatim source.
 * @param props - YAML between the frontmatter delimiters.
 * @returns the metadata box; it collapses when the document has no content.
 */
function FrontmatterBox({ source }: { source: string }): ReactNode {
  const verbatim = <pre className={css.frontmatterSource}>{source}</pre>
  return (
    <div className={css.frontmatter} data-document-frontmatter>
      <Suspense fallback={verbatim}><FrontmatterFields source={source} fallback={verbatim} /></Suspense>
    </div>
  )
}
