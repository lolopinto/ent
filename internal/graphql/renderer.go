package graphql

import "strings"

type renderable interface {
	getRenderer() renderer
}

type renderer interface {
	render() string
}

type elemRenderer struct {
	name       string
	interfaces []string
	fields     []*fieldType
}

func (r *elemRenderer) render() string {
	var sb strings.Builder

	sb.WriteString("type ")
	sb.WriteString(r.name)

	if len(r.interfaces) > 0 {
		sb.WriteString(" implements ")
		sb.WriteString(strings.Join(r.interfaces, " & "))

	}
	sb.WriteString(" {\n")
	for _, field := range r.fields {
		sb.WriteString(field.render())
	}
	sb.WriteString("}\n")

	return sb.String()
}

type enumRenderer struct {
	enum   string
	values []string
}

func (e *enumRenderer) render() string {
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

func (l listRenderer) render() string {
	var sb strings.Builder
	for i, elem := range l {
		if i != 0 {
			sb.WriteString("\n")
		}
		sb.WriteString(elem.render())
	}
	return sb.String()
}

type scalarRenderer struct {
	description, name string
}

func (s scalarRenderer) render() string {
	var sb strings.Builder
	if s.description != "" {
		renderDescription(&sb, s.description)
	}
	sb.WriteString("scalar ")
	sb.WriteString(s.name)
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
