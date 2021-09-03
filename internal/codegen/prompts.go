package codegen

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"

	"github.com/lolopinto/ent/internal/schema"
)

type prompt interface {
	Question() string
}

type runePrompt interface {
	prompt
	HandleRune(r rune, size int) *promptResponse
}

type promptResponse struct {
	err error
	p   prompt
}

type handler func()

func exitHandler() {
	os.Exit(1)
}

func logHandler(f string) handler {
	return func() {
		fmt.Print(f)
	}
}

type YesNoQuestion struct {
	question   string
	yesHandler handler
	noHandler  handler
}

func (q *YesNoQuestion) Question() string {
	return q.question
}

func (q *YesNoQuestion) HandleRune(r rune, size int) *promptResponse {
	if r == 'y' || r == 'Y' {
		if q.yesHandler != nil {
			q.yesHandler()
		}
		return nil
	} else if r == 'n' || r == 'N' {
		if q.noHandler != nil {
			q.noHandler()
		}
		return nil
	}

	// follow-up prompt
	return &promptResponse{
		p: &YesNoQuestion{
			question:   "Please answer Y/N: ",
			yesHandler: q.yesHandler,
			noHandler:  q.noHandler,
		},
	}
}

// TODO: this should all be in schema but there's dependency issues
// because codegen depends on schema and we need schema to depend on the path to schema which we need to fix
func checkAndHandlePrompts(p *Processor) error {
	// get db changes and store in Buffer (output of auto_schema --changes)
	buf, err := dbChanges(p.Config)
	if err != nil {
		return err
	}

	m := make(map[string][]change)

	if err := json.Unmarshal(buf.Bytes(), &m); err != nil {
		return err
	}

	if len(m) == 0 {
		// we know there's no db changes so we should flag this so that we don't call into python in the future to try and make changes
		p.noDBChanges = true
	}

	prompts, err := getPrompts(p.Schema, m)
	if err != nil {
		return err
	}

	if len(prompts) > 0 {
		if err := handlePrompts(prompts); err != nil {
			return err
		}
	}

	return nil
}

func getPrompts(s *schema.Schema, changes map[string][]change) ([]prompt, error) {
	var prompts []prompt
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
				prompts = append(prompts, &YesNoQuestion{
					question: fmt.Sprintf(
						"You're adding a new field '%s' to an existing Node '%s' which isn't nullable. This could result in database errors. Are you sure you want to do that? Y/N: ",
						field.FieldName,
						nodeData.Node,
					),
					noHandler: exitHandler,
					//					yesHandler: logHandler("yes answered \n"),
				})
			}
		}
	}

	return prompts, nil
}

func handlePrompts(prompts []prompt) error {
	reader := bufio.NewReader(os.Stdin)
	for _, p := range prompts {

		if err := handlePrompt(p, reader); err != nil {
			return err
		}
	}
	return nil
}

func handlePrompt(p prompt, reader *bufio.Reader) error {
	rp, ok := p.(runePrompt)
	if ok {
		fmt.Print(p.Question())
		r, size, err := reader.ReadRune()
		if err != nil {
			return nil
		}
		res := rp.HandleRune(r, size)
		if res != nil {
			if res.err != nil {
				return res.err
			}

			// new prompt, more questions
			if res.p != nil {
				return handlePrompt(res.p, reader)
			}
		}
		return nil
	}

	// eventually as we need different prompt types, we'll handle here too

	return fmt.Errorf("invalid prompt type")
}
