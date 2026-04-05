package tscode

import (
	"bytes"
	"testing"
	"text/template"

	"github.com/stretchr/testify/require"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/customtype"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/lolopinto/ent/internal/util"
)

type fakeImportConfig struct{}

func (c fakeImportConfig) GetAbsPathToRoot() string {
	return ""
}

func (c fakeImportConfig) ShouldUseRelativePaths() bool {
	return false
}

func (c fakeImportConfig) DebugMode() bool {
	return false
}

func TestActionCustomInterfaceUsesBuilderFieldName(t *testing.T) {
	cfg := &codegenapi.DummyConfig{}
	fi, err := field.NewFieldInfoFromInputs(cfg, "Contact", []*input.Field{
		{
			Name:            "extra",
			Type:            &input.FieldType{DBType: input.String},
			Nullable:        true,
			HasFieldPrivacy: true,
		},
	}, &field.Options{})
	require.NoError(t, err)

	f := fi.GetFieldByName("extra")
	require.NotNil(t, f)
	require.Equal(t, "_extra", f.TsFieldName(cfg))

	ci := &customtype.CustomInterface{
		TSType:  "customEmailInput",
		GQLName: "CustomEmailInput",
		Fields:  []*field.Field{f},
	}

	imps := tsimport.NewImports(fakeImportConfig{}, "src/ent/generated/contact/actions/create_contact_action_base.ts")
	tmpl, err := template.New("interface.tmpl").Funcs(imps.FuncMap()).ParseFiles(
		util.GetAbsolutePath("interface.tmpl"),
	)
	require.NoError(t, err)

	var buf bytes.Buffer
	err = tmpl.ExecuteTemplate(&buf, "interface.tmpl", map[string]interface{}{
		"RootInterface":       ci,
		"Interface":           ci,
		"Package":             &codegen.ImportPackage{},
		"Config":              cfg,
		"UseBuilderFieldName": true,
	})
	require.NoError(t, err)

	output := buf.String()
	require.Contains(t, output, "extra?: string")
	require.NotContains(t, output, "_extra")
}
