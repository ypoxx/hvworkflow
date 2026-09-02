/**
 * The language of the interface. A module store rather than a React context: the choice is global,
 * it must survive a reload, and it has to be readable from places that are not inside the tree
 * (the error screen, `document.title`). Same pattern as the demo actor store in `src/api/actor.ts`.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { de } from './de';
import { en } from './en';
import type { Dictionary, Lang, TKey, TParams, Translate } from './types';

const STORAGE_KEY = 'hv-lang-v1';
const DICTIONARIES: Readonly<Record<Lang, Dictionary>> = { de, en };

function load(): Lang {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'de' || raw === 'en') return raw;
  } catch {
    /* storage unavailable: fall through to the house language */
  }
  return 'de';
}

/** Placeholder substitution: `{round}` is replaced by the parameter of the same name. */
export function translate(lang: Lang, key: TKey, params?: TParams): string {
  const template = DICTIONARIES[lang][key];
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

let current: Lang = load();
const listeners = new Set<() => void>();

/** The document language is part of the interface: screen readers and hyphenation depend on it. */
function applyToDocument(lang: Lang): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.title = translate(lang, 'app.documentTitle');
}
applyToDocument(current);

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore: the language then simply resets on the next start */
  }
  applyToDocument(lang);
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

/** The one way a component gets text: `const t = useT(); t('nav.speakers')`. */
export function useT(): Translate {
  const lang = useLang();
  return useMemo<Translate>(() => (key, params) => translate(lang, key, params), [lang]);
}
