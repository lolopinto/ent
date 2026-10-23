package main

import (
	"fmt"
	"os"
	"os/exec"
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

func TestDockerfileEnforcesSupportedRuntimeMinimums(t *testing.T) {
	for version, release := range map[int]string{22: "22.23.4", 24: "24.22.1"} {
		for _, suffix := range SUFFIXES {
			output := filepath.Join(t.TempDir(), "Dockerfile")
			if err := createDockerfile(output, dockerfileData{NodeVersion: version, Suffix: suffix, DockerTag: "v0.3.13", TsentVersion: "v0.3.10", AutoSchemaVersion: "0.0.41"}); err != nil {
				t.Fatal(err)
			}
			data, err := os.ReadFile(output)
			if err != nil {
				t.Fatal(err)
			}
			for _, required := range []string{"ARG NODE_MIN_VERSION=" + release, `apt-get install nodejs -yqq`, `dpkg --compare-versions "$node_version" ge "$NODE_MIN_VERSION"`, "golang:1.26.10-trixie", "python:3.12.15-trixie", "ARG BUN_VERSION=1.4.4", "pip==26.2.2 certifi==2026.10.19"} {
				if !strings.Contains(string(data), required) {
					t.Errorf("Node %d %s image is missing %q", version, suffix, required)
				}
			}
		}
	}
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

// Execute the generated shell guard with real Debian version comparison. The
// test runs on Linux CI; macOS does not normally provide dpkg.
func TestNodeMinimumGuard(t *testing.T) {
	if _, err := exec.LookPath("dpkg"); err != nil {
		t.Skip("requires Debian dpkg")
	}
	for _, version := range []int{22, 24} {
		output := filepath.Join(t.TempDir(), "Dockerfile")
		d := dockerfileData{NodeVersion: version, Suffix: "slim"}
		if err := createDockerfile(output, d); err != nil {
			t.Fatal(err)
		}
		data, err := os.ReadFile(output)
		if err != nil {
			t.Fatal(err)
		}
		_, guard, ok := strings.Cut(string(data), "  node_version=")
		if !ok {
			t.Fatal("missing installed Node version check")
		}
		guard, _, ok = strings.Cut(guard, "  npm install")
		if !ok {
			t.Fatal("missing boundary after Node version check")
		}
		guard = strings.ReplaceAll("node_version="+guard, "\\\n", "") + " true"
		for _, tc := range []struct {
			name, actual string
			pass         bool
		}{
			{"exact", d.MinimumNodeVersion(), true},
			{"newer patch", map[int]string{22: "22.23.10", 24: "24.22.10"}[version], true},
			{"newer minor", map[int]string{22: "22.24.0", 24: "24.23.0"}[version], true},
			{"older patch", map[int]string{22: "22.23.3", 24: "24.22.0"}[version], false},
			{"older minor", map[int]string{22: "22.9.99", 24: "24.9.99"}[version], false},
			{"wrong major", "26.99.99", false},
		} {
			t.Run(fmt.Sprintf("%d/%s", version, tc.name), func(t *testing.T) {
				cmd := exec.Command("sh", "-c", `node() { printf '%s' "$TEST_NODE_VERSION"; }; `+guard)
				cmd.Env = append(os.Environ(), fmt.Sprintf("NODE_VERSION=%d", version), "NODE_MIN_VERSION="+d.MinimumNodeVersion(), "TEST_NODE_VERSION="+tc.actual)
				out, err := cmd.CombinedOutput()
				if (err == nil) != tc.pass {
					t.Fatalf("version %s: expected pass=%v, error=%v, output=%s", tc.actual, tc.pass, err, out)
				}
				if !tc.pass && !strings.Contains(string(out), "does not satisfy") {
					t.Fatalf("missing actionable failure: %s", out)
				}
			})
		}
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

func TestStandaloneDockerfileUsesSameNodeGuard(t *testing.T) {
	template, err := os.ReadFile("../ts/Dockerfile.tmpl")
	if err != nil {
		t.Fatal(err)
	}
	standalone, err := os.ReadFile("../ts/Dockerfile")
	if err != nil {
		t.Fatal(err)
	}
	extract := func(data []byte) string {
		_, guard, ok := strings.Cut(string(data), "  node_version=")
		if !ok {
			t.Fatal("missing Node guard")
		}
		guard, _, ok = strings.Cut(guard, "  npm install")
		if !ok {
			t.Fatal("missing Node guard end")
		}
		return guard
	}
	if extract(template) != extract(standalone) {
		t.Fatal("standalone Dockerfile and release template must enforce the same Node minimum check")
	}
}

func TestStandaloneDockerfileNodeOverrides(t *testing.T) {
	if _, err := exec.LookPath("dpkg"); err != nil {
		t.Skip("requires Debian dpkg")
	}
	data, err := os.ReadFile("../ts/Dockerfile")
	if err != nil {
		t.Fatal(err)
	}
	dockerfile := string(data)
	globalArgs, _, _ := strings.Cut(dockerfile, "FROM ")
	defaults := map[string]string{}
	for _, line := range strings.Split(globalArgs, "\n") {
		if arg, ok := strings.CutPrefix(line, "ARG "); ok {
			name, value, _ := strings.Cut(arg, "=")
			defaults[name] = value
		}
	}
	_, finalStage, ok := strings.Cut(dockerfile, " AS final-image\n")
	if !ok {
		t.Fatal("missing final image stage")
	}
	_, install, ok := strings.Cut(finalStage, "RUN \\\n")
	if !ok {
		t.Fatal("missing installation step")
	}
	selection, _, ok := strings.Cut(install, "  apt-get update")
	if !ok {
		t.Fatal("missing package installation boundary")
	}
	_, guard, ok := strings.Cut(install, "  node_version=")
	if !ok {
		t.Fatal("missing Node guard")
	}
	guard, _, ok = strings.Cut(guard, "  npm install")
	if !ok {
		t.Fatal("missing guard boundary")
	}
	script := strings.ReplaceAll(selection+"node_version="+guard+" true", "\\\n", "")
	for _, tc := range []struct {
		name, major, minimum, actual string
		pass                         bool
	}{
		{"default major", "", "", "24.22.1", true},
		{"Node 22 override", "22", "", "22.23.4", true},
		{"Node 22 below default minimum", "22", "", "22.23.3", false},
		{"Node 24 below default minimum", "24", "", "24.22.0", false},
		{"explicit minimum accepted", "22", "22.24.0", "22.24.0", true},
		{"explicit minimum enforced", "22", "22.24.0", "22.23.4", false},
		{"explicit lower minimum preserved", "22", "22.23.3", "22.23.3", true},
		{"unsupported major", "20", "", "20.99.0", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			major, minimum := defaults["NODE_VERSION"], defaults["NODE_MIN_VERSION"]
			if tc.major != "" {
				major = tc.major
			}
			if tc.minimum != "" {
				minimum = tc.minimum
			}
			cmd := exec.Command("sh", "-c", `node() { printf '%s' "$TEST_NODE_VERSION"; }; `+script)
			cmd.Env = append(os.Environ(), "NODE_VERSION="+major, "NODE_MIN_VERSION="+minimum, "TEST_NODE_VERSION="+tc.actual)
			out, err := cmd.CombinedOutput()
			if (err == nil) != tc.pass {
				t.Fatalf("expected pass=%v, error=%v, output=%s", tc.pass, err, out)
			}
		})
	}
}
