package field

import (
	"fmt"
	"sort"
	"strings"

	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/util"
)

type Options struct {
	SortFields              bool
	FieldOverrides          map[string]*input.FieldOverride
	ForceDisableBuilderType bool
}

// NewFieldInfoFromInputs generates Fields based on FieldInputs
// Decouples the parsing of fields from the logic associated with it
// Means this can be called by multiple languages using this or different formats/sources
// in each language e.g. golang supporting fields in a struct or the stronger API (ent.FieldMap)

func NewFieldInfoFromInputs(cfg codegenapi.Config, nodeName string, fields []*input.Field, options *Options) (*FieldInfo, error) {
	fieldInfo := &FieldInfo{
		fieldMap:       make(map[string]*Field),
		names:          make(map[string]bool),
		cols:           make(map[string]*Field),
		computedFields: make(map[string]bool),
	}
	var errs []error

	overrides := make(map[string]*input.FieldOverride)
	if options.FieldOverrides != nil {
		overrides = options.FieldOverrides
	}
	var primaryKeys []string
	for _, field := range fields {
		// apply overrides if it applies
		override := overrides[field.Name]
		if override != nil {
			field.ApplyOverride(override)
		}

		f, err := newFieldFromInput(cfg, nodeName, field)
		if err != nil {
			return nil, err
		}
		if f.SingleFieldPrimaryKey() {
			primaryKeys = append(primaryKeys, f.FieldName)
		}
		if err := fieldInfo.addField(f); err != nil {
			errs = append(errs, err)
		}
		if options.ForceDisableBuilderType {
			f.disableBuilderType = true
		}
		for _, derivedField := range field.DerivedFields {
			f2, err := newFieldFromInput(cfg, nodeName, derivedField)
			if err != nil {
				errs = append(errs, err)
			}
			if err := fieldInfo.addField(f2); err != nil {
				errs = append(errs, err)
			}
		}
	}
	fieldInfo.primaryKeys = primaryKeys

	if len(errs) > 0 {
		// we're getting list of errors and coalescing
		return nil, util.CoalesceErr(errs...)
	}

	if options.SortFields {
		//		sort fields
		sort.Slice(fieldInfo.fields, func(i, j int) bool {
			// sort lexicographically but put ID first
			if fieldInfo.fields[i].FieldName == "id" {
				return true
			}
			if fieldInfo.fields[j].FieldName == "id" {
				return false
			}

			return fieldInfo.fields[i].FieldName < fieldInfo.fields[j].FieldName
		})
	}

	return fieldInfo, nil
}

type FieldInfo struct {
	fields   []*Field
	fieldMap map[string]*Field
	// really only used in tests and old go schema
	NonEntFields []*NonEntField
	// keep track of computed fields just to know they exist
	computedFields map[string]bool

	primaryKeys []string

	names map[string]bool
	cols  map[string]*Field
}

func NormalizedField(s string) string {
	return strings.ToLower(s)
}

func (fieldInfo *FieldInfo) AddComputedField(f string) error {
	if fieldInfo.computedFields[f] {
		return fmt.Errorf("already have generated computed column %s", f)
	}
	fieldInfo.computedFields[f] = true
	return nil
}

func (fieldInfo *FieldInfo) IsComputedField(f string) bool {
	return fieldInfo.computedFields[f]
}

func (fieldInfo *FieldInfo) SingleFieldPrimaryKey() string {
	if len(fieldInfo.primaryKeys) == 1 {
		return fieldInfo.primaryKeys[0]
	}
	return ""
}

func (fieldInfo *FieldInfo) addField(f *Field) error {
	name := NormalizedField(f.FieldName)
	if name == "" {
		return fmt.Errorf("invalid db col `%s` for Field `%s`", name, f.FieldName)
	}
	if fieldInfo.cols[f.dbName] != nil {
		return fmt.Errorf("field with column %s already exists", f.dbName)
	}
	if fieldInfo.names[name] {
		return fmt.Errorf("field with normalized name %s already exists", name)
	}
	fieldInfo.cols[f.dbName] = f
	fieldInfo.names[name] = true

	fieldInfo.fields = append(fieldInfo.fields, f)
	fieldInfo.fieldMap[f.FieldName] = f

	return nil
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
	f.hideFromGraphQLBecauseEdge = true
	return nil
}

func (fieldInfo *FieldInfo) GraphQLFields() []*Field {
	var fields []*Field

	for _, f := range fieldInfo.fields {
		if !f.hideFromGraphQL && !f.dbOnly {
			fields = append(fields, f)
		}
	}
	return fields
}

func (fieldInfo *FieldInfo) AllFields() []*Field {
	return fieldInfo.fields
}

func (fieldInfo *FieldInfo) EntFields() []*Field {
	var fields []*Field

	for _, f := range fieldInfo.fields {
		if !f.dbOnly {
			fields = append(fields, f)
		}
	}
	return fields
}

// need a difference btw builder fields, create-only fields etc
// basically need to special case create and add it in creation and then overrideFoo(val)
// etc...
func (fieldInfo *FieldInfo) GetEditableFieldsInBuilder() []*Field {
	var fields []*Field
	for _, f := range fieldInfo.fields {
		if f.EditableField(BuilderEditableContext) && !f.dbOnly {
			fields = append(fields, f)
		}
	}
	return fields
}

func (fieldInfo *FieldInfo) GetImmutableFields() []*Field {
	var fields []*Field
	for _, f := range fieldInfo.fields {
		if f.immutable {
			fields = append(fields, f)
		}
	}

	return fields
}

// should be only used in builder
func (fieldInfo *FieldInfo) NotEditableInverseEdgeFieldsWithDefaults() []*Field {
	var fields []*Field
	for _, f := range fieldInfo.fields {
		if f.EditableField(BuilderEditableContext) || f.inverseEdge == nil {
			continue
		}
		if f.hasDefaultValueOnCreate || f.hasDefaultValueOnEdit || f.defaultToViewerOnCreate {
			fields = append(fields, f)
		}
	}
	return fields
}

// ForeignKeyInfo stores config and field name of the foreign key object
type ForeignKeyInfo struct {
	// Note that changing this should update foreignKeyInfoEqual
	Schema       string
	Field        string
	Name         string
	DisableIndex bool
}
