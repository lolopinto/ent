package schema

import (
	"errors"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/base"
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
}

// Given a schema file parser, Parse parses the schema to return the completely
// parsed schema
func Parse(p schemaparser.Parser, specificConfigs ...string) (*Schema, error) {
	return parse(func(s *Schema) (*assocEdgeData, error) {
		return s.Nodes.parseFiles(p, specificConfigs...)
	})
}

func ParsePackage(pkg *packages.Package, specificConfigs ...string) (*Schema, error) {
	return parse(func(s *Schema) (*assocEdgeData, error) {
		return s.Nodes.parsePackage(pkg, specificConfigs...)
	})
}

// ParseFromInputSchema takes the schema that has been parsed from whatever input source
// and provides the schema we have that's checked and conforms to everything we expect
func ParseFromInputSchema(schema *input.Schema, lang base.Language) (*Schema, error) {
	return parse(func(s *Schema) (*assocEdgeData, error) {
		return s.Nodes.parseInputSchema(schema, lang)
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
