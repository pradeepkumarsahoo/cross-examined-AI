"""Score a processed batch against the generator's ground truth.

    python -m eval.run_eval --truth data/generated/ground_truth.json --out data/eval_report.md
    python -m eval.run_eval --truth ... --batch <batch id>     one specific batch
    python -m eval.run_eval --truth ... --all                  every batch (files uploaded in several goes)

The report covers classification accuracy, field accuracy per document type and per
format, recall per planted problem, false alarms on clean shipments, automation rate,
AI cost per document and batch time. The test suite proves the plumbing with a scripted
model; this measures what a real model actually reads.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Batch, DocStatus, Document, EvalRun, LLMCall, ShipmentPack
from app.db.session import session_scope
from app.rules.normalize import norm_po, norm_vehicle, parse_date
from app.schemas import SCHEMA_BY_TYPE, DocType
from app.services.packs import latest_extraction
from datagen.generate import EXPECTED_CODES

# Fields every extraction has that say nothing about reading accuracy.
_META_FIELDS = {"confidence", "uncertain_fields"}
# List fields compared line by line (by SKU); other lists are not scored.
_LINE_FIELDS = {"lines"}


# ----------------------------------------------------------------------------- tallies
@dataclass
class Tally:
    correct: int = 0
    total: int = 0

    def add(self, ok: bool) -> None:
        self.total += 1
        self.correct += int(ok)

    @property
    def rate(self) -> float | None:
        return self.correct / self.total if self.total else None


@dataclass
class Results:
    batches: list[dict] = field(default_factory=list)
    classification: Tally = field(default_factory=Tally)
    classification_by_format: dict[str, Tally] = field(default_factory=lambda: defaultdict(Tally))
    fields_by_type: dict[str, Tally] = field(default_factory=lambda: defaultdict(Tally))
    fields_by_format: dict[str, Tally] = field(default_factory=lambda: defaultdict(Tally))
    field_errors: dict[str, Tally] = field(default_factory=lambda: defaultdict(Tally))  # "type.field"
    missing_documents: list[str] = field(default_factory=list)
    misclassified: list[str] = field(default_factory=list)
    problem_recall: dict[str, Tally] = field(default_factory=lambda: defaultdict(Tally))
    shipments_caught: Tally = field(default_factory=Tally)
    missed: list[str] = field(default_factory=list)
    clean_total: int = 0
    false_alarms: list[str] = field(default_factory=list)
    missing_packs: list[str] = field(default_factory=list)
    routes: dict[str, int] = field(default_factory=dict)
    automation_rate: float | None = None
    documents_extracted: int = 0
    documents_failed: int = 0
    cost_usd: Decimal = Decimal("0")
    cost_by_agent: dict[str, Decimal] = field(default_factory=dict)
    llm_calls: int = 0


# ----------------------------------------------------------------------------- comparing values
def _alnum(v: Any) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(v or "").upper())


def _text(v: Any) -> str:
    return " ".join(str(v or "").casefold().split())


def _number(v: Any) -> Decimal | None:
    try:
        return Decimal(str(v).replace(",", ""))
    except Exception:
        return None


def values_match(name: str, truth: Any, got: Any) -> bool:
    """Exact where it matters (amounts to the paisa, identifiers), lenient on formatting."""
    if isinstance(truth, bool):
        return bool(got) == truth
    if isinstance(truth, int | float):
        g = _number(got)
        return g is not None and abs(g - Decimal(str(truth))) <= Decimal("0.011")
    if name.endswith("_date") or name in ("valid_until",):
        return parse_date(str(truth)) is not None and parse_date(str(truth)) == parse_date(str(got or ""))
    if name == "po_number":
        return norm_po(str(truth)) == norm_po(str(got or ""))
    if name.startswith("vehicle"):
        return norm_vehicle(str(truth)) == norm_vehicle(str(got or ""))
    if name.endswith(("_gstin", "_number")) or name in ("hsn", "sku"):
        return _alnum(truth) == _alnum(got)
    return _text(truth) == _text(got)


def lines_match(truth_lines: list[dict], got_lines: list[dict]) -> bool:
    """Same SKUs, and for each SKU the same quantity (and price where the truth has one)."""
    got = {_alnum(line.get("sku")): line for line in got_lines or [] if isinstance(line, dict)}
    if len(got) != len(truth_lines):
        return False
    for t in truth_lines:
        g = got.get(_alnum(t.get("sku")))
        if g is None:
            return False
        for key in ("qty_cartons", "price_per_carton", "amount"):
            if key in t and not values_match(key, t[key], g.get(key)):
                return False
    return True


def scored_fields(doc_type: str, truth: dict) -> list[str]:
    """Ground-truth fields that the extraction schema for this type also has."""
    try:
        schema = SCHEMA_BY_TYPE[DocType(doc_type)]
    except (KeyError, ValueError):
        return []
    out = []
    for name in schema.model_fields:
        if name in _META_FIELDS or name not in truth:
            continue
        value = truth[name]
        if name in _LINE_FIELDS:
            if value:
                out.append(name)
        elif not isinstance(value, list | dict) and value not in ("", None):
            out.append(name)
    return out


# ----------------------------------------------------------------------------- loading
def pick_batches(s: Session, batch_id: str | None, all_batches: bool) -> list[Batch]:
    if all_batches:
        return list(s.scalars(select(Batch).order_by(Batch.created_at)).all())
    if batch_id:
        b = s.get(Batch, batch_id)
        if b is None:
            raise SystemExit(f"Batch {batch_id} not found.")
        return [b]
    # The latest batch that holds documents: a re-upload of known files creates an empty batch.
    has_docs = select(Document.batch_id).distinct()
    b = s.scalars(select(Batch).where(Batch.id.in_(has_docs)).order_by(Batch.created_at.desc())).first()
    if b is None:
        raise SystemExit("No processed batch found. Upload the generated files first.")
    return [b]


def find_document(by_name: dict[str, Document], children: dict[tuple[str, int], Document],
                  filename: str, seg: dict, n_segments: int) -> Document | None:
    top = by_name.get(filename)
    if top is None:
        return None
    if n_segments == 1 and top.status != DocStatus.split:
        return top
    start = int(seg["pages"][0])
    child = children.get((top.id, start))
    if child is not None:
        return child
    # A bundle the classifier did not split: its first document is the file itself.
    return top if start == 1 and top.status != DocStatus.split else None


# ----------------------------------------------------------------------------- scoring
def score(truth: dict, batch_id: str | None = None, all_batches: bool = False) -> Results:
    res = Results()
    with session_scope() as s:
        batches = pick_batches(s, batch_id, all_batches)
        ids = [b.id for b in batches]
        for b in batches:
            end = b.grouped_at or s.scalar(select(func.max(Document.updated_at)).where(Document.batch_id == b.id))
            res.batches.append({"id": b.id, "name": b.name, "status": b.status, "created_at": b.created_at,
                                "seconds": (end - b.created_at).total_seconds() if end else None})

        docs = s.scalars(select(Document).where(Document.batch_id.in_(ids))).all()
        by_name = {d.filename: d for d in docs if d.parent_id is None}
        children = {(d.parent_id, d.page_start): d for d in docs if d.parent_id is not None}
        res.documents_extracted = sum(1 for d in docs if d.status == DocStatus.extracted)
        res.documents_failed = sum(1 for d in docs if d.status == DocStatus.failed)

        # --- documents: classification and fields
        for f in truth["files"]:
            segments = f["segments"]
            for seg in segments:
                label = f"{f['file']} p{seg['pages'][0]}"
                fmt = f["format"]
                doc = find_document(by_name, children, f["file"], seg, len(segments))
                if doc is None:
                    res.missing_documents.append(label)
                    res.classification.add(False)
                    res.classification_by_format[fmt].add(False)
                    continue
                ext = latest_extraction(s, doc.id)
                got_type = ext.doc_type if ext is not None else doc.doc_type
                ok_type = got_type == seg["doc_type"]
                res.classification.add(ok_type)
                res.classification_by_format[fmt].add(ok_type)
                if not ok_type:
                    res.misclassified.append(f"{label}: expected {seg['doc_type']}, got {got_type}")
                    continue
                data = ext.data if ext is not None else {}
                for name in scored_fields(seg["doc_type"], seg["fields"]):
                    t = seg["fields"][name]
                    ok = lines_match(t, data.get(name)) if name in _LINE_FIELDS else values_match(name, t, data.get(name))
                    res.fields_by_type[seg["doc_type"]].add(ok)
                    res.fields_by_format[fmt].add(ok)
                    res.field_errors[f"{seg['doc_type']}.{name}"].add(ok)

        # --- packs: planted problems, false alarms, routing
        packs: dict[str, ShipmentPack] = {}
        for p in s.scalars(select(ShipmentPack).where(ShipmentPack.batch_id.in_(ids))
                           .order_by(ShipmentPack.created_at)).all():
            if p.po_number and p.po_number not in packs:
                packs[p.po_number] = p
        for sh in truth["shipments"]:
            po = sh["po_number"]
            pack = packs.get(po)
            expected = set(sh["expected_issue_codes"])
            if not sh["problems"]:
                res.clean_total += 1
            if pack is None:
                res.missing_packs.append(po)
                for prob in sh["problems"]:
                    res.problem_recall[prob].add(False)
                res.shipments_caught.add(not expected)
                continue
            found = set(pack.issue_codes or []) - {"LOW_CONFIDENCE"}
            for prob in sh["problems"]:
                res.problem_recall[prob].add(EXPECTED_CODES[prob] <= found)
            if expected:
                caught = expected <= found
                res.shipments_caught.add(caught)
                if not caught:
                    res.missed.append(f"{po} ({', '.join(sh['problems'])}): missing {', '.join(sorted(expected - found))}")
            elif pack.route != "auto_approve":
                res.false_alarms.append(f"{po}: {pack.status.value}, codes {', '.join(sorted(found)) or '-'}")

        routes = dict(s.execute(select(ShipmentPack.route, func.count()).where(
            ShipmentPack.batch_id.in_(ids), ShipmentPack.route.isnot(None), ShipmentPack.route != "wait")
            .group_by(ShipmentPack.route)).all())
        res.routes = routes
        decided = sum(routes.values())
        res.automation_rate = routes.get("auto_approve", 0) / decided if decided else None

        # --- cost
        res.cost_usd = Decimal(s.scalar(select(func.coalesce(func.sum(LLMCall.cost_usd), 0))
                                        .where(LLMCall.batch_id.in_(ids))) or 0)
        res.llm_calls = s.scalar(select(func.count()).select_from(LLMCall).where(LLMCall.batch_id.in_(ids))) or 0
        res.cost_by_agent = {a: Decimal(c or 0) for a, c in s.execute(
            select(LLMCall.agent, func.sum(LLMCall.cost_usd)).where(LLMCall.batch_id.in_(ids))
            .group_by(LLMCall.agent)).all()}
    return res


# ----------------------------------------------------------------------------- report
def _pct(t: Tally | float | None) -> str:
    rate = t.rate if isinstance(t, Tally) else t
    return "n/a" if rate is None else f"{rate * 100:.1f}%"


def _frac(t: Tally) -> str:
    return f"{t.correct}/{t.total}"


def metrics_json(r: Results) -> dict:
    cost_per_doc = (r.cost_usd / r.documents_extracted) if r.documents_extracted else Decimal("0")
    return {
        "batches": [b["id"] for b in r.batches],
        "classification_accuracy": r.classification.rate,
        "field_accuracy_by_type": {k: v.rate for k, v in sorted(r.fields_by_type.items())},
        "field_accuracy_by_format": {k: v.rate for k, v in sorted(r.fields_by_format.items())},
        "problem_recall": {k: v.rate for k, v in sorted(r.problem_recall.items())},
        "shipments_caught": r.shipments_caught.rate,
        "false_alarms": len(r.false_alarms),
        "clean_shipments": r.clean_total,
        "automation_rate": r.automation_rate,
        "documents_extracted": r.documents_extracted,
        "documents_failed": r.documents_failed,
        "llm_cost_usd": str(r.cost_usd.quantize(Decimal("0.0001"))),
        "cost_per_document_usd": str(cost_per_doc.quantize(Decimal("0.000001"))),
        "batch_seconds": [b["seconds"] for b in r.batches],
    }


def render(r: Results) -> str:
    m = metrics_json(r)
    out = ["# CrossExam evaluation report", ""]
    for b in r.batches:
        secs = f"{b['seconds']:.0f} s" if b["seconds"] is not None else "not finished"
        out.append(f"- Batch `{b['id']}` ({b['name']}), status **{b['status']}**, upload to grouped: {secs}")
    out += ["", "## Headline", "", "| Metric | Value |", "|---|---|",
            f"| Classification accuracy | {_pct(r.classification)} ({_frac(r.classification)}) |",
            f"| Shipments with every planted problem caught | {_pct(r.shipments_caught)} ({_frac(r.shipments_caught)}) |",
            f"| False alarms on clean shipments | {len(r.false_alarms)} of {r.clean_total} |",
            f"| Automation rate (auto-approved / routed) | {_pct(r.automation_rate)} |",
            f"| Documents extracted / failed | {r.documents_extracted} / {r.documents_failed} |",
            f"| AI cost | US${m['llm_cost_usd']} over {r.llm_calls} calls |",
            f"| AI cost per document | US${m['cost_per_document_usd']} |", ""]

    out += ["## Classification by format", "", "| Format | Accuracy | Correct |", "|---|---|---|"]
    out += [f"| {k} | {_pct(v)} | {_frac(v)} |" for k, v in sorted(r.classification_by_format.items())]
    out += ["", "## Field accuracy by document type", "", "| Type | Accuracy | Correct fields |", "|---|---|---|"]
    out += [f"| {k} | {_pct(v)} | {_frac(v)} |" for k, v in sorted(r.fields_by_type.items())]
    out += ["", "## Field accuracy by format", "", "| Format | Accuracy | Correct fields |", "|---|---|---|"]
    out += [f"| {k} | {_pct(v)} | {_frac(v)} |" for k, v in sorted(r.fields_by_format.items())]
    weak = sorted(((k, v) for k, v in r.field_errors.items() if v.correct < v.total), key=lambda kv: kv[1].rate or 0)
    if weak:
        out += ["", "### Fields most often wrong", "", "| Field | Accuracy | Correct |", "|---|---|---|"]
        out += [f"| {k} | {_pct(v)} | {_frac(v)} |" for k, v in weak[:15]]

    out += ["", "## Recall per planted problem", "", "| Problem | Expected codes | Recall | Caught |",
            "|---|---|---|---|"]
    out += [f"| {k} | {', '.join(sorted(EXPECTED_CODES[k]))} | {_pct(v)} | {_frac(v)} |"
            for k, v in sorted(r.problem_recall.items())]

    out += ["", "## Routing", "", "| Route | Packs |", "|---|---|"]
    out += [f"| {k} | {v} |" for k, v in sorted(r.routes.items())]
    if r.cost_by_agent:
        out += ["", "## AI cost by agent", "", "| Agent | US$ |", "|---|---|"]
        out += [f"| {k} | {v.quantize(Decimal('0.0001'))} |" for k, v in sorted(r.cost_by_agent.items())]

    for title, items in (("Missed problems", r.missed), ("False alarms", r.false_alarms),
                         ("Shipments with no pack", r.missing_packs), ("Misclassified documents", r.misclassified),
                         ("Documents not found in the batch", r.missing_documents)):
        if items:
            out += ["", f"## {title}", ""] + [f"- {i}" for i in items]
    out.append("")
    return "\n".join(out)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--truth", default="data/generated/ground_truth.json")
    ap.add_argument("--out", default="data/eval_report.md")
    group = ap.add_mutually_exclusive_group()
    group.add_argument("--batch", help="batch id (default: the latest batch with documents)")
    group.add_argument("--all", action="store_true", help="score every batch together")
    ap.add_argument("--no-record", action="store_true", help="do not store the result in eval_runs")
    args = ap.parse_args()

    truth = json.loads(Path(args.truth).read_text())
    results = score(truth, batch_id=args.batch, all_batches=args.all)
    report = render(results)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(report, encoding="utf-8")
    if not args.no_record:
        with session_scope() as s:
            s.add(EvalRun(name="eval", metrics=json.loads(json.dumps(metrics_json(results), default=str))))
    print(report)
    print(f"Report written to {args.out}")


if __name__ == "__main__":
    main()
