import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ICON_GEOMETRY, type IconName } from '@life-admin/shared';
import * as Icons from '@/components/icons';

const NAME_TO_COMPONENT: Record<IconName, keyof typeof Icons> = {
  dashboard: 'IconDashboard', timeline: 'IconTimeline', subscriptions: 'IconSubscriptions',
  settings: 'IconSettings', logout: 'IconLogout', streaming: 'IconStreaming',
  fitness: 'IconFitness', software: 'IconSoftware', music: 'IconMusic', cloud: 'IconCloud',
  gaming: 'IconGaming', productivity: 'IconProductivity', card: 'IconCard', add: 'IconAdd',
  upload: 'IconUpload', scan: 'IconScan', camera: 'IconCamera', gallery: 'IconGallery',
  search: 'IconSearch', edit: 'IconEdit',
  delete: 'IconDelete', close: 'IconClose', check: 'IconCheck', bell: 'IconBell',
  warning: 'IconWarning', renewing: 'IconRenewing', cancelled: 'IconCancelled',
  calendar: 'IconCalendar', menu: 'IconMenu', chevron: 'IconChevron', theme: 'IconTheme',
  user: 'IconUser', receipt: 'IconReceipt',
};

describe('icon smoke', () => {
  it('every geometry entry has a component that renders its parts', () => {
    for (const [name, comp] of Object.entries(NAME_TO_COMPONENT)) {
      const C = Icons[comp as keyof typeof Icons] as React.ComponentType;
      const { container, unmount } = render(<C />);
      const svg = container.querySelector('svg')!;
      expect(svg, name).toBeTruthy();
      const drawn = svg.querySelectorAll('path,polyline,polygon,rect,circle').length;
      expect(drawn, name).toBe(ICON_GEOMETRY[name as IconName].length);
      unmount();
    }
  });

  it('paints exactly one accent ink per icon by default and none when inherit', () => {
    for (const [name, comp] of Object.entries(NAME_TO_COMPONENT)) {
      const C = Icons[comp as keyof typeof Icons] as React.ComponentType<{ ink?: 'brand' | 'inherit' }>;
      const brand = render(<C />);
      const orange = brand.container.querySelectorAll('[stroke="hsl(var(--brand-orange))"],[fill="hsl(var(--brand-orange))"]');
      // Exactly one, not merely at least one. `toBeGreaterThan(0)` let an icon
      // carry a second accent part without failing, which is how a rule that
      // exists only in prose stops describing the set it governs.
      expect(orange.length, `${name} brand`).toBe(1);
      brand.unmount();

      const inherit = render(<C ink="inherit" />);
      expect(
        inherit.container.querySelectorAll('[stroke="hsl(var(--brand-orange))"],[fill="hsl(var(--brand-orange))"]').length,
        `${name} inherit`,
      ).toBe(0);
      inherit.unmount();
    }
  });

  it('never uses a round cap', () => {
    const { container } = render(<Icons.IconDashboard />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('stroke-linecap')).toBe('butt');
    expect(svg.getAttribute('stroke-linejoin')).toBe('miter');
  });
});
