import area from "../public/tehran-area.json";

export type Point = [number, number];
export const tehranArea = area;
export const tehranBounds: [Point, Point] = [
  [area.properties.bbox[1], area.properties.bbox[0]],
  [area.properties.bbox[3], area.properties.bbox[2]],
];

function inRing([y, x]: Point, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (
      Math.abs(cross) < 1e-12 &&
      x >= Math.min(ax, bx) &&
      x <= Math.max(ax, bx) &&
      y >= Math.min(ay, by) &&
      y <= Math.max(ay, by)
    )
      return true;
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
      inside = !inside;
  }
  return inside;
}

export function inTehran(point: Point): boolean {
  if (!point.every(Number.isFinite)) return false;
  const [outer, ...holes] = area.geometry.coordinates;
  return inRing(point, outer) && !holes.some((ring) => inRing(point, ring));
}
