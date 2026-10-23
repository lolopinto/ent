package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// Exercise the production script directly with real Debian version comparison.
func TestCheckNodeVersion(t *testing.T) {
	if _, err := exec.LookPath("dpkg"); err != nil {
		t.Skip("requires Debian dpkg")
	}
	bin := t.TempDir()
	if err := os.WriteFile(filepath.Join(bin, "node"), []byte("#!/bin/sh\nprintf '%s\\n' \"$TEST_NODE_VERSION\"\n"), 0755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	tests := []struct {
		name      string
		major     string
		minimum   string
		installed string
		wantError string
	}{
		{name: "Node22 exact", major: "22", installed: "22.23.4"},
		{name: "Node22 newer patch", major: "22", installed: "22.23.10"},
		{name: "Node22 newer minor", major: "22", installed: "22.24.0"},
		{name: "Node22 older patch", major: "22", installed: "22.23.3", wantError: "minimum 22.23.4"},
		{name: "Node22 older minor", major: "22", installed: "22.9.99", wantError: "minimum 22.23.4"},
		{name: "Node24 exact", major: "24", installed: "24.22.1"},
		{name: "Node24 newer patch", major: "24", installed: "24.22.10"},
		{name: "Node24 newer minor", major: "24", installed: "24.23.0"},
		{name: "Node24 older patch", major: "24", installed: "24.22.0", wantError: "minimum 24.22.1"},
		{name: "Node24 older minor", major: "24", installed: "24.9.99", wantError: "minimum 24.22.1"},
		{name: "wrong major", major: "22", installed: "24.22.1", wantError: "does not satisfy major 22"},
		{name: "unsupported major", major: "20", installed: "20.99.0", wantError: "unsupported Node.js major version: 20"},
		{name: "explicit higher minimum met", major: "22", minimum: "22.24.0", installed: "22.24.0"},
		{name: "explicit higher minimum enforced", major: "22", minimum: "22.24.0", installed: "22.23.4", wantError: "minimum 22.24.0"},
		{name: "explicit lower minimum preserved", major: "22", minimum: "22.23.3", installed: "22.23.3"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("TEST_NODE_VERSION", tt.installed)
			cmd := exec.Command("sh", "../ts/check-node-version.sh", tt.major, tt.minimum)
			out, err := cmd.CombinedOutput()
			if tt.wantError == "" {
				if err != nil {
					t.Fatalf("check failed: %v\n%s", err, out)
				}
			} else if err == nil || !strings.Contains(string(out), tt.wantError) {
				t.Fatalf("want failure containing %q, got error=%v output=%s", tt.wantError, err, out)
			}
		})
	}
}
