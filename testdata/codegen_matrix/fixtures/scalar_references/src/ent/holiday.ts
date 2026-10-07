import { AlwaysDenyPrivacyPolicy } from "@snowtop/ent";
import { HolidayBase } from "./generated/holiday_base";
export class Holiday extends HolidayBase {
  getPrivacyPolicy() { return AlwaysDenyPrivacyPolicy; }
}
