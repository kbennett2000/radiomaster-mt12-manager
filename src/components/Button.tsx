import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

interface Look {
  /** 'primary' is for the one main action on a screen. */
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  /** 'small' is for actions that repeat on every row of a list. */
  size?: 'small' | 'medium' | 'large'
  /** An icon to show before the words. Buttons always have words. */
  icon?: ReactNode
}

function classFor({ variant = 'secondary', size = 'medium' }: Look, extra?: string): string {
  return [styles.button, styles[variant], styles[size], extra].filter(Boolean).join(' ')
}

export function Button({
  variant,
  size,
  icon,
  children,
  className,
  type = 'button',
  ...rest
}: Look & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={classFor({ variant, size }, className)} {...rest}>
      {icon}
      <span>{children}</span>
    </button>
  )
}

/** A link that looks like a button, for actions that go to another page. */
export function ButtonLink({
  variant,
  size,
  icon,
  children,
  className,
  ...rest
}: Look & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={classFor({ variant, size }, className)} {...rest}>
      {icon}
      <span>{children}</span>
    </a>
  )
}
