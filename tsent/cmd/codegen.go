package cmd

import (
	"fmt"
	"time"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/lolopinto/ent/internal/tscode"
	"github.com/spf13/cobra"
)

type codegenArgs struct {
	step string
}

var codegenInfo codegenArgs

var codegenCmd = &cobra.Command{
	Use:   "codegen", // TODO is there a better name here?
	Short: "runs the codegen (and db schema) migration",
	Long:  `This runs the codegen steps. It generates the ent, db, and graphql code based on the arguments passed in`,
	//	Args:  configRequired,
	RunE: func(cmd *cobra.Command, args []string) error {
		t1 := time.Now()
		schema, err := parseSchema()
		if err != nil {
			return err
		}

		// nothing to do here
		if len(schema.Nodes) == 0 {
			return nil
		}

		// module path empty because not go
		// same as ParseSchemaFromTSDir. default to schema. we want a flag here eventually
		processor, err := codegen.NewCodegenProcessor(schema, "src/schema", "", rootInfo.debug)
		if err != nil {
			return err
		}

		steps := []codegen.Step{
			new(db.Step),
			new(tscode.Step),
			new(graphql.TSStep),
		}

		err = processor.Run(steps, codegenInfo.step)
		if err != nil {
			return err
		}
		t2 := time.Now()
		diff := t2.Sub(t1)
		fmt.Println(diff)
		return nil
	},
}
