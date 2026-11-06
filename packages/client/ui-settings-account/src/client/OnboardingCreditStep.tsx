/** Credit introduction retains the action ordering selected on first entry. */
import { type RefObject } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DesktopOnboardingProps } from './onboarding-contract.ts'
import { OnboardingIllustration } from './OnboardingIllustration.tsx'
import css from './DesktopOnboarding.module.css'

/** Base path for onboarding illustration static assets served from the web public root. */
const ILLUSTRATION_BASE = '/assets/onboarding'

/**
 * Resolve credit illustration URLs for the user's locale.
 *
 * Same static-file strategy as {@link OnboardingWelcomeStep}: PNGs are served
 * as standard assets under {@link ILLUSTRATION_BASE}, avoiding base64 encoding
 * and its 33 % size tax.
 */
function useCreditImages(locale: string) {
  const isZh = locale === 'zh'
  const suffix = isZh ? '-zh' : ''
  return {
    art: `${ILLUSTRATION_BASE}/onboarding-recharge${suffix}.png`,
    artDark: `${ILLUSTRATION_BASE}/onboarding-recharge${suffix}-dark.png`,
  }
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
