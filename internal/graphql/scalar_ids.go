package graphql

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/names"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/tsimport"
)

func scalarIDType(typ enttype.Type) (id, disabled bool) {
	switch t := typ.(type) {
	case *enttype.IDType:
		return true, t.DisableBase64Encode
	case *enttype.NullableIDType:
		return true, t.DisableBase64Encode
	case *enttype.ArrayListType:
		return scalarIDType(t.ElemType)
	case *enttype.NullableArrayListType:
		return scalarIDType(t.ElemType)
	case *enttype.ListWrapperType:
		return scalarIDType(t.Type)
	}
	return false, false
}

// Resolve the schema name to the same node type used by generated entities.
// Inference never exposes a hidden node. Explicit metadata can encode a saved
// reference to one, but still cannot load it or bypass the parent's privacy.
func scalarReferenceNodeType(processor *codegen.Processor, name, explicit string) (string, error) {
	schemaName := explicit
	if schemaName == "" {
		fieldName := names.ToTsFieldName(name)
		if strings.HasSuffix(fieldName, "Ids") {
			fieldName = strings.TrimSuffix(fieldName, "s")
		}
		prefix, ok := base.TranslateIDSuffix(fieldName)
		if !ok {
			return "", nil
		}
		schemaName = names.ToClassType(prefix)
	}
	node, err := processor.Schema.GetNodeDataForNode(schemaName)
	if err != nil {
		if explicit != "" {
			return "", fmt.Errorf("unknown graphQLIDType %q on %s", explicit, name)
		}
		return "", nil
	}
	if explicit == "" && node.HideFromGraphQL {
		return "", nil
	}
	return node.NodeInstance, nil
}

func fieldScalarReferenceNodeType(processor *codegen.Processor, f *field.Field) (string, error) {
	id, disabled := scalarIDType(f.GetFieldType())
	if f.GraphQLIDType() != "" && !id {
		return "", fmt.Errorf("graphQLIDType requires a UUID field: %s", f.FieldName)
	}
	if !id {
		return "", nil
	}
	if edge := f.FieldEdgeInfo(); edge != nil && edge.Polymorphic != nil {
		if f.GraphQLIDType() != "" {
			return "", fmt.Errorf("graphQLIDType cannot specify a fixed type for polymorphic field %s", f.FieldName)
		}
		return "", nil
	}
	nodeType, err := scalarReferenceNodeType(processor, f.FieldName, f.GraphQLIDType())
	if err != nil {
		return "", err
	}
	if !processor.Config.Base64EncodeIDs() || disabled {
		return "", nil
	}
	return nodeType, nil
}

func setScalarIDResolver(f *fieldType, value, nodeType string) {
	f.HasResolveFunction = true
	f.ResolverMethod = ""
	f.FunctionContents = []string{fmt.Sprintf("return encodeGQLIDReference(%s, %s);", value, strconv.Quote(nodeType))}
	f.ExtraImports = append(f.ExtraImports, tsimport.NewEntGraphQLImportPath("encodeGQLIDReference"))
}
