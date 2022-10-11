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
	SortFields bool
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

	var primaryKeys []string
	for _, field := range fields {
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
	// really only used in tests and old go schema
	NonEntFields []*NonEntField
	// keep track of computed fields just to know they exist
	computedFields map[string]bool
	getFieldsFn    bool

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

	return nil
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
	// Note that changing this should update foreignKeyInfoEqual
	Schema       string
	Field        string
	Name         string
	DisableIndex bool
}
