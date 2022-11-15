package cmd

import (
	"os"
	"os/exec"

	cmd2 "github.com/lolopinto/ent/internal/cmd"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/util"
	"github.com/spf13/cobra"
)

var runScriptCmd = &cobra.Command{
	Use:   "run_script",
	Short: "run script",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		script := args[0]

		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}

		scriptPath := util.GetPathToScript(script, false)

		cmdArgs := append(
			cmd2.GetArgsForScript(cfg.GetAbsPathToRoot()),
			// "--swc",
			scriptPath,
		)

		command := exec.Command("ts-node-script", cmdArgs...)
		command.Dir = cfg.GetAbsPathToRoot()
		command.Stderr = os.Stderr
		command.Stdout = os.Stdout

		return command.Run()
	},
}
