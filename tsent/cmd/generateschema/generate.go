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
	"github.com/lolopinto/ent/internal/codepath"
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

func appendBoolean(o *kv.Object, predicate bool, key string) {
	if !predicate {
		return
	}
	o.Append(kv.Pair{Key: key, Value: "true"})
}

func appendValue(o *kv.Object, key, value string) {
	if value == "" {
		return
	}
	o.Append(kv.Pair{Key: key, Value: value})
}

func appendQuotedValue(o *kv.Object, key, value string) {
	if value == "" {
		return
	}
	o.Append(kv.Pair{
		Key:   key,
		Value: strconv.Quote(value),
	})
}

func appendQuotedList(o *kv.Object, key string, values []string) {
	if len(values) == 0 {
		return
	}
	o.Append(kv.Pair{
		Key:   key,
		Value: kv.NewListItemWithQuotedItems(values).String(),
	})
}

// returns {name: "sss"...}
func FieldObjectCall(f *input.Field) string {
	o := &kv.Object{}
	appendQuotedValue(o, "name", f.Name)
	appendBoolean(o, f.PrimaryKey, "primaryKey")
	appendBoolean(o, f.Unique, "unique")
	appendBoolean(o, f.Nullable, "nullable")
	appendBoolean(o, f.Index, "index")
	appendBoolean(o, f.Private, "private")
	appendBoolean(o, f.HideFromGraphQL, "hideFromGraphQL")
	appendBoolean(o, f.DefaultToViewerOnCreate, "defaultToViewerOnCreate")

	if f.ServerDefault != "" && f.ServerDefault != nil {
		o.Append(kv.Pair{
			Key:   "serverDefault",
			Value: strconv.Quote(fmt.Sprintf("%v", f.ServerDefault)),
		})
	}
	appendQuotedValue(o, "storageKey", f.StorageKey)
	appendQuotedValue(o, "graphqlName", f.GraphQLName)

	if f.ForeignKey != nil {
		fkeyKv := kv.Object{}
		appendQuotedValue(&fkeyKv, "schema", f.ForeignKey.Schema)
		appendQuotedValue(&fkeyKv, "column", f.ForeignKey.Column)
		appendValue(&fkeyKv, "name", f.ForeignKey.Name)
		appendBoolean(o, f.ForeignKey.DisableIndex, "disableIndex")
		o.AppendObject(
			"foreignKey",
			fkeyKv,
		)
	}

	// TODO fieldEdge

	return o.String()
}

// this should be everything we need just need to test it
func EdgeObjectCall(e *input.AssocEdge) *kv.Object {
	o := &kv.Object{}
	appendQuotedValue(o, "name", e.Name)
	appendQuotedValue(o, "schemaName", e.SchemaName)
	appendQuotedValue(o, "tableName", e.TableName)
	appendBoolean(o, e.Unique, "unique")
	appendBoolean(o, e.Symmetric, "symmetric")
	appendBoolean(o, e.HideFromGraphQL, "hideFromGraphQL")
	if e.InverseEdge != nil {
		invEdge := kv.Object{}
		appendQuotedValue(&invEdge, "name", e.InverseEdge.Name)
		o.AppendObject("inverseEdge", invEdge)
	}
	if len(e.EdgeActions) > 0 {
		edgeKvs := kv.List{}
		for _, action := range e.EdgeActions {
			edgeKvs.Append(getEdgeAction(action))
		}
		o.AppendList("edgeActions", edgeKvs)
	}
	return o
}

func getEdgeAction(action *input.EdgeAction) kv.Object {
	actionKv := kv.Object{}
	actionKv.Append(
		kv.Pair{
			Key:   "operation",
			Value: action.GetTSStringOperation(),
			Import: &kv.Import{
				ImportPath: codepath.SchemaPackage,
				Import:     "ActionOperation",
			},
		},
	)
	appendQuotedValue(&actionKv, "actionName", action.CustomActionName)
	appendQuotedValue(&actionKv, "graphQLName", action.CustomGraphQLName)
	appendQuotedValue(&actionKv, "inputName", action.CustomInputName)
	appendBoolean(&actionKv, action.HideFromGraphQL, "hideFromGraphQL")

	if len(action.ActionOnlyFields) > 0 {
		l := kv.List{}
		for _, f := range action.ActionOnlyFields {
			l.Append(getActionOnlyField(f))
		}
		actionKv.AppendList("actionOnlyFields", l)
	}
	return actionKv
}

func getActionOnlyField(f *input.ActionField) kv.Object {
	o := &kv.Object{}

	appendQuotedValue(o, "name", f.Name)
	appendQuotedValue(o, "type", string(f.Type))

	appendBoolean(o, f.Nullable, "nullable")
	appendValue(o, "actionName", f.ActionName)
	// TODO list shenanigans

	return *o
}

func EdgeGroupObjectCall(eg *input.AssocEdgeGroup) *kv.Object {
	o := &kv.Object{}
	appendQuotedValue(o, "name", eg.Name)
	appendQuotedValue(o, "groupStatusName", eg.GroupStatusName)
	appendQuotedValue(o, "tableName", eg.TableName)
	if len(eg.AssocEdges) > 0 {
		l := kv.List{}
		for _, edge := range eg.AssocEdges {
			edgeObj := EdgeObjectCall(edge)
			l.Append(*edgeObj)
		}
		o.AppendList("assocEdges", l)
	}
	appendQuotedList(o, "statusEnums", eg.StatusEnums)
	appendQuotedList(o, "nullStates", eg.NullStates)
	appendQuotedValue(o, "nullStateFn", eg.NullStateFn)
	// TODO edgeActions is not a typescript thing but can be here. throw?
	if eg.EdgeAction != nil {
		o.AppendObject("edgeAction", getEdgeAction(eg.EdgeAction))
	}

	return o
}

func ActionObjectCall(a *input.Action) *kv.Object {
	o := &kv.Object{}
	o.Append(kv.Pair{
		Key:   "operation",
		Value: a.GetTSStringOperation(),
		Import: &kv.Import{
			ImportPath: codepath.SchemaPackage,
			Import:     "ActionOperation",
		},
	})
	appendQuotedList(o, "fields", a.Fields)
	appendQuotedValue(o, "actionName", a.CustomActionName)
	appendQuotedValue(o, "inputName", a.CustomInputName)
	appendQuotedValue(o, "graphQLName", a.CustomGraphQLName)
	appendBoolean(o, a.HideFromGraphQL, "hideFromGraphQL")

	if len(a.ActionOnlyFields) > 0 {
		l := kv.List{}
		for _, a2 := range a.ActionOnlyFields {
			l.Append(getActionOnlyField(a2))
		}
		o.AppendList("actionOnlyFields", l)
	}

	// TODO things like NoFields, requiredField, optionalField
	return o
}

func ConstraintObjectCall(c *input.Constraint) *kv.Object {
	o := &kv.Object{}
	appendQuotedValue(o, "name", c.Name)
	o.Append(kv.Pair{
		Key:   "type",
		Value: c.GetConstraintTypeString(),
		Import: &kv.Import{
			ImportPath: codepath.SchemaPackage,
			Import:     "ConstraintType",
		},
	})
	appendQuotedList(o, "columns", c.Columns)

	if c.ForeignKey != nil {
		fkey := &kv.Object{}
		appendQuotedValue(fkey, "tableName", c.ForeignKey.TableName)
		appendQuotedList(fkey, "columns", c.ForeignKey.Columns)
		appendQuotedValue(fkey, "ondelete", string(c.ForeignKey.OnDelete))
		o.AppendObject("fkey", *fkey)
	}

	appendQuotedValue(o, "condition", c.Condition)
	return o
}

func IndexObjectCall(i *input.Index) *kv.Object {
	o := &kv.Object{}
	appendQuotedValue(o, "name", i.Name)
	appendQuotedList(o, "columns", i.Columns)
	appendBoolean(o, i.Unique, "unique")
	return o
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
	Package         *codegen.ImportPackage
	Node            string
	EnumTable       bool
	TableName       string
	HideFromGraphQL bool
	Fields          []*input.Field
	Edges           []*input.AssocEdge
	Actions         []*input.Action
	EdgeGroups      []*input.AssocEdgeGroup
	Constraints     []*input.Constraint
	Indices         []*input.Index
	DBRows          kv.List
	Extends         bool
	Base            string
	Implements      bool
}

func (c *CodegenData) DBRowsCall() string {
	return c.DBRows.String()
}

func NewEnumCodegenData(cfg *codegen.Config, schema, col string, values []string) *CodegenData {
	ret := &CodegenData{
		Node:      schema,
		EnumTable: true,
		Package:   cfg.GetImportPackage(),

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
	ret.DBRows = kv.List{}

	for _, v := range values {
		o := &kv.Object{}
		appendQuotedValue(o, col, v)
		ret.DBRows.Append(*o)
	}

	return ret
}

func NewCodegenDataFromInputNode(cfg *codegen.Config, node string, n *input.Node) *CodegenData {
	ret := &CodegenData{
		Node:            node,
		Package:         cfg.GetImportPackage(),
		Fields:          n.Fields,
		Edges:           n.AssocEdges,
		EdgeGroups:      n.AssocEdgeGroups,
		Actions:         n.Actions,
		Constraints:     n.Constraints,
		Indices:         n.Indices,
		HideFromGraphQL: n.HideFromGraphQL,
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
	if n.TableName != nil {
		ret.TableName = strconv.Quote(*n.TableName)
	}

	// TODO throw for unsupported Fields?

	// convert db rows
	ret.DBRows = kv.List{}
	for _, dbrow := range n.DBRows {
		o := &kv.Object{}
		for k, v := range dbrow {
			appendQuotedValue(o, k, fmt.Sprintf("%v", v))
		}
		ret.DBRows.Append(*o)
	}

	return ret
}

// TODO test ...
func ParseAndGenerateSchema(cfg *codegen.Config, node string, fields []string) error {
	parsed, err := parseFields(fields)
	if err != nil {
		return err
	}

	data := &CodegenData{
		Node:    node,
		Fields:  parsed,
		Package: cfg.GetImportPackage(),
		Extends: true,
		Base:    "BaseEntSchema",
	}

	return GenerateSingleSchema(cfg, data, node)
}

func GenerateFromInputSchema(cfg *codegen.Config, s *input.Schema) error {
	var wg sync.WaitGroup
	var serr syncerr.Error
	wg.Add(len(s.Nodes))
	for k := range s.Nodes {
		go func(k string) {
			v := s.Nodes[k]
			codegen := NewCodegenDataFromInputNode(cfg, k, v)
			defer wg.Done()

			if err := generateSchema(cfg, codegen, k); err != nil {
				serr.Append(err)
			}
		}(k)
	}
	wg.Wait()

	if err := serr.Err(); err != nil {
		return err
	}
	return codegen.FormatTS(cfg)
}

func GenerateSingleSchema(cfg *codegen.Config, data *CodegenData, node string) error {
	if err := generateSchema(cfg, data, node); err != nil {
		return err
	}

	return codegen.FormatTS(cfg)
}

// have to call codegen.FormatTS() after since we now do the formatting at once
// as opposed to for each file
func generateSchema(cfg *codegen.Config, data *CodegenData, node string) error {
	filePath := path.Join(cfg.GetRootPathToConfigs(), base.GetSnakeCaseName(node)+".ts")
	tsimps := tsimport.NewImports(cfg, filePath)

	return file.Write(&file.TemplatedBasedFileWriter{
		Config:            cfg,
		Data:              data,
		CreateDirIfNeeded: true,
		AbsPathToTemplate: util.GetAbsolutePath("schema.tmpl"),
		TemplateName:      "schema.tmpl",
		PathToFile:        filePath,
		TsImports:         tsimps,
		EditableCode:      true,
		FuncMap:           getFuncMap(tsimps),
	})
}

func getFuncMap(imps *tsimport.Imports) template.FuncMap {
	m := imps.FuncMap()
	m["fieldObjectCall"] = FieldObjectCall
	m["edgeObjectCall"] = EdgeObjectCall
	m["edgeGroupObjectCall"] = EdgeGroupObjectCall
	m["actionObjectCall"] = ActionObjectCall
	m["constraintObjectCall"] = ConstraintObjectCall
	m["indexObjectCall"] = IndexObjectCall

	return m
}
