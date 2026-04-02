import { type Data, IDViewer } from "@snowtop/ent";
import type {PlaceReviewCreateInput} from "../../generated/place_review/actions/create_place_review_action_base";
import {CreatePlaceReviewActionBase} from "../../generated/place_review/actions/create_place_review_action_base";


export type { PlaceReviewCreateInput };



export default class CreatePlaceReviewAction extends CreatePlaceReviewActionBase {
  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
  }
}
