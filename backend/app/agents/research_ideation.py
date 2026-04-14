"""
Option A Phase 1 — parallel explorers → critics → merger.

Runs in-process (asyncio); persists each step via app.research_db.
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

from app import research_db

load_dotenv()

_llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0.35,
    api_key=os.environ["OPENAI_API_KEY"],
)

# (display name fragment, system instructions)
EXPLORER_PERSONAS: list[tuple[str, str]] = [
    (
        "Mechanism",
        "You are a research scientist emphasizing molecular mechanism, targets, and biological plausibility. "
        "Propose concrete, testable angles. Be specific; avoid generic literature-review tone.",
    ),
    (
        "Clinical translation",
        "You are a translational scientist focusing on trials, endpoints, biomarkers, and patient stratification. "
        "Propose directions that connect to measurable outcomes.",
    ),
    (
        "Competitive & differentiation",
        "You are an analyst comparing approaches and stressing what would make a direction novel or defensible "
        "versus existing work.",
    ),
    (
        "Falsification & risks",
        "You stress what could disprove each approach, confounders, and failure modes. Propose how to de-risk early.",
    ),
    (
        "Methods & metrics",
        "You focus on experimental design, metrics, and what 'success' would look like quantitatively.",
    ),
]


def _explorer_invoke(question: str, system: str, agent_label: str) -> str:
    today = date.today().isoformat()
    r = _llm.invoke(
        [
            SystemMessage(
                content=f"Today is {today}. {system} Keep your answer to roughly 180–220 words."
            ),
            HumanMessage(
                content=(
                    f"Research question:\n{question}\n\n"
                    "Respond with 2–4 distinct directions or hypotheses. Number them. "
                    f"Sign your perspective as: [{agent_label}]"
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
                    f"Today is {today}. You are a skeptical peer reviewer. Attack weaknesses: missing evidence, "
                    "overclaims, confounders, and feasibility. Be adversarial but constructive. "
                    "3–5 sentences."
                )
            ),
            HumanMessage(
                content=(
                    f"Question:\n{question}\n\n"
                    f"Proposal ({explorer_label}):\n{explorer_text}\n\n"
                    "What are the critical weaknesses an investor or PI must price in?"
                )
            ),
        ]
    )
    return r.content


def _merger_invoke(question: str, bundle: list[dict[str, Any]]) -> tuple[dict[str, Any], str]:
    """Returns (parsed_json, raw_text_for_storage)."""
    today = date.today().isoformat()
    parts = []
    for i, b in enumerate(bundle, start=1):
        parts.append(
            f"--- Branch {i}: {b['label']} ---\n"
            f"Explorer:\n{b['explorer']}\n\nCritic:\n{b['critic']}\n"
        )
    blob = "\n".join(parts)
    r = _llm.invoke(
        [
            SystemMessage(
                content=(
                    f"Today is {today}. You are a senior research lead synthesizing parallel explorations into "
                    "actionable intelligence. Respond ONLY with valid JSON (no markdown fences). Schema:\n"
                    '{"ranked_directions":[{"rank":1,"title":"str","rationale":"str","key_risks":"str",'
                    '"next_step":"str"}],'
                    '"synthesis_note":"one paragraph tying themes together"}'
                    "\nRank by combined strength (specificity + feasibility given critiques). "
                    "Titles must be concrete, not generic."
                )
            ),
            HumanMessage(content=f"Research question:\n{question}\n\n{blob}"),
        ]
    )
    raw = r.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {
            "ranked_directions": [],
            "synthesis_note": raw[:1200],
            "parse_error": True,
        }
    return parsed, raw


async def run_pipeline(session_id: str) -> None:
    try:
        research_db.update_session(session_id, status="running")
        row = research_db.get_session_row(session_id)
        if not row:
            return
        cfg = row["config"] or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        parallelism = min(max(int(cfg.get("parallelism", 3)), 1), 5)
        question = row["question"]

        thread_ids: list[str] = []
        for i in range(parallelism):
            label_frag, _ = EXPLORER_PERSONAS[i % len(EXPLORER_PERSONAS)]
            label = f"Branch {i + 1} — {label_frag}"
            thread_ids.append(research_db.create_thread(session_id, label, i))

        async def explorer_step(i: int) -> dict[str, Any]:
            tid = thread_ids[i]
            label_frag, system = EXPLORER_PERSONAS[i % len(EXPLORER_PERSONAS)]
            text = await asyncio.to_thread(_explorer_invoke, question, system, label_frag)
            research_db.insert_message(
                tid,
                "explorer",
                text,
                agent_name=f"Explorer ({label_frag})",
                metadata={"persona": label_frag},
            )
            return {"thread_id": tid, "explorer": text, "label": label_frag, "sort_index": i}

        explored = await asyncio.gather(*[explorer_step(i) for i in range(parallelism)])

        async def critic_step(ex: dict[str, Any]) -> dict[str, Any]:
            tid = ex["thread_id"]
            crit = await asyncio.to_thread(
                _critic_invoke,
                question,
                ex["explorer"],
                ex["label"],
            )
            research_db.insert_message(
                tid,
                "critic",
                crit,
                agent_name="Peer reviewer",
                metadata={},
            )
            return {**ex, "critic": crit}

        critiqued = await asyncio.gather(*[critic_step(ex) for ex in explored])

        synth_id = research_db.create_thread(session_id, "Synthesis", 9999)
        parsed, raw = await asyncio.to_thread(_merger_invoke, question, list(critiqued))
        research_db.insert_message(
            synth_id,
            "merger",
            raw,
            agent_name="Synthesizer",
            metadata={"format": "json"},
        )
        research_db.update_session(session_id, status="completed", final_output=parsed)
    except Exception as e:  # noqa: BLE001 — surface any failure to client
        research_db.update_session(session_id, status="failed", error_message=str(e))
