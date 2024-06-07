package schema

import (
	"database/sql"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jinzhu/inflection"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/depgraph"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/names"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/customtype"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/util"
	"github.com/pkg/errors"
)

// Schema is the representation of the parsed schema. Has everything needed to
type Schema struct {
	Nodes                       NodeMapInfo
	Patterns                    map[string]*PatternInfo
	globalEdges                 []*edge.AssociationEdge
	globalEnums                 map[string]*EnumInfo
	globalConsts                *objWithConsts
	extraEdgeFields             []*field.Field
	initGlobalSchema            bool
	globalSchemaTransformsEdges bool
	tables                      NodeMapInfo
	edges                       map[string]*ent.AssocEdgeData
	newEdges                    []*ent.AssocEdgeData
	edgesToUpdate               []*ent.AssocEdgeData
	Enums                       map[string]*EnumInfo
	enumTables                  map[string]*EnumInfo
	CustomInterfaces            map[string]*customtype.CustomInterface
	allCustomTypes              map[string]field.CustomTypeWithHasConvertFunction
	gqlTypeMap                  map[string]bool
	globalCanViewerDo           map[string]action.Action

	// used to keep track of schema-state
	inputSchema *input.Schema
}

func (s *Schema) GetInputSchema() *input.Schema {
	return s.inputSchema
}

func (s *Schema) GetGlobalEdges() []*edge.AssociationEdge {
	return s.globalEdges
}

func (s *Schema) InitGlobalSchema() bool {
	return s.initGlobalSchema
}

func (s *Schema) GlobalSchemaTransformsEdges() bool {
	return s.globalSchemaTransformsEdges
}

func (s *Schema) ExtraEdgeFields() []*field.Field {
	return s.extraEdgeFields
}

func (s *Schema) GetGlobalConsts() WithConst {
	return s.globalConsts
}

func (s *Schema) GetGlobalEnums() map[string]*EnumInfo {
	return s.globalEnums
}

func (s *Schema) IsGlobalEnumWithDisableUnknownType(typ string) bool {
	enum, ok := s.globalEnums[typ]
	return ok && enum.Enum.DisableUnknownType
}

func (s *Schema) GetGlobalCanViewerDo() map[string]action.Action {
	return s.globalCanViewerDo
}

func (s *Schema) addEnum(enumType enttype.EnumeratedType, nodeData *NodeData, fkeyInfo *field.ForeignKeyInfo, exposeToGraphQL bool) error {
	v, err := enum.NewInputFromEnumType(enumType, fkeyInfo != nil)
	if err != nil {
		return err
	}

	return s.addEnumFrom(v, nodeData, nil, exposeToGraphQL)
}

func (s *Schema) addPattern(name string, p *PatternInfo, cfg codegenapi.Config) error {
	if s.Patterns[name] != nil {
		return fmt.Errorf("pattern with name %s already exists", name)
	}

	gqlType := fmt.Sprintf("%sType", names.ToClassType(p.Name))
	if err := s.addGQLType(gqlType); err != nil {
		return err
	}

	p.depgraph = s.buildPostRunDepgraph(cfg)
	s.Patterns[name] = p

	return nil
}

func (s *Schema) GetNodeDataForNode(nodeName string) (*NodeData, error) {
	info := s.Nodes[nodeName]
	if info == nil {
		return nil, fmt.Errorf("cannot find NodeInfo for %s", nodeName)
	}

	return info.NodeData, nil
}

func (s *Schema) NodeNameExists(nodeName string) bool {
	_, ok := s.Nodes[nodeName]
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
		!nodeData.HideFromGraphQL,
	)
}

func (s *Schema) addEnumFrom(input *enum.Input, nodeData *NodeData, inputNode *input.Node, exposeToGraphQL bool) error {
	tsEnum, gqlEnum := enum.GetEnums(input)

	// first create EnumInfo...
	info := &EnumInfo{
		Enum:      tsEnum,
		GQLEnum:   gqlEnum,
		NodeData:  nodeData,
		InputNode: inputNode,
	}

	// field hide from graphql or pattern hide from gql
	if !exposeToGraphQL || nodeData.HideFromGraphQL {
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

func (s *Schema) addEnumFromPattern(enumType enttype.EnumeratedType, pattern *input.Pattern, exposeToGraphQL bool) (*EnumInfo, error) {
	input, err := enum.NewInputFromEnumType(enumType, false)
	if err != nil {
		return nil, err
	}
	return s.addEnumFromInput(input, pattern, exposeToGraphQL)
}

func (s *Schema) addEnumFromInput(input *enum.Input, pattern *input.Pattern, exposeToGraphQL bool) (*EnumInfo, error) {
	tsEnum, gqlEnum := enum.GetEnums(input)

	// first create EnumInfo...
	info := &EnumInfo{
		Enum:    tsEnum,
		GQLEnum: gqlEnum,
		Pattern: pattern,
	}

	if !exposeToGraphQL {
		info.GQLEnum = nil
	}

	// new source enum
	if err := s.addEnumShared(input, info); err != nil {
		return nil, err
	}
	return info, nil
}

func (s *Schema) addGlobalEnum(enumType enttype.EnumeratedType, exposeToGraphQL bool) (*EnumInfo, error) {
	input, err := enum.NewInputFromEnumType(enumType, false)
	if err != nil {
		return nil, err
	}
	enumInfo, err := s.addEnumFromInput(input, nil, exposeToGraphQL)

	if err != nil {
		return nil, err
	}

	if s.globalEnums[enumInfo.Enum.Name] != nil {
		return nil, fmt.Errorf("global enum %s already exists", enumInfo.Enum.Name)
	}
	s.globalEnums[enumInfo.Enum.Name] = enumInfo

	return enumInfo, nil
}

func (s *Schema) addEnumShared(input *enum.Input, info *EnumInfo) error {
	gqlName := input.GQLName
	if input.HasValues() {
		if s.Enums[gqlName] != nil {
			return fmt.Errorf("enum schema with graphql name %s already exists", gqlName)
		}

		// TODO we're storing the same info twice. simplify this.
		// s.Enums and s.gqlTypeMap
		gqlType := gqlName + "Type"
		if err := s.addGQLType(gqlType); err != nil {
			return err
		}
		// key on gqlName since key isn't really being used atm and gqlName needs to be unique
		s.Enums[gqlName] = info
	}
	return nil
}

// ParseFromInputSchema takes the schema that has been parsed from whatever input source
// and provides the schema we have that's checked and conforms to everything we expect
func ParseFromInputSchema(cfg codegenapi.Config, schema *input.Schema, lang base.Language) (*Schema, error) {
	s := &Schema{}
	s.init()

	edgeData, err := s.parseInputSchema(cfg, schema, lang)
	if err != nil {
		return nil, err
	}
	s.edges = edgeData.getEdgesToRender()
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
	s.allCustomTypes = make(map[string]field.CustomTypeWithHasConvertFunction)
	s.globalEnums = map[string]*EnumInfo{}
	s.gqlTypeMap = map[string]bool{
		"QueryType":    true,
		"MutationType": true,
		// just claim this for now...
		"SubscriptionType": true,
	}
	s.globalCanViewerDo = map[string]action.Action{}
	s.globalConsts = &objWithConsts{}
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
func (s *Schema) GetAssocEdgeByName(nodeName, edgeName string) (*edge.AssociationEdge, error) {
	info := s.Nodes[nodeName]
	if info == nil {
		return nil, fmt.Errorf("invalid NodeName %s passed to getAssocEdgeByName", nodeName)
	}
	ret := info.NodeData.GetAssociationEdgeByName(edgeName)
	if ret == nil {
		return nil, errors.New("error getting edge")
	}
	return ret, nil
}

func (s *Schema) GetFieldByName(nodeName, fieldName string) (*field.Field, error) {
	info := s.Nodes[nodeName]
	if info == nil {
		return nil, fmt.Errorf("invalid NodeName %s passed to getFieldByName", nodeName)
	}
	ret := info.NodeData.GetFieldByName(fieldName)
	if ret == nil {
		return nil, fmt.Errorf("error getting field %s by name with nodeName %s", fieldName, nodeName)
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

	if schema.GlobalSchema != nil {
		errs = append(errs, s.parseGlobalSchemaEarly(cfg, schema.GlobalSchema)...)
	}

	patternMap := make(map[string][]*NodeData)

	for nodeName, node := range schema.Nodes {
		packageName := names.ToFilePathName(nodeName)
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
		nodeData.TransformsLoaderCodegen = node.TransformsLoaderCodegen
		nodeData.CustomGraphQLInterfaces = node.CustomGraphQLInterfaces
		nodeData.SupportUpsert = node.SupportUpsert
		nodeData.ShowCanViewerSee = node.ShowCanViewerSee
		nodeData.ShowCanViewerEdit = node.ShowCanViewerEdit
		nodeData.HasDefaultActionPrivacy = node.HasDefaultActionPrivacy
		for _, p := range node.Patterns {
			pattern := schema.Patterns[p]
			if pattern == nil || pattern.DisableMixin {
				continue
			}
			nodeData.PatternsWithMixins = append(nodeData.PatternsWithMixins, p)
		}

		addEnum := func(enumType enttype.EnumeratedType, f *field.Field, patternField bool) error {
			// if global enum, just flag as imported
			enumInfo := s.globalEnums[enumType.GetEnumData().TSName]
			if enumInfo != nil {
				clone := enumInfo.Enum.Clone()
				clone.Imported = true
				nodeData.addEnum(clone)
				return nil
			}

			if patternField {
				// keep track of NodeDatas that map to this enum...
				patternName := f.GetPatternName()
				list := patternMap[patternName]
				if list == nil {
					list = []*NodeData{}
				}
				list = append(list, nodeData)
				patternMap[patternName] = list
				return nil
			}

			return s.addEnum(enumType, nodeData, f.ForeignKeyInfo(), f.ExposeToGraphQL())
		}

		fieldInfo, err := s.processFields(cfg, nodeName, node.Fields, addEnum, node)
		if err != nil {
			return nil, err
		}
		nodeData.FieldInfo = fieldInfo

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
				true,
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
			return nil, err
		}

		// do canViewerDo things
		for _, action := range nodeData.ActionInfo.Actions {
			canViewerDo := action.GetCanViewerDo()
			if canViewerDo != nil {
				if !action.ExposedToGraphQL() {
					return nil, fmt.Errorf("cannot set canViewerDo on action %s which is not exposed to graphql", action.GetActionName())
				}

				if action.GetOperation() == ent.CreateAction {
					// create canViewerdo is global
					s.globalCanViewerDo[action.GetGraphQLName()] = action
				} else {
					nodeData.canViewerDo[action.GetGraphQLName()] = action
				}
			}
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
			depgraph:      s.buildPostRunDepgraph(cfg),
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
				info, err := s.getEdgeInfoAndCheckNewEdge(edgeData, assocEdge)
				if err != nil {
					errs = append(errs, err)
				} else {
					s.addEdgeTypeFromEdgeInfo(p, info, assocEdge)
				}
			}
			if err := s.maybeAddInverseAssocEdge(assocEdge); err != nil {
				errs = append(errs, err)
			}
		}

		addEnum := func(enumType enttype.EnumeratedType, f *field.Field, _ bool) error {
			// global enum. nothing to do here.
			enumInfo := s.globalEnums[enumType.GetEnumData().TSName]
			if enumInfo != nil {
				return nil
			}

			info, err := s.addEnumFromPattern(enumType, pattern, f.ExposeToGraphQL())
			if err != nil {
				return err
			}

			// add cloned enum to nodeData and mark as imported
			list := patternMap[name]
			clone := info.Enum.Clone()
			clone.Imported = true
			for _, nodeData := range list {
				nodeData.addEnum(clone)
			}
			return nil
		}

		fieldInfo, err := s.processFields(cfg, name, pattern.Fields, addEnum, nil)
		if err != nil {
			errs = append(errs, err)
		} else {
			p.FieldInfo = fieldInfo
		}

		edgeInfo, err := edge.EdgeInfoFromPattern(cfg, p.Name, pattern)
		if err != nil {
			return nil, err
		} else {
			p.EdgeInfo = edgeInfo
		}

		if err := s.addPattern(name, p, cfg); err != nil {
			errs = append(errs, err)
		}
	}

	if schema.GlobalSchema != nil {
		errs = append(errs, s.parseGlobalSchema(cfg, schema.GlobalSchema, edgeData)...)
	}

	// TODO convert more things to do something like this?
	if len(errs) > 0 {
		// we're getting list of errors and coalescing
		return nil, util.CoalesceErr(errs...)
	}

	return s.processDepgrah(edgeData)
}

func (s *Schema) parseGlobalSchemaEarly(cfg codegenapi.Config, gs *input.GlobalSchema) []error {
	var errs []error

	if len(gs.GlobalFields) > 0 {
		fi, err := field.NewFieldInfoFromInputs(cfg, "global", gs.GlobalFields, &field.Options{
			SortFields: true,
		})
		if err != nil {
			errs = append(errs, err)
		} else {
			for _, f := range fi.AllFields() {
				entType := f.GetFieldType()
				enumType, ok := enttype.GetEnumType(entType)
				if ok {
					_, err := s.addGlobalEnum(enumType, f.ExposeToGraphQL())
					if err != nil {
						errs = append(errs, err)
					}
					continue
				}
				ci, err := s.checkCustomInterface(cfg, f, nil, true)
				if err != nil {
					errs = append(errs, err)
				}
				if ci == nil {
					errs = append(errs, fmt.Errorf("invalid field %s. only fields currently allowed in global schema are global enums or struct fields", f.FieldName))
				}
			}
		}
	}

	return errs
}

func (s *Schema) parseGlobalSchema(cfg codegenapi.Config, gs *input.GlobalSchema, edgeData *assocEdgeData) []error {
	var errs []error
	for _, inputEdge := range gs.GlobalEdges {
		assocEdge, err := edge.AssocEdgeFromInput(cfg, "global", inputEdge)
		if err != nil {
			errs = append(errs, err)
		} else {
			s.globalEdges = append(s.globalEdges, assocEdge)
			if assocEdge.CreateEdge() {
				info, err := s.getEdgeInfoAndCheckNewEdge(edgeData, assocEdge)
				if err != nil {
					errs = append(errs, err)
				} else {
					s.addEdgeTypeFromEdgeInfo(s.globalConsts, info, assocEdge)
				}
				if err := s.maybeAddInverseAssocEdge(assocEdge); err != nil {
					errs = append(errs, err)
				}
			}
		}
	}

	if len(gs.ExtraEdgeFields) > 0 {
		fi, err := field.NewFieldInfoFromInputs(cfg, "global", gs.ExtraEdgeFields, &field.Options{
			SortFields: true,
		})
		if err != nil {
			errs = append(errs, err)
		}
		s.extraEdgeFields = fi.AllFields()
	}

	s.initGlobalSchema = gs.Init
	s.globalSchemaTransformsEdges = gs.TransformsEdges

	return errs
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

		for _, col := range index.Columns {
			f := nodeData.FieldInfo.GetFieldByName(col)
			if !enttype.IsStringDBType(f.GetFieldType()) {
				return fmt.Errorf("only string db types are supported for full text indexes. invalid field %s passed as col for index %s", col, index.Name)
			}
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

// patternField explicitly passed as a param to remind clients to check it
type processEnum func(enumType enttype.EnumeratedType, f *field.Field, patternField bool) error

func (s *Schema) processFields(cfg codegenapi.Config, nodeName string, fields []*input.Field, fn processEnum, node *input.Node) (*field.FieldInfo, error) {
	sourceIsPattern := node == nil
	var overrides map[string]*input.FieldOverride
	if node != nil {
		overrides = node.FieldOverrides
	}

	fieldInfo, err := field.NewFieldInfoFromInputs(
		cfg,
		nodeName,
		fields,
		&field.Options{
			FieldOverrides: overrides,
		},
	)

	if err != nil {
		return nil, err
	}

	for _, f := range fieldInfo.EntFields() {
		entType := f.GetFieldType()
		enumType, ok := enttype.GetEnumType(entType)
		// don't add enums which are defined in patterns
		if ok {
			if err := fn(enumType, f, f.PatternField()); err != nil {
				return nil, err
			}
			continue
		}
		union, ok := entType.(enttype.TSWithUnionFields)
		if ok && union.GetUnionFields() != nil {
			return nil, fmt.Errorf("union fields aren't supported as top level fields at the moment. `%s` invalid field", f.FieldName)
		}

		// only process custom interfaces if not in pattern or only from pattern
		// if pattern field
		if !f.PatternField() || (f.PatternField() && sourceIsPattern) {
			_, err := s.checkCustomInterface(cfg, f, nil, false)
			if err != nil {
				return nil, err
			}
		}
	}

	for k := range overrides {
		if fieldInfo.GetFieldByName(k) == nil {
			return nil, fmt.Errorf("invalid Field %s passed to override for Node %s", k, nodeName)
		}
	}

	return fieldInfo, nil
}

type checkForEnumOptions struct {
	globalType bool
	nested     bool
}

// TODO combine with checkCustomInterface...
func (s *Schema) checkForEnum(cfg codegenapi.Config, f *field.Field, ci *customtype.CustomInterface, opts *checkForEnumOptions) error {
	typ := f.GetFieldType()
	enumTyp, ok := enttype.GetEnumType(typ)
	if ok {
		enumInfo := s.globalEnums[enumTyp.GetEnumData().TSName]
		// global type, flag as imported and add to CI...
		if enumInfo != nil {
			clone := enumInfo.Enum.Clone()
			clone.Imported = true
			gqlClone := enumInfo.GQLEnum.Clone()
			ci.AddEnum(clone, gqlClone)
			return nil
		}

		// enum defined in global struct, add enum as global enum
		if opts.globalType {
			info, err := s.addGlobalEnum(enumTyp, f.ExposeToGraphQL())
			if err != nil {
				return err
			}
			ci.AddEnum(info.Enum, info.GQLEnum)
			return nil
		}

		input, err := enum.NewInputFromEnumType(enumTyp, false)
		if err != nil {
			return err
		}
		info, err := s.addEnumFromInput(input, nil, f.ExposeToGraphQL())
		if err != nil {
			return err
		}
		ci.AddEnum(info.Enum, info.GQLEnum)
		return nil
	}

	if !opts.nested {
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
	for _, f2 := range fi.EntFields() {
		if err := s.checkForEnum(cfg, f2, ci, opts); err != nil {
			return err
		}
	}
	return nil
}

func (s *Schema) getCustomInterfaceFromField(f *field.Field, globalType bool) (*customtype.CustomInterface, []*input.Field) {
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
		TSType:              cti.TSInterface,
		GQLName:             cti.GraphQLInterface,
		Exported:            true,
		GenerateListConvert: globalType || enttype.IsListType(f.GetFieldType()),
	}
	actualSubFields := subFields.([]*input.Field)

	return ci, actualSubFields
}

func (s *Schema) checkCustomInterface(cfg codegenapi.Config, f *field.Field, root *customtype.CustomInterface, globalType bool) (*customtype.CustomInterface, error) {
	ci, subFields := s.getCustomInterfaceFromField(f, globalType)
	if ci == nil || subFields == nil {
		return ci, nil
	}

	if err := s.addGQLType(ci.GetGraphQLType()); err != nil {
		return nil, err
	}

	if s.CustomInterfaces[ci.TSType] != nil {
		return nil, fmt.Errorf("already have custom interface with name %s", ci.TSType)
	}

	s.allCustomTypes[ci.TSType] = ci
	if root == nil {
		root = ci
		s.CustomInterfaces[ci.TSType] = ci
	} else {
		root.Children = append(root.Children, ci)
	}

	fi, err := field.NewFieldInfoFromInputs(cfg, f.FieldName, subFields, &field.Options{})
	if err != nil {
		return nil, err
	}
	for _, f2 := range fi.EntFields() {
		ci.Fields = append(ci.Fields, f2)
		// add custom interface maybe
		_, err := s.checkCustomInterface(cfg, f2, root, globalType)
		if err != nil {
			return nil, err
		}

		cu, err := s.getCustomUnion(cfg, f2, globalType)
		if err != nil {
			return ci, err
		}
		if cu != nil {
			root.Children = append(root.Children, cu)
		}

		if err := s.checkForEnum(cfg, f2, root, &checkForEnumOptions{
			globalType: globalType,
			nested:     false,
		}); err != nil {
			return nil, err
		}
	}
	return ci, nil
}

func (s *Schema) getCustomUnion(cfg codegenapi.Config, f *field.Field, globalType bool) (*customtype.CustomUnion, error) {
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
		GQLName: cti.GraphQLInterface,
	}
	s.allCustomTypes[cu.TSType] = cu

	if err := s.addGQLType(cu.GetGraphQLType()); err != nil {
		return nil, err
	}

	actualSubFields := unionFields.([]*input.Field)
	fi, err := field.NewFieldInfoFromInputs(cfg, f.FieldName, actualSubFields, &field.Options{})
	if err != nil {
		return nil, err
	}
	for _, f2 := range fi.EntFields() {
		ci, subFields := s.getCustomInterfaceFromField(f2, globalType)
		if ci == nil || subFields == nil {
			return nil, fmt.Errorf("couldn't get custom interface from field %s", f.FieldName)
		}
		ci.GraphQLFieldName = f2.GetGraphQLName()

		// get the fields and add to custom interface
		fi2, err := field.NewFieldInfoFromInputs(cfg, f2.FieldName, subFields, &field.Options{})
		if err != nil {
			return nil, err
		}
		ci.Fields = fi2.EntFields()
		// TODO getCustomInterfaceFromField needs to handle this all
		// instead of this mess
		for _, f3 := range ci.Fields {
			if err := s.checkForEnum(cfg, f3, ci, &checkForEnumOptions{
				globalType: globalType,
				nested:     true,
			}); err != nil {
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
		dbEdgeMap:     edgeMap,
		edgesToRender: map[string]*ent.AssocEdgeData{},
	}, nil
}

// TODO refactor this
// we need graphql and ts map
// this should take an interface
// list for actions which have input, payload, etc
// GetTSNames() []string
// GetGraphQLNames() []string
// ExposeToGraphQL() bool
func (s *Schema) addGQLType(name string) error {
	if s.gqlTypeMap[name] {
		return fmt.Errorf("there's already an entity with GraphQL name %s", name)
	}
	s.gqlTypeMap[name] = true
	return nil
}

func (s *Schema) addConfig(info *NodeDataInfo) error {
	// validate schema and table name
	if s.Nodes[info.NodeData.Node] != nil {
		return fmt.Errorf("schema with name %s already exists", info.NodeData.EntConfigName)
	}
	if s.tables[info.NodeData.TableName] != nil {
		return fmt.Errorf("schema with table name %s already exists", info.NodeData.TableName)
	}

	if err := s.addGQLType(info.NodeData.GetGraphQLTypeName()); err != nil {
		return err
	}

	for _, action := range info.NodeData.ActionInfo.Actions {
		if !action.ExposedToGraphQL() {
			continue
		}

		if err := s.addGQLType(action.GetGraphQLInputTypeName()); err != nil {
			return err
		}

		if err := s.addGQLType(action.GetGraphQLTypeName()); err != nil {
			return err
		}

		if err := s.addGQLType(action.GetGraphQLPayloadTypeName()); err != nil {
			return err
		}
	}

	for _, conn := range info.NodeData.EdgeInfo.GetConnectionEdges() {
		if conn.HideFromGraphQL() {
			continue
		}
		if err := s.addGQLType(conn.GetGraphQLConnectionType()); err != nil {
			return err
		}
	}

	// it's confusing that this is stored in 2 places :(
	if s.enumTables[info.NodeData.TableName] != nil {
		if s.enumTables[info.NodeData.TableName].NodeData != info.NodeData {
			return fmt.Errorf("enum schema with table name %s already exists", info.NodeData.TableName)
		}
	}
	s.Nodes[info.NodeData.Node] = info
	s.tables[info.NodeData.TableName] = info
	return nil
}

func (s *Schema) buildPostRunDepgraph(
	cfg codegenapi.Config,
) *depgraph.Depgraph {
	// things that need all nodeDatas loaded
	g := &depgraph.Depgraph{}

	// queue up linking edges
	g.AddItem(
		// want all configs loaded for this.
		// Actions depends on this.
		// this adds the linked assoc edge to the field
		"LinkedEdges", func(c Container) error {
			return s.addLinkedEdges(cfg, c)
		},
		"EdgesFromFields",
	)

	g.AddItem("EdgesFromFields", func(c Container) error {
		return s.addEdgesFromFields(cfg, c)
	})

	// inverse edges also require everything to be loaded
	g.AddItem(
		"InverseEdges", func(c Container) error {
			return s.addInverseAssocEdges(c)
		}, "EdgesFromFields")

	g.AddItem("ActionFields", func(c Container) error {
		return s.addActionFields(c)
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
		if err := s.runDepgraph(info.NodeData, info.depgraph); err != nil {
			return nil, err
		}

		if err := s.processConstraints(info.NodeData); err != nil {
			return nil, err
		}
	}

	for _, p := range s.Patterns {
		if p.depgraph == nil {
			continue
		}

		if err := s.runDepgraph(p, p.depgraph); err != nil {
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

// this adds the linked (assoc + index) edges to the field
func (s *Schema) addLinkedEdges(cfg codegenapi.Config, container Container) error {
	edgeInfo := container.GetEdgeInfo()
	fieldInfo := container.GetFieldInfo()
	name := container.GetName()

	for _, e := range edgeInfo.FieldEdges {
		f := fieldInfo.GetFieldByName(e.FieldName)
		if f == nil {
			return fmt.Errorf("invalid edge with Name %s", e.FieldName)
		}

		if e.Polymorphic != nil {
			if !f.Index() && !f.Unique() {
				continue
			}
			// so we want to add it to edges for
			if err := edgeInfo.AddIndexedEdgeFromSource(
				cfg,
				f.TsFieldName(cfg),
				f.GetQuotedDBColName(),
				name,
				e.Polymorphic,
			); err != nil {
				return err
			}
			for _, typ := range e.Polymorphic.Types {
				// convert to Node type
				typ = names.ToClassType(typ)
				foreign, ok := s.Nodes[typ]
				if ok {
					// only add polymorphic accessors on foreign if index or unique
					if f.Index() || f.Unique() {
						fEdgeInfo := foreign.NodeData.EdgeInfo
						if err := fEdgeInfo.AddDestinationEdgeFromPolymorphicOptions(
							cfg,
							f.TsFieldName(cfg),
							f.GetQuotedDBColName(),
							name,
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

		if f.Index() && !e.IsList() && f.ForeignKeyInfo() == nil {
			if err := edgeInfo.AddIndexedEdgeFromNonPolymorphicSource(
				cfg,
				f.TsFieldName(cfg),
				f.GetQuotedDBColName(),
				name,
				e.NodeInfo.Node,
				e.EdgeConstName,
			); err != nil {
				return err
			}

			fNode, ok := s.Nodes[e.NodeInfo.Node]
			if !ok {
				return fmt.Errorf("couldn't find config for typ %s", e.NodeInfo.Node)
			}

			if e.UserGivenEdgeName != "" {
				if err := fNode.NodeData.EdgeInfo.AddDestinationEdgeFromNonPolymorphicOptions(
					cfg,
					f.TsFieldName(cfg),
					f.GetQuotedDBColName(),
					name,
					fNode.NodeData.Node,
					e.EdgeConstName,
					e.UserGivenEdgeName,
				); err != nil {
					return err
				}
			}
		}

		// no inverse edge or name, nothing to do here
		if e.InverseEdge == nil || e.InverseEdge.Name == "" {
			continue
		}
		edgeName := e.InverseEdge.Name

		config := e.GetEntConfig()
		if config.NodeName == "" {
			continue
		}

		foreignInfo, ok := s.Nodes[config.NodeName]
		if !ok {
			return fmt.Errorf("could not find the NodeData info for %s", config.NodeName)
		}
		foreignEdgeInfo := foreignInfo.NodeData.EdgeInfo
		fEdge := foreignEdgeInfo.GetAssociationEdgeByName(edgeName)
		if fEdge == nil {
			// add from inverseEdge...
			var err error
			fEdge, err = foreignEdgeInfo.AddEdgeFromInverseFieldEdge(cfg, name, e.NodeInfo.PackageName, e.InverseEdge, f.GetPatternName())
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
	container Container,
) error {

	fieldInfo := container.GetFieldInfo()
	edgeInfo := container.GetEdgeInfo()

	for _, f := range fieldInfo.EntFields() {
		fkeyInfo := f.ForeignKeyInfo()
		if fkeyInfo != nil && !container.IsPattern() {
			if err := s.addForeignKeyEdges(cfg, container, edgeInfo, f, fkeyInfo); err != nil {
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
	container Container,
	edgeInfo *edge.EdgeInfo,
	f *field.Field,
	fkeyInfo *field.ForeignKeyInfo,
) error {
	foreignInfo, ok := s.Nodes[fkeyInfo.Schema]
	if !ok {
		// enum, that's ok. nothing to do here
		if s.EnumNameExists(fkeyInfo.Schema) {
			return nil
		}
		return fmt.Errorf("invalid schema %s for foreign key %s", fkeyInfo.Schema, fkeyInfo.Name)
	}

	if f2 := foreignInfo.NodeData.GetFieldByName(fkeyInfo.Field); f2 == nil {
		return fmt.Errorf("could not find field %s by name in field %s in schema %s", fkeyInfo.Field, f.FieldName, container.GetName())
	}

	// add a field edge on current config so we can load underlying user
	// and return it in GraphQL appropriately
	if err := f.AddForeignKeyFieldEdgeToEdgeInfo(cfg, edgeInfo, s.NameExists); err != nil {
		return err
	}

	// TODO need to make sure this is not nil if no fields
	foreignEdgeInfo := foreignInfo.NodeData.EdgeInfo
	return f.AddForeignKeyEdgeToInverseEdgeInfo(cfg, foreignEdgeInfo, container.GetName())
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

func (s *Schema) addInverseAssocEdges(container Container) error {
	if container.IsPattern() {
		// skip this for patterns. leads to errors
		return nil
	}
	for _, assocEdge := range container.GetEdgeInfo().Associations {
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
	nodeName := assocEdge.NodeInfo.Node
	inverseInfo, ok := s.Nodes[nodeName]
	if !ok {
		return fmt.Errorf("could not find the NodeData info for %s", nodeName)
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

		info, err := s.getEdgeInfoAndCheckNewEdge(edgeData, assocEdge)
		if err != nil {
			return err
		}

		s.addEdgeTypeFromEdgeInfo(nodeData, info, assocEdge)
	}
	return nil
}

type edgeInfo struct {
	constName, constValue string
}

func (s *Schema) getEdgeInfoAndCheckNewEdge(edgeData *assocEdgeData, assocEdge *edge.AssociationEdge) (*edgeInfo, error) {
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

	// always make sure the information we send to schema.py is the latest
	// info based on the schema so if the db is corrupted in some way, we'll fix

	if isNewEdge {
		constValue = uuid.New().String()
	}

	// always generate edge information from the schema
	edge1 := &ent.AssocEdgeData{
		EdgeType:        ent.EdgeType(constValue),
		EdgeName:        constName,
		SymmetricEdge:   assocEdge.Symmetric,
		EdgeTable:       assocEdge.TableName,
		InverseEdgeType: sql.NullString{},
	}
	if inverseConstValue != "" {
		if err := edge1.InverseEdgeType.Scan(inverseConstValue); err != nil {
			return nil, err
		}
	}
	edgeData.addEdge(edge1, isNewEdge)

	var edge2 *ent.AssocEdgeData

	if inverseEdge != nil {
		ns := sql.NullString{}
		if err := ns.Scan(constValue); err != nil {
			return nil, err
		}

		// add inverse edge to list of new edges
		edge2 = &ent.AssocEdgeData{
			EdgeType:        ent.EdgeType(inverseConstValue),
			EdgeName:        inverseConstName,
			SymmetricEdge:   false, // we know for sure that we can't be symmetric and have an inverse edge
			EdgeTable:       assocEdge.TableName,
			InverseEdgeType: ns,
		}

		edgeData.addEdge(edge2, newInverseEdge)
	}

	return &edgeInfo{
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

func (s *Schema) findActionByName(nodeName, actionName string) action.Action {
	for k, v := range s.Nodes {
		if k == nodeName {
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

func (s *Schema) addActionFields(container Container) error {
	actionInfo := container.GetActionInfo()
	if actionInfo == nil {
		return nil
	}

	name := container.GetName()

	for _, a := range actionInfo.Actions {
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

			a2 := s.findActionByName(name, actionName)
			if a2 == nil {
				return fmt.Errorf("invalid action only field %s. couldn't find action with name %s", f.GetFieldName(), actionName)
			}

			typ := f.GetFieldType()
			t := typ.(enttype.TSTypeWithActionFields)

			for _, f2 := range a2.GetPublicAPIFields() {
				if f2.EmbeddableInParentAction() && !excludedFields[f2.FieldName] {

					var opts []field.Option
					if action.IsRequiredField(a2, f2) {
						opts = append(opts, field.Required())
					} else {
						// e.g. if field is not currently required
						// e.g. field in edit action or optional non-nullable field in action

						// force optional in action. fake the field as nullable
						// this is kinda like a hack because we have nullable and optional
						// conflated in so many places.
						// we use field.Nullable when rendering interfaces in interface.tmpl to determine if optional
						opts = append(opts, field.Nullable())
					}
					var err error
					f3, err := f2.Clone(opts...)
					if err != nil {
						return err
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
			a2 := s.findActionByName(nodeData.Node, actionName)
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
	for _, f := range nodeData.FieldInfo.EntFields() {
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
			foreignInfo := s.Nodes[fkey.Schema]
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

func (s *Schema) getInverseEdgeType(assocEdge *edge.AssociationEdge, inverseEdge *edge.InverseAssocEdge, edgeData *assocEdgeData) (string, string, bool, error) {
	inverseConstName := inverseEdge.EdgeConst

	// so for inverse edge of patterns, we need the inverse edge to be polymorphic
	// e.g. when trying to get things you've liked
	nodeName := assocEdge.GetEntConfig().NodeName
	inverseNodeDataInfo := s.Nodes[assocEdge.GetEntConfig().NodeName]
	if inverseNodeDataInfo == nil {
		return "", "", false, fmt.Errorf("invalid inverse edge node %s", nodeName)
	}
	inverseNodeData := inverseNodeDataInfo.NodeData

	// check if there's an existing edge
	newEdge := !edgeData.existingEdge(inverseConstName)
	inverseConstValue := edgeData.edgeTypeOfEdge(inverseConstName)
	if inverseConstValue == "" {
		inverseConstValue = uuid.New().String()
	}

	// add inverse edge constant
	s.addEdgeType(inverseNodeData, inverseConstName, inverseConstValue, inverseEdge)

	return inverseConstName, inverseConstValue, newEdge, nil
}

func (s *Schema) addEdgeTypeFromEdgeInfo(c WithConst, info *edgeInfo, edge edge.Edge) {
	s.addEdgeType(c, info.constName, info.constValue, edge)
}

func (s *Schema) addEdgeType(c WithConst, constName, constValue string, edge edge.Edge) {
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

func (s *Schema) runDepgraph(c Container, d *depgraph.Depgraph) error {
	return d.Run(func(item interface{}) error {
		execFn, ok := item.(func(Container))
		execFn2, ok2 := item.(func(Container) error)

		if !ok && !ok2 {
			return fmt.Errorf("invalid function passed")
		}
		if ok {
			execFn(c)
			return nil
		}
		if ok2 {
			return execFn2(c)
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

	if !p.HasMixin() {
		return false
	}

	// if nullability in pattern is different, return false so we override nullable factor
	patternField := p.FieldInfo.GetFieldByName(f.FieldName)
	return patternField.Nullable() == f.Nullable()
}

func (s *Schema) GetCustomTypeByTSName(name string) field.CustomTypeWithHasConvertFunction {
	return s.allCustomTypes[name]
}

var _ field.CustomInterfaceGetter = &Schema{}
