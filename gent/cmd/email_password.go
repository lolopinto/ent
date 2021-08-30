package cmd

import (
	"errors"

	"github.com/lolopinto/ent/internal/code/auth"
	"github.com/spf13/cobra"
)

type emailAuthArgs struct {
	node           string
	field          string
	viewerFunc     string
	forceOverwrite bool
}

var emailAuth emailAuthArgs

var initEmailAuthCmd = &cobra.Command{
	Use:   "initEmailAuth",
	Short: "generates code to give default implementations for email/password auth",
	Long: `Provides a way to get quick defaults for email/password account login.
	It doesn't handle the account creation step (yet) because of what fields may be needed via actions.
	It still depends on the user creating a manual function to create the user and depends on using the password.Type() 
	when defining the password. Will eventually have better support here.
	Required flags are -p, -f, -n. It assumes this is only called once so subsequent calls to this without --force 
	don't do anything.
	The -v flag provides a way to pass a function path e.g. appviewer.NewViewerContext of a function f(string) (viewer.ViewerContext, error)
	(local path relative to the root of the repo) which should be passed to the generated handler. 
	If none is provided, a local viewerContext in the file is created
	`,
	Args: func(cmd *cobra.Command, args []string) error {
		if err := configRequired(cmd, args); err != nil {
			return err
		}

		if emailAuth.node == "" || emailAuth.field == "" {
			return errors.New("node and field required")
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := getPathToCode(pathToConfig)
		if err != nil {
			return err
		}

		return auth.WriteEmailAuthFile(cfg, &auth.Options{
			Node:           emailAuth.node,
			Field:          emailAuth.field,
			ViewerFunc:     emailAuth.viewerFunc,
			ForceOverwrite: emailAuth.forceOverwrite,
		})
	},
}
