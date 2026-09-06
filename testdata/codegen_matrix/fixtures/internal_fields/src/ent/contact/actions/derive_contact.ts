import type { ContactBuilder } from "../../generated/contact/actions/contact_builder";

export function deriveContact(builder: ContactBuilder) {
  const input = builder.getInput();
  if (input.name !== undefined) {
    builder.updateInput({ normalizedName: input.name.trim().toLowerCase() });
  }
  if (input.email !== undefined) {
    builder.updateInput({
      primaryEmail:
        input.email === null ? null : input.email.trim().toLowerCase(),
    });
  }
}
