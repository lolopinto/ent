package file

// Options provides a way to configure the file writing process as needed
// TODO: maybe move things like createDirIfNeeded to here?
type Options struct {
	writeOnce  bool
	disableLog bool
	tempFile   bool
}

// WriteOnce specifes that writing to path provided should not occur if the file already exists
// This is usually configured via code
func WriteOnce() func(opt *Options) {
	return func(opt *Options) {
		opt.writeOnce = true
	}
}

// WriteOnceMaybe takes a flag (usually provided via user action) and determines if we should add
// the writeOnce flag to Options
func WriteOnceMaybe(forceOverwrite bool) func(opt *Options) {
	if forceOverwrite {
		return nil
	}
	return WriteOnce()
}

// DisableLog disables the log that the file was written
func DisableLog() func(opt *Options) {
	return func(opt *Options) {
		opt.disableLog = true
	}
}

// TempFile flags a file as temporary so that we don't attempt to do any processing
// on it after the fact e.g. prettier
func TempFile() func(opt *Options) {
	return func(opt *Options) {
		opt.tempFile = true
	}
}
