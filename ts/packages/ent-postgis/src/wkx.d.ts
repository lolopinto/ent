declare module "wkx" {
  export class Geometry {
    static parse(value: string | Buffer): Geometry;
    toGeoJSON(): unknown;
  }

  export class Point extends Geometry {
    constructor(
      x: number,
      y: number,
      z?: number,
      m?: number,
      srid?: number,
    );

    x: number;
    y: number;
    srid?: number;

    toEwkb(): Buffer;
  }
}
