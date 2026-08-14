// Keep TypeScript execution anchored to Ent's own dependency graph. npm does not
// add node_modules/.bin to PATH for direct `tsent` CLI invocations, but package
// resolution from this file finds tsx whether npm hoists it or nests it.
import "tsx/cli";
