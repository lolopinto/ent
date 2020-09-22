package schema

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schemaparser"
	"golang.org/x/tools/go/packages"
)

// Schema is the representation of the parsed schema. Has everything needed to
type Schema struct {
	Nodes         NodeMapInfo
	edges         map[string]*ent.AssocEdgeData
	newEdges      []*ent.AssocEdgeData
	edgesToUpdate []*ent.AssocEdgeData
	// unlike Nodes, the key is "EnumName" instead of "EnumNameConfig"
	// confusing but gets us closer to what we want
	Enums map[string]*EnumInfo
}

func (s *Schema) addEnum(enumType enttype.EnumeratedType, nodeData *NodeData) {
	s.addEnumFrom(
		enumType.GetTSName(),
		enumType.GetGraphQLName(),
		enumType.GetTSType(),
		enumType.GetEnumValues(),
		nodeData,
		nil,
	)
}

func (s *Schema) addEnumFromInputNode(nodeName string, node *input.Node, nodeData *NodeData) error {
	if !node.EnumTable || len(node.DBRows) == 0 {
		return errors.New("Can't create enum from NodeData that's not an enum table or has no rows")
	}

	var pkeyFields []*input.Field

	for _, field := range node.Fields {
		if field.PrimaryKey {
			pkeyFields = append(pkeyFields, field)
		}
	}
	if len(pkeyFields) != 1 {
		return errors.New("need exactly 1 primary key for ")
	}
	field := pkeyFields[0]
	fieldName := field.Name
	storageKey := field.StorageKey
	values := make([]string, len(node.DBRows))

	addValue := func(row map[string]interface{}, key string, idx int) (bool, error) {
		if key == "" {
			return false, nil
		}
		fieldNameValue, ok := row[fieldName]
		if ok {
			str, ok := fieldNameValue.(string)
			if !ok {
				return false, fmt.Errorf("value of field %s should be a string to be an enum", fieldName)
			}
			values[idx] = str
			return true, nil
		}
		return false, nil
	}
	for idx, row := range node.DBRows {
		added, err := addValue(row, fieldName, idx)
		if err != nil {
			return err
		}
		if !added {
			added, err := addValue(row, storageKey, idx)
			if err != nil {
				return err
			}
			if !added {
				return fmt.Errorf("couldn't find key %s or %s in row", fieldName, storageKey)
			}
		}
	}

	s.addEnumFrom(
		nodeName,
		nodeName,
		fmt.Sprintf("%s!", nodeName),
		values,
		nodeData,
		node,
	)
	return nil
}

func (s *Schema) addEnumFrom(tsName, gqlName, gqlType string, enumValues []string, nodeData *NodeData, inputNode *input.Node) {
	// first create EnumInfo...

	//	values := enumType.GetEnumValues()
	tsVals := make([]enum.Data, len(enumValues))
	gqlVals := make([]enum.Data, len(enumValues))
	for i, val := range enumValues {
		allUpper := true
		for _, char := range val {
			if !unicode.IsLetter(char) {
				continue
			}
			if !unicode.IsUpper(char) {
				allUpper = false
				break
			}
		}
		// keep all caps constants as all caps constants
		tsName := ""
		if allUpper {
			tsName = val
		} else {
			tsName = strcase.ToCamel(val)
		}
		gqlVals[i] = enum.Data{
			Name: strings.ToUpper(val),
			// norm for graphql enums is all caps
			Value: strconv.Quote(strings.ToUpper(val)),
		}
		tsVals[i] = enum.Data{
			Name: tsName,
			// value is actually what's put there for now
			// TODO we need to figure out if there's a standard here
			// or a way to have keys: values for the generated enums
			Value: strconv.Quote(val),
		}
	}

	gqlEnum := enum.GQLEnum{
		Name:   gqlName,
		Type:   gqlType,
		Values: gqlVals,
	}

	tsEnum := enum.Enum{
		Name:   tsName,
		Values: tsVals,
		// not the best way to determine this but works for now
		Imported: len(tsVals) == 0,
	}

	info := &EnumInfo{
		Enum:      tsEnum,
		GQLEnum:   gqlEnum,
		NodeData:  nodeData,
		InputNode: inputNode,
	}
	s.Enums[nodeData.Node] = info
	nodeData.addEnum(info)
}

// Given a schema file parser, Parse parses the schema to return the completely
// parsed schema
func Parse(p schemaparser.Parser, specificConfigs ...string) (*Schema, error) {
	return parse(func(s *Schema) (*assocEdgeData, error) {
		return s.Nodes.parseFiles(s, p, specificConfigs...)
	})
}

func ParsePackage(pkg *packages.Package, specificConfigs ...string) (*Schema, error) {
	return parse(func(s *Schema) (*assocEdgeData, error) {
		return s.Nodes.parsePackage(s, pkg, specificConfigs...)
	})
}

// ParseFromInputSchema takes the schema that has been parsed from whatever input source
// and provides the schema we have that's checked and conforms to everything we expect
func ParseFromInputSchema(schema *input.Schema, lang base.Language) (*Schema, error) {
	return parse(func(s *Schema) (*assocEdgeData, error) {
		return s.Nodes.parseInputSchema(s, schema, lang)
	})
}

func parse(parseFn func(*Schema) (*assocEdgeData, error)) (*Schema, error) {
	s := &Schema{}
	s.init()
	edgeData, err := parseFn(s)
	if err != nil {
		return nil, err
	}
	s.edges = edgeData.edgeMap
	s.newEdges = edgeData.newEdges
	s.edgesToUpdate = edgeData.edgesToUpdate
	return s, nil
}

func (s *Schema) init() {
	s.Nodes = make(map[string]*NodeDataInfo)
	s.Enums = make(map[string]*EnumInfo)
}

func (s *Schema) GetNodeDataFromGraphQLName(nodeName string) *NodeData {
	return s.Nodes.getNodeDataFromGraphQLName(nodeName)
}

func (s *Schema) GetActionFromGraphQLName(graphQLName string) action.Action {
	return s.Nodes.getActionFromGraphQLName(graphQLName)
}

// below really only exist for tests but yolo
func (s *Schema) GetAssocEdgeByName(entConfig, edgeName string) (*edge.AssociationEdge, error) {
	info := s.Nodes[entConfig]
	if info == nil {
		return nil, errors.New("invalid EntConfig passed to getAssocEdgeByName")
	}
	ret := info.NodeData.GetAssociationEdgeByName(edgeName)
	if ret == nil {
		return nil, errors.New("error getting edge")
	}
	return ret, nil
}

func (s *Schema) GetFieldByName(entConfig, fieldName string) (*field.Field, error) {
	info := s.Nodes[entConfig]
	if info == nil {
		return nil, errors.New("invalid EntConfig passed to getFieldByName")
	}
	ret := info.NodeData.GetFieldByName(fieldName)
	if ret == nil {
		return nil, errors.New("error getting field")
	}
	return ret, nil
}

// GetNewEdges only exists for testing purposes to differentiate between existing and new edges
func (s *Schema) GetNewEdges() []*ent.AssocEdgeData {
	return s.newEdges
}

// GetEdges returns all the edges in the schema
func (s *Schema) GetEdges() map[string]*ent.AssocEdgeData {
	return s.edges
}

// GetEdgesToUpdate returns edges in the schema that have changed which need to be updated
func (s *Schema) GetEdgesToUpdate() []*ent.AssocEdgeData {
	return s.edgesToUpdate
}
