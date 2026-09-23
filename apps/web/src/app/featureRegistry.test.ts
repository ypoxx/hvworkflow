import { describe, it, expect } from 'vitest';
import type { Permission } from '@hv/domain';
import { FEATURES, visibleRoutes, checkFeatureRegistry, getNavigationShortcutRange } from './featureRegistry';

describe('featureRegistry', () => {
  describe('invariants', () => {
    it('all paths are unique', () => {
      const paths = new Set<string>();
      for (const feature of FEATURES) {
        expect(paths.has(feature.path)).toBe(false);
        paths.add(feature.path);
      }
      expect(paths.size).toBe(FEATURES.length);
    });

    it('all shortcut keys (1-5) are unique', () => {
      const shortcuts = new Set<number>();
      for (const feature of FEATURES) {
        if (feature.shortcutKey !== undefined) {
          expect(shortcuts.has(feature.shortcutKey)).toBe(false);
          shortcuts.add(feature.shortcutKey);
        }
      }
    });

    it('all labelKeys start with nav.', () => {
      const navKeys = new Set(FEATURES.map((f) => f.labelKey));
      for (const key of navKeys) {
        expect(key).toMatch(/^nav\./);
      }
    });

    it('all helpKeys are page description keys (page.*.description)', () => {
      const helpKeys = new Set(FEATURES.map((f) => f.helpKey));
      for (const key of helpKeys) {
        expect(key).toMatch(/^page\.[^.]+\.description$/);
      }
    });

    it('registry check function returns undefined (no errors)', () => {
      const result = checkFeatureRegistry();
      expect(result).toBeUndefined();
    });

    it('navigation shortcut range collapses to "Alt 1…5" label for the shortcuts dialog', () => {
      const range = getNavigationShortcutRange();
      // All current features have shortcuts 1-5, so min=1 and max=5
      expect(range.min).toBe(1);
      expect(range.max).toBe(5);
      // When rendered as keys ['Alt', '1', '…', '5'], this displays as "Alt 1 … 5"
      // which formats correctly in the dialog
    });
  });

  describe('visibleRoutes', () => {
    it('returns all routes when granted is undefined', () => {
      const visible = visibleRoutes(FEATURES, undefined);
      expect(visible).toEqual(FEATURES);
    });

    it('returns all routes when granted is an empty set (no route requires permissions)', () => {
      const visible = visibleRoutes(FEATURES, new Set());
      // All current routes have no 'requires' field, so all should be visible
      expect(visible).toEqual(FEATURES);
    });

    it('filters out routes with unmet permission requirements', () => {
      expect(FEATURES.length).toBeGreaterThan(0);
      const firstFeature = FEATURES[0];
      if (!firstFeature) return;

      // Create a test feature that requires a permission
      const testFeature: typeof firstFeature = {
        id: 'test',
        path: '/test',
        labelKey: 'nav.speakers',
        icon: firstFeature.icon,
        testId: 'test-nav',
        helpKey: 'page.speakers.description',
        i18nModule: 'test',
        requires: 'speaker.read' as Permission,
        Component: firstFeature.Component,
      };

      // Without the permission
      const grantedEmpty = new Set() as unknown as ReadonlySet<Permission>;
      const visibleWithout = visibleRoutes([firstFeature, testFeature], grantedEmpty);
      expect(visibleWithout).toEqual([firstFeature]);

      // With the permission
      const granted = new Set(['speaker.read']) as unknown as ReadonlySet<Permission>;
      const visibleWith = visibleRoutes([firstFeature, testFeature], granted);
      expect(visibleWith).toEqual([firstFeature, testFeature]);
    });

    it('preserves route order', () => {
      const granted = new Set(['speaker.read', 'contribution.read', 'question.read']) as unknown as ReadonlySet<Permission>;
      const visible = visibleRoutes(FEATURES, granted);
      expect(visible).toEqual(FEATURES);
    });
  });

  describe('Features data structure', () => {
    it('each feature has all required properties', () => {
      for (const feature of FEATURES) {
        expect(feature.id).toBeDefined();
        expect(feature.path).toBeDefined();
        expect(feature.labelKey).toBeDefined();
        expect(feature.icon).toBeDefined();
        expect(feature.testId).toBeDefined();
        expect(feature.helpKey).toBeDefined();
        expect(feature.i18nModule).toBeDefined();
        expect(feature.Component).toBeDefined();
      }
    });

    it('each feature with a shortcutKey has a number from 1 to 5', () => {
      for (const feature of FEATURES) {
        if (feature.shortcutKey !== undefined) {
          expect(feature.shortcutKey).toBeGreaterThanOrEqual(1);
          expect(feature.shortcutKey).toBeLessThanOrEqual(5);
        }
      }
    });

    it('features are in the order they should appear (speakers first, history last)', () => {
      expect(FEATURES.length).toBeGreaterThan(0);
      expect(FEATURES[0]?.id).toBe('speakers');
      const lastIndex = FEATURES.length - 1;
      expect(FEATURES[lastIndex]?.id).toBe('history');
    });
  });
});
