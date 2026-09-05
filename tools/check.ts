// The specification's test suite.
//
// Every document under examples/valid must validate against the schema, and
// every document under examples/invalid must be rejected FOR THE REASON IT
// DECLARES. A fixture declares that reason in an XML comment of its own:
//
//	<!-- rejects: unexpected attribute "version" on element "config" -->
//
// The declaration is what makes a negative fixture a test. Without it a
// document rejected for the wrong reason still passes, and a schema that
// rejects everything reads as complete coverage.
//
// The whole directory drives the run, so a fixture nobody named cannot exist.
//
// A fixture earns its place by pinning a decision the schema had to MODEL --
// the xs:alternative sites, where the type depends on the instance. A document
// that only proves an XSD primitive fires (a required attribute, a closed
// content model, an enumeration, an xs:unique) tests the validator, not this
// grammar, and does not belong here.
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const validator = process.env.XML_VALIDATOR ?? "xml-validator";

type Failure = { file: string; why: string };

function validate(schema: string, file: string): { ok: boolean; output: string } {
	const r = spawnSync(validator, ["--schema", schema, file], { encoding: "utf8" });
	if (r.error) throw new Error(`cannot run ${validator}: ${r.error.message}`);
	return { ok: r.status === 0, output: `${r.stdout}${r.stderr}`.trim() };
}

function fixtures(dir: string): string[] {
	const names = readdirSync(dir).filter((n) => n.endsWith(".xml")).sort();
	if (names.length === 0) throw new Error(`${dir} holds no fixtures`);
	return names.map((n) => join(dir, n));
}

// checkTree reports everything wrong with one specification tree, and how many
// documents it read to find out.
function checkTree(root: string): { failures: Failure[]; checked: number } {
	const failures: Failure[] = [];
	let checked = 0;
	const schema = join(root, "api-cli.xsd");

	const wellFormed = spawnSync(validator, [schema], { encoding: "utf8" });
	if (wellFormed.status !== 0) {
		failures.push({ file: schema, why: `the schema is not a valid XML 1.1 document: ${wellFormed.stderr.trim()}` });
	}

	for (const file of fixtures(join(root, "examples/valid"))) {
		checked++;
		const { ok, output } = validate(schema, file);
		if (!ok) failures.push({ file, why: `must validate, and did not: ${output}` });
	}

	for (const file of fixtures(join(root, "examples/invalid"))) {
		checked++;
		const declared = /<!--\s*rejects:\s*(.+?)\s*-->/.exec(readFileSync(file, "utf8"));
		if (!declared) {
			failures.push({ file, why: "no <!-- rejects: ... --> comment, so nothing says why it must fail" });
			continue;
		}
		const want = declared[1];
		const { ok, output } = validate(schema, file);
		if (ok) {
			failures.push({ file, why: `must be rejected for ${JSON.stringify(want)}, and validated instead` });
		} else if (!output.includes(want)) {
			failures.push({ file, why: `rejected for the wrong reason.\n    want: ${want}\n    got:  ${output}` });
		}
	}
	return { failures, checked };
}

const { failures, checked } = checkTree(process.argv[2] ?? ".");
for (const f of failures) console.error(`FAIL ${f.file}: ${f.why}`);
if (failures.length > 0) {
	console.error(`\n${failures.length} of ${checked} fixtures failed`);
	process.exit(1);
}
console.log(`ok: ${checked} fixtures`);
