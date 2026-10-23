package main

import (
	"fmt"
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
	}, "builder", false)

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

func TestPrepareBuildContext(t *testing.T) {
	script, err := os.ReadFile("../ts/check-node-version.sh")
	if err != nil {
		t.Fatal(err)
	}
	for _, version := range NODE_VERSIONS {
		for _, suffix := range SUFFIXES {
			t.Run(fmt.Sprintf("node%d/%s", version, suffix), func(t *testing.T) {
				dir := t.TempDir()
				d := dockerfileData{NodeVersion: version, Suffix: suffix, DockerTag: "v1.2.3", TsentVersion: "v0.3.10", AutoSchemaVersion: "0.0.41"}
				if err := prepareBuildContext(dir, d); err != nil {
					t.Fatal(err)
				}
				dockerfile := readTestFile(t, filepath.Join(dir, "Dockerfile"))
				for _, want := range []string{
					fmt.Sprintf("ARG NODE_VERSION=%d", version),
					"COPY check-node-version.sh /usr/local/bin/check-node-version.sh",
					`sh /usr/local/bin/check-node-version.sh "$NODE_VERSION" "$NODE_MIN_VERSION"`,
				} {
					if !strings.Contains(dockerfile, want) {
						t.Errorf("generated Dockerfile missing %q", want)
					}
				}
				if got := readTestFile(t, filepath.Join(dir, "check-node-version.sh")); got != string(script) {
					t.Error("build context must contain the shared Node check script")
				}
			})
		}
	}
}

func readTestFile(t *testing.T, name string) string {
	t.Helper()
	data, err := os.ReadFile(name)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestDockerfileRejectsUnsupportedNodeBeforeWriting(t *testing.T) {
	output := filepath.Join(t.TempDir(), "Dockerfile")
	if err := createDockerfile(output, dockerfileData{NodeVersion: 20}); err == nil {
		t.Fatal("expected unsupported Node version to fail")
	}
	if _, err := os.Stat(output); !os.IsNotExist(err) {
		t.Fatalf("unsupported runtime unexpectedly wrote Dockerfile: %v", err)
	}
}

func TestRuntimeCacheRefreshIsExplicit(t *testing.T) {
	d := dockerfileData{NodeVersion: 24, Suffix: "slim"}
	if args := getCommandArgs(d, "builder", false); slices.Contains(args, "--no-cache-filter") {
		t.Fatalf("normal build should reuse cache: %v", args)
	}
	args := getCommandArgs(d, "builder", true)
	index := slices.Index(args, "--no-cache-filter")
	if index < 0 || index+1 >= len(args) || args[index+1] != "final-image" {
		t.Fatalf("runtime refresh must bypass final-image cache: %v", args)
	}
}
