import {
  ContactBase,
  ContactCreateInput,
  ContactEditInput,
  createContactFrom,
  editContactFrom,
  deleteContact,
} from "./generated/contact_base";
import { ID, Viewer } from "ent/ent";

// we're only writing this once except with --force and packageName provided
export default class Contact extends ContactBase {}

// no actions yet so we support full create, edit, delete for now
export { ContactCreateInput, ContactEditInput, deleteContact };

export async function createContact(
  viewer: Viewer,
  input: ContactCreateInput,
): Promise<Contact | null> {
  return createContactFrom(viewer, input, Contact);
}

export async function editContact(
  viewer: Viewer,
  id: ID,
  input: ContactEditInput,
): Promise<Contact | null> {
  return editContactFrom(viewer, id, input, Contact);
}
