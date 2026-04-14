"""
Shared parallel pipeline: N explorer personas → N critics → one merger JSON.

Used by ticker-scoped War Room (no open-ended research session).
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import date
from typing import Any

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

load_dotenv()

_llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0.35,
    api_key=os.environ["OPENAI_API_KEY"],
)


def _explorer_invoke(question: str, system: str, agent_label: str) -> str:
    today = date.today().isoformat()
    r = _llm.invoke(
        [
            SystemMessage(
                content=f"Today is {today}. {system} Keep your answer to roughly 180–220 words."
            ),
            HumanMessage(
                content=(
                    f"Diligence brief:\n{question}\n\n"
                    "Respond with 2–4 numbered points for this angle. "
                    f"Sign: [{agent_label}]"
                )
            ),
        ]
    )
    return r.content


def _critic_invoke(question: str, explorer_text: str, explorer_label: str) -> str:
    today = date.today().isoformat()
    r = _llm.invoke(
        [
            SystemMessage(
                content=(
                    f"Today is {today}. You are a skeptical buy-side analyst reviewing this angle. "
                    "Attack: missing data, regulatory risk, competition, and valuation sensitivity. "
                    "3–5 sentences."
                )
            ),
            HumanMessage(
                content=(
                    f"Brief:\n{question}\n\n"
                    f"Angle ({explorer_label}):\n{explorer_text}\n\n"
                    "What must an investor discount or verify?"
                )
            ),
        ]
    )
    return r.content


def _merger_investment_invoke(question: str, bundle: list[dict[str, Any]]) -> dict[str, Any]:
    today = date.today().isoformat()
    parts = []
    for i, b in enumerate(bundle, start=1):
        parts.append(
            f"--- Branch {i}: {b['label']} ---\n"
            f"Explorer:\n{b['explorer']}\n\nCritic:\n{b['critic']}\n"
        )
    blob = "\n".join(parts)
    schema = (
        '{"ranked_directions":[{"rank":1,"title":"str","rationale":"str","key_risks":"str","next_step":"str"}],'
        '"synthesis_note":"str",'
        '"bull_case":"str","bear_case":"str","actionable_metric":"str"}'
    )
    r = _llm.invoke(
        [
            SystemMessage(
                content=(
                    f"Today is {today}. You are a senior biotech equity analyst. Synthesize the branches into "
                    "one JSON object only (no markdown). Schema exactly:\n"
                    f"{schema}\n"
                    "bull_case and bear_case must be substantive (not generic). actionable_metric = one forward-looking "
                    "catalyst or measurable KPI. Rank directions by risk-adjusted conviction for this stock."
                )
            ),
            HumanMessage(content=f"Diligence brief:\n{question}\n\n{blob}"),
        ]
    )
    raw = r.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "ranked_directions": [],
            "synthesis_note": raw[:1200],
            "bull_case": raw[:600],
            "bear_case": "Parse error — see synthesis_note.",
            "actionable_metric": "Re-run analysis or check API logs.",
            "parse_error": True,
        }


async def run_parallel_investment_debate(
    question: str,
    parallelism: int,
    personas: list[tuple[str, str]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Returns (branches with explorer+critic+label, merged dict with ranked + bull/bear)."""
    n = min(max(parallelism, 1), len(personas))

    async def explorer_step(i: int) -> dict[str, Any]:
        label_frag, system = personas[i % len(personas)]
        text = await asyncio.to_thread(_explorer_invoke, question, system, label_frag)
        return {"explorer": text, "label": label_frag, "sort_index": i}

    explored = await asyncio.gather(*[explorer_step(i) for i in range(n)])

    async def critic_step(ex: dict[str, Any]) -> dict[str, Any]:
        crit = await asyncio.to_thread(
            _critic_invoke,
            question,
            ex["explorer"],
            ex["label"],
        )
        return {**ex, "critic": crit}

    critiqued = await asyncio.gather(*[critic_step(ex) for ex in explored])
    merged = await asyncio.to_thread(_merger_investment_invoke, question, list(critiqued))
    return list(critiqued), merged
