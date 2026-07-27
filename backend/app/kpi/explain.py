"""Renders a KPI definition back into plain English.

Deliberately written by code rather than by the model. The human confirmation
step is only meaningful if the sentence shown describes exactly what will be
computed - if the AI wrote the prose too, it could describe one thing while the
stored formula did another, and the confirmation would be theatre.
"""
from __future__ import annotations
from app.kpi.schema import Condition, Filter, KPIDefinition

_FIELD_NAMES = {
    "status": "status",
    "priority": "priority",
    "issue_type": "type",
    "assignee": "assignee",
    "reporter": "reporter",
    "labels": "labels",
    "key": "key",
    "summary": "summary",
    "created": "created date",
    "updated": "updated date",
    "resolved_at": "resolved date",
    "due_date": "due date",
    "blocked_by": "blocker",
    "is_resolved": "resolved",
    "is_overdue": "overdue",
    "is_unassigned": "unassigned",
    "days_to_resolve": "days to resolve",
    "age_days": "age in days",
}

_BOOLEAN_FIELDS = {"is_resolved", "is_overdue", "is_unassigned"}


def _quote_list(values) -> str:
    items = [f"'{v}'" for v in (values or [])]
    if not items:
        return "nothing"
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + " or " + items[-1]


def _condition(condition: Condition) -> str:
    name = _FIELD_NAMES.get(condition.field, condition.field)
    op, value = condition.op, condition.value

    if condition.field in _BOOLEAN_FIELDS:
        truthy = value if op in ("eq", "ne") else True
        negated = (op == "ne") ^ (truthy is False)
        return f"is not {name}" if negated else f"is {name}"

    # `labels` holds several values at once, so it reads as "include", not "is".
    if condition.field == "labels":
        match op:
            case "in" | "eq" | "contains":
                values = value if isinstance(value, list) else [value]
                return f"{name} include {_quote_list(values)}"
            case "not_in" | "ne":
                values = value if isinstance(value, list) else [value]
                return f"{name} do not include {_quote_list(values)}"

    match op:
        case "in":
            return f"{name} is {_quote_list(value)}"
        case "not_in":
            return f"{name} is not {_quote_list(value)}"
        case "eq":
            return f"{name} is '{value}'"
        case "ne":
            return f"{name} is not '{value}'"
        case "exists":
            return f"has a {name}"
        case "not_exists":
            return f"has no {name}"
        case "contains":
            return f"{name} contains '{value}'"
        case "gt":
            return f"{name} is more than {value}"
        case "gte":
            return f"{name} is at least {value}"
        case "lt":
            return f"{name} is less than {value}"
        case "lte":
            return f"{name} is at most {value}"
        case "before":
            return f"{name} is before {value}"
        case "after":
            return f"{name} is after {value}"
        case "between":
            start, end = (value or [None, None])[:2]
            return f"{name} is between {start} and {end}"
    return f"{name} {op} {value}"


# Operators with a clean opposite, so an excluded condition can be read as a
# plain negative ("status is not 'Done'") instead of "not (status is 'Done')".
_OPPOSITES = {
    "in": "not_in",
    "not_in": "in",
    "eq": "ne",
    "ne": "eq",
    "exists": "not_exists",
    "not_exists": "exists",
    "gt": "lte",
    "lte": "gt",
    "lt": "gte",
    "gte": "lt",
}


def _negated(condition: Condition) -> str:
    opposite = _OPPOSITES.get(condition.op)
    if opposite is None:
        return f"not ({_condition(condition)})"
    return _condition(condition.model_copy(update={"op": opposite}))


def describe_conditions(filt: Filter) -> str:
    """The condition clause on its own, with no leading noun."""
    parts: list[str] = []
    if filt.all:
        parts.append(" and ".join(_condition(c) for c in filt.all))
    if filt.any:
        parts.append("(" + " or ".join(_condition(c) for c in filt.any) + ")")
    if filt.none:
        if len(filt.none) == 1:
            parts.append(_negated(filt.none[0]))
        else:
            parts.append("not (" + " or ".join(_condition(c) for c in filt.none) + ")")
    return " and ".join(parts)


def _without(numerator: Filter, denominator: Filter | None) -> Filter:
    """The numerator's conditions minus any the denominator already applies."""
    if denominator is None or denominator.is_empty():
        return numerator
    shared = {c.model_dump_json() for c in denominator.all}
    return Filter(
        all=[c for c in numerator.all if c.model_dump_json() not in shared],
        any=numerator.any,
        none=numerator.none,
    )


def describe_filter(filt: Filter | None, empty: str = "every ticket") -> str:
    if filt is None or filt.is_empty():
        return empty
    return "tickets where " + describe_conditions(filt)


def explain(definition: KPIDefinition) -> str:
    """One sentence a person can approve or reject."""
    where = describe_filter(definition.where)
    of = describe_filter(definition.of, empty="every ticket")

    match definition.metric:
        case "count":
            sentence = f"Count {where}."
        case "percentage":
            if definition.where.is_empty():
                sentence = f"The percentage of {of} matching everything (always 100%)."
            else:
                # The numerator usually restates the denominator's conditions
                # (e.g. "quality tickets that are Done" out of "quality
                # tickets"). Saying them twice makes the sentence harder to
                # check, so only the narrowing conditions are shown.
                narrowing = _without(definition.where, definition.of)
                clause = describe_conditions(narrowing if not narrowing.is_empty() else definition.where)
                sentence = f"Of {of}, the percentage where {clause}."
        case "ratio":
            sentence = f"{where.capitalize()} divided by {of}."
        case "average":
            field = _FIELD_NAMES.get(definition.field or "", definition.field)
            sentence = f"The average {field} across {where}."
        case "sum":
            field = _FIELD_NAMES.get(definition.field or "", definition.field)
            sentence = f"The total {field} across {where}."
        case _:
            sentence = f"{definition.metric} of {where}."

    if definition.group_by:
        sentence += f" Broken down by {_FIELD_NAMES.get(definition.group_by, definition.group_by)}."

    return sentence
