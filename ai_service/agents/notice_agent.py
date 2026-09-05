"""
Notice Drafting Agent — advocate-facing legal notice generator.

Drafts formal legal notices (demand notices, cheque-bounce notices under
S.138 NI Act, recovery notices, eviction notices, breach-of-contract notices,
etc.) in standard Indian advocate format.

Model backend — never Claude:
    This agent runs on the swappable `llm/` layer, which routes to either a
    HOSTED open model (OpenAI-compatible: HuggingFace router / Groq / Together / …)
    or a LOCAL model (Ollama), selected by LLM_BACKEND in .env. It never routes a
    client's draft facts through Claude/Anthropic. Switching hosted ⇄ local is a
    config change only — see ai_service/llm/README.md.
"""

from __future__ import annotations

import logging

from config import settings
from llm import get_llm, describe, LLMUnavailable

logger = logging.getLogger(__name__)

# Backwards-compatible alias — the route imports this name.
LocalModelUnavailable = LLMUnavailable


# Notice types → short guidance the prompt uses to anchor the statutory basis.
NOTICE_TYPES: dict[str, str] = {
    "demand": "General legal demand notice — demand for performance/payment before litigation.",
    "cheque_bounce": "Statutory notice under Section 138 of the Negotiable Instruments Act, 1881 "
                     "for a dishonoured cheque. Must demand payment within 15 days of receipt.",
    "money_recovery": "Notice for recovery of an outstanding sum / unpaid dues before a civil suit.",
    "eviction": "Notice to a tenant to vacate / quit the premises under the applicable Rent/"
                "Transfer of Property Act provisions.",
    "breach_of_contract": "Notice for breach of contract calling upon the recipient to cure the "
                          "breach and/or pay damages.",
    "consumer": "Notice to a seller/service provider for deficiency in service or defective goods "
                "under the Consumer Protection Act, 2019, prior to a consumer complaint.",
    "employment": "Employment-related notice (unpaid dues, wrongful termination, notice-period).",
    "defamation": "Notice for defamation demanding retraction, apology and/or damages.",
}


def _build_prompt(
    notice_type: str,
    sender_name: str,
    sender_details: str,
    recipient_name: str,
    recipient_details: str,
    facts: str,
    demand: str,
    compliance_days: int,
    advocate_name: str,
    extra_instructions: str,
) -> str:
    guidance = NOTICE_TYPES.get(notice_type, NOTICE_TYPES["demand"])

    parts = [
        f"Notice type: {notice_type} — {guidance}",
        f"Sender (client / addressor): {sender_name}"
        + (f" ({sender_details})" if sender_details else ""),
        f"Recipient (noticee / addressee): {recipient_name}"
        + (f" ({recipient_details})" if recipient_details else ""),
        f"Facts / background of the dispute:\n{facts}",
        f"Relief / demand sought: {demand}",
        f"Compliance period: {compliance_days} days from receipt of this notice",
    ]
    if advocate_name:
        parts.append(f"Issuing advocate: {advocate_name}")
    if extra_instructions:
        parts.append(f"Additional drafting instructions: {extra_instructions}")

    context = "\n".join(parts)

    return f"""{context}

Draft a complete, formal LEGAL NOTICE in the standard format used by advocates in India. Follow these requirements strictly:

1. Begin with "WITHOUT PREJUDICE" and the heading "LEGAL NOTICE".
2. Add a placeholder date line and a "To," block with the recipient's name and address details.
3. Open with: "Under instructions from and on behalf of my client, {sender_name}, I hereby serve upon you the following legal notice:" (adapt naturally).
4. Set out the facts as clearly numbered paragraphs (1., 2., 3., ...).
5. State the legal basis, citing the correct Indian statute and section where applicable for this notice type.
6. Make a clear, unambiguous demand and give the recipient the stated compliance period ({compliance_days} days) to comply.
7. State the consequences of non-compliance (appropriate civil and/or criminal proceedings at the recipient's risk, cost and consequences).
8. Close with the advocate's signature block and a placeholder for enrolment number and address.
9. Use formal, precise legal English. Do not invent specific case citations. Use square-bracket placeholders like [Address], [Date], [Amount], [Cheque No.] where a concrete detail is not supplied.

Output only the notice text, ready to be placed on the advocate's letterhead."""


async def draft_notice(
    notice_type: str,
    sender_name: str,
    recipient_name: str,
    facts: str,
    demand: str,
    compliance_days: int = 15,
    sender_details: str = "",
    recipient_details: str = "",
    advocate_name: str = "",
    extra_instructions: str = "",
) -> dict:
    """
    Draft a formal legal notice using the LOCAL Ollama model only.

    Returns: {
        notice_text, notice_type, compliance_days, model, powered_by, local_only
    }
    Raises LLMUnavailable if the selected backend (hosted or local) is not usable.
    """
    provider = get_llm()  # hosted or local per LLM_BACKEND — never Claude
    backend = describe()

    prompt = _build_prompt(
        notice_type=notice_type,
        sender_name=sender_name,
        sender_details=sender_details,
        recipient_name=recipient_name,
        recipient_details=recipient_details,
        facts=facts,
        demand=demand,
        compliance_days=compliance_days,
        advocate_name=advocate_name,
        extra_instructions=extra_instructions,
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a senior Indian advocate who drafts precise, professional legal "
                "notices. You know the Negotiable Instruments Act, Transfer of Property Act, "
                "Consumer Protection Act, Indian Contract Act and civil procedure. You never "
                "fabricate case law. You produce clean, ready-to-serve notice drafts."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    notice_text = await provider.complete(messages, max_tokens=1600, temperature=0.3)

    label = (
        f"Local AI — Ollama ({backend['model']})"
        if backend["backend"] == "local"
        else f"Hosted AI — {backend['model']}"
    )
    return {
        "notice_text": notice_text.strip(),
        "notice_type": notice_type,
        "compliance_days": compliance_days,
        "model": backend["model"],
        "powered_by": label,
        "backend": backend["backend"],
        "local_only": backend["backend"] == "local",
    }
