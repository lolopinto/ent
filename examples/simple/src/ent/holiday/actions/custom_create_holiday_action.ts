/**
 * Copyright whaa whaa
 */

import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import type { PrivacyPolicy } from "@snowtop/ent";
import { Holiday } from "src/ent/holiday";
import { ExampleViewer } from "src/viewer/viewer";
import { CustomCreateHolidayActionBase } from "../../generated/holiday/actions/custom_create_holiday_action_base";
import type { CustomCreateHolidayInput } from "../../generated/holiday/actions/custom_create_holiday_action_base";
export type { CustomCreateHolidayInput };
export default class CustomCreateHolidayAction extends CustomCreateHolidayActionBase {
  getPrivacyPolicy(): PrivacyPolicy<Holiday, ExampleViewer> {
    return AlwaysAllowPrivacyPolicy;
  }
}
