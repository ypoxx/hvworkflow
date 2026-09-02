/**
 * The phases of the meeting in the order the day runs. Collapsible to icons because the podium and
 * the capture desk want every pixel for the text they are working on; the choice is per device.
 */
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink } from 'react-router';
import type { Meeting } from '@hv/domain';
import { Button, cx } from '../components';
import { useT } from '../i18n';
import { APP_ROUTES } from './routes';

export function SideNav({
  meeting,
  collapsed,
  onToggle,
}: {
  meeting: Meeting | null;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const toggleLabel = collapsed ? t('nav.expand') : t('nav.collapse');

  return (
    <nav
      aria-label={t('nav.label')}
      className={cx(
        'flex shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-150',
        collapsed ? 'w-nav-collapsed' : 'w-nav',
      )}
    >
      {!collapsed && <p className="hv-label px-4 pt-4 pb-2">{t('nav.section')}</p>}
      <ul className={cx('flex flex-col gap-0.5 px-2', collapsed && 'pt-4')}>
        {APP_ROUTES.map((route) => {
          const label = t(route.labelKey);
          const count = route.counter === undefined || meeting === null
            ? undefined
            : meeting.counts[route.counter];
          return (
            <li key={route.path}>
              <NavLink
                to={route.path}
                data-testid={route.testId}
                {...(collapsed ? { title: label } : {})}
                className={({ isActive }) =>
                  cx(
                    'relative flex h-9 items-center gap-2.5 rounded-md px-2.5 transition-colors',
                    collapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-accent-50 text-accent-700'
                      : 'text-ink-700 hover:bg-ink-50 hover:text-ink-900',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute top-2 bottom-2 -left-2 w-0.5 rounded-full bg-accent-600"
                      />
                    )}
                    <route.icon
                      size={16}
                      strokeWidth={isActive ? 2 : 1.75}
                      className="shrink-0"
                      aria-hidden="true"
                    />
                    {!collapsed && (
                      <>
                        <span
                          className={cx('truncate text-[13px]', isActive && 'font-medium')}
                        >
                          {label}
                        </span>
                        {count !== undefined && (
                          <span
                            className={cx(
                              'ml-auto font-mono text-2xs tabular-nums',
                              isActive ? 'text-accent-600' : 'text-ink-400',
                            )}
                          >
                            {count}
                          </span>
                        )}
                      </>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col gap-2 p-2">
        {!collapsed && (
          <p className="px-2 text-2xs leading-4 text-ink-400">{t('demo.hint')}</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          iconOnly={collapsed}
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={onToggle}
          className={collapsed ? 'self-center' : 'justify-start'}
          icon={
            collapsed ? (
              <PanelLeftOpen size={16} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={16} strokeWidth={1.75} aria-hidden="true" />
            )
          }
        >
          {toggleLabel}
        </Button>
      </div>
    </nav>
  );
}
