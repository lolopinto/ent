import { AllowIfViewerIsEntPropertyRule, AlwaysDenyRule } from "@snowtop/ent";
import { DocumentBase } from "./generated/document_base";

export class Document extends DocumentBase {
  getPrivacyPolicy() {
    return {
      rules: [
        new AllowIfViewerIsEntPropertyRule<Document>("ownerId"),
        AlwaysDenyRule,
      ],
    };
  }
}
