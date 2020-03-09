import { BaseEntSchema } from "../../../../src/schema";
import { StringType } from "../../../../src/field";
/// explicit schema
export default class Address extends BaseEntSchema {
    constructor() {
        super(...arguments);
        this.tableName = "addresses";
        this.fields = [
            StringType({ name: "street_name", maxLen: 100 }),
            StringType({ name: "city" }),
            StringType({ name: "zip" }).match(/^\d{5}(-\d{4})?$/),
        ];
    }
}
