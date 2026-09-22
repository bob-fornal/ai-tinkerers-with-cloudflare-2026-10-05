export type ReviewStatus = "pending" | "approved" | "rejected" | "deprecated";
export type UserRole = "coach" | "parent";
export type BillingStatus = "unpaid" | "paid";
export type PipelineRunStatus = "success" | "failed" | "skipped_empty_backlog";

export interface SourceRecord {
  readonly id: number;
  readonly roughTitle: string;
  readonly suggestedBy: string | null;
  readonly processed: boolean;
  readonly processedDate: string | null;
  readonly processedWeek: number | null;
  readonly reviewStatus: ReviewStatus;
  readonly generatedTitle: string | null;
  readonly kvArticleKey: string | null;
  readonly modelUsed: string | null;
  readonly failureCount: number;
  readonly stuck: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SourceLink {
  readonly id: number;
  readonly sourceRecordId: number;
  readonly url: string;
  readonly addedAt: string;
}

export interface AppUser {
  readonly id: string;
  readonly role: UserRole;
  readonly thunk: string;
  readonly billingStatus: BillingStatus;
  readonly superuser: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WeeklySelection {
  readonly id: number;
  readonly userId: string;
  readonly year: number;
  readonly weekNumber: number;
  readonly articleId: number;
  readonly createdAt: string;
}

export interface ModelTestNote {
  readonly id: number;
  readonly entryMarkdown: string;
  readonly createdAt: string;
}

export interface AuditLogEntry {
  readonly id: number;
  readonly actorId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  /** Parsed from the `detail` column's stored JSON text; `null` if absent or unparseable. */
  readonly detail: unknown;
  readonly createdAt: string;
}

export interface PipelineRun {
  readonly id: number;
  readonly runDate: string;
  readonly sourceRecordId: number | null;
  readonly status: PipelineRunStatus;
  readonly modelUsed: string | null;
  readonly failureReason: string | null;
  readonly createdAt: string;
}
