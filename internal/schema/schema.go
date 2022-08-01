package schema

import (
	"database/sql"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/depgraph"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/customtype"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/util"
	"github.com/pkg/errors"
	"golang.org/x/tools/go/packages"
)

// Schema is the representation of the parsed schema. Has everything needed to
type Schema struct {
	Nodes         NodeMapInfo
	Patterns      map[string]*PatternInfo
	tables        NodeMapInfo
	edges         map[string]*ent.AssocEdgeData
	newEdges      []*ent.AssocEdgeData
	edgesToUpdate []*ent.AssocEdgeData
	// unlike Nodes, the key is "EnumName" instead of "EnumNameConfig"
	// confusing but gets us closer to what we want
	Enums            map[string]*EnumInfo
	enumTables       map[string]*EnumInfo
	CustomInterfaces map[string]*customtype.CustomInterface
	gqlNameMap       map[string]bool

	// used to keep track of schema-state
	inputSchema *input.Schema
}

func (s *Schema) GetInputSchema() *input.Schema {
	return s.inputSchema
}

func (s *Schema) addEnum(enumType enttype.EnumeratedType, nodeData *NodeData) error {
	return s.addEnumFrom(
		enum.NewInputFromEnumType(enumType),
		nodeData,
		nil,
	)
}

func (s *Schema) addPattern(name string, p *PatternInfo) error {
	if s.Patterns[name] != nil {
		return fmt.Errorf("pattern with name %s already exists", name)
	}

	s.Patterns[name] = p

	return nil
}

func (s *Schema) GetNodeDataForNode(nodeName string) (*NodeData, error) {
	info := s.Nodes[nodeName+"Config"]
	if info == nil {
		return nil, fmt.Errorf("cannot find NodeInfo for %s", nodeName)
	}

	return info.NodeData, nil
}

func (s *Schema) NodeNameExists(nodeName string) bool {
	_, ok := s.Nodes[nodeName+"Config"]
	return ok
}

func (s *Schema) EnumNameExists(enum string) bool {
	_, ok := s.Enums[enum]
	return ok
}

func (s *Schema) NameExists(k string) bool {
	return s.NodeNameExists(k) || s.EnumNameExists(k)
}

func (s *Schema) addEnumFromInputNode(nodeName string, node *input.Node, nodeData *NodeData) error {
	if !node.EnumTable || len(node.DBRows) == 0 {
		return errors.New("can't create enum from NodeData that's not an enum table or has no rows")
	}

	var pkeyFields []*input.Field

	for _, field := range node.Fields {
		if field.PrimaryKey {
			pkeyFields = append(pkeyFields, field)
		}
	}
	if len(pkeyFields) != 1 {
		return fmt.Errorf("need exactly 1 primary key to add enum from input node. have %d", len(pkeyFields))
	}
	field := pkeyFields[0]
	fieldName := field.Name
	storageKey := field.StorageKey
	values := make([]string, len(node.DBRows))

	addValue := func(row map[string]interface{}, key string, idx int) (bool, error) {
		if key == "" {
			return false, nil
		}
		fieldNameValue, ok := row[fieldName]
		if ok {
			str, ok := fieldNameValue.(string)
			if !ok {
				return false, fmt.Errorf("value of field %s should be a string to be an enum", fieldName)
			}
			values[idx] = str
			return true, nil
		}
		return false, nil
	}
	for idx, row := range node.DBRows {
		added, err := addValue(row, fieldName, idx)
		if err != nil {
			return err
		}
		if !added {
			added, err := addValue(row, storageKey, idx)
			if err != nil {
				return err
			}
			if !added {
				return fmt.Errorf("couldn't find key %s or %s in row", fieldName, storageKey)
			}
		}
	}

	return s.addEnumFrom(
		&enum.Input{
			TSName:  nodeName,
			GQLName: nodeName,
			GQLType: fmt.Sprintf("%s!", nodeName),
			Values:  values,
		},
		nodeData,
		node,
	)
}

func (s *Schema) addEnumFrom(input *enum.Input, nodeData *NodeData, inputNode *input.Node) error {
	tsEnum, gqlEnum := enum.GetEnums(input)

	// first create EnumInfo...
	info := &EnumInfo{
		Enum:      tsEnum,
		GQLEnum:   gqlEnum,
		NodeData:  nodeData,
		InputNode: inputNode,
	}

	if nodeData.HideFromGraphQL {
		// hide from graphql. no graphql enum
		info.GQLEnum = nil
	}

	// new source enum
	if err := s.addEnumShared(input, info); err != nil {
		return err
	}

	if nodeData.EnumTable {
		if s.enumTables[nodeData.TableName] != nil {
			return fmt.Errorf("enum schema with table name %s already exists", nodeData.TableName)
		}
		s.enumTables[nodeData.TableName] = info
	}
	nodeData.addEnum(info.Enum)
	return nil
}

func (s *Schema) addEnumFromPattern(enumType enttype.EnumeratedType, pattern *input.Pattern) (*EnumInfo, error) {
	input := enum.NewInputFromEnumType(enumType)
	return s.addEnumFromInput(input, pattern)
}

func (s *Schema) addEnumFromInput(input *enum.Input, pattern *input.Pattern) (*EnumInfo, error) {
	tsEnum, gqlEnum := enum.GetEnums(input)

	// first create EnumInfo...
	info := &EnumInfo{
		Enum:    tsEnum,
		GQLEnum: gqlEnum,
		Pattern: pattern,
	}

	// new source enum
	if err := s.addEnumShared(input, info); err != nil {
		return nil, err
	}
	return info, nil
}

func (s *Schema) addEnumShared(input *enum.Input, info *EnumInfo) error {
	gqlName := input.GQLName
	if input.HasValues() {
		if s.Enums[gqlName] != nil {
			return fmt.Errorf("enum schema with gqlname %s already exists", gqlName)
		}

		// TODO we're storing the same info twice. simplify this.
		if err := s.addGQLName(gqlName); err != nil {
			return err
		}
		// key on gqlName since key isn't really being used atm and gqlName needs to be unique
		s.Enums[gqlName] = info
	}
	return nil
}

// Given a schema file parser, Parse parses the schema to return the completely
// parsed schema
func Parse(p schemaparser.Parser, specificConfigs ...string) (*Schema, error) {
	return parse(func(s *Schema) (*assocEdgeData, error) {
		return s.parseFiles(p, specificConfigs...)
	})
}

func ParsePackage(pkg *packages.Package, specificConfigs ...string) (*Schema, error) {
	return parse(func(s *Schema) (*assocEdgeData, error) {
		return s.parsePackage(pkg, specificConfigs...)
	})
}

// ParseFromInputSchema takes the schema that has been parsed from whatever input source
// and provides the schema we have that's checked and conforms to everything we expect
func ParseFromInputSchema(cfg codegenapi.Config, schema *input.Schema, lang base.Language) (*Schema, error) {
	return parse(func(s *Schema) (*assocEdgeData, error) {
		return s.parseInputSchema(cfg, schema, lang)
	})
}

func parse(parseFn func(*Schema) (*assocEdgeData, error)) (*Schema, error) {
	s := &Schema{}
	s.init()
	edgeData, err := parseFn(s)
	if err != nil {
		return nil, err
	}
	s.edges = edgeData.edgeMap
	s.newEdges = edgeData.newEdges
	s.edgesToUpdate = edgeData.edgesToUpdate
	return s, nil
}

func (s *Schema) init() {
	s.Nodes = make(map[string]*NodeDataInfo)
	s.Enums = make(map[string]*EnumInfo)
	s.tables = make(map[string]*NodeDataInfo)
	s.enumTables = make(map[string]*EnumInfo)
	s.Patterns = map[string]*PatternInfo{}
	s.CustomInterfaces = map[string]*customtype.CustomInterface{}
	s.gqlNameMap = make(map[string]bool)
}

func (s *Schema) GetNodeDataFromTableName(tableName string) *NodeData {
	info := s.tables[tableName]
	if info == nil {
		return nil
	}
	return info.NodeData
}

func (s *Schema) GetNodeDataFromGraphQLName(nodeName string) *NodeData {
	return s.Nodes.getNodeDataFromGraphQLName(nodeName)
}

func (s *Schema) GetActionFromGraphQLName(graphQLName string) action.Action {
	return s.getActionFromGraphQLName(graphQLName)
}

func (s *Schema) getActionFromGraphQLName(graphQLName string) action.Action {
	// TODO come up with a better mapping than this
	for _, info := range s.Nodes {
		a := info.NodeData.GetActionByGraphQLName(graphQLName)
		if a != nil {
			return a
		}
	}
	return nil
}

// below really only exist for tests but yolo
func (s *Schema) GetAssocEdgeByName(entConfig, edgeName string) (*edge.AssociationEdge, error) {
	info := s.Nodes[entConfig]
	if info == nil {
		return nil, errors.New("invalid EntConfig passed to getAssocEdgeByName")
	}
	ret := info.NodeData.GetAssociationEdgeByName(edgeName)
	if ret == nil {
		return nil, errors.New("error getting edge")
	}
	return ret, nil
}

func (s *Schema) GetFieldByName(entConfig, fieldName string) (*field.Field, error) {
	info := s.Nodes[entConfig]
	if info == nil {
		return nil, fmt.Errorf("invalid EntConfig %s passed to getFieldByName", entConfig)
	}
	ret := info.NodeData.GetFieldByName(fieldName)
	if ret == nil {
		return nil, fmt.Errorf("error getting field %s by name in EntConfig %s", fieldName, entConfig)
	}
	return ret, nil
}

// GetNewEdges only exists for testing purposes to differentiate between existing and new edges
func (s *Schema) GetNewEdges() []*ent.AssocEdgeData {
	return s.newEdges
}

// GetEdges returns all the edges in the schema
func (s *Schema) GetEdges() map[string]*ent.AssocEdgeData {
	return s.edges
}

// GetEdgesToUpdate returns edges in the schema that have changed which need to be updated
func (s *Schema) GetEdgesToUpdate() []*ent.AssocEdgeData {
	return s.edgesToUpdate
}

func (s *Schema) parseInputSchema(cfg codegenapi.Config, schema *input.Schema, lang base.Language) (*assocEdgeData, error) {
	s.inputSchema = schema

	// TODO right now this is also depending on config/database.yml
	// figure out if best place for this
	edgeData, err := s.loadExistingEdges()
	if err != nil {
		return nil, err
	}

	var errs []error

	patternMap := make(map[string][]*NodeData)

	for nodeName, node := range schema.Nodes {
		packageName := base.GetSnakeCaseName(nodeName)
		// user.ts, address.ts etc
		nodeData := newNodeData(packageName)

		// default tableName goes from address -> addresses, user -> users etc
		if node.TableName == "" {
			nodeData.TableName = inflection.Plural(packageName)
		} else {
			nodeData.TableName = node.TableName
		}

		nodeData.schemaPath = node.SchemaPath
		nodeData.EnumTable = node.EnumTable
		nodeData.DBRows = node.DBRows
		nodeData.Constraints = node.Constraints
		nodeData.Indices = node.Indices
		nodeData.HideFromGraphQL = node.HideFromGraphQL
		nodeData.TransformsSelect = node.TransformsSelect
		nodeData.TransformsDelete = node.TransformsDelete
		for _, p := range node.Patterns {
			pattern := schema.Patterns[p]
			if pattern == nil || pattern.DisableMixin {
				continue
			}
			nodeData.PatternsWithMixins = append(nodeData.PatternsWithMixins, p)
		}

		var err error
		nodeData.FieldInfo, err = field.NewFieldInfoFromInputs(
			cfg,
			nodeName,
			node.Fields,
			&field.Options{},
		)
		if err != nil {
			// error here can break things later since no fieldInfo
			return nil, err
		}
		for _, f := range nodeData.FieldInfo.Fields {
			entType := f.GetFieldType()
			enumType, ok := enttype.GetEnumType(entType)
			// don't add enums which are defined in patterns
			if ok {
				if !f.PatternField() {
					if err := s.addEnum(enumType, nodeData); err != nil {
						errs = append(errs, err)
					}
				} else {
					// keep track of NodeDatas that map to this enum...
					patternName := f.GetPatternName()
					list := patternMap[patternName]
					if list == nil {
						list = []*NodeData{}
					}
					list = append(list, nodeData)
					patternMap[patternName] = list
				}
			}
			union, ok := entType.(enttype.TSWithUnionFields)
			if ok && union.GetUnionFields() != nil {
				errs = append(errs, fmt.Errorf("union fields aren't supported as top level fields at the moment. `%s` invalid field", f.FieldName))
			}

			if err := s.checkCustomInterface(cfg, f, nil); err != nil {
				errs = append(errs, err)
			}
		}

		nodeData.EdgeInfo, err = edge.EdgeInfoFromInput(cfg, packageName, node)
		if err != nil {
			// error here can break things later since no edgeInfo
			return nil, err
		}
		for _, group := range nodeData.EdgeInfo.AssocGroups {
			if err := s.addEnumFrom(
				&enum.Input{
					TSName:  group.ConstType,
					GQLName: group.ConstType,
					GQLType: fmt.Sprintf("%s!", group.ConstType),
					Values:  group.GetEnumValues(),
				},
				nodeData,
				nil,
			); err != nil {
				errs = append(errs, err)
			}
		}

		if err := s.validateIndices(nodeData); err != nil {
			return nil, err
		}
		opts := []action.Option{}
		if nodeData.TransformsDelete {
			opts = append(opts, action.TransformsDelete())
		}

		nodeData.ActionInfo, err = action.ParseFromInput(cfg, packageName, node.Actions, nodeData.FieldInfo, nodeData.EdgeInfo, lang, opts...)
		if err != nil {
			errs = append(errs, err)
		}

		// not in schema.Nodes...
		if node.EnumTable {
			if err := s.addEnumFromInputNode(nodeName, node, nodeData); err != nil {
				errs = append(errs, err)
			}
			continue
		}

		if err := s.addConfig(&NodeDataInfo{
			NodeData:      nodeData,
			depgraph:      s.buildPostRunDepgraph(cfg, edgeData),
			ShouldCodegen: true,
		}); err != nil {
			errs = append(errs, err)
		}
	}

	for name, pattern := range schema.Patterns {
		p := &PatternInfo{
			Name:         pattern.Name,
			AssocEdges:   make(map[string]*edge.AssociationEdge),
			DisableMixin: pattern.DisableMixin,
		}
		for _, inpEdge := range pattern.AssocEdges {
			assocEdge, err := edge.AssocEdgeFromInput(cfg, "object", inpEdge)
			if err != nil {
				errs = append(errs, err)
				continue
			}
			p.AssocEdges[assocEdge.EdgeName] = assocEdge

			// add edge info
			if assocEdge.CreateEdge() {
				newEdge, err := s.getNewEdge(edgeData, assocEdge)
				if err != nil {
					errs = append(errs, err)
				} else {
					s.addNewEdgeType(p, newEdge.constName, newEdge.constValue, assocEdge)
				}
			}
			if err := s.maybeAddInverseAssocEdge(assocEdge); err != nil {
				errs = append(errs, err)
			}
		}

		// add enums from patterns
		fieldInfo, err := field.NewFieldInfoFromInputs(
			cfg,
			name,
			pattern.Fields,
			&field.Options{},
		)
		if err != nil {
			errs = append(errs, err)
		} else {

			for _, f := range fieldInfo.Fields {
				entType := f.GetFieldType()

				enumType, ok := enttype.GetEnumType(entType)
				if ok {
					info, err := s.addEnumFromPattern(enumType, pattern)
					if err != nil {
						errs = append(errs, err)
					}

					// add cloned enum to nodeData and mark as imported
					list := patternMap[name]
					clone := info.Enum.Clone()
					clone.Imported = true
					for _, nodeData := range list {
						nodeData.addEnum(clone)
					}
				}
			}
		}
		p.FieldInfo = fieldInfo

		if err := s.addPattern(name, p); err != nil {
			errs = append(errs, err)
		}
	}

	for _, ci := range s.CustomInterfaces {
		for _, f := range ci.Fields {
			if err := s.checkForEnum(cfg, f, ci); err != nil {
				errs = append(errs, err)
			}
		}
	}

	// TODO convert more things to do something like this?
	if len(errs) > 0 {
		// we're getting list of errors and coalescing
		return nil, util.CoalesceErr(errs...)
	}

	return s.processDepgrah(edgeData)
}

func (s *Schema) validateIndices(nodeData *NodeData) error {
	verifyCols := func(cols []string, getError func(col string) error) error {
		for _, col := range cols {
			f := nodeData.FieldInfo.GetFieldByName(col)
			if f == nil {
				return getError(col)
			}
		}
		return nil
	}
	for _, index := range nodeData.Indices {
		if err := verifyCols(index.Columns, func(col string) error {
			return fmt.Errorf("invalid field %s passed as col for index %s", col, index.Name)
		}); err != nil {
			return err
		}

		if index.IndexType != "" {
			if index.IndexType == input.Gist {
				return fmt.Errorf("gist index currently only supported for full text indexes")
			}
		}

		if index.FullText == nil {
			continue
		}

		if index.IndexType != "" {
			return fmt.Errorf("if you want to specify the full text index type, specify it in FullText object")
		}

		fullText := index.FullText
		if fullText.Language == "" && fullText.LanguageColumn == "" {
			return fmt.Errorf("have to specify at least one of language and language column for index %s", index.Name)
		}
		if fullText.Language != "" && fullText.LanguageColumn != "" {
			return fmt.Errorf("cannot specify both language and language column for index %s", index.Name)
		}

		if fullText.Weights != nil && fullText.Weights.HasWeights() && fullText.GeneratedColumnName == "" {
			return fmt.Errorf("cannot specify weights if no generated column name for index %s", index.Name)
		}

		verifyWeights := func(weights []string) error {
			return verifyCols(weights, func(col string) error {
				return fmt.Errorf("invalid field %s passed as weight for index %s", col, index.Name)
			})
		}

		if fullText.Weights != nil {
			if err := verifyWeights(fullText.Weights.A); err != nil {
				return err
			}
			if err := verifyWeights(fullText.Weights.B); err != nil {
				return err
			}
			if err := verifyWeights(fullText.Weights.C); err != nil {
				return err
			}
			if err := verifyWeights(fullText.Weights.D); err != nil {
				return err
			}
		}
		if fullText.GeneratedColumnName != "" {
			fieldInfo := nodeData.FieldInfo
			f := fieldInfo.GetFieldByName(fullText.GeneratedColumnName)
			if f != nil {
				return fmt.Errorf("name %s already exists for a field and cannot be used as a generated column name for index %s", fullText.GeneratedColumnName, index.Name)
			}
			if err := fieldInfo.AddComputedField(fullText.GeneratedColumnName); err != nil {
				return err
			}
		}
	}
	return nil
}

// TODO combine with checkCustomInterface...
func (s *Schema) checkForEnum(cfg codegenapi.Config, f *field.Field, ci *customtype.CustomInterface) error {
	typ := f.GetFieldType()
	enumTyp, ok := enttype.GetEnumType(typ)
	if ok {
		input := enum.NewInputFromEnumType(enumTyp)
		info, err := s.addEnumFromInput(input, nil)
		if err != nil {
			return err
		}
		ci.AddEnum(info.Enum, info.GQLEnum)
		return nil
	}
	subFieldsType, ok := typ.(enttype.TSWithSubFields)
	if !ok {
		return nil
	}
	subFields := subFieldsType.GetSubFields()
	if subFields == nil {
		return nil
	}
	actualSubFields := subFields.([]*input.Field)
	// use the parent of the field to determine or just nest it all the way based on parent
	fi, err := field.NewFieldInfoFromInputs(cfg, f.FieldName, actualSubFields, &field.Options{})
	if err != nil {
		return err
	}
	for _, f2 := range fi.Fields {
		if err := s.checkForEnum(cfg, f2, ci); err != nil {
			return err
		}
	}
	return nil
}

func (s *Schema) getCustomInterfaceFromField(f *field.Field) (*customtype.CustomInterface, []*input.Field) {
	entType := f.GetFieldType()
	subFieldsType, ok := entType.(enttype.TSWithSubFields)
	if !ok {
		return nil, nil
	}
	subFields := subFieldsType.GetSubFields()
	if subFields == nil {
		return nil, nil
	}
	cti := subFieldsType.GetCustomTypeInfo()

	ci := &customtype.CustomInterface{
		TSType:   cti.TSInterface,
		GQLType:  cti.GraphQLInterface,
		Exported: true,
	}
	actualSubFields := subFields.([]*input.Field)

	return ci, actualSubFields
}

func (s *Schema) checkCustomInterface(cfg codegenapi.Config, f *field.Field, root *customtype.CustomInterface) error {
	ci, subFields := s.getCustomInterfaceFromField(f)
	if ci == nil || subFields == nil {
		return nil
	}

	if err := s.addGQLName(ci.GQLType); err != nil {
		return err
	}

	if root == nil {
		root = ci
		s.CustomInterfaces[ci.TSType] = ci
	} else {
		root.Children = append(root.Children, ci)
	}
	fi, err := field.NewFieldInfoFromInputs(cfg, f.FieldName, subFields, &field.Options{})
	if err != nil {
		return err
	}
	for _, f2 := range fi.Fields {
		ci.Fields = append(ci.Fields, f2)
		// add custom interface maybe
		if err := s.checkCustomInterface(cfg, f2, root); err != nil {
			return err
		}

		cu, err := s.getCustomUnion(cfg, f2)
		if err != nil {
			return err
		}
		if cu != nil {
			root.Children = append(root.Children, cu)
		}
	}
	return nil
}

func (s *Schema) getCustomUnion(cfg codegenapi.Config, f *field.Field) (*customtype.CustomUnion, error) {
	entType := f.GetFieldType()
	unionFieldsType, ok := entType.(enttype.TSWithUnionFields)
	if !ok {
		return nil, nil
	}
	unionFields := unionFieldsType.GetUnionFields()
	if unionFields == nil {
		return nil, nil
	}
	cti := unionFieldsType.GetCustomTypeInfo()
	if cti.Type != enttype.CustomUnion {
		return nil, fmt.Errorf("invalid custom union %s passed", cti.TSInterface)
	}

	cu := &customtype.CustomUnion{
		TSType:  cti.TSInterface,
		GQLType: cti.GraphQLInterface,
	}

	if err := s.addGQLName(cu.GQLType); err != nil {
		return nil, err
	}

	actualSubFields := unionFields.([]*input.Field)
	fi, err := field.NewFieldInfoFromInputs(cfg, f.FieldName, actualSubFields, &field.Options{})
	if err != nil {
		return nil, err
	}
	for _, f2 := range fi.Fields {
		ci, subFields := s.getCustomInterfaceFromField(f2)
		if ci == nil || subFields == nil {
			return nil, fmt.Errorf("couldn't get custom interface from field %s", f.FieldName)
		}
		ci.GraphQLFieldName = f2.GetGraphQLName()

		// get the fields and add to custom interface
		fi2, err := field.NewFieldInfoFromInputs(cfg, f2.FieldName, subFields, &field.Options{})
		if err != nil {
			return nil, err
		}
		ci.Fields = fi2.Fields
		// TODO getCustomInterfaceFromField needs to handle this all
		// instead of this mess
		for _, f3 := range ci.Fields {
			if err := s.checkForEnum(cfg, f3, ci); err != nil {
				return nil, err
			}
		}

		cu.Interfaces = append(cu.Interfaces, ci)
	}

	return cu, nil
}

func (s *Schema) loadExistingEdges() (*assocEdgeData, error) {
	// load all edges in db
	result := <-ent.GenLoadAssocEdges()
	if result.Err != nil {
		return nil, errors.Wrap(result.Err, "error loading data. assoc_edge_config related")
	}

	edgeMap := make(map[string]*ent.AssocEdgeData)
	for _, assocEdgeData := range result.Edges {
		edgeMap[assocEdgeData.EdgeName] = assocEdgeData
	}
	return &assocEdgeData{
		edgeMap: edgeMap,
	}, nil
}

func (s *Schema) addGQLName(name string) error {
	if s.gqlNameMap[name] {
		return fmt.Errorf("there's already an entity with GraphQL name %s", name)
	}
	s.gqlNameMap[name] = true
	return nil
}

func (s *Schema) addConfig(info *NodeDataInfo) error {
	// validate schema and table name
	if s.Nodes[info.NodeData.EntConfigName] != nil {
		return fmt.Errorf("schema with name %s already exists", info.NodeData.EntConfigName)
	}
	if s.tables[info.NodeData.TableName] != nil {
		return fmt.Errorf("schema with table name %s already exists", info.NodeData.TableName)
	}

	if err := s.addGQLName(info.NodeData.Node); err != nil {
		return err
	}

	// it's confusing that this is stored in 2 places :(
	if s.enumTables[info.NodeData.TableName] != nil {
		if s.enumTables[info.NodeData.TableName].NodeData != info.NodeData {
			return fmt.Errorf("enum schema with table name %s already exists", info.NodeData.TableName)
		}
	}
	s.Nodes[info.NodeData.EntConfigName] = info
	s.tables[info.NodeData.TableName] = info
	return nil
}

func (s *Schema) buildPostRunDepgraph(
	cfg codegenapi.Config,
	edgeData *assocEdgeData,
) *depgraph.Depgraph {
	// things that need all nodeDatas loaded
	g := &depgraph.Depgraph{}

	// queue up linking edges
	g.AddItem(
		// want all configs loaded for this.
		// Actions depends on this.
		// this adds the linked assoc edge to the field
		"LinkedEdges", func(info *NodeDataInfo) error {
			return s.addLinkedEdges(cfg, info)
		},
		"EdgesFromFields",
	)

	g.AddItem("EdgesFromFields", func(info *NodeDataInfo) error {
		return s.addEdgesFromFields(cfg, info)
	})

	// inverse edges also require everything to be loaded
	g.AddItem(
		"InverseEdges", func(info *NodeDataInfo) error {
			return s.addInverseAssocEdgesFromInfo(info)
		}, "EdgesFromFields")

	g.AddItem("ActionFields", func(info *NodeDataInfo) error {
		return s.addActionFields(info)
	})
	return g
}

func (s *Schema) listEqual(cols []string, list []string) bool {
	if len(cols) != len(list) {
		return false
	}
	for i, v := range cols {
		if v != list[i] {
			return false
		}
	}
	return true
}

func (s *Schema) postProcess(nodeData *NodeData, edgeData *assocEdgeData) error {
	// this is where validation that depends on all the data happens
	primaryKeyCount := 0
	for _, constraint := range nodeData.Constraints {

		switch constraint.Type {
		case input.PrimaryKeyConstraint:
			primaryKeyCount++

		case input.ForeignKeyConstraint:
			// TODO need to validate each column/group of columns is unique
			// either primary key or unique
			fkey := constraint.ForeignKey
			var foreignNodeData *NodeData
			if s.tables[fkey.TableName] != nil {
				foreignNodeData = s.tables[fkey.TableName].NodeData
			} else {
				enumInfo := s.enumTables[fkey.TableName]
				if enumInfo != nil {
					foreignNodeData = enumInfo.NodeData
				}
			}

			if foreignNodeData == nil {
				return fmt.Errorf("foreign key from table %s to table %s not correct", nodeData.TableName, fkey.TableName)
			}

			// done here as opposed to processConstraints since we need everything processed
			columns, err := s.convertCols(foreignNodeData.FieldInfo, fkey.Columns)
			if err != nil {
				return err
			}
			fkey.Columns = columns

			found := false
			for _, fConstraint := range foreignNodeData.Constraints {
				if fConstraint.Type != input.PrimaryKeyConstraint && fConstraint.Type != input.UniqueConstraint {
					continue
				}

				// unique or primary key
				if s.listEqual(fkey.Columns, fConstraint.Columns) {
					found = true
					break
				}
			}

			if !found {
				return fmt.Errorf("foreign key %s with columns which aren't unique in table %s", constraint.Name, fkey.TableName)
			}
		}
	}

	if err := s.addNewConstsAndEdges(nodeData, edgeData); err != nil {
		return err
	}

	s.addActionFieldsPostProcess(nodeData)

	// should there be a way to disable this eventually
	// it's perfectly fine for a table with no primary key
	// if we disable it, should be at most one
	if primaryKeyCount != 1 {
		return fmt.Errorf("we require 1 primary key for each table. %s had %d", nodeData.TableName, primaryKeyCount)
	}

	edgeInfo := nodeData.EdgeInfo
	// sort for consistent ordering
	sort.SliceStable(edgeInfo.DestinationEdges, func(i, j int) bool {
		return edgeInfo.DestinationEdges[i].GetEdgeName() < edgeInfo.DestinationEdges[j].GetEdgeName()
	})

	sort.SliceStable(edgeInfo.IndexedEdgeQueries, func(i, j int) bool {
		return edgeInfo.IndexedEdgeQueries[i].GetEdgeName() < edgeInfo.IndexedEdgeQueries[j].GetEdgeName()
	})

	sort.SliceStable(edgeInfo.Associations, func(i, j int) bool {
		return edgeInfo.Associations[i].EdgeName < edgeInfo.Associations[j].EdgeName
	})

	sort.SliceStable(edgeInfo.FieldEdges, func(i, j int) bool {
		return edgeInfo.FieldEdges[i].EdgeName < edgeInfo.FieldEdges[j].EdgeName
	})

	return nil
}

func (s *Schema) processDepgrah(edgeData *assocEdgeData) (*assocEdgeData, error) {
	// second pass to run things that depend on the entire data being loaded
	for _, info := range s.Nodes {

		if info.depgraph == nil {
			continue
		}

		// probably make this concurrent in the future
		if err := s.runDepgraph(info); err != nil {
			return nil, err
		}

		if err := s.processConstraints(info.NodeData); err != nil {
			return nil, err
		}
	}

	// need to also process enums too
	for _, enumInfo := range s.Enums {
		if enumInfo.LookupTableEnum() {
			if err := s.processConstraints(enumInfo.NodeData); err != nil {
				return nil, err
			}
		}
	}

	// need to run this after running everything above
	for _, info := range s.Nodes {
		if err := s.postProcess(info.NodeData, edgeData); err != nil {
			return nil, err
		}
	}

	return edgeData, nil
}

// this adds the linked assoc edge to the field
func (s *Schema) addLinkedEdges(cfg codegenapi.Config, info *NodeDataInfo) error {
	nodeData := info.NodeData
	fieldInfo := nodeData.FieldInfo
	edgeInfo := nodeData.EdgeInfo

	for _, e := range edgeInfo.FieldEdges {
		f := fieldInfo.GetFieldByName(e.FieldName)
		if f == nil {
			return fmt.Errorf("invalid edge with Name %s", e.FieldName)
		}

		if e.Polymorphic != nil {
			// so we want to add it to edges for
			if err := edgeInfo.AddIndexedEdgeFromSource(
				cfg,
				f.TsFieldName(cfg),
				f.GetQuotedDBColName(),
				nodeData.Node,
				e.Polymorphic,
			); err != nil {
				return err
			}
			for _, typ := range e.Polymorphic.Types {
				// convert to Node type
				typ = strcase.ToCamel(typ) + "Config"
				foreign, ok := s.Nodes[typ]
				if ok {

					// only add polymorphic accessors on foreign if index or unique
					if f.Index() || f.Unique() {
						fEdgeInfo := foreign.NodeData.EdgeInfo
						if err := fEdgeInfo.AddDestinationEdgeFromPolymorphicOptions(
							cfg,
							f.TsFieldName(cfg),
							f.GetQuotedDBColName(),
							nodeData.Node,
							e.Polymorphic,
							foreign.NodeData.Node,
						); err != nil {
							return err
						}
					}
				} else {
					return fmt.Errorf("couldn't find config for typ %s", typ)
				}
			}
			continue
		}
		// no inverse edge or name, nothing to do here
		if e.InverseEdge == nil || e.InverseEdge.Name == "" {
			continue
		}
		edgeName := e.InverseEdge.Name

		config := e.GetEntConfig()
		if config.ConfigName == "" {
			continue
		}

		foreignInfo, ok := s.Nodes[config.ConfigName]
		if !ok {
			return fmt.Errorf("could not find the EntConfig codegen info for %s", config.ConfigName)
		}
		foreignEdgeInfo := foreignInfo.NodeData.EdgeInfo
		fEdge := foreignEdgeInfo.GetAssociationEdgeByName(edgeName)
		if fEdge == nil {
			// add from inverseEdge...
			var err error
			fEdge, err = foreignEdgeInfo.AddEdgeFromInverseFieldEdge(cfg, info.NodeData.Node, e.NodeInfo.PackageName, e.InverseEdge)
			if err != nil {
				return err
			}
		}
		if err := f.AddInverseEdge(cfg, fEdge); err != nil {
			return err
		}
	}
	return nil
}

func (s *Schema) addEdgesFromFields(
	cfg codegenapi.Config,
	info *NodeDataInfo,
) error {
	nodeData := info.NodeData
	fieldInfo := nodeData.FieldInfo
	edgeInfo := nodeData.EdgeInfo

	for _, f := range fieldInfo.Fields {
		fkeyInfo := f.ForeignKeyInfo()
		if fkeyInfo != nil {
			if err := s.addForeignKeyEdges(cfg, nodeData, fieldInfo, edgeInfo, f, fkeyInfo); err != nil {
				return err
			}
		}

		fieldEdgeInfo := f.FieldEdgeInfo()
		if fieldEdgeInfo != nil {
			if err := s.addFieldEdge(cfg, edgeInfo, f); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *Schema) addForeignKeyEdges(
	cfg codegenapi.Config,
	nodeData *NodeData,
	fieldInfo *field.FieldInfo,
	edgeInfo *edge.EdgeInfo,
	f *field.Field,
	fkeyInfo *field.ForeignKeyInfo,
) error {
	// this seems like it's verified...
	foreignInfo, ok := s.Nodes[fkeyInfo.Schema+"Config"]
	if !ok {
		// enum, that's ok. nothing to do here
		if s.EnumNameExists(fkeyInfo.Schema) {
			return nil
		}
		return fmt.Errorf("invalid schema %s for foreign key %s", fkeyInfo.Schema, fkeyInfo.Name)
	}

	if f := foreignInfo.NodeData.GetFieldByName(fkeyInfo.Field); f == nil {
		return fmt.Errorf("could not find field %s by name", fkeyInfo.Field)
	}

	// add a field edge on current config so we can load underlying user
	// and return it in GraphQL appropriately
	if err := f.AddForeignKeyFieldEdgeToEdgeInfo(cfg, edgeInfo, s.NameExists); err != nil {
		return err
	}

	// TODO need to make sure this is not nil if no fields
	foreignEdgeInfo := foreignInfo.NodeData.EdgeInfo
	return f.AddForeignKeyEdgeToInverseEdgeInfo(cfg, foreignEdgeInfo, nodeData.Node)
}

func (s *Schema) addFieldEdge(
	cfg codegenapi.Config,
	edgeInfo *edge.EdgeInfo,
	f *field.Field,
) error {
	// add a field edge on current config so we can load underlying user
	// and return it in GraphQL appropriately
	// this also flags that when we write data to this field, we write the inverse edge also
	// e.g. writing user_id field on an event will also write corresponding user -> events edge
	return f.AddFieldEdgeToEdgeInfo(cfg, edgeInfo, s.NameExists)
}

func (s *Schema) addInverseAssocEdgesFromInfo(info *NodeDataInfo) error {
	for _, assocEdge := range info.NodeData.EdgeInfo.Associations {
		if err := s.maybeAddInverseAssocEdge(assocEdge); err != nil {
			return err
		}
	}
	return nil
}

func (s *Schema) maybeAddInverseAssocEdge(assocEdge *edge.AssociationEdge) error {
	if assocEdge.InverseEdge == nil {
		return nil
	}
	// pattern edge. ignore. will be added in pattern edge
	if assocEdge.PatternName != "" {
		return nil
	}
	configName := assocEdge.NodeInfo.EntConfigName
	inverseInfo, ok := s.Nodes[configName]
	if !ok {
		return fmt.Errorf("could not find the EntConfig codegen info for %s", configName)
	}

	inverseEdgeInfo := inverseInfo.NodeData.EdgeInfo

	return assocEdge.AddInverseEdge(inverseEdgeInfo)
}

func (s *Schema) addNewConstsAndEdges(nodeData *NodeData, edgeData *assocEdgeData) error {

	// this seems like go only?
	// we do use this value in ts tho
	nodeData.addConstInfo(
		"ent.NodeType",
		nodeData.NodeType,
		&ConstInfo{
			ConstName:  nodeData.NodeType,
			ConstValue: strconv.Quote(nodeData.NodeInstance),
			Comment: fmt.Sprintf(
				"%s is the node type for the %s object. Used to identify this node in edges and other places.",
				nodeData.NodeType,
				nodeData.Node,
			),
		},
	)

	// high level steps we need eventually
	// 1 parse each config file
	// 2 parse all config files (that's basically part of 1 but there's dependencies so we need to come back...)
	// 3 parse db/models/external data as needed
	// 4 validate all files/models/db state against each other to make sure they make sense
	// 5 one more step to get new things. e.g. generate new uuids etc
	// 6 generate new db schema
	// 7 write new files
	// 8 write edge config to db (this should really be a separate step since this needs to run in production every time)

	for _, assocEdge := range nodeData.EdgeInfo.Associations {
		// handled by the "main edge".
		if !assocEdge.CreateEdge() {
			continue
		}

		newEdge, err := s.getNewEdge(edgeData, assocEdge)
		if err != nil {
			return err
		}

		s.addNewEdgeType(nodeData, newEdge.constName, newEdge.constValue, assocEdge)
	}
	return nil
}

type newEdgeInfo struct {
	constName, constValue string
}

func (s *Schema) getNewEdge(edgeData *assocEdgeData, assocEdge *edge.AssociationEdge) (*newEdgeInfo, error) {
	constName := assocEdge.EdgeConst

	// check if there's an existing edge
	constValue := edgeData.edgeTypeOfEdge(constName)

	inverseEdge := assocEdge.InverseEdge

	var inverseConstName string
	var inverseConstValue string
	var newInverseEdge bool
	var err error
	// is there an inverse?
	if inverseEdge != nil {
		inverseConstName, inverseConstValue, newInverseEdge, err = s.getInverseEdgeType(assocEdge, inverseEdge, edgeData)
		if err != nil {
			return nil, err
		}
	}
	isNewEdge := constValue == ""
	if isNewEdge {
		constValue = uuid.New().String()
		// keep track of new edges that we need to do things with
		newEdge := &ent.AssocEdgeData{
			EdgeType:        ent.EdgeType(constValue),
			EdgeName:        constName,
			SymmetricEdge:   assocEdge.Symmetric,
			EdgeTable:       assocEdge.TableName,
			InverseEdgeType: sql.NullString{},
		}

		if inverseConstValue != "" {
			if err := newEdge.InverseEdgeType.Scan(inverseConstValue); err != nil {
				return nil, err
			}
		}

		edgeData.addNewEdge(newEdge)
	}

	if newInverseEdge {
		ns := sql.NullString{}
		if err := ns.Scan(constValue); err != nil {
			return nil, err
		}

		// add inverse edge to list of new edges
		edgeData.addNewEdge(&ent.AssocEdgeData{
			EdgeType:        ent.EdgeType(inverseConstValue),
			EdgeName:        inverseConstName,
			SymmetricEdge:   false, // we know for sure that we can't be symmetric and have an inverse edge
			EdgeTable:       assocEdge.TableName,
			InverseEdgeType: ns,
		})

		// if the inverse edge already existed in the db, we need to update that edge to let it know of its new inverse
		if !isNewEdge {
			// potential improvement: we can do it automatically in addNewEdge
			if err := edgeData.updateInverseEdgeTypeForEdge(
				constName, inverseConstValue); err != nil {
				return nil, err
			}
		}
	}
	return &newEdgeInfo{
		constName:  constName,
		constValue: constValue,
	}, nil
}

func (s *Schema) nonEntFieldActionInfo(f *field.NonEntField) *enttype.ActionFieldsInfo {
	typ := f.GetFieldType()
	t, ok := typ.(enttype.TSTypeWithActionFields)
	if !ok {
		return nil
	}
	actionFieldsInfo := t.GetActionFieldsInfo()
	if actionFieldsInfo == nil || actionFieldsInfo.ActionName == "" {
		return nil
	}
	return actionFieldsInfo
}

func (s *Schema) findActionByName(currentConfigName, actionName string) action.Action {
	for k, v := range s.Nodes {
		if k == currentConfigName {
			continue
		}
		a2 := v.NodeData.ActionInfo.GetByName(actionName)
		if a2 != nil {
			return a2
		}
		continue
	}
	return nil
}

func (s *Schema) addActionFields(info *NodeDataInfo) error {
	for _, a := range info.NodeData.ActionInfo.Actions {
		for _, f := range a.GetNonEntFields() {
			actionFieldsInfo := s.nonEntFieldActionInfo(f)
			if actionFieldsInfo == nil {
				continue
			}
			actionName := actionFieldsInfo.ActionName
			excludedFields := make(map[string]bool)
			for _, v := range actionFieldsInfo.ExcludedFields {
				excludedFields[v] = true
			}

			a2 := s.findActionByName(info.NodeData.Node+"Config", actionName)
			if a2 == nil {
				return fmt.Errorf("invalid action only field %s. couldn't find action with name %s", f.GetFieldName(), actionName)
			}

			typ := f.GetFieldType()
			t := typ.(enttype.TSTypeWithActionFields)

			for _, f2 := range a2.GetFields() {
				if f2.EmbeddableInParentAction() && !excludedFields[f2.FieldName] {

					f3 := f2
					if action.IsRequiredField(a2, f2) {
						var err error
						f3, err = f2.Clone(field.Required())
						if err != nil {
							return err
						}
					}
					a.AddCustomField(t, f3)
				}
			}

			for _, f2 := range a2.GetNonEntFields() {
				a.AddCustomNonEntField(t, f2)
			}
		}
	}
	return nil
}

func (s *Schema) addActionFieldsPostProcess(nodeData *NodeData) {
	// break this up into its own function which is done in post-process **after**
	// everything has been loaded because we want to make sure
	// addActionFields has been called for every schema and action before we call
	// AddCustomInterfaces
	for _, a := range nodeData.ActionInfo.Actions {
		for _, f := range a.GetNonEntFields() {
			actionFieldsInfo := s.nonEntFieldActionInfo(f)

			if actionFieldsInfo == nil {
				continue
			}
			actionName := actionFieldsInfo.ActionName
			a2 := s.findActionByName(nodeData.Node+"Config", actionName)
			if a2 != nil {
				a.AddCustomInterfaces(a2)
			}
		}
	}
}

func (s *Schema) processConstraints(nodeData *NodeData) error {
	// doing this way so that it's consistent and easy to test
	// primary key
	// unique
	// fkey
	// user defined constraints

	tableName := nodeData.TableName

	var constraints []*input.Constraint
	for _, f := range nodeData.FieldInfo.Fields {
		// always use db col name here
		cols := []string{f.GetDbColName()}

		if f.SingleFieldPrimaryKey() {
			constraints = append(constraints, &input.Constraint{
				Name:    base.GetPrimaryKeyName(tableName, f.GetDbColName()),
				Type:    input.PrimaryKeyConstraint,
				Columns: cols,
			})
		}

		if f.Unique() {
			constraints = append(constraints, &input.Constraint{
				Name:    base.GetUniqueKeyName(tableName, f.GetDbColName()),
				Type:    input.UniqueConstraint,
				Columns: cols,
			})
		}

		fkey := f.ForeignKeyInfo()
		var enumInfo *EnumInfo
		if fkey != nil {
			// s.Nodes still keyed by Config :(
			foreignInfo := s.Nodes[fkey.Schema+"Config"]
			if foreignInfo == nil {
				var ok bool
				enumInfo, ok = s.Enums[fkey.Schema]
				if !ok {
					return fmt.Errorf("invalid foreign key table %s", fkey.Schema)
				}
				if !enumInfo.LookupTableEnum() {
					return fmt.Errorf("trying to set a foreign key to non-enum lookup table %s", fkey.Schema)
				}
			}
			var foreignNodeData *NodeData
			if enumInfo != nil {
				foreignNodeData = enumInfo.NodeData
			} else {
				foreignNodeData = foreignInfo.NodeData
			}
			foreignField := foreignNodeData.FieldInfo.GetFieldByName(fkey.Field)
			if foreignField == nil {
				return fmt.Errorf("invalid foreign key field %s", fkey.Field)
			}
			constraints = append(constraints, &input.Constraint{
				Name:    base.GetFKeyName(nodeData.TableName, f.GetDbColName()),
				Type:    input.ForeignKeyConstraint,
				Columns: cols,
				ForeignKey: &input.ForeignKeyInfo{
					TableName: foreignNodeData.TableName,
					Columns:   []string{foreignField.GetDbColName()},
					OnDelete:  "CASCADE", // default based on what we were previously doing
				},
			})
		}
	}

	fieldInfo := nodeData.FieldInfo

	// verify constraints are correct
	for _, constraint := range nodeData.Constraints {
		switch constraint.Type {
		case input.ForeignKeyConstraint:
			if constraint.ForeignKey == nil {
				return errors.New("ForeignKey cannot be nil when type is ForeignKey")
			}
			if len(constraint.Columns) != len(constraint.ForeignKey.Columns) {
				return errors.New("Foreign Key column length should be equal to the length of source columns")
			}

		case input.CheckConstraint:
			if constraint.Condition == "" {
				return errors.New("Condition is required when constraint type is Check")
			}
		}

		if constraint.Condition != "" && constraint.Type != input.CheckConstraint {
			return errors.New("Condition can only be set when constraint is check type")
		}
		if constraint.ForeignKey != nil && constraint.Type != input.ForeignKeyConstraint {
			return errors.New("ForeignKey can only be set when constraint is ForeignKey type")
		}

		columns, err := s.convertCols(fieldInfo, constraint.Columns)
		if err != nil {
			return err
		}

		constraint.Columns = columns
		constraints = append(constraints, constraint)
	}

	nodeData.Constraints = constraints
	return nil
}

// convert columns to columns instead of fields
func (s *Schema) convertCols(fieldInfo *field.FieldInfo, cols []string) ([]string, error) {

	result := make([]string, len(cols))
	for idx, col := range cols {
		f := fieldInfo.GetFieldByName(col)
		if f == nil {
			f = fieldInfo.GetFieldByColName(col)
		}
		if f == nil {
			return nil, fmt.Errorf("cannot find field by name or col %s", col)
		}
		// always use db columns.
		result[idx] = f.GetDbColName()
	}
	return result, nil
}

func (s *Schema) addConstsFromEdgeGroups(nodeData *NodeData) {
	for _, edgeGroup := range nodeData.EdgeInfo.AssocGroups {
		for edgeName := range edgeGroup.Edges {
			constName := edgeGroup.GetConstNameForEdgeName(edgeName)
			constValue := strings.ToLower(
				base.GetNameFromParts(
					[]string{
						nodeData.Node,
						edgeName,
					},
				))

			nodeData.addConstInfo(
				edgeGroup.ConstType,
				constName,
				&ConstInfo{
					ConstName:  constName,
					ConstValue: strconv.Quote(constValue),
					Comment: fmt.Sprintf(
						"%s is the edge representing the status for the %s edge.",
						constName,
						edgeName,
					),
				},
			)

		}

		unknownConst := edgeGroup.GetConstNameForUnknown()
		constValue := strings.ToLower(
			base.GetNameFromParts(
				[]string{
					nodeData.Node,
					"Unknown",
				},
			))
		nodeData.addConstInfo(
			edgeGroup.ConstType,
			unknownConst,
			&ConstInfo{
				ConstName:  unknownConst,
				ConstValue: strconv.Quote(constValue),
				Comment: fmt.Sprintf(
					"%s is the edge representing the unknown status for the %s edgegroup.",
					unknownConst,
					edgeGroup.GroupStatusName,
				),
			},
		)
	}
}

func (s *Schema) getInverseEdgeType(assocEdge *edge.AssociationEdge, inverseEdge *edge.InverseAssocEdge, edgeData *assocEdgeData) (string, string, bool, error) {
	inverseConstName := inverseEdge.EdgeConst

	// so for inverse edge of patterns, we need the inverse edge to be polymorphic
	// e.g. when trying to get things you've liked
	cfg := assocEdge.GetEntConfig().ConfigName
	inverseNodeDataInfo := s.Nodes[assocEdge.GetEntConfig().ConfigName]
	if inverseNodeDataInfo == nil {
		return "", "", false, fmt.Errorf("invalid inverse edge node %s", cfg)
	}
	inverseNodeData := inverseNodeDataInfo.NodeData

	// check if there's an existing edge
	newEdge := !edgeData.existingEdge(inverseConstName)
	inverseConstValue := edgeData.edgeTypeOfEdge(inverseConstName)
	if inverseConstValue == "" {
		inverseConstValue = uuid.New().String()
	}

	// add inverse edge constant
	s.addNewEdgeType(inverseNodeData, inverseConstName, inverseConstValue, inverseEdge)

	return inverseConstName, inverseConstValue, newEdge, nil
}

func (s *Schema) addNewEdgeType(c WithConst, constName, constValue string, edge edge.Edge) {
	// this is a map so easier to deal with duplicate consts if we run into them
	c.addConstInfo(
		"ent.EdgeType",
		constName,
		&ConstInfo{
			ConstName:  constName,
			ConstValue: strconv.Quote(constValue),
			Comment: fmt.Sprintf(
				"%s is the edgeType for the %s to %s edge.",
				constName,
				c.GetNodeInstance(),
				strings.ToLower(edge.GetEdgeName()),
			),
		},
	)
}

func (s *Schema) runDepgraph(info *NodeDataInfo) error {
	return info.depgraph.Run(func(item interface{}) error {
		execFn, ok := item.(func(*NodeDataInfo))
		execFn2, ok2 := item.(func(*NodeDataInfo) error)

		if !ok && !ok2 {
			return fmt.Errorf("invalid function passed")
		}
		if ok {
			execFn(info)
			return nil
		}
		if ok2 {
			return execFn2(info)
		}
		return nil
	})
}

func (s *Schema) PatternFieldWithMixin(f *field.Field) bool {
	name := f.GetPatternName()
	if name == "" {
		return false
	}

	p := s.Patterns[name]
	if p == nil {
		return false
	}
	return p.HasMixin()
}
