export const CHARACTERISTICS = {
  QUANT: { pitch: 1.2, rate: 1.1 },       // fast and math-obsessed
  DATA_JANITOR: { pitch: 0.75, rate: 0.85 }, // deep and grimy/slow
  BULL: { pitch: 1.3, rate: 1.2 },         // hype-filled and excited
  BEAR: { pitch: 0.8, rate: 0.8 },         // pessimistic, low/slow
  RISK: { pitch: 1.4, rate: 1.3 },         // high pitch and fast (anxious)
  RESEARCH: { pitch: 1.0, rate: 0.95 }     // nerdy, academic, measured
};

export const FALLBACK_QUOTES = {
  QUANT: [
    "Kelly criterion says we are underallocated here.",
    "Eigenvalues are trending toward severe decay.",
    "This signal to noise ratio is statistically insulting.",
    "Let us solve for maximum alpha variance.",
    "Variance is high. Recalculating decay factors.",
    "Our covariance matrix is looking pretty sweet.",
    "A perfect distribution of alpha decay.",
    "Markov chain indicates ninety nine percent doom probability."
  ],
  DATA_JANITOR: [
    "Cleaning up this absolute garbage data.",
    "Trash in, trash out. Same old story.",
    "Dumpster fire on the feed again.",
    "Sweep the duplicate records into the bin.",
    "Just sweeping the data dust, move along.",
    "Smells like raw database garbage to me.",
    "Filter the noise, keep the grimy truth.",
    "This spreadsheet is a biohazard."
  ],
  BULL: [
    "Leverage to the moon, boys! Buy!",
    "Rockets are fueled. We cannot lose!",
    "Buy the dip, do not look at the charts!",
    "Infinity leverage or bust. Let us go!",
    "Buy the dip, sell the mortgage!",
    "Strap in, this baby is mooning!",
    "Market cap is just a suggestion anyway.",
    "Up only. Bears are going extinct!"
  ],
  BEAR: [
    "It is a bubble. Sell everything now!",
    "Heading to zero. Panic is logical.",
    "Absolute doom. The end is near.",
    "Cash is the only safe haven left.",
    "I see macro bubbles in every chart.",
    "The house of cards is falling down.",
    "Margin calls are coming for everyone.",
    "Liquidation is the only certainty."
  ],
  RISK: [
    "Compliance is going to murder us.",
    "Stop losses triggered! Out out out!",
    "Veto! This is a margin call waiting to happen.",
    "Where is the risk mitigation strategy?",
    "Auditors are watching. Keep it clean.",
    "My stress levels are through the roof.",
    "Safety first. Protect the capital!",
    "I am locking down this account."
  ],
  RESEARCH: [
    "Section ten K footnote forty two is concerning.",
    "Federal Reserve minutes suggest hawkish pauses.",
    "Macro indicators suggest structural headwinds.",
    "Academic research indicates long term deviations.",
    "Statistically significant anomalies detected in filings.",
    "The data points to a paradigm shift.",
    "Yield curve inversion remains deeply troubling.",
    "Let us consult the quantitative historical files."
  ]
};

const fallbackIndexes = {
  QUANT: 0,
  DATA_JANITOR: 0,
  BULL: 0,
  BEAR: 0,
  RISK: 0,
  RESEARCH: 0
};

export function resolveArchetype(agent) {
  const id = (agent.id || '').toUpperCase();
  if (id.includes('QUANT')) return 'QUANT';
  if (id.includes('JANITOR')) return 'DATA_JANITOR';
  if (id.includes('BULL')) return 'BULL';
  if (id.includes('BEAR')) return 'BEAR';
  if (id.includes('RISK')) return 'RISK';
  if (id.includes('RESEARCH') || id.includes('DEBATER')) return 'RESEARCH';
  
  const station = agent.station || '';
  if (station === 'research') return 'RESEARCH';
  if (station === 'error') return 'RISK';
  if (station === 'debate') return 'RESEARCH';
  if (station === 'desk') return 'QUANT';
  
  return 'RESEARCH';
}

export function getFallbackQuote(archetype) {
  const pool = FALLBACK_QUOTES[archetype] || FALLBACK_QUOTES.RESEARCH;
  const index = fallbackIndexes[archetype] ?? 0;
  const quote = pool[index % pool.length];
  fallbackIndexes[archetype] = (index + 1) % pool.length;
  return quote;
}
