/**
 * Copyright whaa whaa
 */

import { AllowIfViewerIsEntPropertyRule, PrivacyPolicy } from "@snowtop/ent";
import { ExampleViewer } from "../viewer/viewer.js";
import { FileBase } from "./internal.js";

export class File extends FileBase {
  getPrivacyPolicy(): PrivacyPolicy<this, ExampleViewer> {
    return {
      rules: [new AllowIfViewerIsEntPropertyRule("creatorId")],
    };
  }
}
