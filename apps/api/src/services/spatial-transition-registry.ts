import { planarWorldDisplacement } from "./world-coordinate-math.js";

export type CoordinateSpaceId = string;

export type SpatialTransitionType =
  | "dungeon"
  | "tower"
  | "arena"
  | "special_instance"
  | "secondary_map"
  | "other";

export interface SpatialRegion {
  centerX: number;
  centerY: number;
  tolerance: number;
}

export interface SpatialExitRegion extends SpatialRegion {
  destinationCoordinateSpaceId: CoordinateSpaceId;
}

export interface SpatialTransitionSignature {
  id: string;
  displayName: string;
  type: SpatialTransitionType;
  destinationCoordinateSpaceId: CoordinateSpaceId;
  arrivalRegion: SpatialRegion;
  originRegions?: SpatialRegion[];
  exitRegions?: SpatialExitRegion[];
  source: {
    name: string;
    version: string;
  };
  enabled: boolean;
}

export interface SpatialPosition {
  x: number;
  y: number;
}

export interface MatchedSpatialTransition {
  signature: SpatialTransitionSignature;
  direction: "entry" | "exit";
  originCoordinateSpaceId: CoordinateSpaceId;
  destinationCoordinateSpaceId: CoordinateSpaceId;
}

export const unknownCoordinateSpaceId = "unknown";
export const palpagosCoordinateSpaceId = "palpagos";

export class SpatialTransitionRegistry {
  private readonly signatures: SpatialTransitionSignature[];

  constructor(signatures: SpatialTransitionSignature[] = []) {
    this.signatures = signatures
      .filter(({ enabled }) => enabled)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  coordinateSpaceAt(position: SpatialPosition): CoordinateSpaceId {
    const match = this.bestRegionMatch(
      this.signatures.map((signature) => ({
        signature,
        region: signature.arrivalRegion,
      })),
      position,
    );
    return (
      match?.signature.destinationCoordinateSpaceId ?? unknownCoordinateSpaceId
    );
  }

  match(
    originCoordinateSpaceId: CoordinateSpaceId,
    origin: SpatialPosition,
    destination: SpatialPosition,
  ): MatchedSpatialTransition | null {
    const exits = this.signatures.flatMap((signature) =>
      originCoordinateSpaceId === signature.destinationCoordinateSpaceId
        ? (signature.exitRegions ?? []).map((region) => ({ signature, region }))
        : [],
    );
    const exit = this.bestRegionMatch(exits, destination);
    if (exit) {
      return {
        signature: exit.signature,
        direction: "exit",
        originCoordinateSpaceId,
        destinationCoordinateSpaceId: exit.region.destinationCoordinateSpaceId,
      };
    }

    const arrivals = this.signatures
      .filter(
        (signature) =>
          signature.destinationCoordinateSpaceId !== originCoordinateSpaceId &&
          this.matchesAnyOrigin(signature.originRegions, origin),
      )
      .map((signature) => ({
        signature,
        region: signature.arrivalRegion,
      }));
    const entry = this.bestRegionMatch(arrivals, destination);
    return entry
      ? {
          signature: entry.signature,
          direction: "entry",
          originCoordinateSpaceId,
          destinationCoordinateSpaceId:
            entry.signature.destinationCoordinateSpaceId,
        }
      : null;
  }

  private matchesAnyOrigin(
    regions: SpatialRegion[] | undefined,
    position: SpatialPosition,
  ): boolean {
    return !regions || regions.length === 0
      ? true
      : regions.some((region) => this.contains(region, position));
  }

  private bestRegionMatch<
    T extends { region: SpatialRegion; signature: SpatialTransitionSignature },
  >(candidates: T[], position: SpatialPosition): T | null {
    return (
      candidates
        .filter(({ region }) => this.contains(region, position))
        .sort(
          (left, right) =>
            left.region.tolerance - right.region.tolerance ||
            left.signature.id.localeCompare(right.signature.id),
        )[0] ?? null
    );
  }

  private contains(region: SpatialRegion, position: SpatialPosition): boolean {
    return (
      planarWorldDisplacement(
        { x: region.centerX, y: region.centerY },
        position,
      ) <= region.tolerance
    );
  }
}
