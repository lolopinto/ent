import {
  Ent,
  Pattern,
  SQLStatementOperation,
  TransformedUpdateOperation,
  UpdateOperation,
  Viewer,
} from "@snowtop/ent";

// Ensures struct list inputs are normalized for builder input after transforms.
export default class AttachmentInputPattern implements Pattern {
  name = "attachment_input";
  fields = {};

  transformWrite<
    T extends Ent<TViewer>,
    TViewer extends Viewer = Viewer,
  >(stmt: UpdateOperation<T, TViewer>) {
    if (stmt.op !== SQLStatementOperation.Insert) {
      return null;
    }
    const attachments = stmt.input["attachments"];
    if (!attachments) {
      return null;
    }
    return {
      op: SQLStatementOperation.Insert,
      data: {
        attachments,
      },
    } as TransformedUpdateOperation<T, TViewer>;
  }
}
