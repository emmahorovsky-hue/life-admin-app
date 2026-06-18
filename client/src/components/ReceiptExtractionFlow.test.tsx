import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UploadReceiptDialog from './UploadReceiptDialog';
import ReviewExtractedDialog from './ReviewExtractedDialog';
import { subscriptionApi, SubscriptionCandidate } from '@/lib/subscriptions';

// Mock the API surface but keep the real categories/billingCycles the dialogs render.
vi.mock('@/lib/subscriptions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/subscriptions')>();
  return {
    ...actual,
    subscriptionApi: { ...actual.subscriptionApi, extract: vi.fn(), create: vi.fn() },
  };
});

const mockedExtract = vi.mocked(subscriptionApi.extract);
const mockedCreate = vi.mocked(subscriptionApi.create);

const CANDIDATE: SubscriptionCandidate = {
  name: 'Netflix',
  cost: 15.99,
  currency: 'USD',
  billingCycle: 'monthly',
  renewalDate: '2026-07-01',
  category: 'streaming',
  notes: null,
  isSubscription: true,
  confidence: 'high',
  uncertainFields: ['cost'],
};

// Mirrors the upload -> review wiring in pages/Subscriptions.tsx.
function ReceiptFlowHarness({ onSuccess }: { onSuccess: () => void }) {
  const [uploadOpen, setUploadOpen] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [candidate, setCandidate] = useState<SubscriptionCandidate | null>(null);

  return (
    <>
      <UploadReceiptDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onExtracted={(c) => {
          setCandidate(c);
          setUploadOpen(false);
          setReviewOpen(true);
        }}
      />
      <ReviewExtractedDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        candidate={candidate}
        onSuccess={onSuccess}
      />
    </>
  );
}

async function uploadAndExtract() {
  const user = userEvent.setup();
  const file = new File(['%PDF-1.4'], 'receipt.pdf', { type: 'application/pdf' });
  await user.upload(screen.getByLabelText('Receipt file'), file);
  await user.click(screen.getByRole('button', { name: /extract/i }));
  return user;
}

describe('receipt upload -> review flow', () => {
  beforeEach(() => {
    mockedExtract.mockReset();
    mockedCreate.mockReset();
  });

  it('extracts the uploaded file and opens the review screen with pre-filled fields', async () => {
    mockedExtract.mockResolvedValue({ source: 'ai', candidates: [CANDIDATE] });
    render(<ReceiptFlowHarness onSuccess={vi.fn()} />);

    await uploadAndExtract();

    expect(mockedExtract).toHaveBeenCalledTimes(1);
    expect(mockedExtract.mock.calls[0][0]).toBeInstanceOf(File);

    // Review dialog opens with the candidate's values pre-filled.
    await waitFor(() =>
      expect(screen.getByText('Review Extracted Subscription')).toBeInTheDocument()
    );
    expect(screen.getByLabelText('Service Name *')).toHaveValue('Netflix');
    expect(screen.getByLabelText('Cost *')).toHaveValue(15.99);
    expect(screen.getByLabelText('Billing Cycle *')).toHaveValue('monthly');
    expect(screen.getByLabelText('Category')).toHaveValue('streaming');
    // uncertainFields flags cost for confirmation.
    expect(screen.getByText('AI-suggested — please confirm')).toBeInTheDocument();
  });

  it('shows an inline error and does not open review when no subscription is found', async () => {
    mockedExtract.mockResolvedValue({ source: 'ai', candidates: [] });
    render(<ReceiptFlowHarness onSuccess={vi.fn()} />);

    await uploadAndExtract();

    expect(
      await screen.findByText(/couldn't read a subscription/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Review Extracted Subscription')).not.toBeInTheDocument();
  });

  it('confirming the review creates the subscription with the edited values', async () => {
    mockedExtract.mockResolvedValue({ source: 'ai', candidates: [CANDIDATE] });
    mockedCreate.mockResolvedValue({ id: 'sub-1' } as Awaited<
      ReturnType<typeof subscriptionApi.create>
    >);
    const onSuccess = vi.fn();
    render(<ReceiptFlowHarness onSuccess={onSuccess} />);

    const user = await uploadAndExtract();

    const nameInput = await screen.findByLabelText('Service Name *');
    await user.clear(nameInput);
    await user.type(nameInput, 'Netflix Premium');
    await user.click(screen.getByRole('button', { name: /confirm & add/i }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Netflix Premium',
        cost: 15.99,
        currency: 'USD',
        billingCycle: 'monthly',
        renewalDate: '2026-07-01',
        category: 'streaming',
        notes: undefined, // candidate.notes was null -> omitted
      })
    );
    expect(onSuccess).toHaveBeenCalled();
  });
});
