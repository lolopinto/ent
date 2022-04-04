package graphql

import (
	"fmt"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/tsimport"
)

type CustomData struct {
	Args    map[string]*CustomObject `json:"args,omitempty"`
	Inputs  map[string]*CustomObject `json:"inputs,omitempty"`
	Objects map[string]*CustomObject `json:"objects,omitempty"`
	// map of class to fields in that class
	Fields        map[string][]CustomField    `json:"fields,omitempty"`
	Queries       []CustomField               `json:"queries,omitempty"`
	Mutations     []CustomField               `json:"mutations,omitempty"`
	Classes       map[string]*CustomClassInfo `json:"classes,omitempty"`
	Files         map[string]*CustomFile      `json:"files,omitempty"`
	CustomTypes   map[string]*CustomType      `json:"customTypes,omitempty"`
	Error         error                       `json:"-"`
	compareResult *compareCustomData          `json:"-"`
}

type CustomItem struct {
	Name         string                 `json:"name,omitempty"`
	Type         string                 `json:"type,omitempty"`
	Nullable     NullableItem           `json:"nullable,omitempty"`
	List         bool                   `json:"list,omitempty"`
	Connection   bool                   `json:"connection,omitempty"`
	IsContextArg bool                   `json:"isContextArg,omitempty"`
	TSType       string                 `json:"tsType,omitempty"`
	imports      []*tsimport.ImportPath `json:"-"`
}

type CustomScalarInfo struct {
	Description    string `json:"description,omitempty"`
	Name           string `json:"name,omitempty"`
	SpecifiedByURL string `json:"specifiedByUrl,omitempty"`
}

func (cs *CustomScalarInfo) getRenderer(s *gqlSchema) renderer {
	return &scalarRenderer{
		name:           cs.Name,
		description:    cs.Description,
		specifiedByUrl: cs.SpecifiedByURL,
	}
}

type CustomType struct {
	Type       string `json:"type,omitempty"`
	ImportPath string `json:"importPath,omitempty"`

	// custom scalar info. used for schema.gql
	ScalarInfo *CustomScalarInfo `json:"scalarInfo,omitempty"`

	// both of these are optional
	TSType       string `json:"tsType,omitempty"`
	TSImportPath string `json:"tsImportPath,omitempty"`
}

func (item *CustomItem) addImportImpl(imps ...string) {
	for _, imp := range imps {
		// TODO this doesn't work for the new custom types?
		item.imports = append(item.imports, &tsimport.ImportPath{
			ImportPath: "graphql",
			Import:     imp,
		})
	}
}

func (item *CustomItem) initialize() error {
	switch item.Nullable {
	case NullableTrue:
		if item.List {
			item.addImportImpl("GraphQLList", "GraphQLNonNull")
		}

	case NullableContents:
		if !item.List {
			return fmt.Errorf("list required to use this option")
		}
		item.addImportImpl("GraphQLNonNull", "GraphQLList")

	case NullableContentsAndList:
		if !item.List {
			return fmt.Errorf("list required to use this option")
		}
		item.addImportImpl("GraphQLList")

	default:
		if item.List {
			item.addImportImpl("GraphQLNonNull", "GraphQLList", "GraphQLNonNull")
		} else {
			item.addImportImpl("GraphQLNonNull")
		}
	}

	return nil
}

func (item *CustomItem) addImport(imp *tsimport.ImportPath) {
	item.imports = append(item.imports, imp)
}

func (item *CustomItem) getImports(s *gqlSchema, cd *CustomData) ([]*tsimport.ImportPath, error) {
	if err := item.initialize(); err != nil {
		return nil, err
	}

	// TODO need to know if mutation or query...
	imp := s.getImportFor(item.Type, false)
	if imp != nil {
		item.addImport(imp)
	} else {
		_, ok := s.customData.Objects[item.Type]
		if !ok {
			return nil, fmt.Errorf("found a type %s which was not part of the schema", item.Type)
		}
		item.addImport(
			&tsimport.ImportPath{
				Import: fmt.Sprintf("%sType", item.Type),
				// TODO same here. need to know if mutation or query
				ImportPath: codepath.GetImportPathForInternalGQLFile(),
			})
		//				s.nodes[resultre]
		// now we need to figure out where this is from e.g.
		// result.Type a native thing e.g. User so getUserType
		// TODO need to add it to DefaultImport for the entire file...
		// e.g. getImportPathForNode
		// or in cd.Classes and figure that out for what the path should be...
		//				imports = append(imports, fmt.Sprintf("%sType", result.Type))
		//				spew.Dump(result.Type + " needs to be added to import for file...")
	}

	return item.imports, nil
}

type CustomFile struct {
	Imports map[string]*CustomImportInfo `json:"imports,omitempty"`
}

type CustomImportInfo struct {
	Path          string `json:"path,omitempty"`
	DefaultImport bool   `json:"defaultImport,omitempty"`
}

type CustomObject struct {
	// TODOO
	NodeName  string `json:"nodeName"`
	ClassName string `json:"className"`
}

// CustomFieldType for a TypeScript class
type CustomFieldType string

// these values map to CustomFieldType enum in JS
const Accessor CustomFieldType = "ACCESSOR"
const Field CustomFieldType = "FIELD"
const Function CustomFieldType = "FUNCTION"
const AsyncFunction CustomFieldType = "ASYNC_FUNCTION"

type CustomField struct {
	Node         string          `json:"nodeName"`
	GraphQLName  string          `json:"gqlName"`
	FunctionName string          `json:"functionName"`
	Args         []CustomItem    `json:"args"`
	Results      []CustomItem    `json:"results"`
	FieldType    CustomFieldType `json:"fieldType"`
}

func (cf CustomField) getArg() string {
	if cf.hasCustomArgs() {
		// interface has been generated for it
		return cf.GraphQLName + "Args"
	}
	return "{}"
}

func (cf CustomField) hasCustomArgs() bool {
	for _, arg := range cf.Args {
		if !arg.IsContextArg {
			return true
		}
	}
	return false
}

func (cf CustomField) getResolveMethodArg() string {
	if cf.hasCustomArgs() {
		return "args"
	}
	return "{}"
}

type CustomClassInfo struct {
	Name          string `json:"name"`
	Exported      bool   `json:"exported"`
	DefaultExport bool   `json:"defaultExport"`
	Path          string `json:"path"`
}

type compareCustomData struct {
	customQueriesChanged     map[string]bool
	customMutationsChanged   map[string]bool
	customQueriesRemoved     map[string]bool
	customMutationsRemoved   map[string]bool
	customConnectionsChanged map[string]bool
}

func (c *compareCustomData) hasAnyChanges() bool {
	return len(c.customQueriesChanged) > 0 ||
		len(c.customMutationsChanged) > 0 ||
		len(c.customQueriesRemoved) > 0 ||
		len(c.customMutationsRemoved) > 0 ||
		len(c.customConnectionsChanged) > 0
}

func CompareCustomData(processor *codegen.Processor, cd1, cd2 *CustomData, existingChangeMap change.ChangeMap) *compareCustomData {
	ret := &compareCustomData{
		customConnectionsChanged: map[string]bool{},
		customMutationsChanged:   map[string]bool{},
		customMutationsRemoved:   map[string]bool{},
		customQueriesRemoved:     map[string]bool{},
		customQueriesChanged:     map[string]bool{},
	}

	queryReferences := map[string]map[string]bool{}
	mutationReferences := map[string]map[string]bool{}
	// compare queries and mutations
	q := compareCustomQueries(cd1.Queries, cd2.Queries, queryReferences)
	ret.customQueriesChanged = q.changed
	ret.customQueriesRemoved = q.removed

	m := compareCustomMutations(cd1.Mutations, cd2.Mutations, mutationReferences)
	ret.customMutationsChanged = m.changed
	ret.customMutationsRemoved = m.removed

	for k, c2 := range cd2.Classes {
		c1, ok := cd1.Classes[k]
		if !ok {
			continue
		}
		if !customClassInfoEqual(c1, c2) {
			// flag each of this as needing to change...
			for k := range queryReferences[k] {
				ret.customQueriesChanged[k] = true
			}
			for k := range mutationReferences[k] {
				ret.customMutationsChanged[k] = true
			}
		}
	}
	for k, l1 := range cd1.Fields {
		l2 := cd2.Fields[k]
		eq, conns := customFieldListComparison(processor.Config, l1, l2)
		for k, v := range conns {
			if v {
				ret.customConnectionsChanged[k] = true
			}
		}
		if eq {
			continue
		}

		if processor.Schema.NodeNameExists(k) {
			l, ok := existingChangeMap[k]
			if !ok {
				l = []change.Change{}
			}
			// flag GraphQL file as changed so we update that...
			l = append(l, change.Change{
				Change:      change.ModifyNode,
				GraphQLName: k,
				GraphQLOnly: true,
			})
			existingChangeMap[k] = l
		} else {
			// changed field in custom object
			// flag custom queries and mutations where this is referenced as needing to change
			for k := range queryReferences[k] {
				ret.customQueriesChanged[k] = true
			}
			for k := range mutationReferences[k] {
				ret.customMutationsChanged[k] = true
			}
		}
	}

	return ret
}

func compareCustomQueries(l1, l2 []CustomField, references map[string]map[string]bool) *compareListOptions {
	opts := &compareListOptions{
		changed: map[string]bool{},
		removed: map[string]bool{},
	}
	compareCustomList(l1, l2, opts, references)
	return opts
}

func compareCustomMutations(l1, l2 []CustomField, references map[string]map[string]bool) *compareListOptions {
	opts := &compareListOptions{
		changed: map[string]bool{},
		removed: map[string]bool{},
	}
	compareCustomList(l1, l2, opts, references)
	return opts
}

type compareListOptions struct {
	changed map[string]bool
	removed map[string]bool
}

func compareCustomList(l1, l2 []CustomField, opts *compareListOptions, references map[string]map[string]bool) {
	// intentionally only building references from current code instead of previous code
	m1 := mapifyFieldList(l1, nil)
	m2 := mapifyFieldList(l2, references)

	for k, cf1 := range m1 {
		cf2, ok := m2[k]
		// in 1 but not 2 removed
		if !ok {
			opts.removed[cf1.GraphQLName] = true
		} else {
			if !customFieldEqual(cf1, cf2) {
				opts.changed[cf1.GraphQLName] = true
			}
		}
	}

	for k, cf2 := range m2 {
		_, ok := m1[k]
		// in 2 but not 1. addeded
		if !ok {
			opts.changed[cf2.GraphQLName] = true
		}
	}
}

func mapifyFieldList(l []CustomField, references map[string]map[string]bool) map[string]*CustomField {
	m := make(map[string]*CustomField)
	addToMap := func(typ, gqlName string) {
		if references == nil {
			return
		}
		subM, ok := references[typ]
		if !ok {
			subM = map[string]bool{}
		}
		subM[gqlName] = true
		references[typ] = subM
	}
	for idx := range l {
		cf := l[idx]
		m[cf.GraphQLName] = &cf
		for _, arg := range cf.Args {
			addToMap(arg.Type, cf.GraphQLName)
		}
		for _, result := range cf.Results {
			addToMap(result.Type, cf.GraphQLName)
		}
	}
	return m
}

func customFieldEqual(cf1, cf2 *CustomField) bool {
	ret := change.CompareNilVals(cf1 == nil, cf2 == nil)
	if ret != nil {
		return *ret
	}
	return cf1.Node == cf2.Node &&
		cf1.GraphQLName == cf2.GraphQLName &&
		cf1.FunctionName == cf2.FunctionName &&
		customItemsListEqual(cf1.Args, cf2.Args) &&
		customItemsListEqual(cf1.Results, cf2.Results) &&
		cf1.FieldType == cf2.FieldType
}

func customFieldListComparison(cfg codegenapi.Config, l1, l2 []CustomField) (bool, map[string]bool) {
	listEqual := len(l1) == len(l2)
	conns := make(map[string]bool)

	m1 := mapifyFieldList(l1, nil)
	m2 := mapifyFieldList(l2, nil)
	for k, cf2 := range m2 {
		cf1, ok := m1[k]

		if !customFieldEqual(cf1, cf2) {
			listEqual = false
		}
		if !isConnection(*cf2) {
			continue
		}

		if !ok || !isConnection(*cf1) {
			edge := getGQLEdge(cfg, *cf2, cf2.Node)
			conns[edge.GetGraphQLConnectionName()] = true
		}
	}

	return listEqual, conns
}

func customItemEqual(item1, item2 CustomItem) bool {
	return item1.Name == item2.Name &&
		item1.Type == item2.Type &&
		item1.Nullable == item2.Nullable &&
		item1.List == item2.List &&
		item1.Connection == item2.Connection &&
		item1.IsContextArg == item2.IsContextArg &&
		item1.TSType == item2.TSType
}

func customItemsListEqual(l1, l2 []CustomItem) bool {
	if len(l1) != len(l2) {
		return false
	}
	for i := range l1 {
		if !customItemEqual(l1[i], l2[i]) {
			return false
		}
	}
	return true
}

func customClassInfoEqual(cc1, cc2 *CustomClassInfo) bool {
	return cc1.Name == cc2.Name &&
		cc1.Exported == cc2.Exported &&
		cc1.DefaultExport == cc2.DefaultExport &&
		cc1.Path == cc2.Path
}
