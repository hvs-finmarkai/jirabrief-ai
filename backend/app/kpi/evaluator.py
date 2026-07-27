"""Computes a KPI from issues. Pure, deterministic, no AI, no clock of its own.

`as_of` is passed in rather than read from the system clock so that a KPI
computed today over last month's data gives the same answer next week - and so
the tests are not time-dependent.
"""
from __future__ import annotations
from datetime import date, datetime
from typing import Any
from app.kpi.schema import Condition, Filter, KPIDefinition, KPIResult

DERIVED_FIELDS = {"is_resolved", "is_overdue", "is_unassigned", "days_to_resolve", "age_days"}


class KPIEvaluationError(ValueError):
    pass


def _as_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value)
    # Jira sends full timestamps; the date part is all a KPI needs.
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(text[: len(fmt) + 2 if "T" in fmt else 10], fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _resolve_field(issue: dict, field: str, as_of: date) -> Any:
    if field not in DERIVED_FIELDS:
        return issue.get(field)

    resolved = _as_date(issue.get("resolved_at"))
    created = _as_date(issue.get("created"))
    due = _as_date(issue.get("due_date"))

    if field == "is_resolved":
        return resolved is not None
    if field == "is_unassigned":
        return not issue.get("assignee")
    if field == "is_overdue":
        return due is not None and resolved is None and due < as_of
    if field == "days_to_resolve":
        return (resolved - created).days if resolved and created else None
    if field == "age_days":
        end = resolved or as_of
        return (end - created).days if created else None
    return None


def _normalise(value: Any) -> Any:
    """Case-insensitive comparison for text, so a definition written against
    'Done' still matches an issue whose status is 'done'."""
    return value.strip().lower() if isinstance(value, str) else value


def _match(condition: Condition, issue: dict, as_of: date) -> bool:
    actual = _resolve_field(issue, condition.field, as_of)
    op = condition.op
    expected = condition.value

    if op == "exists":
        return actual not in (None, "", [], False)
    if op == "not_exists":
        return actual in (None, "", [], False)

    if actual is None:
        # A condition on a missing value is simply not met, rather than an error.
        return False

    # `labels` is a list; membership tests apply to its contents.
    if isinstance(actual, list):
        items = {_normalise(v) for v in actual}
        if op == "in":
            return bool(items & {_normalise(v) for v in (expected or [])})
        if op == "not_in":
            return not (items & {_normalise(v) for v in (expected or [])})
        if op in ("eq", "contains"):
            return _normalise(expected) in items
        if op == "ne":
            return _normalise(expected) not in items
        raise KPIEvaluationError(f"Operator '{op}' cannot be used on a list field")

    if op in ("before", "after", "between"):
        actual_date = _as_date(actual)
        if actual_date is None:
            return False
        if op == "before":
            other = _as_date(expected)
            return other is not None and actual_date < other
        if op == "after":
            other = _as_date(expected)
            return other is not None and actual_date > other
        start, end = (_as_date(v) for v in (expected or [None, None]))
        if start is None or end is None:
            raise KPIEvaluationError("'between' needs a [start, end] pair")
        return start <= actual_date <= end

    a = _normalise(actual)

    if op == "in":
        return a in {_normalise(v) for v in (expected or [])}
    if op == "not_in":
        return a not in {_normalise(v) for v in (expected or [])}
    if op == "eq":
        return a == _normalise(expected)
    if op == "ne":
        return a != _normalise(expected)
    if op == "contains":
        return isinstance(a, str) and _normalise(expected) in a

    if op in ("gt", "gte", "lt", "lte"):
        try:
            left, right = float(actual), float(expected)
        except (TypeError, ValueError):
            raise KPIEvaluationError(f"'{op}' needs numbers, got {actual!r} and {expected!r}")
        return {
            "gt": left > right,
            "gte": left >= right,
            "lt": left < right,
            "lte": left <= right,
        }[op]

    raise KPIEvaluationError(f"Unknown operator '{op}'")


def matches(issue: dict, filt: Filter | None, as_of: date) -> bool:
    if filt is None or filt.is_empty():
        return True
    if not all(_match(c, issue, as_of) for c in filt.all):
        return False
    if filt.any and not any(_match(c, issue, as_of) for c in filt.any):
        return False
    if any(_match(c, issue, as_of) for c in filt.none):
        return False
    return True


def _aggregate(definition: KPIDefinition, issues: list[dict], as_of: date) -> tuple[float | None, int, int]:
    numerator = [i for i in issues if matches(i, definition.where, as_of)]

    if definition.metric == "count":
        return float(len(numerator)), len(numerator), len(issues)

    if definition.metric in ("percentage", "ratio"):
        denominator = [i for i in issues if matches(i, definition.of, as_of)]
        if not denominator:
            # No denominator means the KPI is undefined, not zero. Reporting 0%
            # for "no tickets at all" would be a lie.
            return None, len(numerator), 0
        share = len(numerator) / len(denominator)
        value = share * 100 if definition.metric == "percentage" else share
        return round(value, 2), len(numerator), len(denominator)

    if definition.metric in ("average", "sum"):
        if not definition.field:
            raise KPIEvaluationError(f"metric '{definition.metric}' requires a field")
        values = [
            v
            for v in (_resolve_field(i, definition.field, as_of) for i in numerator)
            if v is not None
        ]
        if not values:
            return None, len(numerator), len(issues)
        total = float(sum(values))
        return (round(total / len(values), 2) if definition.metric == "average" else total), len(values), len(issues)

    raise KPIEvaluationError(f"Unknown metric '{definition.metric}'")


def evaluate(definition: KPIDefinition, issues: list[dict], as_of: date | None = None) -> KPIResult:
    as_of = as_of or date.today()

    if definition.group_by:
        groups: dict[str, float | None] = {}
        keys = {(i.get(definition.group_by) or "Unassigned") for i in issues}
        for key in sorted(keys):
            subset = [i for i in issues if (i.get(definition.group_by) or "Unassigned") == key]
            value, _, _ = _aggregate(definition, subset, as_of)
            groups[key] = value
        overall, matched, total = _aggregate(definition, issues, as_of)
        return KPIResult(
            name=definition.name,
            value=overall,
            unit=definition.unit,
            groups=groups,
            matched=matched,
            total=total,
        )

    value, matched, total = _aggregate(definition, issues, as_of)
    return KPIResult(
        name=definition.name, value=value, unit=definition.unit, matched=matched, total=total
    )
