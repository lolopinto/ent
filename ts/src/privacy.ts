import { Viewer, Ent, ID } from "./ent";

enum privacyResult {
  // using http status codes similar to golang for the lols
  Allow = 200,
  Deny = 401,
  Skip = 307,
}

interface PrivacyResult {
  result: privacyResult;
  error?: PrivacyError;
}

interface PrivacyError extends Error {
  entID: ID;
}

class EntPrivacyError extends Error implements PrivacyError {
  constructor(public entID: ID) {
    super(`ent ${entID} is not visible for privacy reasons`);
  }
}

class EntInvalidPrivacyPolicyError extends Error implements PrivacyError {
  constructor(public entID: ID) {
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
  apply(v: Viewer, ent: Ent): Promise<PrivacyResult>;
}

// export interface PrivacyPolicyRuleSync {
//   apply(v: Viewer, ent: Ent): PrivacyResult;
// }

export interface PrivacyPolicy {
  //  rules: PrivacyPolicyRule | PrivacyPolicyRuleSync[];
  rules: PrivacyPolicyRule[];
}

export const AlwaysAllowRule = {
  async apply(v: Viewer, ent: Ent): Promise<PrivacyResult> {
    return Allow();
  },
};

export const AlwaysDenyRule = {
  async apply(v: Viewer, ent: Ent): Promise<PrivacyResult> {
    return Deny();
  },
};

export const DenyIfLoggedOutRule = {
  async apply(v: Viewer, ent: Ent): Promise<PrivacyResult> {
    if (v.viewerID === null || v.viewerID == undefined) {
      return Deny();
    }
    return Skip();
  },
};

export const AllowIfViewerRule = {
  async apply(v: Viewer, ent: Ent): Promise<PrivacyResult> {
    if (v.viewerID == ent.id) {
      return Allow();
    }
    return Skip();
  },
};

export class AllowIfFuncRule implements PrivacyPolicyRule {
  constructor(private fn: (v: Viewer, ent: Ent) => Promise<boolean>) {}

  async apply(v: Viewer, ent: Ent): Promise<PrivacyResult> {
    const result = await this.fn(v, ent);
    if (result) {
      return Allow();
    }
    return Skip();
  }
}

export class AllowIfViewerIsRule implements PrivacyPolicyRule {
  constructor(private property: string) {}

  async apply(v: Viewer, ent: Ent): Promise<PrivacyResult> {
    const result = ent[this.property];
    if (result === v.viewerID) {
      return Allow();
    }
    return Skip();
  }
}

export async function applyPrivacyPolicy(
  v: Viewer,
  policy: PrivacyPolicy,
  ent: Ent,
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
  ent: Ent,
): Promise<boolean> {
  // right now we apply all at same time. todo: be smart about this in the future
  const results = await Promise.all(
    policy.rules.map(rule => rule.apply(v, ent)),
  );
  for (const res of results) {
    if (res.result == privacyResult.Allow) {
      return true;
    } else if (res.result == privacyResult.Deny) {
      // specific error throw that
      if (res.error) {
        throw res.error;
      }
      throw new EntPrivacyError(ent.id);
    }
  }

  throw new EntInvalidPrivacyPolicyError(ent.id);
}
