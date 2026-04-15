"""
Iterative War Room — LangGraph StateGraph implementation.

Architecture:
  START → load_context → orchestrator → explorer → critic → generate_steering_options
       ↑                                                                              ↓ (iterations < max)
       └──────────────────────── human_steering ←─────────────────────────────────────
                                                                                      ↓ (iterations >= max)
                                                                                 synthesizer → END

Human-in-the-loop via interrupt() inside human_steering_node.
generate_steering_options runs BEFORE the pause, producing 3 persona-aware pill prompts.
Thread state persisted in MemorySaver so paused threads can be resumed.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import date
from typing import TypedDict

import httpx
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from app.agents.war_room import search_scientific_peers
from app.database import fetch_one

load_dotenv()

# ── LLMs ──────────────────────────────────────────────────────────────────────

_llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0.35,
    api_key=os.environ["OPENAI_API_KEY"],
)

# Fast model for the steering-options node — low latency matters here
_llm_fast = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.4,
    api_key=os.environ["OPENAI_API_KEY"],
)

# ── State ──────────────────────────────────────────────────────────────────────

class WarRoomState(TypedDict):
    ticker: str
    user_focus: str                  # initial research question
    user_persona: str                # investment profile selected by the user
    transcript: list[dict]           # [{role, agent, content, iteration}]
    iterations: int                  # completed loop count
    max_iterations: int              # user-set ceiling
    human_directive: str             # injected at the interrupt point
    suggested_directions: list[str]  # 3 AI-generated steering pills
    interim_summary: str             # brief summary of the most recent round, shown before steering
    context: dict                    # {mechanism_text, company_name, clinical_data, peers}
    synthesis: dict                  # final JSON output (empty until synthesizer runs)


# ── Available personas ─────────────────────────────────────────────────────────

USER_PERSONAS: list[str] = [
    "Clinical Mechanism Analyst",
    "Quantitative Value Investor",
    "Regulatory Hawk",
    "Competitive Intelligence Analyst",
    "Risk-Arbitrage Trader",
]

# ── Tools ──────────────────────────────────────────────────────────────────────

@tool
def pgvector_peers(ticker: str) -> str:
    """Fetch the 3 closest scientific peers for a DMD ticker using pgvector cosine similarity."""
    peers = search_scientific_peers(ticker)
    if not peers:
        return "No peers found."
    return "\n".join(
        f"{p['ticker']} ({p['company_name']}): similarity={float(p['similarity']):.3f}, "
        f"Emax={p['emax_pct']}%, t½={p['half_life_days']}d, Grade3+AE={p['grade_3_ae_pct']}%"
        for p in peers
    )


@tool
def openfda_adverse_events(drug_name: str, limit: int = 5) -> str:
    """Query openFDA for adverse event reports for a given drug or compound name."""
    try:
        url = "https://api.fda.gov/drug/event.json"
        params = {
            "search": f'patient.drug.medicinalproduct:"{drug_name}"',
            "limit": min(limit, 10),
        }
        resp = httpx.get(url, params=params, timeout=10.0)
        if resp.status_code == 404:
            return f"No openFDA records found for '{drug_name}'."
        if resp.status_code != 200:
            return f"openFDA returned HTTP {resp.status_code}."
        results = resp.json().get("results", [])
        if not results:
            return "No adverse event records found."
        summaries = []
        for r in results[:3]:
            reactions = [
                rx.get("reactionmeddrapt", "")
                for rx in r.get("patient", {}).get("reaction", [])
            ]
            serious = r.get("serious", "N/A")
            summaries.append(f"Serious={serious} | Reactions: {', '.join(reactions[:5])}")
        return "\n".join(summaries)
    except Exception as exc:
        return f"openFDA query failed: {exc}"


_llm_with_tools = _llm.bind_tools([pgvector_peers, openfda_adverse_events])


# ── Explorer personas ──────────────────────────────────────────────────────────

EXPLORER_PERSONAS: list[tuple[str, str]] = [
    (
        "Mechanism & Efficacy",
        "a biotech equity analyst focused on biological plausibility, mechanism of action, "
        "and whether clinical trial data supports the commercial thesis",
    ),
    (
        "Clinical & Regulatory",
        "a clinical analyst specialized in FDA pathway, trial design quality, "
        "endpoints selection, and label risk",
    ),
    (
        "Competitive Landscape",
        "an analyst comparing this program to its closest scientific peers "
        "and the broader exon-skipping / DMD gene-therapy space",
    ),
    (
        "Safety & Execution",
        "a safety-focused analyst stress-testing AE rates, mechanism-specific toxicity, "
        "manufacturing risk, and management execution track record",
    ),
    (
        "Valuation & Catalysts",
        "an equity analyst framing what the market is currently pricing in "
        "and which binary events or data readouts would re-rate the stock",
    ),
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _load_context(ticker: str) -> dict:
    row = fetch_one(
        "SELECT mechanism_text, company_name FROM dmd_mechanisms WHERE ticker = %s",
        (ticker,),
    )
    mechanism_text = row["mechanism_text"] if row else "Mechanism unknown."
    company_name = row["company_name"] if row else ticker

    clinical = fetch_one(
        "SELECT emax_pct, half_life_days, grade_3_ae_pct, audit_text FROM clinical_metrics WHERE ticker = %s",
        (ticker,),
    )
    clinical_data = dict(clinical) if clinical else {}
    peers = search_scientific_peers(ticker)

    return {
        "mechanism_text": mechanism_text,
        "company_name": company_name,
        "clinical_data": clinical_data,
        "peers": peers,
    }


def _context_block(ctx: dict) -> str:
    cd = ctx.get("clinical_data", {})
    peers = ctx.get("peers", [])
    peers_lines = [
        f"  • {p['ticker']} ({p['company_name']}): "
        f"similarity={float(p['similarity']):.3f}; "
        f"Emax={p['emax_pct']}%; t½={p['half_life_days']}d; Grade3+AE={p['grade_3_ae_pct']}%"
        for p in peers
    ]
    return (
        f"Company: {ctx.get('company_name', '')}\n"
        f"Mechanism: {ctx.get('mechanism_text', '')}\n"
        f"Clinical: Emax {cd.get('emax_pct')}% | t½ {cd.get('half_life_days')}d | "
        f"Grade3+AE {cd.get('grade_3_ae_pct')}%\n"
        f"Audit notes: {(cd.get('audit_text') or '')[:800]}\n"
        f"Closest peers:\n" + ("\n".join(peers_lines) if peers_lines else "  (none)")
    )


def _transcript_text(transcript: list[dict], truncate: int = 600) -> str:
    if not transcript:
        return "(empty)"
    parts = []
    for m in transcript:
        body = m["content"]
        if len(body) > truncate:
            body = body[:truncate] + "…"
        parts.append(f"[{m['agent']}] {body}")
    return "\n\n".join(parts)


# ── Nodes ──────────────────────────────────────────────────────────────────────

def load_context_node(state: WarRoomState) -> dict:
    ctx = _load_context(state["ticker"])
    return {"context": ctx}


def orchestrator_node(state: WarRoomState) -> dict:
    """Reads user_focus (+ human_directive if steering) and injects 2–3 debate angles."""
    ctx_block = _context_block(state["context"])
    iteration = state.get("iterations", 0)
    human_dir = state.get("human_directive", "").strip()
    persona = state.get("user_persona", "Clinical Mechanism Analyst")
    today = date.today().isoformat()

    steer_hint = (
        f"\n\nHuman steering directive (prioritize this): {human_dir}"
        if human_dir and iteration > 0
        else ""
    )

    resp = _llm.invoke([
        SystemMessage(content=(
            f"Today is {today}. You are an investment war room orchestrator for biotech diligence. "
            f"The investor's persona is: {persona}. Tailor the debate angles to what matters most "
            "for that profile. Generate 2–3 distinct, combative, specific angles. "
            "Each must be a pointed question or hypothesis — not a summary. "
            "Output a numbered list only. Be terse. No preamble."
        )),
        HumanMessage(content=(
            f"Ticker: {state['ticker']}\n"
            f"Research focus: {state['user_focus']}{steer_hint}\n\n"
            f"Context:\n{ctx_block}\n\n"
            f"Prior transcript ({len(state.get('transcript', []))} messages):\n"
            + _transcript_text(state.get("transcript", []), truncate=300)
            + f"\n\nGenerate debate angles for iteration {iteration + 1}."
        )),
    ])

    transcript = list(state.get("transcript", []))
    transcript.append({
        "role": "orchestrator",
        "agent": "Orchestrator",
        "content": resp.content,
        "iteration": iteration,
    })
    return {"transcript": transcript}


async def explorer_node(state: WarRoomState) -> dict:
    """Parallel explorers each pick one angle, use tools if helpful, and append to the transcript."""
    ctx_block = _context_block(state["context"])
    transcript = list(state.get("transcript", []))
    iteration = state.get("iterations", 0)
    today = date.today().isoformat()

    orchestrator_msg = next(
        (m for m in reversed(transcript) if m["role"] == "orchestrator"),
        None,
    )
    angles_text = orchestrator_msg["content"] if orchestrator_msg else "Investigate the thesis broadly."

    n = min(3, len(EXPLORER_PERSONAS))

    async def run_one(label: str, persona_desc: str) -> dict:
        resp = await asyncio.to_thread(
            _llm_with_tools.invoke,
            [
                SystemMessage(content=(
                    f"Today is {today}. You are {persona_desc}. "
                    "You have access to two tools: pgvector_peers (DMD similarity search) "
                    "and openfda_adverse_events (FDA safety data). Use them only when they add "
                    "concrete evidence. Defend one specific investment angle in 3–5 numbered points. "
                    "Be specific, data-grounded, and provocative. Sign your response [{label}]."
                )),
                HumanMessage(content=(
                    f"Ticker: {state['ticker']}\n"
                    f"Context:\n{ctx_block}\n\n"
                    f"Debate angles for this round:\n{angles_text}\n\n"
                    "Pick the angle most relevant to your expertise and make your case."
                )),
            ],
        )
        content = resp.content if isinstance(resp.content, str) else json.dumps(resp.content)
        return {"role": "explorer", "agent": label, "content": content, "iteration": iteration}

    results = await asyncio.gather(*[
        run_one(label, desc) for label, desc in EXPLORER_PERSONAS[:n]
    ])
    return {"transcript": transcript + list(results)}


async def critic_node(state: WarRoomState) -> dict:
    """Two critics read the full transcript and attack the explorers' logic from this iteration."""
    transcript = list(state.get("transcript", []))
    iteration = state.get("iterations", 0)
    today = date.today().isoformat()

    explorer_msgs = [
        m for m in transcript
        if m["role"] == "explorer" and m.get("iteration") == iteration
    ]
    explorer_block = "\n\n".join(
        f"[{m['agent']}]: {m['content']}" for m in explorer_msgs
    )
    full_text = _transcript_text(transcript, truncate=400)

    async def run_critic(idx: int) -> dict:
        resp = await asyncio.to_thread(
            _llm.invoke,
            [
                SystemMessage(content=(
                    f"Today is {today}. You are a skeptical buy-side analyst. "
                    "Attack the explorer arguments: call out missing data, regulatory risk, "
                    "competitive threats, mechanism-specific safety concerns, and valuation sensitivity. "
                    "Be adversarial and specific. 3–5 sentences max."
                )),
                HumanMessage(content=(
                    f"Full debate log:\n{full_text}\n\n"
                    f"Explorer arguments this round:\n{explorer_block}\n\n"
                    f"What must an investor discount or verify? (Critic {idx + 1})"
                )),
            ],
        )
        return {
            "role": "critic",
            "agent": f"Critic {idx + 1}",
            "content": resp.content,
            "iteration": iteration,
        }

    critics = await asyncio.gather(*[run_critic(i) for i in range(2)])
    return {
        "transcript": transcript + list(critics),
        "iterations": iteration + 1,
    }


def generate_steering_options_node(state: WarRoomState) -> dict:
    """
    Fast routing agent (gpt-4o-mini) that:
    1. Produces a 1-2 sentence summary of what this round found (interim_summary)
    2. Generates exactly 3 persona-aligned steering directives for the next round
    Both returned in one JSON call to minimise latency.
    Runs BEFORE the human_steering interrupt so the options are ready when the UI renders.
    """
    persona = state.get("user_persona", "Clinical Mechanism Analyst")
    user_focus = state.get("user_focus", "")
    transcript_text = _transcript_text(state["transcript"], truncate=400)
    iteration = state.get("iterations", 0)

    resp = _llm_fast.invoke([
        SystemMessage(content=(
            "You are a research routing agent for a biotech investment war room. "
            "Return a single JSON object — no markdown, no code fences — with two keys:\n"
            '  "round_summary": string — 1-2 sentences summarising the KEY insight or '
            "tension that emerged this round. Frame it around the investor's research question, "
            "not generic company commentary. Be specific: name compounds, endpoints, or risks.\n"
            '  "directions": array of exactly 3 strings — short, technical steering directives '
            "the investor can click to guide the next round. Each ≤18 words. "
            "Align with the user's investment persona. Each must push in a distinct direction.\n"
            'Example: {"round_summary": "The debate surfaced material uncertainty around ...", '
            '"directions": ["Drill into Phase 2 dose-response data for ...", ...]}'
        )),
        HumanMessage(content=(
            f"User persona: {persona}\n"
            f"Research question: {user_focus}\n"
            f"Completed rounds: {iteration}\n\n"
            f"Debate transcript so far:\n{transcript_text}\n\n"
            "Produce the JSON now."
        )),
    ])

    raw = resp.content.strip()
    # Strip code fences if model adds them
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
        interim_summary = str(parsed.get("round_summary", "")).strip()
        directions = parsed.get("directions", [])
        if not isinstance(directions, list):
            directions = []
    except (json.JSONDecodeError, AttributeError):
        interim_summary = ""
        directions = []

    # Fallback: parse || delimited output for directions
    if len(directions) < 3:
        parts = [p.strip() for p in raw.split("||") if p.strip()]
        if len(parts) >= 3:
            directions = parts
        else:
            directions = [p.strip().lstrip("123.-) ") for p in raw.splitlines() if p.strip()]

    while len(directions) < 3:
        directions.append("Probe the weakest assumption in the current bear case")
    suggestions = [str(d) for d in directions[:3]]

    return {
        "interim_summary": interim_summary,
        "suggested_directions": suggestions,
    }


def human_steering_node(state: WarRoomState) -> dict:
    """
    Interrupt point — pauses the graph and surfaces transcript + suggested_directions to the caller.
    Resumed via Command(resume=<directive_string>).
    """
    directive = interrupt({
        "message": "Round complete. Choose a suggested direction or type a custom one.",
        "transcript": state["transcript"],
        "suggested_directions": state.get("suggested_directions", []),
        "iterations_completed": state["iterations"],
        "max_iterations": state["max_iterations"],
    })
    return {"human_directive": directive or ""}


def synthesizer_node(state: WarRoomState) -> dict:
    """
    Reads the final debate transcript and produces a research-question-framed synthesis.
    Output is investor-as-observer: findings about the investment thesis, not corporate directives.
    """
    ctx_block = _context_block(state["context"])
    transcript_text = _transcript_text(state["transcript"])
    user_focus = state.get("user_focus", "the investment thesis")
    persona = state.get("user_persona", "Clinical Mechanism Analyst")
    today = date.today().isoformat()

    schema = (
        '{'
        '"research_summary": "2-3 sentences: what the debate revealed specifically about the research question. '
        'Name compounds, endpoints, or mechanisms — no generic commentary.",'
        '"key_findings": ["3-5 specific, factual insights that emerged from the debate"],'
        '"investor_considerations": ["3-5 investor-POV observations — each phrased as \'Watch whether...\', '
        '\'Note that...\', or \'Consider how...\' — never corporate directives like \'initiate trials\'"],'
        '"watch_list": "the single most important upcoming data point or event an investor should track"'
        '}'
    )

    resp = _llm.invoke([
        SystemMessage(content=(
            f"Today is {today}. You are synthesizing a biotech investment debate for a {persona}. "
            "Output one JSON object only — no markdown, no code fences, no commentary before or after.\n\n"
            f"Schema:\n{schema}\n\n"
            "Critical rules:\n"
            "- research_summary must directly address the investor's research question — do not recycle generic "
            "company descriptions\n"
            "- key_findings must be specific to what the debate actually argued (cite data, endpoints, or risks "
            "that came up)\n"
            "- investor_considerations must be observer-stance: the investor is watching a company, not running it. "
            "Start each with 'Watch whether', 'Note that', 'Consider how', 'Track whether', or similar. "
            "NEVER write as if the investor or company should take an action\n"
            "- watch_list = one concrete, forward-looking event (e.g. a trial readout, an FDA decision, a competitor "
            "milestone) that hasn't happened yet and would materially change the investment view"
        )),
        HumanMessage(content=(
            f"Ticker: {state['ticker']}\n"
            f"Research question: {user_focus}\n"
            f"Context:\n{ctx_block}\n\n"
            f"Full debate transcript:\n{transcript_text}"
        )),
    ])

    raw = resp.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        synthesis = json.loads(raw)
    except json.JSONDecodeError:
        synthesis = {
            "research_summary": raw[:600],
            "key_findings": [],
            "investor_considerations": [],
            "watch_list": "Re-run analysis — parse error in synthesizer output.",
        }

    return {"synthesis": synthesis}


# ── Routing ────────────────────────────────────────────────────────────────────

def route_after_steering_options(state: WarRoomState) -> str:
    if state["iterations"] < state["max_iterations"]:
        return "human_steering"
    return "synthesizer"


# ── Graph assembly ─────────────────────────────────────────────────────────────

def _build_graph() -> object:
    graph = StateGraph(WarRoomState)

    graph.add_node("load_context", load_context_node)
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("explorer", explorer_node)
    graph.add_node("critic", critic_node)
    graph.add_node("generate_steering_options", generate_steering_options_node)
    graph.add_node("human_steering", human_steering_node)
    graph.add_node("synthesizer", synthesizer_node)

    graph.add_edge(START, "load_context")
    graph.add_edge("load_context", "orchestrator")
    graph.add_edge("orchestrator", "explorer")
    graph.add_edge("explorer", "critic")
    graph.add_edge("critic", "generate_steering_options")
    graph.add_conditional_edges(
        "generate_steering_options",
        route_after_steering_options,
        {"human_steering": "human_steering", "synthesizer": "synthesizer"},
    )
    graph.add_edge("human_steering", "orchestrator")
    graph.add_edge("synthesizer", END)

    memory = MemorySaver()
    return graph.compile(checkpointer=memory)


# Singleton — compiled once at import time
iterative_war_room = _build_graph()


# ── Public API ─────────────────────────────────────────────────────────────────

async def start_war_room(
    ticker: str,
    user_focus: str,
    thread_id: str,
    user_persona: str = "Clinical Mechanism Analyst",
    max_iterations: int = 2,
) -> dict:
    """Start a new iterative war room thread. Returns state after first interrupt or synthesis."""
    initial: WarRoomState = {
        "ticker": ticker.upper(),
        "user_focus": user_focus,
        "user_persona": user_persona,
        "transcript": [],
        "iterations": 0,
        "max_iterations": max_iterations,
        "human_directive": "",
        "suggested_directions": [],
        "interim_summary": "",
        "context": {},
        "synthesis": {},
    }
    config = {"configurable": {"thread_id": thread_id}}
    state = await iterative_war_room.ainvoke(initial, config=config)
    return _build_response(state, thread_id)


async def resume_war_room(thread_id: str, human_directive: str) -> dict:
    """Resume a paused war room thread. Empty directive is valid (continue without steering)."""
    from langgraph.types import Command
    config = {"configurable": {"thread_id": thread_id}}
    state = await iterative_war_room.ainvoke(
        Command(resume=human_directive),
        config=config,
    )
    return _build_response(state, thread_id)


def _build_response(state: dict, thread_id: str) -> dict:
    is_complete = bool(state.get("synthesis"))
    return {
        "thread_id": thread_id,
        "status": "complete" if is_complete else "paused",
        "ticker": state.get("ticker", ""),
        "iterations_completed": state.get("iterations", 0),
        "max_iterations": state.get("max_iterations", 2),
        "transcript": state.get("transcript", []),
        "suggested_directions": state.get("suggested_directions", []),
        "interim_summary": state.get("interim_summary", ""),
        "synthesis": state.get("synthesis") or None,
    }
