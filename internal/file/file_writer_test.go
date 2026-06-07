package file

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTemplatedBasedFileWriterTrimsGeneratedPythonTrailingWhitespace(t *testing.T) {
	tmpDir := t.TempDir()
	templatePath := filepath.Join(tmpDir, "schema.tmpl")
	contents := "first line" + "  \n" +
		"blank line follows\n" +
		"   \n" +
		"last line" + "\t \n\n"

	require.NoError(t, os.WriteFile(templatePath, []byte(contents), 0o644))

	writer := &TemplatedBasedFileWriter{
		AbsPathToTemplate: templatePath,
		TemplateName:      "schema.tmpl",
		PathToFile:        "schema.py",
	}

	b, err := writer.generateBytes()
	require.NoError(t, err)
	require.Equal(t, "first line\nblank line follows\n\nlast line\n", string(b))
}
