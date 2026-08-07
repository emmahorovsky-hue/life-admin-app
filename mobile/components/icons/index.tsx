// The Paypr icon set — direction 1a, "Thermal Line" — React Native bindings.
//
// Geometry lives in `@life-admin/shared` (packages/shared/src/icons/geometry.ts)
// and is shared with the web client, so a coordinate tweak lands on both
// platforms at once. Only the rendering primitive differs: react-native-svg
// here, plain <svg> on web.
//
// Names and grouping match client/src/components/icons/index.tsx exactly.
import type { IconDirection } from '@life-admin/shared';
import { PayprIcon, type PayprIconProps } from './PayprIcon';

export type { PayprIconProps, Ink } from './PayprIcon';

/** A Paypr icon component reference, for icons held in arrays/maps. */
export type PayprIconComponent = (props: PayprIconProps) => React.ReactElement;

// ── Nav ───────────────────────────────────────────────────────────
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

// ── Categories ────────────────────────────────────────────────────
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

// ── Actions ───────────────────────────────────────────────────────
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

// ── Status ────────────────────────────────────────────────────────
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

// ── Chrome ────────────────────────────────────────────────────────
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
