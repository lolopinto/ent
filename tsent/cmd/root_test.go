package cmd

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRunAndCloseDB(t *testing.T) {
	tests := []struct {
		name       string
		commandErr error
		closeErr   error
	}{
		{name: "success"},
		{
			name:       "command and close errors",
			commandErr: errors.New("command failed"),
			closeErr:   errors.New("close failed"),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			events := []string{}
			commandErr, closeErr := runAndCloseDB(
				func() error {
					events = append(events, "execute")
					return test.commandErr
				},
				func() error {
					events = append(events, "close")
					return test.closeErr
				},
			)

			require.Equal(t, []string{"execute", "close"}, events)
			require.ErrorIs(t, commandErr, test.commandErr)
			require.ErrorIs(t, closeErr, test.closeErr)
		})
	}
}
