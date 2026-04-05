import { loadRows, query, type QueryableDataOptions } from "@snowtop/ent";
import {
  dWithin,
  geoPoint,
  orderByDistance,
  selectDistance,
  type GeoPointInput,
} from "@snowtop/ent-postgis";

export type PlaceCategory = "coffee" | "park" | "museum" | "restaurant";

export interface NearbyPlacesOptions {
  center: GeoPointInput;
  radiusMeters: number;
  category?: PlaceCategory;
  limit?: number;
}

export interface NearbyPlaceRow {
  id: string;
  name: string;
  slug: string;
  category: PlaceCategory;
  description: string | null;
  distance_meters: number;
}

export function buildNearbyPlacesQuery(
  options: NearbyPlacesOptions,
): QueryableDataOptions {
  const clause = options.category
    ? query.And(
        query.Eq("category", options.category),
        dWithin("location", options.center, options.radiusMeters),
      )
    : dWithin("location", options.center, options.radiusMeters);

  return {
    tableName: "places",
    fields: [
      "id",
      "name",
      "slug",
      "category",
      "description",
      selectDistance("distance_meters", "location", options.center),
    ],
    clause,
    orderby: [
      orderByDistance("location", options.center, "ASC", {
        alias: "distance_meters",
      }),
    ],
    limit: options.limit ?? 10,
  };
}

export async function nearbyPlaces(
  options: NearbyPlacesOptions,
): Promise<NearbyPlaceRow[]> {
  const rows = await loadRows(buildNearbyPlacesQuery(options));
  return rows as NearbyPlaceRow[];
}

export const civicCenter = geoPoint(-122.4194, 37.7793);
