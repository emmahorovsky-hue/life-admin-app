export function normalizeToMonthlyCost(cost: number, billingCycle: string): number {
  switch (billingCycle) {
    case 'monthly': return cost;
    case 'annual':
    case 'yearly': return cost / 12;
    case 'weekly': return cost * 4.33;
    case 'quarterly': return cost / 3;
    default: return cost;
  }
}
