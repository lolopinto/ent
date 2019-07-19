package ent

import "github.com/lolopinto/ent/ent/privacy"

type Entity interface {

	// GetType returns the NodeType of this entity
	GetID() string // TODO uuid
	GetType() NodeType
	GetPrivacyPolicy() privacy.Policy
}
