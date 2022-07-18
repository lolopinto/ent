package schema

import (
	"fmt"
	"strings"

	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema/change"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
)

// CompareSchemas takes 2 schemas and returns a list of changes in the schema
// not an exhaustive list, exists (for now) only to speed up file
// generation and so only checks for artifacts that will affect file generation
// over time, we'll update this to check more properties and be used in more places
func CompareSchemas(s1, s2 *Schema) (change.ChangeMap, error) {
	m := make(change.ChangeMap)

	// if don't have either schema, just get out and we'll handle that elsewhere
	if s1 == nil || s2 == nil {
		return nil, nil
	}

	if err := comparePatterns(s1.Patterns, s2.Patterns, &m); err != nil {
		return nil, err
	}

	if err := compareNodes(s1.Nodes, s2.Nodes, &m); err != nil {
		return nil, err
	}

	if err := compareEnums(s1.Enums, s2.Enums, &m); err != nil {
		return nil, err
	}

	return m, nil
}

func comparePattern(p1, p2 *PatternInfo) ([]change.Change, error) {
	var ret []change.Change
	if p1 == nil || p2 == nil {
		return nil, fmt.Errorf("nil Pattern passed to ComparePattern")
	}

	// TODO is this even possible?
	// this is basically just a delete and add no?
	// name change is possible because name in schema can be different from pattern file?
	if p1.Name != p2.Name {
		ret = append(ret, change.Change{
			Change: change.ModifyPattern,
			Name:   p1.Name,
		})
	}

	ret = append(ret, edge.CompareAssocEdgesMap(p1.AssocEdges, p2.AssocEdges)...)

	return ret, nil
}

func comparePatterns(m1, m2 map[string]*PatternInfo, m *change.ChangeMap) error {
	ret := *m
	for k, p1 := range m1 {
		p2, ok := m2[k]
		// in 1st but not 2nd, dropped
		if !ok {
			ret[k] = []change.Change{
				{
					Change: change.RemovePattern,
					Name:   k,
				},
			}
		} else {
			changes, err := comparePattern(p1, p2)
			if err != nil {
				return err
			}
			if len(changes) != 0 {
				ret[k] = changes
			}
		}
	}

	// in 2nd but not first, added
	for k := range m2 {
		_, ok := m1[k]
		if !ok {
			ret[k] = []change.Change{
				{
					Change: change.AddPattern,
					Name:   k,
				},
			}
		}
	}
	return nil
}

func blankNodeDataInfo() *NodeDataInfo {
	return &NodeDataInfo{
		NodeData: &NodeData{},
	}
}

func compareNodes(m1, m2 NodeMapInfo, m *change.ChangeMap) error {
	ret := *m
	getSchemaName := func(config string) string {
		return strings.TrimSuffix(config, "Config")
	}
	for k, ndi1 := range m1 {
		ndi2, ok := m2[k]
		name := getSchemaName(k)
		var changes []change.Change
		opts := compareNodeOptions{}
		if !ok {
			// in 1st but not 2nd, dropped
			changes = append(changes, change.Change{
				Change:      change.RemoveNode,
				Name:        name,
				GraphQLName: name,
			})
			ndi2 = blankNodeDataInfo()
			opts.skipFields = true
			opts.skipModifyNode = true
		}
		diff, err := compareNode(ndi1.NodeData, ndi2.NodeData, &opts)
		if err != nil {
			return err
		}
		changes = append(changes, diff...)
		if len(changes) != 0 {
			ret[name] = changes
		}
	}

	// in 2nd but not first, added
	for k, ndi2 := range m2 {
		_, ok := m1[k]
		if !ok {
			name := getSchemaName(k)

			changes := []change.Change{
				{
					Change:      change.AddNode,
					Name:        name,
					GraphQLName: name,
				},
			}
			ndi1 := blankNodeDataInfo()
			diff, err := compareNode(ndi1.NodeData, ndi2.NodeData, &compareNodeOptions{
				skipFields:     true,
				skipModifyNode: true,
			})
			if err != nil {
				return err
			}
			changes = append(changes, diff...)
			ret[name] = changes
		}
	}
	return nil
}

// only checking the things that affect file generation
// not checking dbRows, indices, constraints etc...
// also ignoring hideFromGraphQL for now but should eventually check it because can scope changes to just GraphQL

type compareNodeOptions struct {
	// options: skipFields, skipModifyNode
	skipFields     bool
	skipModifyNode bool
}

func compareNode(n1, n2 *NodeData, opts *compareNodeOptions) ([]change.Change, error) {
	var ret []change.Change

	if !opts.skipFields {
		ret = append(ret, field.CompareFieldInfo(n1.FieldInfo, n2.FieldInfo)...)
	}

	ret = append(ret, edge.CompareEdgeInfo(n1.EdgeInfo, n2.EdgeInfo)...)

	ret = append(ret, action.CompareActionInfo(n1.ActionInfo, n2.ActionInfo)...)

	changes, err := enum.CompareEnums(n1.tsEnums, n2.tsEnums)
	if err != nil {
		return nil, err
	}

	ret = append(ret, input.CompareIndices(n1.Indices, n2.Indices)...)

	ret = append(ret, input.CompareConstraints(n1.Constraints, n2.Constraints)...)

	if n1.TableName != n2.TableName {
		return nil, fmt.Errorf("cannot change table name for node %s", n1.Node)
	}

	if n1.EnumTable != n2.EnumTable {
		return nil, fmt.Errorf("cannot change enum table status for node %s", n1.Node)
	}

	if !change.MapListEqual(n1.DBRows, n2.DBRows) {
		ret = append(ret, change.Change{
			Change:      change.ModifiedDBRows,
			Name:        n2.Node,
			GraphQLName: n2.Node,
		})
	}

	ret = append(ret, changes...)

	// if anything changes, just add ModifyNode
	// eventually, we can make this smarter but want to slightly err on the side of caution here
	// maybe move action changes after. can't think of a reason to have actions affect node file
	if !opts.skipFields && len(ret) != 0 {
		ret = append(ret, change.Change{
			Change:      change.ModifyNode,
			Name:        n2.Node,
			GraphQLName: n2.Node,
		})
	}

	if n1.HideFromGraphQL != n2.HideFromGraphQL {
		ret = append(ret, change.Change{
			Change:      change.ModifyNode,
			Name:        n2.Node,
			GraphQLName: n2.Node,
			GraphQLOnly: true,
		})
	}
	return ret, nil
}

func enumInfoEqual(enum1, enum2 *EnumInfo) bool {
	ret1 := change.CompareNilVals(enum1.NodeData == nil, enum2.NodeData == nil)
	ret2 := change.CompareNilVals(enum1.InputNode == nil, enum2.InputNode == nil)
	ret3 := change.CompareNilVals(enum1.Pattern == nil, enum2.Pattern == nil)
	if ret1 != nil && !*ret1 {
		return false
	}
	if ret2 != nil && !*ret2 {
		return false
	}

	if ret3 != nil && !*ret3 {
		return false
	}

	return enum.EnumEqual(enum1.Enum, enum2.Enum) &&
		enum.GQLEnumEqual(enum1.GQLEnum, enum2.GQLEnum)
}

func compareEnums(m1, m2 map[string]*EnumInfo, m *change.ChangeMap) error {
	ret := *m
	for k, enum1 := range m1 {
		enum2, ok := m2[k]
		if !ok {
			// in 1st but not 2nd, dropped
			c := change.Change{
				Change: change.RemoveEnum,
				Name:   enum1.Enum.Name,
			}
			if enum1.GQLEnum != nil {
				c.GraphQLName = enum1.GQLEnum.Name
			} else {
				c.TSOnly = true
			}
			ret[k] = []change.Change{c}
		} else {
			// we key by graphql name...
			if !enumInfoEqual(enum1, enum2) {
				if enum1.GQLEnum != nil &&
					enum2.GQLEnum != nil &&
					enum1.GQLEnum.Name != enum2.GQLEnum.Name {
					// graphql name changed so treat it differently
					ret[k] = []change.Change{
						{
							Change:      change.ModifyEnum,
							Name:        enum1.Enum.Name,
							GraphQLName: enum1.GQLEnum.Name,
							TSOnly:      true,
						},
						{
							Change:      change.RemoveEnum,
							Name:        enum1.Enum.Name,
							GraphQLName: enum1.GQLEnum.Name,
							GraphQLOnly: true,
						},
						{
							Change:      change.AddEnum,
							Name:        enum2.Enum.Name,
							GraphQLName: enum2.GQLEnum.Name,
							GraphQLOnly: true,
						},
					}
				} else if enum1.Enum.Name != enum2.Enum.Name {
					// TS enum name changed so treat it differently

					if enum1.GQLEnum == nil {
						ret[k] = []change.Change{
							{
								Change: change.RemoveEnum,
								Name:   enum1.Enum.Name,
								TSOnly: true,
							},
							{
								Change: change.AddEnum,
								Name:   enum2.Enum.Name,
								TSOnly: true,
							},
						}
					} else {

						ret[k] = []change.Change{
							{
								Change:      change.ModifyEnum,
								Name:        enum1.Enum.Name,
								GraphQLName: enum1.GQLEnum.Name,
								GraphQLOnly: true,
							},
							{
								Change:      change.RemoveEnum,
								Name:        enum1.Enum.Name,
								GraphQLName: enum1.GQLEnum.Name,
								TSOnly:      true,
							},
							{
								Change:      change.AddEnum,
								Name:        enum2.Enum.Name,
								GraphQLName: enum2.GQLEnum.Name,
								TSOnly:      true,
							},
						}
					}
				} else {
					c := change.Change{
						Change: change.ModifyEnum,
						Name:   enum1.Enum.Name,
					}
					if enum1.GQLEnum != nil {
						c.GraphQLName = enum1.GQLEnum.Name
					} else {
						c.TSOnly = true
					}
					ret[k] = []change.Change{c}
				}
			}
		}
	}

	// in 2nd but not first, added
	for k, enum2 := range m2 {
		_, ok := m1[k]
		if !ok {
			c := change.Change{
				Change: change.AddEnum,
				Name:   enum2.Enum.Name,
			}
			if enum2.GQLEnum != nil {
				c.GraphQLName = enum2.GQLEnum.Name
			} else {
				c.TSOnly = true
			}
			ret[k] = []change.Change{c}
		}
	}
	return nil
}
