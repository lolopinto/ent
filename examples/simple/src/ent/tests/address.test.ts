import { Address } from "../address";
import schema from "../../graphql/generated/schema";
import { isObjectType } from "graphql";
import { LoggedOutExampleViewer } from "../../viewer/viewer";
import CreateAddressAction from "../address/actions/create_address_action";

const vc = new LoggedOutExampleViewer();

test("create", async () => {
  const address = await CreateAddressAction.create(vc, {
    streetName: "1 Dr Carlton B Goodlett Pl",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
  }).saveX();

  expect(address.streetName).toEqual("1 Dr Carlton B Goodlett Pl");
  expect(address.city).toEqual("San Francisco");
  expect(address.state).toEqual("CA");
  expect(address.zip).toEqual("94102");

  // uses default value
  expect(address.country).toEqual("US");
});

test("create UK", async () => {
  const address = await CreateAddressAction.create(vc, {
    streetName: "10 Downing St",
    city: "Westminister",
    state: "London",
    zip: "SW1A 2AA",
    country: "UK",
  }).saveX();

  expect(address.streetName).toEqual("10 Downing St");
  expect(address.city).toEqual("Westminister");
  expect(address.state).toEqual("London");
  expect(address.zip).toEqual("SW1A 2AA");
  expect(address.country).toEqual("UK");
});

test("public addresses do not expose the private inverse event relationship", () => {
  expect("queryHostedEvents" in Address.prototype).toBe(false);
  const addressType = schema.getType("Address");
  expect(isObjectType(addressType)).toBe(true);
  if (!isObjectType(addressType)) throw new Error("missing Address type");
  expect(addressType.getFields().hostedEvents).toBeUndefined();
  expect(schema.getType("AddressToHostedEventsConnection")).toBeUndefined();
});
