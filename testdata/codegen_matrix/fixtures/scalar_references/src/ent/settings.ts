import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { gqlField, gqlInputObjectType, gqlArgType, gqlMutation, gqlQuery } from "@snowtop/ent/graphql";
import { SettingsBase } from "./generated/settings_base";
export class Settings extends SettingsBase {
  @gqlField({class: "Settings", type: String, args: [{name: "filter", type: "ReferenceFilter"}]})
  filterReference(filter: ReferenceFilter) { return filter.holidayId; }
  getPrivacyPolicy() { return AlwaysAllowPrivacyPolicy; }
  @gqlField({ class: "Settings", type: "ID", graphQLIDType: "Holiday", nullable: true })
  get referenceId() { return this.overrides?.[0]?.holidayId ?? null; }
  @gqlField({ class: "Settings", type: ["ID"], graphQLIDType: "Holiday", async: true })
  async references() { return this.overrides?.map((e) => e.holidayId) ?? []; }
  @gqlField({ class: "Settings", type: "ID", graphQLIDType: "Holiday", disableBase64Encode: true, nullable: true })
  get rawId() { return this.overrides?.[0]?.holidayId ?? null; }
}

@gqlInputObjectType()
export class ReferenceInput {
  @gqlField({class: "ReferenceInput", type: "ID"})
  holidayId!: string;
  @gqlField({class: "ReferenceInput", type: ["ID"], graphQLIDType: "Holiday"})
  references!: string[];
}
@gqlArgType()
export class ReferenceFilter {
  @gqlField({class: "ReferenceFilter", type: "ID", graphQLIDType: "Holiday"})
  holidayId!: string;
}
export class ReferenceResolver {
  @gqlQuery({class: "ReferenceResolver", type: "ID", graphQLIDType: "Holiday"})
  savedHolidayReference() { return "00000000-0000-4000-8000-000000000001"; }
  @gqlQuery({class: "ReferenceResolver", type: ["ID"], graphQLIDType: "Holiday", nullable: "contentsAndList", async: true})
  async savedHolidayReferences() { return [this.savedHolidayReference(), null, this.savedHolidayReference()]; }
  @gqlQuery({class: "ReferenceResolver", type: "ID", graphQLIDType: "Holiday", nullable: true})
  missingHolidayReference() { return null; }
  @gqlQuery({class: "ReferenceResolver", type: "ID", graphQLIDType: "Holiday", disableBase64Encode: true})
  rawHolidayReference() { return this.savedHolidayReference(); }
  @gqlQuery({class: "ReferenceResolver", type: "ID", name: "holidayId"})
  legacyHolidayReference() { return this.savedHolidayReference(); }
  @gqlMutation({class: "ReferenceResolver", type: "ID", graphQLIDType: "Holiday", async: true})
  async saveHolidayReference() { return this.savedHolidayReference(); }
  @gqlMutation({class: "ReferenceResolver", type: ["ID"], graphQLIDType: "Holiday"})
  saveHolidayReferences() { return [this.savedHolidayReference(), this.savedHolidayReference()]; }
  @gqlMutation({class: "ReferenceResolver", type: "ID", graphQLIDType: "Holiday", disableBase64Encode: true})
  saveRawHolidayReference() { return this.savedHolidayReference(); }

  @gqlMutation({class: "ReferenceResolver", type: String, args: [{name: "input", type: "ReferenceInput"}]})
  echoReference(input: ReferenceInput) { return input.holidayId; }
}
