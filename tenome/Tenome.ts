import {
  Options,
  Parameters,
  buildParameters,
  defaultOptions,
} from "./options";
import { cube, cylinder, sphere } from "../src/csg/primitives";
import { importModel, importShape } from "../src/csg/primitives";
import { Shape3 } from "../src/csg/base3";
import { Vec3 } from "../src/csg/base";
import { V3 } from "../src/math";
import { partition } from "./utils";
import { EliteCHolder } from "./EliteCHolder";
import { Insert } from "./Insert";
import { AccessoryHolder } from "./AccessoryHolder";
const { add, rotateX, rotateY, rotateZ } = V3;

type Posts = { tr: Shape3; tl: Shape3; br: Shape3; bl: Shape3 };
export class Tenome {
  readonly settings: { o: Options; p: Parameters };
  posts: { [key: string]: Posts };

  // key spacing opts
  readonly postSize = 0.1;
  // readonly postOffset = { x: this.postSize / 2, y: this.postSize / 2 };
  readonly sphereSize;
  readonly sphereQuality = 15;
  readonly postOffset: { x: number; y: number };
  readonly sphereOffset: { x: number; y: number };
  readonly thumbSphereOffset: { x: number; y: number };
  readonly thumbWallSphere: Shape3;
  readonly webRim: Shape3;
  readonly thumbSphere: Shape3;
  readonly webSphere: Shape3;
  readonly trackpadOffsetX = 2;
  readonly accessoryOrigin: Vec3;

  static getColumnOffsets(column: number): Vec3 {
    const offsets: Vec3[] = [
      [0, 0.55, 0], // index inner
      [0.3, 0.2, 0], // index
      [1, 3, -2.5], // middle
      [1.6, -1.5, -0.5], // ring
      [1.4, -12.5, 2], // pinky
    ];

    return offsets[Math.min(Math.max(column, 0), offsets.length - 1)];
  }

  static getColumnSplay(column: number): number {
    const splays = [
      -1, // inner index
      -0.5, // index
      0, // middle
      4, // ring
      8, // pinky
    ];
    return -splays[Math.min(Math.max(column, 0), splays.length - 1)];
  }

  constructor(o: Options) {
    this.settings = { o, p: buildParameters(o) };
    this.sphereSize = o.webThickness;
    const [x, y] = this.getKeyPosition(2, 2);
    this.accessoryOrigin = [x, y - 35.8, 0];

    // set up some reusable objects
    this.postOffset = { x: this.postSize / 2, y: this.postSize / 2 };
    this.sphereOffset = { x: o.caseSpacing, y: o.caseSpacing };
    this.thumbSphereOffset = { x: -o.caseSpacing - 1, y: -o.caseSpacing - 1 };
    this.webRim = sphere({
      d: this.sphereSize * 1.5,
      $fn: this.sphereQuality,
    }).translate([0, 0, this.sphereSize / -2 + o.webThickness - o.caseRimDrop]);

    this.thumbSphere = sphere({
      d: this.sphereSize * 1.5,
      $fn: this.sphereQuality,
    }).translate([0, 0, this.sphereSize / -2 + o.webThickness - o.caseRimDrop]);

    this.thumbWallSphere = sphere({
      d: this.sphereSize * 1.5,
      $fn: this.sphereQuality,
    }).translate([0, 0, this.sphereSize / -2 + o.webThickness]);

    this.webSphere = sphere({
      d: this.sphereSize,
      $fn: this.sphereQuality,
    })
      .union(
        sphere({
          d: this.sphereSize,
          $fn: this.sphereQuality,
        }).translate([
          0,
          0,
          -(this.settings.p.keyholeThickness - this.sphereSize),
        ])
      )
      .translate([0, 0, this.sphereSize / -2 + o.webThickness]);

    this.makePosts();
  }

  filledKeyhole(): Shape3 {
    const { o, p } = this.settings;
    return cube([p.mountWidth, p.mountHeight, o.webThickness]).translate([
      0,
      0,
      o.webThickness / 2,
    ]);
  }

  singleKeyhole(): Shape3 {
    const { o, p } = this.settings;
    let tabThickness = 1.32;
    let tabHeight = 1.5;
    switch (o.switchStyle) {
      case "mx":
        // tabThickness
        tabHeight = 2;
        return cube([p.mountWidth, p.mountHeight, p.keyholeThickness])
          .difference(
            cube([p.keyholeWidth, p.keyholeHeight, p.keyholeThickness + 1]),
            cube([4, p.keyholeHeight + 1.5, p.keyholeThickness]).translate([
              0, 0, -1.5,
            ])
          )
          .translate([0, 0, p.keyholeThickness / 2]);
      case "choc":
      default:
        return cube([p.mountWidth, p.mountHeight, p.keyholeThickness])
          .translate([0, 0, p.keyholeThickness / 2])
          .difference(
            cube([p.keyholeWidth, p.keyholeHeight, p.keyholeThickness + 4]),
            cube([
              p.keyholeWidth + tabThickness,
              p.keyholeHeight - 2,
              p.keyholeThickness,
            ])
            // cube([
            //   p.keyholeWidth - 2,
            //   p.keyholeHeight + tabThickness,
            //   p.keyholeThickness,
            // ])
          );
    }
  }

  singleKeycap(row: number) {
    const { o, p } = this.settings;
    return importModel(
      `../models/${o.keycapStyle}${o.keycapStyle === "sa" ? row + 1 : ""}.stl`
    ).translate([0, 0, o.keycapStyle === "choc" ? 4 : 6]);
  }

  // Placement
  keyPlace(column: number, row: number, shape: Shape3) {
    const { o, p } = this.settings;
    const columnAngle = p.curveRow * (o.centerColumn - column);

    return shape
      .translate([0, 0, -p.radiusRow])
      .rotate([p.curveColumn * (p.centreRow - row), 0, 0])
      .translate([0, 0, p.radiusRow - p.radiusColumn])
      .rotate([0, columnAngle, Tenome.getColumnSplay(column)])
      .translate([0, 0, p.radiusColumn])
      .translate(Tenome.getColumnOffsets(column))
      .rotate([0, o.tentingAngle, 0])
      .translate([0, 0, o.zOffset - (column > 2 && row >= o.rows ? 0.5 : 0)]);
  }

  positionRelativeToKey(column: number, row: number, shape: Shape3) {
    const { o, p } = this.settings;
    const columnAngle = p.curveRow * (o.centerColumn - column);

    return this.keyPlace(
      column,
      row,
      shape
        .rotate([-p.curveColumn * (p.centreRow - row), 0, 0])
        .rotate([0, -columnAngle, Tenome.getColumnSplay(column)])
        .rotate([0, -o.tentingAngle, 0])
    );
  }

  getKeyPosition(column: number, row: number, offset: Vec3 = [0, 0, 0]) {
    const { o, p } = this.settings;
    let position: Vec3 = offset;

    const columnAngle = p.curveRow * (o.centerColumn - column);
    position = rotateX(-p.curveColumn * (p.centreRow - row), position);
    position = rotateY(-columnAngle, position);
    position = rotateY(-o.tentingAngle, position);
    position = add(position, [0, 0, -p.radiusRow]);
    position = rotateX(p.curveColumn * (p.centreRow - row), position);
    position = add(position, [0, 0, p.radiusRow - p.radiusColumn]);
    position = rotateY(columnAngle, position);
    position = rotateZ(Tenome.getColumnSplay(column), position);
    position = add(position, [0, 0, p.radiusColumn]);
    position = add(position, Tenome.getColumnOffsets(column));
    position = rotateY(o.tentingAngle, position);
    position = add(position, [0, 0, o.zOffset]);

    return position;
  }

  placeKeys(shape: Shape3 | ((row: number) => Shape3)) {
    const { o, p } = this.settings;
    const keys = [];
    for (let i = 0; i < o.columns; i++) {
      for (let j = 0; j < o.rows; j++) {
        let key =
          typeof shape === "function"
            ? (shape(j) as Shape3)
            : (shape as Shape3);
        keys.push(this.keyPlace(i, j, key));
      }
    }

    const [firstKey, ...restKeys] = keys;
    return firstKey.union(...restKeys);
  }

  // Thumb keys
  placeThumb(rot: Vec3, move: Vec3, shape: Shape3) {
    const { o, p } = this.settings;
    return this.positionRelativeToKey(
      1,
      o.rows - 1,
      shape.rotate(rot).translate(move)
    )
      .translate(o.thumbOffsets)
      .translate([p.mountWidth / 2, -p.mountHeight / 2, 0]);
  }

  getThumbLPosition(offset: Vec3 = [0, 0, 0]): Vec3 {
    const { o } = this.settings;

    let position = offset;

    return add(
      position,
      o.switchSpacing === "choc" ? [-54, -26, -10] : [-53.5, -26, -10]
    );
  }

  thumbLPlace(shape: Shape3): Shape3 {
    const { o } = this.settings;

    return this.placeThumb(
      [
        o.switchSpacing === "choc" ? 8 : 3,
        o.switchSpacing === "choc" ? 0 : -8,
        o.switchSpacing === "choc" ? 33 : 30,
      ],
      this.getThumbLPosition(),
      shape
    );
  }

  getThumbRPosition(offset: Vec3 = [0, 0, 0]): Vec3 {
    const { o } = this.settings;

    let position = offset;

    return add(
      position,
      o.accessoryHolder ? [-5, -10.5, -5] : [-15, -10.3, -1]
    );
  }

  thumbRPlace(shape: Shape3): Shape3 {
    const { o, p } = this.settings;
    return this.placeThumb(
      o.accessoryHolder ? [0, 0, 5] : [11.5, -26, 10], // rotation
      this.getThumbRPosition(),
      shape
    );
  }

  thumbMPlace(shape: Shape3): Shape3 {
    const { o } = this.settings;

    return this.placeThumb(
      [
        o.switchSpacing === "choc" ? 9 : 3,
        o.switchSpacing === "choc" ? -12.5 : -3,
        23,
      ],
      [-34.8, -16.2, -7.8],
      shape
    );
  }

  placeThumbs(
    shape: Shape3 | ((row: number) => Shape3),
    ignoreRThumbWithAccessory: boolean = false
  ): Shape3 {
    const { o, p } = this.settings;
    let key =
      typeof shape === "function" ? (shape(2) as Shape3) : (shape as Shape3);
    return this.thumbLPlace(key).union(
      ...[
        this.thumbMPlace(key),
        ...((!o.accessoryHolder || !ignoreRThumbWithAccessory) && [
          this.thumbRPlace(key),
        ]),
      ]
    );
  }

  // Utility shapes
  buildWall(start: Shape3, end: Shape3) {
    const edge = start.hull(end);
    return edge
      .projection()
      .linear_extrude({ height: 1, center: false })
      .hull(edge);
  }

  getWebPost(
    pos: "TL" | "TR" | "BL" | "BR",
    shape: Shape3,
    offset: { x: number; y: number } = this.postOffset,
    zOffset: number = 0
  ) {
    const { o, p } = this.settings;
    const [y, x] = pos.split("");

    return shape.translate([
      x === "L" ? p.mountWidth / -2 + offset.x : p.mountWidth / 2 - offset.x,
      y === "T" ? p.mountHeight / 2 - offset.y : p.mountHeight / -2 + offset.y,
      p.keyholeThickness - o.webThickness + zOffset,
    ]);
  }

  getPosts(
    shape: Shape3,
    offset: { x: number; y: number } = this.postOffset
  ): Posts {
    return {
      tr: this.getWebPost("TR", shape, offset),
      tl: this.getWebPost("TL", shape, offset),
      br: this.getWebPost("BR", shape, offset),
      bl: this.getWebPost("BL", shape, offset),
    };
  }

  makePosts() {
    const { o, p } = this.settings;

    this.posts = {
      post: this.getPosts(this.webSphere),
      rim: this.getPosts(this.webRim, this.sphereOffset),
      thumb: this.getPosts(this.thumbSphere, this.thumbSphereOffset),
      thumbWall: this.getPosts(this.thumbWallSphere, this.thumbSphereOffset),
    };
  }

  // Main key connectors

  triangleHulls(...args: Shape3[]) {
    const validArgs = args.filter((value) => value !== null);
    const triGroups = partition<Shape3>(validArgs, 3, 1);
    const shapes: Shape3[] = [];
    triGroups.forEach(([first, ...rest]) => {
      shapes.push(first.hull(...rest)); // hull here
    });
    const [first, ...rest] = shapes;
    return first.union(...rest);
  }

  keyConnectors() {
    const { o, p } = this.settings;
    const connectors: Shape3[] = [];

    // rows
    for (let col = -1; col < o.columns; col++) {
      for (let row = 0; row < o.rows; row++) {
        connectors.push(
          this.triangleHulls(
            this.keyPlace(col + 1, row, this.posts.post.tl),
            this.keyPlace(col, row, this.posts.post.tr),
            this.keyPlace(col + 1, row, this.posts.post.bl),
            this.keyPlace(col, row, this.posts.post.br)
          )
        );
      }
    }

    // columns
    for (let col = 0; col < o.columns; col++) {
      for (let row = -1; row < o.rows; row++) {
        if (row == o.rows - 1 && col < 2) continue;
        connectors.push(
          this.triangleHulls(
            this.keyPlace(col, row, this.posts.post.bl),
            this.keyPlace(col, row, this.posts.post.br),
            this.keyPlace(col, row + 1, this.posts.post.tl),
            this.keyPlace(col, row + 1, this.posts.post.tr)
          )
        );
      }
    }

    // corners
    for (let col = -1; col < o.columns; col++) {
      for (let row = -1; row < o.rows; row++) {
        if (row == o.rows - 1 && col < (o.accessoryHolder ? 2 : 1)) continue;
        connectors.push(
          this.triangleHulls(
            this.keyPlace(col, row, this.posts.post.br),
            this.keyPlace(col, row + 1, this.posts.post.tr),
            this.keyPlace(col + 1, row, this.posts.post.bl),
            this.keyPlace(col + 1, row + 1, this.posts.post.tl)
          )
        );
      }
    }
    const [first, ...rest] = connectors;
    return first.union(...rest);
  }

  thumbConnectors = () => {
    const { o, p } = this.settings;
    const connectors = [];
    // between thumb keys
    connectors.push(
      this.triangleHulls(
        this.thumbMPlace(this.posts.post.tr),
        this.thumbMPlace(this.posts.post.br),
        this.thumbRPlace(this.posts.post.tl),
        this.thumbRPlace(this.posts.post.bl)
      ),
      this.triangleHulls(
        this.thumbLPlace(this.posts.post.tr),
        this.thumbLPlace(this.posts.post.br),
        this.thumbMPlace(this.posts.post.tl),
        this.thumbMPlace(this.posts.post.bl)
      )
    );

    // direct to main body
    // middle thumb to col 0u
    connectors.push(
      this.triangleHulls(
        this.keyPlace(-1, o.rows - 1, this.posts.post.br),
        this.keyPlace(-1, o.rows - 1, this.posts.rim.br),
        this.thumbLPlace(this.posts.thumbWall.tr)
      ),
      this.triangleHulls(
        this.thumbLPlace(this.posts.thumbWall.tr),
        this.keyPlace(-1, o.rows - 1, this.posts.post.br),
        this.thumbMPlace(this.posts.thumbWall.tr),
        this.keyPlace(0, o.rows - 1, this.posts.post.bl),
        this.keyPlace(0, o.rows - 1, this.posts.post.br)
      )
    );

    // right thumb
    connectors.push(
      this.triangleHulls(
        // this.thumbRPlace(this.posts.thumb.tr),
        this.keyPlace(0, o.rows - 1, this.posts.post.br),
        this.keyPlace(1, o.rows - 1, this.posts.post.bl),
        this.thumbMPlace(this.posts.thumbWall.tr)
      ),
      this.triangleHulls(
        this.thumbMPlace(this.posts.thumbWall.tr),
        this.thumbRPlace(this.posts.post.tr),
        this.keyPlace(1, o.rows - 1, this.posts.post.bl),
        this.keyPlace(1, o.rows - 1, this.posts.post.br)
      )
    );

    if (o.accessoryHolder) {
      connectors.push(
        this.triangleHulls(
          this.keyPlace(
            4,
            o.rows,
            this.getWebPost(
              "TL",
              this.webRim,
              { ...this.sphereOffset, x: -this.sphereOffset.x },
              -o.caseRimDrop
            )
          ),
          this.thumbRPlace(this.posts.thumb.br),
          this.keyPlace(4, o.rows, this.posts.post.tl),
          this.thumbRPlace(this.posts.post.tr)
        ),
        this.triangleHulls(
          this.keyPlace(4, o.rows, this.posts.post.tl),
          this.keyPlace(3, o.rows - 1, this.posts.post.br),
          this.thumbRPlace(this.posts.post.tr),
          this.keyPlace(3, o.rows - 1, this.posts.post.bl)
        )
      );
    } else {
      connectors.push(
        this.triangleHulls(
          this.keyPlace(
            3,
            o.rows,
            this.getWebPost(
              "TL",
              this.webRim,
              this.sphereOffset,
              -o.caseRimDrop
            )
          ),
          this.thumbRPlace(this.posts.thumb.br),
          this.keyPlace(3, o.rows, this.posts.post.tl),
          this.thumbRPlace(this.posts.post.tr)
        )
      );
    }

    connectors.push(
      this.triangleHulls(
        this.thumbRPlace(this.posts.post.tr),
        this.keyPlace(3, o.rows, this.posts.post.tl),
        this.keyPlace(1, o.rows - 1, this.posts.post.br),
        this.keyPlace(2, o.rows, this.posts.post.tr),
        this.keyPlace(2, o.rows, this.posts.post.tl)
      )
    );

    const [first, ...rest] = connectors;
    return first.union(...rest);
  };

  thumbRim() {
    const connectors = [];
    // between thumb keys
    connectors.push(
      this.triangleHulls(
        this.thumbRPlace(this.posts.post.tl),
        this.thumbRPlace(this.posts.post.tr),
        this.thumbMPlace(this.posts.thumbWall.tr)
      ),
      this.triangleHulls(
        this.thumbRPlace(this.posts.post.tl),
        this.thumbMPlace(this.posts.post.tr),
        this.thumbMPlace(this.posts.thumbWall.tr)
      ),
      this.triangleHulls(
        this.thumbLPlace(this.posts.thumbWall.tr),
        this.thumbMPlace(this.posts.post.tl),
        this.thumbMPlace(this.posts.thumbWall.tr),
        this.thumbMPlace(this.posts.post.tr)
      ),
      this.triangleHulls(
        this.thumbMPlace(this.posts.post.tl),
        this.thumbLPlace(this.posts.post.tr),
        this.thumbLPlace(this.posts.thumbWall.tr)
      ),
      this.triangleHulls(
        this.thumbLPlace(this.posts.thumb.tl),
        this.thumbLPlace(this.posts.post.tl),
        this.thumbLPlace(this.posts.thumbWall.tr),
        this.thumbLPlace(this.posts.post.tr)
      ),
      this.triangleHulls(
        this.thumbLPlace(this.posts.post.tl),
        this.thumbLPlace(this.posts.post.bl),
        this.thumbLPlace(this.posts.thumb.tl),
        this.thumbLPlace(this.posts.thumb.bl)
      ),
      this.triangleHulls(
        this.thumbLPlace(this.posts.post.br),
        this.thumbLPlace(this.posts.post.bl),
        this.thumbLPlace(this.posts.thumb.br),
        this.thumbLPlace(this.posts.thumb.bl)
      ),
      this.triangleHulls(
        this.thumbLPlace(this.posts.post.br),
        this.thumbMPlace(this.posts.post.bl),
        this.thumbLPlace(this.posts.thumb.br)
      ),
      this.triangleHulls(
        this.thumbMPlace(this.posts.post.bl),
        this.thumbLPlace(this.posts.thumb.br),
        this.thumbMPlace(this.posts.post.br),
        this.thumbMPlace(this.posts.thumb.br)
      ),
      this.triangleHulls(
        this.thumbMPlace(this.posts.post.br),
        this.thumbRPlace(this.posts.post.bl),
        this.thumbMPlace(this.posts.thumb.br)
      ),
      this.triangleHulls(
        this.thumbRPlace(this.posts.post.bl),
        this.thumbMPlace(this.posts.thumb.br),
        this.thumbRPlace(this.posts.post.br),
        this.thumbRPlace(this.posts.thumb.br)
      ),
      this.triangleHulls(
        this.thumbRPlace(this.posts.post.tr),
        this.thumbRPlace(this.posts.post.br),
        this.thumbRPlace(this.posts.thumb.br)
      )
    );

    const [first, ...rest] = connectors;
    return first.union(...rest);
  }

  thumbWalls() {
    const { o, p } = this.settings;
    const walls = [];
    walls.push(
      this.buildWall(
        this.thumbLPlace(this.posts.thumbWall.tr),
        this.thumbLPlace(this.posts.thumb.tl)
      ),
      this.buildWall(
        this.thumbLPlace(this.posts.thumb.tl),
        this.thumbLPlace(this.posts.thumb.bl)
      ),
      this.buildWall(
        this.thumbLPlace(this.posts.thumb.bl),
        this.thumbLPlace(this.posts.thumb.br)
      ),
      this.buildWall(
        this.thumbLPlace(this.posts.thumb.br),
        this.thumbMPlace(this.posts.thumb.br)
      ),
      this.buildWall(
        this.thumbMPlace(this.posts.thumb.br),
        this.thumbRPlace(this.posts.thumb.br)
      )
    );
    if (o.accessoryHolder) {
      walls.push(
        this.buildWall(
          this.thumbRPlace(this.posts.thumb.br),
          this.keyPlace(
            4,
            o.rows,
            this.getWebPost(
              "TL",
              this.webRim,
              { ...this.sphereOffset, x: -this.sphereOffset.x },
              -o.caseRimDrop
            )
          )
        )
      );
    } else {
      walls.push(
        this.buildWall(
          this.thumbRPlace(this.posts.thumb.br),
          this.keyPlace(
            3,
            o.rows,
            this.getWebPost(
              "TL",
              this.webRim,
              this.sphereOffset,
              -o.caseRimDrop
            )
          )
        )
      );
    }

    const [first, ...rest] = walls;
    return first.union(...rest);
  }

  // Rims & Walls
  leftRim() {
    const { o, p } = this.settings;

    const rimHulls = [];
    for (let row = -1; row < o.rows; row++) {
      if (row < o.rows - 1) {
        rimHulls.push(
          this.triangleHulls(
            this.keyPlace(-1, row, this.posts.rim.br),
            row < o.rows - 1
              ? this.keyPlace(-1, row + 1, this.posts.rim.tr)
              : null,
            this.keyPlace(-1, row, this.posts.post.br),
            this.keyPlace(-1, row + 1, this.posts.post.tr)
          )
        );
      }
      if (row >= 0) {
        rimHulls.push(
          this.triangleHulls(
            this.keyPlace(-1, row, this.posts.post.tr),
            this.keyPlace(-1, row, this.posts.rim.tr),
            this.keyPlace(-1, row, this.posts.post.br),
            this.keyPlace(-1, row, this.posts.rim.br)
          )
        );
      }
    }

    const [first, ...rest] = rimHulls;
    return first.union(...rest);
  }

  leftWall() {
    const { o, p } = this.settings;

    const walls = [];
    for (let row = -1; row < o.rows; row++) {
      if (row < o.rows - 1) {
        walls.push(
          this.buildWall(
            this.keyPlace(-1, row, this.posts.rim.br),
            this.keyPlace(-1, row + 1, this.posts.rim.tr)
          )
        );
      }
      if (row >= 0) {
        walls.push(
          this.buildWall(
            this.keyPlace(-1, row, this.posts.rim.tr),
            this.keyPlace(-1, row, this.posts.rim.br)
          )
        );
      }
    }

    // thumb to left wall extra wall panel
    walls.push(
      this.buildWall(
        this.thumbLPlace(this.posts.thumbWall.tr),
        this.keyPlace(-1, o.rows - 1, this.posts.rim.br)
      )
    );

    const [first, ...rest] = walls;
    return first.union(...rest);
  }

  topRim() {
    const { o, p } = this.settings;
    const rimHulls = [];

    let pOffset = 0;
    let pDiff = 0;
    for (let col = -1; col < o.columns; col++) {
      const offset = Tenome.getColumnOffsets(col + 1)[2];
      const diff = offset - pOffset;
      const sphX = this.sphereOffset.x;

      const xR = Math.abs(diff) !== 0 ? (diff < 0 ? -sphX : sphX) : sphX;
      const xL = Math.abs(diff) !== 0 ? (diff > 0 ? -sphX : sphX) : sphX;
      const pR = Math.abs(pDiff) !== 0 ? (pDiff < 0 ? -sphX : sphX) : sphX;
      const pL = Math.abs(pDiff) !== 0 ? (pDiff > 0 ? -sphX : sphX) : sphX;

      const offsetR = { ...this.sphereOffset, x: xR };
      const offsetL = { ...this.sphereOffset, x: xL };
      const pOffsetR = { ...this.sphereOffset, x: pR };

      rimHulls.push(
        this.triangleHulls(
          this.keyPlace(col, -1, this.getWebPost("BR", this.webRim, offsetL)),
          this.keyPlace(col, -1, this.posts.post.br),
          this.keyPlace(
            col + 1,
            -1,
            this.getWebPost("BL", this.webRim, offsetR)
          ),
          this.keyPlace(col + 1, -1, this.posts.post.bl)
        )
      );
      if (col >= 0) {
        rimHulls.push(
          this.triangleHulls(
            this.keyPlace(
              col,
              -1,
              this.getWebPost("BL", this.webRim, pOffsetR)
            ),
            this.keyPlace(col, -1, this.getWebPost("BR", this.webRim, offsetL)),
            this.keyPlace(col, -1, this.posts.post.bl),
            this.keyPlace(col, -1, this.posts.post.br)
          )
        );
      }
      pOffset = offset;
      pDiff = diff;
    }

    const [first, ...rest] = rimHulls;
    return first.union(...rest);
  }

  topWall() {
    const { o, p } = this.settings;
    const walls = [];

    let pOffset = 0;
    let pDiff = 0;
    for (let col = -1; col < o.columns; col++) {
      const offset = Tenome.getColumnOffsets(col + 1)[2];
      const diff = offset - pOffset;
      const sphX = this.sphereOffset.x;

      const xR = Math.abs(diff) !== 0 ? (diff < 0 ? -sphX : sphX) : sphX;
      const xL = Math.abs(diff) !== 0 ? (diff > 0 ? -sphX : sphX) : sphX;
      const pR = Math.abs(pDiff) !== 0 ? (pDiff < 0 ? -sphX : sphX) : sphX;
      const pL = Math.abs(pDiff) !== 0 ? (pDiff > 0 ? -sphX : sphX) : sphX;

      const offsetR = { ...this.sphereOffset, x: xR };
      const offsetL = { ...this.sphereOffset, x: xL };
      const pOffsetR = { ...this.sphereOffset, x: pR };

      walls.push(
        this.buildWall(
          this.keyPlace(col, -1, this.getWebPost("BR", this.webRim, offsetL)),
          this.keyPlace(
            col + 1,
            -1,
            this.getWebPost("BL", this.webRim, offsetR)
          )
        )
      );
      if (col >= 0) {
        walls.push(
          this.buildWall(
            this.keyPlace(
              col,
              -1,
              this.getWebPost("BL", this.webRim, pOffsetR)
            ),
            this.keyPlace(col, -1, this.getWebPost("BR", this.webRim, offsetL))
          )
        );
      }
      pOffset = offset;
      pDiff = diff;
    }

    const [first, ...rest] = walls;
    return first.union(...rest);
  }

  rightRim() {
    const { o, p } = this.settings;
    const rimHulls = [];
    for (let row = -1; row < o.rows; row++) {
      rimHulls.push(
        this.triangleHulls(
          this.keyPlace(o.columns, row, this.posts.rim.bl),
          this.keyPlace(
            o.columns,
            row + 1,
            this.getWebPost(
              "TL",
              this.webRim,
              this.sphereOffset,
              row === o.rows - 1 ? -o.caseRimDrop : 0
            )
          ),
          this.keyPlace(o.columns, row, this.posts.post.bl),
          this.keyPlace(o.columns, row + 1, this.posts.post.tl)
        )
      );
      if (row >= 0) {
        rimHulls.push(
          this.triangleHulls(
            this.keyPlace(o.columns, row, this.posts.post.tl),
            this.keyPlace(o.columns, row, this.posts.rim.tl),
            this.keyPlace(o.columns, row, this.posts.post.bl),
            this.keyPlace(o.columns, row, this.posts.rim.bl)
          )
        );
      }
    }

    const [first, ...rest] = rimHulls;
    return first.union(...rest);
  }

  rightWall() {
    const { o, p } = this.settings;
    const walls = [];
    for (let row = -1; row < o.rows; row++) {
      walls.push(
        this.buildWall(
          this.keyPlace(o.columns, row, this.posts.rim.bl),
          this.keyPlace(
            o.columns,
            row + 1,
            this.getWebPost(
              "TL",
              this.webRim,
              this.sphereOffset,
              row === o.rows - 1 ? -o.caseRimDrop : 0
            )
          )
        )
      );
      if (row >= 0) {
        walls.push(
          this.buildWall(
            this.keyPlace(o.columns, row, this.posts.rim.bl),
            this.keyPlace(o.columns, row, this.posts.rim.tl)
          )
        );
      }
    }

    const [first, ...rest] = walls;
    return first.union(...rest);
  }

  bottomRim() {
    const { o, p } = this.settings;
    const rimHulls = [];

    let pOffset = 0;
    let pDiff = 0;
    const sphX = this.sphereOffset.x;

    for (let col = o.columns - 1; col >= (o.accessoryHolder ? 4 : 3); col--) {
      const offset = Tenome.getColumnOffsets(col)[2];
      const diff = offset - pOffset;
      const nDiff = Tenome.getColumnOffsets(col - 1)[2] - offset;

      const xR = Math.abs(diff) !== 0 ? (diff > 0 ? -sphX : sphX) : sphX;
      const xL = Math.abs(diff) !== 0 ? (diff < 0 ? -sphX : sphX) : sphX;
      const pR =
        col === 3
          ? sphX
          : Math.abs(pDiff) !== 0
          ? pDiff < 0
            ? -sphX
            : sphX
          : -sphX;
      const pL =
        col === 3
          ? sphX
          : Math.abs(nDiff) !== 0
          ? nDiff > 0
            ? sphX
            : -sphX
          : -sphX;

      const offsetR = { ...this.sphereOffset, x: xR };
      const offsetL = { ...this.sphereOffset, x: xL };
      const pOffsetR = { ...this.sphereOffset, x: pR };
      const pOffsetL = { ...this.sphereOffset, x: pL };

      rimHulls.push(
        this.triangleHulls(
          this.keyPlace(
            col,
            o.rows,
            this.getWebPost("TR", this.webRim, offsetR, -o.caseRimDrop)
          ),
          this.keyPlace(col, o.rows, this.posts.post.tr),
          this.keyPlace(
            col + 1,
            o.rows,
            this.getWebPost("TL", this.webRim, offsetL, -o.caseRimDrop)
          ),
          this.keyPlace(col + 1, o.rows, this.posts.post.tl)
        )
      );
      if (col >= 0) {
        rimHulls.push(
          this.triangleHulls(
            this.keyPlace(
              col,
              o.rows,
              this.getWebPost("TL", this.webRim, pOffsetL, -o.caseRimDrop)
            ),
            this.keyPlace(
              col,
              o.rows,
              this.getWebPost("TR", this.webRim, pOffsetR, -o.caseRimDrop)
            ),
            this.keyPlace(col, o.rows, this.posts.post.tl),
            this.keyPlace(col, o.rows, this.posts.post.tr)
          )
        );
      }
      pOffset = offset;
      pDiff = diff;
    }

    const [first, ...rest] = rimHulls;
    return first.union(...rest);
  }

  bottomWall() {
    const { o, p } = this.settings;
    const walls = [];

    let pOffset = 0;
    let pDiff = 0;

    const sphX = this.sphereOffset.x;

    for (let col = o.columns - 1; col >= (o.accessoryHolder ? 4 : 3); col--) {
      const offset = Tenome.getColumnOffsets(col)[2];
      const diff = offset - pOffset;
      const nDiff = Tenome.getColumnOffsets(col - 1)[2] - offset;

      const xR = Math.abs(diff) !== 0 ? (diff > 0 ? -sphX : sphX) : sphX;
      const xL = Math.abs(diff) !== 0 ? (diff < 0 ? -sphX : sphX) : sphX;
      const pR =
        col === 3
          ? sphX
          : Math.abs(pDiff) !== 0
          ? pDiff < 0
            ? -sphX
            : sphX
          : -sphX;
      const pL =
        col === 3
          ? sphX
          : Math.abs(nDiff) !== 0
          ? nDiff > 0
            ? sphX
            : -sphX
          : -sphX;

      const offsetR = { ...this.sphereOffset, x: xR };
      const offsetL = { ...this.sphereOffset, x: xL };
      const pOffsetR = { ...this.sphereOffset, x: pR };
      const pOffsetL = { ...this.sphereOffset, x: pL };

      walls.push(
        this.buildWall(
          this.keyPlace(
            col,
            o.rows,
            this.getWebPost("TR", this.webRim, offsetR, -o.caseRimDrop)
          ),
          this.keyPlace(
            col + 1,
            o.rows,
            this.getWebPost("TL", this.webRim, offsetL, -o.caseRimDrop)
          )
        )
      );
      if (col >= 0) {
        walls.push(
          this.buildWall(
            this.keyPlace(
              col,
              o.rows,
              this.getWebPost("TL", this.webRim, pOffsetL, -o.caseRimDrop)
            ),
            this.keyPlace(
              col,
              o.rows,
              this.getWebPost("TR", this.webRim, pOffsetR, -o.caseRimDrop)
            )
          )
        );
      }
      pOffset = offset;
      pDiff = diff;
    }

    const [first, ...rest] = walls;
    return first.union(...rest);
  }

  caseWalls() {
    return this.leftWall().union(
      this.topWall(),
      this.rightWall(),
      this.bottomWall(),
      this.thumbWalls()
    );
  }

  caseRim = () => {
    return this.leftRim().union(
      this.topRim(),
      this.rightRim(),
      this.bottomRim(),
      this.thumbRim()
    );
  };

  USBHolderPosition() {
    const { o, p } = this.settings;
    let pos;
    pos = this.getKeyPosition(0, 0, [
      -(p.mountWidth / 2) - 1,
      p.mountHeight / 2 + (o.switchStyle === "mx" ? 1.3 : 0),
      0,
    ]);
    pos = V3.add(pos, [4, 3.5, 0]);
    return pos;
  }

  readonly TRSCutPos = [-9.5, -6.3, 8] as Vec3;

  USBHolder() {
    const { o, p } = this.settings;
    const [x, y] = this.USBHolderPosition();
    let mcu;
    const holder = new EliteCHolder(o);
    mcu = holder.assembled();

    return mcu

      .rotate([0, 0, (Tenome.getColumnSplay(0) + Tenome.getColumnSplay(1)) / 2])
      .translate([x, y, 0]);
  }

  USBHolderSpace() {
    const { o, p } = this.settings;
    const [x, y] = this.USBHolderPosition();
    const holder = new EliteCHolder(o);
    return holder.cutaway().translate([x, y, 0]);
  }

  previewKeycaps() {
    return this.placeKeys((row: number) => this.singleKeycap(row))
      .color("grey")
      .union(this.placeThumbs((row: number) => this.singleKeycap(row), true))
      .color("grey");
  }

  previewTrackpad() {
    const { o, p } = this.settings;
    const [x, y] = this.accessoryOrigin;
    return cylinder({ d: 43.9, h: 2, $fn: 70 })
      .translate([x, y, 25])
      .color("#222222");
  }

  previewTrackball() {
    const { o, p } = this.settings;
    const [x, y] = this.accessoryOrigin;
    return sphere({ d: 34, $fn: 120 }).translate([x, y, 23]).color("#222222");
  }

  previewEncoder() {
    return this.thumbRPlace(importModel("../models/encoder.stl"))
      .translate([0, 0, 3])
      .color("#222222");
  }

  preview() {
    const { o, p } = this.settings;
    const holder = new AccessoryHolder();
    const [x, y] = this.accessoryOrigin;

    return this.previewKeycaps().union(
      ...[
        ...(o.accessoryHolder && [
          this.previewTrackpad(),
          holder.spacer().translate([x, y, 0]).color("#222222"),
        ]),
      ]
    );
  }

  accessoryInset() {
    const { o, p } = this.settings;
    const holder = new AccessoryHolder();
    return holder.bodyCutaway().translate(this.accessoryOrigin);
  }

  accessoryHolder(mirror: boolean = false) {
    const holder = new AccessoryHolder();
    return holder.main().translate(this.accessoryOrigin);
  }

  // inserts
  getInsertPositions(): { pos: Vec3; rotation: number }[] {
    const { o, p } = this.settings;
    return [
      (() => {
        // top center
        const [x, y] = this.getKeyPosition(2, 0, [5, p.mountHeight / 2, 0]);
        return { pos: [x, y, 0] as Vec3, rotation: 0 };
      })(),
      (() => {
        // front right
        if (o.accessoryHolder) {
          const [x, y] = this.getKeyPosition(4, o.rows - 1, [
            -p.mountWidth / 2 - 1,
            2 - p.mountHeight / 2,
            0,
          ]);
          return {
            pos: [x, y, 0] as Vec3,
            rotation: o.trackballCutoutInPlate ? 200 : 188,
          };
        } else {
          const [x, y] = this.getKeyPosition(3, o.rows - 1, [
            p.mountWidth / 2 - 2,
            -2 - p.mountHeight / 2,
            0,
          ]);
          return { pos: [x, y, 0] as Vec3, rotation: 120 };
        }
      })(),
      (() => {
        // front left
        const [x, y] = this.getKeyPosition(0, o.rows - 1, [
          -6,
          -8 - p.mountHeight / 2,
          0,
        ]);
        return { pos: [x, y, 0] as Vec3, rotation: 70 };
      })(),
      (() => {
        // back right
        const [x, y] = this.getKeyPosition(4, 0, [
          -2 - p.mountWidth / 2,
          2 + p.mountHeight / 2,
          0,
        ]);
        return { pos: [x, y, 0] as Vec3, rotation: -45 };
      })(),
    ];
  }

  // feet
  getFeetPositions(): { pos: Vec3 }[] {
    const { o, p } = this.settings;
    return [
      (() => {
        // top left
        const [x, y] = this.getKeyPosition(0, 0, [
          -p.mountWidth / 2 - 1 + o.feetDiameter / 2,
          p.mountHeight / 2 + 5 - o.feetDiameter / 2,
          0,
        ]);
        return { pos: [x, y, 0] as Vec3 };
      })(),
      (() => {
        // top center
        const [x, y] = this.getKeyPosition(3, 0, [
          p.mountWidth / 2 - 3 + o.feetDiameter / 2,
          p.mountHeight / 2 + 7 - o.feetDiameter / 2,
          0,
        ]);
        return { pos: [x, y, 0] as Vec3 };
      })(),
      (() => {
        // top right
        const [x, y] = this.getKeyPosition(o.columns - 1, 0, [
          p.mountWidth / 2 - 3 + o.feetDiameter / 2,
          p.mountHeight / 2 + 6.5 - o.feetDiameter / 2,
          0,
        ]);
        return { pos: [x, y, 0] as Vec3 };
      })(),
      (() => {
        // bottom right
        const [x, y] = this.getKeyPosition(o.columns - 1, o.rows - 1, [
          p.mountWidth / 2 - 3.5 + o.feetDiameter / 2,
          -p.mountHeight / 2 - 6 + o.feetDiameter / 2,
          0,
        ]);
        return { pos: [x, y, 0] as Vec3 };
      })(),
      (() => {
        // bottom centre
        if (o.accessoryHolder) {
          const [x, y] = this.accessoryOrigin;
          return {
            pos: o.trackballCutoutInPlate
              ? ([x - 28, y - 2, 0] as Vec3)
              : ([x, y - 19.5, 0] as Vec3),
          };
        } else {
          const [x, y] = add(
            add(this.getKeyPosition(1, o.rows - 1), o.thumbOffsets),
            this.getThumbRPosition([
              p.mountWidth / 2 + 14 - o.feetDiameter / 2,
              -p.mountHeight / 2 - 10 + o.feetDiameter / 2,
              0,
            ])
          );
          return { pos: [x, y, 0] as Vec3 };
        }
      })(),
      (() => {
        // bottom left (thumb)
        const [x, y] = add(
          add(this.getKeyPosition(1, o.rows - 1), o.thumbOffsets),
          this.getThumbLPosition([
            8,
            -p.mountHeight / 2 - 17 + o.feetDiameter / 2,
            0,
          ])
        );
        return { pos: [x, y, 0] as Vec3 };
      })(),
    ];
  }

  inserts() {
    const { o, p } = this.settings;
    const [x, y] = this.USBHolderPosition();
    const holder = new EliteCHolder(o);

    const [first, ...rest] = this.getInsertPositions().map(
      ({ pos, rotation }) =>
        Insert.getInsert(
          o,
          "case",
          [pos[0], pos[1], o.insertDepth / 2],
          rotation
        )
    );

    const inserts = first.union(...rest, holder.inserts().translate([x, y, 0]));
    return inserts
      .intersection(
        this.outline()
          .projection()
          .offset({ delta: -1 })
          .linear_extrude({ height: 50 })
      )
      .difference(this.USBHolderSpace(), this.accessoryInset());
  }

  screwholeOuters() {
    const { o, p } = this.settings;

    const [first, ...rest] = this.getInsertPositions().map(
      ({ pos, rotation }) =>
        Insert.getInsert(o, "outer", pos, rotation, o.plateThickness)
    );

    const inserts = first.union(...rest);
    return inserts
      .intersection(
        this.outline()
          .projection()
          .offset({ delta: -1 })
          .linear_extrude({ height: 50 })
      )
      .translate([0, 0, o.plateThickness / 2]);
  }

  screwholes() {
    const { o, p } = this.settings;

    const [first, ...rest] = this.getInsertPositions().map(
      ({ pos, rotation }) => Insert.getInsert(o, "screwhole", pos, rotation)
    );

    const inserts = first.union(...rest);
    return inserts;
  }

  feetOuters(trackball = false) {
    const { o } = this.settings;

    const [first, ...rest] = this.getFeetPositions().map(({ pos }) =>
      Insert.getInsert(o, "foot-outer", pos, 0, o.plateThickness)
    );

    return first.union(...rest);
  }

  feetInsets(trackball = false) {
    const { o } = this.settings;

    const [first, ...rest] = this.getFeetPositions().map(({ pos }) =>
      Insert.getInsert(o, "foot-inset", pos, 0, o.feetInsetDepth)
    );

    return first.union(...rest);
  }

  buildCase(keyhole: Shape3, mirror: boolean = false) {
    const { o, p } = this.settings;
    const models = [];
    if (o.accessoryHolder) {
      models.push(this.accessoryHolder(mirror));
    }
    return this.placeKeys(keyhole)
      .union(
        this.keyConnectors(),
        this.caseWalls().difference(this.USBHolderSpace()),
        this.caseRim(),
        this.placeThumbs(keyhole),
        this.thumbConnectors(),
        this.inserts()
      )
      .difference(...[...(o.accessoryHolder && [this.accessoryInset()])])
      .union(...models);
  }

  outline() {
    const { o, p } = this.settings;
    const models = [];
    if (o.accessoryHolder) {
      const holder = new AccessoryHolder();
      models.push(holder.outline().translate(this.accessoryOrigin));
    }
    return this.placeKeys(this.filledKeyhole()).union(
      this.keyConnectors(),
      this.caseWalls().difference(this.USBHolderSpace()),
      this.caseRim(),
      this.placeThumbs(this.filledKeyhole()),
      ...models,
      this.thumbConnectors()
    );
  }

  buildPlate() {
    const { o, p } = this.settings;
    const shape = this.outline().projection();
    let plate: Shape3 = shape
      .difference(
        shape
          .offset({ r: -4 })
          .difference(
            importShape("../models/voronoi.dxf")
              .scale([0.25, 0.25, 1])
              .translate([-164, -77, 0])
          )
      )
      .linear_extrude({ height: o.plateThickness, center: false });
    // .union(this.screwholeOuters(true), this.feetOuters())
    // .difference(this.screwholes(), this.feetInsets());

    if (o.accessoryHolder && o.trackballCutoutInPlate) {
      const holder = new AccessoryHolder();
      const [x, y] = this.accessoryOrigin;
      const ring = holder.trackballBodyCutaway().projection();

      plate = plate
        .difference(holder.trackballCutaway().translate([x, y, -3]))
        .union(
          ring
            // .difference(ring.offset({ r: -4 }))
            .linear_extrude({ height: o.plateThickness, center: false })
            .difference(holder.trackballCutaway())
            .translate([x, y, 0])
        );
    }

    plate = plate
      .union(this.screwholeOuters(), this.feetOuters())
      .difference(this.screwholes(), this.feetInsets());

    return plate;
  }
}

const tenome = new Tenome({
  ...defaultOptions,
  accessoryHolder: true,
});

// export const main = tenome
//   .placeThumbs(tenome.singleKeyhole())
//   .union(tenome.thumbConnectors(), tenome.thumbRim(), tenome.leftWall());
export const main = tenome.buildCase(tenome.singleKeyhole());
// export const main = tenome
//   .placeKeys(tenome.singleKeyhole())
//   .union(tenome.placeThumbs(tenome.singleKeyhole()));
// .union(tenome.USBHolder().debug());
