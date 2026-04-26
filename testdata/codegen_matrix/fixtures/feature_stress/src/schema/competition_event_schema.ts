import { EntSchema, StringType } from "@snowtop/ent/schema";
import { BadgeRecipient } from "src/schema/patterns/badge_recipient";

const CompetitionEventSchema = new EntSchema({
  patterns: [BadgeRecipient],
  fields: {
    name: StringType(),
  },
});

export default CompetitionEventSchema;
