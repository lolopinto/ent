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
		// usually a path like scripts/fix_action_exports.ts
		script := args[0]

		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}

		cmdInfo, err := cmd2.GetCommandInfo(cfg.GetAbsPathToRoot(), false)
		if err != nil {
			return err
		}
		if cmdInfo.UseSwc {
			cleanup := cmdInfo.MaybeSetupSwcrc(cfg.GetAbsPathToRoot())
			defer cleanup()
		}
		scriptPath := util.GetPathToScript(script, cfg.GetAbsPathToRoot(), false, cmdInfo.Runtime)
		cmdArgs := append(cmdInfo.Args, scriptPath)
		command := exec.Command(cmdInfo.Name, cmdArgs...)
		command.Dir = cfg.GetAbsPathToRoot()
		command.Stderr = os.Stderr
		command.Stdout = os.Stdout
		command.Env = cmdInfo.Env

		return command.Run()
	},
}
