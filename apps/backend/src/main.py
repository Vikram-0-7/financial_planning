from __future__ import annotations

import json
import math
import random
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "db.json"


class Overview(BaseModel):
    netWorth: float
    monthlyIncome: float
    monthlyExpenses: float
    savingsRate: float
    investedAssets: float
    cashReserves: float
    totalDebt: float
    creditScore: int


class Goal(BaseModel):
    id: str
    name: str
    targetAmount: float
    currentAmount: float
    targetYear: int
    category: str
    monthlyContribution: float
    icon: str


class Budget(BaseModel):
    id: str
    label: str
    planned: float
    spent: float
    color: str


class Transaction(BaseModel):
    id: str
    date: str
    description: str
    category: str
    type: Literal["income", "expense"]
    amount: float


class Portfolio(BaseModel):
    holdings: Dict[str, float]
    targetAllocation: Dict[str, float]


class DashboardResponse(BaseModel):
    overview: Overview
    goals: List[Goal]
    budgets: List[Budget]
    transactions: List[Transaction]
    portfolio: Portfolio


class ScenarioRequest(BaseModel):
    monthlyInvestment: float = Field(gt=0)
    years: int = Field(gt=0)
    annualReturn: float = Field(ge=0)
    volatility: float = Field(ge=0)


class MonteCarloPoint(BaseModel):
    month: int
    value: float


class ScenarioResponse(BaseModel):
    projectedValue: float
    totalContributed: float
    expectedGain: float
    monteCarlo: List[List[MonteCarloPoint]]


class ProfilePlanRequest(BaseModel):
    age: int = Field(ge=0, le=100)
    occupation: str = Field(min_length=1, max_length=80)
    monthlyIncome: float = Field(gt=0)
    monthlyExpenses: float = Field(ge=0)
    dependents: int = Field(ge=0, le=12)
    riskTolerance: Literal["Conservative", "Balanced", "Growth", "Aggressive"]
    timeHorizon: int = Field(ge=1, le=60)


class PlanResponse(BaseModel):
    lifeStage: str
    headline: str
    score: int
    priority: str
    recommendedSavingsRate: float
    monthlySavingsTarget: float
    monthlyInvestable: float
    emergencyFundMonths: int
    emergencyFundTarget: float
    suggestedAllocation: Dict[str, float]
    actions: List[str]
    guardrails: List[str]
    milestones: List[str]
    reviewCycleMonths: int


def load_db() -> dict:
    try:
        return json.loads(DB_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail="Seed data is missing") from exc


def save_db(data: dict) -> None:
    DB_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def normal_random() -> float:
    return math.sqrt(-2 * math.log(max(random.random(), 1e-12))) * math.cos(2 * math.pi * random.random())


def determine_stage(age: int, occupation: str) -> tuple[str, str, int]:
    occupation_key = occupation.lower()

    if any(term in occupation_key for term in ("student", "intern", "trainee")):
        return "Starter", "Build runway before chasing aggressive returns.", 3
    if any(term in occupation_key for term in ("freelance", "consult", "contract", "self", "gig", "founder", "owner")):
        return "Independent", "Separate business cash flow from household security.", 6
    if any(term in occupation_key for term in ("retired", "retiree", "pension")):
        return "Retirement", "Protect income stability and liquidity.", 8

    if age < 25:
        return "Starter", "Stack skills, habits, and savings early.", 3
    if age < 35:
        return "Growth", "Push savings rate while compounding is on your side.", 4
    if age < 50:
        return "Family Builder", "Balance protection, goals, and asset growth.", 6
    if age < 65:
        return "Peak Earning", "Convert income into durable assets and future income.", 6
    return "Retirement", "Preserve flexibility, cash flow, and healthcare coverage.", 8


def build_allocation(stage: str, risk_tolerance: str) -> Dict[str, float]:
    templates: Dict[str, Dict[str, float]] = {
        "Starter": {"stocks": 70, "bonds": 8, "realEstate": 5, "crypto": 4, "cash": 10, "commodities": 3},
        "Growth": {"stocks": 64, "bonds": 14, "realEstate": 8, "crypto": 4, "cash": 8, "commodities": 2},
        "Family Builder": {"stocks": 56, "bonds": 20, "realEstate": 10, "crypto": 3, "cash": 8, "commodities": 3},
        "Independent": {"stocks": 52, "bonds": 16, "realEstate": 9, "crypto": 5, "cash": 14, "commodities": 4},
        "Peak Earning": {"stocks": 46, "bonds": 28, "realEstate": 10, "crypto": 2, "cash": 10, "commodities": 4},
        "Retirement": {"stocks": 34, "bonds": 34, "realEstate": 10, "crypto": 1, "cash": 16, "commodities": 5},
    }

    allocation = dict(templates[stage])
    risk_adjustments: Dict[str, Dict[str, float]] = {
        "Conservative": {"stocks": -8, "bonds": 7, "cash": 2, "crypto": -1},
        "Balanced": {},
        "Growth": {"stocks": 4, "bonds": -3, "cash": -1, "crypto": 1},
        "Aggressive": {"stocks": 8, "bonds": -6, "cash": -2, "crypto": 2},
    }

    for key, delta in risk_adjustments[risk_tolerance].items():
        allocation[key] = allocation.get(key, 0) + delta

    allocation = {key: max(value, 0.5) for key, value in allocation.items()}
    total = sum(allocation.values()) or 1
    normalized = {key: round(value / total * 100, 1) for key, value in allocation.items()}

    difference = round(100 - sum(normalized.values()), 1)
    first_key = next(iter(normalized))
    normalized[first_key] = round(normalized[first_key] + difference, 1)
    return normalized


def format_currency(value: float) -> str:
    return f"${value:,.0f}"


def build_plan(payload: ProfilePlanRequest) -> PlanResponse:
    stage, priority, emergency_months = determine_stage(payload.age, payload.occupation)
    net_monthly_cashflow = max(payload.monthlyIncome - payload.monthlyExpenses, 0)

    base_savings_rate = {
        "Conservative": 0.18,
        "Balanced": 0.23,
        "Growth": 0.28,
        "Aggressive": 0.33,
    }[payload.riskTolerance]

    age_adjustment = clamp((40 - payload.age) / 100, -0.06, 0.06)
    dependent_adjustment = -min(payload.dependents * 0.01, 0.05)
    savings_rate = clamp(base_savings_rate + age_adjustment + dependent_adjustment, 0.12, 0.45)

    monthly_savings_target = round(net_monthly_cashflow * savings_rate, 2)
    monthly_investable = round(max(monthly_savings_target - payload.monthlyExpenses * 0.12, 0), 2)
    emergency_fund_target = round(payload.monthlyExpenses * emergency_months, 2)

    if net_monthly_cashflow <= 0:
        headline = "Stabilize cash flow before scaling investments."
    elif stage == "Starter":
        headline = "Build a strong foundation and let compounding do the heavy lifting."
    elif stage == "Growth":
        headline = "Accelerate savings while keeping optionality high."
    elif stage == "Family Builder":
        headline = "Protect the household first, then widen the growth engine."
    elif stage == "Independent":
        headline = "Smooth business volatility with a resilient personal balance sheet."
    elif stage == "Peak Earning":
        headline = "Turn high earnings into long-term freedom and future income."
    else:
        headline = "Preserve income, flexibility, and dignity in every market cycle."

    actions: List[str] = []
    if net_monthly_cashflow <= 0:
        actions.append("Reduce fixed spending until monthly cash flow turns positive.")
    else:
        actions.append(f"Automate {round(savings_rate * 100)}% of monthly surplus on payday.")
    actions.append(f"Reach a {emergency_months}-month emergency fund worth {format_currency(emergency_fund_target)}.")
    actions.append("Keep retirement investing diversified across broad index funds and cash reserves.")
    if payload.dependents > 0:
        actions.append("Review life, health, and income-protection coverage for the household.")
    if any(term in payload.occupation.lower() for term in ("freelance", "contract", "self", "founder", "owner")):
        actions.append("Separate business taxes, operating cash, and personal money into distinct buckets.")

    guardrails = [
        "Maintain at least one account that can cover three months of bills in under 48 hours.",
        "Never invest money needed for rent, tuition, payroll, or short-term tax obligations.",
        "Rebalance after major life changes instead of reacting to short-term market noise.",
    ]

    milestones = [
        f"90 days: keep {format_currency(emergency_fund_target / max(emergency_months, 1))} per month flowing into your safety buffer.",
        f"12 months: stack {format_currency(monthly_savings_target * 12)} in annual savings capacity.",
        f"{payload.timeHorizon} year horizon: make sure your portfolio mix can survive the worst two years you remember.",
    ]

    score = int(
        clamp(
            55
            + savings_rate * 80
            - (0 if net_monthly_cashflow > 0 else 12)
            + min(payload.timeHorizon, 20)
            - payload.dependents * 2,
            0,
            100,
        )
    )

    review_cycle = 3 if payload.riskTolerance in ("Growth", "Aggressive") else 6

    return PlanResponse(
        lifeStage=stage,
        headline=headline,
        score=score,
        priority=priority,
        recommendedSavingsRate=round(savings_rate * 100, 1),
        monthlySavingsTarget=monthly_savings_target,
        monthlyInvestable=monthly_investable,
        emergencyFundMonths=emergency_months,
        emergencyFundTarget=emergency_fund_target,
        suggestedAllocation=build_allocation(stage, payload.riskTolerance),
        actions=actions,
        guardrails=guardrails,
        milestones=milestones,
        reviewCycleMonths=review_cycle,
    )


app = FastAPI(title="Financial Planning API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat() + "Z"}


@app.get("/api/dashboard", response_model=DashboardResponse)
def dashboard() -> DashboardResponse:
    return DashboardResponse(**load_db())


@app.get("/api/overview", response_model=Overview)
def get_overview() -> Overview:
    return Overview(**load_db()["overview"])


@app.post("/api/overview", response_model=Overview)
def update_overview(updates: dict) -> Overview:
    db = load_db()
    db["overview"] = {**db["overview"], **updates}
    save_db(db)
    return Overview(**db["overview"])


@app.get("/api/goals", response_model=List[Goal])
def get_goals() -> List[Goal]:
    return [Goal(**goal) for goal in load_db()["goals"]]


@app.post("/api/goals", response_model=Goal, status_code=201)
def create_goal(goal: dict) -> Goal:
    db = load_db()
    new_goal = {**goal, "id": f"goal-{int(datetime.utcnow().timestamp() * 1000)}"}
    db["goals"].append(new_goal)
    save_db(db)
    return Goal(**new_goal)


@app.put("/api/goals/{goal_id}", response_model=Goal)
def update_goal(goal_id: str, updates: dict) -> Goal:
    db = load_db()
    for index, goal in enumerate(db["goals"]):
        if goal["id"] == goal_id:
            db["goals"][index] = {**goal, **updates, "id": goal_id}
            save_db(db)
            return Goal(**db["goals"][index])
    raise HTTPException(status_code=404, detail="Goal not found")


@app.delete("/api/goals/{goal_id}", response_model=Goal)
def delete_goal(goal_id: str) -> Goal:
    db = load_db()
    for index, goal in enumerate(db["goals"]):
        if goal["id"] == goal_id:
            removed = db["goals"].pop(index)
            save_db(db)
            return Goal(**removed)
    raise HTTPException(status_code=404, detail="Goal not found")


@app.get("/api/budgets", response_model=List[Budget])
def get_budgets() -> List[Budget]:
    return [Budget(**budget) for budget in load_db()["budgets"]]


@app.put("/api/budgets", response_model=List[Budget])
def update_budgets(budgets: List[Budget]) -> List[Budget]:
    db = load_db()
    db["budgets"] = [budget.model_dump() for budget in budgets]
    save_db(db)
    return budgets


@app.get("/api/transactions", response_model=List[Transaction])
def get_transactions() -> List[Transaction]:
    transactions = [Transaction(**transaction) for transaction in load_db()["transactions"]]
    return sorted(transactions, key=lambda item: item.date, reverse=True)


@app.post("/api/transactions", response_model=Transaction, status_code=201)
def create_transaction(transaction: dict) -> Transaction:
    db = load_db()
    new_transaction = {**transaction, "id": f"tx-{int(datetime.utcnow().timestamp() * 1000)}"}
    db["transactions"].append(new_transaction)

    if new_transaction.get("type") == "expense":
        for budget in db["budgets"]:
            if budget["label"] == new_transaction.get("category"):
                budget["spent"] += float(new_transaction.get("amount", 0))

    save_db(db)
    return Transaction(**new_transaction)


@app.get("/api/portfolio", response_model=Portfolio)
def get_portfolio() -> Portfolio:
    return Portfolio(**load_db()["portfolio"])


@app.put("/api/portfolio", response_model=Portfolio)
def update_portfolio(updates: dict) -> Portfolio:
    db = load_db()
    db["portfolio"] = {**db["portfolio"], **updates}
    save_db(db)
    return Portfolio(**db["portfolio"])


@app.post("/api/scenario", response_model=ScenarioResponse)
def scenario(request: ScenarioRequest) -> ScenarioResponse:
    total_months = request.years * 12
    monthly_rate = request.annualReturn / 100 / 12
    monthly_volatility = (request.volatility / 100) / math.sqrt(12)
    total_contributed = request.monthlyInvestment * total_months

    projected_value = 0.0
    for _ in range(total_months):
        projected_value = (projected_value + request.monthlyInvestment) * (1 + monthly_rate)
    projected_value = round(projected_value, 2)
    expected_gain = round(projected_value - total_contributed, 2)

    simulations: List[List[MonteCarloPoint]] = []
    for _ in range(12):
        path: List[MonteCarloPoint] = []
        balance = 0.0
        for month in range(1, total_months + 1):
            random_shock = normal_random() * monthly_volatility
            monthly_return = monthly_rate + random_shock
            balance = (balance + request.monthlyInvestment) * (1 + monthly_return)
            balance = max(balance, 0)
            path.append(MonteCarloPoint(month=month, value=round(balance, 2)))
        simulations.append(path)

    return ScenarioResponse(
        projectedValue=projected_value,
        totalContributed=round(total_contributed, 2),
        expectedGain=expected_gain,
        monteCarlo=simulations,
    )


@app.post("/api/profile-plan", response_model=PlanResponse)
def profile_plan(request: ProfilePlanRequest) -> PlanResponse:
    return build_plan(request)