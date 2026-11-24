# api-cli-spec

The specification of the api-cli XML configuration language. This repository is the authoritative source of truth for the language. An implementation conforms to it, and it never derives from an implementation.

`api-cli.xsd` says what a document may contain. `resolved.xsd` says what a reader must work out from one. `resolve.go` works it out, and `spec_test.go` is the suite that holds it to the documents under `testdata/`.

## Check a document

```sh
xml-validator --schema api-cli.xsd path/to/api.xml
```

[xml-validator](https://github.com/wow-look-at-my/xml-validator) reads XML 1.1 only. A document must open with `<?xml version="1.1" encoding="UTF-8"?>`.

## Run the suite

```sh
go-toolchain
```

Each document under `testdata/` has a partner of the same name under `testdata/resolved/`. A file on either side with no partner fails the run. A document cannot arrive without its meaning. CI validates the first directory against `api-cli.xsd` and the second against `resolved.xsd`, by running `xml-validator` itself.

The test that carries the weight resolves each document with `Resolve`. It compares the result against the partner file, on the values alone: attribute order and whitespace carry nothing. That comparison is the only place the resolution rules are executable. A schema states what a document may contain, and the rules below state what it means.

There is no rejection corpus, on purpose. A document the schema refuses states nothing the schema does not already state itself. It is the same rule written twice in multiple files. Nothing loosens an `xs:element` by accident either. An XSD is declarative and hand-written, so a rule changes only when somebody changes it, deliberately.

## Conformance

`Resolve` is the reference reader. It reads structure only. It never renders a placeholder. It depends on no implementation of the language.

A second implementation reads a document, emits the resolved form, and compares against the partner file. The comparison is on the values. A conformance suite therefore lives here, in the specification, rather than beside one reader where it drifts from every other.

## Resolution

A document states each setting where an author wrote it. A command's effective settings come from walking its ancestors, so the answer appears in no single place in the source. These are the rules the suite runs.

- **A node runs** when it is a leaf, or when it declares `runnable="true"`.
- A node's effective value is its own declaration, or the nearest ancestor's, or none. The document root is an ancestor of every top-level command.
- **A `<run>` replaces an inherited one fully.** It is one of three things, and the nearest declaration decides which.
- **`<preconditions>` collect instead of overriding.** A node runs every guard its ancestors declared, in document order, and then its own. A guard on the root therefore gates every run in the tree, and a guard on a group node gates its subtree.
- **A `<download>` node needs no run.** Its declarations are the action, and they follow the node's steps.
- **A `<transport>` owns its `<cwd>` and `<stdin>`.** Those belong to the transport's program, and no command inherits them.
- **A var or a flag is visible to the node that declares it and to that node's descendants.** `testdata/tree.xml` reads a parent's var from a child, so the corpus already commits to this.

A resolved file names the node each winning value came from. That is what a reader has to get right. It is also the thing the source document never writes down.

## Watch

`watch="5s"` on a command says the node repeats on that interval by default. A reader runs the node, shows the result, waits, and runs it again, until the user stops it. Each run is whole: nothing is kept from the run before it.

The value is an `interval`: a Go duration such as `2s` or `500ms`, or a plain number of seconds such as `2`. A reader holds it to a floor of its own, and rejects a document below that floor at load time.

The attribute inherits like `<confirm>` does, so one `watch=` on a group covers every screen under it. A reader's own repeat flag, `--watch <interval>` in api-cli, overrides the document's value for one invocation. The value `off` on that flag runs the node one time.

A node whose action is a `<download>` never repeats, because a transfer is one thing. A reader rejects `watch=` on such a node at load time. A node that reaches a `<download>` by inheritance alone is fine: the reader ignores the interval there and says so. A tool call over MCP is one run, and a reader ignores the interval there too.

## Decode

`decode="csv"` on a `<run>` names the format of the output that run produces. A reader turns the output into data in that format. Every part of the language that reads the data then sees the same value. The language itself is tied to no one format.

| Value | The data a reader produces |
|---|---|
| `auto` | The default. A response follows its `Content-Type`. Any other output is JSON when it parses, and the trimmed text when it does not. |
| `json` | One JSON value. |
| `ndjson` | A list, one JSON value per line. A blank line is skipped. |
| `csv`, `tsv` | A list of records. The first row names the columns, and every cell is a string. |
| `yaml` | One YAML document. A stream of several documents is a list. |
| `xml` | An object with one key, the root element. An attribute is `@name`. A repeated child is a list. Text beside attributes or children is `#text`. An element with text only is a string. |
| `form` | An object of the `application/x-www-form-urlencoded` pairs. A repeated key is a list. |
| `lines` | A list of strings, one per line. |
| `text` | One string, without the trailing line breaks. |

Under `auto`, these media types name a format. A reader compares the type without its parameters, in any letter case.

| `Content-Type` | Format |
|---|---|
| `text/csv`, `application/csv` | `csv` |
| `text/tab-separated-values` | `tsv` |
| `application/x-ndjson`, `application/ndjson` | `ndjson` |
| `application/jsonl`, `application/jsonlines` | `ndjson` |
| `application/x-jsonlines` | `ndjson` |
| `application/yaml`, `text/yaml` | `yaml` |
| `application/x-yaml`, `text/x-yaml` | `yaml` |
| a type that ends in `+yaml` | `yaml` |
| `application/xml`, `text/xml` | `xml` |
| a type that ends in `+xml` | `xml` |
| `application/x-www-form-urlencoded` | `form` |

Every other type takes the second rule of `auto`, and so does a body that does not read as its type says.

A named format is a claim. Output that is not in that format fails the run, and a reader shows the start of the output. `auto` is a guess. It never fails: output that no format reads is text.

The attribute belongs to the run and travels with it. A node that inherits a run inherits its format. A node that declares its own run takes the format of that run, and a run that names none is `auto`. A step with its own `<run>` follows the same rule, and a step without one reads the output as the node's run says.

A jq program reads the decoded data, so `jq=` works on rows of CSV exactly as on JSON. Its result is JSON. A reader that prints output unshaped prints the bytes as they arrived, whatever the format.

`testdata/decode.xml` shows each value.

## Choices

`choices="open,closed,all"` on an `<arg>` or a `<flag>` is the closed set of values the input takes. Every reader enforces it: the command line rejects any other value, and a tool schema publishes the set as an `enum`. A value the caller left out is not checked, so an optional input still falls back to its default. A flag's default must be one of the choices. A bool takes none. Each value of a variadic arg or a `string-slice` flag is checked on its own.

## Interactive hints

An interactive reader, such as api-cli's `tui` subcommand, shows the command tree and a result browser. It works with no hints at all. It infers the columns of a table, the record list inside an envelope, and the links from one command to another. A `<tui>` element on a command corrects what it inferred. It does not inherit, and it changes nothing about a run.

- `label=` names the node in the tree, and `hidden="true"` leaves the node and its subtree out. A hidden command still runs, and a link may still name it.
- `autorun="true"` runs a command as soon as it is picked, once every required input holds a value.
- `rows=` is the path to the list of records inside a result. `columns=` lists the record paths to show, in order. `title=` is the record path that names a record.
- `<link to="repos view">` opens another command from a record. Each `<with name=>` fills one input of the target. That `<with name=>` is from a record path (`field=`) or a template (`expr=`) that sees the record's keys and. That `<with name=>` is at `.input`, the values typed into the source form. An input no `<with>` names takes the record field of its own name, then the value the user typed for that name in any command.

`suggest="repos list"` on an `<arg>` or a `<flag>` names a command whose result lists likely values for it. `suggest-field=` is the record path that holds each value. A suggestion is advice and never validation.

## Live screens

A `<tml>` screen under `watch=` is live: the reader draws the component itself, so its controls take focus and clicks. Prop sources hold state the reader keeps between runs, rather than read from a result. `<prop name="offset" scroll="log"/>` is how far the user scrolled the element with id `log`. `<prop name="picked" select="jobs"/>` is the row the user picked in the list or table with id `jobs`. Both start at 0, and both hold 0 in a one-shot frame. An element with `action="refresh"` runs the node again when the user activates it.

## What the language looks like

The root is `<config name="...">`. It holds commands. A command runs a shell command, an argv list, or an HTTP request. It may also declare args, flags, vars, steps, an output shape, and subcommands.

Element content mixes text with multiple placeholders:

- `<value name="var.x" default="d" as="f"/>` reads a context path. `<value expr="{{ . }}"/>` is a verbatim template instead, and `<value><expr>{{ . }}</expr></value>` is the same template in its element form.
- `<if test="path" eq="literal">...<else/>...</if>` branches.
- `<for each="path">...</for>` repeats, rebinding `.` to each element.

`testdata/` is the tour.

## A template attribute has an element form

Every attribute that holds a template can be a child element of the same name instead. `testdata/template-elements.xml` shows each one. A long template then spreads over indented lines.

- Plain text is cut into lines. Each line loses its surrounding whitespace, and the lines join with nothing between them.
- A CDATA section is kept as written, with its spaces and newlines.
- Text and CDATA join in document order.
- The element holds text and CDATA only. A placeholder inside it is an error.

```xml
<fields over="data.items">
	<footer>
		{{ len .data.items }}
		<![CDATA[ shown, ]]>
		{{ .data.total }}
		<![CDATA[ in all]]>
	</footer>
</fields>
```

That footer means exactly what `footer="{{ len .data.items }} shown, {{ .data.total }} in all"` means. A line break therefore goes where the template needs no space, and a space at either end of a piece goes in CDATA.

The element content types that hold templates already keep their own rules. Their text mixes with placeholders, and inline whitespace in it is content.

## Child elements are order-free

A document means the same thing whatever order its children appear in. `<fields>` before `<run>` says exactly what `<fields>` after `<run>` says. Every structural element in the schema therefore uses `xs:all`, and `testdata/unordered.xml` is what keeps it that way.

## Booleans

A boolean attribute is `true` or `false`, and nothing else. `1` and `yes` are not booleans in this language, and the schema rejects them by name rather than reading them as false.

## What the schema cannot state

These rules are part of the language. A conforming reader must reject a document that breaks one. XSD reaches an element's own attributes and its content model, and none of the rules below fit in either.

| Rule | Why a schema cannot carry it |
|---|---|
| `<entry>` holds an object whose keys are the author's own element names | An open wildcard needs `processContents="lax"`, which xml-validator refuses by design. Nothing constrains an `<entry>` subtree, so no schema can describe it. |
| A leaf needs a run, its own or an ancestor's | It reads the ancestor chain. |
| `<download>` takes neither `<fields>` nor `<format>` | The same. |
| A `<download>` node declares no `watch=` | An attribute and a child element of the same node. |
| A `watch=` is at or above the reader's floor | The floor belongs to the reader, and a pattern cannot compare a duration. |
| `group=` and `order=` need a `<join>` | An attribute and a child element of the same node. |
| `<join contiguous=>` needs `order=`, and a joined part needs its own `<to>` | The same. |
| `runnable="true"` needs subcommands, and each of its args needs a `pattern=` | It reads the node's children. |
| An arg `pattern=` compiles, and matches no subcommand name | It reads the sibling commands, and it runs a regular expression engine. |
| `passthrough="true"` is leaf-only, and takes no args | It reads the node's children. |
| A variadic arg comes last, and a required arg never follows an optional one | Order among siblings of one name. |
| `conflicts=` names a flag on the same node | It reads the sibling flags. |
| `choices=` lists each value once, an int input lists integers, a bool takes none, and a flag's default is a choice | It reads the input's type and compares values. |
| `suggest=` and a `<link to=>` name a command that runs | They name a node by its path, across the whole tree. |
| A `<with name=>` names an input of the link's target, once per link, with `field=` or `expr=` but not both | It reads the target's args and flags. |
| A `<tui>` on a group takes only `label=` and `hidden=` | It reads whether the node runs. |
| `transport=` names a declared transport | The name `http` is legal and declares nothing, so an `xs:keyref` rejects a correct document. |
| At most one transport is the default | "At most one true" is not a uniqueness constraint. |
| `allow-status=` needs the default transport | It reads which transport the request resolves to. |
| A precondition cannot read `.result` | It reads the template body. |
| A template attribute and its element form are exclusive, and the element appears at most once | An attribute and a child element of the same node. |
| `path=` on `<join>`, come as the attribute or as the element | The same. |
| A field with an `<expr>` element has no path text, and a field without one has a path | Text and a child element of the same node. |
| `<confirm>` and `confirm=` on one command are exclusive | An attribute and a child element of the same node. |
| `<format ref=>` names a declared format | The reference crosses from a command to the top-level `<formats>`, past the subtree an identity constraint selects over. |
