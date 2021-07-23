package schema

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/depgraph"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/util"
	"golang.org/x/tools/go/packages"
)

// Schema is the representation of the parsed schema. Has everything needed to
type Schema struct {
	Nodes         NodeMapInfo
	edges         map[string]*ent.AssocEdgeData
	newEdges      []*ent.AssocEdgeData
	edgesToUpdate []*ent.AssocEdgeData
	// unlike Nodes, the key is "EnumName" instead of "EnumNameConfig"
	// confusing but gets us closer to what we want
	Enums map[string]*EnumInfo
}

func (s *Schema) addEnum(enumType enttype.EnumeratedType, nodeData *NodeData) {
	s.addEnumFrom(
		enumType.GetTSName(),
		enumType.GetGraphQLName(),
		enumType.GetTSType(),
		enumType.GetEnumValues(),
		nodeData,
		nil,
	)
}

func (s *Schema) GetNodeDataForNode(nodeName string) (*NodeData, error) {
	info := s.Nodes[nodeName+"Config"]
	if info == nil {
		return nil, fmt.Errorf("cannot find NodeInfo for %s", nodeName)
	}

	return info.NodeData, nil
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
		return errors.New("need exactly 1 primary key for ")
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

	s.addEnumFrom(
		nodeName,
		nodeName,
		fmt.Sprintf("%s!", nodeName),
		values,
		nodeData,
		node,
	)
	return nil
}

func (s *Schema) addEnumFrom(tsName, gqlName, gqlType string, enumValues []string, nodeData *NodeData, inputNode *input.Node) {
	// first create EnumInfo...

	tsEnum, gqlEnum := enum.GetEnums(tsName, gqlName, gqlType, enumValues)

	info := &EnumInfo{
		Enum:      tsEnum,
		GQLEnum:   gqlEnum,
		NodeData:  nodeData,
		InputNode: inputNode,
	}
	s.Enums[nodeData.Node] = info
	nodeData.addEnum(info)
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
func ParseFromInputSchema(schema *input.Schema, lang base.Language) (*Schema, error) {
	return parse(func(s *Schema) (*assocEdgeData, error) {
		return s.parseInputSchema(schema, lang)
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
		return nil, errors.New("invalid EntConfig passed to getFieldByName")
	}
	ret := info.NodeData.GetFieldByName(fieldName)
	if ret == nil {
		return nil, errors.New("error getting field")
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

func (s *Schema) parseInputSchema(schema *input.Schema, lang base.Language) (*assocEdgeData, error) {
	// TODO right now this is also depending on config/database.yml
	// figure out if best place for this
	edgeData := s.loadExistingEdges()

	var errs []error

	for nodeName, node := range schema.Nodes {
		packageName := base.GetSnakeCaseName(nodeName)
		// user.ts, address.ts etc
		nodeData := newNodeData(packageName)

		// default nodeName goes from address -> addresses, user -> users etc
		if node.TableName == nil {
			nodeData.TableName = inflection.Plural(packageName)
		} else {
			nodeData.TableName = *node.TableName
		}
		// we also want to validate that tableName is unique...

		var err error
		nodeData.FieldInfo, err = field.NewFieldInfoFromInputs(
			node.Fields,
			&field.Options{},
		)
		if err != nil {
			errs = append(errs, err)
		}
		for _, f := range nodeData.FieldInfo.Fields {
			entType := f.GetFieldType()
			enumType, ok := entType.(enttype.EnumeratedType)
			if ok {
				s.addEnum(enumType, nodeData)
			}
		}

		nodeData.EdgeInfo, err = edge.EdgeInfoFromInput(packageName, node)
		if err != nil {
			errs = append(errs, err)
		}

		for _, group := range nodeData.EdgeInfo.AssocGroups {
			s.addEnumFrom(
				group.ConstType,
				group.ConstType,
				fmt.Sprintf("%s!", group.ConstType),
				group.GetEnumValues(),
				nodeData,
				nil,
			)
		}

		nodeData.ActionInfo, err = action.ParseFromInput(packageName, node.Actions, nodeData.FieldInfo, nodeData.EdgeInfo, lang)
		if err != nil {
			errs = append(errs, err)
		}

		nodeData.EnumTable = node.EnumTable
		nodeData.DBRows = node.DBRows
		nodeData.Constraints = node.Constraints
		nodeData.Indices = node.Indices
		nodeData.HideFromGraphQL = node.HideFromGraphQL

		// not in schema.Nodes...
		if node.EnumTable {
			if err := s.addEnumFromInputNode(nodeName, node, nodeData); err != nil {
				errs = append(errs, err)
			}
			continue
		}

		if err := s.addConfig(&NodeDataInfo{
			NodeData:      nodeData,
			depgraph:      s.buildPostRunDepgraph(edgeData),
			ShouldCodegen: true,
		}); err != nil {
			errs = append(errs, err)
		}
	}

	if len(errs) > 0 {
		// we're getting list of errors and coalescing
		// TODO we actually want to do something different here
		return nil, util.CoalesceErr(errs...)
	}

	return s.processDepgrah(edgeData)
}

func (s *Schema) loadExistingEdges() *assocEdgeData {
	// load all edges in db
	result := <-ent.GenLoadAssocEdges()
	if result.Err != nil {
		fmt.Println("error loading data. assoc_edge_config related", result.Err)
	}
	util.Die(result.Err)

	edgeMap := make(map[string]*ent.AssocEdgeData)
	for _, assocEdgeData := range result.Edges {
		edgeMap[assocEdgeData.EdgeName] = assocEdgeData
	}
	return &assocEdgeData{
		edgeMap: edgeMap,
	}
}

func (s *Schema) addConfig(info *NodeDataInfo) error {
	if s.Nodes[info.NodeData.EntConfigName] != nil {
		return fmt.Errorf("config with name %s already exists", info.NodeData.EntConfigName)
	}
	s.Nodes[info.NodeData.EntConfigName] = info
	return nil
}

func (s *Schema) buildPostRunDepgraph(edgeData *assocEdgeData) *depgraph.Depgraph {
	// things that need all nodeDatas loaded
	g := &depgraph.Depgraph{}

	// queue up linking edges
	g.AddItem(
		// want all configs loaded for this.
		// Actions depends on this.
		// this adds the linked assoc edge to the field
		"LinkedEdges", func(info *NodeDataInfo) {
			s.addLinkedEdges(info)
		},
		"EdgesFromFields",
	)

	g.AddItem("EdgesFromFields", func(info *NodeDataInfo) {
		s.addEdgesFromFields(info)
	})

	// inverse edges also require everything to be loaded
	g.AddItem(
		"InverseEdges", func(info *NodeDataInfo) {
			s.addInverseAssocEdges(info)
		}, "EdgesFromFields")

	// add new consts and edges as a dependency of linked edges and inverse edges
	g.AddItem("ConstsAndEdges", func(info *NodeDataInfo) {
		s.addNewConstsAndEdges(info, edgeData)
	}, "LinkedEdges", "InverseEdges")

	g.AddItem("ActionFields", func(info *NodeDataInfo) {
		s.addActionFields(info)
	})
	return g
}

func (s *Schema) processDepgrah(edgeData *assocEdgeData) (*assocEdgeData, error) {
	// second pass to run things that depend on the entire data being loaded
	for _, info := range s.Nodes {

		if info.depgraph == nil {
			continue
		}

		// probably make this concurrent in the future
		info.depgraph.Run(func(item interface{}) {
			execFn, ok := item.(func(*NodeDataInfo))
			if !ok {
				panic(fmt.Errorf("invalid function passed"))
			}
			execFn(info)
		})

		s.processConstraints(info.NodeData)
	}

	// need to run this after running everything above
	for _, info := range s.Nodes {
		if err := info.PostProcess(); err != nil {
			return nil, err
		}
	}

	// need to also process enums too
	// TODO refactor all of these to not be on NodeMapInfo but be on Schema
	// this no longer works anymore
	for _, enumInfo := range s.Enums {
		if enumInfo.LookupTableEnum() {
			s.processConstraints(enumInfo.NodeData)
		}
	}

	return edgeData, nil
}

// this adds the linked assoc edge to the field
func (s *Schema) addLinkedEdges(info *NodeDataInfo) {
	nodeData := info.NodeData
	fieldInfo := nodeData.FieldInfo
	edgeInfo := nodeData.EdgeInfo

	for _, e := range edgeInfo.FieldEdges {
		f := fieldInfo.GetFieldByName(e.FieldName)
		if f == nil {
			panic(fmt.Errorf("invalid edge with Name %s", e.FieldName))
		}

		if e.Polymorphic != nil {
			// so we want to add it to edges for
			edgeInfo.AddIndexedEdgeFromSource(
				f.TsFieldName(),
				f.GetQuotedDBColName(),
				nodeData.Node,
				e.Polymorphic,
			)
			for _, typ := range e.Polymorphic.Types {
				// convert to Node type
				typ = strcase.ToCamel(typ) + "Config"
				foreign, ok := s.Nodes[typ]
				if ok {

					// only add polymorphic accessors on foreign if index or unique
					if f.Index() || f.Unique() {
						fEdgeInfo := foreign.NodeData.EdgeInfo
						//						spew.Dump(nodeData.Node, foreign.NodeData.Node)
						fEdgeInfo.AddDestinationEdgeFromPolymorphicOptions(
							f.TsFieldName(),
							f.GetQuotedDBColName(),
							nodeData.Node,
							e.Polymorphic,
							foreign.NodeData.Node,
						)
					}
				} else {
					panic(fmt.Errorf("couldn't find config for typ %s", typ))
				}
			}
			continue
		}
		// no inverse edge name, nothing to do here
		if e.InverseEdgeName == "" {
			continue
		}

		config := e.GetEntConfig()
		if config.ConfigName == "" {
			continue
		}

		foreignInfo, ok := s.Nodes[config.ConfigName]
		if !ok {
			panic(fmt.Errorf("could not find the EntConfig codegen info for %s", config.ConfigName))
		}
		foreignEdgeInfo := foreignInfo.NodeData.EdgeInfo
		fEdge := foreignEdgeInfo.GetAssociationEdgeByName(e.InverseEdgeName)
		if fEdge == nil {
			panic(fmt.Errorf("couldn't find inverse edge with name %s", e.InverseEdgeName))
		}
		f.AddInverseEdge(fEdge)
	}
}

func (s *Schema) addEdgesFromFields(info *NodeDataInfo) {
	nodeData := info.NodeData
	fieldInfo := nodeData.FieldInfo
	edgeInfo := nodeData.EdgeInfo

	for _, f := range fieldInfo.Fields {
		fkeyInfo := f.ForeignKeyInfo()
		if fkeyInfo != nil {
			s.addForeignKeyEdges(nodeData, fieldInfo, edgeInfo, f, fkeyInfo)
		}

		fieldEdgeInfo := f.FieldEdgeInfo()
		if fieldEdgeInfo != nil {
			s.addFieldEdge(edgeInfo, f)
		}
	}
}

func (s *Schema) addForeignKeyEdges(
	nodeData *NodeData,
	fieldInfo *field.FieldInfo,
	edgeInfo *edge.EdgeInfo,
	f *field.Field,
	fkeyInfo *field.ForeignKeyInfo,
) {
	foreignInfo, ok := s.Nodes[fkeyInfo.Config]
	if !ok {
		match := structNameRegex.FindStringSubmatch(fkeyInfo.Config)
		if len(match) != 2 {
			panic("invalid config name")
		}
		// enum, that's ok. nothing to do here
		_, ok := s.Enums[match[1]]
		if ok {
			return
		}
		panic(fmt.Errorf("could not find the EntConfig codegen info for %s", fkeyInfo.Config))
	}

	if f := foreignInfo.NodeData.GetFieldByName(fkeyInfo.Field); f == nil {
		panic(fmt.Errorf("could not find field %s by name", fkeyInfo.Field))
	}

	// add a field edge on current config so we can load underlying user
	// and return it in GraphQL appropriately
	f.AddForeignKeyFieldEdgeToEdgeInfo(edgeInfo)

	// TODO need to make sure this is not nil if no fields
	foreignEdgeInfo := foreignInfo.NodeData.EdgeInfo
	f.AddForeignKeyEdgeToInverseEdgeInfo(foreignEdgeInfo, nodeData.Node)
}

func (s *Schema) addFieldEdge(
	edgeInfo *edge.EdgeInfo,
	f *field.Field,
) {
	// add a field edge on current config so we can load underlying user
	// and return it in GraphQL appropriately
	// this also flags that when we write data to this field, we write the inverse edge also
	// e.g. writing user_id field on an event will also write corresponding user -> events edge
	f.AddFieldEdgeToEdgeInfo(edgeInfo)
}

func (s *Schema) addInverseAssocEdges(info *NodeDataInfo) {
	nodeData := info.NodeData
	edgeInfo := nodeData.EdgeInfo

	for _, assocEdge := range edgeInfo.Associations {
		if assocEdge.InverseEdge == nil {
			continue
		}
		configName := assocEdge.NodeInfo.EntConfigName
		inverseInfo, ok := s.Nodes[configName]
		if !ok {
			panic(fmt.Errorf("could not find the EntConfig codegen info for %s", configName))
		}

		inverseEdgeInfo := inverseInfo.NodeData.EdgeInfo

		assocEdge.AddInverseEdge(inverseEdgeInfo)
	}
}

// this seems like go only?
func (s *Schema) addNewConstsAndEdges(info *NodeDataInfo, edgeData *assocEdgeData) {
	nodeData := info.NodeData

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
		if assocEdge.IsInverseEdge {
			continue
		}
		constName := assocEdge.EdgeConst

		// check if there's an existing edge
		constValue := edgeData.edgeTypeOfEdge(constName)

		inverseEdge := assocEdge.InverseEdge

		var inverseConstName string
		var inverseConstValue string
		var newInverseEdge bool
		// is there an inverse?
		if inverseEdge != nil {
			inverseConstName, inverseConstValue, newInverseEdge = s.getInverseEdgeType(assocEdge, inverseEdge, edgeData)
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
				util.Die(newEdge.InverseEdgeType.Scan(inverseConstValue))
			}

			edgeData.addNewEdge(newEdge)
		}

		if newInverseEdge {
			ns := sql.NullString{}
			util.Die(ns.Scan(constValue))

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
				edgeData.updateInverseEdgeTypeForEdge(
					constName, inverseConstValue)
			}
		}

		s.addNewEdgeType(nodeData, constName, constValue, assocEdge)
	}
}

func (s *Schema) addActionFields(info *NodeDataInfo) {
	for _, a := range info.NodeData.ActionInfo.Actions {
		for _, f := range a.GetNonEntFields() {
			typ := f.FieldType
			t, ok := typ.(enttype.TSTypeWithActionFields)
			if !ok {
				continue
			}
			actionName := t.GetActionName()
			if actionName == "" {
				continue
			}

			config := info.NodeData.Node + "Config"
			for k, v := range s.Nodes {
				if k == config {
					continue
				}
				a2 := v.NodeData.ActionInfo.GetByName(actionName)
				if a2 == nil {
					continue
				}

				for _, f2 := range a2.GetFields() {
					if f2.EmbeddableInParentAction() {

						f3 := f2
						if action.IsRequiredField(a2, f2) {
							f3 = f2.Clone(field.Required())
						}
						a.AddCustomField(t, f3)
					}
				}

				for _, f2 := range a2.GetNonEntFields() {
					a.AddCustomNonEntField(t, f2)
				}

				a.AddCustomInterfaces(a2)

				break
			}

		}
	}
}

func (s *Schema) processConstraints(nodeData *NodeData) {
	// TODO errors instead of panicing

	// verify constraints are correct
	for _, constraint := range nodeData.Constraints {
		switch constraint.Type {
		case input.ForeignKeyConstraint:
			if constraint.ForeignKey == nil {
				panic("ForeignKey cannot be nil when type is ForeignKey")
			}
			if len(constraint.Columns) != len(constraint.ForeignKey.Columns) {
				panic("Foreign Key column length should be equal to the length of source columns")
			}

		case input.CheckConstraint:
			if constraint.Condition == "" {
				panic("Condition is required when constraint type is Check")
			}
		}

		if constraint.Condition != "" && constraint.Type != input.CheckConstraint {
			panic("Condition can only be set when constraint is check type")
		}
		if constraint.ForeignKey != nil && constraint.Type != input.ForeignKeyConstraint {
			panic("ForeignKey can only be set when constraint is ForeignKey type")
		}
	}

	tableName := nodeData.TableName

	var constraints []*input.Constraint
	for _, f := range nodeData.FieldInfo.Fields {
		cols := []string{f.FieldName}

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
			foreignInfo := s.Nodes[fkey.Config]
			if foreignInfo == nil {
				match := structNameRegex.FindStringSubmatch(fkey.Config)
				if len(match) != 2 {
					panic("invalid config name")
				}
				var ok bool
				enumInfo, ok = s.Enums[match[1]]
				if !ok {
					panic(fmt.Errorf("invalid foreign key table %s", fkey.Config))
				}
				if !enumInfo.LookupTableEnum() {
					panic(fmt.Sprintf("trying to set a foreign key to non-enum lookup table %s", match[1]))
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
				panic(fmt.Errorf("invalid foreign key field %s", fkey.Field))
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
	// doing this way so that it's consistent and easy to test
	// primary key
	// unique
	// fkey
	// user defined constraints
	constraints = append(constraints, nodeData.Constraints...)
	nodeData.Constraints = constraints
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

func (s *Schema) getInverseEdgeType(assocEdge *edge.AssociationEdge, inverseEdge *edge.InverseAssocEdge, edgeData *assocEdgeData) (string, string, bool) {
	inverseConstName := inverseEdge.EdgeConst

	inverseNodeDataInfo := s.Nodes[assocEdge.GetEntConfig().ConfigName]
	inverseNodeData := inverseNodeDataInfo.NodeData

	// check if there's an existing edge
	newEdge := !edgeData.existingEdge(inverseConstName)
	inverseConstValue := edgeData.edgeTypeOfEdge(inverseConstName)
	if inverseConstValue == "" {
		inverseConstValue = uuid.New().String()
	}

	// add inverse edge constant
	s.addNewEdgeType(inverseNodeData, inverseConstName, inverseConstValue, inverseEdge)

	return inverseConstName, inverseConstValue, newEdge
}

func (s *Schema) addNewEdgeType(nodeData *NodeData, constName, constValue string, edge edge.Edge) {
	// this is a map so easier to deal with duplicate consts if we run into them
	nodeData.addConstInfo(
		"ent.EdgeType",
		constName,
		&ConstInfo{
			ConstName:  constName,
			ConstValue: strconv.Quote(constValue),
			Comment: fmt.Sprintf(
				"%s is the edgeType for the %s to %s edge.",
				constName,
				nodeData.NodeInstance,
				strings.ToLower(edge.GetEdgeName()),
			),
		},
	)
}
