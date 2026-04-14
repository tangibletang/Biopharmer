import type { ClinicalSnapshot, Milestone, StockPoint, TickerMeta, Ticker } from './types'

// ── Helpers ────────────────────────────────────────────────────────────────

function weekDate(weekIndex: number): string {
  // 52 weekly dates starting 2024-01-01 (Monday)
  const start = new Date('2024-01-01')
  start.setDate(start.getDate() + weekIndex * 7)
  return start.toISOString().split('T')[0]
}

function buildPrices(rawPrices: number[]): StockPoint[] {
  return rawPrices.map((price, i) => ({ date: weekDate(i), price }))
}

// ── Clinical data (mirrors what is seeded to DB) ───────────────────────────

export const CLINICAL_DATA: Record<Ticker, ClinicalSnapshot> = {
  DYNE: {
    emax_pct: 18.5,
    half_life_days: 28.0,
    grade_3_ae_pct: 6.2,
    audit_text:
      'DYNE-251 DELIVER Ph1/2 interim (n=20): mean dystrophin at week 24 = 18.5% of normal (western blot). Primary SAE: transient LFT elevation (Grade 3, n=1, resolved). Muscle TfR1 target engagement confirmed by biopsy. Ongoing dose-escalation cohort targeting >20% dystrophin floor.',
  },
  RNA: {
    emax_pct: 14.0,
    half_life_days: 21.0,
    grade_3_ae_pct: 4.8,
    audit_text:
      'AOC 1001 (DM1) MARINA Ph1/2 (n=40): statistically significant MBNL1 nuclear foci reduction at week 16. Grade 3 AE rate 4.8% (infusion-related reactions, n=2). Cross-platform inference: DMD AOC preclinical data show exon 45-skip dystrophin at 14% of normal in mdx mouse at 3 mg/kg. IND for DMD indication expected 2025.',
  },
  SRPT: {
    emax_pct: 28.1,
    half_life_days: 365.0,
    grade_3_ae_pct: 12.4,
    audit_text:
      'ELEVIDYS FDA accelerated approval (June 2023, ages 4–5). EMBARK Ph3 (n=125): micro-dystrophin expression 28.1% of normal at week 52; NSAA score +2.6 vs +1.9 placebo (p=0.07, missed primary). Grade 3+ AEs 12.4%: hepatic enzyme elevations managed with prophylactic steroids. No deaths. Complement activation and TMA reported in 1 patient.',
  },
  WVE: {
    emax_pct: 9.8,
    half_life_days: 14.0,
    grade_3_ae_pct: 3.1,
    audit_text:
      'WVE-N531 WAVELENGTH Ph1/2 (n=18, exon 53 amenable): mean dystrophin 9.8% of normal at week 24 (mass spectrometry). Best responder: 21.3%. Grade 3 AE rate 3.1% — lowest in class, supporting stereopure tolerability hypothesis. Ongoing dose-optimization cohort; partnered with GSK for manufacturing scale-up.',
  },
}

// ── Company metadata ───────────────────────────────────────────────────────

export const COMPANY_NAMES: Record<Ticker, string> = {
  DYNE: 'Dyne Therapeutics',
  RNA:  'Avidity Biosciences',
  SRPT: 'Sarepta Therapeutics',
  WVE:  'Wave Life Sciences',
}

export const TICKER_COLORS: Record<Ticker, string> = {
  DYNE: '#58a6ff',
  RNA:  '#3fb950',
  SRPT: '#d2a8ff',
  WVE:  '#ffa657',
}

// ── Mock price series (52 weekly points, 2024-01-01 → 2024-12-23) ──────────

const DYNE_RAW = [
   9.50,  9.72,  9.48, 10.05, 10.31,  9.89,  9.61,  9.83, 10.15, 10.47,
  10.78, 11.12, 11.43, 11.19, 11.72, 12.05, 12.38, 12.61, 13.10, 13.74,
  14.18, 13.52, 13.05, 12.81, 12.43, 12.17, 11.88, 11.59, 11.37, 11.14,
  11.46, 11.79, 12.04, 11.85, 11.51, 11.22, 10.98, 10.74, 10.57, 10.89,
  11.18, 11.44, 11.72, 11.98, 12.24, 12.02, 11.74, 11.48, 11.18, 11.38,
  11.61, 11.87,
]

const RNA_RAW = [
  24.20, 24.85, 25.42, 24.98, 25.61, 26.15, 25.73, 26.34, 27.02, 26.78,
  27.45, 28.12, 28.87, 29.44, 30.18, 30.95, 31.47, 32.14, 32.89, 33.41,
  32.87, 31.94, 30.82, 29.73, 28.95, 28.31, 27.68, 27.15, 26.72, 26.38,
  26.85, 27.43, 28.12, 27.89, 28.45, 29.02, 29.67, 30.14, 30.78, 31.22,
  30.89, 30.24, 29.67, 29.14, 28.72, 28.35, 28.89, 29.44, 29.18, 28.74,
  28.41, 28.87,
]

const SRPT_RAW = [
  108.50, 110.23, 112.47, 111.84, 113.56, 115.29, 114.73, 116.45, 118.23, 119.87,
  121.34, 122.89, 124.45, 123.78, 125.34, 126.89, 105.42,  97.83,  93.21,  90.87,
   88.43,  89.67,  91.23,  93.45,  95.12,  94.56,  93.87,  95.23,  97.45,  98.67,
   97.23,  96.45,  95.87,  97.34,  98.78,  97.45,  96.23,  95.12,  94.67,  96.23,
   97.45,  98.67,  99.12,  98.45,  97.83,  98.67,  99.45, 100.23,  99.67,  98.93,
   99.45, 100.12,
]

const WVE_RAW = [
   7.52,  7.84,  8.13,  7.95,  8.34,  8.67,  8.45,  8.89,  9.12,  9.67,
  14.23, 13.87, 13.23, 12.56, 12.01, 11.54, 11.23, 11.47, 11.78, 11.45,
  11.12, 10.87, 10.56, 10.34, 10.67, 10.98, 11.23, 11.48, 11.23, 11.45,
  11.12, 10.87, 10.64, 10.45, 10.78, 11.05, 11.34, 11.12, 10.87, 10.64,
  10.89, 11.15, 11.42, 11.23, 10.98, 10.74, 10.89, 11.12, 11.34, 11.18,
  10.95, 11.23,
]

// ── Milestones (index → week date) ────────────────────────────────────────

// ── Historical milestones ──────────────────────────────────────────────────

const DYNE_MILESTONES: Milestone[] = [
  {
    date: weekDate(3),
    label: 'FDA Fast Track — DYNE-251',
    detail:
      'FDA grants Fast Track Designation for DYNE-251 (exon 51 skipping). Designation accelerates review pathway and enables rolling NDA submission. Validates AOC platform muscle-targeting approach ahead of DELIVER readout.',
    type: 'positive',
    category: 'historical',
  },
  {
    date: weekDate(20),
    label: 'DELIVER Ph1/2 Interim',
    detail:
      'DELIVER interim: mean dystrophin 18.5% of normal at week 24 — beats consensus estimate of ~12%. Single Grade 3 LFT elevation resolved without discontinuation. Muscle TfR1 engagement confirmed by biopsy. Dose-escalation cohort to open, targeting ≥20% floor.',
    type: 'positive',
    category: 'historical',
  },
  {
    date: weekDate(36),
    label: 'Dose-Escalation Enrollment Complete',
    detail:
      'DELIVER dose-escalation cohort fully enrolled (n=12 at 2× dose). Ph2 readout expected Q1 2025. Street watching for ≥25% dystrophin to de-risk competitive positioning vs SRPT\'s ELEVIDYS gene therapy.',
    type: 'neutral',
    category: 'historical',
  },
  {
    date: '2025-01-20',
    label: 'DELIVER Dose-Escalation Readout',
    detail:
      'Ph2 dose-escalation data: mean dystrophin 24.2% at 2× dose — approaches but does not clear the 25% de-risking threshold. Dose-optimization cohort opened at 3× dose. Street divided on whether incremental dystrophin gain justifies higher-dose safety exposure.',
    type: 'positive',
    category: 'historical',
  },
  {
    date: '2025-06-09',
    label: 'Ph2 Design Announced — Functional Primary',
    detail:
      'Dyne announces pivotal Ph2 design with NSAA score as primary endpoint (functional, not biomarker). FDA alignment secured. Timeline to approval extended vs biomarker pathway, but removes surrogate endpoint regulatory risk. Enrollment target n=120, expected to open Q3 2025.',
    type: 'neutral',
    category: 'historical',
  },
  // ── Projected (post April 2026) ──
  {
    date: '2026-06-15',
    label: 'DELIVER Ph2 Enrollment Complete',
    detail:
      'Expected completion of DELIVER Ph2 pivotal enrollment (n=120). Enrollment pace is being closely tracked against SRPT\'s next-gen AAV program. Full dataset readout projected Q2 2027 — the binary event that determines whether DYNE can displace ELEVIDYS as standard of care.',
    type: 'neutral',
    category: 'projected',
  },
  {
    date: '2026-11-02',
    label: 'Ph2 Interim Safety Review (DSMB)',
    detail:
      'Independent Data Safety Monitoring Board interim review at ~50% enrollment. A clean safety review unlocks dose cohort expansion and confirms the tolerability thesis. Any Grade 3+ hepatic signal would trigger a clinical hold and reset the timeline by 12–18 months.',
    type: 'neutral',
    category: 'projected',
  },
  {
    date: '2027-04-12',
    label: 'DELIVER Ph2 Primary Readout',
    detail:
      'Pivotal Ph2 primary endpoint readout: NSAA score change from baseline at week 52. Target: ≥3.5-point delta vs placebo. This is the make-or-break binary for DYNE — a positive result supports accelerated approval filing; a miss likely forces a partnership or strategic review.',
    type: 'positive',
    category: 'projected',
  },
]

const RNA_MILESTONES: Milestone[] = [
  {
    date: weekDate(5),
    label: 'MARINA Ph2 Enrollment Complete',
    detail:
      'AOC 1001 (del-zota) MARINA Ph2 enrollment complete at n=40. DM1 proof-of-concept readout due Q2 2024. Cross-validation expected to inform DMD program IND timing. GSK partnership discussions rumored in background.',
    type: 'neutral',
    category: 'historical',
  },
  {
    date: weekDate(23),
    label: 'AOC 1001 DM1 Interim — Positive',
    detail:
      'MARINA Ph2 interim: statistically significant reduction in MBNL1 nuclear foci at week 16. Grade 3 AE rate 4.8%. CEO confirms DMD exon 45-skip IND filing on track for Q4 2024, validating TfR1 AOC muscle uptake hypothesis across multiple indications.',
    type: 'positive',
    category: 'historical',
  },
  {
    date: weekDate(43),
    label: 'DMD IND Filed',
    detail:
      'Avidity files IND for AOC DMD program targeting exon 45 skip. ~8% of DMD patients amenable. Preclinical dystrophin at 14% of normal in mdx mouse. Phase 1 trial expected to open early 2025 — first in-human data potential H2 2025.',
    type: 'positive',
    category: 'historical',
  },
  {
    date: '2025-03-17',
    label: 'AOC DMD Ph1 — First Patient Dosed',
    detail:
      'First-in-human dosing for Avidity\'s AOC DMD program (exon 45 skip). Initial safety and PK data confirmed TfR1 muscle uptake consistent with the mdx mouse model. Grade 3 AE rate of 3.2% at starting dose — below the DYNE benchmark, validating differentiated safety profile.',
    type: 'positive',
    category: 'historical',
  },
  {
    date: '2025-10-06',
    label: 'AOC DMD Ph1 Dose-Escalation Safety Interim',
    detail:
      'Ph1 dose-escalation interim: three dose cohorts completed, no dose-limiting toxicities. Dystrophin signal detectable at mid-dose cohort (7.8% vs normal). Full efficacy data pending higher-dose cohort completion. Street raised probability of success estimates from 45% to 62%.',
    type: 'positive',
    category: 'historical',
  },
  // ── Projected (post April 2026) ──
  {
    date: '2026-07-20',
    label: 'AOC DMD Ph1 Full Efficacy Readout',
    detail:
      'Full Phase 1 efficacy dataset at maximum tolerated dose. Key threshold: ≥10% mean dystrophin to advance to Ph2. If Avidity achieves ≥14% (matching preclinical), the platform competes directly with DYNE on both efficacy and safety — a major re-rating event.',
    type: 'positive',
    category: 'projected',
  },
  {
    date: '2026-12-07',
    label: 'Ph2 Design & Partnership Update',
    detail:
      'Expected Ph2 design announcement and update on potential ex-US partnerships. Avidity has signaled interest in a co-development deal for Asia-Pacific rights. A partnership with a top-5 pharma would validate the program and provide non-dilutive capital for the pivotal trial.',
    type: 'neutral',
    category: 'projected',
  },
  {
    date: '2027-05-10',
    label: 'MARINA Full Approval Decision (DM1)',
    detail:
      'FDA PDUFA date for AOC 1001 (del-zota) full approval in DM1. Approval is critical to Avidity\'s platform credibility — it would make them the first company to achieve regulatory approval with an AOC, directly de-risking the DMD pipeline and likely triggering a multiple expansion.',
    type: 'positive',
    category: 'projected',
  },
]

const SRPT_MILESTONES: Milestone[] = [
  {
    date: weekDate(3),
    label: 'ELEVIDYS Revenue Guidance Raised',
    detail:
      'Sarepta raises ELEVIDYS (delandistrogene moxeparvovec) FY2024 revenue guidance to $500M, citing stronger-than-expected commercial uptake in ages 4–5. Payer coverage expanding; 74% of submitted claims approved. Key catalyst ahead: EMBARK Ph3 confirmatory data.',
    type: 'positive',
    category: 'historical',
  },
  {
    date: weekDate(16),
    label: 'EMBARK Ph3 Misses Primary Endpoint',
    detail:
      'EMBARK Ph3 full data (n=125): NSAA score change +2.6 vs +1.9 placebo at week 52. p=0.07 — misses pre-specified α=0.05 threshold. FDA Accelerated Approval remains in place; confirmatory trial required. Stock -17% intraday. Bears argue label may be restricted; bulls argue functional benefit is real and payer coverage may hold.',
    type: 'negative',
    category: 'historical',
  },
  {
    date: weekDate(42),
    label: 'FDA Confirms Accelerated Approval',
    detail:
      'FDA issues letter confirming ELEVIDYS Accelerated Approval is maintained pending ongoing post-marketing confirmatory trial. Regulatory risk materially reduced. Street upgrades price targets. Broader DMD gene therapy label expansion to older patients still pending.',
    type: 'positive',
    category: 'historical',
  },
  {
    date: '2025-03-24',
    label: 'EMBARK 18-Month Follow-Up — Durability Confirmed',
    detail:
      'EMBARK 18-month follow-up: micro-dystrophin expression maintained at 26.4% of normal (vs 28.1% at week 52) — confirming durability thesis with minimal decline. NSAA score delta widened to +3.1 vs placebo at 18 months, strengthening the functional benefit argument retrospectively.',
    type: 'positive',
    category: 'historical',
  },
  {
    date: '2025-09-08',
    label: 'Label Expansion Approved — Ages 2–3',
    detail:
      'FDA approves ELEVIDYS label expansion to ambulatory patients ages 2–3. Expands treatable population by ~1,200 newly diagnosed patients/year in the US. Commercial launch in younger cohort underway; earlier intervention data shows 31% dystrophin restoration vs 28% in older patients.',
    type: 'positive',
    category: 'historical',
  },
  // ── Projected (post April 2026) ──
  {
    date: '2026-06-29',
    label: 'EMBARK 3-Year Durability Data',
    detail:
      'Three-year follow-up from original EMBARK cohort — the longest gene therapy durability dataset in DMD. Any statistically significant decline in dystrophin below 20% of normal would trigger debate about re-dosing feasibility and the long-term commercial franchise value of a one-time therapy.',
    type: 'neutral',
    category: 'projected',
  },
  {
    date: '2026-10-19',
    label: 'Next-Gen Capsid Ph1 IND Filing',
    detail:
      'Sarepta expected to file IND for next-generation AAV capsid (SRPT-9003) with improved muscle tropism and potentially enabling re-dosing — addressing the single biggest structural bear argument against gene therapy. A clean IND acceptance materially expands the long-term addressable market.',
    type: 'positive',
    category: 'projected',
  },
  {
    date: '2027-01-26',
    label: 'FY2026 ELEVIDYS Revenue vs $1B Milestone',
    detail:
      'Full-year 2026 ELEVIDYS revenue vs consensus $950M–$1.1B range. Crossing $1B in annual revenue cements ELEVIDYS as a blockbuster and is the key trigger for multiple expansion from current ~8× revenue. Payer mix, net price, and ex-US launch pace are the swing factors.',
    type: 'neutral',
    category: 'projected',
  },
]

const WVE_MILESTONES: Milestone[] = [
  {
    date: weekDate(10),
    label: 'GSK Partnership — Up to $3.3B',
    detail:
      'Wave Life Sciences announces strategic partnership with GSK covering stereopure oligonucleotide platform. Terms: $120M upfront, up to $3.3B in milestones across CNS and neuromuscular indications. GSK to co-fund DMD manufacturing scale-up. Validates PRISM stereochemistry platform as differentiator.',
    type: 'positive',
    category: 'historical',
  },
  {
    date: weekDate(28),
    label: 'WAVELENGTH Ph1/2 — 9.8% Dystrophin',
    detail:
      'WAVELENGTH Ph1/2 (n=18, exon 53 amenable): mean dystrophin 9.8% of normal at week 24 (mass spectrometry). Best responder 21.3%. Grade 3 AE rate 3.1% — significantly below DYNE (6.2%) and SRPT (12.4%). Safety leadership thesis confirmed. Bears flag absolute efficacy gap vs DYNE; bulls argue dose-optimization will close it.',
    type: 'positive',
    category: 'historical',
  },
  {
    date: weekDate(48),
    label: 'Dose-Optimization — 21.3% Best Responder',
    detail:
      'WVE-N531 dose-optimization results: best-responder at higher dose achieves 21.3% dystrophin, matching DYNE mean and narrowing efficacy gap. Raises debate about Ph2 dose selection and whether stereopure safety advantages justify lower mean efficacy. GSK reviewing Ph2 design with Wave.',
    type: 'neutral',
    category: 'historical',
  },
  {
    date: '2025-04-14',
    label: 'Ph2 Optimized-Dose Design Announced',
    detail:
      'Wave and GSK announce WVE-N531 Ph2 design at the optimized 3× dose. Primary endpoint: mean dystrophin ≥15% of normal at week 24 (biomarker-based accelerated approval pathway). GSK prioritized efficacy parity over safety differentiation — signals confidence in the tolerability data.',
    type: 'neutral',
    category: 'historical',
  },
  {
    date: '2025-11-17',
    label: 'GSK Milestone Payment — $75M Received',
    detail:
      'GSK $75M milestone payment received upon WVE-N531 Ph2 first patient dosed. Confirms GSK commitment to the platform. Wave\'s cash runway extended to Q4 2027. Ph2 enrollment tracking ahead of schedule at 60% of target within first 3 months.',
    type: 'positive',
    category: 'historical',
  },
  // ── Projected (post April 2026) ──
  {
    date: '2026-07-06',
    label: 'WVE-N531 Ph2 Enrollment Complete',
    detail:
      'Expected completion of WVE-N531 Ph2 enrollment (n=60, exon 53 amenable). Full dataset readout projected Q1 2027. With DYNE targeting exon 51 and WVE targeting exon 53, these programs address different patient subsets — but the comparative efficacy and safety data will define the stereopure platform\'s commercial ceiling.',
    type: 'neutral',
    category: 'projected',
  },
  {
    date: '2027-02-01',
    label: 'WAVELENGTH Ph2 Primary Readout',
    detail:
      'Pivotal Ph2 primary readout: mean dystrophin at week 24 vs placebo. Threshold for accelerated approval filing: ≥15% mean. The safety profile (Grade 3 AE rate vs DYNE\'s 6.2%) will be as important as efficacy — if WVE achieves 15%+ with <4% Grade 3 AEs, the stereopure thesis is fully validated.',
    type: 'positive',
    category: 'projected',
  },
  {
    date: '2027-06-21',
    label: 'GSK Option Exercise Decision',
    detail:
      'GSK option to exclusively license WVE-N531 for ex-US commercialization expires. Exercise (estimated $400M) would fund Wave\'s US commercial buildout and is the single largest near-term value creation event. Non-exercise would force Wave to seek alternative partners or pursue US launch independently.',
    type: 'positive',
    category: 'projected',
  },
]

// ── Assembled ticker data ──────────────────────────────────────────────────

export const TICKER_DATA: Record<Ticker, TickerMeta> = {
  DYNE: {
    ticker: 'DYNE',
    company_name: COMPANY_NAMES.DYNE,
    color: TICKER_COLORS.DYNE,
    prices: buildPrices(DYNE_RAW),
    milestones: DYNE_MILESTONES,
  },
  RNA: {
    ticker: 'RNA',
    company_name: COMPANY_NAMES.RNA,
    color: TICKER_COLORS.RNA,
    prices: buildPrices(RNA_RAW),
    milestones: RNA_MILESTONES,
  },
  SRPT: {
    ticker: 'SRPT',
    company_name: COMPANY_NAMES.SRPT,
    color: TICKER_COLORS.SRPT,
    prices: buildPrices(SRPT_RAW),
    milestones: SRPT_MILESTONES,
  },
  WVE: {
    ticker: 'WVE',
    company_name: COMPANY_NAMES.WVE,
    color: TICKER_COLORS.WVE,
    prices: buildPrices(WVE_RAW),
    milestones: WVE_MILESTONES,
  },
}

export const ALL_TICKERS: Ticker[] = ['DYNE', 'RNA', 'SRPT', 'WVE']
