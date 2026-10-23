package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"testing"
)

// This opt-in check covers Docker ARG scope and the standalone build context.
// Unit tests do not parse or attempt to emulate Dockerfile semantics.
func TestStandaloneDockerNodeOverride(t *testing.T) {
	if os.Getenv("ENT_DOCKER_TESTS") != "1" {
		t.Skip("set ENT_DOCKER_TESTS=1 to build the standalone image")
	}
	tag := fmt.Sprintf("ent-node-override-test:%d", os.Getpid())
	t.Cleanup(func() {
		if out, err := exec.Command("docker", "image", "rm", tag).CombinedOutput(); err != nil {
			t.Logf("image cleanup: %v\n%s", err, out)
		}
	})
	cmd := exec.Command("docker", "build", "--build-arg", "NODE_VERSION=22", "--tag", tag, "../ts")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("standalone Node22 build: %v\n%s", err, out)
	}
	out, err := exec.Command("docker", "run", "--rm", "--network", "none", tag, "node", "--version").CombinedOutput()
	if err != nil {
		t.Fatalf("run standalone image: %v\n%s", err, out)
	}
	if got := strings.TrimSpace(string(out)); !strings.HasPrefix(got, "v22.") {
		t.Fatalf("want Node22, got %q", got)
	}
}
