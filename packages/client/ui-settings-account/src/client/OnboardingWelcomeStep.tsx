/** Welcome page with a required explicit start. */
import { type RefObject } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DesktopOnboardingProps } from './onboarding-contract.ts'
import { OnboardingIllustration } from './OnboardingIllustration.tsx'
import css from './DesktopOnboarding.module.css'

/** Base path for onboarding illustration static assets served from the web public root. */
const ILLUSTRATION_BASE = '/assets/onboarding'

/**
 * Resolve welcome illustration URLs for the user's locale.
 *
 * Images are static PNG files under {@link ILLUSTRATION_BASE}, served with
 * standard HTTP caching and brotli compression by the frontend-static server.
 * Two resolution tiers via srcSet: 1125px for mobile (3× retina safe) and the
 * original 3993px for desktop (2× retina safe).  The browser picks the
 * appropriate source based on viewport width and device pixel ratio.
 */
function useWelcomeImages(locale: string) {
  const isZh = locale === 'zh'
  const suffix = isZh ? '-zh' : ''
  const base = `${ILLUSTRATION_BASE}/onboarding-welcome${suffix}`
  return {
    art: `${base}.png`,
    artDark: `${base}-dark.png`,
    srcSet: `${base}.png 1125w, ${base}@2x.png 3993w`,
    darkSrcSet: `${base}-dark.png 1125w, ${base}-dark@2x.png 3993w`,
    sizes: '(max-width: 900px) 100vw, 50vw',
  }
}

/** @param props - localized content, focus target and navigation. @returns the welcome step. */
export function OnboardingWelcomeStep({ t, locale, heading, busy, onStart }: Pick<DesktopOnboardingProps, 't' | 'locale'> & {
  heading: RefObject<HTMLHeadingElement>
  busy: boolean
  onStart: () => void
}) {
  const { art, artDark, srcSet, darkSrcSet, sizes } = useWelcomeImages(locale)

  return <div className={`${css.content} ${css.welcome}`}>
    <div className={css.copy}>
      <h1 id="desktop-onboarding-title" ref={heading} tabIndex={-1}>{t('onboardingWelcome')} <em className={css.brand}>{t('onboardingBrand')}</em></h1>
      <p className={css.heroDescription}>{t('onboardingIntroduction')}</p>
      <Button variant="primary" className={`${css.action} ${css.start}`} disabled={busy} onClick={onStart}>{t('onboardingStart')}</Button>
    </div>
    {art !== undefined && artDark !== undefined && (
      <div className={css.welcomeIllustration} aria-hidden="true">
        <OnboardingIllustration className={css.welcomeArtwork} src={art} darkSrc={artDark} srcSet={srcSet} darkSrcSet={darkSrcSet} sizes={sizes} />
      </div>
    )}
  </div>
}
