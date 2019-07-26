package schema

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"strconv"

	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/util"
)

// parses an existing model file and returns information about current constants in model file
// It returns a mapping of type -> entValue -> constValue
// We'll probably eventually need to return a lot more information later but this is all we need right now
//
// "ent.NodeType" => {
//	"UserType" => "user",
// },
// "ent.EdgeType" => {
//	"UserToNoteEdge" => {uuid},
// },
// Right now, it only returns strings but it should eventually be map[string]map[string]interface{}
func parseExistingModelFile(nodeData *NodeData) map[string]map[string]string {
	fset := token.NewFileSet()
	filePath := getFilePathForModelFile(nodeData)

	_, err := os.Stat(filePath)
	// file doesn't exist. nothing to do here since we haven't generated this before
	if os.IsNotExist(err) {
		return nil
	}
	util.Die(err)

	file, err := parser.ParseFile(fset, filePath, nil, parser.AllErrors)
	util.Die(err)

	constMap := make(map[string]map[string]string)

	ast.Inspect(file, func(node ast.Node) bool {
		if decl, ok := node.(*ast.GenDecl); ok && decl.Tok == token.CONST {
			specs := decl.Specs

			for _, spec := range specs {
				valueSpec, ok := spec.(*ast.ValueSpec)
				if !ok {
					util.Die(fmt.Errorf("invalid spec"))
				}

				if len(valueSpec.Names) != 1 {
					util.Die(fmt.Errorf("expected 1 name for const declaration. got %d", len(valueSpec.Names)))
				}
				ident := valueSpec.Names[0]

				constName := ident.Name

				constKey := astparser.GetTypeNameFromExpr(valueSpec.Type)

				if len(valueSpec.Values) != 1 {
					util.Die(fmt.Errorf("expected 1 value for const declaration. got %d", len(valueSpec.Values)))
				}
				val := valueSpec.Values[0]
				basicLit := astparser.GetExprToBasicLit(val)
				constValue, err := strconv.Unquote(basicLit.Value)
				util.Die(err)

				if constMap[constKey] == nil {
					constMap[constKey] = make(map[string]string)
				}
				constMap[constKey][constName] = constValue
			}
		}

		return true
	})
	return constMap
}

// maps all the way down ugh
var cachedModelFileMap map[string]map[string]map[string]string

func getParsedExistingModelFile(nodeData *NodeData) map[string]map[string]string {
	if cachedModelFileMap == nil {
		cachedModelFileMap = make(map[string]map[string]map[string]string)
	}
	existingConsts := cachedModelFileMap[nodeData.PackageName]
	if existingConsts != nil {
		return existingConsts
	}

	existingConsts = parseExistingModelFile(nodeData)
	if existingConsts == nil {
		existingConsts = make(map[string]map[string]string)
	}
	// add to cache
	cachedModelFileMap[nodeData.PackageName] = existingConsts
	return existingConsts
}

// TODO this is duplicated in ent_codegen.go
func getFilePathForModelFile(nodeData *NodeData) string {
	return fmt.Sprintf("models/%s.go", nodeData.PackageName)
}
