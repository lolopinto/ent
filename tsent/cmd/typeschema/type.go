package typeschema

import (
	"fmt"
	"path"
	"strings"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/lolopinto/ent/internal/util"
)

type Import interface {
	ImportPath() string
	Import() string
	DefaultImport() bool
	Aliases() []string
}

type baseImport struct {
}

func (b *baseImport) ImportPath() string {
	return codepath.SchemaPackage
}

func (b *baseImport) DefaultImport() bool {
	return false
}

type stringImport struct {
	baseImport
}

func (imp *stringImport) Import() string {
	return "StringType"
}

func (imp *stringImport) Aliases() []string {
	return []string{"string", "text"}
}

type uuidImport struct {
	baseImport
}

func (imp *uuidImport) Import() string {
	return "UUIDType"
}

func (imp *uuidImport) Aliases() []string {
	return []string{"uuid"}
}

type intImport struct {
	baseImport
}

func (imp *intImport) Import() string {
	return "IntegerType"
}

func (imp *intImport) Aliases() []string {
	return []string{"int", "integer"}
}

type floatImport struct {
	baseImport
}

func (imp *floatImport) Import() string {
	return "FloatType"
}

func (imp *floatImport) Aliases() []string {
	return []string{"float"}
}

type boolImport struct {
	baseImport
}

func (imp *boolImport) Import() string {
	return "BooleanType"
}

func (imp *boolImport) Aliases() []string {
	return []string{"bool", "boolean"}
}

type timestampImport struct {
	baseImport
}

func (imp *timestampImport) Import() string {
	return "TimestampType"
}

func (imp *timestampImport) Aliases() []string {
	return []string{"timestamp"}
}

type timestamptzImport struct {
	baseImport
}

func (imp *timestamptzImport) Import() string {
	return "TimestamptzType"
}

func (imp *timestamptzImport) Aliases() []string {
	return []string{"timestamptz"}
}

type timeImport struct {
	baseImport
}

func (imp *timeImport) Import() string {
	return "TimeType"
}

func (imp *timeImport) Aliases() []string {
	return []string{"time"}
}

type timetzImport struct {
	baseImport
}

func (imp *timetzImport) Import() string {
	return "TimetzType"
}

func (imp *timetzImport) Aliases() []string {
	return []string{"timetz"}
}

type dateImport struct {
	baseImport
}

func (imp *dateImport) Import() string {
	return "DateType"
}

func (imp *dateImport) Aliases() []string {
	return []string{"date"}
}

type emailImport struct {
	baseImport
}

func (imp *emailImport) ImportPath() string {
	return "@snowtop/ent-email"
}

func (imp *emailImport) Import() string {
	return "EmailType"
}

func (imp *emailImport) Aliases() []string {
	return []string{"email", "email-address", "email_address"}
}

type phoneImport struct {
	baseImport
}

func (imp *phoneImport) ImportPath() string {
	return "@snowtop/ent-phonenumber"
}

func (imp *phoneImport) Import() string {
	return "PhoneNumberType"
}

func (imp *phoneImport) Aliases() []string {
	return []string{"phone", "phone_number", "phone-number"}
}

type passwordImport struct {
	baseImport
}

func (imp *passwordImport) ImportPath() string {
	return "@snowtop/ent-password"
}

func (imp *passwordImport) Import() string {
	return "PasswordType"
}

func (imp *passwordImport) Aliases() []string {
	return []string{"password"}
}

var allImports = []Import{
	&stringImport{},
	&uuidImport{},
	&intImport{},
	&floatImport{},
	&boolImport{},
	&timestampImport{},
	&timestamptzImport{},
	&timeImport{},
	&timetzImport{},
	&dateImport{},
	&emailImport{},
	&phoneImport{},
	&passwordImport{},
}

// TODO list types...

var m map[string]Import

func init() {
	m = make(map[string]Import)
	for _, imp := range allImports {
		for _, alias := range imp.Aliases() {
			alias = strings.ToLower(alias)
			if m[alias] != nil {
				panic(fmt.Errorf("developer error. duplicate alias %s", alias))
			}
			m[alias] = imp
		}
	}
}

// func IsValidType(s string) bool {
// 	return m[s] != nil
// }

// func GetTypeForField(s string) Import {
// 	return m[s]
// }

// ParseFields given the format foo:string, bar:int
func parseFields(fields []string) ([]*Field, error) {
	res := make([]*Field, len(fields))
	for idx, f := range fields {
		parts := strings.Split(f, ":")
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid field format %s. needs to be of the form field:type", f)
		}

		normalized := field.NormalizedField(parts[0])

		if m[normalized] != nil {
			return nil, fmt.Errorf("field %s in schema more than once", normalized)
		}
		typ := strings.ToLower(parts[1])

		imp, ok := m[typ]
		if !ok {
			return nil, fmt.Errorf("%s is not a valid type for a field", typ)
		}
		res[idx] = &Field{
			Name:   typ,
			Import: imp,
		}
	}
	return res, nil
}

type CodegenData struct {
	// what ever this is for Package
	//	Package *codegen.CodePath
	// get this from codePath...
	Package *codegen.ImportPackage
	Node    string
	Fields  []*Field
}

type Field struct {
	Name   string
	Import Import
}

func ParseAndGenerateSchema(codePathInfo *codegen.CodePath, node string, fields []string) error {
	parsed, err := parseFields(fields)
	if err != nil {
		return err
	}
	tsimps := tsimport.NewImports()

	filePath := path.Join(codePathInfo.GetRootPathToConfigs(), base.GetSnakeCaseName(node)+".ts")

	return file.Write(&file.TemplatedBasedFileWriter{
		Data: CodegenData{
			Node:    node,
			Fields:  parsed,
			Package: codePathInfo.GetImportPackage(),
		},
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("schema.tmpl"),
		TemplateName:      "schema.tmpl",
		PathToFile:        filePath,
		FormatSource:      true,
		TsImports:         tsimps,
		FuncMap:           tsimps.FuncMap(),
	})
}
