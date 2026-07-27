"""The shape of a custom KPI definition.

A KPI is stored as structured data, never as free text and never as code. That
is what makes it reproducible: the same issues always produce the same number,
the definition can be shown back to a human in plain English, and nothing is
executed that a user typed.

An AI may *propose* one of these from a plain-English request, but it is
confirmed by a person and evaluated by `evaluator.py` - the model is never in
the path when the number is actually calculated.
"""
from __future__ import annotations
from typing import Any, Literal
from pydantic import BaseModel, Field

# Fields a condition may test. Raw fields come straight off a normalised Jira
# issue; derived ones are computed by the evaluator (see DERIVED_FIELDS there).
FilterField = Literal[
    "status",
    "priority",
    "issue_type",
    "assignee",
    "reporter",
    "labels",
    "key",
    "summary",
    "created",
    "updated",
    "resolved_at",
    "due_date",
    "blocked_by",
    # derived
    "is_resolved",
    "is_overdue",
    "is_unassigned",
    "days_to_resolve",
    "age_days",
]

Operator = Literal[
    "in",
    "not_in",
    "eq",
    "ne",
    "exists",
    "not_exists",
    "contains",
    "gt",
    "gte",
    "lt",
    "lte",
    "before",
    "after",
    "between",
]

Metric = Literal["count", "percentage", "ratio", "average", "sum"]

NumericField = Literal["days_to_resolve", "age_days"]

GroupBy = Literal["assignee", "status", "priority", "issue_type", "reporter"]


class Condition(BaseModel):
    field: FilterField
    op: Operator
    # Absent for exists / not_exists. A list for in / not_in / between.
    value: Any = None


class Filter(BaseModel):
    """Conditions combined as: every `all` matches, at least one `any` matches,
    and no `none` matches. An empty filter matches every issue."""

    all: list[Condition] = Field(default_factory=list)
    any: list[Condition] = Field(default_factory=list)
    none: list[Condition] = Field(default_factory=list)

    def is_empty(self) -> bool:
        return not (self.all or self.any or self.none)


class KPIDefinition(BaseModel):
    name: str
    description: str | None = None

    metric: Metric

    # The set being measured. For percentage/ratio this is the numerator.
    where: Filter = Field(default_factory=Filter)
    # Denominator for percentage/ratio. Empty means "all issues in scope".
    of: Filter | None = None

    # Required for average/sum, ignored otherwise.
    field: NumericField | None = None

    # Splits the result into one value per group, for charts.
    group_by: GroupBy | None = None

    unit: Literal["number", "percent", "days"] = "number"
    # Higher is better, lower is better, or neither. Drives colour, not maths.
    direction: Literal["up_is_good", "down_is_good", "neutral"] = "neutral"


class KPIResult(BaseModel):
    name: str
    value: float | None
    unit: str
    # Populated only when group_by is set.
    groups: dict[str, float | None] = Field(default_factory=dict)
    # How many issues the numerator and denominator matched, so a number can
    # always be traced back to the tickets behind it.
    matched: int = 0
    total: int = 0
