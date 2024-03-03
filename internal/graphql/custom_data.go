package graphql

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/codepath"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/names"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tsimport"
)

type CustomData struct {
	Args       map[string]*CustomObject `json:"args,omitempty"`
	Inputs     map[string]*CustomObject `json:"inputs,omitempty"`
	Objects    map[string]*CustomObject `json:"objects,omitempty"`
	Interfaces map[string]*CustomObject `json:"interfaces,omitempty"`
	Unions     map[string]*CustomObject `json:"unions,omitempty"`
	// map of class to fields in that class
	Fields    map[string][]CustomField `json:"fields,omitempty"`
	Queries   []CustomField            `json:"queries,omitempty"`
	Mutations []CustomField            `json:"mutations,omitempty"`

	Classes       map[string]*CustomClassInfo `json:"classes,omitempty"`
	Files         map[string]*CustomFile      `json:"files,omitempty"`
	CustomTypes   map[string]*CustomType      `json:"customTypes,omitempty"`
	Error         error                       `json:"-"`
	compareResult *compareCustomData          `json:"-"`
}

type CustomItem struct {
	Name         string       `json:"name,omitempty"`
	Type         string       `json:"type,omitempty"`
	Nullable     NullableItem `json:"nullable,omitempty"`
	List         bool         `json:"list,omitempty"`
	Connection   bool         `json:"connection,omitempty"`
	IsContextArg bool         `json:"isContextArg,omitempty"`
	// indicates not to pass it to calling function
	GraphQLOnlyArg bool                   `json:"graphQLOnlyArg,omitempty"`
	TSType         string                 `json:"tsType,omitempty"`
	imports        []*tsimport.ImportPath `json:"-"`
	Description    string                 `json:"description,omitempty"`
}

func (arg CustomItem) defaultArg() string {
	return fmt.Sprintf("args.%s", arg.Name)
}

func (arg CustomItem) getCustomTypeToDeferArgImportsTo(s *gqlSchema) *CustomType {
	ct := s.customData.CustomTypes[arg.Type]
	if ct != nil && (ct.EnumMap != nil || len(ct.StructFields) > 0) {
		return ct
	}
	return nil
}

func (arg CustomItem) renderArg(cfg *codegen.Config, s *gqlSchema) (string, []*tsimport.ImportPath) {
	if arg.TSType != "ID" || !cfg.Base64EncodeIDs() {
		ct := arg.getCustomTypeToDeferArgImportsTo(s)
		if ct != nil {
			return arg.defaultArg(), []*tsimport.ImportPath{
				ct.getGraphQLImportPath(cfg),
			}
		}
		return arg.defaultArg(), nil
	}
	// we don't have the enttype.Type here so manually calling types for cases we're aware of

	var typ enttype.CustomGQLRenderer
	if arg.Nullable == NullableTrue && arg.List {
		typ = &enttype.NullableArrayListType{
			ElemType: &enttype.IDType{},
		}
	} else if arg.List {
		typ = &enttype.ArrayListType{
			ElemType: &enttype.IDType{},
		}
	} else if arg.Nullable == NullableTrue {
		typ = &enttype.NullableIDType{}
	} else {
		typ = &enttype.IDType{}
	}

	return typ.CustomGQLRender(cfg, fmt.Sprintf("args.%s", arg.Name)), typ.ArgImports(cfg)
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

	// if specified, graphql enum is generated for this...
	EnumMap map[string]string `json:"enumMap,omitempty"`

	// we need processed fields here
	StructFields []*input.Field `json:"structFields,omitempty"`

	// usually used with EnumMap to indicate if we're adding a new custom input enum where it should be placed
	InputType bool `json:"inputType,omitempty"`
}

func (ct *CustomType) getGraphQLImportPath(cfg *codegen.Config) *tsimport.ImportPath {
	var absPath string
	if ct.EnumMap != nil {
		absPath = getFilePathForEnums(cfg)
		if ct.InputType {
			absPath = getFilePathForEnumInput(cfg)
		}
	}

	if len(ct.StructFields) > 0 {
		absPath = getFilePathForCustomInterfaceFile(cfg, ct.Type)
		if ct.InputType {
			absPath = getFilePathForCustomInterfaceInputFile(cfg, ct.Type)
		}
	}

	if absPath != "" {
		path, err := filepath.Rel(cfg.GetAbsPathToRoot(), absPath)
		if err != nil {
			// TODO handle better
			panic(err)
		}
		path = strings.TrimSuffix(path, ".ts")
		return &tsimport.ImportPath{
			ImportPath: path,
			Import:     ct.Type + "Type",
		}
	}
	return &tsimport.ImportPath{
		ImportPath: ct.ImportPath,
		Import:     ct.Type,
	}
}

func (item *CustomItem) initialize() error {
	switch item.Nullable {
	case NullableTrue:
		if item.List {
			item.imports = []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLList"),
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			}
		}

	case NullableContents:
		if !item.List {
			return fmt.Errorf("nullable contents for %s and not a list", item.Name)
		}
		item.imports = []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLClassImportPath("GraphQLList"),
		}

	case NullableContentsAndList:
		if !item.List {
			return fmt.Errorf("nullable contents and list for %s and not a list", item.Name)
		}
		item.imports = []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLList"),
		}

	default:
		if item.List {
			item.imports = []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				tsimport.NewGQLClassImportPath("GraphQLList"),
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			}
		} else {
			item.imports = []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			}
		}
	}

	return nil
}

func (item *CustomItem) addImport(imp *tsimport.ImportPath) {
	item.imports = append(item.imports, imp)
}

func (item *CustomItem) getImports(processor *codegen.Processor, s *gqlSchema, cd *CustomData) ([]*tsimport.ImportPath, error) {
	if err := item.initialize(); err != nil {
		return nil, err
	}

	// TODO need to know if mutation or query...
	imp := s.getImportFor(processor, item.Type, false)
	if imp != nil {
		item.addImport(imp)
	} else {
		_, ok := s.customData.Objects[item.Type]
		_, ok2 := s.customData.Unions[item.Type]
		_, ok3 := s.customData.Interfaces[item.Type]
		if !ok && !ok2 && !ok3 {
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
	NodeName    string   `json:"nodeName"`
	ClassName   string   `json:"className"`
	Description string   `json:"description,omitempty"`
	Interfaces  []string `json:"interfaces,omitempty"`
	UnionTypes  []string `json:"unionTypes,omitempty"`
}

// CustomFieldType for a TypeScript class
type CustomFieldType string

// these values map to CustomFieldType enum in JS
const Accessor CustomFieldType = "ACCESSOR"
const Field CustomFieldType = "FIELD"
const Function CustomFieldType = "FUNCTION"
const AsyncFunction CustomFieldType = "ASYNC_FUNCTION"

type CustomField struct {
	// Node is not the best name.

	// for custom queries/mutations
	// It's the class in which the function is defined

	// for custom fields on nodes e.g. User, it's that node

	// for inline fields, it's empty since not defined anywhere
	Node         string          `json:"nodeName"`
	GraphQLName  string          `json:"gqlName"`
	FunctionName string          `json:"functionName"`
	Args         []CustomItem    `json:"args"`
	Results      []CustomItem    `json:"results"`
	FieldType    CustomFieldType `json:"fieldType"`
	Connection   bool            `json:"-"`
	EdgeName     string          `json:"edgeName"`
	Description  string          `json:"description,omitempty"`
	// extra imports
	ExtraImports []*tsimport.ImportPath `json:"extraImports,omitempty"`
	// To be used instead of calling a function...
	FunctionContents  string `json:"functionContents,omitempty"`
	nonConnectionArgs []CustomItem
}

func (cf CustomField) getArg() string {
	if cf.hasCustomArgs() {
		// interface has been generated for it
		return names.ToClassType(cf.GraphQLName, "Args")
	}
	return "{}"
}

func getStringFromMap(m map[string]interface{}, key string) string {
	if m[key] == nil {
		return ""
	}
	return fmt.Sprintf("%v", m[key])
}

func getValFromMap(m map[string]interface{}, key string, v any) error {
	if m[key] == nil {
		return nil
	}

	b, err := json.Marshal(m[key])
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func (cf *CustomField) UnmarshalJSON(data []byte) error {
	m := make(map[string]interface{})
	err := json.Unmarshal(data, &m)
	if err != nil {
		return err
	}

	cf.Node = getStringFromMap(m, "nodeName")
	cf.GraphQLName = getStringFromMap(m, "gqlName")
	cf.FunctionName = getStringFromMap(m, "functionName")
	cf.FieldType = CustomFieldType(getStringFromMap(m, "fieldType"))
	cf.Description = getStringFromMap(m, "description")
	cf.FunctionContents = getStringFromMap(m, "functionContents")
	cf.EdgeName = getStringFromMap(m, "edgeName")
	if err := getValFromMap(m, "args", &cf.Args); err != nil {
		return err
	}
	if err := getValFromMap(m, "results", &cf.Results); err != nil {
		return err
	}
	if err := getValFromMap(m, "extraImports", &cf.ExtraImports); err != nil {
		return err
	}

	if isConnection(cf) {
		cf.Connection = true
		// add connection args...
		add := true
		connArgs := getConnectionArgs()
		// don't add twice if already there
		// will already be there for args that are being read from custom_schema.json
		if len(cf.Args) != 0 {
			add = !hasConnectionArgs(cf, connArgs)
		}
		if add {
			m := make(map[string]bool)

			for _, v := range getConnectionArgs() {
				m[v.Name] = true
			}
			for _, arg := range cf.Args {
				if m[arg.Name] {
					return fmt.Errorf("cannot have a connection with arg %s since that's a connection arg", arg.Name)
				}
				if !arg.IsContextArg && !arg.GraphQLOnlyArg {
					cf.nonConnectionArgs = append(cf.nonConnectionArgs, arg)
				}
			}
			cf.Args = append(cf.Args, connArgs...)
		}
	}

	return nil
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
	// for connection, need to render args since we need it for GraphQLEdgeConnection
	if cf.hasCustomArgs() {
		return "args"
	}
	return "{}"
}

func (cf CustomField) getNonConnectionArgs() []CustomItem {
	return cf.nonConnectionArgs
}

func getConnectionArgs() []CustomItem {
	return []CustomItem{
		{
			Name:           "first",
			Nullable:       NullableTrue,
			Type:           "Int",
			GraphQLOnlyArg: true,
		},
		{
			Name:           "after",
			Nullable:       NullableTrue,
			GraphQLOnlyArg: true,
			Type:           "String",
		},
		{
			Name:           "last",
			Nullable:       NullableTrue,
			GraphQLOnlyArg: true,
			Type:           "Int",
		},
		{
			Name:           "before",
			Nullable:       NullableTrue,
			GraphQLOnlyArg: true,
			Type:           "String",
		},
	}
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
	customConnectionsRemoved map[string]bool
	customQueriesRemoved     map[string]bool
	customMutationsRemoved   map[string]bool
	customConnectionsChanged map[string]bool
	customInterfacesChanged  map[string]bool
	customInterfacesRemoved  map[string]bool
	customUnionsChanged      map[string]bool
	customUnionsRemoved      map[string]bool
}

func (c *compareCustomData) hasAnyChanges() bool {
	return len(c.customQueriesChanged) > 0 ||
		len(c.customMutationsChanged) > 0 ||
		len(c.customQueriesRemoved) > 0 ||
		len(c.customMutationsRemoved) > 0 ||
		len(c.customConnectionsChanged) > 0 ||
		len(c.customConnectionsRemoved) > 0 ||
		len(c.customInterfacesChanged) > 0 ||
		len(c.customUnionsChanged) > 0 ||
		len(c.customInterfacesRemoved) > 0 ||
		len(c.customUnionsRemoved) > 0
}

func CompareCustomData(processor *codegen.Processor, cd1, cd2 *CustomData, existingChangeMap change.ChangeMap) *compareCustomData {
	ret := &compareCustomData{
		customConnectionsChanged: map[string]bool{},
		customConnectionsRemoved: map[string]bool{},
		customMutationsChanged:   map[string]bool{},
		customMutationsRemoved:   map[string]bool{},
		customQueriesRemoved:     map[string]bool{},
		customQueriesChanged:     map[string]bool{},
		customInterfacesChanged:  map[string]bool{},
		customInterfacesRemoved:  map[string]bool{},
		customUnionsChanged:      map[string]bool{},
		customUnionsRemoved:      map[string]bool{},
	}

	queryReferences := map[string]map[string]bool{}
	mutationReferences := map[string]map[string]bool{}
	// compare queries and mutations
	q := compareCustomFields(cd1.Queries, cd2.Queries, queryReferences)
	ret.customQueriesChanged = q.changed
	ret.customQueriesRemoved = q.removed
	ret.customConnectionsRemoved = q.connnectionsRemoved

	m := compareCustomFields(cd1.Mutations, cd2.Mutations, mutationReferences)
	ret.customMutationsChanged = m.changed
	ret.customMutationsRemoved = m.removed

	// compare interfaces
	interfaceReferences := compareCustomMaps(cd1.Interfaces, cd2.Interfaces)
	ret.customInterfacesChanged = interfaceReferences.changed
	ret.customInterfacesRemoved = interfaceReferences.removed

	// compare unions
	unionReferences := compareCustomMaps(cd1.Unions, cd2.Unions)
	ret.customUnionsChanged = unionReferences.changed
	ret.customUnionsRemoved = unionReferences.removed

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

func compareCustomFields(l1, l2 []CustomField, references map[string]map[string]bool) *compareListOptions {
	opts := &compareListOptions{
		changed:             map[string]bool{},
		removed:             map[string]bool{},
		connnectionsRemoved: map[string]bool{},
	}
	compareCustomList(l1, l2, opts, references)
	return opts
}

func compareCustomMaps(m1, m2 map[string]*CustomObject) *compareListOptions {
	opts := &compareListOptions{
		changed: map[string]bool{},
		removed: map[string]bool{},
	}

	for k, c1 := range m1 {
		c2, ok := m2[k]
		if !ok {
			// in 1 but not 2 removed
			opts.removed[c1.NodeName] = true
		} else {
			if !customObjectEqual(c1, c2) {
				opts.changed[c1.NodeName] = true
			}
		}
	}

	for k, cf2 := range m2 {
		_, ok := m1[k]
		// in 2 but not 1. addeded
		if !ok {
			opts.changed[cf2.NodeName] = true
		}
	}
	return opts
}

type compareListOptions struct {
	changed             map[string]bool
	removed             map[string]bool
	connnectionsRemoved map[string]bool
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
			if cf1.Connection {
				opts.connnectionsRemoved[cf1.GraphQLName] = true
			}
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

func customObjectEqual(c1, c2 *CustomObject) bool {
	ret := change.CompareNilVals(c1 == nil, c2 == nil)
	if ret != nil {
		return *ret
	}

	return c1.ClassName == c2.ClassName &&
		c1.NodeName == c2.NodeName &&
		c1.Description == c2.Description &&
		change.StringListEqual(c1.Interfaces, c2.Interfaces) &&
		change.StringListEqual(c1.UnionTypes, c2.UnionTypes)
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
		cf1.FieldType == cf2.FieldType &&
		cf1.Connection == cf2.Connection &&
		cf1.EdgeName == cf2.EdgeName &&
		cf1.Description == cf2.Description &&
		tsimport.ImportPathsEqual(cf1.ExtraImports, cf2.ExtraImports) &&
		cf1.FunctionContents == cf2.FunctionContents
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
		if !cf2.Connection {
			continue
		}

		if !ok || !cf1.Connection {
			edge := getGQLEdge(cfg, *cf2, cf2.Node)
			conns[edge.GetGraphQLConnectionName()] = true
		}
	}

	return listEqual, conns
}

func mapifyCustomItemList(l []CustomItem) map[string]CustomItem {
	m := make(map[string]CustomItem)

	for _, v := range l {
		m[v.Name] = v
	}
	return m
}

func hasConnectionArgs(cf *CustomField, connArgs []CustomItem) bool {
	existing := mapifyCustomItemList(cf.Args)
	connMap := mapifyCustomItemList(connArgs)
	for k, v := range connMap {
		existingItem, ok := existing[k]
		if !ok {
			return false
		}
		if !customItemEqual(existingItem, v) {
			return false
		}
	}
	return true
}

func customItemEqual(item1, item2 CustomItem) bool {
	return item1.Name == item2.Name &&
		item1.Type == item2.Type &&
		item1.Nullable == item2.Nullable &&
		item1.List == item2.List &&
		item1.Connection == item2.Connection &&
		item1.IsContextArg == item2.IsContextArg &&
		item1.GraphQLOnlyArg == item2.GraphQLOnlyArg &&
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
