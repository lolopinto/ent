package ent

import "github.com/lolopinto/jarvis/ent/privacy"

type Entity interface {

	// GetType returns the NodeType of this entity
	GetType() NodeType
}

type EntWithPrivacy interface {
	Entity
	// TODO eventually make this part of Entity
	GetPrivacyPolicy() privacy.Policy
}
