/**
 * Copyright whaa whaa
 */

import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@snowtop/ent";
import { Holiday } from "src/ent/holiday";
import { ExampleViewer } from "src/viewer/viewer";
import {
  CustomCreateHolidayActionBase,
  CustomCreateHolidayInput,
} from "../../generated/holiday/actions/custom_create_holiday_action_base";

export { CustomCreateHolidayInput };

export default class CustomCreateHolidayAction extends CustomCreateHolidayActionBase {
  getPrivacyPolicy(): PrivacyPolicy<Holiday, ExampleViewer> {
    return AlwaysAllowPrivacyPolicy;
  }
}
