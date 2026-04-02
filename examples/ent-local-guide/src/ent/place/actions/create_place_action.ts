import { type Data, IDViewer } from "@snowtop/ent";
import type {PlaceCreateInput} from "../../generated/place/actions/create_place_action_base";
import {CreatePlaceActionBase} from "../../generated/place/actions/create_place_action_base";


export type { PlaceCreateInput };



export default class CreatePlaceAction extends CreatePlaceActionBase {
  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
  }
}
