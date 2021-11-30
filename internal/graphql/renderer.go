package graphql

import (
	"fmt"
	"strings"
)

type renderable interface {
	getRenderer(s *gqlSchema) renderer
}

type renderer interface {
	render(s *gqlSchema) string
}

type elemRenderer struct {
	input       bool
	isInterface bool
	name        string
	description string
	interfaces  []string
	fields      []*fieldType
}

func (r *elemRenderer) render(s *gqlSchema) string {
	var sb strings.Builder

	if r.description != "" {
		renderDescription(&sb, r.description)
	}
	if r.input {
		sb.WriteString("input ")
	} else if r.isInterface {
		sb.WriteString("interface ")
	} else {
		sb.WriteString("type ")
	}
	sb.WriteString(r.name)

	if len(r.interfaces) > 0 {
		sb.WriteString(" implements ")
		sb.WriteString(strings.Join(r.interfaces, " & "))

	}
	sb.WriteString(" {\n")
	for _, field := range r.fields {
		sb.WriteString(field.render(s))
	}
	sb.WriteString("}\n")

	return sb.String()
}

type enumRenderer struct {
	enum   string
	values []string
}

func (e *enumRenderer) render(s *gqlSchema) string {
	var sb strings.Builder
	sb.WriteString("enum ")
	sb.WriteString(e.enum)
	sb.WriteString(" {\n")
	for _, val := range e.values {
		sb.WriteString("  ")
		sb.WriteString(val)
		sb.WriteString("\n")
	}
	sb.WriteString("}\n")
	return sb.String()
}

type listRenderer []renderer

func (l listRenderer) render(s *gqlSchema) string {
	var sb strings.Builder
	for i, elem := range l {
		if i != 0 {
			sb.WriteString("\n")
		}
		sb.WriteString(elem.render(s))
	}
	return sb.String()
}

type scalarRenderer struct {
	description, name, specifiedByUrl string
}

func (s scalarRenderer) render(_ *gqlSchema) string {
	var sb strings.Builder
	if s.description != "" {
		renderDescription(&sb, s.description)
	}
	sb.WriteString("scalar ")
	sb.WriteString(s.name)
	if s.specifiedByUrl != "" {
		sb.WriteString(fmt.Sprintf(" @specifiedBy(url: \"%s\")", s.specifiedByUrl))
	}
	sb.WriteString("\n")
	return sb.String()
}

func renderDescription(sb *strings.Builder, desc string) {
	sb.WriteString("\"")
	sb.WriteString("\"")
	sb.WriteString("\"")
	sb.WriteString(desc)
	sb.WriteString("\"")
	sb.WriteString("\"")
	sb.WriteString("\"")
	sb.WriteString("\n")
}

func getNodeInterfaceRenderer() renderer {
	return &elemRenderer{
		isInterface: true,
		name:        "Node",
		description: "node interface",
		fields: []*fieldType{
			{
				Name: "id",
				FieldImports: []*fileImport{
					getNativeGQLImportFor("GraphQLNonNull"),
					getNativeGQLImportFor("GraphQLID"),
				},
			},
		},
	}
}

func getConnectionRenderer() renderer {
	edge := &elemRenderer{
		isInterface: true,
		name:        "Edge",
		description: "edge interface",
		fields: []*fieldType{
			{
				Name: "node",
				FieldImports: []*fileImport{
					getNativeGQLImportFor("GraphQLNonNull"),
					{
						Type: "Node",
					},
				},
			},
			{
				Name: "cursor",
				FieldImports: []*fileImport{
					getNativeGQLImportFor("GraphQLNonNull"),
					getNativeGQLImportFor("GraphQLString"),
				},
			},
		},
	}

	connection := &elemRenderer{
		isInterface: true,
		name:        "Connection",
		description: "connection interface",
		fields: []*fieldType{
			{
				Name: "edges",
				FieldImports: []*fileImport{
					getNativeGQLImportFor("GraphQLNonNull"),
					getNativeGQLImportFor("GraphQLList"),
					getNativeGQLImportFor("GraphQLNonNull"),
					{
						Type: "Edge",
					},
				},
			},
			{
				Name: "nodes",
				FieldImports: []*fileImport{
					getNativeGQLImportFor("GraphQLNonNull"),
					getNativeGQLImportFor("GraphQLList"),
					getNativeGQLImportFor("GraphQLNonNull"),
					{
						Type: "Node",
					},
				},
			},
			{
				Name: "pageInfo",
				FieldImports: []*fileImport{
					getNativeGQLImportFor("GraphQLNonNull"),
					{
						Type: "PageInfo",
					},
				},
			},
		},
	}

	pageInfo := &elemRenderer{
		name: "PageInfo",
		fields: []*fieldType{
			{
				Name: "hasNextPage",
				FieldImports: []*fileImport{
					getNativeGQLImportFor("GraphQLNonNull"),
					getNativeGQLImportFor("GraphQLBoolean"),
				},
			},
			{
				Name: "hasPreviousPage",
				FieldImports: []*fileImport{
					getNativeGQLImportFor("GraphQLNonNull"),
					getNativeGQLImportFor("GraphQLBoolean"),
				},
			},
			{
				Name: "startCursor",
				FieldImports: []*fileImport{
					getNativeGQLImportFor("GraphQLNonNull"),
					getNativeGQLImportFor("GraphQLString"),
				},
			},
			{
				Name: "endCursor",
				FieldImports: []*fileImport{
					getNativeGQLImportFor("GraphQLNonNull"),
					getNativeGQLImportFor("GraphQLString"),
				},
			},
		},
	}

	return listRenderer{connection, edge, pageInfo}
}
