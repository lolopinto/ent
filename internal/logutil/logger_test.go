package logutil_test

import (
	"log"
	"testing"

	"github.com/lolopinto/ent/internal/logutil"
	"github.com/stretchr/testify/assert"
)

func TestLogCapture(t *testing.T) {
	l := logutil.CaptureLogger{}
	l.Capture()
	defer l.Reset()

	log.Println("foo!")

	assert.True(t, l.Contains("foo!"))
}

func TestLogCaptureFalse(t *testing.T) {
	l := logutil.CaptureLogger{}
	l.Capture()
	defer l.Reset()

	log.Println("bar!")

	assert.False(t, l.Contains("foo!"))
}

func TestLogInOrderCapture(t *testing.T) {
	l := logutil.CaptureLogger{}
	l.Capture()
	defer l.Reset()

	log.Println("foo!")
	log.Println("baz!")
	log.Println("bar!")

	assert.True(t, l.ContainsInOrder([]string{"foo!", "bar!"}))
}

func TestLogWrongOrderCapture(t *testing.T) {
	l := logutil.CaptureLogger{}
	l.Capture()
	defer l.Reset()

	log.Println("foo!")
	log.Println("baz!")
	log.Println("bar!")

	assert.False(t, l.ContainsInOrder([]string{"bar!", "foo!"}))
}

func TestNotLoggedInOrderCapture(t *testing.T) {
	l := logutil.CaptureLogger{}
	l.Capture()
	defer l.Reset()

	log.Println("foo!")
	log.Println("bar!")

	assert.False(t, l.ContainsInOrder([]string{"baz!", "foo!"}))
}
