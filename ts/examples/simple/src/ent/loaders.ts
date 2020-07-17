// TODO autogen this i think
import DataLoader from "dataloader";
import {
  Viewer,
  LoadRowOptions,
  loadRow,
  loadRows,
  createDataLoader,
} from "ent/ent";
import User from "src/ent/user";
import Address from "src/ent/address";
import Contact from "src/ent/contact";
import Event from "src/ent/contact";

// now where does this get called correctly?
// this is not needed. it's going to be done in cache
export function createLoaders() {
  return {
    Address: createDataLoader(Address.loaderOptions()),
    Contact: createDataLoader(Contact.loaderOptions()),
    Event: createDataLoader(Event.loaderOptions()),
    User: createDataLoader(User.loaderOptions()),
  };
}
