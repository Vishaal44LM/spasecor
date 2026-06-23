export const INCIDENT_STAGES = [
  "open",
  "assigned",
  "investigating",
  "mitigation_in_progress",
  "resolved",
  "closed",
] as const;

export type IncidentStage = (typeof INCIDENT_STAGES)[number];

export const STAGE_LABELS: Record<IncidentStage, string> = {
  open: "Open",
  assigned: "Assigned",
  investigating: "Investigating",
  mitigation_in_progress: "Mitigation In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const ASSET_TYPES = [
  { value: "satellite", label: "Satellite" },
  { value: "ground_station", label: "Ground Station" },
  { value: "communication_system", label: "Communication System" },
  { value: "mission_control_system", label: "Mission Control System" },
  { value: "payload_system", label: "Payload System" },
  { value: "navigation_system", label: "Navigation System" },
  { value: "other", label: "Other" },
] as const;

export const ASSET_STATUSES = [
  { value: "operational", label: "Operational" },
  { value: "degraded", label: "Degraded" },
  { value: "offline", label: "Offline" },
  { value: "decommissioned", label: "Decommissioned" },
  { value: "planned", label: "Planned" },
] as const;

export const DEFAULT_THREAT_CATEGORIES = [
  "GPS Spoofing",
  "Signal Jamming",
  "Ground Station Intrusion",
  "Command Injection",
  "Telemetry Manipulation",
  "Communication Hijacking",
  "Malware Infection",
  "Unauthorized Access",
  "Insider Threat",
  "Data Exfiltration",
  "Supply Chain Compromise",
  "Credential Theft",
  "Network Intrusion",
  "Unknown Threat",
];

export function stageIndex(stage: IncidentStage) {
  return INCIDENT_STAGES.indexOf(stage);
}
