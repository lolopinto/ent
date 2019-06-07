package ent

import "github.com/lolopinto/jarvis/ent/privacy"

type Entity interface {

	// GetType returns the NodeType of this entity
	GetType() NodeType
	GetPrivacyPolicy2() privacy.Policy
}
