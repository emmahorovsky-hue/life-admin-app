export interface Subscription {
  id: string;
  userId: string;
  name: string;
  // Decimal string (e.g. "15.99") — Prisma Decimal serializes to a JSON string,
  // and all money in API responses uses this shape (LIF-125). Parse once on the
  // client for display math; never do float arithmetic server-side.
  cost: string;
  currency: string;
  billingCycle: string;
  renewalDate: string;
  // Next renewal occurrence, computed server-side by rolling renewalDate forward by whole billing cycles.
  nextRenewalDate: string;
  category: string;
  notes: string | null;
  isActive: boolean;
  // Set when the user stops renewal. The sub stays active until nextRenewalDate
  // (frozen at cancel time), then is "ended". null = will renew normally.
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionData {
  name: string;
  cost: number;
  currency?: string;
  billingCycle: string;
  renewalDate: string;
  category: string;
  notes?: string;
}

export interface UpdateSubscriptionData {
  name?: string;
  cost?: number;
  currency?: string;
  billingCycle?: string;
  renewalDate?: string;
  category?: string;
  notes?: string;
}

// Fully-populated form state shared by the add / edit / review dialogs.
// Every field is present (no optionals) so the inputs stay controlled.
export interface SubscriptionFormValues {
  name: string;
  cost: number;
  currency: string;
  billingCycle: string;
  renewalDate: string;
  category: string;
  notes: string;
}

export const defaultSubscriptionFormValues = (): SubscriptionFormValues => ({
  name: '',
  cost: 0,
  currency: 'SGD',
  billingCycle: 'monthly',
  renewalDate: new Date().toISOString().split('T')[0],
  category: 'streaming',
  notes: '',
});

// A candidate subscription extracted from an uploaded receipt/invoice.
export interface SubscriptionCandidate {
  name: string;
  cost: number | null;
  currency: string | null;
  billingCycle: string;
  renewalDate: string | null; // YYYY-MM-DD
  category: string;
  notes: string | null;
  isSubscription: boolean;
  confidence: 'high' | 'medium' | 'low';
  uncertainFields: string[];
}

export interface ExtractionResult {
  candidates: SubscriptionCandidate[];
  source: 'ai' | 'none';
}
