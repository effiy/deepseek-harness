/** Credit introduction retains the action ordering selected on first entry. */
import { useEffect, useState, type RefObject } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DesktopOnboardingProps } from './onboarding-contract.ts'
import { OnboardingIllustration } from './OnboardingIllustration.tsx'
import css from './DesktopOnboarding.module.css'

/**
 * Lazy-load the credit illustration for the user's locale.
 *
 * Same strategy as {@link OnboardingWelcomeStep}: dynamic `import()` creates
 * a separate chunk per image, so only the two variants for the current locale
 * are fetched and only when the credit step renders.
 */
function useCreditImages(locale: string) {
  const [light, setLight] = useState<string>()
  const [dark, setDark] = useState<string>()

  useEffect(() => {
    let cancelled = false
    const isZh = locale === 'zh'
    Promise.all([
      isZh
        ? import('./assets/onboarding-recharge-zh.png')
        : import('./assets/onboarding-recharge.png'),
      isZh
        ? import('./assets/onboarding-recharge-zh-dark.png')
        : import('./assets/onboarding-recharge-dark.png'),
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

/** @param props - credit facts, localized content and recharge/navigation actions. @returns the credit step. */
export function OnboardingCreditStep({ t, locale, heading, busy, funded, canRecharge, onContinue, onRecharge, onLater }:
  Pick<DesktopOnboardingProps, 't' | 'locale'> & {
    heading: RefObject<HTMLHeadingElement>
    busy: boolean
    funded: boolean
    canRecharge: boolean
    onContinue: () => void
    onRecharge: () => void
    onLater: () => void
  }) {
  const { art, artDark } = useCreditImages(locale)

  return <div className={`${css.content} ${css.credit}`}>
    {art !== undefined && artDark !== undefined && (
      <OnboardingIllustration className={css.creditIllustration} src={art} darkSrc={artDark} />
    )}
    <div className={css.copy}>
      <h1 id="desktop-onboarding-title" ref={heading} tabIndex={-1}>{t('onboardingCredit')}</h1>
      <p className={css.heroDescription}>{t('onboardingCreditDescription')}</p>
      <div className={css.creditActions}>
        <Button className={css.action} variant="primary" disabled={busy || (!funded && !canRecharge)} onClick={funded ? onContinue : onRecharge}>{t(funded ? 'onboardingContinue' : 'onboardingTopUp')}</Button>
        <Button variant="outline" className={`${css.action} ${css.laterAction}`} disabled={busy || (funded && !canRecharge)} onClick={funded ? onRecharge : onLater}>{t(funded ? 'onboardingFundedTopUp' : 'onboardingLater')}</Button>
      </div>
    </div>
  </div>
}
