package main

import (
	"log"
	"os"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
)

func main() {
	env := os.Getenv("DB_CONNECTION_STRING")
	if env == "" {
		log.Fatal("DB_CONNECTION_STRING env variable is required")
	}

	codepath := codegen.NewCodePath("../internal/test_schema/models/configs", "")
	db.UpgradeDB(codepath)

	allEdges := <-ent.GenLoadAssocEdges()
	spew.Dump(allEdges)

	// fix edges if broken
	db.FixEdges(codepath)
}
