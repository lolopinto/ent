import { Pattern, UUIDType } from "@snowtop/ent";

export class WithAddressPattern implements Pattern {
  name = "with_address";
  fields = {
    addressId: UUIDType({
      nullable: true,
      fieldEdge: {
        schema: "Address",
        inverseEdge: {
          name: "locatedAt",
        },
      },
    }),
  };
}
