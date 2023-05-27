import { circle, square, polygon } from "../src/csg/primitives";
import { cube, cylinder, sphere, polyhedron } from "../src/csg/primitives";
import { hole } from "./utils";
import { polyRound } from "../src/csg/polyround";
import { buildOptions, options as o, parameters as p } from "./options";
import {
  buildCase,
  singleKeyhole,
  buildPlate,
  init,
  USBHolder,
  previewKeycaps,
  previewTrackpad,
  previewEncoder,
} from "./sphynx";

init({ encoder: true, trackpad: false });

export const main = buildCase(singleKeyhole(), true)
  .color("SlateGray")
  .union(
    ...[
      buildPlate().translate([0, 0, -o.plateThickness]).color("Silver"),
      USBHolder().color("Azure"),
      previewKeycaps(),
      ...(o.trackpad && [previewTrackpad()]),
      ...(o.encoder && [previewEncoder()]),
    ]
  )
  .mirror([1, 0, 0]);
