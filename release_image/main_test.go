package main

import (
	"slices"
	"testing"
)

func TestGetCommandArgsPushesOnce(t *testing.T) {
	args := getCommandArgs(dockerfileData{
		NodeVersion:  24,
		DockerTag:    "v1.2.3",
		Suffix:       "dev",
		TsentVersion: "v0.0.1",
	}, "builder")

	pushCount := 0
	for _, arg := range args {
		if arg == "--push" {
			pushCount++
		}
	}
	if pushCount != 1 {
		t.Fatalf("expected one --push arg, got %d in %v", pushCount, args)
	}

	if !slices.Contains(args, "ghcr.io/lolopinto/ent:v1.2.3-nodejs-24-dev") {
		t.Fatalf("missing versioned dev tag in %v", args)
	}
	if !slices.Contains(args, "ghcr.io/lolopinto/ent:latest") {
		t.Fatalf("missing latest tag for current node dev image in %v", args)
	}
}
