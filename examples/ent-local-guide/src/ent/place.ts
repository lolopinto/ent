import { PlaceBase } from "./internal";
import type {
  NearbyPlaceRow,
  NearbyPlacesOptions,
} from "src/search/nearby_places";
import {
  buildNearbyPlacesQuery,
  nearbyPlaces,
} from "src/search/nearby_places";

export class Place extends PlaceBase {
  static async nearby(options: NearbyPlacesOptions): Promise<NearbyPlaceRow[]> {
    return nearbyPlaces(options);
  }

  static nearbyQuery(options: NearbyPlacesOptions) {
    return buildNearbyPlacesQuery(options);
  }
}
