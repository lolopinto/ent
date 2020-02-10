package cmd

import (
	"errors"

	"github.com/lolopinto/ent/internal/code/auth"
	"github.com/lolopinto/ent/internal/util"
	"github.com/spf13/cobra"
)

// flags
var (
	node           string
	field          string
	viewerFunc     string
	forceOverwrite bool
)

var initPhoneAuthCmd = &cobra.Command{
	Use:   "initPhoneAuth",
	Short: "generates code to give default implementations for phone/pin auth",
	Long: `Provides a way to get quick defaults for phone number/pin account create and/or registration.
	It doesn't handle the account creation step (yet) because of what fields may be needed via actions.
	It still depends on the user creating a manual function to create the user (and validate the pin) or adding
	a mutation only field to the action and checking it there. Will eventually have better support here.
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

		if node == "" || field == "" {
			return errors.New("node and field required")
		}
		return nil
	},
	Run: func(cmd *cobra.Command, args []string) {
		codePathInfo := getPathToCode(pathToConfig)

		util.Die(auth.WriteAuthFile(codePathInfo, &auth.Options{
			Node:           node,
			Field:          field,
			ViewerFunc:     viewerFunc,
			ForceOverwrite: forceOverwrite,
		}))
	},
}
