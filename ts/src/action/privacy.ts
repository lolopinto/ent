import { Builder } from "./action";
import {
  Viewer,
  ID,
  Ent,
  PrivacyResult,
  PrivacyPolicyRule,
  Deny,
  Allow,
  Skip,
} from "../core/base";

function isBuilder(node: ID | Builder<Ent>): node is Builder<Ent> {
  return (node as Builder<Ent>).placeholderID !== undefined;
}

export class DenyIfBuilder implements PrivacyPolicyRule {
  constructor(private id?: ID | Builder<Ent>) {}

  async apply(_v: Viewer, _ent: Ent): Promise<PrivacyResult> {
    if (this.id && isBuilder(this.id)) {
      return Deny();
    }
    return Skip();
  }
}

export class AllowIfBuilder implements PrivacyPolicyRule {
  constructor(private id?: ID | Builder<Ent>) {}

  async apply(_v: Viewer, _ent: Ent): Promise<PrivacyResult> {
    if (this.id && isBuilder(this.id)) {
      return Allow();
    }
    return Skip();
  }
}
