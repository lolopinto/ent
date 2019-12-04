package logutil

import (
	"bytes"
	"log"
	"os"
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
