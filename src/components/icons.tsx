// Small line icons, drawn here so the app needs no icon library.
// They are decoration: every icon sits next to words that say the same thing.

import type { ReactNode } from 'react'
import styles from './icons.module.css'

function Icon({ children, spin = false }: { children: ReactNode; spin?: boolean }) {
  return (
    <svg
      className={spin ? `${styles.icon} ${styles.spin}` : styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const EditIcon = () => (
  <Icon>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="M13 7l4 4" />
  </Icon>
)

export const CopyIcon = () => (
  <Icon>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Icon>
)

export const TrashIcon = () => (
  <Icon>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13h10l1-13" />
    <path d="M10 11v5M14 11v5" />
  </Icon>
)

export const CheckIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.7 2.7L16 9.5" />
  </Icon>
)

export const SetupIcon = () => (
  <Icon>
    <path d="M4 7h8M20 7h-2M4 17h2M12 17h8" />
    <circle cx="15" cy="7" r="3" />
    <circle cx="9" cy="17" r="3" />
  </Icon>
)

export const UndoIcon = () => (
  <Icon>
    <path d="M8 5L3 10l5 5" />
    <path d="M3 10h11a5 5 0 0 1 0 10h-4" />
  </Icon>
)

export const BackIcon = () => (
  <Icon>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
)

export const AlertIcon = () => (
  <Icon>
    <path d="M12 4L2.5 20h19L12 4z" />
    <path d="M12 10v4.5M12 17.4v.1" />
  </Icon>
)

export const PlugIcon = () => (
  <Icon>
    <path d="M9 3v5M15 3v5" />
    <path d="M6 8h12v3a6 6 0 0 1-12 0V8z" />
    <path d="M12 17v4" />
  </Icon>
)

export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)

export const SpinnerIcon = () => (
  <Icon spin>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </Icon>
)

/** The app's mark: a steering wheel. */
export const WheelMark = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 3v7M4 15l6.2-2.2M20 15l-6.2-2.2" />
  </Icon>
)
