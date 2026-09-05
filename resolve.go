// Package spec is the executable half of the specification.
//
// api-cli.xsd says what a document may contain. resolved.xsd says what a
// reader must work out from one, and README.md states the rules. This package
// applies those rules, so the suite compares a document against the meaning
// the specification claims for it rather than against prose.
package spec

import (
	"fmt"
	"strings"

	"github.com/wow-look-at-my/xml-validator/validator"
)

// A Setting is one effective value, and the node whose declaration won it.
type Setting struct {
	From  string
	Value string
}

// A Run is the effective run: where it was declared, and which of the three
// things it is.
type Run struct {
	From string
	Kind string
}

// A Command is one node of the tree, with every setting resolved.
type Command struct {
	Path    string
	Runs    bool
	Run     *Run
	Cwd     *Setting
	Stdin   *Setting
	Confirm *Setting
	Format  *Setting
}

// A Resolved document is the tree in document order, parents before children.
type Resolved struct {
	Config   string
	Commands []Command
}

// settings carries what a node inherits from its ancestors.
type settings struct {
	run     *Run
	cwd     *Setting
	stdin   *Setting
	confirm *Setting
	format  *Setting
}

// Resolve reads a document and reports the tree a conforming reader arrives
// at. It reads structure only: a placeholder is content, and this never
// renders one.
func Resolve(doc *validator.Document) (*Resolved, error) {
	root := doc.Root
	if root == nil || root.Local != "config" {
		return nil, fmt.Errorf("the root element is %q, and a document is rooted at <config>", rootName(root))
	}
	name, ok := root.Attr("name")
	if !ok {
		return nil, fmt.Errorf("<config> declares no name=")
	}

	out := &Resolved{Config: name}
	// The root is an ancestor of every top-level command, so its own
	// declarations resolve first, at the path "/".
	inherited := declarations(root, "/", settings{})
	for _, child := range root.ChildElements() {
		if child.Local != "command" {
			continue
		}
		if err := out.walk(child, "", inherited); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func (r *Resolved) walk(node *validator.Element, parentPath string, inherited settings) error {
	name, ok := node.Attr("name")
	if !ok {
		return fmt.Errorf("a <command> under %q declares no name=", pathOf(parentPath))
	}
	path := parentPath + "/" + name
	own := declarations(node, path, inherited)

	subcommands := children(node, "command")
	cmd := Command{
		Path: path,
		// A node runs when it is a leaf, or when it says so.
		Runs:    len(subcommands) == 0 || attrIs(node, "runnable", "true"),
		Run:     own.run,
		Cwd:     own.cwd,
		Stdin:   own.stdin,
		Confirm: own.confirm,
		Format:  own.format,
	}
	r.Commands = append(r.Commands, cmd)

	for _, sub := range subcommands {
		if err := r.walk(sub, path, own); err != nil {
			return err
		}
	}
	return nil
}

// declarations layers a node's own declarations over what it inherits. Only a
// direct child counts: a <cwd> inside <steps>, or inside a <transport>,
// belongs to that thing rather than to the command tree.
func declarations(node *validator.Element, path string, inherited settings) settings {
	out := inherited
	for _, child := range node.ChildElements() {
		switch child.Local {
		case "run":
			out.run = &Run{From: path, Kind: runKind(child)}
		case "cwd":
			out.cwd = &Setting{From: path, Value: strings.TrimSpace(child.TextContent())}
		case "stdin":
			out.stdin = &Setting{From: path}
		case "confirm":
			out.confirm = &Setting{From: path}
		case "format":
			out.format = &Setting{From: path}
		}
	}
	return out
}

// runKind names which of the three things a <run> is. A <request> child makes
// it a request, an <argv> child makes it an argv list, and text alone makes it
// shell.
func runKind(run *validator.Element) string {
	for _, child := range run.ChildElements() {
		switch child.Local {
		case "request":
			return "request"
		case "argv":
			return "argv"
		}
	}
	return "shell"
}

func children(node *validator.Element, local string) []*validator.Element {
	var out []*validator.Element
	for _, child := range node.ChildElements() {
		if child.Local == local {
			out = append(out, child)
		}
	}
	return out
}

func attrIs(node *validator.Element, local, want string) bool {
	value, ok := node.Attr(local)
	return ok && value == want
}

func rootName(root *validator.Element) string {
	if root == nil {
		return ""
	}
	return root.Local
}

func pathOf(parentPath string) string {
	if parentPath == "" {
		return "/"
	}
	return parentPath
}
