package codegen

import (
	"encoding/json"
	"fmt"

	"github.com/lolopinto/ent/internal/prompt"
	"github.com/lolopinto/ent/internal/schema"
)

// TODO: this should all be in schema but there's dependency issues
// because codegen depends on schema and we need schema to depend on the path to schema which we need to fix
func checkAndHandlePrompts(p *Processor) error {
	// get db changes and store in Buffer (output of auto_schema --changes)
	buf, err := dbChanges(p.Config)
	if err != nil {
		return err
	}

	changes := make(map[string][]change)

	if err := json.Unmarshal(buf.Bytes(), &changes); err != nil {
		return err
	}
	p.changes = changes

	if len(changes) == 0 {
		// we know there's no db changes so we should flag this so that we don't call into python in the future to try and make changes
		p.noDBChanges = true
	}

	prompts, err := getPrompts(p.Schema, changes)
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

func getPrompts(s *schema.Schema, changes map[string][]change) ([]prompt.Prompt, error) {
	var prompts []prompt.Prompt
	for tableName, changes := range changes {
		for _, change := range changes {
			if change.Change != AddColumn {
				continue
			}
			nodeData := s.GetNodeDataFromTableName(tableName)
			if nodeData == nil {
				return nil, fmt.Errorf("couldn't find node data for column %s", tableName)
			}

			field := nodeData.FieldInfo.GetFieldByColName(change.Col)
			if field == nil {
				return nil, fmt.Errorf("couldn't find field in node data %s for column %s", nodeData.Node, change.Col)
			}

			// adding new field which isn't nullable, prompt needed
			if !field.Nullable() {
				prompts = append(prompts, &prompt.YesNoQuestion{
					Question: fmt.Sprintf(
						"You're adding a new field '%s' to an existing Node '%s' which isn't nullable. This could result in database errors. Are you sure you want to do that? Y/N: ",
						field.FieldName,
						nodeData.Node,
					),
					NoHandler: prompt.ExitHandler,
					// YesHandler: prompt.LogHandler("yes answered \n"),
				})
			}
		}
	}

	return prompts, nil
}
