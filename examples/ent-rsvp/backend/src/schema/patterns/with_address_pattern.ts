import { Pattern, UUIDType } from "@snowtop/ent";

export class WithAddressPattern implements Pattern {
  name = "with_address";
  fields = {
    address_id: UUIDType({
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
