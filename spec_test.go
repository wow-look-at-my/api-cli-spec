// The specification's suite: resolving each document under testdata/ produces
// the form under testdata/resolved/. A schema states what a document may
// contain. Only this states what it means.
//
// Whether the schema accepts a document is xml-validator's answer, and CI asks
// it by running that tool. Asking it again from here tests xml-validator.
package spec_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wow-look-at-my/xml-validator/validator"

	spec "github.com/wow-look-at-my/api-cli-spec"
)

// The two halves answer to different schemas, so each half is a directory. One
// glob then names it, here and in the job that validates it.
const (
	documentDir = "testdata"
	resolvedDir = "testdata/resolved"
)

// documents names every source document, by base name.
func documents(t *testing.T) []string {
	t.Helper()
	entries, err := filepath.Glob(filepath.Join(documentDir, "*.xml"))
	require.NoError(t, err)

	var names []string
	for _, path := range entries {
		names = append(names, strings.TrimSuffix(filepath.Base(path), ".xml"))
	}
	require.NotEmpty(t, names, "testdata holds no documents")
	return names
}

func parse(t *testing.T, path string) *validator.Document {
	t.Helper()
	file, err := os.Open(path)
	require.NoError(t, err)
	defer file.Close()

	doc, err := validator.ParseTree(file)
	require.NoError(t, err, "%s does not parse", path)
	return doc
}

// validate reads the schema from the package's own embedded copy, which is
// the text a consumer gets, rather than from the file beside it.
func validate(t *testing.T, path, schema, schemaName string) {
	t.Helper()
	file, err := os.Open(path)
	require.NoError(t, err)
	defer file.Close()

	err = validator.ValidateWithSchema(file, strings.NewReader(schema))
	assert.NoError(t, err, "%s must validate against %s", path, schemaName)
}

func TestEveryDocumentValidatesAgainstTheSchema(t *testing.T) {
	for _, name := range documents(t) {
		t.Run(name, func(t *testing.T) {
			validate(t, filepath.Join("testdata", name+".xml"), spec.Schema, "api-cli.xsd")
			validate(t, filepath.Join("testdata", name+resolvedSuffix), spec.ResolvedSchema, "resolved.xsd")
		})
	}
}

// A document with no resolved form states what it may say and never what it
// means, and a resolved form with no document describes nothing.
func TestEveryDocumentHasItsResolvedForm(t *testing.T) {
	sources := documents(t)
	for _, name := range sources {
		assert.FileExists(t, filepath.Join(resolvedDir, name+".xml"))
	}

	resolved, err := filepath.Glob(filepath.Join(resolvedDir, "*.xml"))
	require.NoError(t, err)
	for _, path := range resolved {
		name := strings.TrimSuffix(filepath.Base(path), ".xml")
		assert.Contains(t, sources, name, "%s resolves a document that is not here", path)
	}
}

func TestResolveProducesTheStatedForm(t *testing.T) {
	for _, name := range documents(t) {
		t.Run(name, func(t *testing.T) {
			got, err := spec.Resolve(parse(t, filepath.Join(documentDir, name+".xml")))
			require.NoError(t, err)

			want, err := spec.ParseResolved(parse(t, filepath.Join(resolvedDir, name+".xml")))
			require.NoError(t, err)

			assert.Equal(t, want, got)
		})
	}
}

func TestResolveRejectsADocumentItCannotRead(t *testing.T) {
	notAConfig := parse(t, filepath.Join(resolvedDir, "minimal.xml"))
	_, err := spec.Resolve(notAConfig)
	require.ErrorContains(t, err, "rooted at <config>")

	notResolved := parse(t, filepath.Join(documentDir, "minimal.xml"))
	_, err = spec.ParseResolved(notResolved)
	require.ErrorContains(t, err, "rooted at <resolved>")
}
