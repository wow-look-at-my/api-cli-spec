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
// The controls at the bottom run first, every time. Each builds a small tree
// that breaks one property and demands the failure. A checker that cannot go
// red reports a green specification whatever the schema says.
import { readdirSync, readFileSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

// A schema small enough to read at a glance, for the controls.
const TOY_SCHEMA = `<?xml version="1.1" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
\t<xs:element name="config">
\t\t<xs:complexType>
\t\t\t<xs:attribute name="name" use="required"/>
\t\t</xs:complexType>
\t</xs:element>
</xs:schema>
`;
const OPEN_SCHEMA = TOY_SCHEMA.replace('<xs:attribute name="name" use="required"/>', "<xs:anyAttribute/>");
const DECL = '<?xml version="1.1" encoding="UTF-8"?>';

// control returns null when the checker caught the break, and the complaint
// when it did not.
function control(name: string, schema: string, valid: string, invalid: string, want: string): string | null {
	const root = mkdtempSync(join(tmpdir(), "api-cli-spec-"));
	try {
		mkdirSync(join(root, "examples/valid"), { recursive: true });
		mkdirSync(join(root, "examples/invalid"), { recursive: true });
		writeFileSync(join(root, "api-cli.xsd"), schema);
		writeFileSync(join(root, "examples/valid/a.xml"), valid);
		writeFileSync(join(root, "examples/invalid/b.xml"), invalid);
		const { failures } = checkTree(root);
		if (failures.some((f) => f.why.includes(want))) return null;
		const saw = JSON.stringify(failures.map((f) => f.why));
		return `${name}: expected a failure mentioning ${JSON.stringify(want)}, saw ${saw}`;
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

const good = `${DECL}\n<config name="x"/>\n`;
const rejected = `${DECL}\n<!-- rejects: unexpected attribute "nope" on element "config" -->\n<config name="x" nope="1"/>\n`;
const undeclared = `${DECL}\n<config name="x" nope="1"/>\n`;
const wrongReason = `${DECL}\n<!-- rejects: a reason this document never produces -->\n<config name="x" nope="1"/>\n`;

const broken = [
	control("a valid fixture the schema rejects", TOY_SCHEMA, `${DECL}\n<config/>\n`, rejected, "must validate, and did not"),
	control("an invalid fixture with no declared reason", TOY_SCHEMA, good, undeclared, "no <!-- rejects: ... --> comment"),
	control("an invalid fixture rejected for the wrong reason", TOY_SCHEMA, good, wrongReason, "rejected for the wrong reason"),
	control("an invalid fixture the schema accepts", OPEN_SCHEMA, good, rejected, "and validated instead"),
].filter((c): c is string => c !== null);

if (broken.length > 0) {
	for (const b of broken) console.error(`BROKEN ${b}`);
	console.error("\nthis checker cannot report the failures it exists to report");
	process.exit(1);
}

const { failures, checked } = checkTree(process.argv[2] ?? ".");
for (const f of failures) console.error(`FAIL ${f.file}: ${f.why}`);
if (failures.length > 0) {
	console.error(`\n${failures.length} of ${checked} fixtures failed`);
	process.exit(1);
}
console.log(`ok: 4 controls, ${checked} fixtures`);
