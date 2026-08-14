/**
 * Copyright whaa whaa
 */

import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import type { PrivacyPolicy } from "@snowtop/ent";
import { Holiday } from "../../holiday.js";
import { ExampleViewer } from "../../../viewer/viewer.js";
import { CustomCreateHolidayActionBase } from "../../generated/holiday/actions/custom_create_holiday_action_base.js";
import type { CustomCreateHolidayInput } from "../../generated/holiday/actions/custom_create_holiday_action_base.js";
export type { CustomCreateHolidayInput };
export default class CustomCreateHolidayAction extends CustomCreateHolidayActionBase {
  getPrivacyPolicy(): PrivacyPolicy<Holiday, ExampleViewer> {
    return AlwaysAllowPrivacyPolicy;
  }
}
