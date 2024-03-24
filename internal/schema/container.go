package schema

import (
	"github.com/lolopinto/ent/internal/action"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/field"
)

type Container interface {
	GetEdgeInfo() *edge.EdgeInfo
	GetFieldInfo() *field.FieldInfo
	GetActionInfo() *action.ActionInfo
	GetName() string
	IsPattern() bool
}
