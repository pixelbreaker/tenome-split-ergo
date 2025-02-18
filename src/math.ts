import { multiply, matrix } from "mathjs";
// some basic vector maths

type Vec3 = [number, number, number];
type Vec2 = [number, number];

export const V3 = {
  add: ([a, b, c]: Vec3, [x, y, z]: Vec3) => [a + x, b + y, c + z] as Vec3,
  minus: ([a, b, c]: Vec3, [x, y, z]: Vec3) => [a - x, b - y, c - z] as Vec3,
  times: ([a, b, c]: Vec3, [x, y, z]: Vec3) => [a * x, b * y, c * z] as Vec3,
  divide: ([a, b, c]: Vec3, [x, y, z]: Vec3) => [a / x, b / y, c / z] as Vec3,
  dot: ([a, b, c]: Vec3, [x, y, z]: Vec3) => a * x + b * y + c * z,
  scale: (a: number, [x, y, z]: Vec3) => [a * x, a * y, a * z] as Vec3,
  length: ([a, b, c]: Vec3) => Math.sqrt(a * a + b * b + c * c),
  normalize: (a: Vec3) => V3.scale(1 / V3.length(a), a),
  cross: ([a, b, c]: Vec3, [x, y, z]: Vec3) =>
    [b * z - c * y, c * x - a * z, a * y - b * x] as Vec3,
  rotateX: (angle: number, a: Vec3) => {
    const rad = deg2rad(angle);
    return multiply(
      [
        [1, 0, 0],
        [0, Math.cos(rad), -Math.sin(rad)],
        [0, -Math.sin(rad), Math.cos(rad)],
      ],
      matrix(a)
    ).toArray() as Vec3;
  },
  rotateY: (angle: number, a: Vec3) => {
    const rad = deg2rad(angle);
    return multiply(
      [
        [Math.cos(rad), 0, Math.sin(rad)],
        [0, 1, 0],
        [-Math.sin(rad), 0, Math.cos(rad)],
      ],
      matrix(a)
    ).toArray() as Vec3;
  },
  rotateZ: (angle: number, a: Vec3) => {
    const rad = deg2rad(angle);
    return multiply(
      [
        [Math.cos(rad), -Math.sin(rad), 0],
        [Math.sin(rad), Math.cos(rad), 0],
        [0, 0, 1],
      ],
      matrix(a)
    ).toArray() as Vec3;
  },
};

export const V2 = {
  add: ([a, b]: Vec2, [x, y]: Vec2) => [a + x, b + y] as Vec2,
  minus: ([a, b]: Vec2, [x, y]: Vec2) => [a - x, b - y] as Vec2,
  times: ([a, b]: Vec2, [x, y]: Vec2) => [a * x, b * y] as Vec2,
  divide: ([a, b]: Vec2, [x, y]: Vec2) => [a / x, b / y] as Vec2,
  dot: ([a, b]: Vec2, [x, y]: Vec2) => a * x + b * y,
  scale: (a: number, [x, y]: Vec2) => [a * x, a * y] as Vec2,
  length: ([a, b]: Vec2) => Math.sqrt(a * a + b * b),
  normalize: (a: Vec2) => V2.scale(1 / V2.length(a), a),
  cross: ([a, b]: Vec2, [x, y]: Vec2) => a * y - b * x,
};

export const deg2rad = (degrees: number) => (degrees / 180) * Math.PI;
