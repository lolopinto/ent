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

	// brought to differentiate from edges since no connection in graphql land
	AddFieldEdge    ChangeType = "add_field_edge"
	RemoveFieldEdge ChangeType = "remove_field-edge"
	ModifyFieldEdge ChangeType = "modify_field_edge"

	AddEdgeGroup    ChangeType = "add_edge_group"
	RemoveEdgeGroup ChangeType = "remove_edge_group"
	ModifyEdgeGroup ChangeType = "modify_edge_group"

	AddAction    ChangeType = "add_action"
	RemoveAction ChangeType = "remove_action"
	ModifyAction ChangeType = "modify_action"

	AddEnum    ChangeType = "add_enum"
	RemoveEnum ChangeType = "remove_enum"
	ModifyEnum ChangeType = "modify_enum"

	AddIndex    ChangeType = "add_index"
	RemoveIndex ChangeType = "remove_index"
	ModifyIndex ChangeType = "modify_index"

	AddConstraint    ChangeType = "add_constraint"
	RemoveConstraint ChangeType = "remove_constraint"
	ModifyConstraint ChangeType = "modify_constraint"

	// TODO need to break this up to AddRows, RemoveRows, ModifyRows
	ModifiedDBRows ChangeType = "modified_dbrows"

	// ^ everything above this is used/validated
	// below is still TBD

	CreateForeignKey ChangeType = "create_foreign_key"

	AddRows    ChangeType = "add_rows"
	RemoveRows ChangeType = "remove_rows"
	ModifyRows ChangeType = "modify_rows"

	AddEdgeData    ChangeType = "add_edge_data"
	ModifyEdgeData ChangeType = "modify_edge_data"
	RemoveEdgeData ChangeType = "remove_edge_data"

	CreateUniqueConstraint ChangeType = "create_unique_constraint"
	CreateCheckConstraint  ChangeType = "create_check_constraint"
	DropCheckConstraint    ChangeType = "drop_check_constraint"
)

type Change struct {
	Change      ChangeType
	Name        string
	GraphQLName string
	// store anything extra here...
	ExtraInfo   interface{}
	GraphQLOnly bool
	TSOnly      bool
}

type ChangeMap map[string][]Change

// TODO this needs to care about TSOnly and GraphQLOnly...
func (cm ChangeMap) ChangesExist(key string, l ...ChangeType) bool {
	if cm == nil || len(l) == 0 {
		return false
	}
	changes := cm[key]
	m := make(map[ChangeType]bool)
	for _, v := range l {
		m[v] = true
	}

	for _, c := range changes {
		if m[c.Change] {
			return true
		}
	}
	return false
}

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

	for k, v := range m1 {
		v2, ok := m2[k]
		if !ok || v != v2 {
			return false
		}
	}

	return true
}

func IntMapEqual(m1, m2 map[string]int) bool {
	if len(m1) != len(m2) {
		return false
	}

	for k, v := range m1 {
		v2, ok := m2[k]
		if !ok || v != v2 {
			return false
		}
	}

	return true
}

func MapListEqual(l1, l2 []map[string]interface{}) bool {
	if len(l1) != len(l2) {
		return false
	}

	for k := range l1 {
		if !MapEqual(l1[k], l2[k]) {
			return false
		}
	}
	return true
}

func MapEqual(m1, m2 map[string]interface{}) bool {
	if len(m1) != len(m2) {
		return false
	}

	for k, v := range m1 {
		v2, ok := m2[k]
		if !ok || v != v2 {
			return false
		}
	}

	return true
}

type CompareOpts struct {
	RemoveEqualFromGraphQL bool
	AddEqualToGraphQL      bool
}
type CompareOption func(*CompareOpts)

func AddEqualToGraphQL() CompareOption {
	return func(opt *CompareOpts) {
		opt.AddEqualToGraphQL = true
	}
}

func RemoveEqualFromGraphQL() CompareOption {
	return func(opt *CompareOpts) {
		opt.RemoveEqualFromGraphQL = true
	}
}
