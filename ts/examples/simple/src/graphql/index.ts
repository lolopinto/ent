import { GraphQLServer } from "graphql-yoga";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
//import { Context } from "./context";
import { IDViewer } from "src/util/id_viewer";
import UserResolver from "src/graphql/resolvers/user_resolver";
import ContactResolver from "src/graphql/resolvers/contact_resolver";
// bootstrap
async function bootstrap() {
  try {
    const schema = await buildSchema({
      // can't do this until i fix the webpack emitting as individual files
      //resolvers: [__dirname + "/resolvers/**/*.{ts,js}"],
      resolvers: [UserResolver, ContactResolver],
      emitSchemaFile: true,
      // TODO this should be a configurable option
      // defaults to "isoDate". seems better than "timestamp"
      dateScalarMode: "isoDate",
    });
    // TODO we can change this as needed if we choose to use type-graphql
    // that can be cool. make this plug and play as needed
    const server = new GraphQLServer({
      schema,
      context: {
        viewer: new IDViewer("e0fba30e-8bc3-4d0d-b574-903cd6772d16"),
      },
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
