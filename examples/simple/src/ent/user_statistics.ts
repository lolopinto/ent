/**
 * Copyright whaa whaa
 */

import { AllowIfViewerIsEntPropertyRule, AlwaysDenyRule } from "@snowtop/ent";
import { PrivacyPolicy } from "@snowtop/ent";
import { ExampleViewer } from "../viewer/viewer.js";
import { UserStatisticsBase } from "./internal.js";

export class UserStatistics extends UserStatisticsBase {
  getPrivacyPolicy(): PrivacyPolicy<this, ExampleViewer> {
    return {
      rules: [new AllowIfViewerIsEntPropertyRule("userId"), AlwaysDenyRule],
    };
  }
}
