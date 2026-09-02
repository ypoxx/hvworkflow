/**
 * The demo role switcher. This is the one component that may name roles (AGENTS.md rule 4): it lists
 * the demo personas from `src/api/actor.ts`. Everything else renders what `_actions` allows.
 */
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { DEMO_ACTORS, setActor, useActor } from '../api/actor';
import { cx } from '../components';
import { roleLabel, useT } from '../i18n';

export function RoleSwitcher() {
  const t = useT();
  const actor = useActor();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="role-switcher"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('role.switch')}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          'flex h-9 items-center gap-2 rounded-md border px-2 transition-colors',
          open ? 'border-line-strong bg-ink-50' : 'border-line bg-surface hover:bg-ink-50',
        )}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-ink-800 font-mono text-2xs font-medium text-white">
          {roleLabel(t, actor.role).slice(0, 2).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className="hv-label">{t('role.label')}</span>
          <span className="max-w-36 truncate text-[13px] font-medium text-ink-900">
            {roleLabel(t, actor.role)}
          </span>
        </span>
        <ChevronsUpDown size={14} strokeWidth={1.75} className="text-ink-400" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('role.switch')}
          className="absolute right-0 z-50 mt-1 w-72 rounded-md border border-line bg-surface p-1 shadow-[0_12px_32px_-10px_rgba(31,30,28,0.3)]"
        >
          <p className="px-2 py-1.5 text-2xs text-ink-500">{t('role.hint')}</p>
          {DEMO_ACTORS.map((persona) => {
            const active = persona.id === actor.id;
            return (
              <button
                key={persona.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                data-testid={`role-option-${persona.role}`}
                onClick={() => {
                  setActor(persona);
                  setOpen(false);
                }}
                className={cx(
                  'flex h-9 w-full items-center gap-2 rounded-sm px-2 text-left transition-colors',
                  active ? 'bg-accent-50' : 'hover:bg-ink-50',
                )}
              >
                <span
                  className={cx(
                    'text-[13px] font-medium',
                    active ? 'text-accent-700' : 'text-ink-800',
                  )}
                >
                  {roleLabel(t, persona.role)}
                </span>
                <span className="truncate text-2xs text-ink-500">{persona.displayName}</span>
                {active && (
                  <Check
                    size={14}
                    strokeWidth={2}
                    className="ml-auto shrink-0 text-accent-600"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
