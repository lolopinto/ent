package change

type ChangeType string

const (
	AddPattern    ChangeType = "add_pattern"
	ModifyPattern ChangeType = "modify_pattern"
	RemovePattern ChangeType = "remove_pattern"

	AddNode    ChangeType = "add_node"
	RemoveNode ChangeType = "remove_node"
	ModifyNode ChangeType = "modify_node"

	AddField    ChangeType = "add_field"
	RemoveField ChangeType = "remove_field"
	ModifyField ChangeType = "modify_field"

	AddEdge    ChangeType = "add_edge"
	RemoveEdge ChangeType = "remove_edge"
	ModifyEdge ChangeType = "modify_edge"

	AddEdgeGroup    ChangeType = "add_edge_group"
	RemoveEdgeGroup ChangeType = "remove_edge_group"
	ModifyEdgeGroup ChangeType = "modify_edge_group"

	AddAction    ChangeType = "add_action"
	RemoveAction ChangeType = "remove_action"
	ModifyAction ChangeType = "modify_action"

	AddEnum    ChangeType = "add_enum"
	RemoveEnum ChangeType = "remove_enum"
	ModifyEnum ChangeType = "modify_enum"

	CreateIndex      ChangeType = "create_index"
	DropIndex        ChangeType = "drop_index"
	CreateForeignKey ChangeType = "create_foreign_key"

	CreateUniqueConstraint ChangeType = "create_unique_constraint"
	AddRows                ChangeType = "add_rows"
	RemoveRows             ChangeType = "remove_rows"
	ModifyRows             ChangeType = "modify_rows"
	CreateCheckConstraint  ChangeType = "create_check_constraint"
	DropCheckConstraint    ChangeType = "drop_check_constraint"
)

type Change struct {
	Change      ChangeType
	Field       string
	Edge        string // For AddEdge|RemoveEdge etc
	EdgeGroup   string
	Pattern     string
	Node        string
	Action      string
	Enum        string
	GraphQLOnly bool
	TSOnly      bool
}

type ChangeMap map[string][]Change

// have to pass if nil because of go nil issues and inability to compare nils without type info
func CompareNilVals(existingNil, valNil bool) *bool {
	var ret *bool

	if existingNil != valNil {
		temp := false
		ret = &temp
	}
	if existingNil && valNil {
		temp := true
		ret = &temp
	}
	return ret
}

// return boolean if one is nil and the other is not nil or both nil
// if both not nil, returns nil, indicating more work to be done
// TODO kill, doesn't work because of go nil crap
func CompareEqual(existing, val interface{}) *bool {
	var ret *bool

	if XOR(existing, val) {
		*ret = false
	}
	if existing == nil && val == nil {
		*ret = true
	}
	return ret
}

func XOR(existing, val interface{}) bool {
	return (existing == nil && val != nil) || (existing != nil && val == nil)
}

func StringListEqual(l1, l2 []string) bool {
	if len(l1) != len(l2) {
		return false
	}

	for k, v1 := range l1 {
		if l2[k] != v1 {
			return false
		}
	}
	return true
}

func StringMapEqual(m1, m2 map[string]string) bool {
	if len(m1) != len(m2) {
		return false
	}

	for k := range m1 {
		_, ok := m2[k]
		if !ok {
			return false
		}
	}

	for k := range m2 {
		_, ok := m1[k]
		if !ok {
			return false
		}
	}
	return true
}
