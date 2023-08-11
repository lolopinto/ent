package graphql

import (
	"fmt"
	"strings"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tsimport"
	"golang.org/x/exp/maps"
	"golang.org/x/exp/slices"
)

type canViewerDoContextInfo struct {
	// is this a child of a different node or a top level field somewhere else...
	parent *objectType
	Name   string
	Node   string
}

// in a node...
func getCanViewerDoObject(processor *codegen.Processor, result *objectType, nodeData *schema.NodeData, canViewerDoInfo map[string]action.Action) (*objectType, error) {
	canViewerDoName := fmt.Sprintf("%sCanViewerDo", nodeData.Node)

	ctx := &canViewerDoContextInfo{
		parent: result,
		Name:   canViewerDoName,
		Node:   nodeData.Node,
	}

	obj, err := getCanViewerDoObjectImpl(processor, ctx, canViewerDoInfo)
	if err != nil {
		return nil, err
	}

	// add field to node
	if err := result.addField(&fieldType{
		Name: codegenapi.GraphQLName(processor.Config, "canViewerDo"),
		FieldImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewLocalGraphQLEntImportPath(canViewerDoName),
		},
		HasResolveFunction: true,
		FunctionContents: []string{
			fmt.Sprintf("return new %s(context, obj);", canViewerDoName),
		},
	}); err != nil {
		return nil, err
	}

	return obj, nil
}

func getGlobalCanViewerDoObject(processor *codegen.Processor, canViewerDoInfo map[string]action.Action) (*objectType, error) {
	ctx := &canViewerDoContextInfo{
		Name: "GlobalCanViewerDo",
	}

	return getCanViewerDoObjectImpl(processor, ctx, canViewerDoInfo)
}

func getCanViewerDoObjectImpl(processor *codegen.Processor, ctx *canViewerDoContextInfo, canViewerDoInfo map[string]action.Action) (*objectType, error) {
	// add can viewer do objct
	canViewerDo := newObjectType(&objectType{
		Type:     fmt.Sprintf("%sType", ctx.Name),
		GQLType:  "GraphQLObjectType",
		Node:     ctx.Name,
		Exported: true,
		TSType:   ctx.Name,
	})
	keys := maps.Keys(canViewerDoInfo)
	slices.Sort(keys)

	for _, name := range keys {
		action := canViewerDoInfo[name]
		// TODO extra args based on action
		actionCanViewerDo := action.GetCanViewerDo()
		if actionCanViewerDo == nil {
			return nil, fmt.Errorf("action canViewerDo returned nil when it shouldn't be possible to")
		}

		gqlField := &fieldType{
			Name: name,
			FieldImports: []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				tsimport.NewGQLImportPath("GraphQLBoolean"),
			},
			HasAsyncModifier:   true,
			HasResolveFunction: true,
			FunctionContents: []string{
				fmt.Sprintf("return obj.%s(args);", name),
			},
		}

		for _, field := range getActionCanViewerDoFields(action, actionCanViewerDo) {

			arg := &fieldConfigArg{
				Name:    field.GetGraphQLName(),
				Imports: field.GetTSGraphQLTypeForFieldImports(true),
			}

			gqlField.Args = append(gqlField.Args, arg)
		}

		if err := canViewerDo.addField(gqlField); err != nil {
			return nil, err
		}
	}

	class, err := getNewCanViewerDoClass(processor, ctx, canViewerDoInfo)
	if err != nil {
		return nil, err
	}

	// add inline class in graphql that will call the actions
	canViewerDo.Classes = []*classType{class}

	return canViewerDo, nil
}

func getNewCanViewerDoClass(processor *codegen.Processor, ctx *canViewerDoContextInfo, canViewerDoInfo map[string]action.Action) (*classType, error) {
	viewerInfo := processor.Config.GetTemplatizedViewer()
	imports := []*tsimport.ImportPath{
		tsimport.NewEntImportPath("RequestContext"),
		viewerInfo.GetImportPath(),
		tsimport.NewEntImportPath("applyPrivacyPolicy"),
	}

	if ctx.Node != "" {
		imports = append(imports, tsimport.NewLocalEntImportPath(ctx.Node))
	}

	var methods []string
	keys := maps.Keys(canViewerDoInfo)
	slices.Sort(keys)
	for _, key := range keys {
		a := canViewerDoInfo[key]
		imports = append(imports, &tsimport.ImportPath{
			DefaultImport: true,
			ImportPath:    getActionPathFromAction(a),
			Import:        a.GetActionName(),
		})
		args := "args"
		fields := getActionCanViewerDoFields(a, a.GetCanViewerDo())
		if len(fields) > 0 {
			var changedFields []string
			for _, field := range fields {

				inputFieldLine, imps := processActionField(processor, a, field, "args")

				changedFields = append(changedFields, inputFieldLine)
				imports = append(imports, imps...)
			}

			// ...args is so we don't need @ts-ignore
			// we can be a little smarter here and only spell it out for a few fields
			// but this is fine for now
			args = fmt.Sprintf(`
			{
				...args,
				%s
			}
			`, strings.Join(changedFields, "\n"),
			)
		}

		var actionLine string
		if a.MutatingExistingObject() {
			if action.HasInput(a) {
				actionLine =
					fmt.Sprintf(`const action = %s.create(this.context.getViewer(), this.ent, %s);`,
						a.GetActionName(), args)
			} else {
				actionLine =
					fmt.Sprintf(`const action = %s.create(this.context.getViewer(), this.ent);`,
						a.GetActionName())
			}

		} else {
			actionLine =
				fmt.Sprintf(`const action = %s.create(this.context.getViewer(), %s);`,
					a.GetActionName(), args)
		}

		if ctx.parent != nil {

			methods = append(methods, fmt.Sprintf(`
		async %s(args: any): Promise<boolean> {
			%s
			return applyPrivacyPolicy(this.context.getViewer(), action.getPrivacyPolicy(), this.ent);
		}
		`, a.GetGraphQLName(), actionLine))
		} else {
			methods = append(methods, fmt.Sprintf(`
		async %s(args: any): Promise<boolean> {
			%s
			return applyPrivacyPolicy(this.context.getViewer(), action.getPrivacyPolicy(), undefined);
		}
		`, a.GetGraphQLName(), actionLine))
		}
	}

	var classContents string
	if ctx.parent != nil {
		classContents = fmt.Sprintf(`
	class %s {
		constructor(private context: RequestContext<%s>, private ent: %s) {}

		%s
	}
	`,
			ctx.Name,
			viewerInfo.GetImport(),
			ctx.Node,
			strings.Join(methods, "\n\n"),
		)
	} else {
		classContents = fmt.Sprintf(`
	class %s {
		constructor(private context: RequestContext<%s> ) {}

		%s
	}
	`,
			ctx.Name,
			viewerInfo.GetImport(),
			strings.Join(methods, "\n\n"),
		)
	}

	return &classType{
		Name:                 ctx.Name,
		Contents:             classContents,
		UnconditionalImports: imports,
	}, nil
}

func getActionCanViewerDoFields(a action.Action, actionCanViewerDo *input.CanViewerDo) []action.ActionField {
	var fields []action.ActionField
	if actionCanViewerDo.AddAllFields || len(actionCanViewerDo.InputFields) > 0 {
		m := map[string]bool{}
		for _, name := range actionCanViewerDo.InputFields {
			m[name] = true
		}

		for _, field := range a.GetGraphQLFields() {
			if actionCanViewerDo.AddAllFields || m[field.FieldName] {
				fields = append(fields, field)
			}
		}

		for _, field := range a.GetGraphQLNonEntFields() {
			if actionCanViewerDo.AddAllFields || m[field.GetFieldName()] {
				fields = append(fields, field)
			}
		}
	}
	return fields
}
