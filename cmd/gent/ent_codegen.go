package main

import (
	"bytes"
	"errors"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"path"
	"strconv"

	"runtime"
	"strings"
	"text/template"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/util"

	// need to use dst because of this issue:
	// https://github.com/golang/go/issues/20744
	// goast doesn't do a keep job of keeping track of comments and it becomes
	// annoying to keep track of everything that's going on without this library
	// As of right now, AST is used for everything else but modifying the AST in place
	"github.com/dave/dst"
	"github.com/dave/dst/decorator"
)

func parseAllSchemaFiles(rootPath string, specificConfigs ...string) *schema.Schema {
	p := &schemaparser.ConfigSchemaParser{
		RootPath: rootPath,
	}

	return schema.Parse(p, specificConfigs...)
}

// parseSchemasFromSource is mostly used by tests to test quick one-off scenarios
func parseSchemasFromSource(sources map[string]string, specificConfigs ...string) *schema.Schema {
	p := &schemaparser.SourceSchemaParser{
		Sources: sources,
	}
	return schema.Parse(p, specificConfigs...)
}

type codegenData struct {
	schema   *schema.Schema
	codePath *codegen.CodePath
}

type codegenPlugin interface {
	pluginName() string
	processData(data *codegenData) error
}

func parseSchemasAndGenerate(rootPath string, specificConfig string, codePathInfo *codegen.CodePath) {
	schema := parseAllSchemaFiles(rootPath, specificConfig)

	if len(schema.Nodes) == 0 {
		return
	}

	// TOOD validate things here first.

	data := &codegenData{
		schema:   schema,
		codePath: codePathInfo,
	}

	// TODO refactor these from being called sequentially to something that can be called in parallel
	// Right now, they're being called sequentially
	// I don't see any reason why some can't be done in parrallel
	// 0/ generate consts. has to block everything (not a plugin could be?) however blocking
	// 1/ db
	// 2/ create new nodes (blocked by db) since assoc_edge_config table may not exist yet
	// 3/ model files. should be able to run on its own
	// 4/ graphql should be able to run on its own

	plugins := []codegenPlugin{
		new(dbPlugin),
		new(entCodegenPlugin),
		new(graphqlPlugin),
	}

	for _, p := range plugins {
		p.processData(data)
	}
}

func getFilePathForModelFile(nodeData *schema.NodeData) string {
	return fmt.Sprintf("models/%s.go", nodeData.PackageName)
}

// astConfig returns the config of a file before it was re-generated to keep
// useful information that'll be needed when we need to regenerate the manual sections
// later
type astConfig struct {
	fset *token.FileSet //stores the fset

	commentMap map[string]*commentGroupPair
	// stores the expressions in the method we care about...
	exprMap map[string][]ast.Expr
	file    *ast.File
}

// get the manual expression in the function
// this assumes the first and last are automated
// needs to eventually handle the cases where that's not true
// other places also assume this e.g. in rewriteAstWithConfig
func (config *astConfig) getManualExprs(fnName string) []ast.Expr {
	allExprs := config.exprMap[fnName]
	// returns a slice of the exprs excluding the first and last elements
	// when we make this more complicated, need to compare against position of MANUAL comments as needed
	return allExprs[1 : len(allExprs)-1]
}

// getLastExpr returns the last expression in the function for the given function name
func (config *astConfig) getLastExpr(fnName string) ast.Expr {
	allExprs := config.exprMap[fnName]
	return astparser.GetLastExpr(allExprs)
}

// this is for keeping track of commentgroup pairs that have a BEGIN of...
// and END of... where manual declarations would be put in a function or something
type commentGroupPair struct {
	BeginCommentGroup *ast.CommentGroup
	EndCommentGroup   *ast.CommentGroup
}

// parseFileForManualCode checks the path of the file we're about to generate,
// checks to see if it exists and then annotates it with the information
// needed to regenerate the MANUAL sections later
func parseFileForManualCode(path string) *astConfig {
	_, err := os.Stat(path)
	// file doesn't exist or can't read file, nothing to do here...
	if err != nil {
		return nil
	}
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, path, nil, parser.ParseComments)
	util.Die(err)

	comments := []*commentGroupPair{}

	var begin *ast.CommentGroup

	for idx := 0; idx < len(file.Comments); idx++ {
		cg := file.Comments[idx]
		//fmt.Println(cg.Text())

		if begin == nil {
			if strings.HasPrefix(cg.Text(), "BEGIN MANUAL SECTION") {
				begin = cg
			}
		} else {
			// this doesn't work when this has something in front of it...
			splits := strings.Split(cg.Text(), "\n")
			for _, s := range splits {
				if strings.HasPrefix(s, "END MANUAL SECTION") {
					comments = append(comments, &commentGroupPair{
						BeginCommentGroup: begin,
						EndCommentGroup:   cg,
					})
					begin = nil
				}
			}
		}
	}

	// nothing to do here since no manual thing in between that we care about
	if len(comments) == 0 {
		return nil
	}

	commentMap := make(map[string]*commentGroupPair)
	exprMap := make(map[string][]ast.Expr)

	//comments := []*ast.Comment{}
	ast.Inspect(file, func(node ast.Node) bool {
		//spew.Dump(node)
		// collect comments
		if fn, ok := node.(*ast.FuncDecl); ok {
			// we only care about the Rules method for now but we can make this work for other methods in the future...

			fnName := fn.Name.Name

			if fnName == "Rules" {

				for _, cgPair := range comments {
					begin := cgPair.BeginCommentGroup.List[0]
					end := cgPair.EndCommentGroup.List[0]

					// the comments map to what we're looking for
					if !(fn.Pos() < begin.Pos() && end.Pos() < fn.End()) {
						continue
					}
					//fmt.Println("yay!...")

					commentMap[fnName] = cgPair
					//exprMap[fnName] = manualStmts
					// store the entire elts in func...
					exprMap[fnName] = astparser.GetEltsInFunc(fn)
				}
			}
		}

		return true
	})

	return &astConfig{
		fset:       fset,
		commentMap: commentMap,
		exprMap:    exprMap,
		file:       file,
	}
}

// rewriteAstWithConfig takes the ast that was generated and rewrites it
// so that we respect the user-generated MANUAL code
func rewriteAstWithConfig(config *astConfig, b []byte) []byte {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "", b, parser.ParseComments)
	util.Die(err)

	comments := []*ast.CommentGroup{}

	// get the commentgroups in this file that map to what we care about...
	for _, cg := range file.Comments {
		// in the new AST we need a comment group with exactly 2 items
		// the BEGIN and END
		if len(cg.List) != 2 {
			continue
		}
		// not the right cg so bounce
		if !strings.HasPrefix(cg.Text(), "BEGIN MANUAL SECTION") {
			continue
		}
		comments = append(comments, cg)
	}

	// something weird happened, bad...
	if len(comments) == 0 {
		util.Die(errors.New("did not find comments to be rewritten in generated file"))
	}

	// create decorator for file before it was changed
	oldDec := decorator.NewDecorator(config.fset)
	_, err = oldDec.DecorateFile(config.file)
	util.Die(err)

	// Create a new decorator, which will track the mapping between ast and dst nodes
	dec := decorator.NewDecorator(fset)
	dstFile, err := dec.DecorateFile(file)
	util.Die(err)

	// inspect the methods we care about
	dst.Inspect(dstFile, func(node dst.Node) bool {
		fn, ok := node.(*dst.FuncDecl)
		if !ok {
			return true
		}

		fnName := fn.Name.Name
		// same as in parseFileForManualCode. only care about Rules method for now...
		// should eventually make sure this works for everything.
		if fnName != "Rules" {
			return true
		}

		manualExprs := config.getManualExprs(fnName)

		// take the DST func, convert to DST so we can use helper methods we have here
		// and then convert back to DST so that we can
		astFunc := dec.Ast.Nodes[fn].(*ast.FuncDecl)
		compositeLit := astparser.GetCompositeStmtsInFunc(astFunc)

		compositeLitDst := dec.Dst.Nodes[compositeLit].(*dst.CompositeLit)
		elts := compositeLitDst.Elts

		manualDstExprs := make([]dst.Expr, len(manualExprs))
		for idx, stmt := range manualExprs {
			expr := oldDec.Dst.Nodes[stmt].(dst.Expr)
			//spew.Dump(expr, ok)
			// take each of the manual stmts from the old file and add them to the new elts
			clonedExpr := dst.Clone(expr).(dst.Expr)
			manualDstExprs[idx] = clonedExpr
		}

		// append list at position
		// TODO create a library for helpers like these...
		elts = append(elts[:1], append(manualDstExprs, elts[1:]...)...)
		compositeLitDst.Elts = elts

		// ensure that whatever comments were in the last node of the manual
		// section are copied over to the new last node.
		// Does a few things of note:
		// * removes duplicate BEGIN MANUAL SECTION which was	associated with last node
		// when there were only 2 statements before the manual sections were considered
		// * ensures that any comments at the end of the manual section that the developer
		// had written were remembered.
		lastExpr := config.getLastExpr(fnName)
		lastDstExpr := oldDec.Dst.Nodes[lastExpr].(dst.Expr)

		lastElt := elts[len(elts)-1]
		//spew.Dump("lastElt", lastElt.Decorations())
		// replace the string with what was in the manual version...
		lastElt.Decorations().Start.Replace(lastDstExpr.Decorations().Start.All()...)

		return true
	})

	//decorator.Print(dstFile)
	restoredFset, restoredFile, err := decorator.RestoreFile(dstFile)

	var buf bytes.Buffer
	format.Node(&buf, restoredFset, restoredFile)
	util.Die(err)

	return buf.Bytes()
}

type nodeTemplateCodePath struct {
	NodeData *schema.NodeData
	CodePath *codegen.CodePath
}

func writeModelFile(nodeData *schema.NodeData, codePathInfo *codegen.CodePath) {
	writeFile(
		&templatedBasedFileWriter{
			data: nodeTemplateCodePath{
				NodeData: nodeData,
				CodePath: codePathInfo,
			},
			pathToTemplate: "templates/node.tmpl",
			templateName:   "node.tmpl",
			pathToFile:     getFilePathForModelFile(nodeData),
			formatSource:   true,
			funcMap: template.FuncMap{
				"fTypeString": field.GetNilableTypeInStructDefinition,
				"quoteStr":    strconv.Quote,
			},
		},
	)
}

type actionTemplate struct {
	Action   action.Action
	CodePath *codegen.CodePath
}

func writePrivacyFile(nodeData *schema.NodeData) {
	pathToFile := fmt.Sprintf("models/%s_privacy.go", nodeData.PackageName)

	writeFile(
		&templatedBasedFileWriter{
			data:               nodeData,
			pathToTemplate:     "templates/privacy.tmpl",
			templateName:       "privacy.tmpl",
			pathToFile:         pathToFile,
			checkForManualCode: true,
			formatSource:       true,
		},
	)
}

func getAbsolutePath(filePath string) string {
	_, filename, _, ok := runtime.Caller(1)
	if !ok {
		util.Die(errors.New("could not get path of template file"))
	}
	return path.Join(path.Dir(filename), filePath)
}
