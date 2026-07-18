import { mqttClient } from './client';

// Hardcoded for testing — every device publishes to the same topic today.
// Replace with a per-device IMEI lookup once IMEI is tracked in the device
// schema (DeviceInverter/DeviceConnectionStatus don't have it yet).
const TEST_IMEI = '866192071837544';

function buildTopic(imei: string): string {
	return `polycabsolarwrite/new/gsm/ongrid/log/ec600u/${imei}`;
}

const PUBLISH_ACK_TIMEOUT_MS = 5000;

// Resolves true/false, never rejects/throws — a broker outage or slow ack
// reports as `false` rather than failing the HTTP request that triggered
// this. read_pattern and write_pattern both go to the same topic — the
// $RL:/$WL: prefix in the payload is what tells the device which operation
// it is. The boolean only reflects the broker accepting the publish (QoS 1
// PUBACK), not that the physical device received or acted on it.
export function publishRemoteSettingPattern(pattern: string): Promise<boolean> {
	const topic = buildTopic(TEST_IMEI);

	return new Promise((resolve) => {
		let settled = false;

		const timeout = setTimeout(() => {
			if (settled) return;
			settled = true;
			console.error('[mqtt] publish timed out', { topic, pattern });
			resolve(false);
		}, PUBLISH_ACK_TIMEOUT_MS);

		mqttClient.publish(topic, pattern, { qos: 1, retain: false }, (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);

			if (error) {
				console.error('[mqtt] publish failed', { topic, pattern, error });
				resolve(false);
				return;
			}

			resolve(true);
		});
	});
}
