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
  gqlInterfaceType,
  gqlUnionType,
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
  validateCustomInterfaces,
  validateCustomUnions,
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
      class: "UserAuthInput",
      type: GraphQLString,
    })
    emailAddress: string;

    @gqlField({
      class: "UserAuthInput",
      type: GraphQLString,
    })
    password: string;
  }

  @gqlObjectType({
    name: "UserAuthResponse",
  })
  class UserAuthResponse {
    @gqlField({
      class: "UserAuthResponse",
      type: GraphQLString,
    })
    token: string;

    @gqlField({
      class: "UserAuthResponse",
      type: GraphQLID,
    })
    viewerID: ID;
  }

  class UserAuth {
    @gqlMutation({
      class: "UserAuth",
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
      class: "UserAuthResponse",
      type: GraphQLString,
    })
    token: string;

    @gqlField({
      class: "UserAuthResponse",
      type: GraphQLID,
    })
    viewerID: ID;
  }

  // wow this needs to be a different class name
  class UserAuth {
    @gqlMutation({
      class: "UserAuth",
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
      class: "Logger",
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
      class: "ViewerType",
      type: GraphQLID,
      nullable: true,
    })
    get viewerID() {
      return this.viewer.viewerID;
    }
  }

  class ViewerResolver {
    @gqlQuery({
      class: "ViewerResolver",
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
      class: "ViewerType",
      type: GraphQLID,
      nullable: true,
    })
    get viewerID() {
      return this.viewer.viewerID;
    }
  }

  class ViewerResolver {
    @gqlQuery({
      class: "ViewerResolver",
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
      class: "ViewerResolver",
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
      class: "ViewerResolver",
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
      class: "ProfilePictureUploadResolver",
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

test("custom interface", async () => {
  @gqlInterfaceType({
    name: "AuthResponse",
  })
  // decorators not valid on interfaces so have to add them to a class
  // doesn't have to be abstract, but it can be
  abstract class AuthResponse {
    @gqlField({
      class: "AuthResponse",
      type: GraphQLString,
    })
    token: string;

    @gqlField({
      class: "AuthResponse",
      type: GraphQLID,
    })
    viewerID: ID;
  }

  @gqlObjectType({
    name: "UserAuthResponse",
    interfaces: ["AuthResponse"],
  })
  class UserAuthResponse extends AuthResponse {}

  @gqlObjectType({
    name: "GuestAuthResponse",
    interfaces: ["AuthResponse"],
  })
  class GuestAuthResponse extends AuthResponse {
    @gqlField({
      class: "GuestAuthResponse",
      type: GraphQLBoolean,
    })
    guest: Boolean;
  }

  class Auth {
    @gqlMutation({
      class: "Auth",
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
    async userAuth(
      emailAddress: string,
      password: string,
    ): Promise<UserAuthResponse> {
      console.log(emailAddress);
      console.log(password);
      return new UserAuthResponse();
    }

    @gqlMutation({
      class: "Auth",
      name: "guestAuth",
      type: GuestAuthResponse,
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
    async guestAuth(
      emailAddress: string,
      password: string,
    ): Promise<UserAuthResponse> {
      console.log(emailAddress);
      console.log(password);
      return new GuestAuthResponse();
    }
  }

  // resolve first
  // because we need fields copied over from interface to custom object
  GQLCapture.resolve([]);

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
    {
      nodeName: "GuestAuthResponse",
      functionName: "guest",
      gqlName: "guest",
      fieldType: CustomFieldType.Field,
      results: [
        {
          type: "Boolean",
          name: "",
        },
      ],
      args: [],
    },
    {
      nodeName: "GuestAuthResponse",
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
      nodeName: "GuestAuthResponse",
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

    {
      nodeName: "AuthResponse",
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
      nodeName: "AuthResponse",
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
      interfaces: ["AuthResponse"],
    },
    {
      nodeName: "GuestAuthResponse",
      className: "GuestAuthResponse",
      interfaces: ["AuthResponse"],
    },
  ]);

  validateCustomInterfaces([
    {
      nodeName: "AuthResponse",
      className: "AuthResponse",
    },
  ]);

  validateCustomMutations([
    {
      nodeName: "Auth",
      functionName: "userAuth",
      gqlName: "userAuth",
      fieldType: CustomFieldType.AsyncFunction,
      results: [
        {
          type: "UserAuthResponse",
          name: "",
          needsResolving: false,
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
    {
      nodeName: "Auth",
      functionName: "guestAuth",
      gqlName: "guestAuth",
      fieldType: CustomFieldType.AsyncFunction,
      results: [
        {
          type: "GuestAuthResponse",
          name: "",
          needsResolving: false,
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
    CustomObjectTypes.Interface,
  );
});

test("custom interface with fields also defined in class", async () => {
  @gqlInterfaceType({
    name: "AuthResponse",
  })
  // decorators not valid on interfaces so have to add them to a class
  // doesn't have to be abstract, but it can be
  abstract class AuthResponse {
    @gqlField({
      class: "AuthResponse",
      type: GraphQLString,
    })
    token: string;

    @gqlField({
      class: "AuthResponse",
      type: GraphQLID,
    })
    viewerID: ID;
  }

  @gqlObjectType({
    name: "UserAuthResponse",
    interfaces: ["AuthResponse"],
  })
  class UserAuthResponse extends AuthResponse {
    @gqlField({
      class: "UserAuthResponse",
      type: GraphQLID,
    })
    viewerID: ID;
  }

  class Auth {
    @gqlMutation({
      class: "Auth",
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
    async userAuth(
      emailAddress: string,
      password: string,
    ): Promise<UserAuthResponse> {
      console.log(emailAddress);
      console.log(password);
      return new UserAuthResponse();
    }
  }

  // resolve first
  // because we need fields copied over from interface to custom object
  GQLCapture.resolve([]);

  validateCustomFields([
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
      nodeName: "AuthResponse",
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
      nodeName: "AuthResponse",
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
      interfaces: ["AuthResponse"],
    },
  ]);

  validateCustomInterfaces([
    {
      nodeName: "AuthResponse",
      className: "AuthResponse",
    },
  ]);

  validateCustomMutations([
    {
      nodeName: "Auth",
      functionName: "userAuth",
      gqlName: "userAuth",
      fieldType: CustomFieldType.AsyncFunction,
      results: [
        {
          type: "UserAuthResponse",
          name: "",
          needsResolving: false,
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
    CustomObjectTypes.Interface,
  );
});

test("custom interface with fields also defined in class. different definition", async () => {
  @gqlInterfaceType({
    name: "AuthResponse",
  })
  abstract class AuthResponse {
    @gqlField({
      class: "AuthResponse",
      type: GraphQLString,
    })
    token: string;

    @gqlField({
      class: "AuthResponse",
      type: GraphQLID,
    })
    viewerID: ID;
  }

  @gqlObjectType({
    name: "UserAuthResponse",
    interfaces: ["AuthResponse"],
  })
  class UserAuthResponse extends AuthResponse {
    @gqlField({
      class: "UserAuthResponse",
      type: GraphQLID,
      nullable: true,
    })
    viewerID: ID;
  }

  class Auth {
    @gqlMutation({
      class: "Auth",
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
    async userAuth(
      emailAddress: string,
      password: string,
    ): Promise<UserAuthResponse> {
      console.log(emailAddress);
      console.log(password);
      return new UserAuthResponse();
    }
  }

  try {
    // resolve first
    // because we need fields copied over from interface to custom object
    GQLCapture.resolve([]);
    throw new Error("should not get here");
  } catch (e) {
    expect(e.message).toBe(
      "object UserAuthResponse has duplicate field viewerID with different definition",
    );
  }
});

test("referencing known interface e.g. Node", async () => {
  @gqlObjectType({
    name: "Guest",
    interfaces: ["Node"],
  })
  class Guest {
    @gqlField({
      class: "Guest",
      type: GraphQLID,
    })
    id: ID;
  }

  class Auth {
    @gqlMutation({
      class: "Auth",
      name: "guestAuth",
      type: Guest,
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
    async guestAuth(emailAddress: string, password: string): Promise<Guest> {
      console.log(emailAddress);
      console.log(password);
      return new Guest();
    }
  }

  GQLCapture.resolve(["Guest"]);

  validateCustomFields([
    {
      nodeName: "Guest",
      functionName: "id",
      gqlName: "id",
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
      nodeName: "Guest",
      className: "Guest",
      interfaces: ["Node"],
    },
  ]);

  validateCustomMutations([
    {
      nodeName: "Auth",
      functionName: "guestAuth",
      gqlName: "guestAuth",
      fieldType: CustomFieldType.AsyncFunction,
      results: [
        {
          type: "Guest",
          name: "",
          needsResolving: false,
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
});

test("referencing unknown interface", async () => {
  @gqlObjectType({
    name: "Guest",
    interfaces: ["Interface"],
  })
  class Guest {
    @gqlField({
      class: "Guest",
      type: GraphQLID,
    })
    id: ID;
  }

  class Auth {
    @gqlMutation({
      class: "Auth",
      name: "guestAuth",
      type: Guest,
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
    async guestAuth(emailAddress: string, password: string): Promise<Guest> {
      console.log(emailAddress);
      console.log(password);
      return new Guest();
    }
  }

  try {
    GQLCapture.resolve(["Guest"]);
  } catch (err) {
    expect((err as Error).message).toMatch(
      /object Guest references unknown interface Interface/,
    );
  }
});

test("custom union unknown types", async () => {
  @gqlUnionType({
    name: "SearchResult",
    unionTypes: ["User", "Post"],
  })
  class SearchResult {}

  try {
    GQLCapture.resolve([]);
    throw new Error("should throw");
  } catch (err) {
    expect(err.message).toMatch(
      /union SearchResult references User which isn't a graphql object/,
    );
  }
});

test("custom union known types", async () => {
  @gqlUnionType({
    name: "SearchResult",
    unionTypes: ["User", "Post"],
  })
  class SearchResult {}

  GQLCapture.resolve(["User", "Post"]);

  validateCustomUnions([
    {
      nodeName: "SearchResult",
      className: "SearchResult",
      unionTypes: ["User", "Post"],
    },
  ]);

  validateNoCustom(CustomObjectTypes.Union);
});

test("custom union with fields", async () => {
  @gqlUnionType({
    name: "SearchResult",
    unionTypes: ["User", "Post"],
  })
  class SearchResult {
    @gqlField({
      class: "SearchResult",
      type: GraphQLString,
    })
    search: string;
  }

  try {
    GQLCapture.resolve(["User", "Post"]);
    throw new Error("should throw");
  } catch (err) {
    expect(err.message).toMatch(
      /union SearchResult has custom fields which is not allowed/,
    );
  }
});

test("returning a union. custom union known types", async () => {
  @gqlUnionType({
    name: "SearchResult",
    unionTypes: ["User", "Post"],
  })
  class SearchResult {}

  class SearchResolver {
    @gqlQuery({
      class: "SearchResolver",
      name: "userSearch",
      type: SearchResult,
      async: true,
      args: [
        {
          name: "term",
          type: GraphQLString,
        },
      ],
    })
    async search(term: string): Promise<SearchResult> {
      console.log(term);
      return new SearchResult();
    }
  }

  GQLCapture.resolve(["User", "Post"]);

  validateCustomUnions([
    {
      nodeName: "SearchResult",
      className: "SearchResult",
      unionTypes: ["User", "Post"],
    },
  ]);

  validateCustomQueries([
    {
      nodeName: "SearchResolver",
      functionName: "search",
      gqlName: "userSearch",
      fieldType: CustomFieldType.AsyncFunction,
      results: [
        {
          type: "SearchResult",
          name: "",
          needsResolving: false,
        },
      ],
      args: [
        {
          type: "String",
          name: "term",
        },
      ],
    },
  ]);

  validateNoCustom(CustomObjectTypes.Union, CustomObjectTypes.Query);
});

test("returning an interface. custom interface", async () => {
  @gqlInterfaceType({
    name: "SearchResult",
  })
  class SearchResult {}

  class SearchResolver {
    @gqlQuery({
      class: "SearchResolver",
      name: "userSearch",
      type: SearchResult,
      async: true,
      args: [
        {
          name: "term",
          type: GraphQLString,
        },
      ],
    })
    async search(term: string): Promise<SearchResult> {
      console.log(term);
      return new SearchResult();
    }
  }

  GQLCapture.resolve(["User", "Post"]);

  validateCustomInterfaces([
    {
      nodeName: "SearchResult",
      className: "SearchResult",
    },
  ]);

  validateCustomQueries([
    {
      nodeName: "SearchResolver",
      functionName: "search",
      gqlName: "userSearch",
      fieldType: CustomFieldType.AsyncFunction,
      results: [
        {
          type: "SearchResult",
          name: "",
          needsResolving: false,
        },
      ],
      args: [
        {
          type: "String",
          name: "term",
        },
      ],
    },
  ]);

  validateNoCustom(CustomObjectTypes.Interface, CustomObjectTypes.Query);
});

// TODO throw if a union has fields
