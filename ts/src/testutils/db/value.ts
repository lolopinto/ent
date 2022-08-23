import { LoggedOutViewer } from "@snowtop/ent";
import { v4 } from "uuid";
import { DBType, Field, Schema, Type } from "../../schema";
import {
  DateType,
  TimeType,
  TimetzType,
  TimestampType,
  TimestamptzType,
  JSONBType,
  JSONType,
  JSONBTypeAsList,
  StringType,
} from "../../schema";
import { SimpleBuilder } from "../builder";

function random(): string {
  return Math.random().toString(16).substring(2);
}

function randomEmail(domain?: string): string {
  domain = domain || "email.com";

  return `test+${random()}@${domain}`;
}

function randomPhoneNumber(): string {
  return `+1${Math.random().toString(10).substring(2, 11)}`;
}

function coinFlip() {
  return Math.floor(Math.random() * 10) >= 5;
}

function specialType(typ: Type, col: string) {
  let list = m.get(typ.dbType);
  if (list?.length) {
    for (const l of list) {
      let regex: RegExp[] = [];
      if (Array.isArray(l.regex)) {
        regex = l.regex;
      } else {
        regex = [l.regex];
      }

      for (const r of regex) {
        if (r.test(col)) {
          return l.newValue();
        }
      }
    }
  }
  return undefined;
}

interface Info {
  schema: Schema;
}

export function getDefaultValue(
  f: Field,
  col: string,
  infos?: Map<string, Info>,
): any {
  if (f.defaultValueOnCreate) {
    // @ts-ignore
    return f.defaultValueOnCreate();
  }
  // half the time, return null for nullable
  if (f.nullable && coinFlip()) {
    return null;
  }

  const specialVal = specialType(f.type, col);
  if (specialVal !== undefined) {
    return specialVal;
  }

  return getValueForType(f.type, f, infos);
}

function getValueForType(typ: Type, f: Field, infos?: Map<string, Info>) {
  switch (typ.dbType) {
    case DBType.UUID:
      return v4();
    case DBType.Boolean:
      return coinFlip();
    case DBType.Date:
      return DateType().format(new Date());
    case DBType.Time:
      return TimeType().format(new Date());
    case DBType.Timetz:
      return TimetzType().format(new Date());
    case DBType.Timestamp:
      return TimestampType().format(new Date());
    case DBType.Timestamptz:
      return TimestamptzType().format(new Date());
    case DBType.String:
      return random();
    case DBType.Int:
      return Math.floor(Math.random() * 100000000);
    case DBType.Float:
      return Math.random() * 100000000;
    case DBType.Enum:
    case DBType.StringEnum:
      if (typ.values) {
        const idx = Math.floor(Math.random() * typ.values.length);
        return typ.values[idx];
      }
      if (typ.enumMap) {
        const vals = Object.values(typ.enumMap);
        const idx = Math.floor(Math.random() * vals.length);
        return vals[idx];
      }
      if (f.foreignKey) {
        const schema = f.foreignKey.schema;
        const col = f.foreignKey.column;
        if (!infos) {
          throw new Error(`infos required for enum with foreignKey`);
        }
        const info = infos.get(schema);
        if (!info) {
          throw new Error(`couldn't load data for schema ${schema}`);
        }
        if (!info.schema.dbRows) {
          throw new Error(`no dbRows for schema ${schema}`);
        }
        const idx = Math.floor(Math.random() * info.schema.dbRows.length);
        return info.schema.dbRows[idx][col];
      }
      throw new Error("TODO: enum without values not currently supported");

    case DBType.IntEnum:
      const vals = Object.values(typ.intEnumMap!);
      const idx = Math.floor(Math.random() * vals.length);
      return vals[idx];

    case DBType.BigInt:
      return BigInt(Math.floor(Math.random() * 100000000));
    case DBType.JSONB:
      // type as list
      if (typ.listElemType?.dbType === DBType.JSONB) {
        const values: any[] = [];

        for (let i = 0; i < 10; i++) {
          values.push(getValueForType(typ.listElemType, f, infos));
        }
        if (!f.format) {
          throw new Error("invalid format");
        }
        return f.format(values);
      }
      return JSONBType().format({});
    case DBType.JSON:
      return JSONType().format({});
    case DBType.List:
      // just do 10
      const values: any[] = [];

      for (let i = 0; i < 10; i++) {
        values.push(
          getValueForType(f.type.listElemType!, f.__getElemField(), infos),
        );
      }
      if (!f.format) {
        throw new Error("invalid format");
      }
      return f.format(values);
    default:
      throw new Error(`unsupported type ${typ.dbType}`);
  }
}

interface commonType {
  dbType: DBType;
  newValue: () => any;
  regex: [RegExp] | RegExp;
}

const emailType = {
  dbType: DBType.String,
  newValue: () => {
    return StringType().format(randomEmail().toLowerCase());
  },
  regex: /^email(_address)|_email$/,
};

const pdt = StringType();
const phoneType = {
  dbType: DBType.String,
  newValue: () => {
    return randomPhoneNumber();
  },
  regex: /^phone(_number)?|_phone$|_phone_number$/,
};

const passwordType = {
  dbType: DBType.String,
  newValue: () => {
    // we don't use password type because when we're generating so many rows, it's too slow...
    return random();
  },
  regex: /^password/,
};

const firstNames = [
  "Daenerys",
  "Jon",
  "Arya",
  "Sansa",
  "Eddard",
  "Khal",
  "Robb",
  "Joffrey",
  "Ramsay",
  "Cersei",
  "Bolton",
  "Oberyn",
  "Jojen",
  "Petyr",
  "Brienne",
  "Ygritte",
  "Missandei",
  "Shae",
  "Sandor",
  "Theon",
  "Catelyn",
  "Gilly",
  "Samwell",
  "Jaime",
  "Stannis",
  "Tyene",
  "Obara",
  "Nymeria",
  "Elia",
  "Ellaria",
  "Myrcella",
  "Hodor",
  "Osha",
  "Meera",
  "Davos",
  "Gendry",
];

const lastNames = [
  "Stark",
  "Targaryen",
  "Lannister",
  "Drogo",
  "Baratheon",
  "Reed",
  "Martell",
  "Tyrell",
  "Clegane",
  "Baelish",
  "Greyjoy",
  "Tarly",
  "Sand",
  "Snow",
  "Bolton",
  "Frey",
  "Tarth",
  "Payne",
  "Seaworth",
];

const firstNameType = {
  dbType: DBType.String,
  newValue: () => {
    let idx = Math.floor(firstNames.length * Math.random());
    return firstNames[idx];
  },
  regex: /^first_?(name)?/,
};

const lastNameType = {
  dbType: DBType.String,
  newValue: () => {
    let idx = Math.floor(lastNames.length * Math.random());
    return lastNames[idx];
  },
  regex: /^last_?(name)?/,
};

let types: commonType[] = [
  phoneType,
  emailType,
  passwordType,
  firstNameType,
  lastNameType,
];

let m: Map<DBType, commonType[]> = new Map();
for (const type of types) {
  let list = m.get(type.dbType) || [];
  list.push(type);
  m.set(type.dbType, list);
}
