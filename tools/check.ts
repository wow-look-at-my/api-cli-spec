// The specification's test suite.
//
// Both schemas must parse. Every document under examples/valid must validate
// against api-cli.xsd, and its resolved form under examples/resolved must
// validate against resolved.xsd. The two directories pair by name, and a file
// on one side with no partner on the other fails the run: an example with no
// resolved form states what a document may say and never what it means.
//
// There is no rejection corpus. A document the schema refuses states nothing
// the schema does not already state itself, so it is the same rule written
// twice in two files.
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
	return names;
}

// A document's name= and its resolved form's config= must agree, so a resolved
// file cannot quietly describe a document other than the one it is paired with.
function configName(text: string): string | null {
	const m = /<(?:config|resolved)\b[^>]*\bname="([^"]*)"/.exec(text) ?? /<resolved\b[^>]*\bconfig="([^"]*)"/.exec(text);
	return m ? m[1] : null;
}

// checkTree reports everything wrong with one specification tree, and how many
// documents it read to find out.
function checkTree(root: string): { failures: Failure[]; checked: number } {
	const failures: Failure[] = [];
	let checked = 0;
	const schemas = { source: join(root, "api-cli.xsd"), resolved: join(root, "resolved.xsd") };

	for (const schema of Object.values(schemas)) {
		const wellFormed = spawnSync(validator, [schema], { encoding: "utf8" });
		if (wellFormed.status !== 0) {
			failures.push({ file: schema, why: `the schema is not a valid XML 1.1 document: ${wellFormed.stderr.trim()}` });
		}
	}

	const validDir = join(root, "examples/valid");
	const resolvedDir = join(root, "examples/resolved");
	const sources = fixtures(validDir);
	const resolved = new Set(fixtures(resolvedDir));

	for (const name of resolved) {
		if (!sources.includes(name)) {
			failures.push({ file: join(resolvedDir, name), why: `no examples/valid/${name} to resolve` });
		}
	}

	for (const name of sources) {
		checked++;
		const source = join(validDir, name);
		const got = validate(schemas.source, source);
		if (!got.ok) failures.push({ file: source, why: `must validate, and did not: ${got.output}` });

		if (!resolved.has(name)) {
			failures.push({ file: source, why: `no examples/resolved/${name}, so nothing states what it means` });
			continue;
		}
		checked++;
		const target = join(resolvedDir, name);
		const out = validate(schemas.resolved, target);
		if (!out.ok) {
			failures.push({ file: target, why: `must validate, and did not: ${out.output}` });
			continue;
		}
		const want = configName(readFileSync(source, "utf8"));
		const have = configName(readFileSync(target, "utf8"));
		if (want !== have) {
			failures.push({ file: target, why: `config="${have}" names a document other than "${want}"` });
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
