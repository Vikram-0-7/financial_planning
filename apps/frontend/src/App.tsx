import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BellIcon,
  CheckIcon,
  ChevronRightIcon,
  DashboardIcon,
  GraduationIcon,
  HomeIcon,
  PieChartIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  SunriseIcon,
  TargetIcon,
  TrendingUpIcon,
  WalletIcon,
} from './components/icons';
import { DonutChart, LineChart } from './components/charts';

type Overview = {
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  investedAssets: number;
  cashReserves: number;
  totalDebt: number;
  creditScore: number;
};

type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetYear: number;
  category: string;
  monthlyContribution: number;
  icon: string;
};

type BudgetCategory = {
  id: string;
  label: string;
  planned: number;
  spent: number;
  color: string;
};

type Transaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  type: 'income' | 'expense';
  amount: number;
};

type Portfolio = {
  holdings: Record<string, number>;
  targetAllocation: Record<string, number>;
};

type Dashboard = {
  overview: Overview;
  goals: Goal[];
  budgets: BudgetCategory[];
  transactions: Transaction[];
  portfolio: Portfolio;
};

type ScenarioInput = {
  monthlyInvestment: number;
  years: number;
  annualReturn: number;
  volatility: number;
};

type ScenarioPoint = { month: number; value: number };

type ScenarioResponse = {
  projectedValue: number;
  totalContributed: number;
  expectedGain: number;
  monteCarlo: ScenarioPoint[][];
};

type RiskTolerance = 'Conservative' | 'Balanced' | 'Growth' | 'Aggressive';

type ProfileInput = {
  age: number;
  occupation: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  dependents: number;
  riskTolerance: RiskTolerance;
  timeHorizon: number;
};

type PlanResponse = {
  lifeStage: string;
  headline: string;
  score: number;
  priority: string;
  recommendedSavingsRate: number;
  monthlySavingsTarget: number;
  monthlyInvestable: number;
  emergencyFundMonths: number;
  emergencyFundTarget: number;
  suggestedAllocation: Record<string, number>;
  actions: string[];
  guardrails: string[];
  milestones: string[];
  reviewCycleMonths: number;
};

type PersonaPreset = ProfileInput & {
  label: string;
  note: string;
};

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const personaPresets: PersonaPreset[] = [
  {
    label: 'Student',
    note: 'Build runway, study debt, and earning power.',
    age: 22,
    occupation: 'University student',
    monthlyIncome: 3200,
    monthlyExpenses: 2100,
    dependents: 0,
    riskTolerance: 'Growth',
    timeHorizon: 20,
  },
  {
    label: 'Early Career',
    note: 'Stack savings while compounding is strongest.',
    age: 29,
    occupation: 'Product designer',
    monthlyIncome: 7800,
    monthlyExpenses: 4200,
    dependents: 0,
    riskTolerance: 'Balanced',
    timeHorizon: 18,
  },
  {
    label: 'Family Builder',
    note: 'Protect the household and keep growth steady.',
    age: 39,
    occupation: 'Operations manager',
    monthlyIncome: 12400,
    monthlyExpenses: 7200,
    dependents: 2,
    riskTolerance: 'Balanced',
    timeHorizon: 14,
  },
  {
    label: 'Founder',
    note: 'Separate personal security from business volatility.',
    age: 41,
    occupation: 'Startup founder',
    monthlyIncome: 15500,
    monthlyExpenses: 9400,
    dependents: 1,
    riskTolerance: 'Growth',
    timeHorizon: 12,
  },
  {
    label: 'Retiree',
    note: 'Preserve income, flexibility, and dignity.',
    age: 67,
    occupation: 'Retired teacher',
    monthlyIncome: 6400,
    monthlyExpenses: 4100,
    dependents: 0,
    riskTolerance: 'Conservative',
    timeHorizon: 8,
  },
];

const goalIconMap: Record<string, React.FC<{ size?: number; className?: string }>> = {
  home: HomeIcon,
  education: GraduationIcon,
  retirement: SunriseIcon,
  shield: ShieldIcon,
  target: TargetIcon,
  wallet: WalletIcon,
  trending: TrendingUpIcon,
};

const allocationColors: Record<string, string> = {
  stocks: '#1dd1a1',
  bonds: '#4dabf7',
  realEstate: '#f6ad55',
  crypto: '#f472b6',
  cash: '#94a3b8',
  commodities: '#facc15',
};

const allocationLabels: Record<string, string> = {
  stocks: 'Stocks',
  bonds: 'Bonds',
  realEstate: 'Real estate',
  crypto: 'Crypto',
  cash: 'Cash',
  commodities: 'Commodities',
};

const lifeStageAccent: Record<string, string> = {
  Starter: 'emerald',
  Growth: 'sky',
  'Family Builder': 'gold',
  Independent: 'sand',
  'Peak Earning': 'emerald',
  Retirement: 'rose',
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function getGoalIcon(icon: string) {
  return goalIconMap[icon] ?? TargetIcon;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function makeCardSegments(source: Record<string, number>) {
  return Object.entries(source).map(([key, value]) => ({
    label: allocationLabels[key] ?? key,
    value,
    color: allocationColors[key] ?? '#1dd1a1',
  }));
}

function SectionTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="section-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}

function MetricCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  );
}

export default function App() {
  const [dashboardData, setDashboard] = useState<Dashboard | null>(null);
  const [planData, setPlan] = useState<PlanResponse | null>(null);
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [profile, setProfile] = useState<ProfileInput>({
    age: 34,
    occupation: 'Marketing lead',
    monthlyIncome: 9800,
    monthlyExpenses: 5900,
    dependents: 1,
    riskTolerance: 'Balanced',
    timeHorizon: 15,
  });
  const [scenarioInput, setScenarioInput] = useState<ScenarioInput>({
    monthlyInvestment: 1500,
    years: 15,
    annualReturn: 8.2,
    volatility: 14,
  });

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const response = await fetch('/api/dashboard');
        if (!response.ok) throw new Error('Dashboard request failed');
        const nextDashboard: Dashboard = await response.json();
        if (active) setDashboard(nextDashboard);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard');
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!dashboardData || planData) return;
    void fetchPlan(profile);
  }, [dashboardData, planData, profile]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/scenario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenarioInput),
        });
        if (!response.ok) throw new Error('Scenario request failed');
        const nextScenario: ScenarioResponse = await response.json();
        if (active) setScenario(nextScenario);
      } catch (scenarioError) {
        if (active) setError(scenarioError instanceof Error ? scenarioError.message : 'Unable to calculate scenario');
      }
    }, 280);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [scenarioInput]);

  useEffect(() => {
    if (!planData) return;
    setScenarioInput((current) => ({
      ...current,
      monthlyInvestment: Math.max(planData.monthlyInvestable, 250),
      years: profile.timeHorizon,
    }));
  }, [planData, profile.timeHorizon]);

  const monthlySurplus = dashboardData ? dashboardData.overview.monthlyIncome - dashboardData.overview.monthlyExpenses : 0;
  const currentPortfolioValue = dashboardData ? Object.values(dashboardData.portfolio.holdings).reduce((sum, value) => sum + value, 0) : 0;
  const currentPortfolioSegments = useMemo(
    () => (dashboardData ? makeCardSegments(dashboardData.portfolio.holdings) : []),
    [dashboardData],
  );
  const targetPortfolioSegments = useMemo(
    () => (planData ? makeCardSegments(planData.suggestedAllocation) : []),
    [planData],
  );
  const transactionPreview = dashboardData?.transactions.slice(0, 6) ?? [];
  const latestGoals = dashboardData?.goals ?? [];
  const currentBudgets = dashboardData?.budgets ?? [];

  async function fetchPlan(nextProfile: ProfileInput) {
    setPlanBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/profile-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextProfile),
      });
      if (!response.ok) throw new Error('Plan request failed');
      const nextPlan: PlanResponse = await response.json();
      setPlan(nextPlan);
      setScenarioInput((current) => ({
        ...current,
        monthlyInvestment: Math.max(nextPlan.monthlyInvestable, 250),
        years: nextProfile.timeHorizon,
      }));
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : 'Unable to generate a plan');
    } finally {
      setPlanBusy(false);
    }
  }

  function applyPersona(persona: PersonaPreset) {
    setProfile({
      age: persona.age,
      occupation: persona.occupation,
      monthlyIncome: persona.monthlyIncome,
      monthlyExpenses: persona.monthlyExpenses,
      dependents: persona.dependents,
      riskTolerance: persona.riskTolerance,
      timeHorizon: persona.timeHorizon,
    });
    void fetchPlan(persona);
  }

  function updateProfileField<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateScenarioField<K extends keyof ScenarioInput>(key: K, value: ScenarioInput[K]) {
    setScenarioInput((current) => ({ ...current, [key]: value }));
  }

  async function runPlan() {
    await fetchPlan(profile);
  }

  if (!dashboardData || !planData) {
    return (
      <div className="app-shell loading-shell">
        <div className="ambient ambient-a" />
        <div className="ambient ambient-b" />
        <div className="loading-panel">
          <span className="eyebrow">Planning system online</span>
          <h1>Constructing your financial command center</h1>
          <p>Connecting the React experience to the FastAPI planning engine.</p>
          {error && <div className="error-banner">{error}</div>}
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  const stageAccent = planData ? lifeStageAccent[planData.lifeStage] ?? 'emerald' : 'emerald';
  const scenarioProjectionCards = [
    {
      label: 'Projected value',
      value: money.format(scenario?.projectedValue ?? 0),
      note: 'Compound growth model',
      tone: 'emerald',
    },
    {
      label: 'Total contributed',
      value: money.format(scenario?.totalContributed ?? 0),
      note: 'Your deposits over time',
      tone: 'sky',
    },
    {
      label: 'Expected gain',
      value: money.format(scenario?.expectedGain ?? 0),
      note: 'Growth above principal',
      tone: 'gold',
    },
    {
      label: 'Plan score',
      value: `${planData.score}/100`,
      note: planData.lifeStage,
      tone: 'rose',
    },
  ];

  const recommendationCards = [
    {
      label: 'Savings target',
      value: formatPercent(planData.recommendedSavingsRate),
      note: money.format(planData.monthlySavingsTarget),
    },
    {
      label: 'Emergency fund',
      value: `${planData.emergencyFundMonths} months`,
      note: money.format(planData.emergencyFundTarget),
    },
    {
      label: 'Review cycle',
      value: `${planData.reviewCycleMonths} months`,
      note: planData.priority,
    },
    {
      label: 'Investable now',
      value: money.format(planData.monthlyInvestable),
      note: 'After safety reserve',
    },
  ];

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <div className="ambient ambient-c" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>Aurora Finance</strong>
            <span>Personal planning for every stage of life</span>
          </div>
        </div>

        <nav className="topnav" aria-label="Primary">
          <a href="#plan">Plan</a>
          <a href="#snapshot">Snapshot</a>
          <a href="#goals">Goals</a>
          <a href="#projection">Projection</a>
        </nav>

        <div className="topbar-actions">
          <button type="button" className="icon-button">
            <SearchIcon size={17} />
          </button>
          <button type="button" className="icon-button">
            <BellIcon size={17} />
          </button>
          <button type="button" className="secondary-button" onClick={() => void fetchPlan(profile)}>
            <RefreshIcon size={16} />
            Refresh plan
          </button>
        </div>
      </header>

      <main className="page-grid">
        <section className="hero-card">
          <div className="hero-copy">
            <span className="eyebrow">World-class financial planning</span>
            <h1>Build a money system that stays calm from first paycheck to retirement.</h1>
            <p>
              Aurora Finance adapts to students, founders, contractors, parents, professionals, and retirees with a single
              planning engine tuned for resilience and growth.
            </p>

            <div className="hero-tags">
              <span className="hero-tag">Any age</span>
              <span className="hero-tag">Any occupation</span>
              <span className="hero-tag">Personalized guidance</span>
              <span className="hero-tag">Live projections</span>
            </div>

            <div className="hero-metrics">
              <MetricCard
                label="Net worth"
                value={money.format(dashboardData.overview.netWorth)}
                note={`${money.format(dashboardData.overview.investedAssets)} invested`}
                tone="emerald"
              />
              <MetricCard
                label="Monthly surplus"
                value={money.format(monthlySurplus)}
                note={`${formatPercent(dashboardData.overview.savingsRate)} savings rate`}
                tone="sky"
              />
              <MetricCard
                label="Plan score"
                value={`${planData.score}/100`}
                note={planData.lifeStage}
                tone="gold"
              />
              <MetricCard
                label="Credit health"
                value={`${dashboardData.overview.creditScore}`}
                note={`${money.format(dashboardData.overview.cashReserves)} cash reserves`}
                tone="rose"
              />
            </div>
          </div>

          <aside className={`planner-card planner-${stageAccent}`} id="plan">
            <div className="planner-header">
              <div>
                <span className="eyebrow">Personal plan studio</span>
                <h2>{planData.lifeStage}</h2>
              </div>
              <div className="score-badge">
                <DashboardIcon size={16} />
                <span>{planData.score}/100</span>
              </div>
            </div>

            <p className="planner-copy">{planData.headline}</p>

            <div className="persona-strip" role="list">
              {personaPresets.map((persona) => (
                <button
                  key={persona.label}
                  type="button"
                  className="persona-card"
                  onClick={() => applyPersona(persona)}
                  title={persona.note}
                >
                  <strong>{persona.label}</strong>
                  <span>{persona.note}</span>
                </button>
              ))}
            </div>

            <div className="planner-grid">
              <label className="field">
                <span>Age</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={profile.age}
                  onChange={(event) => updateProfileField('age', Number(event.target.value))}
                />
              </label>

              <label className="field wide">
                <span>Occupation</span>
                <input
                  type="text"
                  value={profile.occupation}
                  onChange={(event) => updateProfileField('occupation', event.target.value)}
                />
              </label>

              <label className="field">
                <span>Monthly income</span>
                <input
                  type="number"
                  min={0}
                  value={profile.monthlyIncome}
                  onChange={(event) => updateProfileField('monthlyIncome', Number(event.target.value))}
                />
              </label>

              <label className="field">
                <span>Monthly expenses</span>
                <input
                  type="number"
                  min={0}
                  value={profile.monthlyExpenses}
                  onChange={(event) => updateProfileField('monthlyExpenses', Number(event.target.value))}
                />
              </label>

              <label className="field">
                <span>Dependents</span>
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={profile.dependents}
                  onChange={(event) => updateProfileField('dependents', Number(event.target.value))}
                />
              </label>

              <label className="field">
                <span>Risk tolerance</span>
                <select
                  value={profile.riskTolerance}
                  onChange={(event) => updateProfileField('riskTolerance', event.target.value as RiskTolerance)}
                >
                  <option value="Conservative">Conservative</option>
                  <option value="Balanced">Balanced</option>
                  <option value="Growth">Growth</option>
                  <option value="Aggressive">Aggressive</option>
                </select>
              </label>

              <label className="field wide">
                <span>Planning horizon</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={profile.timeHorizon}
                  onChange={(event) => updateProfileField('timeHorizon', Number(event.target.value))}
                />
              </label>
            </div>

            <div className="planner-actions">
              <button type="button" className="primary-button" onClick={() => void runPlan()} disabled={planBusy}>
                <TargetIcon size={16} />
                {planBusy ? 'Building plan...' : 'Generate my plan'}
              </button>
              <button type="button" className="ghost-button" onClick={() => void fetchPlan(personaPresets[1])}>
                <ChevronRightIcon size={16} />
                Use a baseline profile
              </button>
            </div>

            <div className="planner-stats">
              {recommendationCards.map((card) => (
                <article key={card.label} className="mini-stat">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <p>{card.note}</p>
                </article>
              ))}
            </div>
          </aside>
        </section>

        <section className="content-grid" id="snapshot">
          <article className="panel panel-wide">
            <SectionTitle
              eyebrow="Snapshot"
              title="Current financial picture"
              copy="These are the live numbers driving the plan, budget, and investment mix."
            />

            <div className="detail-grid">
              <div className="chart-card">
                <div className="chart-header">
                  <h3>Current portfolio</h3>
                  <span>{money.format(currentPortfolioValue)}</span>
                </div>
                <DonutChart
                  size={260}
                  segments={currentPortfolioSegments}
                  centerLabel="Holdings"
                  centerValue={money.format(currentPortfolioValue)}
                  className="donut-chart"
                />
                <div className="legend-list">
                  {currentPortfolioSegments.map((segment) => (
                    <div key={segment.label} className="legend-item">
                      <span className="legend-swatch" style={{ background: segment.color }} />
                      <strong>{segment.label}</strong>
                      <span>{formatPercent((segment.value / currentPortfolioValue) * 100)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="stats-stack">
                <div className="snapshot-metrics">
                  <MetricCard label="Income" value={money.format(dashboardData.overview.monthlyIncome)} note="Monthly gross income" tone="emerald" />
                  <MetricCard label="Expenses" value={money.format(dashboardData.overview.monthlyExpenses)} note="Monthly spending" tone="rose" />
                  <MetricCard label="Debt" value={money.format(dashboardData.overview.totalDebt)} note="Outstanding obligations" tone="gold" />
                  <MetricCard label="Cash" value={money.format(dashboardData.overview.cashReserves)} note="Immediately available" tone="sky" />
                </div>

                <div className="status-panel">
                  <div className="status-row">
                    <span>Life stage</span>
                    <strong>{planData.lifeStage}</strong>
                  </div>
                  <div className="status-row">
                    <span>Priority</span>
                    <strong>{planData.priority}</strong>
                  </div>
                  <div className="status-row">
                    <span>Review cadence</span>
                    <strong>Every {planData.reviewCycleMonths} months</strong>
                  </div>
                  <div className="status-row">
                    <span>Recommended savings</span>
                    <strong>{formatPercent(planData.recommendedSavingsRate)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="panel">
            <SectionTitle
              eyebrow="Allocation"
              title="Recommended portfolio mix"
              copy="A target allocation calibrated for the current life stage and risk tolerance."
            />

            <div className="chart-card compact-card">
              <DonutChart
                size={230}
                segments={targetPortfolioSegments}
                centerLabel="Target mix"
                centerValue={planData.lifeStage}
                className="donut-chart"
              />
              <div className="legend-list">
                {targetPortfolioSegments.map((segment) => (
                  <div key={segment.label} className="legend-item">
                    <span className="legend-swatch" style={{ background: segment.color }} />
                    <strong>{segment.label}</strong>
                    <span>{formatPercent(segment.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="note-stack">
              {planData.actions.map((action) => (
                <div key={action} className="note-row">
                  <CheckIcon size={16} />
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="content-grid" id="goals">
          <article className="panel">
            <SectionTitle
              eyebrow="Goals"
              title="Milestones with clear momentum"
              copy="The plan stays useful when every goal has a current amount, a target, and a real monthly contribution."
            />

            <div className="goal-list">
              {latestGoals.map((goal) => {
                const Icon = getGoalIcon(goal.icon);
                const progress = clamp((goal.currentAmount / goal.targetAmount) * 100, 0, 100);

                return (
                  <article key={goal.id} className="goal-card">
                    <div className="goal-topline">
                      <div className="goal-icon"><Icon size={18} /></div>
                      <div>
                        <strong>{goal.name}</strong>
                        <span>{goal.category} • Due {goal.targetYear}</span>
                      </div>
                    </div>

                    <div className="goal-values">
                      <span>{money.format(goal.currentAmount)}</span>
                      <span>{money.format(goal.targetAmount)}</span>
                    </div>

                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>

                    <div className="goal-footer">
                      <strong>{formatPercent(progress)}</strong>
                      <span>{money.format(goal.monthlyContribution)} / month</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </article>

          <article className="panel">
            <SectionTitle
              eyebrow="Budget"
              title="Cash flow with breathing room"
              copy="A budget that shows where the money goes now and how much runway is left in each category."
            />

            <div className="budget-list">
              {currentBudgets.map((budget) => {
                const progress = clamp((budget.spent / budget.planned) * 100, 0, 100);

                return (
                  <div key={budget.id} className="budget-row">
                    <div className="budget-head">
                      <strong>{budget.label}</strong>
                      <span>
                        {money.format(budget.spent)} / {money.format(budget.planned)}
                      </span>
                    </div>
                    <div className="progress-track budget-track">
                      <div className="progress-fill" style={{ width: `${progress}%`, background: budget.color }} />
                    </div>
                    <div className="budget-foot">
                      <span>{formatPercent(progress)}</span>
                      <span>{money.format(budget.planned - budget.spent)} remaining</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="transaction-list">
              {transactionPreview.map((transaction) => (
                <div key={transaction.id} className="transaction-row">
                  <div className={`transaction-icon ${transaction.type}`}>
                    {transaction.type === 'income' ? <ArrowUpIcon size={14} /> : <ArrowDownIcon size={14} />}
                  </div>
                  <div className="transaction-body">
                    <strong>{transaction.description}</strong>
                    <span>
                      {transaction.category} • {formatDate(transaction.date)}
                    </span>
                  </div>
                  <strong className={transaction.type === 'income' ? 'positive' : 'negative'}>
                    {transaction.type === 'income' ? '+' : '-'}{money.format(transaction.amount)}
                  </strong>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="content-grid projection-grid" id="projection">
          <article className="panel panel-wide">
            <SectionTitle
              eyebrow="Projection"
              title="Scenario engine and Monte Carlo view"
              copy="Tune investment amount, time horizon, return, and volatility to see what disciplined investing can produce."
            />

            <div className="projection-layout">
              <div className="projection-chart">
                <LineChart data={scenario?.monteCarlo ?? []} className="projection-line" />
              </div>

              <div className="projection-sidebar">
                <div className="scenario-controls">
                  <label className="field">
                    <span>Monthly investment</span>
                    <input
                      type="number"
                      min={0}
                      value={scenarioInput.monthlyInvestment}
                      onChange={(event) => updateScenarioField('monthlyInvestment', Number(event.target.value))}
                    />
                  </label>
                  <label className="field">
                    <span>Years</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={scenarioInput.years}
                      onChange={(event) => updateScenarioField('years', Number(event.target.value))}
                    />
                  </label>
                  <label className="field">
                    <span>Annual return</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={scenarioInput.annualReturn}
                      onChange={(event) => updateScenarioField('annualReturn', Number(event.target.value))}
                    />
                  </label>
                  <label className="field">
                    <span>Volatility</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={scenarioInput.volatility}
                      onChange={(event) => updateScenarioField('volatility', Number(event.target.value))}
                    />
                  </label>
                </div>

                <div className="projection-summary">
                  {scenarioProjectionCards.map((card) => (
                    <article key={card.label} className={`projection-card tone-${card.tone}`}>
                      <span>{card.label}</span>
                      <strong>{card.value}</strong>
                      <p>{card.note}</p>
                    </article>
                  ))}
                </div>

                <div className="projection-notes">
                  <div className="note-row compact">
                    <ShieldIcon size={16} />
                    <span>{planData.guardrails[0]}</span>
                  </div>
                  <div className="note-row compact">
                    <ShieldIcon size={16} />
                    <span>{planData.guardrails[1]}</span>
                  </div>
                  <div className="note-row compact">
                    <ShieldIcon size={16} />
                    <span>{planData.guardrails[2]}</span>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="content-grid two-up">
          <article className="panel">
            <SectionTitle
              eyebrow="Milestones"
              title="What happens next"
              copy="Each milestone translates the plan into a concrete sequence instead of an abstract goal."
            />

            <div className="timeline-list">
              {planData.milestones.map((milestone) => (
                <div key={milestone} className="timeline-item">
                  <div className="timeline-dot" />
                  <p>{milestone}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <SectionTitle
              eyebrow="Signals"
              title="Why this plan feels stable"
              copy="The output keeps the center of gravity on cash flow, risk protection, and investment discipline."
            />

            <div className="signal-list">
              <div className="signal-row">
                <span>Recommended savings</span>
                <strong>{formatPercent(planData.recommendedSavingsRate)}</strong>
              </div>
              <div className="signal-row">
                <span>Emergency fund target</span>
                <strong>{money.format(planData.emergencyFundTarget)}</strong>
              </div>
              <div className="signal-row">
                <span>Monthly investable amount</span>
                <strong>{money.format(planData.monthlyInvestable)}</strong>
              </div>
              <div className="signal-row">
                <span>Timeline confidence</span>
                <strong>{planData.score >= 80 ? 'High' : planData.score >= 65 ? 'Moderate' : 'Build first'}</strong>
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}