package cmd

import (
	"fmt"
	"time"

	"github.com/lolopinto/ent/internal/build_info"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/db"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/lolopinto/ent/internal/tscode"
	"github.com/spf13/cobra"
)

type codegenArgs struct {
	step     string
	writeAll bool
}

var codegenInfo codegenArgs

var codegenCmd = &cobra.Command{
	Use:   "codegen", // TODO is there a better name here?
	Short: "runs the codegen (and db schema) migration",
	Long:  `This runs the codegen steps. It generates the ent, db, and graphql code based on the arguments passed in`,
	//	Args:  configRequired,
	RunE: func(cmd *cobra.Command, args []string) error {
		currentSchema, err := parseSchema()
		if err != nil {
			return err
		}

		// nothing to do here
		if len(currentSchema.Nodes) == 0 {
			return nil
		}

		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}

		t1 := time.Now()
		bi := build_info.NewBuildInfo(cfg)
		t2 := time.Now()
		diff := t2.Sub(t1)
		fmt.Println("build info took", diff)

		opts := []codegen.ConstructOption{
			codegen.BuildInfo(bi),
			codegen.ProcessorConfig(cfg),
		}
		if rootInfo.debug {
			opts = append(opts, codegen.DebugMode())
		}
		if codegenInfo.writeAll {
			opts = append(opts, codegen.WriteAll())
		}
		// same as ParseSchemaFromTSDir. default to schema. we want a flag here eventually
		processor, err := codegen.NewCodegenProcessor(currentSchema, "src/schema", opts...)
		if err != nil {
			return err
		}

		steps := []codegen.Step{
			new(db.Step),
			new(tscode.Step),
			new(graphql.TSStep),
		}

		return processor.Run(steps, codegenInfo.step)
	},
}
