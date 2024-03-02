/**
 * Copyright whaa whaa
 */

import { AllowIfViewerIsEntPropertyRule, AlwaysDenyRule } from "@snowtop/ent";
import { PrivacyPolicy } from "@snowtop/ent";
import { ExampleViewer } from "src/viewer/viewer";
import { UserStatisticsBase } from "./internal";

export class UserStatistics extends UserStatisticsBase {
  getPrivacyPolicy(): PrivacyPolicy<this, ExampleViewer> {
    return {
      rules: [new AllowIfViewerIsEntPropertyRule("userId"), AlwaysDenyRule],
    };
  }
}
