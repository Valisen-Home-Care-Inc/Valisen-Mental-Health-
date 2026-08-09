/**
 * Pure mirror of the database's [startedAt, endedAt) placement invariant.
 * Production mutations are transactional in PostgreSQL; this model keeps the
 * resolution semantics explicit and independently testable.
 */
export type PlacementInterval = {
  id: string;
  checkpointCode: string;
  partnerName: string;
  locationName: string;
  startedAt: string;
  endedAt: string | null;
};

export type AttributedCheckpointSession = {
  anonymousSessionId: string;
  checkpointCode: string;
  placementId: string;
  startedAt: string;
};

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error("Placement timestamp is invalid.");
  return parsed;
}

export function resolvePlacementAt(
  placements: readonly PlacementInterval[],
  checkpointCode: string,
  at: string,
): PlacementInterval | null {
  const point = timestamp(at);
  const matches = placements
    .filter((placement) => {
      if (placement.checkpointCode !== checkpointCode) return false;
      const started = timestamp(placement.startedAt);
      const ended = placement.endedAt ? timestamp(placement.endedAt) : Infinity;
      return started <= point && point < ended;
    })
    .sort((left, right) => timestamp(right.startedAt) - timestamp(left.startedAt));
  if (matches.length > 1) throw new Error("Placement timeline contains an overlap.");
  return matches[0] || null;
}

export function bindSessionToPlacement(
  placements: readonly PlacementInterval[],
  checkpointCode: string,
  anonymousSessionId: string,
  startedAt: string,
): AttributedCheckpointSession {
  const placement = resolvePlacementAt(placements, checkpointCode, startedAt);
  if (!placement) throw new Error("Checkpoint has no active placement.");
  return {
    anonymousSessionId,
    checkpointCode,
    placementId: placement.id,
    startedAt,
  };
}

export function movePlacementTimeline(
  placements: readonly PlacementInterval[],
  input: {
    id: string;
    checkpointCode: string;
    partnerName: string;
    locationName: string;
    effectiveAt: string;
  },
): PlacementInterval[] {
  const effective = timestamp(input.effectiveAt);
  const checkpointPlacements = placements
    .filter((placement) => placement.checkpointCode === input.checkpointCode)
    .sort((left, right) => timestamp(left.startedAt) - timestamp(right.startedAt));
  const exact = checkpointPlacements.find(
    (placement) => timestamp(placement.startedAt) === effective,
  );
  if (exact) {
    return placements.map((placement) =>
      placement.id === exact.id
        ? {
            ...placement,
            partnerName: input.partnerName,
            locationName: input.locationName,
          }
        : { ...placement },
    );
  }
  const covering = resolvePlacementAt(
    checkpointPlacements,
    input.checkpointCode,
    input.effectiveAt,
  );
  const next = checkpointPlacements.find(
    (placement) => timestamp(placement.startedAt) > effective,
  );

  const updated = placements.map((placement) =>
    placement.id === covering?.id
      ? { ...placement, endedAt: input.effectiveAt }
      : { ...placement },
  );
  updated.push({
    id: input.id,
    checkpointCode: input.checkpointCode,
    partnerName: input.partnerName,
    locationName: input.locationName,
    startedAt: input.effectiveAt,
    endedAt: next?.startedAt || null,
  });
  return updated.sort((left, right) => timestamp(left.startedAt) - timestamp(right.startedAt));
}
