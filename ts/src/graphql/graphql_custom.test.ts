import {
  gqlField,
  gqlArg,
  GQLCapture,
  CustomFieldType,
  gqlMutation,
  gqlInputObjectType,
  gqlObjectType,
  gqlQuery,
  gqlContextType,
} from "./graphql";
import { GraphQLID } from "graphql";
import { ID, Viewer } from "../core/ent";

import {
  validateCustomFields,
  validateNoCustom,
  validateNoCustomArgs,
  validateCustomInputObjects,
  validateCustomObjects,
  validateCustomMutations,
  validateCustomQueries,
  CustomTypes,
  validateNoCustomQueries,
} from "./scalars/graphql_field_helpers";
import { RequestContext } from "../auth/context";

beforeEach(() => {
  GQLCapture.clear();
  GQLCapture.enable(true);
});

test("mutation with input type", async () => {
  @gqlInputObjectType({
    name: "UserAuthInput",
  })
  class UserAuthInput {
    @gqlField()
    emailAddress: string;

    @gqlField()
    password: string;
  }

  @gqlObjectType({
    name: "UserAuthResponse",
  })
  class UserAuthResponse {
    @gqlField()
    token: string;

    @gqlField({ type: GraphQLID })
    viewerID: ID;
  }

  class UserAuth {
    // can't have decorator on a top-level function :(
    @gqlMutation({ name: "userAuth", type: UserAuthResponse })
    async userAuth(
      @gqlArg("input") input: UserAuthInput,
    ): Promise<UserAuthResponse> {
      console.log(input.emailAddress);
      console.log(input.password);
      return new UserAuthResponse();
    }
  }
  validateCustomFields([
    {
      nodeName: "UserAuthInput",
      functionName: "emailAddress",
      gqlName: "emailAddress",
      fieldType: CustomFieldType.Field,
      results: [
        {
          type: "String",
          name: "",
        },
      ],
      args: [],
    },
    {
      nodeName: "UserAuthInput",
      functionName: "password",
      gqlName: "password",
      fieldType: CustomFieldType.Field,
      results: [
        {
          type: "String",
          name: "",
        },
      ],
      args: [],
    },
    {
      nodeName: "UserAuthResponse",
      functionName: "token",
      gqlName: "token",
      fieldType: CustomFieldType.Field,
      results: [
        {
          type: "String",
          name: "",
        },
      ],
      args: [],
    },
    {
      nodeName: "UserAuthResponse",
      functionName: "viewerID",
      gqlName: "viewerID",
      fieldType: CustomFieldType.Field,
      results: [
        {
          type: "ID",
          name: "",
        },
      ],
      args: [],
    },
  ]);

  validateCustomInputObjects([
    {
      nodeName: "UserAuthInput",
      className: "UserAuthInput",
    },
  ]);

  validateCustomObjects([
    {
      nodeName: "UserAuthResponse",
      className: "UserAuthResponse",
    },
  ]);

  validateCustomMutations([
    {
      nodeName: "UserAuth",
      functionName: "userAuth",
      gqlName: "userAuth",
      fieldType: CustomFieldType.AsyncFunction,
      results: [
        {
          type: "UserAuthResponse",
          name: "",
          needsResolving: true,
        },
      ],
      args: [
        {
          type: "UserAuthInput",
          name: "input",
          needsResolving: true,
        },
      ],
    },
  ]);
  validateNoCustomArgs();
  validateNoCustomQueries();

  GQLCapture.resolve([]);
});

test("mutation with different types", async () => {
  @gqlObjectType({
    name: "UserAuthResponse",
  })
  class UserAuthResponse {
    @gqlField()
    token: string;

    @gqlField({ type: GraphQLID })
    viewerID: ID;
  }

  // wow this needs to be a different class name
  class UserAuth {
    // can't have decorator on a top-level function :(
    @gqlMutation({ name: "userAuth", type: UserAuthResponse })
    // This needs to be named differently because metadata :(
    async userAuthDiff(
      @gqlArg("emailAddress") emailAddress: string,
      @gqlArg("password") password: string,
    ): Promise<UserAuthResponse> {
      console.log(emailAddress);
      console.log(password);
      return new UserAuthResponse();
    }
  }
  validateCustomFields([
    {
      nodeName: "UserAuthResponse",
      functionName: "token",
      gqlName: "token",
      fieldType: CustomFieldType.Field,
      results: [
        {
          type: "String",
          name: "",
        },
      ],
      args: [],
    },
    {
      nodeName: "UserAuthResponse",
      functionName: "viewerID",
      gqlName: "viewerID",
      fieldType: CustomFieldType.Field,
      results: [
        {
          type: "ID",
          name: "",
        },
      ],
      args: [],
    },
  ]);

  validateCustomObjects([
    {
      nodeName: "UserAuthResponse",
      className: "UserAuthResponse",
    },
  ]);

  validateCustomMutations([
    {
      nodeName: "UserAuth",
      functionName: "userAuthDiff",
      gqlName: "userAuth",
      fieldType: CustomFieldType.AsyncFunction,
      results: [
        {
          type: "UserAuthResponse",
          name: "",
          needsResolving: true,
        },
      ],
      args: [
        {
          type: "String",
          name: "emailAddress",
        },
        {
          type: "String",
          name: "password",
        },
      ],
    },
  ]);

  validateNoCustom(CustomTypes.Field, CustomTypes.Mutation, CustomTypes.Object);

  GQLCapture.resolve([]);
});

test("mutation with no args", () => {
  class Logger {
    @gqlMutation()
    logActiveUser() {}
  }

  validateCustomMutations([
    {
      nodeName: "Logger",
      functionName: "logActiveUser",
      gqlName: "logActiveUser",
      fieldType: CustomFieldType.Function,
      results: [],
      args: [],
    },
  ]);
  validateNoCustom(CustomTypes.Mutation);
  GQLCapture.resolve([]);
});

test("query with return type", () => {
  @gqlObjectType({ name: "Viewer" })
  class ViewerType {
    constructor(private viewer: Viewer) {}
    @gqlField({ type: GraphQLID, nullable: true })
    get viewerID() {
      return this.viewer.viewerID;
    }

    // user, friends, etc all come here
  }

  class ViewerResolver {
    @gqlQuery({ type: ViewerType })
    viewer(@gqlContextType() context: RequestContext): ViewerType {
      return new ViewerType(context.getViewer());
    }
  }

  validateCustomQueries([
    {
      nodeName: "ViewerResolver",
      functionName: "viewer",
      gqlName: "viewer",
      fieldType: CustomFieldType.Function,
      results: [
        {
          type: "ViewerType", // there needs to be something else that does the translation to Viewer
          needsResolving: true,
          name: "",
        },
      ],
      args: [
        {
          type: "Context",
          name: "context",
          needsResolving: true,
          isContextArg: true,
        },
      ],
    },
  ]);

  validateCustomObjects([
    {
      nodeName: "Viewer",
      className: "ViewerType",
    },
  ]);

  validateCustomFields([
    {
      nodeName: "ViewerType",
      functionName: "viewerID",
      gqlName: "viewerID",
      fieldType: CustomFieldType.Accessor,
      results: [
        {
          type: "ID",
          name: "",
          nullable: true,
        },
      ],
      args: [],
    },
  ]);

  validateNoCustom(CustomTypes.Field, CustomTypes.Object, CustomTypes.Query);

  GQLCapture.resolve([]);
});
