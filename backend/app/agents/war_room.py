"""
Legacy linear War Room (biologist → toxicologist → synthesizer).

**Production diligence** uses `app.agents.iterative_war_room` (LangGraph StateGraph with
human-in-the-loop) behind `POST /api/diligence/start` and `POST /api/diligence/resume`.
This module is kept for `search_scientific_peers` (used by iterative_war_room) and reference.
"""

from __future__ import annotations

import json
import os
from datetime import date
from typing import TypedDict

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, END

from app.database import fetch_all, fetch_one

load_dotenv()

# ---------------------------------------------------------------------------
# LLM
# ---------------------------------------------------------------------------

_llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0.3,
    api_key=os.environ["OPENAI_API_KEY"],
)

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

class WarRoomState(TypedDict):
    ticker: str
    mechanism_text: str
    clinical_data: dict                # clinical_metrics row for this ticker
    peers: list[dict]                  # pgvector similarity results
    biologist_analysis: str
    toxicologist_challenge: str
    synthesis: dict                    # {bull_case, bear_case, actionable_metric}


# ---------------------------------------------------------------------------
# Tool implementations
# (called directly in nodes — data is injected into LLM context as text)
# ---------------------------------------------------------------------------

def search_scientific_peers(ticker: str) -> list[dict]:
    """
    Tool: search_scientific_peers
    Retrieves mechanism text + clinical metrics for the 3 closest scientific
    peers using pgvector cosine similarity on the mechanism embedding.
    """
    sql = """
        WITH base AS (
            SELECT embedding
            FROM   dmd_mechanisms
            WHERE  ticker = %s
        )
        SELECT
            m.ticker,
            m.company_name,
            m.mechanism_text,
            1 - (m.embedding <=> base.embedding) AS similarity,
            c.emax_pct,
            c.half_life_days,
            c.grade_3_ae_pct,
            c.audit_text
        FROM   dmd_mechanisms m
        JOIN   clinical_metrics c ON c.ticker = m.ticker
        CROSS  JOIN base
        WHERE  m.ticker != %s
        ORDER  BY m.embedding <=> base.embedding
        LIMIT  3;
    """
    return fetch_all(sql, (ticker, ticker))


def search_adverse_events(ticker: str) -> dict | None:
    """
    Tool: search_adverse_events
    Returns the Grade 3+ AE rate and audit text for the given ticker.
    """
    sql = """
        SELECT c.grade_3_ae_pct, c.audit_text, m.mechanism_text
        FROM   clinical_metrics c
        JOIN   dmd_mechanisms m ON m.ticker = c.ticker
        WHERE  c.ticker = %s;
    """
    return fetch_one(sql, (ticker,))


# ---------------------------------------------------------------------------
# Node: fetch_context
# ---------------------------------------------------------------------------

def fetch_context(state: WarRoomState) -> dict:
    ticker = state["ticker"]

    row = fetch_one(
        "SELECT mechanism_text FROM dmd_mechanisms WHERE ticker = %s",
        (ticker,),
    )
    mechanism_text = row["mechanism_text"] if row else "Mechanism unknown."

    clinical = fetch_one(
        """SELECT emax_pct, half_life_days, grade_3_ae_pct, audit_text
           FROM clinical_metrics WHERE ticker = %s""",
        (ticker,),
    )
    clinical_data = dict(clinical) if clinical else {}

    peers = search_scientific_peers(ticker)

    return {
        "mechanism_text": mechanism_text,
        "clinical_data": clinical_data,
        "peers": peers,
    }


# ---------------------------------------------------------------------------
# Node: biologist_agent
# ---------------------------------------------------------------------------

def biologist_agent(state: WarRoomState) -> dict:
    ticker = state["ticker"]
    mechanism = state["mechanism_text"]
    clinical = state["clinical_data"]
    peers = state["peers"]
    today = date.today().isoformat()

    peers_summary = "\n".join(
        f"  • {p['ticker']} ({p['company_name']}): "
        f"similarity={p['similarity']:.3f}, Emax={p['emax_pct']}%, "
        f"t½={p['half_life_days']}d, Grade3AE={p['grade_3_ae_pct']}%"
        for p in peers
    )

    response = _llm.invoke([
        SystemMessage(content=(
            f"Today is {today}. "
            "You are a senior biologist specializing in neuromuscular diseases and "
            "oligonucleotide/gene therapy mechanisms. Your role in this investment war room "
            "is to DEFEND the theoretical efficacy of the drug mechanism. Be precise, cite "
            "specific biological advantages, and compare favorably to peers where justified. "
            "Reference only events and data that have already occurred as of today's date. "
            "Keep your analysis to 3–4 punchy sentences."
        )),
        HumanMessage(content=(
            f"Ticker: {ticker}\n\n"
            f"Mechanism:\n{mechanism}\n\n"
            f"Clinical data as of {today}:\n"
            f"  Emax={clinical.get('emax_pct')}% of normal dystrophin\n"
            f"  t½={clinical.get('half_life_days')} days\n"
            f"  Grade3AE={clinical.get('grade_3_ae_pct')}%\n"
            f"  Trial history: {clinical.get('audit_text', '')}\n\n"
            f"Closest scientific peers (by mechanism similarity):\n{peers_summary}\n\n"
            "Defend the efficacy case for this mechanism based on the data above."
        )),
    ])

    return {"biologist_analysis": response.content}


# ---------------------------------------------------------------------------
# Node: toxicologist_agent
# ---------------------------------------------------------------------------

def toxicologist_agent(state: WarRoomState) -> dict:
    ticker = state["ticker"]
    biologist_view = state["biologist_analysis"]
    today = date.today().isoformat()

    ae_data = search_adverse_events(ticker)
    ae_context = (
        f"Grade 3+ AE rate: {ae_data['grade_3_ae_pct']}%\n"
        f"Full safety & regulatory history: {ae_data['audit_text']}"
        if ae_data else "No AE data available."
    )

    peers = state["peers"]
    all_ae = "\n".join(
        f"  • {p['ticker']}: Grade3AE={p['grade_3_ae_pct']}%, Emax={p['emax_pct']}%"
        for p in peers
    )

    response = _llm.invoke([
        SystemMessage(content=(
            f"Today is {today}. "
            "You are a clinical toxicologist and drug safety expert. Your role in this "
            "investment war room is to CHALLENGE the safety and risk profile of the drug. "
            "Focus on adverse event rates, mechanism-specific risks (immune responses, "
            "off-target delivery, liver toxicity), regulatory actions, and label restrictions. "
            "Treat all events in the audit history as facts that have already occurred. "
            "Be adversarial but data-grounded. Keep it to 3–4 sentences."
        )),
        HumanMessage(content=(
            f"Ticker: {ticker}\n\n"
            f"Biologist's efficacy argument:\n{biologist_view}\n\n"
            f"Safety data for {ticker} as of {today}:\n{ae_context}\n\n"
            f"Peer safety comparison:\n{all_ae}\n\n"
            "Challenge the safety case. What are the critical risks an investor must price in?"
        )),
    ])

    return {"toxicologist_challenge": response.content}


# ---------------------------------------------------------------------------
# Node: synthesizer_agent
# ---------------------------------------------------------------------------

def synthesizer_agent(state: WarRoomState) -> dict:
    ticker = state["ticker"]
    clinical = state["clinical_data"]
    bull = state["biologist_analysis"]
    bear = state["toxicologist_challenge"]
    today = date.today().isoformat()

    response = _llm.invoke([
        SystemMessage(content=(
            f"Today is {today}. "
            "You are a senior biotech equity analyst synthesizing a micro-debate into "
            "actionable investment intelligence. Distill the bull and bear arguments into "
            "a concise JSON object. The actionable_metric must be a FORWARD-LOOKING, specific, "
            "measurable catalyst that has NOT yet occurred as of today — such as an upcoming "
            "trial readout, regulatory decision, or commercial milestone. Do not reference "
            "events that have already happened. Respond ONLY with a valid JSON object — "
            "no markdown, no code fences, just the raw JSON."
        )),
        HumanMessage(content=(
            f"Ticker: {ticker} | Analysis date: {today}\n"
            f"Emax: {clinical.get('emax_pct')}% | "
            f"t½: {clinical.get('half_life_days')}d | "
            f"Grade3AE: {clinical.get('grade_3_ae_pct')}%\n"
            f"Context: {clinical.get('audit_text', '')}\n\n"
            f"Bull case (Biologist):\n{bull}\n\n"
            f"Bear case (Toxicologist):\n{bear}\n\n"
            'Return exactly: {"bull_case": "...", "bear_case": "...", "actionable_metric": "..."}'
        )),
    ])

    raw = response.content.strip()
    # Strip markdown code fences if the model ignores the instruction
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        synthesis = json.loads(raw)
    except json.JSONDecodeError:
        synthesis = {
            "bull_case": bull[:400],
            "bear_case": bear[:400],
            "actionable_metric": "See full analyst notes above.",
        }

    return {"synthesis": synthesis}


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------

def build_war_room_graph():
    graph = StateGraph(WarRoomState)

    graph.add_node("fetch_context", fetch_context)
    graph.add_node("biologist", biologist_agent)
    graph.add_node("toxicologist", toxicologist_agent)
    graph.add_node("synthesizer", synthesizer_agent)

    graph.set_entry_point("fetch_context")
    graph.add_edge("fetch_context", "biologist")
    graph.add_edge("biologist", "toxicologist")
    graph.add_edge("toxicologist", "synthesizer")
    graph.add_edge("synthesizer", END)

    return graph.compile()


# Singleton — compiled once at import time
war_room = build_war_room_graph()


async def run_war_room(ticker: str) -> dict:
    """
    Invoke the war room graph for a given ticker.
    Returns the final state dict.
    """
    initial_state: WarRoomState = {
        "ticker": ticker.upper(),
        "mechanism_text": "",
        "clinical_data": {},
        "peers": [],
        "biologist_analysis": "",
        "toxicologist_challenge": "",
        "synthesis": {},
    }
    final_state = await war_room.ainvoke(initial_state)
    return final_state
