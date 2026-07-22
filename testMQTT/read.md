# testMQTT — standalone MQTT subscriber

Verifies that the app's `publishRemoteSettingPattern()` calls (in
`src/server/mqtt/publish-remote-setting.ts`) actually reach the broker.
Runs independently of the Next.js app — plain Node, no build step.

Connects to `119.18.48.66:1883` and subscribes to
`polycabsolarwrite/new/gsm/ongrid/log/ec600u/<IMEI>` (default IMEI
`866192071849342`), printing every message received with a timestamp.

## Commands

Run from the project root
(`/home/khemsingh/Documents/polycab-2026/Tasks/backendapps/backendapps`):

```bash
node --env-file=.env testMQTT/subscribe.mjs
```

If you're already inside `testMQTT/` instead:

```bash
node --env-file=../.env subscribe.mjs
```

Watch a different device's IMEI without editing the file:

```bash
MQTT_TEST_IMEI=<other_imei> node --env-file=.env testMQTT/subscribe.mjs
```

## Usage

1. Leave the subscriber running in its own terminal.
2. In another terminal (or Postman, or the frontend app), hit any
   remote-settings GET or POST endpoint.
3. Within a second or two, the `$RL:...$` (GET) or `$WL:...$` (POST)
   payload should appear in the subscriber's output — confirming
   `mqtt_published: true` in the API response is real, not just a
   broker-ack fiction.
4. Stop the subscriber with `Ctrl+C`.

## Notes

- Credentials (`MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`) are
  read from env only — never hardcoded in `subscribe.mjs`. `--env-file`
  loads them from the app's own `.env` (Node 20.6+ native support).
- Uses the `mqtt` package already installed at the project root —
  Node's module resolution walks up from `testMQTT/` to find it, so no
  separate `npm install` is needed here.
