import {
  GeographyPointType,
  GeometryPointType,
  PostGISExtension,
  dWithin,
  distance,
  geoPoint,
  orderByDistance,
  parsePostGISValue,
  postgisRuntimeHandler,
  selectDistance,
  toEWKT,
} from "./postgis";

describe("PostGIS extension helper", () => {
  test("uses public as the default runtime schema", () => {
    expect(PostGISExtension()).toEqual({
      name: "postgis",
      managed: true,
      runtimeSchemas: ["public"],
      dropCascade: false,
    });
  });

  test("can be marked as externally provisioned", () => {
    expect(PostGISExtension({ managed: false })).toEqual({
      name: "postgis",
      managed: false,
      runtimeSchemas: ["public"],
      dropCascade: false,
    });
  });
});

describe("PostGIS point fields", () => {
  test("geography point field uses shared extension metadata", () => {
    const field = GeographyPointType({ srid: 4326, index: true });

    expect(field.type.dbType).toBe("JSONB");
    expect(field.type.type).toBe("GeoPoint");
    expect(field.type.importType).toEqual({
      path: "@snowtop/ent-postgis",
      type: "GeoPoint",
    });
    expect(field.type.postgresType).toBe("geography(Point,4326)");
    expect(field.type.dbExtension).toBe("postgis");
    expect(field.index).toBe(true);
    expect(field.valid(geoPoint(-122.4, 37.78))).toBe(true);
    expect(field.format(geoPoint(-122.4, 37.78))).toBe(
      "SRID=4326;POINT(-122.4 37.78)",
    );
  });

  test("geometry point field uses geometry postgres type", () => {
    const field = GeometryPointType({ srid: 3857 });

    expect(field.type.postgresType).toBe("geometry(Point,3857)");
  });
});

describe("PostGIS query helpers", () => {
  test("distance expression renders using geography helpers by default", () => {
    const expression = distance("location", geoPoint(-122.4, 37.78));

    expect(expression.clause(1, "p")).toBe(
      "ST_Distance(p.location, ST_GeogFromText($1))",
    );
    expect(expression.values()).toEqual(["SRID=4326;POINT(-122.4 37.78)"]);
  });

  test("dWithin clause renders the distance predicate", () => {
    const clause = dWithin("location", geoPoint(-122.4, 37.78), 2500);

    expect(clause.clause(1, "p")).toBe(
      "ST_DWithin(p.location, ST_GeogFromText($1), $2)",
    );
    expect(clause.values()).toEqual(["SRID=4326;POINT(-122.4 37.78)", 2500]);
  });

  test("computed select/order helpers share the same expression", () => {
    const point = geoPoint(-122.4, 37.78);
    const selected = selectDistance("distance_meters", "location", point);
    const orderby = orderByDistance("location", point, "ASC", {
      alias: "distance_meters",
    });

    expect(selected.alias).toBe("distance_meters");
    expect(selected.expression.clause(1, "p")).toBe(
      "ST_Distance(p.location, ST_GeogFromText($1))",
    );
    expect(orderby.column).toBe("distance_meters");
    expect(orderby.expression?.clause(1, "p")).toBe(
      "ST_Distance(p.location, ST_GeogFromText($1))",
    );
  });
});

describe("PostGIS parsing", () => {
  test("serializes points to ewkt", () => {
    expect(toEWKT(geoPoint(-73.9857, 40.7484))).toBe(
      "SRID=4326;POINT(-73.9857 40.7484)",
    );
  });

  test("parses ewkt strings into GeoPoint values", () => {
    expect(parsePostGISValue("SRID=4326;POINT(-73.9857 40.7484)")).toEqual({
      longitude: -73.9857,
      latitude: 40.7484,
      srid: 4326,
    });
  });

  test("parses ewkb hex strings into GeoPoint values", () => {
    const ewkb = (() => {
      const buffer = Buffer.alloc(1 + 4 + 4 + 8 + 8);
      let offset = 0;
      buffer.writeUInt8(1, offset);
      offset += 1;
      buffer.writeUInt32LE(0x20000001, offset);
      offset += 4;
      buffer.writeUInt32LE(4326, offset);
      offset += 4;
      buffer.writeDoubleLE(-73.9857, offset);
      offset += 8;
      buffer.writeDoubleLE(40.7484, offset);
      return buffer.toString("hex");
    })();

    expect(parsePostGISValue(ewkb)).toEqual({
      longitude: -73.9857,
      latitude: 40.7484,
      srid: 4326,
    });
  });

  test("parses ewkb buffers into GeoPoint values", () => {
    const buffer = Buffer.alloc(1 + 4 + 4 + 8 + 8);
    let offset = 0;
    buffer.writeUInt8(1, offset);
    offset += 1;
    buffer.writeUInt32LE(0x20000001, offset);
    offset += 4;
    buffer.writeUInt32LE(4326, offset);
    offset += 4;
    buffer.writeDoubleLE(-73.9857, offset);
    offset += 8;
    buffer.writeDoubleLE(40.7484, offset);

    expect(parsePostGISValue(buffer)).toEqual({
      longitude: -73.9857,
      latitude: 40.7484,
      srid: 4326,
    });
  });
});

describe("PostGIS runtime initialization", () => {
  test("registers point type handlers through the core runtime registry", () => {
    expect(postgisRuntimeHandler).toEqual({
      name: "postgis",
      runtimeSchemas: ["public"],
      types: [
        {
          name: "geometry",
          parse: parsePostGISValue,
        },
        {
          name: "geography",
          parse: parsePostGISValue,
        },
      ],
    });
  });
});
