package cmd

import (
	"errors"

	"github.com/lolopinto/ent/internal/code/viewer"
	"github.com/spf13/cobra"
)

// flags
var (
	// used to create AppViewerContext in appviewer/viewer_context.go
	app                  string
	userObject           string // e.g. User|Account
	forceViewerOverwrite bool
	// extra credit options: packagename, viewer_context name etc
	// defaults are fine for now
)

// this could (should?) all be part of a big init but for now, we're breaking it up into a different command
var initViewerCmd = &cobra.Command{
	Use:   "initViewer",
	Short: "creates a default viewer context for the app",
	Long:  `generates a default viewer context for the app that can be built upon over time. Also, generates a simple graphql wrapper for Viewer`,
	Args: func(cmd *cobra.Command, args []string) error {
		if err := configRequired(cmd, args); err != nil {
			return err
		}

		if app == "" || userObject == "" {
			return errors.New("app and node required")
		}
		return nil
	},
	RunE: func(cmd *cobra.Command, args []string) error {
		codePathInfo := getPathToCode(pathToConfig)

		return viewer.WriteViewerFiles(codePathInfo, userObject, app, forceViewerOverwrite)
	},
}
