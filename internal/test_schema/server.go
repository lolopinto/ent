package main

import (
	"log"
	"net/http"
	"os"

	"github.com/99designs/gqlgen/handler"
	"github.com/gorilla/mux"
	_ "github.com/lolopinto/ent/ent/auth"
	"github.com/lolopinto/ent/ent/request"
	"github.com/lolopinto/ent/internal/test_schema/graphql"
)

// including auth to have its init() method run by default so it can register as a middleware
// to have the default logged out viewer set if no auth handlers registered

const defaultPort = "8080"

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	r := mux.NewRouter()
	for _, v := range request.GetAllMiddlewares() {
		r.Use(v)
	}
	r.Handle("/", handler.Playground("GraphQL playground", "/query"))
	r.Handle("/query", handler.GraphQL(graphql.NewExecutableSchema(graphql.Config{Resolvers: &graphql.Resolver{}})))

	log.Printf("connect to http://localhost:%s/ for GraphQL playground", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
