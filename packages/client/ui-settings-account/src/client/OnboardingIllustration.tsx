/** Paired artwork follows the page's light and dark theme selectors. */
import css from './DesktopOnboarding.module.css'

/** @param props - artwork URLs and feature-owned geometry. @returns decorative theme variants. */
export function OnboardingIllustration({ className = '', src, darkSrc, srcSet, darkSrcSet, sizes }: {
  className?: string | undefined
  src: string
  darkSrc: string
  srcSet?: string
  darkSrcSet?: string
  sizes?: string
}) {
  return <div className={`${css.illustration} ${className}`} aria-hidden="true">
    <img className={css.lightIllustration} src={src} srcSet={srcSet} sizes={sizes} alt="" />
    <img className={css.darkIllustration} src={darkSrc} srcSet={darkSrcSet} sizes={sizes} alt="" />
  </div>
}
