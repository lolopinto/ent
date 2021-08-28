package field

import (
	"errors"
	"fmt"
	"go/ast"
	"go/types"
	"sort"
	"strconv"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/util"
)

type Options struct {
	SortFields    bool
	AddBaseFields bool
}

// NewFieldInfoFromInputs generates Fields based on FieldInputs
// Decouples the parsing of fields from the logic associated with it
// Means this can be called by multiple languages using this or different formats/sources
// in each language e.g. golang supporting fields in a struct or the stronger API (ent.FieldMap)
func NewFieldInfoFromInputs(fields []*input.Field, options *Options) (*FieldInfo, error) {
	fieldInfo := &FieldInfo{
		fieldMap:       make(map[string]*Field),
		emailFields:    make(map[string]bool),
		passwordFields: make(map[string]bool),
		names:          make(map[string]bool),
		cols:           make(map[string]*Field),
	}
	var errs []error

	// this is only done in go-lang.
	// we'll eventually kill this since this shouldn't
	// be done automatically
	if options.AddBaseFields {
		if err := addBaseFields(fieldInfo); err != nil {
			errs = append(errs, err)
		}
	}

	for _, field := range fields {
		f, err := newFieldFromInput(field)
		if err != nil {
			return nil, err
		}
		if err := fieldInfo.addField(f); err != nil {
			errs = append(errs, err)
		}
		for _, derivedField := range field.DerivedFields {
			f2, err := newFieldFromInput(derivedField)
			if err != nil {
				errs = append(errs, err)
			}
			if err := fieldInfo.addField(f2); err != nil {
				errs = append(errs, err)
			}
		}
	}

	if len(errs) > 0 {
		// we're getting list of errors and coalescing
		return nil, util.CoalesceErr(errs...)
	}

	if options.SortFields {
		//		sort fields
		sort.Slice(fieldInfo.Fields, func(i, j int) bool {
			// sort lexicographically but put ID first
			if fieldInfo.Fields[i].FieldName == "ID" {
				return true
			}
			if fieldInfo.Fields[j].FieldName == "ID" {
				return false
			}

			return fieldInfo.Fields[i].FieldName < fieldInfo.Fields[j].FieldName
		})
	}

	return fieldInfo, nil
}

type FieldInfo struct {
	Fields   []*Field
	fieldMap map[string]*Field
	// really only used in tests
	NonEntFields []*NonEntField
	getFieldsFn  bool

	emailFields    map[string]bool
	passwordFields map[string]bool

	names map[string]bool
	cols  map[string]*Field
}

const (
	// EmailPkgPath is the package path for the built-in email datatype
	EmailPkgPath = "github.com/lolopinto/ent/ent/field/email"

	// PasswordPkgPath is the package path for the built-in password datatype
	PasswordPkgPath = "github.com/lolopinto/ent/ent/field/password"
)

func NormalizedField(s string) string {
	return strings.ToLower(s)
}

func (fieldInfo *FieldInfo) addField(f *Field) error {
	name := NormalizedField(f.FieldName)
	if fieldInfo.cols[f.dbName] != nil {
		return fmt.Errorf("field with column %s already exists", f.dbName)
	}
	if fieldInfo.names[name] {
		return fmt.Errorf("field with normalized name %s already exists", name)
	}
	fieldInfo.cols[f.dbName] = f
	fieldInfo.names[name] = true

	fieldInfo.Fields = append(fieldInfo.Fields, f)
	fieldInfo.fieldMap[f.FieldName] = f

	if f.dataTypePkgPath == EmailPkgPath {
		fieldInfo.emailFields[f.FieldName] = true
	}
	if f.dataTypePkgPath == PasswordPkgPath {
		fieldInfo.passwordFields[f.FieldName] = true
	}
	return nil
}

// EmailPasswordCombo holds a Pair of EmailPassword field used for validation
type EmailPasswordCombo struct {
	Email    *Field
	Password *Field
}

// GetEmailPasswordCombo returns an instance of EmailPasswordCombo if we should have
// the ValidateEmailPassword method for email/password validation
func (fieldInfo *FieldInfo) GetEmailPasswordCombo() *EmailPasswordCombo {
	// what happens if there's more than one?
	// deal with that in the future
	if len(fieldInfo.passwordFields) != 1 || len(fieldInfo.emailFields) != 1 {
		return nil
	}

	ret := &EmailPasswordCombo{}
	for key := range fieldInfo.emailFields {
		ret.Email = fieldInfo.fieldMap[key]
	}
	for key := range fieldInfo.passwordFields {
		ret.Password = fieldInfo.fieldMap[key]
	}
	return ret
}

// GetFieldsFn returns a boolean which when returns true indicates that
// the Node used the GetFields() API in the config to define fields as
// opposed to fields in a struct
func (fieldInfo *FieldInfo) GetFieldsFn() bool {
	return fieldInfo.getFieldsFn
}

func (fieldInfo *FieldInfo) GetFieldByName(fieldName string) *Field {
	return fieldInfo.fieldMap[fieldName]
}

func (fieldInfo *FieldInfo) GetFieldByColName(col string) *Field {
	return fieldInfo.cols[col]
}

func (fieldInfo *FieldInfo) InvalidateFieldForGraphQL(f *Field) error {
	fByName := fieldInfo.GetFieldByName(f.FieldName)
	if fByName == nil {
		return fmt.Errorf("invalid field passed to InvalidateFieldForGraphQL")
	}
	if fByName != f {
		return fmt.Errorf("invalid field passed to InvalidateFieldForGraphQL")
	}
	f.hideFromGraphQL = true
	return nil
}

func (fieldInfo *FieldInfo) TopLevelFields() []*Field {
	var fields []*Field

	for _, f := range fieldInfo.Fields {
		if f.topLevelStructField {
			fields = append(fields, f)
		}
	}
	return fields
}

func (fieldInfo *FieldInfo) GraphQLFields() []*Field {
	var fields []*Field

	for _, f := range fieldInfo.Fields {
		if !f.hideFromGraphQL {
			fields = append(fields, f)
		}
	}
	return fields
}

func (fieldInfo *FieldInfo) GetEditableFields() []*Field {
	var fields []*Field
	for _, f := range fieldInfo.Fields {
		if f.EditableField() {
			fields = append(fields, f)
		}
	}
	return fields
}

// ForeignKeyInfo stores config and field name of the foreign key object
type ForeignKeyInfo struct {
	Schema       string
	Field        string
	Name         string
	DisableIndex bool
}

func GetNilableGoType(f *Field) string {
	// See comment in GetNonNilableGoType
	// In cases, where we want a Nillable type, we need to explicitly add it here
	structType := GetNonNilableGoType(f)
	if !f.Nullable() {
		return structType
	}
	// we want a nillable type and the default declaration doesn't have it, include the *
	if structType[0] != '*' {
		structType = "*" + structType
	}
	return structType
}

func GetNonNilableGoType(f *Field) string {
	// Because of the current API for Fields, the underlying type
	// is "string", "int", "float64", etc so this is never quite nullable
	// and we can just return the string representation here
	// since nullable is currently encoded as a struct tag or a different flag
	// To enforce nullable value, see above
	return enttype.GetGoType(f.entType)
}

func addBaseFields(fieldInfo *FieldInfo) error {
	// TODO eventually get these from ent.Node instead of doing this manually
	// add id field
	idField := newField("ID")
	idField.exposeToActionsByDefault = false
	idField.topLevelStructField = false
	idField.singleFieldPrimaryKey = true
	idField.fieldType = &enttype.IDType{}
	if err := fieldInfo.addField(idField); err != nil {
		return err
	}

	// going to assume we don't want created at and updated at in graphql
	// TODO when we get this from ent.Node, use struct tag graphql: "_"
	// need to stop all this hardcoding going on

	// add created_at and updated_at fields
	createdAtField := newField("CreatedAt")
	createdAtField.hideFromGraphQL = true
	createdAtField.exposeToActionsByDefault = false
	createdAtField.topLevelStructField = false
	createdAtField.fieldType = &enttype.TimestampType{}
	if err := fieldInfo.addField(createdAtField); err != nil {
		return err
	}

	updatedAtField := newField("UpdatedAt")
	updatedAtField.hideFromGraphQL = true
	// immutable instead...?
	updatedAtField.exposeToActionsByDefault = false
	updatedAtField.topLevelStructField = false
	updatedAtField.fieldType = &enttype.TimestampType{}
	return fieldInfo.addField(updatedAtField)
}

func GetFieldInfoForStruct(s *ast.StructType, info *types.Info) (*FieldInfo, error) {
	getUnquotedKeyFromTag := func(tagMap map[string]string, key string) string {
		val := tagMap[key]
		if val == "" {
			return ""
		}
		rawVal, err := strconv.Unquote(val)
		if err != nil {
			util.GoSchemaKill(err)
		}
		return rawVal
	}

	isKeyTrue := func(tagMap map[string]string, key string) bool {
		return getUnquotedKeyFromTag(tagMap, key) == "true"
	}

	var fields []*input.Field
	for _, f := range s.Fields.List {
		// embedded things
		if len(f.Names) == 0 {
			continue
		}
		fieldName := f.Names[0].Name

		field := &input.Field{
			Name: fieldName,
		}

		tagMap := parseFieldTag(fieldName, f.Tag)
		field.TagMap = tagMap

		// override dbName
		if tagMap["db"] != "" {
			field.StorageKey = getUnquotedKeyFromTag(tagMap, "db")
		}

		if tagMap["default"] != "" {
			field.ServerDefault = getUnquotedKeyFromTag(tagMap, "default")
		}
		field.Nullable = isKeyTrue(tagMap, "nullable")
		field.Unique = isKeyTrue(tagMap, "unique")
		field.Index = isKeyTrue(tagMap, "index")

		field.GoType = info.TypeOf(f.Type)

		fkey := getUnquotedKeyFromTag(tagMap, "fkey")
		if fkey != "" {
			parts := strings.Split(fkey, ".")
			if len(parts) != 2 {
				return nil, errors.New("invalid foreign key struct tag format")
			}
			field.ForeignKey = &input.ForeignKey{
				Schema: parts[0],
				Column: parts[1],
			}
		}

		// only care when there's something here
		if tagMap["graphql"] != "" {
			graphQLName := getUnquotedKeyFromTag(tagMap, "graphql")

			// even when the tab says hide, we're keeping the name because actions needs a graphqlName returned??
			if graphQLName == "_" {
				field.HideFromGraphQL = true
			} else {
				field.GraphQLName = graphQLName
			}
		}
		fields = append(fields, field)
	}

	// no fields
	if len(fields) == 0 {
		return nil, nil
	}

	return NewFieldInfoFromInputs(fields, &Options{
		AddBaseFields: true,
	})
}

func parseFieldTag(fieldName string, tag *ast.BasicLit) map[string]string {
	tagsMap := make(map[string]string)
	if t := tag; t != nil {
		// struct tag format should be something like `graphql:"firstName" db:"first_name"`
		tags := strings.Split(t.Value, "`")
		if len(tags) != 3 {
			util.GoSchemaKill("invalid struct tag format. handle better. struct tag not enclosed by backticks")
		}

		// each tag is separated by a space
		tags = strings.Split(tags[1], " ")
		for _, tagInfo := range tags {
			// TODO maybe eventually use a fancier struct tag library. for now, handle here
			// get each tag and create a map
			singleTag := strings.Split(tagInfo, ":")
			if len(singleTag) != 2 {
				util.GoSchemaKill("invalid struct tag format. handle better")
			}
			tagsMap[singleTag[0]] = singleTag[1]
		}
	}

	return tagsMap
}

type NonEntField struct {
	FieldName string
	FieldType enttype.Type
}

func (f *NonEntField) GetGraphQLName() string {
	return strcase.ToLowerCamel(f.FieldName)
}
