/**
 * Copyright whaa whaa
 */

import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@snowtop/ent";
import { ExampleViewer } from "src/viewer/viewer";
import { DefaultsExampleBase } from "./internal";

export class DefaultsExample extends DefaultsExampleBase {
  getPrivacyPolicy(): PrivacyPolicy<this, ExampleViewer> {
    return AlwaysAllowPrivacyPolicy;
  }
}
