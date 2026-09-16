package main

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestDockerfileEnablesSQLiteForBothArchitectures(t *testing.T) {
	for _, suffix := range SUFFIXES {
		t.Run(suffix, func(t *testing.T) {
			output := filepath.Join(t.TempDir(), "Dockerfile")
			err := createDockerfile(output, dockerfileData{
				NodeVersion: 24, DockerTag: "v1.2.3", Suffix: suffix,
				TsentVersion: "v0.3.10", AutoSchemaVersion: "0.0.41",
			})
			if err != nil {
				t.Fatal(err)
			}
			data, err := os.ReadFile(output)
			if err != nil {
				t.Fatal(err)
			}
			// go-sqlite3 becomes a runtime-error stub when cross-compilation
			// silently disables CGO. Each supported target needs its C compiler.
			for _, required := range []string{"CGO_ENABLED=1", "CC=x86_64-linux-gnu-gcc", "CC=aarch64-linux-gnu-gcc"} {
				if !strings.Contains(string(data), required) {
					t.Errorf("generated %s Dockerfile is missing %q", suffix, required)
				}
			}
		})
	}
}

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
