"""
IPC → BNS Section Converter (G3)
Maps Indian Penal Code (1860) sections to Bharatiya Nyaya Sanhita (2023).
BNS came into effect 1 July 2024, replacing IPC entirely.

GET  /api/v1/ipc-bns/search?q=420       — search by IPC section or keyword
GET  /api/v1/ipc-bns/{ipc_section}      — exact lookup
GET  /api/v1/ipc-bns/reverse/{bns_section} — BNS → IPC reverse lookup
GET  /api/v1/ipc-bns/categories         — list all offence categories
GET  /api/v1/ipc-bns/all                — full mapping table
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

router = APIRouter()

# ── Complete IPC → BNS mapping ────────────────────────────────────────────────
# Format: "IPC_SECTION": {bns, title, category, notes, punishment_change}
IPC_TO_BNS: dict[str, dict] = {
    # General provisions
    "34":  {"bns": "3(5)",   "title": "Acts done by several persons in furtherance of common intention", "category": "General", "notes": "Common intention — now embedded in general provisions"},
    "85":  {"bns": "22",     "title": "Act of a person incapable of judgment by reason of intoxication", "category": "General", "notes": ""},
    "107": {"bns": "45",     "title": "Abetment of a thing", "category": "Abetment", "notes": ""},
    "109": {"bns": "48",     "title": "Punishment of abetment if the act abetted is committed", "category": "Abetment", "notes": ""},
    "120A":{"bns": "61",     "title": "Definition of criminal conspiracy", "category": "Conspiracy", "notes": ""},
    "120B":{"bns": "61",     "title": "Punishment of criminal conspiracy", "category": "Conspiracy", "notes": ""},

    # Offences against the State
    "121": {"bns": "147",    "title": "Waging war against the Government of India", "category": "State", "notes": ""},
    "124A":{"bns": "152",    "title": "Endangering sovereignty, unity and integrity of India", "category": "State", "notes": "Sedition reframed — broader scope under BNS"},

    # Offences relating to public tranquillity
    "141": {"bns": "189",    "title": "Unlawful assembly", "category": "Public Order", "notes": ""},
    "147": {"bns": "191(2)", "title": "Punishment for rioting", "category": "Public Order", "notes": ""},
    "148": {"bns": "191(3)", "title": "Rioting, armed with deadly weapon", "category": "Public Order", "notes": ""},
    "149": {"bns": "190",    "title": "Every member of unlawful assembly guilty of offence committed", "category": "Public Order", "notes": ""},
    "153A":{"bns": "196",    "title": "Promoting enmity between different groups", "category": "Public Order", "notes": ""},

    # Public servants
    "166": {"bns": "202",    "title": "Public servant disobeying law", "category": "Public Servant", "notes": ""},
    "186": {"bns": "221",    "title": "Obstructing public servant in discharge of public functions", "category": "Public Servant", "notes": ""},

    # False evidence
    "191": {"bns": "227",    "title": "Giving false evidence", "category": "False Evidence", "notes": ""},
    "193": {"bns": "229",    "title": "Punishment for false evidence (perjury)", "category": "False Evidence", "notes": ""},
    "195": {"bns": "231",    "title": "Giving or fabricating false evidence with intent to procure conviction", "category": "False Evidence", "notes": ""},

    # Offences against the body — Homicide
    "299": {"bns": "99",     "title": "Culpable homicide", "category": "Homicide", "notes": ""},
    "300": {"bns": "100",    "title": "Murder (definition)", "category": "Homicide", "notes": ""},
    "302": {"bns": "101",    "title": "Punishment for murder", "category": "Homicide", "notes": "Death or life imprisonment + fine"},
    "304": {"bns": "105",    "title": "Punishment for culpable homicide not amounting to murder", "category": "Homicide", "notes": ""},
    "304A":{"bns": "106(1)", "title": "Causing death by negligence", "category": "Homicide", "notes": "BNS adds hit-and-run clause (sec 106(2))"},
    "304B":{"bns": "80",     "title": "Dowry death", "category": "Homicide", "notes": "Minimum sentence increased to 7 years in BNS"},
    "306": {"bns": "108",    "title": "Abetment of suicide", "category": "Homicide", "notes": ""},
    "307": {"bns": "109",    "title": "Attempt to murder", "category": "Homicide", "notes": ""},
    "308": {"bns": "110",    "title": "Attempt to commit culpable homicide", "category": "Homicide", "notes": ""},

    # Hurt
    "319": {"bns": "114",    "title": "Hurt (definition)", "category": "Hurt", "notes": ""},
    "320": {"bns": "114",    "title": "Grievous hurt (definition)", "category": "Hurt", "notes": ""},
    "323": {"bns": "115(2)", "title": "Punishment for voluntarily causing hurt", "category": "Hurt", "notes": ""},
    "324": {"bns": "116(1)", "title": "Voluntarily causing hurt by dangerous weapons", "category": "Hurt", "notes": ""},
    "325": {"bns": "117(2)", "title": "Punishment for voluntarily causing grievous hurt", "category": "Hurt", "notes": ""},
    "326": {"bns": "118(1)", "title": "Voluntarily causing grievous hurt by dangerous weapons", "category": "Hurt", "notes": ""},
    "326A":{"bns": "124",    "title": "Voluntarily causing grievous hurt by use of acid, etc.", "category": "Hurt", "notes": "Acid attack — standalone chapter in BNS"},
    "326B":{"bns": "125",    "title": "Voluntarily throwing or attempting to throw acid", "category": "Hurt", "notes": ""},

    # Assault & Criminal Force
    "349": {"bns": "130",    "title": "Force", "category": "Assault", "notes": ""},
    "350": {"bns": "130",    "title": "Criminal force", "category": "Assault", "notes": ""},
    "351": {"bns": "131",    "title": "Assault", "category": "Assault", "notes": ""},
    "354": {"bns": "74",     "title": "Assault or criminal force to woman with intent to outrage her modesty", "category": "Sexual Offences", "notes": "Moved to Chapter V (Sexual Offences) in BNS"},
    "354A":{"bns": "75",     "title": "Sexual harassment", "category": "Sexual Offences", "notes": "Now explicitly defined with enhanced punishment"},
    "354B":{"bns": "76",     "title": "Assault or use of criminal force with intent to disrobe a woman", "category": "Sexual Offences", "notes": ""},
    "354C":{"bns": "77",     "title": "Voyeurism", "category": "Sexual Offences", "notes": ""},
    "354D":{"bns": "78",     "title": "Stalking", "category": "Sexual Offences", "notes": "Online stalking now explicitly covered"},

    # Kidnapping
    "359": {"bns": "137",    "title": "Kidnapping", "category": "Kidnapping", "notes": ""},
    "363": {"bns": "137(2)", "title": "Punishment for kidnapping", "category": "Kidnapping", "notes": ""},
    "364": {"bns": "139",    "title": "Kidnapping for murder", "category": "Kidnapping", "notes": ""},
    "365": {"bns": "140",    "title": "Kidnapping with intent secretly and wrongfully to confine person", "category": "Kidnapping", "notes": ""},
    "366": {"bns": "141",    "title": "Kidnapping to compel marriage", "category": "Kidnapping", "notes": ""},

    # Rape & Sexual Offences
    "375": {"bns": "63",     "title": "Rape (definition)", "category": "Sexual Offences", "notes": "BNS retains definition; marital rape exception retained with modification"},
    "376": {"bns": "64",     "title": "Punishment for rape", "category": "Sexual Offences", "notes": "Minimum 10 years RI; death possible for repeat offenders"},
    "376A":{"bns": "66",     "title": "Punishment for causing death or resulting in persistent vegetative state of victim", "category": "Sexual Offences", "notes": ""},
    "376AB":{"bns": "65(1)", "title": "Punishment for rape on woman under twelve years of age", "category": "Sexual Offences", "notes": ""},
    "376B":{"bns": "67",     "title": "Sexual intercourse by husband upon his wife during separation", "category": "Sexual Offences", "notes": ""},
    "376D":{"bns": "70(1)",  "title": "Gang rape", "category": "Sexual Offences", "notes": "20 years to life RI"},
    "376E":{"bns": "71",     "title": "Punishment for repeat offenders", "category": "Sexual Offences", "notes": "Life imprisonment or death"},

    # Matrimonial offences
    "498A":{"bns": "85",     "title": "Husband or relative of husband of a woman subjecting her to cruelty", "category": "Matrimonial", "notes": "Same offence, renumbered"},
    "312": {"bns": "88",     "title": "Causing miscarriage", "category": "Matrimonial", "notes": ""},

    # Theft
    "378": {"bns": "303(1)", "title": "Theft (definition)", "category": "Theft", "notes": ""},
    "379": {"bns": "303(2)", "title": "Punishment for theft", "category": "Theft", "notes": ""},
    "380": {"bns": "305(b)", "title": "Theft in dwelling house", "category": "Theft", "notes": ""},
    "381": {"bns": "305(a)", "title": "Theft by clerk or servant", "category": "Theft", "notes": ""},
    "382": {"bns": "304",    "title": "Theft after preparation made for causing death", "category": "Theft", "notes": ""},

    # Extortion
    "383": {"bns": "308(1)", "title": "Extortion (definition)", "category": "Extortion", "notes": ""},
    "384": {"bns": "308(2)", "title": "Punishment for extortion", "category": "Extortion", "notes": ""},
    "385": {"bns": "308(1)", "title": "Putting person in fear of injury in order to commit extortion", "category": "Extortion", "notes": ""},

    # Robbery & Dacoity
    "390": {"bns": "309(1)", "title": "Robbery (definition)", "category": "Robbery", "notes": ""},
    "392": {"bns": "309(2)", "title": "Punishment for robbery", "category": "Robbery", "notes": ""},
    "395": {"bns": "310(2)", "title": "Punishment for dacoity", "category": "Robbery", "notes": ""},
    "396": {"bns": "311",    "title": "Dacoity with murder", "category": "Robbery", "notes": ""},

    # Criminal misappropriation & CBT
    "403": {"bns": "314(1)", "title": "Dishonest misappropriation of property", "category": "CBT", "notes": ""},
    "405": {"bns": "316(1)", "title": "Criminal breach of trust (definition)", "category": "CBT", "notes": ""},
    "406": {"bns": "316(2)", "title": "Punishment for criminal breach of trust", "category": "CBT", "notes": ""},
    "408": {"bns": "316(3)", "title": "Criminal breach of trust by carrier", "category": "CBT", "notes": ""},
    "409": {"bns": "316(4)", "title": "Criminal breach of trust by public servant", "category": "CBT", "notes": ""},

    # Receiving stolen property
    "410": {"bns": "317(1)", "title": "Stolen property", "category": "Stolen Property", "notes": ""},
    "411": {"bns": "317(2)", "title": "Dishonestly receiving stolen property", "category": "Stolen Property", "notes": ""},
    "413": {"bns": "317(4)", "title": "Habitually dealing in stolen property", "category": "Stolen Property", "notes": ""},

    # Cheating
    "415": {"bns": "318(1)", "title": "Cheating (definition)", "category": "Cheating", "notes": ""},
    "417": {"bns": "318(2)", "title": "Punishment for cheating", "category": "Cheating", "notes": ""},
    "419": {"bns": "319(1)", "title": "Punishment for cheating by personation", "category": "Cheating", "notes": ""},
    "420": {"bns": "318(4)", "title": "Cheating and dishonestly inducing delivery of property", "category": "Cheating", "notes": "7 years RI — same as IPC; online fraud now covered explicitly"},

    # Mischief
    "425": {"bns": "324(1)", "title": "Mischief (definition)", "category": "Mischief", "notes": ""},
    "426": {"bns": "324(2)", "title": "Punishment for mischief", "category": "Mischief", "notes": ""},
    "436": {"bns": "326(b)", "title": "Mischief by fire or explosive substance", "category": "Mischief", "notes": ""},

    # Trespass
    "441": {"bns": "329(1)", "title": "Criminal trespass", "category": "Trespass", "notes": ""},
    "447": {"bns": "329(2)", "title": "Punishment for criminal trespass", "category": "Trespass", "notes": ""},
    "448": {"bns": "330(1)", "title": "House-trespass", "category": "Trespass", "notes": ""},
    "454": {"bns": "331(1)", "title": "Lurking house-trespass to commit offence", "category": "Trespass", "notes": ""},
    "457": {"bns": "331(2)", "title": "Lurking house-trespass by night", "category": "Trespass", "notes": ""},

    # Forgery
    "463": {"bns": "336(1)", "title": "Forgery (definition)", "category": "Forgery", "notes": ""},
    "465": {"bns": "336(2)", "title": "Punishment for forgery", "category": "Forgery", "notes": ""},
    "467": {"bns": "337(1)", "title": "Forgery of valuable security, will, etc.", "category": "Forgery", "notes": ""},
    "468": {"bns": "338",    "title": "Forgery for purpose of cheating", "category": "Forgery", "notes": ""},
    "471": {"bns": "340(2)", "title": "Using as genuine a forged document", "category": "Forgery", "notes": ""},
    "474": {"bns": "341",    "title": "Having possession of document knowing it to be forged", "category": "Forgery", "notes": ""},

    # Defamation
    "499": {"bns": "356(1)", "title": "Defamation (definition)", "category": "Defamation", "notes": "Online defamation now explicitly covered"},
    "500": {"bns": "356(2)", "title": "Punishment for defamation", "category": "Defamation", "notes": ""},
    "503": {"bns": "351(1)", "title": "Criminal intimidation", "category": "Intimidation", "notes": ""},
    "504": {"bns": "352",    "title": "Intentional insult with intent to provoke breach of peace", "category": "Intimidation", "notes": ""},
    "505": {"bns": "353",    "title": "Statements conducing to public mischief", "category": "Public Order", "notes": ""},
    "509": {"bns": "79",     "title": "Word, gesture or act intended to insult the modesty of a woman", "category": "Sexual Offences", "notes": ""},
}

# Reverse map: BNS → IPC
BNS_TO_IPC: dict[str, list[str]] = {}
for ipc_sec, data in IPC_TO_BNS.items():
    bns = data["bns"]
    BNS_TO_IPC.setdefault(bns, []).append(ipc_sec)

CATEGORIES = sorted(set(v["category"] for v in IPC_TO_BNS.values()))


def _enrich(ipc_sec: str, data: dict) -> dict:
    return {
        "ipc_section": ipc_sec,
        "bns_section": data["bns"],
        "title": data["title"],
        "category": data["category"],
        "notes": data.get("notes", ""),
        "effective_from": "1 July 2024",
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/categories")
async def list_categories():
    return {"categories": CATEGORIES, "total_sections": len(IPC_TO_BNS)}


@router.get("/all")
async def get_all(category: Optional[str] = None):
    results = [_enrich(k, v) for k, v in IPC_TO_BNS.items()]
    if category:
        results = [r for r in results if r["category"].lower() == category.lower()]
    return {"results": results, "total": len(results)}


@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    """Search by IPC section number, BNS section, title, or category keyword."""
    q_lower = q.lower().strip()
    results = []
    for ipc_sec, data in IPC_TO_BNS.items():
        if (
            q_lower in ipc_sec
            or q_lower in data["bns"].lower()
            or q_lower in data["title"].lower()
            or q_lower in data["category"].lower()
            or q_lower in data.get("notes", "").lower()
        ):
            results.append(_enrich(ipc_sec, data))
    return {"query": q, "results": results, "total": len(results)}


@router.get("/reverse/{bns_section}")
async def reverse_lookup(bns_section: str):
    """Given a BNS section, find the equivalent IPC section(s)."""
    ipc_sections = BNS_TO_IPC.get(bns_section)
    if not ipc_sections:
        # Try partial match
        matches = [k for k in BNS_TO_IPC if bns_section.lower() in k.lower()]
        if not matches:
            raise HTTPException(status_code=404, detail=f"BNS Section {bns_section} not found in mapping")
        ipc_sections = []
        for m in matches:
            ipc_sections.extend(BNS_TO_IPC[m])
    results = [_enrich(ipc, IPC_TO_BNS[ipc]) for ipc in ipc_sections if ipc in IPC_TO_BNS]
    return {"bns_section": bns_section, "ipc_sections": results}


@router.get("/{ipc_section}")
async def get_by_ipc(ipc_section: str):
    """Exact lookup by IPC section number (e.g. 420, 302, 498A)."""
    clean = ipc_section.upper().strip()
    data = IPC_TO_BNS.get(clean) or IPC_TO_BNS.get(clean.lower())
    if not data:
        # Try case-insensitive
        for k, v in IPC_TO_BNS.items():
            if k.lower() == clean.lower():
                return _enrich(k, v)
        raise HTTPException(status_code=404, detail=f"IPC Section {ipc_section} not found. Try /search?q={ipc_section}")
    return _enrich(clean, data)
