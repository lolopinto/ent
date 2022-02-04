package prompt

import (
	"bufio"
	"fmt"
	"os"
	"unicode"
)

type Prompt interface {
	GetQuestion() string
}

type RunePrompt interface {
	Prompt
	HandleRune(r rune) *PromptResponse
}

type PromptResponse struct {
	Error  error
	Prompt Prompt
}

type Handler func()

func ExitHandler() {
	os.Exit(1)
}

func LogHandler(f string) Handler {
	return func() {
		fmt.Print(f)
	}
}

type YesNoQuestion struct {
	Question   string
	YesHandler Handler
	NoHandler  Handler
}

func (q *YesNoQuestion) GetQuestion() string {
	return q.Question
}

func (q *YesNoQuestion) HandleRune(r rune) *PromptResponse {
	if r == 'y' || r == 'Y' {
		if q.YesHandler != nil {
			q.YesHandler()
		}
		return nil
	} else if r == 'n' || r == 'N' {
		if q.NoHandler != nil {
			q.NoHandler()
		}
		return nil
	}

	// this is being done twice. TODO handle it...
	// follow-up prompt
	return &PromptResponse{
		Prompt: &YesNoQuestion{
			Question:   "Please answer Y/N: ",
			YesHandler: q.YesHandler,
			NoHandler:  q.NoHandler,
		},
	}
}

func HandlePrompts(prompts []Prompt) error {
	reader := bufio.NewReader(os.Stdin)
	for _, p := range prompts {

		if err := handlePrompt(p, reader); err != nil {
			return err
		}
	}
	return nil
}

func handlePrompt(p Prompt, reader *bufio.Reader) error {
	rp, ok := p.(RunePrompt)
	if ok {
		fmt.Print(p.GetQuestion())
		str, err := reader.ReadString('\n')
		if err != nil {
			return err
		}
		r, err := readRune(str)
		if err != nil {
			return err
		}
		res := rp.HandleRune(r)
		if res != nil {
			if res.Error != nil {
				return res.Error
			}

			// new prompt, more questions
			if res.Prompt != nil {
				return handlePrompt(res.Prompt, reader)
			}
		}
		return nil
	}

	// eventually as we need different prompt types, we'll handle here too

	return fmt.Errorf("invalid prompt type")
}

func readRune(s string) (rune, error) {
	var chars []rune
	for _, c := range s {
		if !unicode.IsSpace(c) {
			chars = append(chars, c)
		}
	}
	var ret rune
	if len(chars) != 1 {
		return ret, fmt.Errorf("error getting one non-whitespace rune")
	}
	return chars[0], nil
}
