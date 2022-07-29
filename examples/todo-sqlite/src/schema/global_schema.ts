import { GlobalSchema, TimestampType } from "@snowtop/ent/schema/";
import { GlobalDeletedEdge } from "@snowtop/ent-soft-delete";

const glo: GlobalSchema = {
  ...GlobalDeletedEdge,

  extraEdgeFields: {
    // same energy as soft_delete pattern but implemented manually
    deleted_at: TimestampType({
      nullable: true,
      defaultValueOnCreate: () => null,
    }),
  },
};
export default glo;
