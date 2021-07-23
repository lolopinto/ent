package schema

import (
	"fmt"
	"go/ast"
	"go/token"
	"go/types"
	"regexp"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/depgraph"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/util"
	"golang.org/x/tools/go/packages"
)

// these are used to parse oldschool golang schema
// basically deprecated but we still use it
func (s *Schema) parsePackage(pkg *packages.Package, specificConfigs ...string) (*assocEdgeData, error) {
	typeInfo := pkg.TypesInfo
	fset := pkg.Fset

	edgeData := s.loadExistingEdges()

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

		codegenInfo := s.parseFile(packageName, pkg, file, fset, specificConfigs, typeInfo, edgeData)
		if err := s.addConfig(codegenInfo); err != nil {
			return nil, err
		}
	}

	return s.processDepgrah(edgeData)
}

func (s *Schema) parseFiles(p schemaparser.Parser, specificConfigs ...string) (*assocEdgeData, error) {
	pkg := schemaparser.LoadPackageX(p)

	return s.parsePackage(pkg, specificConfigs...)
}

var fileRegex = regexp.MustCompile(`(\w+)_config.go`)
var structNameRegex = regexp.MustCompile("([A-Za-z]+)Config")

// TODO this is ugly but it's private...
func (s *Schema) parseFile(
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
	g2 := s.buildPostRunDepgraph(edgeData)

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

					s.addConstsFromEdgeGroups(nodeData)
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

// getTableName returns the name of the table the node should be stored in
func getTableName(fn *ast.FuncDecl) string {
	expr := astparser.GetLastReturnStmtExpr(fn)
	return astparser.GetUnderylingStringFromLiteralExpr(expr)
}

func getHideFromGraphQL(fn *ast.FuncDecl) bool {
	expr := astparser.GetLastReturnStmtExpr(fn)
	return astparser.GetBooleanValueFromExpr(expr)
}
