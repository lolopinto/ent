import {
  expectQueryFromRoot,
  queryRootConfig,
} from "@snowtop/ent-graphql-tests";
import { encodeGQLID, mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { User, Comment } from "src/ent";
import CreateCommentAction from "src/ent/comment/actions/create_comment_action";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import { randomEmail, randomPhoneNumber } from "src/util/random";
import { ExampleViewer, LoggedOutExampleViewer } from "src/viewer/viewer";
import schema from "../generated/schema";

const createUser = async () => {
  return CreateUserAction.create(new LoggedOutExampleViewer(), {
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
    password: "pa$$w0rd",
    phoneNumber: randomPhoneNumber(),
  }).saveX();
};

function getUserConfig(
  viewer: ExampleViewer,
  user: User,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    viewer: viewer,
    schema: schema,
    root: "node",
    inlineFragmentRoot: "User",
    args: {
      id: encodeGQLID(user),
    },
    ...partialConfig,
  };
}
function getCommentConfig(
  viewer: ExampleViewer,
  comment: Comment,
  partialConfig?: Partial<queryRootConfig>,
): queryRootConfig {
  return {
    viewer: viewer,
    schema: schema,
    root: "node",
    inlineFragmentRoot: "Comment",
    args: {
      id: encodeGQLID(comment),
    },
    ...partialConfig,
  };
}

test("query and fetch all accessors", async () => {
  const user = await createUser();
  const user2 = await createUser();
  const user3 = await createUser();

  const commentOnUser1 = await CreateCommentAction.create(user.viewer, {
    authorId: user.id,
    body: "sup",
    articleId: user.id,
    articleType: user.nodeType,
  }).saveX();
  const commentOnUser2 = await CreateCommentAction.create(user.viewer, {
    authorId: user.id,
    body: "sup",
    articleId: user.id,
    articleType: user.nodeType,
  }).saveX();
  const commentOnUser3 = await CreateCommentAction.create(user.viewer, {
    authorId: user.id,
    body: "sup",
    articleId: user.id,
    articleType: user.nodeType,
  }).saveX();

  const commentOnComment1 = await CreateCommentAction.create(user.viewer, {
    authorId: user.id,
    body: "sup",
    articleId: commentOnUser1.id,
    articleType: commentOnUser1.nodeType,
  }).saveX();
  const commentOnComment2 = await CreateCommentAction.create(user.viewer, {
    authorId: user2.id,
    body: "sup",
    articleId: commentOnUser1.id,
    articleType: commentOnUser1.nodeType,
  }).saveX();
  const commentOnComment3 = await CreateCommentAction.create(user.viewer, {
    authorId: user3.id,
    body: "sup",
    articleId: commentOnUser1.id,
    articleType: commentOnUser1.nodeType,
  }).saveX();

  await expectQueryFromRoot(
    getUserConfig(user.viewer, user),
    ["id", encodeGQLID(user)],
    [
      "articles(first: 100) { edges { node { id } } }",
      function (data: any) {
        expect(data.edges.length).toBe(3);
        const ids = data.edges.map((edge: any) =>
          mustDecodeIDFromGQLID(edge.node.id),
        );
        expect(ids.sort()).toStrictEqual(
          [commentOnUser1.id, commentOnUser2.id, commentOnUser3.id].sort(),
        );
      },
    ],
    [
      "commentsFromUser(first: 100) { edges { node { id } } }",
      function (data: any) {
        expect(data.edges.length).toBe(4);
        const ids = data.edges.map((edge: any) =>
          mustDecodeIDFromGQLID(edge.node.id),
        );
        expect(ids.sort()).toStrictEqual(
          [
            commentOnUser1.id,
            commentOnUser2.id,
            commentOnUser3.id,
            commentOnComment1.id,
          ].sort(),
        );
      },
    ],
  );

  await expectQueryFromRoot(
    getCommentConfig(commentOnUser1.viewer, commentOnUser1),
    ["id", encodeGQLID(commentOnUser1)],
    [
      "articles(first: 100) { edges { node { id } } }",
      function (data: any) {
        expect(data.edges.length).toBe(3);
        const ids = data.edges.map((edge: any) =>
          mustDecodeIDFromGQLID(edge.node.id),
        );
        expect(ids.sort()).toStrictEqual(
          [
            commentOnComment1.id,
            commentOnComment2.id,
            commentOnComment3.id,
          ].sort(),
        );
      },
    ],
  );
});
