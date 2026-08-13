export type QuizTestCandidate = {
  recordKey: string;
  recordKind: "lead" | "attempt";
  referenceId?: string;
  sessionId?: string;
  firstName?: string;
  email?: string;
  startedAt: string;
  lastSeenAt: string;
  maxQuizQuestion: number;
  quizCompleted: boolean;
  attemptCount: number;
  isTest: boolean;
  testMarkedAt?: string;
  testLabel?: string;
};

export type QuizTestData = {
  generatedAt: string;
  flaggedCount: number;
  testerIdentityCount: number;
  records: QuizTestCandidate[];
};

export type QuizTestFlagResult = {
  accepted: boolean;
  isTest: boolean;
  scope: "journey" | "tester_identity";
  sessionsUpdated: number;
  submissionsUpdated: number;
  consultationsUpdated: number;
};
