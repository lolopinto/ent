package ent_test

import (
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/configs"
)

type eventsLoader struct {
	results []*models.Event
}

func (res *eventsLoader) GetNewInstance() ent.DBObject {
	var node models.Event
	return &node
}

func (res *eventsLoader) GetConfig() ent.Config {
	return &configs.EventConfig{}
}

func (res *eventsLoader) SetResult(ents []ent.DBObject) {
	res.results = make([]*models.Event, len(ents))
	for idx, ent := range ents {
		res.results[idx] = ent.(*models.Event)
	}
}

type addressLoader struct {
	results []*models.Address
}

func (res *addressLoader) GetNewInstance() ent.DBObject {
	var node models.Address
	return &node
}

func (res *addressLoader) GetConfig() ent.Config {
	return &configs.AddressConfig{}
}

func (res *addressLoader) SetResult(ents []ent.DBObject) {
	res.results = make([]*models.Address, len(ents))
	for idx, ent := range ents {
		res.results[idx] = ent.(*models.Address)
	}
}

type contactsLoader struct {
	results []*models.Contact
}

func (res *contactsLoader) GetNewInstance() ent.DBObject {
	var node models.Contact
	return &node
}

func (res *contactsLoader) GetConfig() ent.Config {
	return &configs.ContactConfig{}
}

func (res *contactsLoader) SetResult(ents []ent.DBObject) {
	res.results = make([]*models.Contact, len(ents))
	for idx, ent := range ents {
		res.results[idx] = ent.(*models.Contact)
	}
}
