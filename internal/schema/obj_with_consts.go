package schema

import "sort"

type WithConst interface {
	addConstInfo(constType, constName string, constInfo *ConstInfo)
	GetNodeInstance() string
	GetConstantGroups() map[string]*ConstGroupInfo
}

type objWithConsts struct {
	ConstantGroups map[string]*ConstGroupInfo
}

func (obj *objWithConsts) GetConstantGroups() map[string]*ConstGroupInfo {
	return obj.ConstantGroups
}

func (obj *objWithConsts) addConstInfo(constType, constName string, constInfo *ConstInfo) {
	constGroup := obj.ConstantGroups[constType]
	if constGroup == nil {
		constGroup = &ConstGroupInfo{
			ConstType: constType,
		}
		if obj.ConstantGroups == nil {
			obj.ConstantGroups = make(map[string]*ConstGroupInfo)
		}
		obj.ConstantGroups[constType] = constGroup
	}
	if constGroup.Constants == nil {
		constGroup.Constants = make(map[string]*ConstInfo)
	}
	constGroup.Constants[constName] = constInfo
}

func (obj *objWithConsts) GetSortedConstantGroups() []*ConstGroupInfo {
	var sorted []*ConstGroupInfo

	for _, group := range obj.ConstantGroups {
		sorted = append(sorted, group)
	}

	// manual sorting to make sure ent.NodeType then ent.EdgeType then sorted by name
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[j].ConstType == "ent.NodeType" {
			return false
		}
		if sorted[i].ConstType == "ent.NodeType" {
			return true
		}
		if sorted[j].ConstType == "ent.EdgeType" {
			return false
		}
		if sorted[i].ConstType == "ent.EdgeType" {
			return true
		}
		return sorted[i].ConstType < sorted[j].ConstType
	})

	return sorted
}
