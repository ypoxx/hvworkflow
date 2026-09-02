/**
 * The only button of the product. Four intents and two densities, so that a screen never invents its
 * own affordance and the primary action stays unique on a page.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANT: Readonly<Record<ButtonVariant, string>> = {
  primary: 'border-accent-600 bg-accent-600 text-white hover:bg-accent-700 hover:border-accent-700',
  secondary: 'border-line-strong bg-surface text-ink-800 hover:bg-ink-50 hover:border-ink-300',
  ghost: 'border-transparent bg-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  danger: 'border-danger-600 bg-danger-600 text-white hover:bg-danger-700 hover:border-danger-700',
};

const SIZE: Readonly<Record<ButtonSize, string>> = {
  sm: 'h-7 px-2 text-2xs gap-1',
  md: 'h-8 px-3 text-[13px] gap-1.5',
};

const ICON_ONLY: Readonly<Record<ButtonSize, string>> = { sm: 'w-7 px-0', md: 'w-8 px-0' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A lucide icon rendered at 16px in front of the label. */
  icon?: ReactNode;
  /** Square button with no label; `aria-label` is then required. */
  iconOnly?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconOnly = false,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-md border font-medium',
        'transition-colors duration-100 disabled:pointer-events-none disabled:opacity-45',
        VARIANT[variant],
        SIZE[size],
        iconOnly && ICON_ONLY[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {!iconOnly && children}
    </button>
  );
}
