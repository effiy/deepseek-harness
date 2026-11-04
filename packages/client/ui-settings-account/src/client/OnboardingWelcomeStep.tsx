/** Welcome page with a required explicit start. */
import { useEffect, useState, type RefObject } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DesktopOnboardingProps } from './onboarding-contract.ts'
import { OnboardingIllustration } from './OnboardingIllustration.tsx'
import css from './DesktopOnboarding.module.css'

/**
 * Lazy-load the welcome illustration for the user's locale.
 *
 * The PNGs are large (~500 KB each, 8 total across two steps).  Static
 * imports would base64-inline them into the main JS bundle, adding ~4.9 MB.
 * Dynamic `import()` creates a separate chunk per image, so the browser
 * fetches only the two variants (light + dark) for the current locale, and
 * only when the onboarding step actually renders.
 */
function useWelcomeImages(locale: string) {
  const [light, setLight] = useState<string>()
  const [dark, setDark] = useState<string>()

  useEffect(() => {
    let cancelled = false
    const isZh = locale === 'zh'
    Promise.all([
      isZh
        ? import('./assets/onboarding-welcome-zh.png')
        : import('./assets/onboarding-welcome.png'),
      isZh
        ? import('./assets/onboarding-welcome-zh-dark.png')
        : import('./assets/onboarding-welcome-dark.png'),
    ]).then(([lightMod, darkMod]) => {
      if (!cancelled) {
        setLight((lightMod as { default: string }).default)
        setDark((darkMod as { default: string }).default)
      }
    })
    return () => { cancelled = true }
  }, [locale])

  return { art: light, artDark: dark }
}

/** @param props - localized content, focus target and navigation. @returns the welcome step. */
export function OnboardingWelcomeStep({ t, locale, heading, busy, onStart }: Pick<DesktopOnboardingProps, 't' | 'locale'> & {
  heading: RefObject<HTMLHeadingElement>
  busy: boolean
  onStart: () => void
}) {
  const { art, artDark } = useWelcomeImages(locale)

  return <div className={`${css.content} ${css.welcome}`}>
    <div className={css.copy}>
      <h1 id="desktop-onboarding-title" ref={heading} tabIndex={-1}>{t('onboardingWelcome')} <em className={css.brand}>{t('onboardingBrand')}</em></h1>
      <p className={css.heroDescription}>{t('onboardingIntroduction')}</p>
      <Button variant="primary" className={`${css.action} ${css.start}`} disabled={busy} onClick={onStart}>{t('onboardingStart')}</Button>
    </div>
    {art !== undefined && artDark !== undefined && (
      <div className={css.welcomeIllustration} aria-hidden="true">
        <OnboardingIllustration className={css.welcomeArtwork} src={art} darkSrc={artDark} />
      </div>
    )}
  </div>
}
