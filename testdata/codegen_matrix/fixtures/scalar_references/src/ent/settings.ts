import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { gqlField } from "@snowtop/ent/graphql";
import { SettingsBase } from "./generated/settings_base";
export class Settings extends SettingsBase {
  getPrivacyPolicy() { return AlwaysAllowPrivacyPolicy; }
  @gqlField({ class: "Settings", type: "ID", graphQLIDType: "Holiday", nullable: true })
  get referenceId() { return this.overrides?.[0]?.holidayId ?? null; }
  @gqlField({ class: "Settings", type: ["ID"], graphQLIDType: "Holiday", async: true })
  async references() { return this.overrides?.map((e) => e.holidayId) ?? []; }
  @gqlField({ class: "Settings", type: "ID", graphQLIDType: "Holiday", disableBase64Encode: true, nullable: true })
  get rawId() { return this.overrides?.[0]?.holidayId ?? null; }
}
