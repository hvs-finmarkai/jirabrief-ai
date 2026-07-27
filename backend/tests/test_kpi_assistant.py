"""The assistant proposes; code explains, checks and computes.

Most of what matters here is deliberately not the model: the plain-English
sentence a user approves, and the check that a proposed definition references
statuses that actually exist. Those are tested directly. The model call itself
is exercised through a stub provider so the suite needs no API key.
"""
from __future__ import annotations
from datetime import date
import pytest
from app.demo.data import get_demo_issues
from app.kpi import assistant
from app.kpi.assistant import (
    AssistantUnavailable,
    Vocabulary,
    build_vocabulary,
    check_against_vocabulary,
    propose,
)
from app.kpi.evaluator import evaluate
from app.kpi.explain import explain
from app.kpi.schema import Condition, Filter, KPIDefinition

AS_OF = date(2026, 7, 31)


@pytest.fixture
def issues():
    return get_demo_issues("s1")


# --- vocabulary ------------------------------------------------------------


def test_vocabulary_is_read_from_the_customers_own_data(issues):
    vocab = build_vocabulary(issues)
    assert "Done" in vocab.statuses and "Blocked" in vocab.statuses
    assert "Bug" in vocab.issue_types
    assert "migration" in vocab.labels
    # Unassigned tickets must not become an assignee called "None".
    assert all(a for a in vocab.assignees)


def test_vocabulary_of_a_team_with_unusual_wording():
    vocab = build_vocabulary(
        [{"status": "Shipped", "issue_type": "Chore", "labels": ["ops"]}]
    )
    assert vocab.statuses == ["Shipped"] and vocab.issue_types == ["Chore"]


# --- the sentence the user approves ---------------------------------------


def test_explanation_describes_a_percentage():
    kpi = KPIDefinition(
        name="Sprint spillover rate",
        metric="percentage",
        where=Filter(none=[Condition(field="status", op="in", value=["Done"])]),
        of=Filter(),
        unit="percent",
    )
    text = explain(kpi)
    assert "percentage" in text and "every ticket" in text and "'Done'" in text


def test_explanation_describes_a_grouped_count():
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
    text = explain(kpi)
    assert text.startswith("Count") and "is resolved" in text and "by assignee" in text


def test_explanation_describes_an_average():
    kpi = KPIDefinition(
        name="Cycle time",
        metric="average",
        field="days_to_resolve",
        where=Filter(all=[Condition(field="is_resolved", op="eq", value=True)]),
        unit="days",
    )
    assert "average days to resolve" in explain(kpi)


def test_excluded_conditions_read_as_plain_negatives():
    """'status is not Done' rather than 'not (status is Done)'."""
    kpi = KPIDefinition(
        name="Spillover",
        metric="percentage",
        where=Filter(none=[Condition(field="status", op="in", value=["Done"])]),
        of=Filter(),
    )
    text = explain(kpi)
    assert "status is not 'Done'" in text and "not (" not in text


def test_labels_read_as_include():
    """Labels are a set, so 'include' is accurate where 'is' would not be."""
    kpi = KPIDefinition(
        name="Migration work",
        metric="count",
        where=Filter(all=[Condition(field="labels", op="in", value=["migration", "etl"])]),
    )
    assert "labels include 'migration' or 'etl'" in explain(kpi)


def test_denominator_conditions_are_not_restated():
    """'Of quality tickets, the percentage where status is Done' - not
    '...the percentage where labels include quality and status is Done'."""
    kpi = KPIDefinition(
        name="Test pass rate",
        metric="percentage",
        where=Filter(
            all=[
                Condition(field="labels", op="in", value=["quality"]),
                Condition(field="status", op="in", value=["Done"]),
            ]
        ),
        of=Filter(all=[Condition(field="labels", op="in", value=["quality"])]),
    )
    text = explain(kpi)
    assert text == "Of tickets where labels include 'quality', the percentage where status is 'Done'."
    assert text.count("quality") == 1


def test_explanation_mentions_every_value_the_formula_uses():
    """If a value can change the number, it must appear in the sentence the
    user is asked to approve."""
    kpi = KPIDefinition(
        name="Urgent unassigned",
        metric="count",
        where=Filter(
            all=[
                Condition(field="priority", op="in", value=["High", "Critical"]),
                Condition(field="is_unassigned", op="eq", value=True),
            ]
        ),
    )
    text = explain(kpi)
    assert "'High'" in text and "'Critical'" in text and "unassigned" in text


# --- catching definitions that would silently score zero -------------------


def test_unknown_status_is_flagged(issues):
    vocab = build_vocabulary(issues)
    kpi = KPIDefinition(
        name="Verified work",
        metric="count",
        where=Filter(all=[Condition(field="status", op="in", value=["Verified"])]),
    )
    warnings = check_against_vocabulary(kpi, vocab)
    assert warnings and "Verified" in warnings[0]


def test_known_values_produce_no_warnings(issues):
    vocab = build_vocabulary(issues)
    kpi = KPIDefinition(
        name="Done work",
        metric="count",
        where=Filter(all=[Condition(field="status", op="in", value=["Done"])]),
    )
    assert check_against_vocabulary(kpi, vocab) == []


def test_warning_is_not_repeated_for_numerator_and_denominator(issues):
    vocab = build_vocabulary(issues)
    bad = Filter(all=[Condition(field="status", op="in", value=["Verified"])])
    kpi = KPIDefinition(name="x", metric="percentage", where=bad, of=bad)
    assert len(check_against_vocabulary(kpi, vocab)) == 1


def test_case_difference_is_not_a_warning(issues):
    vocab = build_vocabulary(issues)
    kpi = KPIDefinition(
        name="Done work",
        metric="count",
        where=Filter(all=[Condition(field="status", op="in", value=["done"])]),
    )
    assert check_against_vocabulary(kpi, vocab) == []


# --- the model path --------------------------------------------------------


class _StubProvider:
    """Stands in for Claude so the suite needs no API key."""

    name = "stub"
    model = "stub-1"

    def __init__(self, payload: str | None = None, fail: bool = False):
        self._payload = payload
        self._fail = fail
        self.received_prompt: str | None = None

    async def generate(self, system_prompt, user_prompt, output_model=None):
        self.received_prompt = user_prompt
        if self._fail:
            raise RuntimeError("provider down")
        return self._payload

    async def health_check(self):
        return not self._fail


SPILLOVER_JSON = """
{"name":"Sprint spillover rate","metric":"percentage","unit":"percent",
 "direction":"down_is_good",
 "where":{"all":[],"any":[],"none":[{"field":"status","op":"in","value":["Done"]}]},
 "of":{"all":[],"any":[],"none":[]}}
"""


async def test_proposal_is_usable_end_to_end(monkeypatch, issues):
    """A proposed definition must survive the whole path: validate, explain,
    and produce the same number the hand-written formula did."""
    stub = _StubProvider(SPILLOVER_JSON)
    monkeypatch.setattr(assistant, "get_providers", lambda: [stub])

    proposal = await propose("what share of the sprint didn't get finished", build_vocabulary(issues))

    assert proposal.source == "stub"
    assert proposal.warnings == []
    assert "percentage" in proposal.explanation
    assert evaluate(proposal.definition, issues, AS_OF).value == pytest.approx(57.14, abs=0.01)


async def test_the_customers_vocabulary_is_sent_to_the_model(monkeypatch, issues):
    stub = _StubProvider(SPILLOVER_JSON)
    monkeypatch.setattr(assistant, "get_providers", lambda: [stub])
    await propose("completion rate", build_vocabulary(issues))
    assert "Blocked" in stub.received_prompt and "migration" in stub.received_prompt


async def test_falls_through_to_the_next_provider(monkeypatch, issues):
    broken, working = _StubProvider(fail=True), _StubProvider(SPILLOVER_JSON)
    monkeypatch.setattr(assistant, "get_providers", lambda: [broken, working])
    proposal = await propose("spillover", build_vocabulary(issues))
    assert proposal.definition.metric == "percentage"


async def test_clear_error_when_no_provider_works(monkeypatch, issues):
    monkeypatch.setattr(assistant, "get_providers", lambda: [_StubProvider(fail=True)])
    with pytest.raises(AssistantUnavailable, match="manually"):
        await propose("spillover", build_vocabulary(issues))


async def test_malformed_model_output_is_rejected(monkeypatch, issues):
    """Better to fail loudly than store a KPI that computes nonsense."""
    monkeypatch.setattr(
        assistant, "get_providers", lambda: [_StubProvider('{"name":"x","metric":"telepathy"}')]
    )
    with pytest.raises(AssistantUnavailable):
        await propose("something", build_vocabulary(issues))


async def test_empty_request_is_rejected(issues):
    with pytest.raises(ValueError):
        await propose("   ", build_vocabulary(issues))


async def test_explanation_comes_from_the_formula_not_the_model(monkeypatch, issues):
    """The model could describe one thing and encode another. The sentence shown
    for approval is always rendered from the stored formula."""
    misleading = """
    {"name":"Completion rate","metric":"count",
     "where":{"all":[{"field":"status","op":"in","value":["Blocked"]}],"any":[],"none":[]}}
    """
    monkeypatch.setattr(assistant, "get_providers", lambda: [_StubProvider(misleading)])
    proposal = await propose("completion rate", build_vocabulary(issues))
    # Named "Completion rate", but it counts blocked tickets - and the
    # explanation says so, giving the human a chance to reject it.
    assert "Blocked" in proposal.explanation
    assert "percentage" not in proposal.explanation
