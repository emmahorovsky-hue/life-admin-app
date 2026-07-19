import {
  normalizeCandidate,
  isSupportedMimeType,
  VALID_CATEGORIES,
  VALID_BILLING_CYCLES,
} from '../aiService';
import { CATEGORY_IDS, BILLING_CYCLES } from '../../constants/subscriptions';

describe('aiService.normalizeCandidate', () => {
  const fullValidInput = {
    name: 'Netflix',
    cost: 15.99,
    currency: 'USD',
    billingCycle: 'monthly',
    renewalDate: '2026-07-01',
    category: 'streaming',
    notes: 'Premium plan',
    isSubscription: true,
    confidence: 'high',
    uncertainFields: ['cost'],
  };

  it('passes through a fully valid candidate unchanged', () => {
    expect(normalizeCandidate(fullValidInput)).toEqual(fullValidInput);
  });

  it('clamps an unknown category to "other"', () => {
    const result = normalizeCandidate({ ...fullValidInput, category: 'crypto' });
    expect(result.category).toBe('other');
  });

  it('clamps an unknown billing cycle to "monthly"', () => {
    const result = normalizeCandidate({ ...fullValidInput, billingCycle: 'fortnightly' });
    expect(result.billingCycle).toBe('monthly');
  });

  it('falls back to "low" for an invalid confidence value', () => {
    const result = normalizeCandidate({ ...fullValidInput, confidence: 'very-high' });
    expect(result.confidence).toBe('low');
  });

  it('defaults isSubscription to true unless explicitly false', () => {
    expect(normalizeCandidate({ ...fullValidInput, isSubscription: undefined }).isSubscription).toBe(true);
    expect(normalizeCandidate({ ...fullValidInput, isSubscription: false }).isSubscription).toBe(false);
  });

  it('coerces wrong-typed nullable fields to null', () => {
    const result = normalizeCandidate({
      ...fullValidInput,
      cost: 'free',
      currency: 123,
      renewalDate: 0,
      notes: {},
    });
    expect(result.cost).toBeNull();
    expect(result.currency).toBeNull();
    expect(result.renewalDate).toBeNull();
    expect(result.notes).toBeNull();
  });

  it('defaults a non-string name to an empty string', () => {
    expect(normalizeCandidate({ ...fullValidInput, name: null }).name).toBe('');
  });

  it('filters non-string entries out of uncertainFields', () => {
    const result = normalizeCandidate({
      ...fullValidInput,
      uncertainFields: ['cost', 42, null, 'renewalDate'],
    });
    expect(result.uncertainFields).toEqual(['cost', 'renewalDate']);
  });

  it('returns uncertainFields as [] when it is not an array', () => {
    expect(normalizeCandidate({ ...fullValidInput, uncertainFields: 'cost' }).uncertainFields).toEqual([]);
  });

  it('handles null / empty input with safe defaults', () => {
    const result = normalizeCandidate(null);
    expect(result).toEqual({
      name: '',
      cost: null,
      currency: null,
      billingCycle: 'monthly',
      renewalDate: null,
      category: 'other',
      notes: null,
      isSubscription: true,
      confidence: 'low',
      // LIF-76: a null cost is always surfaced for review, even when the model
      // (or, here, an empty input) didn't flag it.
      uncertainFields: ['cost'],
    });
  });
});

describe('aiService.isSupportedMimeType', () => {
  it.each(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'])(
    'accepts %s',
    (mime) => {
      expect(isSupportedMimeType(mime)).toBe(true);
    }
  );

  it.each(['text/plain', 'image/svg+xml', 'application/json', ''])(
    'rejects %s',
    (mime) => {
      expect(isSupportedMimeType(mime)).toBe(false);
    }
  );
});

describe('aiService enum exports', () => {
  it('stay in sync with the shared subscription constants', () => {
    expect(VALID_CATEGORIES).toEqual(CATEGORY_IDS);
    expect(VALID_BILLING_CYCLES).toEqual(BILLING_CYCLES);
  });
});
