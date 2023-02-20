import { randomEmail, randomPhoneNumber } from "src/util/random";
import { LoggedOutExampleViewer } from "src/viewer/viewer";
import CreateCommentAction from "../comment/actions/create_comment_action";
import EditCommentAction from "../comment/actions/edit_comment_action";
import CreateUserAction from "../user/actions/create_user_action";
import EditUserAction from "../user/actions/edit_user_action";

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

  action.builder.updateInput({
    body: "ss",
    authorID: "hello",
  });
});
