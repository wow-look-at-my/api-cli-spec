package spec

import (
	"fmt"

	"github.com/wow-look-at-my/xml-validator/validator"
)

// ParseResolved reads a document in the resolved form into the same shape
// Resolve produces. The two are then compared on values, so attribute order
// and whitespace carry nothing.
func ParseResolved(doc *validator.Document) (*Resolved, error) {
	root := doc.Root
	if root == nil || root.Local != "resolved" {
		return nil, fmt.Errorf("the root element is %q, and a resolved document is rooted at <resolved>", rootName(root))
	}
	config, ok := root.Attr("config")
	if !ok {
		return nil, fmt.Errorf("<resolved> declares no config=")
	}

	out := &Resolved{Config: config}
	for _, node := range children(root, "command") {
		cmd, err := parseCommand(node)
		if err != nil {
			return nil, err
		}
		out.Commands = append(out.Commands, cmd)
	}
	return out, nil
}

func parseCommand(node *validator.Element) (Command, error) {
	path, ok := node.Attr("path")
	if !ok {
		return Command{}, fmt.Errorf("a <command> declares no path=")
	}
	runs, ok := node.Attr("runs")
	if !ok {
		return Command{}, fmt.Errorf("%s declares no runs=", path)
	}
	cmd := Command{Path: path, Runs: runs == "true"}

	for _, child := range node.ChildElements() {
		from, ok := child.Attr("from")
		if !ok {
			return Command{}, fmt.Errorf("%s: <%s> declares no from=", path, child.Local)
		}
		switch child.Local {
		case "run":
			kind, ok := child.Attr("kind")
			if !ok {
				return Command{}, fmt.Errorf("%s: <run> declares no kind=", path)
			}
			cmd.Run = &Run{From: from, Kind: kind}
		case "cwd":
			cmd.Cwd = &Setting{From: from, Value: child.TextContent()}
		case "stdin":
			cmd.Stdin = &Setting{From: from}
		case "confirm":
			cmd.Confirm = &Setting{From: from}
		case "format":
			cmd.Format = &Setting{From: from}
		default:
			return Command{}, fmt.Errorf("%s: <%s> is not part of the resolved form", path, child.Local)
		}
	}
	return cmd, nil
}
