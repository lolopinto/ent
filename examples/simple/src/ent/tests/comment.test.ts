import { randomEmail, randomPhoneNumber } from "src/util/random";
import { LoggedOutExampleViewer } from "src/viewer/viewer";
import CreateCommentAction from "../comment/actions/create_comment_action";
import EditCommentAction from "../comment/actions/edit_comment_action";
import CreateUserAction from "../user/actions/create_user_action";
import EditUserAction from "../user/actions/edit_user_action";
import {
  ArticleToCommentsQuery,
  ArticlesFromCommentToCommentsQuery,
  ArticlesFromUserToCommentsQuery,
} from "..";

const createUser = async () => {
  return CreateUserAction.create(new LoggedOutExampleViewer(), {
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
    password: "pa$$w0rd",
    phoneNumber: randomPhoneNumber(),
  }).saveX();
};

const create = async () => {
  const user = await createUser();

  // comment on self
  const comment = await CreateCommentAction.create(user.viewer, {
    authorID: user.id,
    body: "sup",
    articleID: user.id,
    articleType: user.nodeType,
  }).saveX();
  expect(comment.body).toBe("sup");
  return comment;
};

test("create", async () => {
  await create();
});

test("edit", async () => {
  const comment = await create();
  const user2 = await createUser();

  const user1 = await comment.loadAuthorX();
  const userAction = EditUserAction.create(user1.viewer, user1, {});
  // privacy
  userAction.builder.addFriend(user2);
  await userAction.saveX();

  const action = EditCommentAction.create(comment.viewer, comment, {});
  action.builder.overrideAuthorID(user2.id);

  const edited = await action.saveX();

  const author = await edited.loadAuthorX();
  expect(author.id).toBe(user2.id);
});

test("edit authorID incorrectly", async () => {
  const comment = await create();
  const user2 = await createUser();

  const user1 = await comment.loadAuthorX();
  const userAction = EditUserAction.create(user1.viewer, user1, {});
  // privacy
  userAction.builder.addFriend(user2);
  await userAction.saveX();

  const action = EditCommentAction.create(comment.viewer, comment, {});

  try {
    action.builder.updateInput({
      body: "ss",
      authorID: "hello",
    });
    throw new Error(`should have thrown`);
  } catch (err) {
    expect((err as Error).message).toBe(
      "authorID cannot be passed to updateInput. use overrideAuthorID instead",
    );
  }
});

test("create comment and query different ways", async () => {
  const user = await createUser();
  const user2 = await createUser();
  const user3 = await createUser();

  const commentOnUser1 = await CreateCommentAction.create(user.viewer, {
    authorID: user.id,
    body: "sup",
    articleID: user.id,
    articleType: user.nodeType,
  }).saveX();
  const commentOnUser2 = await CreateCommentAction.create(user.viewer, {
    authorID: user.id,
    body: "sup",
    articleID: user.id,
    articleType: user.nodeType,
  }).saveX();
  const commentOnUser3 = await CreateCommentAction.create(user.viewer, {
    authorID: user.id,
    body: "sup",
    articleID: user.id,
    articleType: user.nodeType,
  }).saveX();

  const commentOnComment1 = await CreateCommentAction.create(user.viewer, {
    authorID: user.id,
    body: "sup",
    articleID: commentOnUser1.id,
    articleType: commentOnUser1.nodeType,
  }).saveX();
  const commentOnComment2 = await CreateCommentAction.create(user.viewer, {
    authorID: user2.id,
    body: "sup",
    articleID: commentOnUser1.id,
    articleType: commentOnUser1.nodeType,
  }).saveX();
  const commentOnComment3 = await CreateCommentAction.create(user.viewer, {
    authorID: user3.id,
    body: "sup",
    articleID: commentOnUser1.id,
    articleType: commentOnUser1.nodeType,
  }).saveX();

  const comments = await ArticleToCommentsQuery.query(
    user.viewer,
    user,
  ).queryEnts();
  expect(comments.length).toBe(3);
  expect(comments.map((c) => c.id).sort()).toStrictEqual(
    [commentOnUser1.id, commentOnUser2.id, commentOnUser3.id].sort(),
  );

  // TODO change base class here to have User type in constructor

  // fetching from user only. it's basically same as ArticleToCommentsQuery
  // just can have different privacy policy
  const comments2 = await ArticlesFromUserToCommentsQuery.query(
    user.viewer,
    user,
  ).queryEnts();
  expect(comments2.length).toBe(3);
  expect(comments2.map((c) => c.id).sort()).toStrictEqual(
    [commentOnUser1.id, commentOnUser2.id, commentOnUser3.id].sort(),
  );

  const comments3 = await ArticleToCommentsQuery.query(
    user.viewer,
    commentOnUser1,
  ).queryEnts();
  expect(comments3.length).toBe(3);
  expect(comments3.map((c) => c.id).sort()).toStrictEqual(
    [commentOnComment1.id, commentOnComment2.id, commentOnComment3.id].sort(),
  );

  // TODO change base class here to have Comment in constructor

  // fetching from comment only. it's basically same as ArticleToCommentsQuery
  // just can have different privacy policy
  const comments4 = await ArticlesFromCommentToCommentsQuery.query(
    user.viewer,
    commentOnUser1,
  ).queryEnts();
  expect(comments4.length).toBe(3);
  expect(comments4.map((c) => c.id).sort()).toStrictEqual(
    [commentOnComment1.id, commentOnComment2.id, commentOnComment3.id].sort(),
  );
});
