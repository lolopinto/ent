package auto_schema

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIgnoreTableArgs(t *testing.T) {
	patterns := []string{"public.session", "auth.*", "session", "auth.*"}
	require.Equal(t, []string{"--ignore_table=auth.*", "--ignore_table=public.session", "--ignore_table=session"}, ignoreTableArgs(patterns))
	require.Equal(t, "public.session", patterns[0])
	require.Empty(t, ignoreTableArgs(nil))
}
