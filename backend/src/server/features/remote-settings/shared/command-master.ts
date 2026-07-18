import { prisma } from './inverter-scope';
import { encodeWriteValue } from './parameter-master';

// Reads from remote_setting_command_master — the register-mapping catalog
// for the /remote-settings/command endpoint's four actions (afdReset,
// syncDateTime, reset, clearAllData). Kept separate from
// remote_setting_parameter_master because commands aren't tab-scoped
// settings — no `tab` column, just one row per command key. Populated
// externally, read-only from here.

export async function getCommandRegisterMap(): Promise<Record<string, string | null>> {
	const rows = await prisma.remoteSettingCommandMaster.findMany({
		select: { commandKey: true, registerAddress: true },
	});

	return Object.fromEntries(rows.map((row) => [row.commandKey, row.registerAddress]));
}

// Device read-request command string: $RL:[reg1,reg2,...]$[count1,count2,...]$
// — regs and counts are read straight off remote_setting_command_master,
// in displayOrder. `count` is how many consecutive registers that command occupies
// (e.g. syncDateTime spans 4 registers to carry a full date/time payload).
export async function getCommandReadPattern(): Promise<string> {
	const rows = await prisma.remoteSettingCommandMaster.findMany({
		where: { registerAddress: { not: null } },
		select: { registerAddress: true, count: true },
		orderBy: { displayOrder: 'asc' },
	});

	const regs = rows.map((row) => row.registerAddress).join(',');
	const counts = rows.map((row) => row.count).join(',');

	return `$RL:[${regs}]$[${counts}]$`;
}

export interface WritePatternResult {
	pattern: string;
	unmappedFields: string[];
}

// Device write command string: $WL:[reg1:val1,reg2:val2,...]$[count1,count2,...]$
// — built from the submitted command values paired with each action's
// registerAddress/count from remote_setting_command_master, in displayOrder.
// Every key in `command` is checked against the register table; only actions
// with both a real register and an encodable value are included in `pattern`.
export async function getCommandWritePattern(command: Record<string, unknown>): Promise<WritePatternResult> {
	const rows = await prisma.remoteSettingCommandMaster.findMany({
		where: { registerAddress: { not: null } },
		select: { commandKey: true, registerAddress: true, count: true },
		orderBy: { displayOrder: 'asc' },
	});

	const registerByCommandKey = new Map(rows.map((row) => [row.commandKey, row]));
	const entries: string[] = [];
	const counts: number[] = [];
	const unmappedFields: string[] = [];

	for (const row of rows) {
		if (!(row.commandKey in command)) continue;

		const encoded = encodeWriteValue(command[row.commandKey]);

		if (encoded === undefined) {
			unmappedFields.push(row.commandKey);
			continue;
		}

		entries.push(`${row.registerAddress}:${encoded}`);
		counts.push(row.count);
	}

	for (const key of Object.keys(command)) {
		if (!registerByCommandKey.has(key)) unmappedFields.push(key);
	}

	return {
		pattern: `$WL:[${entries.join(',')}]$[${counts.join(',')}]$`,
		unmappedFields,
	};
}
