/**
 * The frame every screen lives in: header, phase navigation, work area. It owns nothing about the
 * business — it only decides where things sit and which keys move between them.
 */
import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router';
import { useT } from '../i18n';
import { Header } from './Header';
import { NotFound } from './NotFound';
import { ShortcutsDialog } from './ShortcutsDialog';
import { SideNav } from './SideNav';
import { APP_ROUTES, DEFAULT_ROUTE } from './routes';
import { useMeeting } from './useMeeting';

const COLLAPSE_KEY = 'hv-nav-collapsed-v1';

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Typing must never trigger a shortcut. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

export function AppShell() {
  const t = useT();
  const meeting = useMeeting();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore: the navigation then simply opens again on the next start */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTextEntry(event.target)) return;
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const index = Number.parseInt(event.key, 10);
        const route = Number.isNaN(index) ? undefined : APP_ROUTES[index - 1];
        if (route !== undefined) {
          event.preventDefault();
          void navigate(route.path);
          return;
        }
        if (event.key.toLowerCase() === 'n') {
          event.preventDefault();
          toggleCollapsed();
          return;
        }
      }
      if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, toggleCollapsed]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <a
        href="#main"
        className="sr-only rounded-md bg-surface px-3 py-2 text-[13px] focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-60"
      >
        {t('app.skipToContent')}
      </a>

      <Header meeting={meeting} onOpenShortcuts={() => setShortcutsOpen(true)} />

      <div className="flex min-h-0 flex-1">
        <SideNav meeting={meeting} collapsed={collapsed} onToggle={toggleCollapsed} />
        <main
          id="main"
          aria-label={t('app.mainRegion')}
          className="min-w-0 flex-1 overflow-y-auto p-6"
        >
          <Routes>
            <Route path="/" element={<Navigate to={DEFAULT_ROUTE} replace />} />
            {APP_ROUTES.map((route) => (
              <Route key={route.path} path={route.path} element={<route.Component />} />
            ))}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
