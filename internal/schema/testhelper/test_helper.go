package testhelper

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/require"
)

func GetCodeWithSchema(code string) string {
	schemaPath := input.GetAbsoluteSchemaPathForTest()
	fieldPath := strings.Replace(schemaPath, "schema", "field", 1)

	rootPath := input.GetAbsoluteRootPathForTest()
	gqlPath := filepath.Join(rootPath, "graphql")
	r := strings.NewReplacer(
		"{schema}", schemaPath,
		"{field}", fieldPath,
		"{root}", rootPath,
		"{graphql}", gqlPath,
	)
	return r.Replace(code)
}

type Options struct {
	tempDir string
}

func TempDir(path string) func(*Options) {
	return func(opt *Options) {
		opt.tempDir = path
	}
}

func ParseInputSchemaForTest(t *testing.T, code map[string]string, opts ...func(*Options)) *input.Schema {
	opt := &Options{}
	for _, o := range opts {
		o(opt)
	}
	dirPath := opt.tempDir
	if dirPath == "" {
		absPath, err := filepath.Abs(".")
		require.NoError(t, err)
		dirPath, err = ioutil.TempDir(absPath, "project")
		// delete temporary created dir
		defer os.RemoveAll(dirPath)
		require.NoError(t, err)
	}

	schemaDir := filepath.Join(dirPath, "src", "schema")
	require.NoError(t, os.MkdirAll(schemaDir, os.ModePerm))

	for fileName, contents := range code {
		path := filepath.Join(schemaDir, fileName)
		dir := filepath.Dir(path)
		// e.g. patterns/foo.ts
		require.NoError(t, os.MkdirAll(dir, os.ModePerm))
		require.NoError(t, ioutil.WriteFile(path, []byte(contents), os.ModePerm))
	}

	inputSchema, err := input.ParseSchemaFromTSDir(dirPath, true)
	require.NoError(t, err)
	require.NotNil(t, inputSchema)

	return inputSchema
}

func ParseSchemaForTest(t *testing.T, code map[string]string, lang base.Language, opts ...func(*Options)) *schema.Schema {
	s, err := ParseSchemaForTestFull(t, code, lang, opts...)
	require.NoError(t, err)

	require.NotNil(t, s)
	return s
}

func ParseSchemaForTestFull(t *testing.T, code map[string]string, lang base.Language, opts ...func(*Options)) (*schema.Schema, error) {
	inputSchema := ParseInputSchemaForTest(t, code, opts...)
	return schema.ParseFromInputSchema(inputSchema, lang)
}

func ParseActionInfoForTest(t *testing.T, code map[string]string, lang base.Language, nodeName string) *action.ActionInfo {
	schema := ParseSchemaForTest(t, code, lang)

	info := schema.Nodes[nodeName]
	require.NotNil(t, info)

	return info.NodeData.ActionInfo
}
