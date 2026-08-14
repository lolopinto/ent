import { PlaceBase } from "./internal.js";
import type {
  NearbyPlaceRow,
  NearbyPlacesOptions,
} from "../search/nearby_places.js";
import {
  buildNearbyPlacesQuery,
  nearbyPlaces,
} from "../search/nearby_places.js";

export class Place extends PlaceBase {
  static async nearby(options: NearbyPlacesOptions): Promise<NearbyPlaceRow[]> {
    return nearbyPlaces(options);
  }

  static nearbyQuery(options: NearbyPlacesOptions) {
    return buildNearbyPlacesQuery(options);
  }
}
