import { IDViewer } from "@snowtop/ent";
import { geoPoint } from "@snowtop/ent-postgis";
import CreatePlaceAction from "src/ent/place/actions/create_place_action";
import CreatePlaceReviewAction, {
  type PlaceReviewCreateInput,
} from "src/ent/place_review/actions/create_place_review_action";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import FavoritePlace from "src/ent/user/actions/favorite_place";
import { nearbyPlaces } from "src/search/nearby_places";

const dbTest = process.env.POSTGRES_TEST_DB ? test : test.skip;
const bootstrapViewer = new IDViewer("local-guide-bootstrap");

function uniqueSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function seededCenter(seed: string) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  }
  return geoPoint(
    -124 + (hash % 1000) / 1000,
    36 + (Math.floor(hash / 1000) % 1000) / 1000,
  );
}

describe("local guide nearby search integration", () => {
  dbTest("creates places with reviews and favorites, then loads nearby places", async () => {
    const suffix = uniqueSuffix();
    const center = seededCenter(suffix);
    const nearbyCenter = geoPoint(
      center.longitude + 0.001,
      center.latitude + 0.001,
    );
    const farCenter = geoPoint(center.longitude + 0.03, center.latitude + 0.03);

    const creator = await CreateUserAction.create(bootstrapViewer, {
      name: `Creator ${suffix}`,
      slug: `creator-${suffix}`,
    }).saveX();
    const fan = await CreateUserAction.create(bootstrapViewer, {
      name: `Fan ${suffix}`,
      slug: `fan-${suffix}`,
    }).saveX();

    const creatorViewer = new IDViewer(creator.id);
    const fanViewer = new IDViewer(fan.id);

    const exactPlace = await CreatePlaceAction.create(creatorViewer, {
      name: `Cafe ${suffix}`,
      slug: `cafe-${suffix}`,
      category: "coffee",
      description: "Closest coffee shop",
      website: "https://example.com/cafe",
      location: center,
    }).saveX();
    const nearbyPlace = await CreatePlaceAction.create(creatorViewer, {
      name: `Roaster ${suffix}`,
      slug: `roaster-${suffix}`,
      category: "coffee",
      description: "Still walkable",
      location: nearbyCenter,
    }).saveX();
    await CreatePlaceAction.create(creatorViewer, {
      name: `Museum ${suffix}`,
      slug: `museum-${suffix}`,
      category: "museum",
      description: "Wrong category",
      location: center,
    }).saveX();
    await CreatePlaceAction.create(creatorViewer, {
      name: `Far Cafe ${suffix}`,
      slug: `far-cafe-${suffix}`,
      category: "coffee",
      description: "Outside the search radius",
      location: farCenter,
    }).saveX();

    const reviewInput: PlaceReviewCreateInput = {
      placeId: exactPlace.id,
      rating: 5,
      body: "Worth the walk",
    };
    const review = await CreatePlaceReviewAction.create(
      fanViewer,
      reviewInput,
    ).saveX();
    await FavoritePlace.create(fanViewer, fan)
      .addFavoritePlace(exactPlace.id)
      .builder.saveX();

    const rows = await nearbyPlaces({
      center,
      radiusMeters: 500,
      category: "coffee",
      limit: 5,
    });

    expect(rows.map((row) => row.id)).toEqual([exactPlace.id, nearbyPlace.id]);
    expect(rows[0].distance_meters).toBeCloseTo(0, 6);
    expect(rows[1].distance_meters).toBeGreaterThan(rows[0].distance_meters);

    expect(exactPlace.location.longitude).toBeCloseTo(center.longitude, 6);
    expect(exactPlace.location.latitude).toBeCloseTo(center.latitude, 6);

    const fans = await exactPlace.queryFans().queryIDs();
    expect(fans).toEqual([fan.id]);

    const reviews = await exactPlace.queryReviews().queryIDs();
    expect(reviews).toEqual([review.id]);
  });
});
