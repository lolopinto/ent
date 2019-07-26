package main

import (
	"github.com/lolopinto/ent/cmd/gent/configs"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/util"
)

type entCodegenPlugin struct {
}

func (p *entCodegenPlugin) pluginName() string {
	return "ent_codegen"
}

func (p *entCodegenPlugin) processData(data *codegenData) error {
	for _, info := range data.schema.Nodes {
		if !info.ShouldCodegen {
			continue
		}
		nodeData := info.NodeData
		//fmt.Println(specificConfig, structName)
		if len(nodeData.PackageName) > 0 {
			writeModelFile(nodeData, data.codePath)
			writeMutatorFile(nodeData, data.codePath)
			writePrivacyFile(nodeData)

			for _, action := range nodeData.ActionInfo.Actions {
				writeActionFile(nodeData, action, data.codePath)
			}
		}
	}
	// right now it all panics but we have to change that lol
	return nil
}

var _ codegenPlugin = &entCodegenPlugin{}

type assocEdgePlugin struct {
}

func (p *assocEdgePlugin) pluginName() string {
	return "assoc_edge_plugin"
}

func (p *assocEdgePlugin) processData(data *codegenData) error {
	newEdges := data.schema.GetNewEdges()
	if len(newEdges) > 0 {
		// write to local db.
		// todo: need to figure out correct logic or way of making sure this gets
		// written to production.
		// use alembic revision history?
		// create parallel structure?
		// have a file where we dump it and then check that file?
		err := ent.CreateNodes(&newEdges, &configs.AssocEdgeConfig{})
		util.Die(err)
	}
	// todo handle errors instead of panicing
	return nil
}

var _ codegenPlugin = &assocEdgePlugin{}
