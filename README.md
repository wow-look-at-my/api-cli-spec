# api-cli-spec

The specification of the XML configuration language that [api-cli](https://github.com/wow-look-at-my/api-cli) loads.

`api-cli.xsd` is the schema. `examples/` holds the documents that prove it. `tools/check.ts` is the suite, and `dats/spec.dats` runs it.

## Check a document

```sh
xml-validator --schema api-cli.xsd path/to/api.xml
```

[xml-validator](https://github.com/wow-look-at-my/xml-validator) reads XML 1.1 only, so a document must open with `<?xml version="1.1" encoding="UTF-8"?>`.

## Run the suite

```sh
dats dats/
```

Every document under `examples/valid` must validate. Every document under `examples/invalid` must be rejected, for the reason it states in its own comment:

```xml
<!-- rejects: attribute "type" on element "flag": value "date" is not one of the allowed values -->
```

The declared reason is what makes a rejection fixture a test. A document rejected for some other reason fails the suite, so a schema that refuses everything cannot read as complete coverage. The checker walks the whole directory, so a fixture nobody named cannot exist. Four negative controls in `dats/spec.dats` each break one property and demand the failure. A checker that cannot go red reports a green specification whatever the schema says.

## What the language looks like

The root is `<config name="...">`, and it holds commands. A command runs a shell command, an argv list, or an HTTP request, and it may declare args, flags, vars, steps, an output shape, and subcommands.

Element content mixes text with three placeholders, which compile to Go templates. [api-dsl](https://github.com/wow-look-at-my/api-dsl) owns that lexical layer, for api-cli and for every other consumer:

- `<value name="var.x" default="d" as="f"/>` reads a context path. `<value expr="{{ . }}"/>` is a verbatim template instead.
- `<if test="path" eq="literal">...<else/>...</if>` branches.
- `<for each="path">...</for>` repeats, rebinding `.` to each element.

`examples/valid/` is the tour: `minimal`, `placeholders`, `request`, `transports`, `downloads`, `fields`, `tml`, `formats`, `tree`, and `unordered`.

## Child elements are order-free

api-cli dispatches on an element's name, never on its position. `<fields>` before `<run>` loads exactly as well as after it. Every structural element in the schema therefore uses `xs:all`, and `examples/valid/unordered.xml` is what keeps it that way.

## Where the schema is stricter than the loader

One place, on purpose. The loader reads a boolean attribute as `value == "true"`, so `required="1"` and `required="yes"` are both false, silently. The schema permits `true` and `false` and nothing else, which turns that silent misreading into an error. `examples/invalid/boolean-not-true-or-false.xml` pins it.

Everywhere else the schema accepts exactly what the loader accepts. Building it, we checked each rule against every configuration in api-cli's own test suite, and against its shipped `api.example.xml` and `samples/github/github.xml`.

## What the schema cannot state

These rules hold, and api-cli reports each one at load time. XSD reaches an element's own attributes and its content model, and none of the rules below fit in either.

| Rule | Why a schema cannot carry it |
|---|---|
| `<entry>` holds an object whose keys are the author's own element names | An open wildcard needs `processContents="lax"`, which xml-validator refuses by design. `<entry>` is the ur-type here, and the loader owns its shape. |
| A leaf needs a run, its own or an ancestor's | It reads the ancestor chain. |
| `<download>`, `<fields>`, `<steps>`, `<entry>` and `<preconditions>` need a node that runs | They read whether the node has subcommands. |
| `<fields>` and `<format>`, or `<tml>` and `<fields>`, are exclusive | Two sibling elements, not one element's attributes. |
| `<download>` takes neither `<fields>` nor `<format>` | The same. |
| `runnable="true"` needs subcommands, and each of its args needs a `pattern=` | It reads the node's children. |
| An arg `pattern=` compiles, and matches no subcommand name | It reads the sibling commands, and it runs a regular expression engine. |
| `passthrough="true"` is leaf-only, and takes no args | It reads the node's children. |
| A variadic arg comes last, and a required arg never follows an optional one | Order among siblings of one name. |
| `conflicts=` names a flag on the same node | It reads the sibling flags. |
| `transport=` names a declared transport | The name `http` is legal and declares nothing, so an `xs:keyref` rejects a correct document. |
| At most one transport is the default | "At most one true" is not a uniqueness constraint. |
| `allow-status=` needs the built-in client | It reads the transport registry. |
| A precondition cannot read `.result` | It reads the template body. |
| `<format ref=>` names a declared format | The reference crosses from a command to the top-level `<formats>`, past the subtree an identity constraint selects over. |

## The schema in api-cli

api-cli ships a copy of this schema, which `api-cli docs schema` prints. Its CI fails when that copy drifts from this one.
