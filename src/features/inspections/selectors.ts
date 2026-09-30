import type { Finding } from "../findings/types";
import type { InspectionAggregate, InspectionDetailDto, InspectionEditorDto, InspectionFinding, InspectionListDto, InspectionResult } from "./types";

export function selectNonDeletedFindings(findings: readonly Finding[]) {
  return findings.filter((finding) => finding.deletedAt === null);
}

export function deriveInspectionResult(findings: readonly Finding[]): InspectionResult {
  return selectNonDeletedFindings(findings).length === 0 ? "without_findings" : "requires_attention";
}

export function countPendingFindings(findings: readonly Finding[]) {
  return selectNonDeletedFindings(findings).filter((finding) => finding.status !== "resolved").length;
}

function toInspectionFinding(finding: Finding): InspectionFinding {
  return {
    id: finding.id,
    title: finding.title,
    description: finding.description,
    priority: finding.priority,
    status: finding.status,
  };
}

function baseDto(aggregate: InspectionAggregate) {
  const activeFindings = selectNonDeletedFindings(aggregate.findings);
  const inspection = aggregate.inspection;

  return {
    id: inspection.id,
    // The server assigns folioNumber; this only presents that assigned value.
    folio: String(inspection.folioNumber),
    folioNumber: inspection.folioNumber,
    laboratoryId: inspection.laboratoryId,
    location: aggregate.laboratory?.label ?? "",
    laboratoryCode: aggregate.laboratory?.code ?? "",
    inspectorId: inspection.inspectorId,
    inspector: aggregate.inspectorName,
    inspectionDate: inspection.inspectionDate,
    date: inspection.inspectionDate ?? "",
    summary: inspection.summary,
    workflowStatus: inspection.workflowStatus,
    result: deriveInspectionResult(activeFindings),
    findingCount: activeFindings.length,
    pendingFindingCount: countPendingFindings(activeFindings),
    version: inspection.version,
    syncStatus: aggregate.local.syncStatus,
    findings: activeFindings.map(toInspectionFinding),
  };
}

export function toInspectionListDto(aggregate: InspectionAggregate): InspectionListDto {
  const { findings: _findings, ...dto } = baseDto(aggregate);
  return dto;
}

export function toInspectionEditorDto(aggregate: InspectionAggregate): InspectionEditorDto {
  const dto = baseDto(aggregate);
  return {
    id: dto.id,
    folio: dto.folio,
    folioNumber: dto.folioNumber,
    laboratoryId: dto.laboratoryId,
    laboratoryCode: dto.laboratoryCode,
    inspectionDate: dto.inspectionDate,
    date: dto.date,
    inspectorId: dto.inspectorId,
    technician: dto.inspector,
    summary: dto.summary,
    workflowStatus: dto.workflowStatus,
    version: dto.version,
    findings: dto.findings,
    syncStatus: dto.syncStatus,
  };
}

export function toInspectionDetailDto(aggregate: InspectionAggregate): InspectionDetailDto {
  const dto = baseDto(aggregate);
  return {
    ...dto,
    technician: dto.inspector,
    scope: "inspection",
  };
}
