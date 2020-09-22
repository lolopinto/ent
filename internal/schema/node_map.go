package schema

import (
	"database/sql"
	"fmt"
	"go/ast"
	"go/token"
	"go/types"
	"regexp"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/depgraph"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/util"
	"golang.org/x/tools/go/packages"
)

// NodeDataInfo stores information related to a particular Node
type NodeDataInfo struct {
	NodeData      *NodeData
	ShouldCodegen bool
	depgraph      *depgraph.Depgraph
}

// NodeMapInfo holds all the information about the schema
// It's a mapping of "packageName" to NodeDataInfo objects
type NodeMapInfo map[string]*NodeDataInfo

func (m NodeMapInfo) addConfig(info *NodeDataInfo) {
	m[info.NodeData.EntConfigName] = info
}

func (m NodeMapInfo) getNodeDataFromGraphQLName(nodeName string) *NodeData {
	// just assume this for now. may not be correct in the long run
	configName := nodeName + "Config"

	nodeInfo, ok := m[configName]
	if !ok {
		return nil
	}
	return nodeInfo.NodeData
}

func (m NodeMapInfo) getActionFromGraphQLName(graphQLName string) action.Action {
	// TODO come up with a better mapping than this
	for _, info := range m {
		a := info.NodeData.GetActionByGraphQLName(graphQLName)
		if a != nil {
			return a
		}
	}
	return nil
}

var fileRegex = regexp.MustCompile(`(\w+)_config.go`)
var structNameRegex = regexp.MustCompile("([A-Za-z]+)Config")

func (m NodeMapInfo) parsePackage(s *Schema, pkg *packages.Package, specificConfigs ...string) (*assocEdgeData, error) {
	typeInfo := pkg.TypesInfo
	fset := pkg.Fset

	edgeData := m.loadExistingEdges()

	// first pass to parse the files and do as much as we can
	for idx, filePath := range pkg.GoFiles {
		match := fileRegex.FindStringSubmatch(filePath)
		if len(match) != 2 {
			return nil, fmt.Errorf("invalid filename match, expected length 2, have length %d", len(match))
		}
		// TODO rename packageName to something better it's contact_date in contact_date_config.go
		// TODO break this into concurrent jobs
		packageName := match[1]

		file := pkg.Syntax[idx]

		codegenInfo := m.parseFile(s, packageName, pkg, file, fset, specificConfigs, typeInfo, edgeData)
		m.addConfig(codegenInfo)
	}

	return m.processDepgrah(edgeData)
}

func (m NodeMapInfo) buildPostRunDepgraph(s *Schema, edgeData *assocEdgeData) *depgraph.Depgraph {
	// things that need all nodeDatas loaded
	g := &depgraph.Depgraph{}

	// queue up linking edges
	g.AddItem(
		// want all configs loaded for this.
		// Actions depends on this.
		// this adds the linked assoc edge to the field
		"LinkedEdges", func(info *NodeDataInfo) {
			m.addLinkedEdges(info)
		},
		"EdgesFromFields",
	)

	g.AddItem("EdgesFromFields", func(info *NodeDataInfo) {
		m.addEdgesFromFields(s, info)
	})

	// inverse edges also require everything to be loaded
	g.AddItem(
		"InverseEdges", func(info *NodeDataInfo) {
			m.addInverseAssocEdges(info)
		}, "EdgesFromFields")

	// add new consts and edges as a dependency of linked edges and inverse edges
	g.AddItem("ConstsAndEdges", func(info *NodeDataInfo) {
		m.addNewConstsAndEdges(info, edgeData)
	}, "LinkedEdges", "InverseEdges")

	return g
}

func (m NodeMapInfo) processDepgrah(edgeData *assocEdgeData) (*assocEdgeData, error) {
	// second pass to run things that depend on the entire data being loaded
	for _, info := range m {

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
	}
	return edgeData, nil
}

func (m NodeMapInfo) parseFiles(s *Schema, p schemaparser.Parser, specificConfigs ...string) (*assocEdgeData, error) {
	pkg := schemaparser.LoadPackageX(p)

	return m.parsePackage(s, pkg, specificConfigs...)
}

// TODO this is ugly but it's private...
func (m NodeMapInfo) parseFile(
	s *Schema,
	packageName string,
	pkg *packages.Package,
	file *ast.File,
	fset *token.FileSet,
	specificConfigs []string,
	typeInfo *types.Info,
	edgeData *assocEdgeData,
) *NodeDataInfo {

	// initial parsing
	g := &depgraph.Depgraph{}

	// things that need all nodeDatas loaded
	g2 := m.buildPostRunDepgraph(s, edgeData)

	var shouldCodegen bool

	var fieldInfoFields, fieldInfoMethod *field.FieldInfo

	ast.Inspect(file, func(node ast.Node) bool {
		if t, ok := node.(*ast.TypeSpec); ok && t.Type != nil {
			if s, ok := t.Type.(*ast.StructType); ok {

				// confirm the struct matches what we expect
				structName := t.Name.Name
				if !structNameRegex.MatchString(structName) {
					return true
				}

				// can eventually make this better but doing it this way to make the public API better
				if len(specificConfigs) == 0 ||
					(len(specificConfigs) == 1 && specificConfigs[0] == "") {
					shouldCodegen = true
				} else {
					for _, specificConfig := range specificConfigs {
						if specificConfig == structName {
							shouldCodegen = true
							break
						}
					}
				}

				// pass the structtype to get the config
				g.AddItem("ParseFields", func(nodeData *NodeData) {
					var err error
					fieldInfoFields, err = field.GetFieldInfoForStruct(s, typeInfo)
					util.Die(err)
				})
			}
		}

		if fn, ok := node.(*ast.FuncDecl); ok {
			switch fn.Name.Name {
			case "GetEdges":
				g.AddItem("GetEdges", func(nodeData *NodeData) {
					// TODO: validate edges. can only have one of each type etc
					var err error
					nodeData.EdgeInfo, err = edge.ParseEdgesFunc(packageName, fn)
					util.Die(err)

					m.addConstsFromEdgeGroups(nodeData)
				})

			case "GetFields":
				g.AddItem("GetFields", func(nodeData *NodeData) {
					var err error
					fieldInfoMethod, err = field.ParseFieldsFunc(pkg, fn)
					util.Die(err)
				})

			case "GetActions":
				// queue up to run later since it depends on parsed fieldInfo and edges
				g2.AddItem("GetActions", func(info *NodeDataInfo) {
					var err error
					nodeData := info.NodeData
					nodeData.ActionInfo, err = action.ParseActions(packageName, fn, nodeData.FieldInfo, nodeData.EdgeInfo, base.GoLang)
					util.Die(err)
				}, "LinkedEdges")

			case "GetTableName":
				g.AddItem("GetTableName", func(nodeData *NodeData) {
					nodeData.TableName = getTableName(fn)
				})

			case "HideFromGraphQL":
				g.AddItem("HideFromGraphQL", func(nodeData *NodeData) {
					nodeData.HideFromGraphQL = getHideFromGraphQL(fn)
				})
			}
		}
		return true
	})

	nodeData := newNodeData(packageName)

	// run the depgraph to get as much data as we can get now.
	g.Run(func(item interface{}) {
		execFn, ok := item.(func(*NodeData))
		if !ok {
			panic("invalid function passed")
		}
		execFn(nodeData)
	})

	if fieldInfoFields != nil && fieldInfoMethod != nil {
		panic("don't support both fields in struct and GetFields method")
	} else if fieldInfoFields != nil {
		nodeData.FieldInfo = fieldInfoFields
	} else if fieldInfoMethod != nil {
		nodeData.FieldInfo = fieldInfoMethod
	} else {
		panic("no fields why??")
	}

	return &NodeDataInfo{
		depgraph:      g2,
		NodeData:      nodeData,
		ShouldCodegen: shouldCodegen,
	}
}

// this adds the linked assoc edge to the field
func (m NodeMapInfo) addLinkedEdges(info *NodeDataInfo) {
	nodeData := info.NodeData
	fieldInfo := nodeData.FieldInfo
	edgeInfo := nodeData.EdgeInfo

	for _, e := range edgeInfo.FieldEdges {
		// no inverse edge name, nothing to do here
		if e.InverseEdgeName == "" {
			continue
		}
		f := fieldInfo.GetFieldByName(e.FieldName)
		if f == nil {
			panic(fmt.Errorf("invalid edge with Name %s", e.FieldName))
		}

		config := e.GetEntConfig()

		foreignInfo, ok := m[config.ConfigName]
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

func (m NodeMapInfo) addEdgesFromFields(s *Schema, info *NodeDataInfo) {
	nodeData := info.NodeData
	fieldInfo := nodeData.FieldInfo
	edgeInfo := nodeData.EdgeInfo

	for _, f := range fieldInfo.Fields {
		fkeyInfo := f.ForeignKeyInfo()
		if fkeyInfo != nil {
			m.addForeignKeyEdges(s, nodeData, fieldInfo, edgeInfo, f, fkeyInfo)
		}

		fieldEdgeInfo := f.FieldEdgeInfo()
		if fieldEdgeInfo != nil {
			m.addFieldEdge(edgeInfo, f)
		}
	}
}

func (m NodeMapInfo) addForeignKeyEdges(
	s *Schema,
	nodeData *NodeData,
	fieldInfo *field.FieldInfo,
	edgeInfo *edge.EdgeInfo,
	f *field.Field,
	fkeyInfo *field.ForeignKeyInfo,
) {
	foreignInfo, ok := m[fkeyInfo.Config]
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

func (m NodeMapInfo) addFieldEdge(
	edgeInfo *edge.EdgeInfo,
	f *field.Field,
) {
	// add a field edge on current config so we can load underlying user
	// and return it in GraphQL appropriately
	// this also flags that when we write data to this field, we write the inverse edge also
	// e.g. writing user_id field on an event will also write corresponding user -> events edge
	f.AddFieldEdgeToEdgeInfo(edgeInfo)
}

func (m NodeMapInfo) addInverseAssocEdges(info *NodeDataInfo) {
	nodeData := info.NodeData
	edgeInfo := nodeData.EdgeInfo

	for _, assocEdge := range edgeInfo.Associations {
		if assocEdge.InverseEdge == nil {
			continue
		}
		configName := assocEdge.NodeInfo.EntConfigName
		inverseInfo, ok := m[configName]
		if !ok {
			panic(fmt.Errorf("could not find the EntConfig codegen info for %s", configName))
		}

		inverseEdgeInfo := inverseInfo.NodeData.EdgeInfo

		assocEdge.AddInverseEdge(inverseEdgeInfo)
	}
}

func (m NodeMapInfo) addNewConstsAndEdges(info *NodeDataInfo, edgeData *assocEdgeData) {
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
			inverseConstName, inverseConstValue, newInverseEdge = m.getInverseEdgeType(assocEdge, inverseEdge, edgeData)
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

		m.addNewEdgeType(nodeData, constName, constValue, assocEdge)
	}
}

func getNameFromParts(nameParts []string) string {
	return strings.Join(nameParts, "_")
}

func (m NodeMapInfo) addConstsFromEdgeGroups(nodeData *NodeData) {
	for _, edgeGroup := range nodeData.EdgeInfo.AssocGroups {
		for edgeName := range edgeGroup.Edges {
			constName := edgeGroup.GetConstNameForEdgeName(edgeName)
			constValue := strings.ToLower(
				getNameFromParts(
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
			getNameFromParts(
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

func (m NodeMapInfo) getInverseEdgeType(assocEdge *edge.AssociationEdge, inverseEdge *edge.InverseAssocEdge, edgeData *assocEdgeData) (string, string, bool) {
	inverseConstName := inverseEdge.EdgeConst

	inverseNodeDataInfo := m[assocEdge.GetEntConfig().ConfigName]
	inverseNodeData := inverseNodeDataInfo.NodeData

	// check if there's an existing edge
	newEdge := !edgeData.existingEdge(inverseConstName)
	inverseConstValue := edgeData.edgeTypeOfEdge(inverseConstName)
	if inverseConstValue == "" {
		inverseConstValue = uuid.New().String()
	}

	// add inverse edge constant
	m.addNewEdgeType(inverseNodeData, inverseConstName, inverseConstValue, inverseEdge)

	return inverseConstName, inverseConstValue, newEdge
}

func (m NodeMapInfo) addNewEdgeType(nodeData *NodeData, constName, constValue string, edge edge.Edge) {
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

func (m NodeMapInfo) HideFromGraphQL(edge edge.Edge) bool {
	if edge.HideFromGraphQL() {
		return true
	}
	node := edge.GetNodeInfo().Node
	nodeData := m.getNodeDataFromGraphQLName(node)
	if nodeData == nil {
		return true
	}
	return nodeData.HideFromGraphQL
}

func (m NodeMapInfo) parseInputSchema(s *Schema, schema *input.Schema, lang base.Language) (*assocEdgeData, error) {
	// TODO right now this is also depending on config/database.yml
	// figure out if best place for this
	edgeData := m.loadExistingEdges()

	for nodeName, node := range schema.Nodes {
		// order of operations matters here
		// PickupLocation -> pickup_location
		packageName := strings.ToLower(strcase.ToSnake(nodeName))
		// user.ts, address.ts etc
		nodeData := newNodeData(packageName)

		// default nodeName goes from address -> addresses, user -> users etc
		if node.TableName == nil {
			nodeData.TableName = inflection.Plural(packageName)
		} else {
			nodeData.TableName = *node.TableName
		}
		var err error
		nodeData.FieldInfo, err = field.NewFieldInfoFromInputs(
			node.Fields,
			&field.Options{},
		)
		if err != nil {
			return nil, err
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
			return nil, err
		}

		nodeData.ActionInfo, err = action.ParseFromInput(packageName, node.Actions, nodeData.FieldInfo, nodeData.EdgeInfo, lang)
		if err != nil {
			return nil, err
		}

		nodeData.EnumTable = node.EnumTable
		nodeData.DBRows = node.DBRows

		// not in schema.Nodes...
		if node.EnumTable {
			s.addEnumFromInputNode(nodeName, node, nodeData)
			continue
		}

		m.addConfig(&NodeDataInfo{
			NodeData:      nodeData,
			depgraph:      m.buildPostRunDepgraph(s, edgeData),
			ShouldCodegen: true,
		})
	}

	return m.processDepgrah(edgeData)
}

// getTableName returns the name of the table the node should be stored in
func getTableName(fn *ast.FuncDecl) string {
	expr := astparser.GetLastReturnStmtExpr(fn)
	return astparser.GetUnderylingStringFromLiteralExpr(expr)
}

func getHideFromGraphQL(fn *ast.FuncDecl) bool {
	expr := astparser.GetLastReturnStmtExpr(fn)
	return astparser.GetBooleanValueFromExpr(expr)
}
