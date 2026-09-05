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

Each document under `testdata/` validates against `api-cli.xsd`, and its `.resolved.xml` partner validates against `resolved.xsd`. A file on either side with no partner fails the run, so a document cannot arrive without its meaning.

The test that carries the weight is the third one. It resolves each document with `Resolve` and compares the result against the partner file, on the values: attribute order and whitespace carry nothing. That comparison is the only place the resolution rules are executable. A schema states what a document may contain, and the rules below state what it means.

There is no rejection corpus, on purpose. A document the schema refuses states nothing the schema does not already state itself. It is the same rule written twice in two files. Nothing loosens an `xs:element` by accident either. An XSD is declarative and hand-written, so a rule changes only when somebody changes it, deliberately.

## Conformance

`Resolve` is the reference reader, and it reads structure only. It never renders a placeholder, and it depends on no implementation of the language.

A second implementation reads a document, emits the resolved form, and compares against the partner file. The comparison is on the values. A conformance suite therefore lives here, in the specification, rather than beside one reader where it drifts from every other.

## Resolution

A document states each setting where an author wrote it. A command's effective settings come from walking its ancestors, so the answer appears in no single place in the source. These are the rules the suite runs.

- **A node runs** when it is a leaf, or when it declares `runnable="true"`.
- **`<run>`, `<cwd>`, `<stdin>`, `<confirm>` and `<format>` inherit.** A node's effective value is its own declaration, or the nearest ancestor's, or none. The document root is an ancestor of every top-level command.
- **A `<run>` replaces an inherited one entirely.** It is one of three things, and the nearest declaration decides which.
- **A `<download>` node needs no run.** Its declarations are the action, and they follow the node's steps.
- **A `<transport>` owns its `<cwd>` and `<stdin>`.** Those belong to the transport's program, and no command inherits them.
- **A var or a flag is visible to the node that declares it and to that node's descendants.** `testdata/tree.xml` reads a parent's var from a child, so the corpus already commits to this.

A resolved file names the node each winning value came from. That is what a reader has to get right. It is also the one thing the source document never writes down.

## What the language looks like

The root is `<config name="...">`. It holds commands. A command runs a shell command, an argv list, or an HTTP request. It may also declare args, flags, vars, steps, an output shape, and subcommands.

Element content mixes text with three placeholders:

- `<value name="var.x" default="d" as="f"/>` reads a context path. `<value expr="{{ . }}"/>` is a verbatim template instead.
- `<if test="path" eq="literal">...<else/>...</if>` branches.
- `<for each="path">...</for>` repeats, rebinding `.` to each element.

`testdata/` is the tour: `minimal`, `placeholders`, `request`, `transports`, `downloads`, `join-and-poll`, `fields`, `tml`, `formats`, `tree`, `group`, and `unordered`.

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
| `<download>`, `<fields>`, `<steps>`, `<entry>` and `<preconditions>` need a node that runs | They read whether the node has subcommands. |
| `<fields>` and `<format>`, or `<tml>` and `<fields>`, are exclusive | Two sibling elements, not one element's attributes. |
| `<download>` takes neither `<fields>` nor `<format>` | The same. |
| `group=` and `order=` need a `<join>` | An attribute and a child element of the same node. |
| `<join contiguous=>` needs `order=`, and a joined part needs its own `<to>` | The same. |
| `runnable="true"` needs subcommands, and each of its args needs a `pattern=` | It reads the node's children. |
| An arg `pattern=` compiles, and matches no subcommand name | It reads the sibling commands, and it runs a regular expression engine. |
| `passthrough="true"` is leaf-only, and takes no args | It reads the node's children. |
| A variadic arg comes last, and a required arg never follows an optional one | Order among siblings of one name. |
| `conflicts=` names a flag on the same node | It reads the sibling flags. |
| `transport=` names a declared transport | The name `http` is legal and declares nothing, so an `xs:keyref` rejects a correct document. |
| At most one transport is the default | "At most one true" is not a uniqueness constraint. |
| `allow-status=` needs the default transport | It reads which transport the request resolves to. |
| A precondition cannot read `.result` | It reads the template body. |
| `<format ref=>` names a declared format | The reference crosses from a command to the top-level `<formats>`, past the subtree an identity constraint selects over. |
