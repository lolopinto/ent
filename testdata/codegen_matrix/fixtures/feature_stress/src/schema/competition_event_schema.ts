import { EntSchema, StringType } from "@snowtop/ent/schema";
import { BadgeRecipient } from "./patterns/badge_recipient.js";

const CompetitionEventSchema = new EntSchema({
  patterns: [BadgeRecipient],
  fields: {
    name: StringType(),
  },
});

export default CompetitionEventSchema;
