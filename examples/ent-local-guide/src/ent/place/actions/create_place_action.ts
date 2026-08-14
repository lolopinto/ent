import { type Data, IDViewer } from "@snowtop/ent";
import type { PlaceCreateInput } from "../../generated/place/actions/create_place_action_base.js";
import { CreatePlaceActionBase } from "../../generated/place/actions/create_place_action_base.js";

export type { PlaceCreateInput };

export default class CreatePlaceAction extends CreatePlaceActionBase {
  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
  }
}
