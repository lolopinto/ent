/**
 * Copyright whaa whaa
 */

import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@snowtop/ent";
import { ExampleViewer } from "../viewer/viewer.js";
import { DefaultsExampleBase } from "./internal.js";

export class DefaultsExample extends DefaultsExampleBase {
  getPrivacyPolicy(): PrivacyPolicy<this, ExampleViewer> {
    return AlwaysAllowPrivacyPolicy;
  }
}
