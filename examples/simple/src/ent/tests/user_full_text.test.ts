import { Client } from "pg";
import { createDB } from "src/testsetup/globalSetup";
import { loadConfig, LoggedOutViewer } from "@snowtop/ent";
import { randomEmail, randomPhoneNumber } from "../../util/random";
import CreateUserAction, {
  UserCreateInput,
} from "../user/actions/create_user_action";
import { User } from "../../ent";
import * as clause from "@snowtop/ent/core/clause";

let pgClient: Client;
let globalDB: string;

const loggedOutViewer = new LoggedOutViewer();

beforeAll(async () => {
  const { db, user, password, client } = await createDB();
  pgClient = client;
  globalDB = db;

  loadConfig({
    db: {
      database: db,
      host: "localhost",
      user,
      password,
      port: 5432,
      sslmode: "disable",
      max: 100,
    },
    //    log: ["query"],
  });

  const inputs: Partial<UserCreateInput>[] = [
    {
      firstName: "Caetlyn",
      lastName: "Stark",
    },
    {
      firstName: "Eddard",
      lastName: "Stark",
    },
    {
      firstName: "Robb",
      lastName: "Stark",
    },
    {
      firstName: "Jon",
      lastName: "Snow",
    },
    {
      firstName: "Sansa",
      lastName: "Stark",
    },
    {
      firstName: "Arya",
      lastName: "Stark",
    },
    {
      firstName: "Bran",
      lastName: "Stark",
    },
    {
      firstName: "Rickon",
      lastName: "Stark",
    },
    {
      firstName: "Daenerys",
      lastName: "Targaryen",
    },
    {
      firstName: "Cersei",
      lastName: "Lannister",
    },
    {
      firstName: "Tywin",
      lastName: "Lannister",
    },
    {
      firstName: "Jaime",
      lastName: "Lannister",
    },
    {
      firstName: "Tyrion",
      lastName: "Lannister",
    },
    {
      firstName: "Robert",
      lastName: "Baratheon",
    },
    {
      firstName: "Joffrey",
      lastName: "Baratheon",
    },
    {
      firstName: "Myrcella",
      lastName: "Baratheon",
    },
    {
      firstName: "Tommen",
      lastName: "Baratheon",
    },
    {
      firstName: "Stannis",
      lastName: "Baratheon",
    },
    {
      firstName: "Shireen",
      lastName: "Baratheon",
    },
  ];

  await Promise.all(inputs.map((input) => create(input)));
});

afterAll(async () => {
  await pgClient.query(`DROP DATABASE ${globalDB}`);
  await pgClient.end();
});

async function create(opts: Partial<UserCreateInput>): Promise<User> {
  let input: UserCreateInput = {
    firstName: "first",
    lastName: "last",
    emailAddress: randomEmail(),
    password: "pa$$w0rd",
    phoneNumber: randomPhoneNumber(),
    ...opts,
  };
  return await CreateUserAction.create(loggedOutViewer, input).saveX();
}

test("baratheon", async () => {
  const results = await User.loadCustomData(
    clause.TsQuery("name_idx", {
      language: "simple",
      value: "baratheon",
    }),
  );
  expect(results.length).toBe(6);
  for (const result of results) {
    expect(result["last_name"]).toBe("Baratheon");
  }
});

test("lannister", async () => {
  const results = await User.loadCustomData(
    clause.TsQuery("name_idx", {
      language: "simple",
      value: "lannister",
    }),
  );
  expect(results.length).toBe(4);
  for (const result of results) {
    expect(result["last_name"]).toBe("Lannister");
  }
});

test("baratheon | lannister", async () => {
  const results = await User.loadCustomData(
    clause.TsQuery("name_idx", {
      language: "simple",
      value: "baratheon | lannister",
    }),
  );
  expect(results.length).toBe(10);
  for (const result of results) {
    expect(["Lannister", "Baratheon"].includes(result["last_name"])).toBe(true);
  }
});

test("jon & snow", async () => {
  const results = await User.loadCustomData(
    clause.TsQuery("name_idx", {
      language: "simple",
      value: "jon & snow",
    }),
  );
  expect(results.length).toBe(1);
});

test("stark | snow", async () => {
  const results = await User.loadCustomData(
    clause.TsQuery("name_idx", {
      language: "simple",
      value: "stark | snow",
    }),
  );
  expect(results.length).toBe(8);
  for (const result of results) {
    expect(["Stark", "Snow"].includes(result["last_name"])).toBe(true);
  }
});

test("starts_with s", async () => {
  const results = await User.loadCustomData(
    clause.TsQuery("name_idx", {
      language: "simple",
      value: "s:*",
    }),
  );
  // starks, snow, stannis, shireen
  expect(results.length).toBe(10);
});

test("starts_with dany", async () => {
  const results = await User.loadCustomData(
    clause.TsQuery("name_idx", {
      language: "simple",
      value: "dae:*",
    }),
  );
  expect(results.length).toBe(1);
});
