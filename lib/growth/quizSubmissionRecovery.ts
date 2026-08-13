export type QuizSubmissionStorageStatus = "pending" | "ready" | "failed";

export type QuizFailureAlertStatus =
  | "not_needed"
  | "sending"
  | "sent"
  | "failed";

export type QuizSubmissionRecoveryRecord = {
  referenceId: string;
  clientSubmissionId: string;
  storageStatus: QuizSubmissionStorageStatus;
  sheetRowNumber?: number;
  storageAttemptCount: number;
  createdAt: string;
  updatedAt: string;
  firstName?: string;
  email?: string;
  phone?: string;
  consentedAt?: string;
  privacyText?: string;
  privacyTextVersion?: string;
  quizVersion?: string;
  scoringVersion?: string;
  answers?: Record<string, unknown>;
  outcome?: Record<string, unknown>;
  resultCategory?: string;
  scoreBand?: string;
  match?: Record<string, unknown>;
  recommendedTherapistSlug?: string;
  recommendedTherapistName?: string;
  intent?: string;
  attribution?: Record<string, unknown>;
  lastFailureStage?: string;
  lastFailureCode?: string;
  lastFailureAt?: string;
  failureAlertStatus: QuizFailureAlertStatus;
  failureAlertAttempts: number;
  failureAlertSentAt?: string;
};

export type QuizSubmissionRecoveryData = {
  generatedAt: string;
  pendingCount: number;
  failedCount: number;
  alertFailureCount: number;
  submissions: QuizSubmissionRecoveryRecord[];
};
