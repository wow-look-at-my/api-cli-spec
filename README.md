# api-cli-spec

The specification of the api-cli XML configuration language. This repository is the authoritative source of truth for the language. An implementation conforms to it, and it never derives from an implementation.

`api-cli.xsd` says what a document may contain. `resolved.xsd` says what a reader must work out from one. `examples/valid/` holds a worked document per feature, `examples/resolved/` holds each one's resolved form, and `tools/check.ts` is the suite.

## Check a document

```sh
xml-validator --schema api-cli.xsd path/to/api.xml
```

[xml-validator](https://github.com/wow-look-at-my/xml-validator) reads XML 1.1 only. A document must open with `<?xml version="1.1" encoding="UTF-8"?>`.

## Run the suite

```sh
node tools/check.ts
```

Both schemas must parse. Every document under `examples/valid` must validate against `api-cli.xsd`, and its resolved form under `examples/resolved` must validate against `resolved.xsd`. The two directories pair by filename, and a file on either side with no partner fails the run. The checker walks both directories, so a fixture nobody named cannot exist.

There is no rejection corpus, on purpose. A document the schema refuses states nothing the schema does not already state itself. It is the same rule written twice in two files. Nothing loosens an `xs:element` by accident either. An XSD is declarative and hand-written, so a rule changes only when somebody changes it, deliberately. A fixture pinned against that fires exactly when the spec moved on purpose. The answer is then always to delete the fixture.

What `examples/valid` carries is what a schema cannot state about itself: a worked document per feature of the language, written to be read.

## Conformance

An example on its own says what a document may look like. It never says what the document means, and meaning is the part two readers disagree about. `examples/resolved/` closes that: for each example, the tree a reader must arrive at.

An implementation reads an example, emits its resolved form, and compares. The comparison is on the values, and attribute order and whitespace carry nothing. A conformance suite therefore lives here, in the specification, rather than beside one reader where it drifts from every other.

## Resolution

A document states each setting where an author wrote it. A command's effective settings come from walking its ancestors, so the answer appears in no single place in the source. These are the rules that produce `examples/resolved/`.

- **A node runs** when it is a leaf, or when it declares `runnable="true"`.
- **`<run>`, `<cwd>`, `<stdin>`, `<confirm>` and `<format>` inherit.** A node's effective value is its own declaration, or the nearest ancestor's, or none. The document root is an ancestor of every top-level command.
- **A `<run>` replaces an inherited one entirely.** It is one of three things, and the nearest declaration decides which.
- **A `<download>` node needs no run.** Its declarations are the action, and they follow the node's steps.
- **A `<transport>` owns its `<cwd>` and `<stdin>`.** Those belong to the transport's program, and no command inherits them.
- **A var or a flag is visible to the node that declares it and to that node's descendants.** `examples/valid/tree.xml` reads a parent's var from a child, so the corpus already commits to this.

A resolved file names the node each winning value came from. That is what a reader has to get right. It is also the one thing the source document never writes down.

## What the language looks like

The root is `<config name="...">`. It holds commands. A command runs a shell command, an argv list, or an HTTP request. It may also declare args, flags, vars, steps, an output shape, and subcommands.

Element content mixes text with three placeholders:

- `<value name="var.x" default="d" as="f"/>` reads a context path. `<value expr="{{ . }}"/>` is a verbatim template instead.
- `<if test="path" eq="literal">...<else/>...</if>` branches.
- `<for each="path">...</for>` repeats, rebinding `.` to each element.

`examples/valid/` is the tour: `minimal`, `placeholders`, `request`, `transports`, `downloads`, `join-and-poll`, `fields`, `tml`, `formats`, `tree`, and `unordered`.

## Child elements are order-free

A document means the same thing whatever order its children appear in. `<fields>` before `<run>` says exactly what `<fields>` after `<run>` says. Every structural element in the schema therefore uses `xs:all`, and `examples/valid/unordered.xml` is what keeps it that way.

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
