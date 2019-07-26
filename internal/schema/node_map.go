package schema

import (
	"fmt"
	"go/ast"
	"go/token"
	"go/types"
	"regexp"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/depgraph"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schemaparser"
	"golang.org/x/tools/go/packages"
)

// NodeDataInfo stores information related to a particular Node
type NodeDataInfo struct {
	NodeData                *NodeData
	ShouldCodegen           bool
	ShouldParseExistingFile bool
	depgraph                *depgraph.Depgraph
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

func (m NodeMapInfo) parsePackage(pkg *packages.Package, newEdges *[]*ent.AssocEdgeData, specificConfigs ...string) {
	r := regexp.MustCompile(`(\w+)_config.go`)

	typeInfo := pkg.TypesInfo
	fset := pkg.Fset

	// first pass to parse the files and do as much as we can
	for idx, filePath := range pkg.GoFiles {
		match := r.FindStringSubmatch(filePath)
		if len(match) != 2 {
			panic(fmt.Errorf("invalid filename match, expected length 2, have length %d", len(match)))
		}
		// TODO rename packageName to something better it's contact_date in contact_date_config.go
		// TODO break this into concurrent jobs
		packageName := match[1]

		file := pkg.Syntax[idx]

		codegenInfo := m.parseFile(packageName, file, fset, specificConfigs, typeInfo, newEdges)
		m.addConfig(codegenInfo)
	}

	// second pass to run things that depend on the entire data being loaded
	for _, info := range m {

		if info.depgraph == nil {
			continue
		}

		// probably make this concurrent in the future
		info.depgraph.Run(func(item interface{}) {
			execFn, ok := item.(func(*NodeDataInfo))
			if !ok {
				panic("invalid function passed")
			}
			execFn(info)
		})
	}
}

func (m NodeMapInfo) parseFiles(p schemaparser.Parser, newEdges *[]*ent.AssocEdgeData, specificConfigs ...string) {
	pkg := schemaparser.LoadPackage(p)

	m.parsePackage(pkg, newEdges, specificConfigs...)
}

// TODO this is ugly but it's private...
func (m NodeMapInfo) parseFile(
	packageName string,
	file *ast.File,
	fset *token.FileSet,
	specificConfigs []string,
	typeInfo *types.Info,
	newEdges *[]*ent.AssocEdgeData,
) *NodeDataInfo {
	//ast.Print(fset, node)
	//ast.NewObj(fset, "file")
	//fmt.Println("Struct:")

	// initial parsing
	g := &depgraph.Depgraph{}

	// things that need all nodeDatas loaded
	g2 := &depgraph.Depgraph{}

	var shouldCodegen bool

	ast.Inspect(file, func(node ast.Node) bool {

		// TODO verification
		// for now, we're assuming one struct which maps to what we want which isn't necessarily true
		if t, ok := node.(*ast.TypeSpec); ok && t.Type != nil {
			structName := t.Name.Name

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
		}

		// pass the structtype to get the config
		if s, ok := node.(*ast.StructType); ok {

			g.AddItem("ParseFields", func(nodeData *NodeData) {
				nodeData.FieldInfo = field.GetFieldInfoForStruct(s, fset, typeInfo)
			})
		}

		if fn, ok := node.(*ast.FuncDecl); ok {
			switch fn.Name.Name {
			case "GetEdges":
				g.AddItem("GetEdges", func(nodeData *NodeData) {
					// TODO: validate edges. can only have one of each type etc
					nodeData.EdgeInfo = edge.ParseEdgesFunc(packageName, fn)
				})

			case "GetActions":
				// queue up to run later since it depends on parsed fieldInfo and edges
				g2.AddItem("GetActions", func(info *NodeDataInfo) {
					nodeData := info.NodeData
					nodeData.ActionInfo = action.ParseActions(packageName, fn, nodeData.FieldInfo, nodeData.EdgeInfo)
				}, "LinkedEdges")

			case "GetTableName":
				g.AddItem("GetTableName", func(nodeData *NodeData) {
					nodeData.TableName = getTableName(fn)
				})
			}
		}
		return true
	})

	nodeData := &NodeData{
		PackageName: packageName,
		NodeInfo:    codegen.GetNodeInfo(packageName),
		EdgeInfo:    edge.NewEdgeInfo(),
	}
	// run the depgraph to get as much data as we can get now.
	g.Run(func(item interface{}) {
		execFn, ok := item.(func(*NodeData))
		if !ok {
			panic("invalid function passed")
		}
		execFn(nodeData)
	})

	// queue up linking edges
	g2.AddItem(
		// want all configs loaded for this.
		// Actions depends on this.
		"LinkedEdges", func(info *NodeDataInfo) {
			m.addLinkedEdges(info)
		},
	)

	// inverse edges also require everything to be loaded
	g2.AddItem(
		"InverseEdges", func(info *NodeDataInfo) {
			m.addInverseAssocEdges(info)
		})

	// add new consts and edges as a dependency of linked edges and inverse edges
	g2.AddItem("ConstsAndEdges", func(info *NodeDataInfo) {
		m.addNewConstsAndEdges(info, newEdges)
	}, "LinkedEdges", "InverseEdges")

	return &NodeDataInfo{
		depgraph:                g2,
		NodeData:                nodeData,
		ShouldCodegen:           shouldCodegen,
		ShouldParseExistingFile: nodeData.EdgeInfo.HasAssociationEdges(),
	}
}

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
		for _, fEdge := range foreignEdgeInfo.Associations {
			if fEdge.GetEdgeName() == e.InverseEdgeName {
				f.InverseEdge = fEdge
				break
			}
		}
	}
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

func (m NodeMapInfo) addNewConstsAndEdges(info *NodeDataInfo, newEdges *[]*ent.AssocEdgeData) {
	if !info.ShouldCodegen {
		return
	}

	nodeData := info.NodeData

	nodeGroup := ConstGroupInfo{
		ConstType: "ent.NodeType",
		Constants: []ConstInfo{ConstInfo{
			ConstName:  nodeData.NodeType,
			ConstValue: strconv.Quote(nodeData.NodeInstance),
			Comment: fmt.Sprintf(
				"%s is the node type for the %s object. Used to identify this node in edges and other places.",
				nodeData.NodeType,
				nodeData.Node,
			),
		}},
	}
	nodeData.ConstantGroups = append(nodeData.ConstantGroups, nodeGroup)

	// high level steps we need eventually
	// 1 parse each config file
	// 2 parse all config files (that's basically part of 1 but there's dependencies so we need to come back...)
	// 3 parse db/models/external data as needed
	// 4 validate all files/models/db state against each other to make sure they make sense
	// 5 one more step to get new things. e.g. generate new uuids etc
	// 6 generate new db schema
	// 7 write new files
	// 8 write edge config to db (this should really be a separate step since this needs to run in production every time)
	//	spew.Dump(info)
	if !info.ShouldParseExistingFile {
		return
	}
	existingConsts := parseExistingModelFile(nodeData)

	edgeConsts := existingConsts["ent.EdgeType"]
	if edgeConsts == nil {
		// no existing edge. initialize a map to do checks
		edgeConsts = make(map[string]string)
	}

	edgeGroup := ConstGroupInfo{
		ConstType: "ent.EdgeType",
	}

	for _, assocEdge := range nodeData.EdgeInfo.Associations {
		constName := assocEdge.EdgeConst

		// check if there's an existing edge
		constValue := edgeConsts[constName]

		// new edge
		if constValue == "" {
			constValue = uuid.New().String()
			// keep track of new edges that we need to do things with
			*newEdges = append(*newEdges, &ent.AssocEdgeData{
				EdgeType:      constValue,
				EdgeName:      constName,
				SymmetricEdge: false,
				EdgeTable:     GetNameForEdgeTable(nodeData, assocEdge),
			})
		}

		edgeGroup.Constants = append(edgeGroup.Constants, ConstInfo{
			ConstName:  constName,
			ConstValue: strconv.Quote(constValue),
			Comment: fmt.Sprintf(
				"%s is the edgeType for the %s to %s edge.",
				constName,
				nodeData.NodeInstance,
				strings.ToLower(assocEdge.GetEdgeName()),
			),
		})
	}
	nodeData.ConstantGroups = append(nodeData.ConstantGroups, edgeGroup)
}

// getTableName returns the name of the table the node should be stored in
func getTableName(fn *ast.FuncDecl) string {
	expr := astparser.GetLastReturnStmtExpr(fn)
	basicLit := astparser.GetExprToBasicLit(expr)
	return basicLit.Value
}
