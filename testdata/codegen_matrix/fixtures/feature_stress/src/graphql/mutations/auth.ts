import { RequestContext } from "@snowtop/ent";

export class NamedNode {
  name: string;
}

export class ThirdPartyLogin {
  constructor(token: string, newAccount: boolean) {
    this.token = token;
    this.newAccount = newAccount;
  }

  token: string;
  newAccount: boolean;
}

export class LoginInput {
  identityToken: string;
}

export class RootResolver {
  async loginWithApple(
    _context: RequestContext,
    input: LoginInput,
  ): Promise<ThirdPartyLogin> {
    return new ThirdPartyLogin(input.identityToken, false);
  }
}
