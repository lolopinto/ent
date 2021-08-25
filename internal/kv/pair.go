package kv

import "strings"

type Pair struct {
	Key   string
	Value string //interface{}
}

type List []Pair

func (l List) String() string {
	var sb strings.Builder
	sb.WriteString("{")
	for idx, v := range l {
		if idx != 0 {
			sb.WriteString(", ")
		}
		sb.WriteString(v.Key)
		sb.WriteString(": ")
		sb.WriteString(v.Value)
	}
	sb.WriteString("}")
	return sb.String()
}
