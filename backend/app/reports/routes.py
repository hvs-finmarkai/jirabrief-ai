from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_org_member, require_role
from app.models.tables import OrganizationMember
from app.reports.storage import (
    save_report,
    get_report,
    list_reports,
    edit_report,
    update_approval,
    compare_reports,
    get_templates,
    StoredReport,
    ComparisonResult,
    ReportTemplate,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])


class EditRequest(BaseModel):
    edited_content: dict


class ApprovalRequest(BaseModel):
    status: str


@router.get("/templates", response_model=list[ReportTemplate])
async def get_report_templates(
    member: OrganizationMember = Depends(get_current_org_member),
    db: AsyncSession = Depends(get_db),
):
    return await get_templates(db, str(member.organization_id))


@router.get("", response_model=list[StoredReport])
async def list_all_reports(
    project_key: str | None = None,
    report_type: str | None = None,
    approval_status: str | None = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    member: OrganizationMember = Depends(get_current_org_member),
    db: AsyncSession = Depends(get_db),
):
    return await list_reports(
        db,
        organization_id=str(member.organization_id),
        project_key=project_key,
        report_type=report_type,
        approval_status=approval_status,
        limit=limit,
        offset=offset,
    )


@router.get("/{report_id}", response_model=StoredReport)
async def get_single_report(
    report_id: str,
    member: OrganizationMember = Depends(get_current_org_member),
    db: AsyncSession = Depends(get_db),
):
    report = await get_report(db, report_id, str(member.organization_id))
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.put("/{report_id}/edit", response_model=StoredReport)
async def edit_existing_report(
    report_id: str,
    body: EditRequest,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN", "MEMBER")),
    db: AsyncSession = Depends(get_db),
):
    report = await edit_report(db, report_id, str(member.organization_id), body.edited_content)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.put("/{report_id}/approval", response_model=StoredReport)
async def update_report_approval(
    report_id: str,
    body: ApprovalRequest,
    member: OrganizationMember = Depends(require_role("OWNER", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    report = await update_approval(
        db,
        report_id,
        str(member.organization_id),
        body.status,
        actor=member.user_id,
    )
    if not report:
        raise HTTPException(status_code=400, detail="Invalid status transition or report not found")
    return report


@router.post("/{report_a_id}/compare/{report_b_id}", response_model=ComparisonResult)
async def compare_two_reports(
    report_a_id: str,
    report_b_id: str,
    member: OrganizationMember = Depends(get_current_org_member),
    db: AsyncSession = Depends(get_db),
):
    org_id = str(member.organization_id)
    a = await get_report(db, report_a_id, org_id)
    b = await get_report(db, report_b_id, org_id)
    if not a or not b:
        raise HTTPException(status_code=404, detail="One or both reports not found")
    return compare_reports(a, b)
