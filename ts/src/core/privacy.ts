import {
  Viewer,
  Ent,
  ID,
  loadEdgeForID2,
  LoadEntOptions,
  loadEnt,
} from "./ent";
import { Context } from "./context";

enum privacyResult {
  // using http status codes similar to golang for the lols
  Allow = 200,
  Deny = 401,
  Skip = 307,
}

export interface PrivacyResult {
  result: privacyResult;
  error?: PrivacyError;
}

export interface PrivacyError extends Error {
  privacyPolicy: PrivacyPolicy;
  entID?: ID;
}

export class EntPrivacyError extends Error implements PrivacyError {
  constructor(public privacyPolicy: PrivacyPolicy, public entID?: ID) {
    super(`ent ${entID} is not visible for privacy reasons`);
  }
}

class EntInvalidPrivacyPolicyError extends Error implements PrivacyError {
  constructor(public privacyPolicy: PrivacyPolicy, public entID?: ID) {
    super(
      `ent ${entID} is not visible because privacy policy is not properly configured`,
    );
  }
}

export function Allow(): PrivacyResult {
  return {
    result: privacyResult.Allow,
  };
}

export function Skip(): PrivacyResult {
  return {
    result: privacyResult.Skip,
  };
}

export function Deny(): PrivacyResult {
  return {
    result: privacyResult.Deny,
  };
}

export function DenyWithReason(e: PrivacyError): PrivacyResult {
  return {
    result: privacyResult.Deny,
    error: e,
  };
}

export interface PrivacyPolicyRule {
  apply(v: Viewer, ent?: Ent): Promise<PrivacyResult>;
}

// export interface PrivacyPolicyRuleSync {
//   apply(v: Viewer, ent: Ent): PrivacyResult;
// }

export interface PrivacyPolicy {
  //  rules: PrivacyPolicyRule | PrivacyPolicyRuleSync[];
  rules: PrivacyPolicyRule[];
}

export const AlwaysAllowRule = {
  async apply(_v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    return Allow();
  },
};

export const AlwaysDenyRule = {
  async apply(_v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    return Deny();
  },
};

export const DenyIfLoggedOutRule = {
  async apply(v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    if (v.viewerID === null || v.viewerID == undefined) {
      return Deny();
    }
    return Skip();
  },
};

export const DenyIfLoggedInRule = {
  async apply(v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    if (v.viewerID === null || v.viewerID == undefined) {
      return Skip();
    }
    return Deny();
  },
};

export const AllowIfHasIdentity = {
  async apply(v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    if (v.viewerID === null || v.viewerID == undefined) {
      return Skip();
    }
    return Allow();
  },
};

export const AllowIfViewerRule = {
  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    if (v.viewerID === ent?.id) {
      return Allow();
    }
    return Skip();
  },
};

export class AllowIfViewerEqualsRule {
  constructor(private id: any) {}

  async apply(v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    return v.viewerID === this.id ? Allow() : Skip();
  }
}

export class DenyIfViewerEqualsRule {
  constructor(private id: ID) {}

  async apply(v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    return v.viewerID === this.id ? Deny() : Skip();
  }
}

interface FuncRule {
  (v: Viewer, ent?: Ent): boolean | Promise<boolean>;
}

export class AllowIfFuncRule implements PrivacyPolicyRule {
  constructor(private fn: FuncRule) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    const result = await this.fn(v, ent);
    if (result) {
      return Allow();
    }
    return Skip();
  }
}

export class DenyIfFuncRule implements PrivacyPolicyRule {
  constructor(private fn: FuncRule) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    const result = await this.fn(v, ent);
    if (result) {
      return Deny();
    }
    return Skip();
  }
}

export class AllowIfViewerIsRule implements PrivacyPolicyRule {
  constructor(private property: string) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    let result: undefined;
    if (ent) {
      result = ent[this.property];
    }
    if (result === v.viewerID) {
      return Allow();
    }
    return Skip();
  }
}

export class AllowIfEntIsVisibleRule<T extends Ent>
  implements PrivacyPolicyRule {
  constructor(private id: ID, private options: LoadEntOptions<T>) {}

  async apply(v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    const visible = await loadEnt(v, this.id, this.options);
    if (visible === null) {
      return Skip();
    }
    return Allow();
  }
}

export class AllowIfEntIsVisiblePolicy<T extends Ent> implements PrivacyPolicy {
  constructor(private id: ID, private options: LoadEntOptions<T>) {}

  rules = [new AllowIfEntIsVisibleRule(this.id, this.options), AlwaysDenyRule];
}

export class DenyIfEntIsVisiblePolicy<T extends Ent> implements PrivacyPolicy {
  constructor(private id: ID, private options: LoadEntOptions<T>) {}

  rules = [new DenyIfEntIsVisibleRule(this.id, this.options), AlwaysAllowRule];
}

export class DenyIfEntIsVisibleRule<T extends Ent>
  implements PrivacyPolicyRule {
  constructor(private id: ID, private options: LoadEntOptions<T>) {}

  async apply(v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    const visible = await loadEnt(v, this.id, this.options);
    if (visible === null) {
      return Skip();
    }
    return Deny();
  }
}

async function allowIfEdgeExistsRule(
  id1: ID | null | undefined,
  id2: ID | null | undefined,
  edgeType: string,
  context?: Context,
): Promise<PrivacyResult> {
  if (!id1 || !id2) {
    return Skip();
  }
  const edge = await loadEdgeForID2({ id1, edgeType, id2, context });
  if (edge) {
    return Allow();
  }
  return Skip();
}

export class AllowIfEdgeExistsRule implements PrivacyPolicyRule {
  constructor(private id1: ID, private id2: ID, private edgeType: string) {}

  async apply(v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    return allowIfEdgeExistsRule(this.id1, this.id2, this.edgeType, v.context);
  }
}

export class AllowIfViewerInboundEdgeExistsRule implements PrivacyPolicyRule {
  constructor(private edgeType: string) {}

  async apply(v: Viewer, ent: Ent): Promise<PrivacyResult> {
    return allowIfEdgeExistsRule(v.viewerID, ent?.id, this.edgeType, v.context);
  }
}

export class AllowIfViewerOutboundEdgeExistsRule implements PrivacyPolicyRule {
  constructor(private edgeType: string) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    return allowIfEdgeExistsRule(ent?.id, v.viewerID, this.edgeType, v.context);
  }
}

async function denyIfEdgeExistsRule(
  id1: ID | null | undefined,
  id2: ID | null | undefined,
  edgeType: string,
  context?: Context,
): Promise<PrivacyResult> {
  // edge doesn't exist if no viewer
  if (!id1 || !id2) {
    return Skip();
  }
  const edge = await loadEdgeForID2({ id1, edgeType, id2, context });
  if (edge) {
    return Deny();
  }
  return Skip();
}

export class DenyIfEdgeExistsRule implements PrivacyPolicyRule {
  constructor(private id1: ID, private id2: ID, private edgeType: string) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    return denyIfEdgeExistsRule(this.id1, this.id2, this.edgeType, v.context);
  }
}

export class DenyIfViewerInboundEdgeExistsRule implements PrivacyPolicyRule {
  constructor(private edgeType: string) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    return denyIfEdgeExistsRule(v.viewerID, ent?.id, this.edgeType, v.context);
  }
}

export class DenyIfViewerOutboundEdgeExistsRule implements PrivacyPolicyRule {
  constructor(private edgeType: string) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    return denyIfEdgeExistsRule(ent?.id, v.viewerID, this.edgeType, v.context);
  }
}

// need a Deny version of this too
export class AllowIfConditionAppliesRule implements PrivacyPolicyRule {
  constructor(private fn: FuncRule, private rule: PrivacyPolicyRule) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    const result = await this.fn(v, ent);
    if (!result) {
      return Skip();
    }
    const r = await this.rule.apply(v, ent);
    return r.result === privacyResult.Allow ? Allow() : Skip();
  }
}

// TODO different variants
export class AllowIfSubPolicyAllowsRule implements PrivacyPolicyRule {
  constructor(private policy: PrivacyPolicy) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    const result = await applyPrivacyPolicy(v, this.policy, ent);
    if (result) {
      return Allow();
    }
    return Skip();
  }
}

export async function applyPrivacyPolicy(
  v: Viewer,
  policy: PrivacyPolicy,
  ent: Ent | undefined,
): Promise<boolean> {
  try {
    return await applyPrivacyPolicyX(v, policy, ent);
  } catch (e) {
    return false;
  }
}

// this will throw an exception if fails or return error | null?
export async function applyPrivacyPolicyX(
  v: Viewer,
  policy: PrivacyPolicy,
  ent: Ent | undefined,
): Promise<boolean> {
  // right now we apply all at same time. todo: be smart about this in the future
  const results = await Promise.all(
    policy.rules.map((rule) => rule.apply(v, ent)),
  );
  for (const res of results) {
    if (res.result == privacyResult.Allow) {
      return true;
    } else if (res.result == privacyResult.Deny) {
      // specific error throw that
      if (res.error) {
        throw res.error;
      }
      throw new EntPrivacyError(policy, ent?.id);
    }
  }

  throw new EntInvalidPrivacyPolicyError(policy, ent?.id);
}

export const AlwaysAllowPrivacyPolicy = {
  rules: [AlwaysAllowRule],
};

export const AlwaysDenyPrivacyPolicy = {
  rules: [AlwaysDenyRule],
};
