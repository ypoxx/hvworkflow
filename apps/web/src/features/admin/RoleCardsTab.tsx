/**
 * Scheibe 041 (decision 5): the role cards (Rollenkarten). Left the roles as a listbox (arrows, Home, End), right the
 * card of the chosen one: what it reads and what it may do, each right labelled from the dictionary, and the sentence
 * on the unit-bound read where the rights table says so. Data from `roleCards()`; no role is named in this file.
 */
import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Permission } from '@hv/domain';
import { roleCards } from '../../api/roleCards';
import type { RoleCard } from '../../api/roleCards';
import { Panel, cx } from '../../components';
import { actionLabel, roleLabel, useT } from '../../i18n';
import type { TKey, Translate } from '../../i18n';
import { rovingTarget } from './tabs';

/**
 * What a read right lets a role see, in the house's words — the shared action label of every read right is "Ansehen",
 * which says nothing on a card. A read right this build does not list falls back to that label (a new right still
 * appears without a change here).
 */
const READ_KEYS: Partial<Record<Permission, TKey>> = {
  'speaker.read': 'admin.roleCards.read.speaker.read',
  'contribution.read': 'admin.roleCards.read.contribution.read',
  'question.read': 'admin.roleCards.read.question.read',
  'question.read.delivered': 'admin.roleCards.read.question.read.delivered',
  'stage.read': 'admin.roleCards.read.stage.read',
  'history.read': 'admin.roleCards.read.history.read',
  'event.read': 'admin.roleCards.read.event.read',
};

const readLabel = (t: Translate, permission: Permission): string => {
  const key = READ_KEYS[permission];
  return key === undefined ? actionLabel(t, permission) : t(key);
};

function Section({ title, items }: { title: string; items: readonly { permission: Permission; label: string }[] }) {
  const t = useT();
  return (
    <div>
      <h4 className="hv-label">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-1 text-[13px] text-ink-600">{t('admin.roleCards.none')}</p>
      ) : (
        <ul className="mt-1 divide-y divide-line">
          {items.map((item) => (
            <li key={item.permission} className="flex h-8 items-center justify-between gap-3 text-[13px] text-ink-900">
              <span>{item.label}</span>
              <span className="font-mono text-2xs text-ink-600">{item.permission}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One card: title, "Liest", "Darf", and the unit sentence when the role reads only its unit. */
export function RoleCardView({ card, id }: { card: RoleCard; id?: string }) {
  const t = useT();
  return (
    <section
      data-testid="admin-role-card"
      data-role={card.role}
      aria-live="polite"
      {...(id !== undefined ? { id } : {})}
      className="space-y-4"
    >
      <h3 className="text-[15px] font-semibold text-ink-900">{roleLabel(t, card.role)}</h3>
      {card.unitBound && (
        <p data-testid="admin-role-card-unit-bound" className="text-[13px] text-ink-700">
          {t('admin.roleCards.unitBound')}
        </p>
      )}
      <Section
        title={t('admin.roleCards.reads')}
        items={card.reads.map((permission) => ({ permission, label: readLabel(t, permission) }))}
      />
      <Section
        title={t('admin.roleCards.acts')}
        items={card.acts.map((permission) => ({ permission, label: actionLabel(t, permission) }))}
      />
    </section>
  );
}

export function RoleCardsTab() {
  const t = useT();
  const cards = roleCards();
  const [index, setIndex] = useState(0);
  const base = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const card = cards[index] ?? cards[0];
  const optionId = (position: number): string => `${base}-option-${position}`;

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    const target = rovingTarget(event.key, index, cards.length, 'vertical');
    if (target === undefined) return;
    event.preventDefault();
    setIndex(target);
    document.getElementById(optionId(target))?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <Panel title={t('admin.tab.roleCards')} description={t('admin.roleCards.intro')} className="h-full" bodyClassName="overflow-auto">
      <div className="grid grid-cols-[minmax(12rem,16rem)_1fr] gap-6">
        <div>
          <p id={`${base}-label`} className="hv-label">
            {t('admin.roleCards.list')}
          </p>
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={0}
            data-testid="admin-role-cards-list"
            aria-labelledby={`${base}-label`}
            aria-activedescendant={optionId(index)}
            onKeyDown={onKeyDown}
            className="mt-1 rounded-md border border-line py-1"
          >
            {cards.map((entry, position) => {
              const selected = position === index;
              return (
                <li
                  key={entry.role}
                  id={optionId(position)}
                  role="option"
                  aria-selected={selected}
                  data-testid="admin-role-card-option"
                  data-role={entry.role}
                  onClick={() => {
                    setIndex(position);
                    listRef.current?.focus();
                  }}
                  className={cx(
                    'flex h-8 cursor-default items-center px-3 text-[13px]',
                    selected ? 'bg-accent-50 font-medium text-ink-900' : 'text-ink-700 hover:bg-ink-25',
                  )}
                >
                  {roleLabel(t, entry.role)}
                </li>
              );
            })}
          </ul>
        </div>
        {card !== undefined && <RoleCardView card={card} />}
      </div>
    </Panel>
  );
}
