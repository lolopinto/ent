package util

import "fmt"

type Color string

const (
	// colors from https://www.lihaoyi.com/post/BuildyourownCommandLinewithANSIescapecodes.html#8-colors
	Black   Color = "\033[030m"
	Red     Color = "\033[31m"
	Green   Color = "\033[32m"
	Yellow  Color = "\033[33m"
	Blue    Color = "\033[34m"
	Magenta Color = "\033[35m"
	Cyan    Color = "\033[36m"
	White   Color = "\033[37m"
	Reset   Color = "\033[0m"

	BrightBlack   Color = "\033[30;1m"
	BrightRed     Color = "\033[31;1m"
	BrightGreen   Color = "\033[32;1m"
	BrightYellow  Color = "\033[33;1m"
	BrightBlue    Color = "\033[34;1m"
	BrightMagenta Color = "\033[35;1m"
	BrightCyan    Color = "\033[36;1m"
	BrightWhite   Color = "\033[37;1m"
)

func wrap(color Color, text string) string {
	return fmt.Sprintf("%s%s%s", color, text, Reset)
}

func WrapRed(text string) string {
	return wrap(Red, text)
}

func WrapGreen(text string) string {
	return wrap(Green, text)
}

func WrapYellow(text string) string {
	return wrap(Yellow, text)
}

func WrapBlue(text string) string {
	return wrap(Blue, text)
}

func WrapMagenta(text string) string {
	return wrap(Magenta, text)
}

func WrapCyan(text string) string {
	return wrap(Cyan, text)
}

func WrapWhite(text string) string {
	return wrap(White, text)
}

func WrapBlack(text string) string {
	return wrap(Black, text)
}

func WrapBrightRed(text string) string {
	return wrap(BrightRed, text)
}

func WrapBrightGreen(text string) string {
	return wrap(BrightGreen, text)
}
