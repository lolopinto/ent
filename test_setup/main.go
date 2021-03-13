package main

import (
	"log"
	"os"

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
	// fix edges if broken?
	//	db.FixEdges(codepath)
}
