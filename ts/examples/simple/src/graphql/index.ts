import { GraphQLServer } from "graphql-yoga";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
import { UserResolver } from "./resolver";

async function bootstrap() {
  try {
    const schema = await buildSchema({
      resolvers: [UserResolver],
      emitSchemaFile: true,
    });
    console.log(schema);

    const server = new GraphQLServer({
      schema,
    });

    server.start(() =>
      console.log("Server is running on http://localhost:4000"),
    );
  } catch (error) {
    console.error(error);
    console.error(error.message);
  }
}

bootstrap();
