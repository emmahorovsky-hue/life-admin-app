// The Paypr icon set — direction 1a, "Thermal Line".
//
// Geometry lives in `@life-admin/shared` (packages/shared/src/icons/geometry.ts)
// so web and mobile draw from one source; these are the web bindings.
//
// Each icon is a plain function component, not a factory, so React can memoise
// them and they can be passed around by reference the way lucide's were.
//
// This file is deliberately components-and-types only: `react-refresh/
// only-export-components` runs as a warning under `--max-warnings 0`, and
// `src/components/icons/**` has no override, so a stray exported map or
// constant here would fail the lint gate.
import type { IconDirection } from '@life-admin/shared';
import { PayprIcon, type PayprIconProps } from './PayprIcon';

export type { PayprIconProps, Ink } from './PayprIcon';

/**
 * A Paypr icon component reference — the replacement for lucide's
 * `LucideIcon` type where icons are held in arrays/maps rather than rendered
 * inline (nav items, settings menu, the category map).
 */
export type PayprIconComponent = (props: PayprIconProps) => React.ReactElement;

// ── Nav ────────────────────────────────────────────────────────────────
export function IconDashboard(props: PayprIconProps) {
  return <PayprIcon name="dashboard" {...props} />;
}
export function IconTimeline(props: PayprIconProps) {
  return <PayprIcon name="timeline" {...props} />;
}
export function IconSubscriptions(props: PayprIconProps) {
  return <PayprIcon name="subscriptions" {...props} />;
}
export function IconSettings(props: PayprIconProps) {
  return <PayprIcon name="settings" {...props} />;
}
export function IconLogout(props: PayprIconProps) {
  return <PayprIcon name="logout" {...props} />;
}

// ── Categories ─────────────────────────────────────────────────────────
export function IconStreaming(props: PayprIconProps) {
  return <PayprIcon name="streaming" {...props} />;
}
export function IconFitness(props: PayprIconProps) {
  return <PayprIcon name="fitness" {...props} />;
}
export function IconSoftware(props: PayprIconProps) {
  return <PayprIcon name="software" {...props} />;
}
export function IconMusic(props: PayprIconProps) {
  return <PayprIcon name="music" {...props} />;
}
export function IconCloud(props: PayprIconProps) {
  return <PayprIcon name="cloud" {...props} />;
}
export function IconGaming(props: PayprIconProps) {
  return <PayprIcon name="gaming" {...props} />;
}
export function IconProductivity(props: PayprIconProps) {
  return <PayprIcon name="productivity" {...props} />;
}
export function IconCard(props: PayprIconProps) {
  return <PayprIcon name="card" {...props} />;
}

// ── Actions ────────────────────────────────────────────────────────────
export function IconAdd(props: PayprIconProps) {
  return <PayprIcon name="add" {...props} />;
}
export function IconUpload(props: PayprIconProps) {
  return <PayprIcon name="upload" {...props} />;
}
export function IconScan(props: PayprIconProps) {
  return <PayprIcon name="scan" {...props} />;
}
export function IconSearch(props: PayprIconProps) {
  return <PayprIcon name="search" {...props} />;
}
export function IconEdit(props: PayprIconProps) {
  return <PayprIcon name="edit" {...props} />;
}
export function IconDelete(props: PayprIconProps) {
  return <PayprIcon name="delete" {...props} />;
}
export function IconClose(props: PayprIconProps) {
  return <PayprIcon name="close" {...props} />;
}
export function IconCheck(props: PayprIconProps) {
  return <PayprIcon name="check" {...props} />;
}

// ── Status ─────────────────────────────────────────────────────────────
export function IconBell(props: PayprIconProps) {
  return <PayprIcon name="bell" {...props} />;
}
export function IconWarning(props: PayprIconProps) {
  return <PayprIcon name="warning" {...props} />;
}
export function IconRenewing(props: PayprIconProps) {
  return <PayprIcon name="renewing" {...props} />;
}
export function IconCancelled(props: PayprIconProps) {
  return <PayprIcon name="cancelled" {...props} />;
}
export function IconCalendar(props: PayprIconProps) {
  return <PayprIcon name="calendar" {...props} />;
}

// ── Chrome ─────────────────────────────────────────────────────────────
export function IconMenu(props: PayprIconProps) {
  return <PayprIcon name="menu" {...props} />;
}
/** `direction` rotates the one drawing — there is no second chevron glyph. */
export function IconChevron({
  direction = 'right',
  ...props
}: PayprIconProps & { direction?: IconDirection }) {
  return <PayprIcon name="chevron" direction={direction} {...props} />;
}
export function IconTheme(props: PayprIconProps) {
  return <PayprIcon name="theme" {...props} />;
}
export function IconUser(props: PayprIconProps) {
  return <PayprIcon name="user" {...props} />;
}
export function IconReceipt(props: PayprIconProps) {
  return <PayprIcon name="receipt" {...props} />;
}
