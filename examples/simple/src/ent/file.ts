/**
 * Copyright whaa whaa
 */

import { AllowIfViewerIsEntPropertyRule, PrivacyPolicy } from "@snowtop/ent";
import { ExampleViewer } from "src/viewer/viewer";
import { FileBase } from "./internal";

export class File extends FileBase {
  getPrivacyPolicy(): PrivacyPolicy<this, ExampleViewer> {
    return {
      rules: [new AllowIfViewerIsEntPropertyRule("creatorId")],
    };
  }
}
