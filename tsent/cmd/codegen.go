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
	step                 string
	writeAll             bool
	disableCustomGraphQL bool
}

var codegenInfo codegenArgs

var codegenCmd = &cobra.Command{
	Use:   "codegen", // TODO is there a better name here?
	Short: "runs the codegen (and db schema) migration",
	Long:  `This runs the codegen steps. It generates the ent, db, and graphql code based on the arguments passed in`,
	//	Args:  configRequired,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}

		currentSchema, err := parseSchemaFromConfig(cfg)
		if err != nil {
			return err
		}

		// nothing to do here
		if len(currentSchema.Nodes) == 0 {
			return nil
		}

		t1 := time.Now()
		bi := build_info.NewBuildInfo(cfg)
		t2 := time.Now()
		diff := t2.Sub(t1)
		if rootInfo.debug {
			fmt.Println("build info took", diff)
		}

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
		// flag that next time we do this, we force write all
		if codegenInfo.step != "" {
			bi.ForceWriteAllNextTime = true
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

		// TODO why do we have these 2 different sets of options? very confusing...
		opts2 := []codegen.Option{}
		if codegenInfo.disableCustomGraphQL {
			opts2 = append(opts2, codegen.DisableCustomGraphQL())
		}
		if rootInfo.disablePrompts {
			opts2 = append(opts2, codegen.DisablePrompts())
		}
		return processor.Run(steps, codegenInfo.step, opts2...)
	},
}
