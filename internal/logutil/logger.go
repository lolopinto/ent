package logutil

import (
	"bytes"
	"log"
	"os"
	"sort"
	"strings"
)

type CaptureLogger struct {
	buf bytes.Buffer
}

func (l *CaptureLogger) Capture() {
	log.SetOutput(&l.buf)
}

// ResetOutput should be called to reset the log capture mechanism
// should be called with defer
func (l *CaptureLogger) Reset() {
	log.SetOutput(os.Stderr)
}

func (l *CaptureLogger) Contains(str string) bool {
	lines := strings.Split(l.buf.String(), "\n")
	for _, line := range lines {
		if strings.Contains(line, str) {
			return true
		}
	}
	return false
}

func (l *CaptureLogger) ContainsInOrder(strs []string) bool {
	indices := make([]int, len(strs))
	lines := strings.Split(l.buf.String(), "\n")
	for j, str := range strs {
		foundIdx := -1
		for i, line := range lines {
			if strings.Contains(line, str) {
				foundIdx = i
				indices[j] = i
				break
			}
		}
		if foundIdx == -1 {
			return false
		}
	}
	return sort.IntsAreSorted(indices)
}
