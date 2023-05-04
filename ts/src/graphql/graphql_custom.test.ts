import {
  gqlField,
  GQLCapture,
  CustomFieldType,
  gqlMutation,
  gqlInputObjectType,
  gqlObjectType,
  gqlQuery,
  gqlContextType,
  gqlFileUpload,
  gqlConnection,
} from "./graphql";
import { GraphQLBoolean, GraphQLID, GraphQLString } from "graphql";
import { ID, Viewer } from "../core/base";

import {
  validateCustomFields,
  validateNoCustom,
  validateNoCustomArgs,
  validateCustomInputObjects,
  validateCustomObjects,
  validateCustomMutations,
  validateCustomQueries,
  CustomObjectTypes,
  validateNoCustomQueries,
  validateCustomTypes,
} from "./graphql_field_helpers";
import { RequestContext } from "../core/context";

beforeEach(() => {
  GQLCapture.clear();
  GQLCapture.enable(true);
});

test("mutation with input type", async () => {
  @gqlInputObjectType({
    name: "UserAuthInput",
  })
  class UserAuthInput {
    @gqlField({
      nodeName: "UserAuthInput",
      type: GraphQLString,
    })
    emailAddress: string;

    @gqlField({
      nodeName: "UserAuthInput",
      type: GraphQLString,
    })
    password: string;
  }

  @gqlObjectType({
    name: "UserAuthResponse",
  })
  class UserAuthResponse {
    @gqlField({
      nodeName: "UserAuthResponse",
      type: GraphQLString,
    })
    token: string;

    @gqlField({
      nodeName: "UserAuthResponse",
      type: GraphQLID,
    })
    viewerID: ID;
  }

  class UserAuth {
    // can't have decorator on a top-level function :(
    @gqlMutation({
      nodeName: "UserAuth",
      name: "userAuth",
      type: UserAuthResponse,
      async: true,
      args: [
        {
          name: "input",
          type: UserAuthInput,
        },
      ],
    })
    async userAuth(input: UserAuthInput): Promise<UserAuthResponse> {
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
    @gqlField({
      nodeName: "UserAuthResponse",
      type: GraphQLString,
    })
    token: string;

    @gqlField({
      nodeName: "UserAuthResponse",
      type: GraphQLID,
    })
    viewerID: ID;
  }

  // wow this needs to be a different class name
  class UserAuth {
    // can't have decorator on a top-level function :(
    @gqlMutation({
      nodeName: "UserAuth",
      name: "userAuth",
      type: UserAuthResponse,
      async: true,
      args: [
        {
          name: "emailAddress",
          type: GraphQLString,
        },
        {
          name: "password",
          type: GraphQLString,
        },
      ],
    })
    // This needs to be named differently because metadata :(
    async userAuthDiff(
      emailAddress: string,
      password: string,
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

  validateNoCustom(
    CustomObjectTypes.Field,
    CustomObjectTypes.Mutation,
    CustomObjectTypes.Object,
  );

  GQLCapture.resolve([]);
});

test("mutation with no args", () => {
  class Logger {
    @gqlMutation({
      nodeName: "Logger",
    })
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
  validateNoCustom(CustomObjectTypes.Mutation);
  GQLCapture.resolve([]);
});

test("query with return type", () => {
  @gqlObjectType({ name: "Viewer" })
  class ViewerType {
    constructor(private viewer: Viewer) {}
    @gqlField({
      nodeName: "ViewerType",
      type: GraphQLID,
      nullable: true,
    })
    get viewerID() {
      return this.viewer.viewerID;
    }
  }

  class ViewerResolver {
    @gqlQuery({
      nodeName: "ViewerResolver",
      type: ViewerType,
      args: [gqlContextType()],
    })
    viewer(context: RequestContext): ViewerType {
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

  validateNoCustom(
    CustomObjectTypes.Field,
    CustomObjectTypes.Object,
    CustomObjectTypes.Query,
  );

  GQLCapture.resolve([]);
});

test("query with list return type", () => {
  @gqlObjectType({ name: "Viewer" })
  class ViewerType {
    constructor(private viewer: Viewer) {}
    @gqlField({
      nodeName: "ViewerType",
      type: GraphQLID,
      nullable: true,
    })
    get viewerID() {
      return this.viewer.viewerID;
    }
  }

  class ViewerResolver {
    @gqlQuery({
      nodeName: "ViewerResolver",
      type: "[ViewerType]",
      args: [gqlContextType()],
    })
    viewer(context: RequestContext): [ViewerType] {
      return [new ViewerType(context.getViewer())];
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
          list: true,
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

  validateNoCustom(
    CustomObjectTypes.Field,
    CustomObjectTypes.Object,
    CustomObjectTypes.Query,
  );

  GQLCapture.resolve([]);
});

test("query which returns connection", async () => {
  class ViewerResolver {
    @gqlQuery({
      nodeName: "ViewerResolver",
      type: gqlConnection("User"),
      name: "peopleYouMayKnow",
    })
    pymk() {
      return 1;
    }
  }

  validateCustomQueries([
    {
      nodeName: "ViewerResolver",
      functionName: "pymk",
      gqlName: "peopleYouMayKnow",
      fieldType: CustomFieldType.Function,
      results: [
        {
          type: "User",
          needsResolving: true,
          connection: true,
          name: "",
        },
      ],
      args: [],
    },
  ]);

  GQLCapture.resolve(["User"]);
  validateNoCustom(CustomObjectTypes.Query);
});

test("query with args which returns connection", async () => {
  class ViewerResolver {
    @gqlQuery({
      nodeName: "ViewerResolver",
      type: gqlConnection("User"),
      name: "peopleYouMayKnow",
      args: [
        gqlContextType(),
        {
          name: "id",
          type: GraphQLID,
        },
      ],
    })
    pymk(context: RequestContext, id: ID) {
      return 1;
    }
  }

  validateCustomQueries([
    {
      nodeName: "ViewerResolver",
      functionName: "pymk",
      gqlName: "peopleYouMayKnow",
      fieldType: CustomFieldType.Function,
      results: [
        {
          type: "User",
          needsResolving: true,
          connection: true,
          name: "",
        },
      ],
      args: [
        {
          type: "Context",
          isContextArg: true,
          name: "context",
          needsResolving: true,
        },
        {
          type: "ID",
          name: "id",
        },
      ],
    },
  ]);

  GQLCapture.resolve(["User"]);
  validateNoCustom(CustomObjectTypes.Query);
});

test("custom type", () => {
  class ProfilePictureUploadResolver {
    @gqlMutation({
      nodeName: "ProfilePictureUploadResolver",
      name: "profilePictureUpload",
      type: GraphQLBoolean,
      args: [
        gqlContextType(),
        {
          name: "file",
          type: gqlFileUpload,
        },
      ],
    })
    profilePictureUpload(context: RequestContext, file) {
      // yay successful upload
      return true;
    }
  }

  validateCustomMutations([
    {
      nodeName: "ProfilePictureUploadResolver",
      functionName: "profilePictureUpload",
      gqlName: "profilePictureUpload",
      fieldType: CustomFieldType.Function,
      results: [
        {
          type: "Boolean",
          name: "",
          tsType: "boolean",
        },
      ],
      args: [
        {
          type: "Context",
          name: "context",
          needsResolving: true,
          isContextArg: true,
        },
        {
          type: "GraphQLUpload",
          name: "file",
          needsResolving: true,
          tsType: "FileUpload",
        },
      ],
    },
  ]);

  validateCustomTypes([gqlFileUpload]);

  validateNoCustom(CustomObjectTypes.Mutation, CustomObjectTypes.CustomTypes);
  GQLCapture.resolve([]);
});
