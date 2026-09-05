module github.com/wow-look-at-my/api-cli-spec

go 1.26

require (
	github.com/stretchr/testify v1.12.1
	github.com/wow-look-at-my/xml-validator/validator v0.0.0-20260905064311-b54c8b4b3c13 // go-toolchain:auto-branch
)

require (
	github.com/wow-look-at-my/go-containers v0.0.0-20260826161058-40a3d1ef3d41 // indirect; go-toolchain:auto-branch
	github.com/wow-look-at-my/xml-validator/reader v0.0.0-20260905064311-b54c8b4b3c13 // indirect; go-toolchain:auto-branch
	go.yaml.in/yaml/v3 v3.0.5 // indirect
)

// The validator's own go.mod names a reader revision that no longer resolves.
// Pointing every version of the reader at the one the validator was built from
// keeps the module graph loadable.
replace github.com/wow-look-at-my/xml-validator/reader => github.com/wow-look-at-my/xml-validator/reader v0.0.0-20260905064311-b54c8b4b3c13 // go-toolchain:auto-branch
