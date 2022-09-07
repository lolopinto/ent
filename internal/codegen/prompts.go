package codegen

import (
	"encoding/json"
	"fmt"

	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/prompt"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/change"
)

// TODO: this should all be in schema but there's dependency issues
// because codegen depends on schema and we need schema to depend on the path to schema which we need to fix
func checkAndHandlePrompts(p *Processor) error {
	useChanges := p.Config.useChanges
	var prompts []prompt.Prompt
	var err error

	if useChanges {
		prompts, err = getPromptsFromChanges(p)
	} else {
		prompts, err = getPromptsFromDB(p)
	}
	if err != nil {
		return err
	}

	if len(prompts) > 0 {
		if err := prompt.HandlePrompts(prompts); err != nil {
			return err
		}
	}

	return nil
}

func getPromptsFromDB(p *Processor) ([]prompt.Prompt, error) {
	// get db changes and store in Buffer (output of auto_schema --changes)
	if p.debugMode {
		fmt.Println("deciphering prompts from db")
	}
	buf, err := dbChanges(p.Config)
	if err != nil {
		return nil, err
	}

	changes := make(map[string][]deprecatedChange)

	if err := json.Unmarshal(buf.Bytes(), &changes); err != nil {
		return nil, err
	}

	if len(changes) == 0 {
		// we know there's no db changes so we should flag this so that we don't call into python in the future to try and make changes
		p.noDBChanges = true
	}

	return getPromptsFromDBChanges(p.Schema, changes)
}

type fieldInfo struct {
	name string
	col  bool
}

func getAddColumnPrompt(nodeData *schema.NodeData, f fieldInfo) (prompt.Prompt, error) {
	// computed field. nothing to do here
	// this probably doesn't work for changes from db...
	if nodeData.FieldInfo.IsComputedField(f.name) {
		return nil, nil
	}

	var fld *field.Field
	if f.col {
		fld = nodeData.FieldInfo.GetFieldByColName(f.name)
	} else {
		fld = nodeData.FieldInfo.GetFieldByName(f.name)
	}
	if fld == nil {
		return nil, fmt.Errorf("couldn't find field in node data %s for column %s", nodeData.Node, f.name)
	}

	// adding new field which isn't nullable, prompt needed
	if !fld.Nullable() {
		return &prompt.YesNoQuestion{
			Question: fmt.Sprintf(
				"You're adding a new field '%s' to an existing Node '%s' which isn't nullable. This could result in database errors. Are you sure you want to do that? Y/N: ",
				fld.FieldName,
				nodeData.Node,
			),
			NoHandler: prompt.ExitHandler,
			// YesHandler: prompt.LogHandler("yes answered \n"),
		}, nil
	}
	return nil, nil
}

func getModifyIndexPrompt(indexName string) (prompt.Prompt, error) {
	return &prompt.YesNoQuestion{
		Question: fmt.Sprintf(
			"You're modifying index '%s' which involves dropping the index and re-creating it. Are you sure you want to do that? Y/N: ",
			indexName,
		),
		NoHandler: prompt.ExitHandler,
	}, nil
}

func getModifyEdgeDataPrompt(edgeType string) (prompt.Prompt, error) {
	return &prompt.YesNoQuestion{
		Question: fmt.Sprintf(
			"You're modifying edge_type '%s' which could affect production. Are you sure you want to do that? Y/N: ",
			edgeType,
		),
		NoHandler: prompt.ExitHandler,
	}, nil
}

// TODO eventually deprecate this. for now, we keep this to have both paths just in case
func getPromptsFromDBChanges(s *schema.Schema, changes map[string][]deprecatedChange) ([]prompt.Prompt, error) {
	var prompts []prompt.Prompt
	for tableName, changes := range changes {
		dropped := make(map[string]bool)
		for _, change := range changes {
			var p prompt.Prompt
			var err error

			switch change.Change {
			case AddColumn:
				nodeData := s.GetNodeDataFromTableName(tableName)
				if nodeData == nil {
					return nil, fmt.Errorf("couldn't find node data for column %s", tableName)
				}
				p, err = getAddColumnPrompt(nodeData, fieldInfo{name: change.Col, col: true})

			case DropIndex:
				if change.Index != "" {
					dropped[change.Index] = true
				}

			case CreateIndex:
				// db modify index changes look like a drop then create of the same index
				if change.Index != "" && dropped[change.Index] {
					p, err = getModifyIndexPrompt(change.Index)
				}

			case ModifyEdge:
				p, err = getModifyEdgeDataPrompt(change.Edge)
			}

			if err != nil {
				return nil, err
			}
			if p != nil {
				prompts = append(prompts, p)
			}
		}
	}

	return prompts, nil
}

func getPromptsFromChanges(p *Processor) ([]prompt.Prompt, error) {
	if p.debugMode {
		fmt.Println("deciphering prompts from changeMap")
	}
	if len(p.ChangeMap) == 0 {
		// we know there's no db changes so we should flag this so that we don't call into python in the future to try and make changes
		p.noDBChanges = true
		return nil, nil
	}

	var prompts []prompt.Prompt
	for k, changes := range p.ChangeMap {
		for _, c := range changes {
			var pt prompt.Prompt
			var err error

			switch c.Change {
			case change.AddField:
				info := p.Schema.Nodes[k+"Config"]
				if info == nil {
					return nil, fmt.Errorf("cannot find NodeDataInfo with key %s", k)
				}
				pt, err = getAddColumnPrompt(info.NodeData, fieldInfo{name: c.Name})

			case change.ModifyIndex:
				pt, err = getModifyIndexPrompt(c.Name)

			case change.ModifyEdgeData:
				pt, err = getModifyEdgeDataPrompt(c.Name)
			}

			if err != nil {
				return nil, err
			}
			if pt != nil {
				prompts = append(prompts, pt)
			}
		}
	}

	return prompts, nil
}
