jest.mock("@snowtop/ent", () => {
  const actual = jest.requireActual("@snowtop/ent");
  return {
    ...actual,
    loadRows: jest.fn(),
  };
});

import { buildQueryData, loadRows } from "@snowtop/ent";
import { geoPoint } from "@snowtop/ent-postgis";
import globalSchema from "src/schema/global_schema";
import { nearbyPlaces } from "src/search/nearby_places";
import { Place } from "src/ent/place";

describe("local guide nearby search", () => {
  test("declares postgis in the example global schema", () => {
    expect(globalSchema.dbExtensions).toEqual([
      {
        name: "postgis",
        managed: true,
        runtimeSchemas: ["public"],
        dropCascade: false,
      },
    ]);
  });

  test("builds a distance-ranked PostGIS query", () => {
    const queryData = buildQueryData(
      Place.nearbyQuery({
        center: geoPoint(-122.40061, 37.7875),
        radiusMeters: 2500,
        category: "coffee",
        limit: 5,
      }),
    );

    expect(queryData.query).toBe(
      "SELECT id, name, slug, category, description, ST_Distance(location, ST_GeogFromText($1)) AS distance_meters FROM places WHERE category = $2 AND ST_DWithin(location, ST_GeogFromText($3), $4) ORDER BY ST_Distance(location, ST_GeogFromText($5)) ASC LIMIT 5",
    );
    expect(queryData.values).toEqual([
      "SRID=4326;POINT(-122.40061 37.7875)",
      "coffee",
      "SRID=4326;POINT(-122.40061 37.7875)",
      2500,
      "SRID=4326;POINT(-122.40061 37.7875)",
    ]);
  });

  test("loads nearby places through the example search helper", async () => {
    const mockedLoadRows = loadRows as jest.MockedFunction<typeof loadRows>;
    mockedLoadRows.mockResolvedValueOnce([
      {
        id: "place_1",
        name: "Blue Bottle",
        slug: "blue-bottle",
        category: "coffee",
        description: "Downtown cafe",
        distance_meters: 42.5,
      },
    ]);

    const rows = await nearbyPlaces({
      center: geoPoint(-122.40061, 37.7875),
      radiusMeters: 2500,
      category: "coffee",
      limit: 1,
    });

    expect(rows).toEqual([
      {
        id: "place_1",
        name: "Blue Bottle",
        slug: "blue-bottle",
        category: "coffee",
        description: "Downtown cafe",
        distance_meters: 42.5,
      },
    ]);
    expect(mockedLoadRows).toHaveBeenCalledTimes(1);
    expect(buildQueryData(mockedLoadRows.mock.calls[0][0]).query).toBe(
      "SELECT id, name, slug, category, description, ST_Distance(location, ST_GeogFromText($1)) AS distance_meters FROM places WHERE category = $2 AND ST_DWithin(location, ST_GeogFromText($3), $4) ORDER BY ST_Distance(location, ST_GeogFromText($5)) ASC LIMIT 1",
    );
  });
});
