const { createApp } = require('./app'); const { env } = require('./config/env'); createApp().listen(env.port, () => console.log(`American Latin Class API listening on ${env.port}`));
