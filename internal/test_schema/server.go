package main

import (
	"log"
	"net/http"
	"os"

	"github.com/99designs/gqlgen/handler"
	"github.com/gorilla/mux"
	"github.com/lolopinto/ent/ent/request"
	"github.com/lolopinto/ent/internal/test_schema/graphql"
)

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
