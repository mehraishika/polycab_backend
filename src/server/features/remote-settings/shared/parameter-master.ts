import { prisma } from './inverter-scope';

// Reads from remote_setting_parameter_master — the register-mapping catalog,
// populated externally (register-mapping exercise). Read-only from here.
// Shared because the query shape is identical for every tab; only the `tab`
// filter changes.

export async function getRegisterMap(tab: string): Promise<Record<string, string | null>> {
	const rows = await prisma.remoteSettingParameterMaster.findMany({
		where: { tab },
		select: { fieldKey: true, registerAddress: true },
	});

	return Object.fromEntries(rows.map((row) => [row.fieldKey, row.registerAddress]));
}

export function pickRegisters(
	registerMap: Record<string, string | null>,
	keys: string[],
): Record<string, string | null> {
	return Object.fromEntries(keys.map((key) => [key, registerMap[key] ?? null]));
}

// Device read-request command string: $RL:[reg1,reg2,...]$[count1,count2,...]$
// — regs and counts are read straight off remote_setting_parameter_master for the tab,
// in displayOrder. `count` is how many consecutive registers that field occupies.
export async function getReadPattern(tab: string): Promise<string> {
	const rows = await prisma.remoteSettingParameterMaster.findMany({
		where: { tab, registerAddress: { not: null } },
		select: { registerAddress: true, count: true },
		orderBy: { displayOrder: 'asc' },
	});

	const regs = rows.map((row) => row.registerAddress).join(',');
	const counts = rows.map((row) => row.count).join(',');

	return `$RL:[${regs}]$[${counts}]$`;
}

// Boolean -> 1/0 and a numeric array pass through as-is (for count>1 fields).
// Strings (enum/free-text settings) have no defined register encoding yet,
// so those fields are left out of the pattern rather than guessed at.
// Exported so shared/command-master.ts can reuse the same encoding rule.
export function encodeWriteValue(value: unknown): string | undefined {
	if (typeof value === 'boolean') return value ? '1' : '0';
	if (typeof value === 'number') return String(value);
	if (Array.isArray(value) && value.every((entry) => typeof entry === 'number')) {
		return `[${value.join(',')}]`;
	}

	return undefined;
}

export interface WritePatternResult {
	pattern: string;
	// Submitted keys that made it into `pattern` come from remote_setting_parameter_master
	// row-by-row; anything submitted but not device-writable ends up here instead of
	// silently vanishing — no register mapped for that field (tab/master data not
	// seeded for it yet), or an encodable value wasn't determinable (e.g. a string
	// enum with no defined register encoding).
	unmappedFields: string[];
}

// Device write command string: $WL:[reg1:val1,reg2:val2,...]$[count1,count2,...]$
// — built from the submitted settings values paired with each field's
// registerAddress/count from remote_setting_parameter_master, in displayOrder.
// Every key in `settings` is checked against the register table; only fields
// with both a real register and an encodable value are included in `pattern`.
export async function getWritePattern(
	tab: string,
	settings: Record<string, unknown>,
): Promise<WritePatternResult> {
	const rows = await prisma.remoteSettingParameterMaster.findMany({
		where: { tab, registerAddress: { not: null } },
		select: { fieldKey: true, registerAddress: true, count: true },
		orderBy: { displayOrder: 'asc' },
	});

	console.log("TAB:", tab);
	console.log("Rows:", rows);

	const registerByFieldKey = new Map(rows.map((row) => [row.fieldKey, row]));
	const entries: string[] = [];
	const counts: number[] = [];
	const unmappedFields: string[] = [];

	// Walk rows (already in displayOrder) so pattern entries stay in the same
	// canonical order as read_pattern, regardless of the JSON key order the
	// client happened to submit. Any submitted key with no matching row is
	// checked in a second pass so it's still reported even though it can't
	// contribute an entry.
	for (const row of rows) {
		if (!(row.fieldKey in settings)) continue;

		const encoded = encodeWriteValue(settings[row.fieldKey]);

		if (encoded === undefined) {
			unmappedFields.push(row.fieldKey);
			continue;
		}

		entries.push(`${row.registerAddress}:${encoded}`);
		counts.push(row.count);
	}

	for (const key of Object.keys(settings)) {
		if (!registerByFieldKey.has(key)) unmappedFields.push(key);
	}

	return {
		pattern: `$WL:[${entries.join(',')}]$[${counts.join(',')}]$`,
		unmappedFields,
	};
}
