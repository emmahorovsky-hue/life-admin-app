import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Subscription, SubscriptionCandidate } from '@life-admin/shared';
import {
  SubscriptionDetailSheet,
  SubscriptionDetailSheetHandle,
} from './SubscriptionDetailSheet';
import {
  SubscriptionFormSheet,
  SubscriptionFormSheetHandle,
} from './SubscriptionFormSheet';

export interface SubscriptionSheetsHandle {
  /** Tap a row → read-only detail sheet (with an Edit button). */
  openDetail: (subscription: Subscription) => void;
  /** Open the edit form directly for a subscription. */
  openEdit: (subscription: Subscription) => void;
  /** Open the add form. */
  openAdd: () => void;
  /** Open the add form pre-filled from a receipt-extracted candidate. */
  openWithCandidate: (candidate: SubscriptionCandidate) => void;
}

interface Props {
  /** Called after any successful create/update/delete so the screen can reload. */
  onSaved: () => void;
}

/**
 * Bundles the detail + edit/add sheets and the handoff between them, so every
 * screen (Dashboard, Timeline, Subscriptions) wires the "tap → details → edit"
 * flow identically. The handoff dismisses the detail sheet first, then presents
 * the form in its onDismiss — two stacked modals would otherwise fight over the
 * backdrop.
 */
export const SubscriptionSheets = forwardRef<SubscriptionSheetsHandle, Props>(
  function SubscriptionSheets({ onSaved }, ref) {
    const detailRef = useRef<SubscriptionDetailSheetHandle>(null);
    const formRef = useRef<SubscriptionFormSheetHandle>(null);
    // The subscription to edit once the detail sheet has finished dismissing.
    const pendingEdit = useRef<Subscription | null>(null);

    useImperativeHandle(ref, () => ({
      openDetail: (subscription) => detailRef.current?.open(subscription),
      openEdit: (subscription) => formRef.current?.open(subscription),
      openAdd: () => formRef.current?.open(null),
      openWithCandidate: (candidate) => formRef.current?.openWithCandidate(candidate),
    }));

    // Edit tapped in the detail sheet: remember the sub, then dismiss. Presenting
    // the form waits for onDetailDismiss so the two sheets never overlap.
    const handleEdit = useCallback((subscription: Subscription) => {
      pendingEdit.current = subscription;
      detailRef.current?.close();
    }, []);

    const handleDetailDismiss = useCallback(() => {
      const subscription = pendingEdit.current;
      if (subscription) {
        pendingEdit.current = null;
        formRef.current?.open(subscription);
      }
    }, []);

    return (
      <>
        <SubscriptionDetailSheet
          ref={detailRef}
          onEdit={handleEdit}
          onDismiss={handleDetailDismiss}
        />
        <SubscriptionFormSheet ref={formRef} onSaved={onSaved} />
      </>
    );
  },
);
