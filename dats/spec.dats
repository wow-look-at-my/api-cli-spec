# The specification's suite. The first test is the real one: it validates every
# fixture in the tree against the schema. The rest are negative controls on the
# checker itself.
#
# A checker that cannot fail reports a complete specification whatever the
# schema says, so each control breaks one property and demands the failure.

tests:
	- desc: every fixture in the tree holds
	  cmd: node tools/check.ts
	  outputs:
		stdout:
			- "ok: "

	- desc: a valid fixture the schema rejects fails the check
	  exit: 1
	  cmd: node tools/check.ts "$(dirname "$(dirname "$(dirname {inputs.examples/valid/broken.xml})")")"
	  inputs:
		files:
			api-cli.xsd: |
				<?xml version="1.1" encoding="UTF-8"?>
				<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
					<xs:element name="config">
						<xs:complexType>
							<xs:attribute name="name" use="required"/>
						</xs:complexType>
					</xs:element>
				</xs:schema>
			examples/valid/broken.xml: |
				<?xml version="1.1" encoding="UTF-8"?>
				<config/>
			examples/invalid/bad.xml: |
				<?xml version="1.1" encoding="UTF-8"?>
				<!-- rejects: unexpected attribute "nope" on element "config" -->
				<config name="x" nope="1"/>
	  outputs:
		stderr:
			- "must validate, and did not"

	- desc: an invalid fixture with no declared reason fails the check
	  exit: 1
	  cmd: node tools/check.ts "$(dirname "$(dirname "$(dirname {inputs.examples/valid/ok.xml})")")"
	  inputs:
		files:
			api-cli.xsd: |
				<?xml version="1.1" encoding="UTF-8"?>
				<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
					<xs:element name="config">
						<xs:complexType>
							<xs:attribute name="name" use="required"/>
						</xs:complexType>
					</xs:element>
				</xs:schema>
			examples/valid/ok.xml: |
				<?xml version="1.1" encoding="UTF-8"?>
				<config name="x"/>
			examples/invalid/undeclared.xml: |
				<?xml version="1.1" encoding="UTF-8"?>
				<config name="x" nope="1"/>
	  outputs:
		stderr:
			- "no <!-- rejects: ... --> comment"

	- desc: an invalid fixture rejected for the wrong reason fails the check
	  exit: 1
	  cmd: node tools/check.ts "$(dirname "$(dirname "$(dirname {inputs.examples/valid/ok.xml})")")"
	  inputs:
		files:
			api-cli.xsd: |
				<?xml version="1.1" encoding="UTF-8"?>
				<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
					<xs:element name="config">
						<xs:complexType>
							<xs:attribute name="name" use="required"/>
						</xs:complexType>
					</xs:element>
				</xs:schema>
			examples/valid/ok.xml: |
				<?xml version="1.1" encoding="UTF-8"?>
				<config name="x"/>
			examples/invalid/wrong-reason.xml: |
				<?xml version="1.1" encoding="UTF-8"?>
				<!-- rejects: a reason this document never produces -->
				<config name="x" nope="1"/>
	  outputs:
		stderr:
			- "rejected for the wrong reason"

	- desc: an invalid fixture the schema accepts fails the check
	  exit: 1
	  cmd: node tools/check.ts "$(dirname "$(dirname "$(dirname {inputs.examples/valid/ok.xml})")")"
	  inputs:
		files:
			api-cli.xsd: |
				<?xml version="1.1" encoding="UTF-8"?>
				<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
					<xs:element name="config">
						<xs:complexType>
							<xs:anyAttribute/>
						</xs:complexType>
					</xs:element>
				</xs:schema>
			examples/valid/ok.xml: |
				<?xml version="1.1" encoding="UTF-8"?>
				<config name="x"/>
			examples/invalid/accepted.xml: |
				<?xml version="1.1" encoding="UTF-8"?>
				<!-- rejects: unexpected attribute "nope" on element "config" -->
				<config name="x" nope="1"/>
	  outputs:
		stderr:
			- "and validated instead"
