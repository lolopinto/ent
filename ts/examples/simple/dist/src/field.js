import { DBType } from "./schema";
class BaseField {
}
export class UUID extends BaseField {
    constructor() {
        super(...arguments);
        this.type = { dbType: DBType.UUID };
    }
}
export function UUIDType(options) {
    let result = new UUID();
    for (const key in options) {
        const value = options[key];
        result[key] = value;
    }
    return result;
}
export class Integer extends BaseField {
    constructor() {
        super(...arguments);
        this.type = { dbType: DBType.Int };
    }
}
export function IntegerType(options) {
    let result = new Integer();
    for (const key in options) {
        const value = options[key];
        result[key] = value;
    }
    return result;
}
export class Float extends BaseField {
    constructor() {
        super(...arguments);
        this.type = { dbType: DBType.Float };
    }
}
export function FloatType(options) {
    let result = new Float();
    for (const key in options) {
        const value = options[key];
        result[key] = value;
    }
    return result;
}
export class Boolean extends BaseField {
    constructor() {
        super(...arguments);
        this.type = { dbType: DBType.Boolean };
    }
}
export function BooleanType(options) {
    let result = new Boolean();
    for (const key in options) {
        const value = options[key];
        result[key] = value;
    }
    return result;
}
export class String extends BaseField {
    constructor() {
        super(...arguments);
        this.type = { dbType: DBType.String };
        this.validators = [];
        this.formatters = [];
    }
    valid(val) {
        // TODO minLen, maxLen, length
        // TODO play with API more and figure out if I want functions ala below
        // or properties ala this
        // both doable but which API is better ?
        // if (this.minLen) {
        //   this.validate(function())
        // }
        for (const validator of this.validators) {
            if (!validator(val)) {
                return false;
            }
        }
        return true;
    }
    format(val) {
        for (const formatter of this.formatters) {
            val = formatter(val);
        }
        return val;
    }
    validate(validator) {
        this.validators.push(validator);
        return this;
    }
    formatter(formatter) {
        this.formatters.push(formatter);
        return this;
    }
    match(pattern) {
        return this.validate(function (str) {
            let r = new RegExp(pattern);
            return r.test(str);
        });
    }
    doesNotMatch(pattern) {
        return this.validate(function (str) {
            let r = new RegExp(pattern);
            return !r.test(str);
        });
    }
    toLowerCase() {
        return this.formatter(function (str) {
            return str.toLowerCase();
        });
    }
    toUpperCase() {
        return this.formatter(function (str) {
            return str.toUpperCase();
        });
    }
}
export function StringType(options) {
    let result = new String();
    for (const key in options) {
        const value = options[key];
        result[key] = value;
    }
    return result;
}
export class Time extends BaseField {
    constructor() {
        super(...arguments);
        this.type = { dbType: DBType.Time };
    }
}
export function TimeType(options) {
    let result = new Time();
    for (const key in options) {
        const value = options[key];
        result[key] = value;
    }
    return result;
}
// export class JSON extends BaseField implements Field {
//   type: Type = {dbType: DBType.JSON}
// }
