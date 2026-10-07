import { EntSchema, StringType } from "@snowtop/ent/schema";
export default new EntSchema({hideFromGraphQL: true, fields: {name: StringType()}});
