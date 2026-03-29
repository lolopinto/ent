import { buildQueryData } from "@snowtop/ent/core/query_impl";
import { geoPoint } from "@snowtop/ent-postgis";
import { Place } from "src/ent/place";

describe("local guide nearby search", () => {
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
});
