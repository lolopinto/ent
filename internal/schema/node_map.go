package schema

import (
	"fmt"
	"go/ast"
	"go/token"
	"go/types"
	"regexp"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/depgraph"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schemaparser"
	"golang.org/x/tools/go/packages"
)

// Given a schema file parser, Parse parses the schema to return the completely 
// parsed schema
func Parse(p schemaparser.Parser, specificConfigs... string) NodeMapInfo {
	nodes := newSchema()

	nodes.ParseFiles(p, specificConfigs...)

	return nodes
}

func newSchema() NodeMapInfo {
	nodes := make(map[string]*NodeDataInfo)
	return nodes
}

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

func (m NodeMapInfo) GetNodeDataFromGraphQLName(nodeName string) *NodeData {
	// just assume this for now. may not be correct in the long run
	configName := nodeName + "Config"

	nodeInfo, ok := m[configName]
	if !ok {
		return nil
	}
	return nodeInfo.NodeData
}

func (m NodeMapInfo) GetActionFromGraphQLName(graphQLName string) action.Action {
	// TODO come up with a better mapping than this
	for _, info := range m {
		a := info.NodeData.GetActionByGraphQLName(graphQLName)
		if a != nil {
			return a
		}
	}
	return nil
}

func (m NodeMapInfo) ParsePackage(pkg *packages.Package, specificConfigs ...string) {
	r := regexp.MustCompile(`(\w+)_config.go`)

	info := pkg.TypesInfo
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

		codegenInfo := m.parseFile(packageName, file, fset, specificConfigs, info)
		m.addConfig(codegenInfo)
	}

	// second pass to run things that depend on the entire data being loaded
	for _, info := range m {

		if info.depgraph == nil {
			continue
		}
		nodeData := info.NodeData

		// probably make this concurrent in the future
		info.depgraph.Run(func(item interface{}) {
			execFn, ok := item.(func(*NodeData))
			if !ok {
				panic("invalid function passed")
			}
			execFn(nodeData)
		})
	}
}

func (m NodeMapInfo) ParseFiles(p schemaparser.Parser, specificConfigs ...string) {
	pkg := schemaparser.LoadPackage(p)

	m.ParsePackage(pkg, specificConfigs...)
}

func (m NodeMapInfo) parseFile(packageName string, file *ast.File, fset *token.FileSet, specificConfigs []string, info *types.Info) *NodeDataInfo {
	//ast.Print(fset, node)
	//ast.NewObj(fset, "file")
	//fmt.Println("Struct:")

	// initial parsing
	g := &depgraph.Depgraph{}

	// things that need the entire nodeData loaded
	g2 := &depgraph.Depgraph{}

	ast.Inspect(file, func(node ast.Node) bool {
		// get struct
		// TODO get the name from *ast.TypeSpec to verify a few things
		// for now, we're assuming one struct which maps to what we want which isn't necessarily true

		// pass the structtype to get the config
		if s, ok := node.(*ast.StructType); ok {

			g.AddItem("ParseFields", func(nodeData *NodeData) {
				nodeData.FieldInfo = field.GetFieldInfoForStruct(s, fset, info)
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
				g2.AddItem("GetActions", func(nodeData *NodeData) {
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
		EdgeInfo:    &edge.EdgeInfo{}, // default in case no edges
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
		"LinkedEdges", func(nodeData *NodeData) {
			m.AddLinkedEdges(nodeData)
		},
	)

	return &NodeDataInfo{
		depgraph:                g2,
		NodeData:                nodeData,
		ShouldCodegen:           shouldCodegenPackage(file, specificConfigs),
		ShouldParseExistingFile: nodeData.EdgeInfo.HasAssociationEdges(),
	}
}

func (m NodeMapInfo) AddLinkedEdges(nodeData *NodeData) {
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

// getTableName returns the name of the table the node should be stored in
func getTableName(fn *ast.FuncDecl) string {
	expr := astparser.GetLastReturnStmtExpr(fn)
	basicLit := astparser.GetExprToBasicLit(expr)
	//fmt.Println("table name", basicLit.Value)
	return basicLit.Value
}

func shouldCodegenPackage(file *ast.File, specificConfigs []string) bool {
	if len(specificConfigs) == 0 {
		// nothing to do here
		return true
	}

	returnVal := false

	ast.Inspect(file, func(node ast.Node) bool {
		if t, ok := node.(*ast.TypeSpec); ok && t.Type != nil {
			structName := t.Name.Name

			// can eventually make this better but doing it this way to make the outward API better
			for _, specificConfig := range specificConfigs {
				if specificConfig == structName {
					returnVal = true
					break
				}
			}
			return false
		}
		return true
	})
	return returnVal
}
