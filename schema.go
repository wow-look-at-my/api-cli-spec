package spec

import _ "embed"

// Schema is api-cli.xsd, the grammar of a document. A consumer validates
// against this rather than keeping a copy of the file, so the text is shared
// and nothing drifts.
//
//go:embed api-cli.xsd
var Schema string

// ResolvedSchema is resolved.xsd, the grammar of a resolved document.
//
//go:embed resolved.xsd
var ResolvedSchema string
