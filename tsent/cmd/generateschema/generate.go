package generateschema

import (
	"errors"
	"fmt"
	"path"
	"strconv"
	"strings"
	"sync"
	"text/template"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/kv"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/lolopinto/ent/internal/util"
)

func parseRegField(s string, seen map[string]bool) (*input.Field, error) {
	parts := strings.Split(s, ":")
	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid field format %s. needs to be of the form field:type", s)
	}

	normalized := field.NormalizedField(parts[0])

	if seen[normalized] {
		return nil, fmt.Errorf("field %s in schema more than once", normalized)
	}

	imp, err := enttype.ValidateTypeForImport(parts[1])
	if err != nil {
		return nil, err
	}

	ret := &input.Field{
		Name:   normalized,
		Import: imp,
	}
	if len(parts) > 2 {
		for _, key := range parts[2:] {
			if validKey(key) {
				setBooleanValue(ret, key)
			} else {
				return nil, fmt.Errorf("invalid key %s in field format", key)
			}
		}
	}
	return ret, nil
}

func parseField(s string, seen map[string]bool) (*input.Field, error) {
	i := strings.Index(s, ";")
	if i < 0 {
		return parseRegField(s, seen)
	}
	parts := 0
	ret := &input.Field{}

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
			imp, err := enttype.ValidateTypeForImport(chunk)
			if err != nil {
				return nil, err
			}
			ret.Import = imp
		} else {
			if booleanKeys[chunk] {
				setBooleanValue(ret, chunk)
			} else {
				parts := strings.Split(chunk, ":")
				if len(parts) < 2 {
					return nil, fmt.Errorf("%s is an invalid format in field", chunk)
				}
				if err := setValue(ret, parts[0], strings.Join(parts[1:], ":")); err != nil {
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

// TODO keep these. kill Field. use *input.Field and go from there?
// or wrap ours oround *input.Field
// parseFields given the format foo:string, bar:int
func parseFields(fields []string) ([]*input.Field, error) {
	res := make([]*input.Field, len(fields))
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

//func
// func NewFieldFromInput(f *input.Field) (*Field, error) {
// 	typ, err := f.GetEntType()
// 	if err != nil {
// 		return nil, err
// 	}
// 	ret := &Field{
// 		Name:                    f.Name,
// 		Unique:                  f.Unique,
// 		PrimaryKey:              f.PrimaryKey,
// 		Index:                   f.Index,
// 		Nullable:                f.Nullable,
// 		Private:                 f.Private,
// 		HideFromGraphQL:         f.HideFromGraphQL,
// 		DefaultToViewerOnCreate: f.DefaultToViewerOnCreate,
// 		ServerDefault:           fmt.Sprintf("%v", f.ServerDefault),
// 		ForeignKey:              f.ForeignKey,
// 		StorageKey:              f.StorageKey,
// 		GraphQLName:             f.GraphQLName,
// 	}

// 	return ret, nil
// }

func setBooleanValue(f *input.Field, key string) {
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

func setValue(f *input.Field, key string, val string) error {
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
func FieldObjectCall(f *input.Field) string {
	l := kv.List{
		{
			Key:   "name",
			Value: strconv.Quote(f.Name),
		},
	}
	if f.PrimaryKey {
		l = append(l, kv.Pair{
			Key:   "primaryKey",
			Value: "true",
		})
	}
	if f.Unique {
		l = append(l, kv.Pair{
			Key:   "unique",
			Value: "true",
		})
	}
	if f.Nullable {
		l = append(l, kv.Pair{
			Key:   "nullable",
			Value: "true",
		})
	}
	if f.Index {
		l = append(l, kv.Pair{
			Key:   "index",
			Value: "true",
		})
	}
	if f.Private {
		l = append(l, kv.Pair{
			Key:   "private",
			Value: "true",
		})
	}
	if f.HideFromGraphQL {
		l = append(l, kv.Pair{
			Key:   "hideFromGraphQL",
			Value: "true",
		})
	}
	if f.DefaultToViewerOnCreate {
		l = append(l, kv.Pair{
			Key:   "defaultToViewerOnCreate",
			Value: "true",
		})
	}
	if f.ServerDefault != "" && f.ServerDefault != nil {
		l = append(l, kv.Pair{
			Key:   "serverDefault",
			Value: strconv.Quote(fmt.Sprintf("%v", f.ServerDefault)),
		})
	}
	if f.StorageKey != "" {
		l = append(l, kv.Pair{
			Key:   "storageKey",
			Value: strconv.Quote(f.StorageKey),
		})
	}
	if f.GraphQLName != "" {
		l = append(l, kv.Pair{
			Key:   "graphqlName",
			Value: strconv.Quote(f.GraphQLName),
		})
	}

	if f.ForeignKey != nil {
		fkeyKv := kv.List{
			{
				Key:   "schema",
				Value: strconv.Quote(f.ForeignKey.Schema),
			},
			{
				Key:   "column",
				Value: strconv.Quote(f.ForeignKey.Column),
			},
		}
		if f.ForeignKey.Name != "" {
			fkeyKv = append(fkeyKv, kv.Pair{
				Key:   "name",
				Value: f.ForeignKey.Name,
			})
		}
		if f.ForeignKey.DisableIndex {
			fkeyKv = append(fkeyKv, kv.Pair{
				Key:   "disableIndex",
				Value: "true",
			})
		}
		l = append(l, kv.Pair{
			Key:   "foreignKey",
			Value: fkeyKv.String(),
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
	Fields     []*input.Field
	DBRows     []kv.List // list of lists...
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
	ret.Fields = []*input.Field{
		{
			Name:       col,
			Import:     &enttype.StringImport{},
			PrimaryKey: true,
		},
	}
	ret.DBRows = make([]kv.List, len(values))
	for idx, v := range values {
		ret.DBRows[idx] = kv.List{
			kv.Pair{
				Key:   col,
				Value: strconv.Quote(v),
			},
		}
	}

	return ret
}

func NewCodegenDataFromInputNode(codePathInfo *codegen.CodePath, node string, n *input.Node) *CodegenData {
	ret := &CodegenData{
		Node:    node,
		Package: codePathInfo.GetImportPackage(),
		Fields:  n.Fields,
	}
	if n.EnumTable {
		ret.EnumTable = true
		ret.Implements = true
		ret.Base = "Schema"
	} else {
		// TODO eventually support other types
		ret.Extends = true
		ret.Base = "BaseEntSchema"
	}

	// TODO throw for unsupported Fields?
	// TODO email, password, phone not currently supported

	// convert db rows
	ret.DBRows = make([]kv.List, len(n.DBRows))
	for i, dbrow := range n.DBRows {
		var l kv.List
		for k, v := range dbrow {
			l = append(l, kv.Pair{
				Key:   k,
				Value: fmt.Sprintf("%v", v),
			})
		}
		ret.DBRows[i] = l
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

func GenerateFromInputSchema(codePathInfo *codegen.CodePath, s *input.Schema) error {
	var wg sync.WaitGroup
	var serr syncerr.Error
	wg.Add(len(s.Nodes))
	for k := range s.Nodes {
		go func(k string) {
			v := s.Nodes[k]
			codegen := NewCodegenDataFromInputNode(codePathInfo, k, v)
			defer wg.Done()

			if err := GenerateSchema(codePathInfo, codegen, k); err != nil {
				serr.Append(err)
			}
		}(k)
	}
	wg.Wait()

	return serr.Err()
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
		EditableCode:      true,
		FuncMap:           getFuncMap(tsimps),
	})
}

func getFuncMap(imps *tsimport.Imports) template.FuncMap {
	m := imps.FuncMap()
	m["fieldObjectCall"] = FieldObjectCall

	return m
}
