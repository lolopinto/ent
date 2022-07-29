import { GlobalSchema, TimestampType } from "@snowtop/ent/schema/";
import { GlobalDeletedEdge } from "@snowtop/ent-soft-delete";

const glo: GlobalSchema = {
  ...GlobalDeletedEdge,
};
export default glo;
