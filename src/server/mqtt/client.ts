import mqtt, { type MqttClient } from 'mqtt';

function createMqttClient(): MqttClient {
	const brokerUrl = process.env.MQTT_BROKER_URL;

	if (!brokerUrl) {
		throw new Error('MQTT_BROKER_URL is not configured');
	}

	const client = mqtt.connect(brokerUrl, {
		username: process.env.MQTT_USERNAME,
		password: process.env.MQTT_PASSWORD,
		clientId: process.env.MQTT_CLIENT_ID,
		reconnectPeriod: 5000,
	});

	client.on('error', (error) => {
		console.error('[mqtt] connection error', error);
	});

	return client;
}

declare global {
	var __mqttClient: MqttClient | undefined;
}

// Singleton across hot-reloads, same pattern as src/server/db/prisma.ts —
// without this, `next dev` would open a new broker connection on every file save.
export const mqttClient: MqttClient = globalThis.__mqttClient ?? createMqttClient();

if (process.env.NODE_ENV !== 'production') {
	globalThis.__mqttClient = mqttClient;
}
