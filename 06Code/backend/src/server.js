const { createApp } = require('./app');
const { env } = require('./config/env');

createApp().listen(env.port, env.host, () => {
  console.log(`American Latin Class API listening on ${env.host}:${env.port}`); // eslint-disable-line no-console
});
