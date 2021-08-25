package typeschema

import (
	"errors"
	"fmt"
	"path"
	"strconv"
	"strings"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
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
	return codepath.EmailPackage
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
	return codepath.PhonenumberPackage
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
	return codepath.PasswordPackage
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

func GetTypeForField(s string) Import {
	return m[s]
}

func validateType(s string) (Import, error) {
	typ := strings.ToLower(s)

	imp, ok := m[typ]
	if !ok {
		return nil, fmt.Errorf("%s is not a valid type for a field", typ)
	}
	return imp, nil
}

func parseRegField(s string, seen map[string]bool) (*Field, error) {
	parts := strings.Split(s, ":")
	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid field format %s. needs to be of the form field:type", s)
	}

	normalized := field.NormalizedField(parts[0])

	if seen[normalized] {
		return nil, fmt.Errorf("field %s in schema more than once", normalized)
	}

	imp, err := validateType(parts[1])
	if err != nil {
		return nil, err
	}

	ret := &Field{
		Name:   normalized,
		Import: imp,
	}
	if len(parts) > 2 {
		for _, key := range parts[2:] {
			if validKey(key) {
				ret.SetBooleanValue(key)
			} else {
				return nil, fmt.Errorf("invalid key %s in field format", key)
			}
		}
	}
	return ret, nil
}

func parseField(s string, seen map[string]bool) (*Field, error) {
	i := strings.Index(s, ";")
	if i < 0 {
		return parseRegField(s, seen)
	}
	parts := 0
	ret := &Field{}

	for len(s) > 0 {
		j := strings.Index(s, ";")
		var chunk string
		if j < 0 {
			// the end...
			chunk = s
		} else {
			if parts >= 2 {
				j2 := strings.Index(s, "{")
				// there's an index
				if j2 > 0 && j2 < j {
					// don't support crazy nesting yet
					// eventually, if the case arises, we need to match {}
					j3 := strings.Index(s, "}")
					if j3 == -1 {
						return nil, fmt.Errorf("invalid format. opening { without closing }")
					}
					if s[j3+1] != ';' {
						return nil, errors.New("invalid format. closing } that's not followed by ;")
					}
					j = j3 + 1
				}
			}
			chunk = s[:j]
		}
		if parts == 0 {
			ret.Name = chunk
		} else if parts == 1 {
			// type
			imp, err := validateType(chunk)
			if err != nil {
				return nil, err
			}
			ret.Import = imp
		} else {
			if booleanKeys[chunk] {
				ret.SetBooleanValue(chunk)
			} else {
				parts := strings.Split(chunk, ":")
				if len(parts) < 2 {
					return nil, fmt.Errorf("%s is an invalid format in field", chunk)
				}
				if err := ret.SetValue(parts[0], strings.Join(parts[1:], ":")); err != nil {
					return nil, err
				}
			}
		}
		parts++
		if j < 0 {
			break
		}
		s = s[j+1:]
	}
	return ret, nil
}

// parseFields given the format foo:string, bar:int
func parseFields(fields []string) ([]*Field, error) {
	res := make([]*Field, len(fields))
	seen := make(map[string]bool)
	for idx, f := range fields {

		ret, err := parseField(f, seen)
		if err != nil {
			return nil, err
		}

		res[idx] = ret
		seen[ret.Name] = true
	}
	return res, nil
}

type kvPair struct {
	key   string
	value string //interface{}
}

type kvList []kvPair

func (l kvList) String() string {
	var sb strings.Builder
	sb.WriteString("{")
	for idx, v := range l {
		if idx != 0 {
			sb.WriteString(", ")
		}
		sb.WriteString(v.key)
		sb.WriteString(": ")
		sb.WriteString(v.value)
	}
	sb.WriteString("}")
	return sb.String()
}

type Field struct {
	Name                    string
	Import                  Import
	Unique                  bool
	PrimaryKey              bool
	Index                   bool
	Nullable                bool
	Private                 bool
	HideFromGraphQL         bool
	DefaultToViewerOnCreate bool
	ServerDefault           string
	ForeignKey              *input.ForeignKey
	StorageKey              string
	GraphQLName             string

	// used in tests
	expFieldObjectCall string
	// eventually support these. have to consider the following:
	// return new Date();
	// return "DEACTIVATED";
	// return builder.viewer.viewerID
	// return input.fooID
	// for first two, have to differentiate between quotes vs not
	// for last two maybe something like defaultValueOnCreate:$(builder.viewer.viewerID) or defaultValueOnCreate:$(input.startTime)
	// DefaultValueOnCreate string
	// DefaultValueOnEdit   string

	// don't support FieldEdge because you can't specify edges here...
}

func (f *Field) SetBooleanValue(key string) {
	switch key {
	case "unique":
		f.Unique = true
	case "primaryKey":
		f.PrimaryKey = true
	case "index":
		f.Index = true
	case "nullable":
		f.Nullable = true
	case "private":
		f.Private = true
	case "hideFromGraphQL":
		f.HideFromGraphQL = true
	case "defaultToViewerOnCreate":
		f.DefaultToViewerOnCreate = true
	}
}

func (f *Field) SetValue(key string, val string) error {
	switch key {
	case "serverDefault":
		f.ServerDefault = val
	case "storageKey":
		f.StorageKey = val
	// case "defaultValueOnCreate":
	// 	f.DefaultValueOnCreate = val
	// case "defaultValueOnEdit":
	// 	f.DefaultValueOnEdit = val
	case "foreignKey":
		f.ForeignKey = &input.ForeignKey{}
		val = strings.TrimPrefix(val, "{")
		val = strings.TrimSuffix(val, "}")
		parts := strings.Split(val, ";")
		for _, part := range parts {
			parts2 := strings.Split(part, ":")
			if len(parts2) != 2 {
				return fmt.Errorf("invalid foreign part %s", part)
			}
			switch parts2[0] {
			case "schema":
				f.ForeignKey.Schema = parts2[1]
			case "column":
				f.ForeignKey.Column = parts2[1]
			case "name":
				f.ForeignKey.Name = parts2[1]
			case "disableIndex":
				f.ForeignKey.DisableIndex = parts2[1] == "true"
			}
		}
		if f.ForeignKey.Schema == "" || f.ForeignKey.Column == "" {
			return fmt.Errorf("invalid foreignKey without schema or column")
		}
	}
	return nil
}

// returns {name: "sss"...}
func (f *Field) FieldObjectCall() string {
	l := kvList{
		{
			key:   "name",
			value: strconv.Quote(f.Name),
		},
	}
	if f.PrimaryKey {
		l = append(l, kvPair{
			key:   "primaryKey",
			value: "true",
		})
	}
	if f.Unique {
		l = append(l, kvPair{
			key:   "unique",
			value: "true",
		})
	}
	if f.Nullable {
		l = append(l, kvPair{
			key:   "nullable",
			value: "true",
		})
	}
	if f.Index {
		l = append(l, kvPair{
			key:   "index",
			value: "true",
		})
	}
	if f.Private {
		l = append(l, kvPair{
			key:   "private",
			value: "true",
		})
	}
	if f.HideFromGraphQL {
		l = append(l, kvPair{
			key:   "hideFromGraphQL",
			value: "true",
		})
	}
	if f.DefaultToViewerOnCreate {
		l = append(l, kvPair{
			key:   "defaultToViewerOnCreate",
			value: "true",
		})
	}
	if f.ServerDefault != "" {
		l = append(l, kvPair{
			key:   "serverDefault",
			value: strconv.Quote(f.ServerDefault),
		})
	}
	if f.StorageKey != "" {
		l = append(l, kvPair{
			key:   "storageKey",
			value: strconv.Quote(f.StorageKey),
		})
	}
	if f.GraphQLName != "" {
		l = append(l, kvPair{
			key:   "graphqlName",
			value: strconv.Quote(f.GraphQLName),
		})
	}

	if f.ForeignKey != nil {
		fkeyKv := kvList{
			{
				key:   "schema",
				value: strconv.Quote(f.ForeignKey.Schema),
			},
			{
				key:   "column",
				value: strconv.Quote(f.ForeignKey.Column),
			},
		}
		if f.ForeignKey.Name != "" {
			fkeyKv = append(fkeyKv, kvPair{
				key:   "name",
				value: f.ForeignKey.Name,
			})
		}
		if f.ForeignKey.DisableIndex {
			fkeyKv = append(fkeyKv, kvPair{
				key:   "disableIndex",
				value: "true",
			})
		}
		l = append(l, kvPair{
			key:   "foreignKey",
			value: fkeyKv.String(),
		})
	}

	return l.String()
}

func validKey(key string) bool {
	return booleanKeys[key]
}

// boolean
var booleanKeys = map[string]bool{
	"unique":                  true,
	"primaryKey":              true,
	"nullable":                true,
	"index":                   true,
	"private":                 true,
	"hideFromGraphQL":         true,
	"defaultToViewerOnCreate": true,
}

type CodegenData struct {
	Package    *codegen.ImportPackage
	Node       string
	EnumTable  bool
	Fields     []*Field
	DBRows     []kvList // list of lists...
	Extends    bool
	Base       string
	Implements bool
}

func (c *CodegenData) DBRowsCall() string {
	var sb strings.Builder

	sb.WriteString("[")
	for i, r := range c.DBRows {
		if i != 0 {
			sb.WriteString(", ")
		}
		sb.WriteString(r.String())
	}
	sb.WriteString("]")
	return sb.String()
}

func NewEnumCodegenData(codePathInfo *codegen.CodePath, schema, col string, values []string) *CodegenData {
	ret := &CodegenData{
		Node:      schema,
		EnumTable: true,
		Package:   codePathInfo.GetImportPackage(),

		Implements: true,
		Base:       "Schema",
	}
	ret.Fields = []*Field{
		{
			Name:       col,
			Import:     &stringImport{},
			PrimaryKey: true,
		},
	}
	ret.DBRows = make([]kvList, len(values))
	for idx, v := range values {
		ret.DBRows[idx] = kvList{
			kvPair{
				key:   col,
				value: strconv.Quote(v),
			},
		}
	}

	return ret
}

// TODO test ...
func ParseAndGenerateSchema(codePathInfo *codegen.CodePath, node string, fields []string) error {
	parsed, err := parseFields(fields)
	if err != nil {
		return err
	}

	data := &CodegenData{
		Node:    node,
		Fields:  parsed,
		Package: codePathInfo.GetImportPackage(),
		Extends: true,
		Base:    "BaseEntSchema",
	}

	return GenerateSchema(codePathInfo, data, node)
}

func GenerateSchema(codePathInfo *codegen.CodePath, data *CodegenData, node string) error {
	tsimps := tsimport.NewImports()

	filePath := path.Join(codePathInfo.GetRootPathToConfigs(), base.GetSnakeCaseName(node)+".ts")

	return file.Write(&file.TemplatedBasedFileWriter{
		Data:              data,
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("schema.tmpl"),
		TemplateName:      "schema.tmpl",
		PathToFile:        filePath,
		FormatSource:      true,
		TsImports:         tsimps,
		FuncMap:           tsimps.FuncMap(),
	})
}
