"""Proof that the KPI formula language can express real KPIs.

Every KPI here is one someone actually asked for, expressed in the structured
language and computed against the demo sprint. If one of these could not be
written down, the language would be too narrow and the UI on top of it would be
built on sand.

The demo sprint (s1, 14 issues):
  status    Done 6, In Progress 3, Blocked 2, To Do 3
  priority  High 6, Medium 4, Critical 2, Low 2
  type      Story 6, Task 5, Bug 2, Improvement 1
  assignee  Sarah Chen 3, David Park 3, Alex Rivera 4, Maria Lopez 2, none 2
  resolved  6 of 14
"""
from __future__ import annotations
from datetime import date
import pytest
from app.demo.data import get_demo_issues
from app.kpi.evaluator import evaluate
from app.kpi.schema import Condition, Filter, KPIDefinition

# The sprint runs 2026-07-17 to 2026-07-31; judge everything from its end date.
AS_OF = date(2026, 7, 31)
DONE = ["Done", "Closed", "Resolved"]


@pytest.fixture
def issues():
    return get_demo_issues("s1")


def test_sprint_spillover_rate(issues):
    """'What share of the sprint didn't get finished?' - the KPI named in the
    conversation as the one an AI could never guess unaided."""
    kpi = KPIDefinition(
        name="Sprint spillover rate",
        metric="percentage",
        where=Filter(none=[Condition(field="status", op="in", value=DONE)]),
        of=Filter(),
        unit="percent",
        direction="down_is_good",
    )
    result = evaluate(kpi, issues, AS_OF)
    # 8 of 14 unfinished.
    assert result.value == pytest.approx(57.14, abs=0.01)
    assert (result.matched, result.total) == (8, 14)


def test_completion_rate(issues):
    kpi = KPIDefinition(
        name="Completion rate",
        metric="percentage",
        where=Filter(all=[Condition(field="status", op="in", value=DONE)]),
        of=Filter(),
        unit="percent",
        direction="up_is_good",
    )
    assert evaluate(kpi, issues, AS_OF).value == pytest.approx(42.86, abs=0.01)


def test_bugs_solved_per_person(issues):
    """'How many bugs did this person solve?' - the example given verbatim.
    Grouping is what turns a single number into a chart."""
    kpi = KPIDefinition(
        name="Bugs solved",
        metric="count",
        where=Filter(
            all=[
                Condition(field="issue_type", op="eq", value="Bug"),
                Condition(field="is_resolved", op="eq", value=True),
            ]
        ),
        group_by="assignee",
    )
    result = evaluate(kpi, issues, AS_OF)
    assert sum(v or 0 for v in result.groups.values()) == result.value
    assert set(result.groups) >= {"Sarah Chen", "David Park", "Alex Rivera"}


def test_bugs_solved_in_a_date_range(issues):
    """'...in the month of March' - the same KPI, scoped to a period."""
    kpi = KPIDefinition(
        name="Bugs solved this sprint",
        metric="count",
        where=Filter(
            all=[
                Condition(field="issue_type", op="eq", value="Bug"),
                Condition(
                    field="resolved_at", op="between", value=["2026-07-17", "2026-07-31"]
                ),
            ]
        ),
    )
    result = evaluate(kpi, issues, AS_OF)
    assert result.value is not None and result.value >= 0


def test_test_pass_rate_by_label(issues):
    """'Test pass rate' - the KPI the conversation used to make the point that
    a machine cannot compute what nobody has defined. Here it is defined as
    'of everything labelled quality, how much reached Done'. A different
    customer would define it differently, which is exactly why the definition
    is stored per organisation rather than hardcoded."""
    kpi = KPIDefinition(
        name="Test pass rate",
        metric="percentage",
        where=Filter(
            all=[
                Condition(field="labels", op="in", value=["quality"]),
                Condition(field="status", op="in", value=DONE),
            ]
        ),
        of=Filter(all=[Condition(field="labels", op="in", value=["quality"])]),
        unit="percent",
        direction="up_is_good",
    )
    result = evaluate(kpi, issues, AS_OF)
    assert result.value is not None, "one issue carries the 'quality' label"
    assert 0 <= result.value <= 100


def test_average_cycle_time(issues):
    kpi = KPIDefinition(
        name="Average cycle time",
        metric="average",
        where=Filter(all=[Condition(field="is_resolved", op="eq", value=True)]),
        field="days_to_resolve",
        unit="days",
        direction="down_is_good",
    )
    result = evaluate(kpi, issues, AS_OF)
    assert result.value is not None and result.value > 0


def test_blocked_work_ratio(issues):
    kpi = KPIDefinition(
        name="Blocked work",
        metric="percentage",
        where=Filter(all=[Condition(field="status", op="eq", value="Blocked")]),
        of=Filter(),
        unit="percent",
        direction="down_is_good",
    )
    result = evaluate(kpi, issues, AS_OF)
    assert result.value == pytest.approx(14.29, abs=0.01)  # 2 of 14


def test_unassigned_high_priority(issues):
    """A risk signal the app already detects, expressed as a user-editable KPI."""
    kpi = KPIDefinition(
        name="Unassigned high priority",
        metric="count",
        where=Filter(
            all=[
                Condition(field="priority", op="in", value=["High", "Critical"]),
                Condition(field="is_unassigned", op="eq", value=True),
            ]
        ),
        direction="down_is_good",
    )
    assert evaluate(kpi, issues, AS_OF).value >= 0


def test_workload_distribution(issues):
    """'Who is carrying what' - grouping without any filter."""
    result = evaluate(
        KPIDefinition(name="Open work per person", metric="count",
                      where=Filter(none=[Condition(field="status", op="in", value=DONE)]),
                      group_by="assignee"),
        issues,
        AS_OF,
    )
    assert sum(v or 0 for v in result.groups.values()) == result.value


# --- the properties that make the numbers trustworthy ----------------------


def test_same_input_always_gives_same_answer(issues):
    """The whole reason the AI defines but does not compute."""
    kpi = KPIDefinition(
        name="Completion rate",
        metric="percentage",
        where=Filter(all=[Condition(field="status", op="in", value=DONE)]),
        of=Filter(),
    )
    assert len({evaluate(kpi, issues, AS_OF).value for _ in range(5)}) == 1


def test_empty_denominator_is_undefined_not_zero():
    """Reporting '0%' for a project with no tickets would be a lie."""
    kpi = KPIDefinition(
        name="Completion rate",
        metric="percentage",
        where=Filter(all=[Condition(field="status", op="in", value=DONE)]),
        of=Filter(),
    )
    assert evaluate(kpi, [], AS_OF).value is None


def test_status_matching_is_case_insensitive():
    """A customer's Jira may say 'done' where the definition says 'Done'."""
    kpi = KPIDefinition(
        name="Done", metric="count",
        where=Filter(all=[Condition(field="status", op="in", value=["Done"])]),
    )
    lower = [{"key": "A-1", "status": "done", "created": "2026-07-01"}]
    assert evaluate(kpi, lower, AS_OF).value == 1


def test_customer_specific_status_wording():
    """The point of customer-defined KPIs: a team whose Jira says 'Shipped'
    gets correct numbers, where the hardcoded engine would score them zero."""
    kpi = KPIDefinition(
        name="Completion rate",
        metric="percentage",
        where=Filter(all=[Condition(field="status", op="in", value=["Shipped", "QA Passed"])]),
        of=Filter(),
        unit="percent",
    )
    theirs = [
        {"key": "A-1", "status": "Shipped", "created": "2026-07-01"},
        {"key": "A-2", "status": "QA Passed", "created": "2026-07-01"},
        {"key": "A-3", "status": "In Dev", "created": "2026-07-01"},
    ]
    assert evaluate(kpi, theirs, AS_OF).value == pytest.approx(66.67, abs=0.01)


def test_result_is_traceable_to_tickets(issues):
    """Every number reports how many issues it came from, so a figure on a
    dashboard can always be justified."""
    kpi = KPIDefinition(
        name="Blocked", metric="count",
        where=Filter(all=[Condition(field="status", op="eq", value="Blocked")]),
    )
    result = evaluate(kpi, issues, AS_OF)
    assert result.matched == 2 and result.total == 14
