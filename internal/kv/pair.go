package kv

import (
	"fmt"
	"strconv"
	"strings"
)

type Import struct {
	ImportPath, Import string
	DefaultImport      bool
}

type Pair struct {
	Key    string
	Value  string
	Import *Import
}

func NewObjectFromPairs(p ...Pair) Object {
	o := Object{}
	o.Append(p...)
	return o
}

type Object struct {
	list []Pair
	imps []*Import
}

func (o *Object) Append(p ...Pair) {
	for _, v := range p {
		if v.Import != nil {
			o.imps = append(o.imps, v.Import)
		}
	}
	o.list = append(o.list, p...)
}

func (o *Object) AppendObject(key string, o2 Object) {
	o.imps = append(o.imps, o2.imps...)
	o.list = append(o.list, Pair{
		Key:   key,
		Value: o2.String(),
	})
}

func (o *Object) AppendList(key string, l List) {
	o.imps = append(o.imps, l.imps...)
	o.list = append(o.list, Pair{
		Key:   key,
		Value: l.String(),
	})
}

func (o *Object) GetImports() []*Import {
	return o.imps
}

func (o *Object) String() string {
	var sb strings.Builder
	sb.WriteString("{")
	for idx, v := range o.list {
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

type List struct {
	list []Object
	imps []*Import
}

func (l *List) Append(o ...Object) {
	for _, o2 := range o {
		l.imps = append(l.imps, o2.imps...)
	}
	l.list = append(l.list, o...)
}

func (l *List) Len() int {
	return len(l.list)
}

func (l *List) String() string {
	var sb strings.Builder

	sb.WriteString("[")

	for i, o := range l.list {
		if i != 0 {
			sb.WriteString(", ")
		}
		sb.WriteString(o.String())
	}
	sb.WriteString("]")
	return sb.String()
}

func (l *List) GetImports() []*Import {
	return l.imps
}

func NewList(o ...Object) List {
	l := List{}
	l.Append(o...)
	return l
}

type ListItem struct {
	Items []string
}

func NewListItemWithQuotedItems(l []string) *ListItem {
	ret := make([]string, len(l))
	for i, item := range l {
		ret[i] = strconv.Quote(item)
	}
	return &ListItem{Items: ret}
}

func (li *ListItem) String() string {
	return fmt.Sprintf("[%s]", strings.Join(li.Items, ", "))
}
