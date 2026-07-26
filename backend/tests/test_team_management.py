"""Invites and role changes, exercised through the real HTTP stack.

These go through the app rather than the service functions because what is being
protected here are authorisation rules - who may do what to whom. The invite
auto-accept in particular only happens inside get_current_user, so there is no
other way to exercise it.
"""
from __future__ import annotations
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy import select
from app.core.config import get_settings
from app.core.database import async_session
from app.main import app
from app.models.tables import (
    Organization,
    OrganizationInvite,
    OrganizationMember,
    Profile,
)

SECRET = get_settings().supabase_jwt_secret


def _token(user_id: str, email: str | None = None, email_verified: bool | None = None) -> str:
    payload: dict = {"sub": user_id, "aud": "authenticated", "exp": 9999999999}
    if email:
        payload["email"] = email
    if email_verified is not None:
        payload["user_metadata"] = {"email_verified": email_verified}
    return jwt.encode(payload, SECRET, algorithm="HS256")


def _headers(user_id: str, org_id: str, email: str | None = None, **kw) -> dict:
    return {
        "Authorization": f"Bearer {_token(user_id, email, **kw)}",
        "X-Organization-Id": org_id,
    }


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
async def org():
    """An org with an owner, an admin, a member, and a second org to test
    isolation against."""
    suffix = uuid.uuid4().hex[:8]
    async with async_session() as db:
        primary = Organization(name="Primary", slug=f"primary-{suffix}")
        other = Organization(name="Other", slug=f"other-{suffix}")
        db.add_all([primary, other])
        await db.flush()

        rows = {
            "owner": OrganizationMember(organization_id=primary.id, user_id=f"owner-{suffix}", role="OWNER"),
            "admin": OrganizationMember(organization_id=primary.id, user_id=f"admin-{suffix}", role="ADMIN"),
            "member": OrganizationMember(organization_id=primary.id, user_id=f"member-{suffix}", role="MEMBER"),
        }
        outsider = OrganizationMember(organization_id=other.id, user_id=f"outsider-{suffix}", role="OWNER")
        db.add_all([*rows.values(), outsider])
        db.add_all(
            [
                Profile(user_id=f"owner-{suffix}", display_name="Olivia", email=f"olivia-{suffix}@example.com"),
                Profile(user_id=f"admin-{suffix}", display_name="Adam", email=f"adam-{suffix}@example.com"),
                Profile(user_id=f"member-{suffix}", display_name="Mia", email=f"mia-{suffix}@example.com"),
            ]
        )
        await db.commit()

        ctx = {
            "suffix": suffix,
            "org_id": str(primary.id),
            "other_org_id": str(other.id),
            "owner": f"owner-{suffix}",
            "admin": f"admin-{suffix}",
            "member": f"member-{suffix}",
            "outsider": f"outsider-{suffix}",
            "member_row_id": str(rows["member"].id),
            "admin_row_id": str(rows["admin"].id),
            "owner_row_id": str(rows["owner"].id),
        }

    yield ctx

    async with async_session() as db:
        for oid in (ctx["org_id"], ctx["other_org_id"]):
            await db.execute(OrganizationInvite.__table__.delete().where(OrganizationInvite.organization_id == uuid.UUID(oid)))
            await db.execute(OrganizationMember.__table__.delete().where(OrganizationMember.organization_id == uuid.UUID(oid)))
            await db.execute(Organization.__table__.delete().where(Organization.id == uuid.UUID(oid)))
        await db.execute(Profile.__table__.delete().where(Profile.user_id.like(f"%-{ctx['suffix']}")))
        await db.commit()


# --- members list ----------------------------------------------------------


async def test_members_list_shows_people_not_just_ids(client, org):
    r = await client.get(f"/api/organizations/{org['org_id']}/members", headers=_headers(org["owner"], org["org_id"]))
    assert r.status_code == 200
    names = {m["display_name"] for m in r.json()}
    assert {"Olivia", "Adam", "Mia"} <= names, "members should resolve to real names"
    assert all(m["email"] for m in r.json())


# --- invites ---------------------------------------------------------------


async def test_admin_can_invite_a_member(client, org):
    r = await client.post(
        f"/api/organizations/{org['org_id']}/invites",
        headers=_headers(org["admin"], org["org_id"]),
        json={"email": "New.Person@Example.com", "role": "MEMBER"},
    )
    assert r.status_code == 200
    assert r.json()["email"] == "new.person@example.com", "address should be normalised"


async def test_admin_cannot_invite_an_admin(client, org):
    r = await client.post(
        f"/api/organizations/{org['org_id']}/invites",
        headers=_headers(org["admin"], org["org_id"]),
        json={"email": "escalate@example.com", "role": "ADMIN"},
    )
    assert r.status_code == 403


async def test_member_cannot_invite_at_all(client, org):
    r = await client.post(
        f"/api/organizations/{org['org_id']}/invites",
        headers=_headers(org["member"], org["org_id"]),
        json={"email": "someone@example.com", "role": "MEMBER"},
    )
    assert r.status_code == 403


async def test_cannot_invite_an_existing_member(client, org):
    r = await client.post(
        f"/api/organizations/{org['org_id']}/invites",
        headers=_headers(org["owner"], org["org_id"]),
        json={"email": f"mia-{org['suffix']}@example.com", "role": "MEMBER"},
    )
    assert r.status_code == 409


async def test_reinviting_updates_rather_than_duplicating(client, org):
    for role in ("VIEWER", "MEMBER"):
        r = await client.post(
            f"/api/organizations/{org['org_id']}/invites",
            headers=_headers(org["owner"], org["org_id"]),
            json={"email": "repeat@example.com", "role": role},
        )
        assert r.status_code == 200

    listed = await client.get(
        f"/api/organizations/{org['org_id']}/invites", headers=_headers(org["owner"], org["org_id"])
    )
    matching = [i for i in listed.json() if i["email"] == "repeat@example.com"]
    assert len(matching) == 1
    assert matching[0]["role"] == "MEMBER"


async def test_invalid_email_is_rejected(client, org):
    r = await client.post(
        f"/api/organizations/{org['org_id']}/invites",
        headers=_headers(org["owner"], org["org_id"]),
        json={"email": "not-an-email", "role": "MEMBER"},
    )
    assert r.status_code == 422


async def test_another_org_cannot_read_or_create_invites(client, org):
    """The path org and the header org must agree - this is the tenant leak
    that existed on the members endpoint."""
    for method, url in (
        ("get", f"/api/organizations/{org['org_id']}/invites"),
        ("post", f"/api/organizations/{org['org_id']}/invites"),
    ):
        call = getattr(client, method)
        kwargs = {"headers": _headers(org["outsider"], org["other_org_id"])}
        if method == "post":
            kwargs["json"] = {"email": "spy@example.com", "role": "MEMBER"}
        assert (await call(url, **kwargs)).status_code == 403


# --- accepting an invite ---------------------------------------------------


async def test_invited_person_joins_on_first_login(client, org):
    email = f"newjoiner-{org['suffix']}@example.com"
    await client.post(
        f"/api/organizations/{org['org_id']}/invites",
        headers=_headers(org["owner"], org["org_id"]),
        json={"email": email, "role": "VIEWER"},
    )

    new_user = f"newjoiner-{org['suffix']}"
    # Any authenticated call is enough - acceptance happens in get_current_user.
    r = await client.get("/api/organizations", headers={"Authorization": f"Bearer {_token(new_user, email)}"})
    assert r.status_code == 200
    assert org["org_id"] in [o["id"] for o in r.json()], "should now belong to the inviting org"

    async with async_session() as db:
        membership = (
            await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.organization_id == uuid.UUID(org["org_id"]),
                    OrganizationMember.user_id == new_user,
                )
            )
        ).scalar_one()
        assert membership.role == "VIEWER", "should join with the invited role"

        invite = (
            await db.execute(select(OrganizationInvite).where(OrganizationInvite.email == email))
        ).scalar_one()
        assert invite.accepted_at is not None, "invite should be marked used"


async def test_unverified_address_cannot_claim_an_invite(client, org):
    """Otherwise registering with someone else's address would hand you their
    invite."""
    email = f"victim-{org['suffix']}@example.com"
    await client.post(
        f"/api/organizations/{org['org_id']}/invites",
        headers=_headers(org["owner"], org["org_id"]),
        json={"email": email, "role": "ADMIN"},
    )

    attacker = f"attacker-{org['suffix']}"
    r = await client.get(
        "/api/organizations",
        headers={"Authorization": f"Bearer {_token(attacker, email, email_verified=False)}"},
    )
    assert r.status_code == 200
    assert org["org_id"] not in [o["id"] for o in r.json()]


async def test_revoked_invite_is_not_claimable(client, org):
    email = f"revoked-{org['suffix']}@example.com"
    created = await client.post(
        f"/api/organizations/{org['org_id']}/invites",
        headers=_headers(org["owner"], org["org_id"]),
        json={"email": email, "role": "MEMBER"},
    )
    await client.delete(
        f"/api/organizations/{org['org_id']}/invites/{created.json()['id']}",
        headers=_headers(org["owner"], org["org_id"]),
    )

    revoked_user = f"revoked-user-{org['suffix']}"
    r = await client.get(
        "/api/organizations",
        headers={"Authorization": f"Bearer {_token(revoked_user, email)}"},
    )
    assert org["org_id"] not in [o["id"] for o in r.json()]


# --- role changes ----------------------------------------------------------


async def test_owner_can_promote_a_member(client, org):
    r = await client.put(
        f"/api/organizations/{org['org_id']}/members/{org['member_row_id']}/role",
        headers=_headers(org["owner"], org["org_id"]),
        json={"role": "ADMIN"},
    )
    assert r.status_code == 200
    assert r.json()["role"] == "ADMIN"


async def test_nobody_can_change_their_own_role(client, org):
    r = await client.put(
        f"/api/organizations/{org['org_id']}/members/{org['owner_row_id']}/role",
        headers=_headers(org["owner"], org["org_id"]),
        json={"role": "ADMIN"},
    )
    assert r.status_code == 403


async def test_admin_cannot_grant_admin(client, org):
    r = await client.put(
        f"/api/organizations/{org['org_id']}/members/{org['member_row_id']}/role",
        headers=_headers(org["admin"], org["org_id"]),
        json={"role": "ADMIN"},
    )
    assert r.status_code == 403


async def test_admin_cannot_demote_another_admin(client, org):
    async with async_session() as db:
        db.add(
            OrganizationMember(
                organization_id=uuid.UUID(org["org_id"]), user_id=f"admin2-{org['suffix']}", role="ADMIN"
            )
        )
        await db.commit()
        second = (
            await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.user_id == f"admin2-{org['suffix']}"
                )
            )
        ).scalar_one()
        second_id = str(second.id)

    r = await client.put(
        f"/api/organizations/{org['org_id']}/members/{second_id}/role",
        headers=_headers(org["admin"], org["org_id"]),
        json={"role": "VIEWER"},
    )
    assert r.status_code == 403


async def test_the_only_owner_cannot_be_demoted(client, org):
    """An org with no owner can never be administered again."""
    async with async_session() as db:
        db.add(
            OrganizationMember(
                organization_id=uuid.UUID(org["org_id"]), user_id=f"owner2-{org['suffix']}", role="OWNER"
            )
        )
        await db.commit()

    # With two owners the demotion is allowed.
    r = await client.put(
        f"/api/organizations/{org['org_id']}/members/{org['owner_row_id']}/role",
        headers=_headers(f"owner2-{org['suffix']}", org["org_id"]),
        json={"role": "MEMBER"},
    )
    assert r.status_code == 200

    # Now only one owner remains, so demoting them must fail.
    async with async_session() as db:
        last = (
            await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.user_id == f"owner2-{org['suffix']}"
                )
            )
        ).scalar_one()

    r = await client.put(
        f"/api/organizations/{org['org_id']}/members/{str(last.id)}/role",
        headers=_headers(org["owner"], org["org_id"]),
        json={"role": "MEMBER"},
    )
    assert r.status_code in (403, 409)


async def test_role_change_is_tenant_scoped(client, org):
    r = await client.put(
        f"/api/organizations/{org['org_id']}/members/{org['member_row_id']}/role",
        headers=_headers(org["outsider"], org["other_org_id"]),
        json={"role": "VIEWER"},
    )
    assert r.status_code == 403


# --- removal ---------------------------------------------------------------


async def test_cannot_remove_yourself(client, org):
    r = await client.delete(
        f"/api/organizations/{org['org_id']}/members/{org['owner_row_id']}",
        headers=_headers(org["owner"], org["org_id"]),
    )
    assert r.status_code == 403


async def test_admin_cannot_remove_an_owner(client, org):
    r = await client.delete(
        f"/api/organizations/{org['org_id']}/members/{org['owner_row_id']}",
        headers=_headers(org["admin"], org["org_id"]),
    )
    assert r.status_code == 403


async def test_the_only_owner_cannot_be_removed(client, org):
    async with async_session() as db:
        db.add(
            OrganizationMember(
                organization_id=uuid.UUID(org["org_id"]), user_id=f"owner3-{org['suffix']}", role="OWNER"
            )
        )
        await db.commit()
        other_owner = (
            await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.user_id == f"owner3-{org['suffix']}"
                )
            )
        ).scalar_one()

    # Two owners: removing one is fine.
    r = await client.delete(
        f"/api/organizations/{org['org_id']}/members/{str(other_owner.id)}",
        headers=_headers(org["owner"], org["org_id"]),
    )
    assert r.status_code == 200

    # One owner left, and they are the caller, so self-removal blocks first.
    r = await client.delete(
        f"/api/organizations/{org['org_id']}/members/{org['owner_row_id']}",
        headers=_headers(org["owner"], org["org_id"]),
    )
    assert r.status_code == 403
