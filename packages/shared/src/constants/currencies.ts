/**
 * The currencies this app supports, and everything that describes one.
 *
 * This is the single source of truth. It used to be four separate structures
 * with no link between them — a code list in ./subscriptions, a symbol map and
 * a region map in ../utils/currency, and a price column in ./services — so
 * adding a currency to the list alone produced one that rendered as a bare
 * code, was never guessed from a locale, and autofilled a US price under the
 * wrong sign. Adding a currency is now one row here plus a price column in
 * ./services (which a test enforces).
 *
 * Deliberately a curated set of markets rather than all ~150 ISO 4217 codes:
 * the pickers are plain dropdowns with no search field, and region → currency
 * guessing is only meaningful while the map is hand-checked.
 */
export interface CurrencyDefinition {
  /** ISO 4217 alphabetic code. */
  code: string;
  /**
   * Full name. Four codes were self-evident from the code alone; twenty are
   * not — SEK vs NOK vs DKK is a real choice a user has to make — so the
   * settings pickers label rows with this.
   */
  name: string;
  symbol: string;
  /**
   * Which side of the amount the symbol sits on. Polish, Nordic and Czech
   * convention is after ("15.99 zł"); most others before ("$15.99").
   */
  position: 'prefix' | 'suffix';
  /**
   * Digits after the decimal point when rendering. ISO 4217 minor units,
   * except HUF — see its row.
   */
  decimals: number;
  /**
   * ISO 3166-1 alpha-2 regions that map to this currency *unambiguously*, for
   * guessing a new account's currency from its locale. A region that is
   * genuinely ambiguous belongs in no row at all: `currencyForLocale` returns
   * null on a miss, and a miss is a prompt to ask rather than a wrong guess.
   */
  regions: string[];
}

// Alphabetical by code. Order here is *display* order in the pickers and
// nothing else — no caller indexes into the derived `currencies` array.
export const CURRENCIES: readonly CurrencyDefinition[] = [
  { code: 'AED', name: 'UAE dirham',          symbol: 'AED', position: 'prefix', decimals: 2, regions: ['AE'] },
  { code: 'AUD', name: 'Australian dollar',   symbol: '$',   position: 'prefix', decimals: 2, regions: ['AU'] },
  { code: 'BRL', name: 'Brazilian real',      symbol: 'R$',  position: 'prefix', decimals: 2, regions: ['BR'] },
  { code: 'CAD', name: 'Canadian dollar',     symbol: '$',   position: 'prefix', decimals: 2, regions: ['CA'] },
  { code: 'CHF', name: 'Swiss franc',         symbol: 'CHF', position: 'prefix', decimals: 2, regions: ['CH', 'LI'] },
  { code: 'CZK', name: 'Czech koruna',        symbol: 'Kč',  position: 'suffix', decimals: 2, regions: ['CZ'] },
  { code: 'DKK', name: 'Danish krone',        symbol: 'kr',  position: 'suffix', decimals: 2, regions: ['DK'] },
  {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    position: 'prefix',
    decimals: 2,
    // The 20 eurozone members. Euro-using microstates and the territories that
    // peg to it are left out on purpose: nobody has asked, and every extra row
    // here is a claim about a market we have not checked.
    regions: [
      'AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE',
      'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES',
    ],
  },
  { code: 'GBP', name: 'Pound sterling',      symbol: '£',   position: 'prefix', decimals: 2, regions: ['GB'] },
  { code: 'HKD', name: 'Hong Kong dollar',    symbol: '$',   position: 'prefix', decimals: 2, regions: ['HK'] },
  {
    code: 'HUF',
    name: 'Hungarian forint',
    symbol: 'Ft',
    position: 'suffix',
    // ISO 4217 gives HUF two minor units, but Hungary writes prices without
    // them and the fillér has not circulated since 1999. We follow the
    // convention, not the standard — "1490 Ft", never "1490.00 Ft".
    decimals: 0,
    regions: ['HU'],
  },
  { code: 'INR', name: 'Indian rupee',        symbol: '₹',   position: 'prefix', decimals: 2, regions: ['IN'] },
  { code: 'JPY', name: 'Japanese yen',        symbol: '¥',   position: 'prefix', decimals: 0, regions: ['JP'] },
  { code: 'MYR', name: 'Malaysian ringgit',   symbol: 'RM',  position: 'prefix', decimals: 2, regions: ['MY'] },
  { code: 'NOK', name: 'Norwegian krone',     symbol: 'kr',  position: 'suffix', decimals: 2, regions: ['NO'] },
  { code: 'NZD', name: 'New Zealand dollar',  symbol: '$',   position: 'prefix', decimals: 2, regions: ['NZ'] },
  { code: 'PLN', name: 'Polish złoty',        symbol: 'zł',  position: 'suffix', decimals: 2, regions: ['PL'] },
  { code: 'SEK', name: 'Swedish krona',       symbol: 'kr',  position: 'suffix', decimals: 2, regions: ['SE'] },
  { code: 'SGD', name: 'Singapore dollar',    symbol: '$',   position: 'prefix', decimals: 2, regions: ['SG'] },
  { code: 'USD', name: 'US dollar',           symbol: '$',   position: 'prefix', decimals: 2, regions: ['US'] },
];

/**
 * Supported currency codes, in picker order.
 *
 * Six of these share "$" and three share "kr". That ambiguity is not a bug to
 * design away here — `formatCurrencyWithCode` exists for it, and every surface
 * that shows two currencies side by side already uses it.
 */
export const currencies: string[] = CURRENCIES.map((currency) => currency.code);

const BY_CODE = new Map(CURRENCIES.map((currency) => [currency.code, currency]));

/** The full definition for a code, or undefined when this app has no such currency. */
export function currencyDefinition(code: string): CurrencyDefinition | undefined {
  return BY_CODE.get(code);
}

/** Display name for a code, falling back to the code itself when unknown. */
export function currencyName(code: string): string {
  return BY_CODE.get(code)?.name ?? code;
}
