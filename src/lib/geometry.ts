import { z } from "zod";
import { isoDate, sourceReferenceSchema } from "./schemas";

const positionSchema = z.tuple([z.number(), z.number()]);
export const verifiedGeometrySchema = z.object({
  schema_version: z.literal(1),
  district_number: z.number().int().min(1).max(225),
  verified_on: isoDate,
  source: sourceReferenceSchema,
  polygon: z.array(positionSchema).min(4),
});

export const verifiedGeometryRegistrySchema = z.object({
  schema_version: z.literal(1),
  as_of: isoDate,
  geometries: z.array(verifiedGeometrySchema),
});

export type Point = readonly [number, number];
export type VerifiedGeometry = z.infer<typeof verifiedGeometrySchema>;

function pointOnSegment([x, y]: Point, [ax, ay]: Point, [bx, by]: Point) {
  const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
  if (Math.abs(cross) > 1e-10) return false;
  const dot = (x - ax) * (x - bx) + (y - ay) * (y - by);
  return dot <= 1e-10;
}

export function pointInPolygon(point: Point, polygon: Point[]): "inside" | "outside" | "boundary" {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (pointOnSegment(point, previousPoint, currentPoint)) return "boundary";
    const [x, y] = point;
    const [xi, yi] = currentPoint;
    const [xj, yj] = previousPoint;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? "inside" : "outside";
}

export function matchVerifiedDistrict(point: Point, geometries: VerifiedGeometry[]) {
  const matches = geometries.map((geometry) => ({ districtNumber: geometry.district_number, relation: pointInPolygon(point, geometry.polygon) })).filter((match) => match.relation !== "outside");
  const exact = matches.length === 1 && matches[0].relation === "inside" ? matches[0].districtNumber : null;
  return { exact, matches };
}
