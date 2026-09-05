// The specification's suite.
//
// Every document under testdata/ validates against api-cli.xsd, its resolved
// form validates against resolved.xsd, and resolving the document produces
// that form. The last of those is the test with something to say: a schema
// states what a document may contain, and only this states what it means.
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

const resolvedSuffix = ".resolved.xml"

// documents names every source document under testdata, by base name.
func documents(t *testing.T) []string {
	t.Helper()
	entries, err := filepath.Glob(filepath.Join("testdata", "*.xml"))
	require.NoError(t, err)

	var names []string
	for _, path := range entries {
		if strings.HasSuffix(path, resolvedSuffix) {
			continue
		}
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

func validate(t *testing.T, path, schema string) {
	t.Helper()
	file, err := os.Open(path)
	require.NoError(t, err)
	defer file.Close()

	xsd, err := os.Open(schema)
	require.NoError(t, err)
	defer xsd.Close()

	assert.NoError(t, validator.ValidateWithSchema(file, xsd), "%s must validate against %s", path, schema)
}

func TestEveryDocumentValidatesAgainstTheSchema(t *testing.T) {
	for _, name := range documents(t) {
		t.Run(name, func(t *testing.T) {
			validate(t, filepath.Join("testdata", name+".xml"), "api-cli.xsd")
			validate(t, filepath.Join("testdata", name+resolvedSuffix), "resolved.xsd")
		})
	}
}

// A document with no resolved form states what it may say and never what it
// means, and a resolved form with no document describes nothing.
func TestEveryDocumentHasItsResolvedForm(t *testing.T) {
	sources := documents(t)
	for _, name := range sources {
		assert.FileExists(t, filepath.Join("testdata", name+resolvedSuffix))
	}

	resolved, err := filepath.Glob(filepath.Join("testdata", "*"+resolvedSuffix))
	require.NoError(t, err)
	for _, path := range resolved {
		name := strings.TrimSuffix(filepath.Base(path), resolvedSuffix)
		assert.Contains(t, sources, name, "%s resolves a document that is not here", path)
	}
}

func TestResolveProducesTheStatedForm(t *testing.T) {
	for _, name := range documents(t) {
		t.Run(name, func(t *testing.T) {
			got, err := spec.Resolve(parse(t, filepath.Join("testdata", name+".xml")))
			require.NoError(t, err)

			want, err := spec.ParseResolved(parse(t, filepath.Join("testdata", name+resolvedSuffix)))
			require.NoError(t, err)

			assert.Equal(t, want, got)
		})
	}
}

func TestResolveRejectsADocumentItCannotRead(t *testing.T) {
	notAConfig := parse(t, filepath.Join("testdata", "minimal"+resolvedSuffix))
	_, err := spec.Resolve(notAConfig)
	require.ErrorContains(t, err, "rooted at <config>")

	notResolved := parse(t, filepath.Join("testdata", "minimal.xml"))
	_, err = spec.ParseResolved(notResolved)
	require.ErrorContains(t, err, "rooted at <resolved>")
}
