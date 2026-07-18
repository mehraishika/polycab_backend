#!/usr/bin/env node

// Standalone MQTT subscriber for manually verifying that the app's
// publishRemoteSettingPattern() calls actually reach the broker.
// Runs independently of the Next.js app — load the same env vars the app
// uses (Node 20.6+ supports --env-file natively) and run:
//
//   node --env-file=../.env testMQTT/subscribe.mjs
//
// Uses the `mqtt` package already installed at the project root
// (node_modules resolution walks up from this folder, no separate
// install needed). Credentials are read from env only — never hardcode
// broker credentials into this file.

import mqtt from 'mqtt';

const BROKER_URL = process.env.MQTT_BROKER_URL;
const USERNAME = process.env.MQTT_USERNAME;
const PASSWORD = process.env.MQTT_PASSWORD;
const IMEI = process.env.MQTT_TEST_IMEI || '866192071837544';
const TOPIC = `polycabsolarwrite/new/gsm/ongrid/log/ec600u/${IMEI}`;

if (!BROKER_URL) {
	console.error('MQTT_BROKER_URL is not set. Run with: node --env-file=../.env testMQTT/subscribe.mjs');
	process.exit(1);
}

const client = mqtt.connect(BROKER_URL, {
	username: USERNAME,
	password: PASSWORD,
	// clientId: `polycab_mqtt_test_subscriber_${Date.now()}`,
});

client.on('connect', () => {
	console.log(`[connected] ${BROKER_URL}`);
	client.subscribe(TOPIC, { qos: 1 }, (error) => {
		if (error) {
			console.error('[subscribe error]', error);
			process.exit(1);
		}
		console.log(`[subscribed] ${TOPIC}`);
		console.log('waiting for messages... (Ctrl+C to exit)\n');
	});
});

client.on('message', (topic, payload) => {
	console.log(`[${new Date().toISOString()}] ${topic}`);
	console.log(`  ${payload.toString()}\n`);
});

client.on('reconnect', () => console.log('[reconnecting]'));
client.on('error', (error) => console.error('[error]', error));

process.on('SIGINT', () => {
	console.log('\n[closing]');
	client.end(false, {}, () => process.exit(0));
});
