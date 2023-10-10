import { isPromise } from "util/types";
import {
  Allow,
  Context,
  Deny,
  Ent,
  ID,
  LoadEntOptions,
  PrivacyError,
  PrivacyPolicy,
  PrivacyPolicyRule,
  PrivacyResult,
  Skip,
  Viewer,
  EdgeQueryableDataOptionsConfigureLoader,
} from "./base";
import { AssocEdge, loadEdgeForID2, loadEnt } from "./ent";

// copied from ./base
enum privacyResult {
  // using http status codes similar to golang for the lols
  Allow = 200,
  Deny = 401,
  Skip = 307,
}

export class EntPrivacyError extends Error implements PrivacyError {
  privacyPolicy: PrivacyPolicy;
  privacyRule: PrivacyPolicyRule;
  ent?: Ent;

  constructor(
    privacyPolicy: PrivacyPolicy,
    rule: PrivacyPolicyRule,
    ent?: Ent,
  ) {
    let msg = `ent ${ent?.id} is not visible for privacy reasons`;

    if (typeof ent === "object") {
      ent.constructor.name;
      msg = `ent ${ent?.id} of type ${ent.constructor.name} is not visible for privacy reasons`;
    }
    super(msg);
    this.privacyPolicy = privacyPolicy;
    this.privacyRule = rule;
    this.ent = ent;
  }
}

class EntInvalidPrivacyPolicyError extends Error implements PrivacyError {
  privacyPolicy: PrivacyPolicy;
  ent?: Ent;

  constructor(privacyPolicy: PrivacyPolicy, ent?: Ent) {
    let msg = `ent ${ent?.id} is not visible because privacy policy is not properly configured`;

    if (typeof ent === "object") {
      ent.constructor.name;
      msg = `ent ${ent?.id} of type ${ent.constructor.name} is not visible because privacy policy is not properly configured`;
    }
    super(msg);
    this.privacyPolicy = privacyPolicy;
    this.ent = ent;
  }
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
    if (v.viewerID && v.viewerID === ent?.id) {
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
    let result = this.fn(v, ent);
    if (isPromise(result)) {
      result = await result;
    }
    if (result) {
      return Allow();
    }
    return Skip();
  }
}

export class DenyIfFuncRule implements PrivacyPolicyRule {
  constructor(private fn: FuncRule) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    let result = this.fn(v, ent);
    if (isPromise(result)) {
      result = await result;
    }
    if (result) {
      return Deny();
    }
    return Skip();
  }
}

/**
 * @deprecated use AllowIfViewerIsEntPropertyRule
 */
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

export class AllowIfViewerIsEntPropertyRule<T extends Ent>
  implements PrivacyPolicyRule
{
  constructor(private property: keyof T) {}

  async apply(v: Viewer, ent?: T): Promise<PrivacyResult> {
    const result: any = ent && ent[this.property];
    if (result === v.viewerID) {
      return Allow();
    }
    return Skip();
  }
}

export class AllowIfEntPropertyIsRule<T extends Ent>
  implements PrivacyPolicyRule
{
  constructor(
    private property: keyof T,
    private val: any,
  ) {}

  async apply(v: Viewer, ent?: T): Promise<PrivacyResult> {
    const result: any = ent && ent[this.property];
    if (result === this.val) {
      return Allow();
    }
    return Skip();
  }
}

export class DenyIfEntPropertyIsRule<T extends Ent>
  implements PrivacyPolicyRule
{
  constructor(
    private property: keyof T,
    private val: any,
  ) {}

  async apply(v: Viewer, ent?: T): Promise<PrivacyResult> {
    const result: any = ent && ent[this.property];
    if (result === this.val) {
      return Deny();
    }
    return Skip();
  }
}

export class AllowIfEntIsVisibleRule<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
> implements PrivacyPolicyRule
{
  constructor(
    private id: ID,
    private options: LoadEntOptions<TEnt, TViewer>,
  ) {}

  async apply(v: TViewer, _ent?: Ent): Promise<PrivacyResult> {
    const visible = await loadEnt(v, this.id, this.options);
    if (visible === null) {
      return Skip();
    }
    return Allow();
  }
}

export class AllowIfEntIsNotVisibleRule<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
> implements PrivacyPolicyRule
{
  constructor(
    private id: ID,
    private options: LoadEntOptions<TEnt, TViewer>,
  ) {}

  async apply(v: TViewer, _ent?: Ent): Promise<PrivacyResult> {
    const visible = await loadEnt(v, this.id, this.options);
    if (visible === null) {
      return Allow();
    }
    return Skip();
  }
}

export class AllowIfEntIsVisiblePolicy<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
> implements PrivacyPolicy<TEnt, TViewer>
{
  constructor(
    private id: ID,
    private options: LoadEntOptions<TEnt, TViewer>,
  ) {}

  rules = [new AllowIfEntIsVisibleRule(this.id, this.options), AlwaysDenyRule];
}

export class DenyIfEntIsVisiblePolicy<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
> implements PrivacyPolicy<TEnt, TViewer>
{
  constructor(
    private id: ID,
    private options: LoadEntOptions<TEnt, TViewer>,
  ) {}

  rules = [new DenyIfEntIsVisibleRule(this.id, this.options), AlwaysAllowRule];
}

export class DenyIfEntIsVisibleRule<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
> implements PrivacyPolicyRule<TEnt, TViewer>
{
  constructor(
    private id: ID,
    private options: LoadEntOptions<TEnt, TViewer>,
  ) {}

  async apply(v: TViewer, _ent?: Ent): Promise<PrivacyResult> {
    const visible = await loadEnt(v, this.id, this.options);
    if (visible === null) {
      return Skip();
    }
    return Deny();
  }
}

export class DenyIfEntIsNotVisibleRule<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer,
> implements PrivacyPolicyRule
{
  constructor(
    private id: ID,
    private options: LoadEntOptions<TEnt, TViewer>,
  ) {}

  async apply(v: TViewer, _ent?: Ent): Promise<PrivacyResult> {
    const visible = await loadEnt(v, this.id, this.options);
    if (visible === null) {
      return Deny();
    }
    return Skip();
  }
}

async function allowIfEdgeExistsRule(
  id1: ID | null | undefined,
  id2: ID | null | undefined,
  edgeType: string,
  context?: Context,
  options?: EdgeQueryableDataOptionsConfigureLoader,
): Promise<PrivacyResult> {
  if (id1 && id2) {
    const edge = await loadEdgeForID2({
      id1,
      edgeType,
      id2,
      context,
      ctr: AssocEdge,
      queryOptions: options,
    });
    if (edge) {
      return Allow();
    }
  }
  return Skip();
}

async function allowIfEdgeDoesNotExistRule(
  id1: ID | null | undefined,
  id2: ID | null | undefined,
  edgeType: string,
  context?: Context,
  options?: EdgeQueryableDataOptionsConfigureLoader,
): Promise<PrivacyResult> {
  if (!id1 || !id2) {
    return Allow();
  }
  const edge = await loadEdgeForID2({
    id1,
    edgeType,
    id2,
    context,
    ctr: AssocEdge,
    queryOptions: options,
  });
  if (!edge) {
    return Allow();
  }
  return Skip();
}

export class AllowIfEdgeExistsRule implements PrivacyPolicyRule {
  constructor(
    private id1: ID,
    private id2: ID,
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    return allowIfEdgeExistsRule(
      this.id1,
      this.id2,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

export class AllowIfEdgeDoesNotExistRule implements PrivacyPolicyRule {
  constructor(
    private id1: ID,
    private id2: ID,
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    return allowIfEdgeDoesNotExistRule(
      this.id1,
      this.id2,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

/**
 * @deprecated use AllowIfEdgeExistsFromViewerToEntRule
 * This is a privacy policy rule that checks if the viewer has an inbound edge to the ent.
 * e.g. does edge exist from viewer's id to ent's id
 */
export class AllowIfViewerInboundEdgeExistsRule implements PrivacyPolicyRule {
  constructor(
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    return allowIfEdgeExistsRule(
      v.viewerID,
      ent?.id,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

/**
 * This is a privacy policy rule that checks if edge exists from viewer's id to ent's id
 * Allows the viewer to see the ent if the edge exists
 */
export class AllowIfEdgeExistsFromViewerToEntRule extends AllowIfViewerInboundEdgeExistsRule {}

/**
 * @deprecated use AllowIfEdgeExistsFromEntToViewerRule
 * This is a privacy policy rule that checks if the viewer has an outbound edge to the ent.
 * e.g. does edge exist from ent's id to viewer's id
 */
export class AllowIfViewerOutboundEdgeExistsRule implements PrivacyPolicyRule {
  constructor(
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    return allowIfEdgeExistsRule(
      ent?.id,
      v.viewerID,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

/**
 * This is a privacy policy rule that checks if edge exists from ent's id to viewer's id
 */
export class AllowIfEdgeExistsFromEntToViewerRule extends AllowIfViewerOutboundEdgeExistsRule {}

/**
 * This is a privacy policy rule that checks if edge exists from viewer to id of given ent property
 */
export class AllowIfEdgeExistsFromViewerToEntPropertyRule<T extends Ent>
  implements PrivacyPolicyRule
{
  constructor(
    private property: keyof T,
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, ent?: T): Promise<PrivacyResult> {
    const result: any = ent && ent[this.property];
    return allowIfEdgeExistsRule(
      v.viewerID,
      result,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

export class AllowIfEdgeExistsFromEntPropertyToViewerRule<T extends Ent>
  implements PrivacyPolicyRule
{
  constructor(
    private property: keyof T,
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, ent?: T): Promise<PrivacyResult> {
    const result: any = ent && ent[this.property];
    return allowIfEdgeExistsRule(
      result,
      v.viewerID,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

async function denyIfEdgeExistsRule(
  id1: ID | null | undefined,
  id2: ID | null | undefined,
  edgeType: string,
  context?: Context,
  options?: EdgeQueryableDataOptionsConfigureLoader,
): Promise<PrivacyResult> {
  // edge doesn't exist if no viewer
  if (id1 && id2) {
    const edge = await loadEdgeForID2({
      id1,
      edgeType,
      id2,
      context,
      ctr: AssocEdge,
      queryOptions: options,
    });
    if (edge) {
      return Deny();
    }
  }
  return Skip();
}

async function denyIfEdgeDoesNotExistRule(
  id1: ID | null | undefined,
  id2: ID | null | undefined,
  edgeType: string,
  context?: Context,
  options?: EdgeQueryableDataOptionsConfigureLoader,
): Promise<PrivacyResult> {
  // edge doesn't exist if no viewer
  if (!id1 || !id2) {
    return Deny();
  }
  const edge = await loadEdgeForID2({
    id1,
    edgeType,
    id2,
    context,
    ctr: AssocEdge,
    queryOptions: options,
  });
  if (!edge) {
    return Deny();
  }
  return Skip();
}

export class DenyIfEdgeExistsRule implements PrivacyPolicyRule {
  constructor(
    private id1: ID,
    private id2: ID,
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    return denyIfEdgeExistsRule(
      this.id1,
      this.id2,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

/**
 * @deprecated use DenyIfEdgeExistsFromViewerToEntRule
 */
export class DenyIfViewerInboundEdgeExistsRule implements PrivacyPolicyRule {
  constructor(
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    return denyIfEdgeExistsRule(
      v.viewerID,
      ent?.id,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

/**
 * This is a privacy policy rule that checks if edge exists from viewer's id to ent's id
 * Denies the viewer from seeing the ent if the edge exists
 */
export class DenyIfEdgeExistsFromViewerToEntRule extends DenyIfViewerInboundEdgeExistsRule {}

/**
 * @deprecated use DenyIfEdgeExistsFromEntToViewerRule
 */
export class DenyIfViewerOutboundEdgeExistsRule implements PrivacyPolicyRule {
  constructor(
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    return denyIfEdgeExistsRule(
      ent?.id,
      v.viewerID,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

/**
 * This is a privacy policy rule that checks if edge exists from ent's id to viewer's id
 */
export class DenyIfEdgeExistsFromEntToViewerRule extends DenyIfViewerOutboundEdgeExistsRule {}

/**
 * @deprecated use DenyIfEdgeExistsFromViewerToEntPropertyRule
 */
export class DenyIfViewerInboundEdgeToEntPropertyExistsRule<T extends Ent>
  implements PrivacyPolicyRule
{
  constructor(
    private property: keyof T,
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, ent?: T): Promise<PrivacyResult> {
    const result: any = ent && ent[this.property];
    return denyIfEdgeExistsRule(
      v.viewerID,
      result,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

/**
 * This is a privacy policy rule that checks if edge exists from viewer's id to ent's id
 * Denies the viewer from seeing the ent if the edge exists
 */
export class DenyIfEdgeExistsFromViewerToEntPropertyRule<
  T extends Ent,
> extends DenyIfViewerInboundEdgeToEntPropertyExistsRule<T> {}

/**
 * @deprecated use DenyIfEdgeExistsFromEntToViewerPropertyRule
 */
export class DenyIfViewerOutboundEdgeToEntPropertyExistsRule<T extends Ent>
  implements PrivacyPolicyRule
{
  constructor(
    private property: keyof T,
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, ent?: T): Promise<PrivacyResult> {
    const result: any = ent && ent[this.property];
    return denyIfEdgeExistsRule(
      result,
      v.viewerID,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

/**
 * This is a privacy policy rule that checks if edge exists from ent's id to viewer's id
 * Denies the viewer from seeing the ent if the edge exists
 */
export class DenyIfEdgeExistsFromEntPropertyToViewerRule<
  T extends Ent,
> extends DenyIfViewerOutboundEdgeToEntPropertyExistsRule<T> {}

export class DenyIfEdgeDoesNotExistRule implements PrivacyPolicyRule {
  constructor(
    private id1: ID,
    private id2: ID,
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, _ent?: Ent): Promise<PrivacyResult> {
    return denyIfEdgeDoesNotExistRule(
      this.id1,
      this.id2,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

export class DenyIfViewerInboundEdgeDoesNotExistRule
  implements PrivacyPolicyRule
{
  constructor(
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    return denyIfEdgeDoesNotExistRule(
      v.viewerID,
      ent?.id,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

export class DenyIfViewerOutboundEdgeDoesNotExistRule
  implements PrivacyPolicyRule
{
  constructor(
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    return denyIfEdgeDoesNotExistRule(
      ent?.id,
      v.viewerID,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

export class DenyIfViewerInboundEdgeToEntPropertyDoesNotExistRule<T extends Ent>
  implements PrivacyPolicyRule
{
  constructor(
    private property: keyof T,
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, ent?: T): Promise<PrivacyResult> {
    const result: any = ent && ent[this.property];
    return denyIfEdgeDoesNotExistRule(
      v.viewerID,
      result,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

export class DenyIfViewerOutboundEdgeToEntPropertyDoesNotExistRule<
  T extends Ent,
> implements PrivacyPolicyRule
{
  constructor(
    private property: keyof T,
    private edgeType: string,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {}

  async apply(v: Viewer, ent?: T): Promise<PrivacyResult> {
    const result: any = ent && ent[this.property];
    return denyIfEdgeDoesNotExistRule(
      result,
      v.viewerID,
      this.edgeType,
      v.context,
      this.options,
    );
  }
}

// need a Deny version of this too
export class AllowIfConditionAppliesRule implements PrivacyPolicyRule {
  constructor(
    private fn: FuncRule,
    private rule: PrivacyPolicyRule,
  ) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    const result = await this.fn(v, ent);
    if (!result) {
      return Skip();
    }
    const r = await this.rule.apply(v, ent);
    return r.result === privacyResult.Allow ? Allow() : Skip();
  }
}

interface DelayedFuncRule {
  (
    v: Viewer,
    ent?: Ent,
  ): null | PrivacyPolicyRule | Promise<PrivacyPolicyRule | null>;
}

// use this when there's a computation needed to get the rule and then the privacy is applied on said rule
export class DelayedResultRule implements PrivacyPolicyRule {
  constructor(private fn: DelayedFuncRule) {}

  async apply(v: Viewer, ent?: Ent): Promise<PrivacyResult> {
    let rule = this.fn(v, ent);
    if (isPromise(rule)) {
      rule = await rule;
    }
    if (!rule) {
      return Skip();
    }

    return rule.apply(v, ent);
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
  const err = await applyPrivacyPolicyImpl(v, policy, ent);
  return err === null;
}

export async function applyPrivacyPolicyX(
  v: Viewer,
  policy: PrivacyPolicy,
  ent: Ent | undefined,
  throwErr?: () => Error,
): Promise<boolean> {
  const err = await applyPrivacyPolicyImpl(v, policy, ent, throwErr);
  if (err !== null) {
    throw err;
  }
  return true;
}

// this will throw an exception if fails or return error | null?
export async function applyPrivacyPolicyImpl(
  v: Viewer,
  policy: PrivacyPolicy,
  ent: Ent | undefined,
  throwErr?: () => Error,
): Promise<Error | null> {
  for (const rule of policy.rules) {
    const res = await rule.apply(v, ent);
    if (res.result == privacyResult.Allow) {
      return null;
    } else if (res.result == privacyResult.Deny) {
      // specific error throw that
      if (res.error) {
        return res.error;
      }
      if (res.getError) {
        return res.getError(policy, rule, ent);
      }
      if (throwErr) {
        return throwErr();
      }
      return new EntPrivacyError(policy, rule, ent);
    }
  }

  return new EntInvalidPrivacyPolicyError(policy, ent);
}

export const AlwaysAllowPrivacyPolicy: PrivacyPolicy = {
  rules: [AlwaysAllowRule],
};

export const AlwaysDenyPrivacyPolicy: PrivacyPolicy = {
  rules: [AlwaysDenyRule],
};

export const AllowIfViewerPrivacyPolicy: PrivacyPolicy = {
  rules: [AllowIfViewerRule, AlwaysDenyRule],
};

export const AllowIfViewerHasIdentityPrivacyPolicy: PrivacyPolicy = {
  rules: [AllowIfHasIdentity, AlwaysDenyRule],
};
