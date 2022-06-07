package cmd

import (
	"os"
	"os/exec"

	cmd2 "github.com/lolopinto/ent/internal/cmd"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/graphql"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/tscode"
	"github.com/lolopinto/ent/internal/util"
	"github.com/spf13/cobra"
)

var migratev1Cmd = &cobra.Command{
	Use:   "migrate_v0.1",
	Short: "migrate v0.1",
	RunE: func(cmd *cobra.Command, args []string) error {
		// another hardcoded place
		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}
		s1, err := parseSchemaFromConfig(cfg)
		if err != nil {
			return err
		}
		p, err := codegen.NewCodegenProcessor(s1, "src/schema")
		if err != nil {
			return err
		}
		if err := runNodeJSMigrateStep(p, "--move_generated"); err != nil {
			return err
		}

		if err := intermediateCodegen(s1); err != nil {
			return err
		}

		if err := runNodeJSMigrateStep(p, "--transform_schema"); err != nil {
			return err
		}

		if err := intermediateCodegen(s1); err != nil {
			return err
		}

		// reparse schema since files should have moved from src/schema/foo.ts to src/schema/foo_schema.ts
		// s2, err := parseSchemaFromConfig(cfg)
		// if err != nil {
		// 	return err
		// }

		// these 2 can actually be run together
		if err := runNodeJSMigrateStep(p, "--transform_ent"); err != nil {
			return err
		}
		if err := runNodeJSMigrateStep(p, "--transform_action"); err != nil {
			return err
		}

		// full codegen
		return codegenCmd.RunE(cmd, args)

	},
}

func intermediateCodegen(s *schema.Schema) error {
	opts := []codegen.ConstructOption{
		codegen.WriteAll(),
	}
	processor, err := codegen.NewCodegenProcessor(s, "src/schema", opts...)
	if err != nil {
		return err
	}

	steps := []codegen.Step{
		new(tscode.Step),
		new(graphql.TSStep),
	}
	opts2 := []codegen.Option{
		codegen.DisableCustomGraphQL(),
	}
	return processor.Run(steps, "", opts2...)
}

func runNodeJSMigrateStep(p *codegen.Processor, step string) error {
	scriptPath := util.GetPathToScript("scripts/migrate_v0.1.ts", false)
	cmdArgs := append(
		cmd2.GetArgsForScript(p.Config.GetAbsPathToRoot()),
		"--swc",
		scriptPath,
		step,
	)

	command := exec.Command("ts-node-script", cmdArgs...)
	command.Dir = p.Config.GetAbsPathToRoot()
	command.Stderr = os.Stderr
	command.Stdout = os.Stdout

	return command.Run()
}
