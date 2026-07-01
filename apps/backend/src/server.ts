import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// ESM __dirname resolution
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Overview {
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  investedAssets: number;
  cashReserves: number;
  totalDebt: number;
  creditScore: number;
}

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetYear: number;
  category: string;
  monthlyContribution: number;
  icon: string;
}

interface Budget {
  id: string;
  label: string;
  planned: number;
  spent: number;
  color: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  type: 'income' | 'expense';
  amount: number;
}

interface Holdings {
  stocks: number;
  bonds: number;
  realEstate: number;
  crypto: number;
  cash: number;
  commodities: number;
}

interface Portfolio {
  holdings: Holdings;
  targetAllocation: Record<string, number>;
}

interface Database {
  overview: Overview;
  goals: Goal[];
  budgets: Budget[];
  transactions: Transaction[];
  portfolio: Portfolio;
}

interface ScenarioRequest {
  monthlyInvestment: number;
  years: number;
  annualReturn: number;
  volatility: number;
}

interface MonteCarloPoint {
  month: number;
  value: number;
}

interface ScenarioResponse {
  projectedValue: number;
  totalContributed: number;
  expectedGain: number;
  monteCarlo: MonteCarloPoint[][];
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------
const DB_PATH = path.resolve(__dirname, 'db.json');

function readDb(): Database {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw) as Database;
}

function writeDb(data: Database): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Box-Muller normal random
// ---------------------------------------------------------------------------
function normalRandom(): number {
  return (
    Math.sqrt(-2 * Math.log(Math.random())) *
    Math.cos(2 * Math.PI * Math.random())
  );
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
app.get('/api/overview', (_req: Request, res: Response) => {
  const db = readDb();
  res.json(db.overview);
});

app.post('/api/overview', (req: Request, res: Response) => {
  const db = readDb();
  const updates: Partial<Overview> = req.body;
  db.overview = { ...db.overview, ...updates };
  writeDb(db);
  res.json(db.overview);
});

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------
app.get('/api/goals', (_req: Request, res: Response) => {
  const db = readDb();
  res.json(db.goals);
});

app.post('/api/goals', (req: Request, res: Response) => {
  const db = readDb();
  const newGoal: Goal = {
    ...req.body,
    id: `goal-${Date.now()}`,
  };
  db.goals.push(newGoal);
  writeDb(db);
  res.status(201).json(newGoal);
});

app.put('/api/goals/:id', (req: Request, res: Response) => {
  const db = readDb();
  const index = db.goals.findIndex((g) => g.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Goal not found' });
    return;
  }
  db.goals[index] = { ...db.goals[index], ...req.body, id: req.params.id };
  writeDb(db);
  res.json(db.goals[index]);
});

app.delete('/api/goals/:id', (req: Request, res: Response) => {
  const db = readDb();
  const index = db.goals.findIndex((g) => g.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Goal not found' });
    return;
  }
  const [removed] = db.goals.splice(index, 1);
  writeDb(db);
  res.json(removed);
});

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------
app.get('/api/budgets', (_req: Request, res: Response) => {
  const db = readDb();
  res.json(db.budgets);
});

app.put('/api/budgets', (req: Request, res: Response) => {
  const db = readDb();
  const budgets: Budget[] = req.body;
  db.budgets = budgets;
  writeDb(db);
  res.json(db.budgets);
});

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------
app.get('/api/transactions', (_req: Request, res: Response) => {
  const db = readDb();
  const sorted = [...db.transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  res.json(sorted);
});

app.post('/api/transactions', (req: Request, res: Response) => {
  const db = readDb();
  const newTx: Transaction = {
    ...req.body,
    id: `t${Date.now()}`,
  };
  db.transactions.push(newTx);

  // Auto-update budget spent amount when the transaction is an expense
  if (newTx.type === 'expense') {
    const budget = db.budgets.find((b) => b.label === newTx.category);
    if (budget) {
      budget.spent += newTx.amount;
    }
  }

  writeDb(db);
  res.status(201).json(newTx);
});

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------
app.get('/api/portfolio', (_req: Request, res: Response) => {
  const db = readDb();
  res.json(db.portfolio);
});

app.put('/api/portfolio', (req: Request, res: Response) => {
  const db = readDb();
  const updates: Partial<Portfolio> = req.body;
  db.portfolio = { ...db.portfolio, ...updates };
  writeDb(db);
  res.json(db.portfolio);
});

// ---------------------------------------------------------------------------
// Scenario – Compound growth calculator with Monte Carlo simulation
// ---------------------------------------------------------------------------
app.post('/api/scenario', (req: Request, res: Response) => {
  const {
    monthlyInvestment,
    years,
    annualReturn,
    volatility,
  } = req.body as ScenarioRequest;

  const totalMonths = years * 12;
  const monthlyRate = annualReturn / 100 / 12;
  const monthlyVol = (volatility / 100) / Math.sqrt(12);
  const totalContributed = monthlyInvestment * totalMonths;

  // Deterministic projected value using compound growth formula
  let projectedValue = 0;
  for (let m = 1; m <= totalMonths; m++) {
    projectedValue =
      (projectedValue + monthlyInvestment) * (1 + monthlyRate);
  }
  projectedValue = Math.round(projectedValue * 100) / 100;

  const expectedGain =
    Math.round((projectedValue - totalContributed) * 100) / 100;

  // Monte Carlo – 12 simulation paths
  const NUM_SIMULATIONS = 12;
  const monteCarlo: MonteCarloPoint[][] = [];

  for (let s = 0; s < NUM_SIMULATIONS; s++) {
    const path: MonteCarloPoint[] = [];
    let balance = 0;

    for (let m = 1; m <= totalMonths; m++) {
      const randomShock = normalRandom() * monthlyVol;
      const returnThisMonth = monthlyRate + randomShock;
      balance = (balance + monthlyInvestment) * (1 + returnThisMonth);
      if (balance < 0) balance = 0;

      path.push({
        month: m,
        value: Math.round(balance * 100) / 100,
      });
    }

    monteCarlo.push(path);
  }

  const result: ScenarioResponse = {
    projectedValue,
    totalContributed,
    expectedGain,
    monteCarlo,
  };

  res.json(result);
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT ?? 4000);

app.listen(PORT, () => {
  console.log(`AuraWealth API running on http://localhost:${PORT}`);
});