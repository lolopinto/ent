package main

import (
	"bytes"
	"errors"
	"fmt"
	"go/ast"
	"go/format"
	"go/importer"
	"go/parser"
	"go/token"
	"go/types"
	"os"
	"path"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"text/template"

	"github.com/google/uuid"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/depgraph"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/util"

	// need to use dst because of this issue:
	// https://github.com/golang/go/issues/20744
	// goast doesn't do a keep job of keeping track of comments and it becomes
	// annoying to keep track of everything that's going on without this library
	// As of right now, AST is used for everything else but modifying the AST in place
	"github.com/dave/dst"
	"github.com/dave/dst/decorator"
)

type nodeTemplate struct {
	codegen.NodeInfo
	PackageName    string
	FieldInfo      *field.FieldInfo
	EdgeInfo       *edge.EdgeInfo
	TableName      string
	ConstantGroups []constGroupInfo
	ActionInfo     *action.ActionInfo
}

type constInfo struct {
	ConstName  string
	ConstValue string
	Comment    string
}

type constGroupInfo struct {
	ConstType string
	Constants []constInfo
}

func (nodeData *nodeTemplate) getTableName() string {
	tableName, err := strconv.Unquote(nodeData.TableName)
	util.Die(err)

	return tableName
}

// probably not needed?
func (nodeData *nodeTemplate) getQuotedTableName() string {
	return nodeData.TableName
}

func (nodeData *nodeTemplate) getFieldByName(fieldName string) *field.Field {
	return nodeData.FieldInfo.GetFieldByName(fieldName)
}

func (nodeData *nodeTemplate) getFieldEdgeByName(edgeName string) *edge.FieldEdge {
	return nodeData.EdgeInfo.GetFieldEdgeByName(edgeName)
}

func (nodeData *nodeTemplate) getForeignKeyEdgeByName(edgeName string) *edge.ForeignKeyEdge {
	return nodeData.EdgeInfo.GetForeignKeyEdgeByName(edgeName)
}

func (nodeData *nodeTemplate) getAssociationEdgeByName(edgeName string) *edge.AssociationEdge {
	return nodeData.EdgeInfo.GetAssociationEdgeByName(edgeName)
}

func (nodeData *nodeTemplate) getActionByGraphQLName(graphQLName string) action.Action {
	return nodeData.ActionInfo.GetByGraphQLName(graphQLName)
}

func shouldCodegenPackage(file *ast.File, specificConfig string) bool {
	// nothing to do here
	if specificConfig == "" {
		return true
	}

	var returnVal bool

	ast.Inspect(file, func(node ast.Node) bool {
		if t, ok := node.(*ast.TypeSpec); ok && t.Type != nil {
			structName := t.Name.Name

			returnVal = specificConfig == structName
			return false
		}
		return true
	})
	return returnVal
}

type codegenNodeTemplateInfo struct {
	nodeData                *nodeTemplate
	shouldCodegen           bool
	shouldParseExistingFile bool
	depgraph                *depgraph.Depgraph
}

// TODO come up with a better name here
// and for all related types
type codegenMapInfo map[string]*codegenNodeTemplateInfo

func newCodegenMapInfo() codegenMapInfo {
	allNodes := make(map[string]*codegenNodeTemplateInfo)
	return allNodes
}

func (m codegenMapInfo) addConfig(codegenInfo *codegenNodeTemplateInfo) {
	m[codegenInfo.nodeData.EntConfigName] = codegenInfo
}

func (m codegenMapInfo) getTemplateFromGraphQLName(nodeName string) *nodeTemplate {
	// just assume this for now. may not be correct in the long run
	configName := nodeName + "Config"

	nodeInfo, ok := m[configName]
	if !ok {
		return nil
	}
	return nodeInfo.nodeData
}

func (m codegenMapInfo) getActionFromGraphQLName(graphQLName string) action.Action {
	// TODO come up with a better mapping than this
	for _, info := range m {
		a := info.nodeData.getActionByGraphQLName(graphQLName)
		if a != nil {
			return a
		}
	}
	return nil
}

func (m codegenMapInfo) ParseFiles(p schemaParser) {
	fset, configMap, err := p.ParseFiles()
	util.Die(err)

	var files []*ast.File
	for _, file := range configMap {
		files = append(files, file)
	}
	info := types.Info{
		Types: make(map[ast.Expr]types.TypeAndValue),
		Defs:  make(map[*ast.Ident]types.Object),
		Uses:  make(map[*ast.Ident]types.Object),
	}
	conf := types.Config{
		Importer: importer.Default(),
	}
	// TODO
	_, err = conf.Check("models/configs", fset, files, &info)
	util.Die(err)

	// first pass to parse the files and do as much as we can
	for packageName, file := range configMap {

		// TODO rename packageName to something better it's contact_date in contact_date_config.go
		// TODO break this into concurrent jobs

		codegenInfo := m.parseFile(packageName, file, fset, specificConfig, &info)
		m.addConfig(codegenInfo)
	}

	// second pass to run things that depend on the entire data being loaded
	for _, info := range m {

		if info.depgraph == nil {
			continue
		}
		nodeData := info.nodeData

		// probably make this concurrent in the future
		info.depgraph.Run(func(item interface{}) {
			execFn, ok := item.(func(*nodeTemplate))
			if !ok {
				panic("invalid function passed")
			}
			execFn(nodeData)
		})
	}
}

func (m codegenMapInfo) parseFile(packageName string, file *ast.File, fset *token.FileSet, specificConfig string, info *types.Info) *codegenNodeTemplateInfo {
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

			g.AddItem("ParseFields", func(nodeData *nodeTemplate) {
				nodeData.FieldInfo = field.GetFieldInfoForStruct(s, fset, info)
			})
		}

		if fn, ok := node.(*ast.FuncDecl); ok {
			switch fn.Name.Name {
			case "GetEdges":
				g.AddItem("GetEdges", func(nodeData *nodeTemplate) {
					// TODO: validate edges. can only have one of each type etc
					nodeData.EdgeInfo = edge.ParseEdgesFunc(packageName, fn)
				})

			case "GetActions":
				// queue up to run later since it depends on parsed fieldInfo and edges
				g2.AddItem("GetActions", func(nodeData *nodeTemplate) {
					nodeData.ActionInfo = action.ParseActions(packageName, fn, nodeData.FieldInfo, nodeData.EdgeInfo)
				}, "LinkedEdges")

			case "GetTableName":
				g.AddItem("GetTableName", func(nodeData *nodeTemplate) {
					nodeData.TableName = getTableName(fn)
				})
			}
		}
		return true
	})

	nodeData := &nodeTemplate{
		PackageName: packageName,
		NodeInfo:    codegen.GetNodeInfo(packageName),
	}
	// run the depgraph to get as much data as we can get now.
	g.Run(func(item interface{}) {
		execFn, ok := item.(func(*nodeTemplate))
		if !ok {
			panic("invalid function passed")
		}
		execFn(nodeData)
	})

	// queue up linking edges
	g2.AddItem(
		// want all configs loaded for this.
		// Actions depends on this.
		"LinkedEdges", func(nodeData *nodeTemplate) {
			m.AddLinkedEdges(nodeData)
		},
	)

	return &codegenNodeTemplateInfo{
		depgraph:                g2,
		nodeData:                nodeData,
		shouldCodegen:           shouldCodegenPackage(file, specificConfig),
		shouldParseExistingFile: nodeData.EdgeInfo.HasAssociationEdges(),
	}
}

func (m codegenMapInfo) AddLinkedEdges(nodeData *nodeTemplate) {
	fieldInfo := nodeData.FieldInfo
	edgeInfo := nodeData.EdgeInfo

	for _, e := range edgeInfo.FieldEdges {
		f := fieldInfo.GetFieldByName(e.FieldName)
		if f == nil {
			panic(fmt.Errorf("invalid edge with Name %s", e.FieldName))
		}
		//f.LinkedEdge = e // TODO move to local...
		config := e.GetEntConfig()
		//		spew.Dump(config)

		foreignInfo, ok := m[config.ConfigName]
		if !ok {
			panic(fmt.Errorf("could not find the EntConfig codegen info for %s", config.ConfigName))
		}
		foreignEdgeInfo := foreignInfo.nodeData.EdgeInfo
		for _, fEdge := range foreignEdgeInfo.Associations {
			if fEdge.GetEdgeName() == "Notes" {
				// TODO don't hardcode this
				//spew.Dump(fEdge)
				f.InverseEdge = fEdge
				break
			}

		}
	}
}

type schemaParser interface {
	ParseFiles() (*token.FileSet, map[string]*ast.File, error)
}

type configSchemaParser struct {
	rootPath       string
	specificConfig string
	codePathInfo   *codePath
}

func (p *configSchemaParser) ParseFiles() (*token.FileSet, map[string]*ast.File, error) {
	fset := token.NewFileSet()

	r := regexp.MustCompile(`(\w+)_config.go`)

	filterFunc := func(fileInfo os.FileInfo) bool {
		match := r.FindStringSubmatch(fileInfo.Name())
		return len(match) == 2
	}

	pkgs, err := parser.ParseDir(fset, p.rootPath, filterFunc, parser.AllErrors)
	if err != nil {
		return fset, nil, err
	}
	if len(pkgs) != 1 {
		return fset, nil, fmt.Errorf("TODO ola figure out why there's more than one package in a folder")
	}

	// return map -> "packageName" -> *ast.File
	configMap := make(map[string]*ast.File)
	for key, file := range pkgs["configs"].Files {
		match := r.FindStringSubmatch(key)
		configMap[match[1]] = file
	}
	return fset, configMap, nil
}

type sourceSchemaParser struct {
	sources map[string]string
}

func (p *sourceSchemaParser) ParseFiles() (*token.FileSet, map[string]*ast.File, error) {
	fset := token.NewFileSet()
	configMap := make(map[string]*ast.File)
	for packageName, src := range p.sources {
		file, err := parser.ParseFile(fset, "", src, parser.AllErrors)
		if err != nil {
			return fset, nil, err
		}
		configMap[packageName] = file
	}
	return fset, configMap, nil
}

func parseFiles(p schemaParser) codegenMapInfo {
	allNodes := newCodegenMapInfo()

	allNodes.ParseFiles(p)
	return allNodes
}

func parseAllSchemaFiles(rootPath string, specificConfig string, codePathInfo *codePath) codegenMapInfo {
	p := &configSchemaParser{
		rootPath:       rootPath,
		specificConfig: specificConfig,
		codePathInfo:   codePathInfo,
	}

	return parseFiles(p)
}

// parseSchemasFromSource is mostly used by tests to test quick one-off scenarios
func parseSchemasFromSource(sources map[string]string, specificConfig string) codegenMapInfo {
	p := &sourceSchemaParser{
		sources: sources,
	}
	return parseFiles(p)
}

func generateConstsAndNewEdges(allNodes codegenMapInfo) []*ent.AssocEdgeData {
	var newEdges []*ent.AssocEdgeData

	for _, info := range allNodes {
		if !info.shouldCodegen {
			continue
		}

		nodeData := info.nodeData

		nodeGroup := constGroupInfo{
			ConstType: "ent.NodeType",
			Constants: []constInfo{constInfo{
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
		if !info.shouldParseExistingFile {
			continue
		}
		existingConsts := parseExistingModelFile(nodeData)

		edgeConsts := existingConsts["ent.EdgeType"]
		if edgeConsts == nil {
			// no existing edge. initialize a map to do checks
			edgeConsts = make(map[string]string)
		}

		edgeGroup := constGroupInfo{
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
				newEdges = append(newEdges, &ent.AssocEdgeData{
					EdgeType:      constValue,
					EdgeName:      constName,
					SymmetricEdge: false,
					EdgeTable:     getNameForEdgeTable(nodeData, assocEdge),
				})
			}

			edgeGroup.Constants = append(edgeGroup.Constants, constInfo{
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

	//spew.Dump(newEdges)
	return newEdges
}

type codegenData struct {
	allNodes codegenMapInfo
	codePath *codePath
	newEdges []*ent.AssocEdgeData
}

type codegenPlugin interface {
	pluginName() string
	processData(data *codegenData) error
}

func parseSchemasAndGenerate(rootPath string, specificConfig string, codePathInfo *codePath) {
	allNodes := parseAllSchemaFiles(rootPath, specificConfig, codePathInfo)

	if len(allNodes) == 0 {
		return
	}

	// generate consts and get new edges to be written to db.
	newEdges := generateConstsAndNewEdges(allNodes)

	//fmt.Println("schema", len(allNodes))

	// TOOD validate things here first.

	data := &codegenData{
		allNodes: allNodes,
		newEdges: newEdges,
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
		// new(dbPlugin),
		// new(assocEdgePlugin),
		new(entCodegenPlugin),
		//		new(graphqlPlugin),
	}

	for _, p := range plugins {
		p.processData(data)
	}
}

func getFilePathForModelFile(nodeData *nodeTemplate) string {
	return fmt.Sprintf("models/%s.go", nodeData.PackageName)
}

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
func parseExistingModelFile(nodeData *nodeTemplate) map[string]map[string]string {
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

type processingFn func(nodeData *nodeTemplate)

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

// getTableName returns the name of the table the node should be stored in
func getTableName(fn *ast.FuncDecl) string {
	expr := astparser.GetLastReturnStmtExpr(fn)
	basicLit := astparser.GetExprToBasicLit(expr)
	//fmt.Println("table name", basicLit.Value)
	return basicLit.Value
}

type nodeTemplateCodePath struct {
	NodeData *nodeTemplate
	CodePath *codePath
}

func writeModelFile(nodeData *nodeTemplate, codePathInfo *codePath) {
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
				"fTypeString": field.GetTypeInStructDefinition,
				"topLevelStructField": func(f *field.Field) bool {
					return f.TopLevelStructField()
				},
			},
		},
	)
}

func writeMutatorFile(nodeData *nodeTemplate, codePathInfo *codePath) {
	// this is not a real entmutator but this gets things working and
	// hopefully means no circular dependencies
	writeFile(
		&templatedBasedFileWriter{
			data: nodeTemplateCodePath{
				NodeData: nodeData,
				CodePath: codePathInfo,
			},
			pathToTemplate:    "templates/mutator.tmpl",
			templateName:      "mutator.tmpl",
			pathToFile:        fmt.Sprintf("models/%s/mutator/%s_mutator.go", nodeData.PackageName, nodeData.PackageName),
			createDirIfNeeded: true,
			formatSource:      true,
		},
	)
}

type actionTemplate struct {
	Action   action.Action
	CodePath *codePath
}

func writePrivacyFile(nodeData *nodeTemplate) {
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
