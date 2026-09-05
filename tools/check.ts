// The specification's test suite.
//
// The schema must parse, and every document under examples/valid must validate
// against it. The whole directory drives the run, so a fixture nobody named
// cannot exist.
//
// There is no rejection corpus. A document the schema refuses states nothing
// the schema does not already state itself, so it is the same rule written
// twice in two files. What examples/valid carries is what a schema cannot
// state about itself: one worked document per feature, written to be read.
import { readdirSync } from "node:fs";
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
	return { failures, checked };
}

const { failures, checked } = checkTree(process.argv[2] ?? ".");
for (const f of failures) console.error(`FAIL ${f.file}: ${f.why}`);
if (failures.length > 0) {
	console.error(`\n${failures.length} of ${checked} fixtures failed`);
	process.exit(1);
}
console.log(`ok: ${checked} fixtures`);
