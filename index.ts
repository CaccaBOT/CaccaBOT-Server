export const server = require('fastify')({
  bodyLimit: 8388608,
  http2: process.env.ENVIRONMENT == 'production'
})
import { FastifyRequest, FastifyReply } from 'fastify'
import { initDatabase } from './database/index'
import fs from 'fs'
import path from 'path'
import fastifyStatic from '@fastify/static'
import { version } from './package.json'
import schedule from 'node-schedule'
import { config, loadConfig } from './config/loader'
import log from 'loglevel'
import { client } from './discord/client'

loadConfig()

log.info('')
log.info(
  '	▄████▄   ▄▄▄       ▄████▄   ▄████▄   ▄▄▄       ▄▄▄▄    ▒█████  ▄▄▄█████▓'
)
log.info(
  '	▒██▀ ▀█  ▒████▄    ▒██▀ ▀█  ▒██▀ ▀█  ▒████▄    ▓█████▄ ▒██▒  ██▒▓  ██▒ ▓▒'
)
log.info(
  '	▒▓█    ▄ ▒██  ▀█▄  ▒▓█    ▄ ▒▓█    ▄ ▒██  ▀█▄  ▒██▒ ▄██▒██░  ██▒▒ ▓██░ ▒░'
)
log.info(
  '	▒▓▓▄ ▄██▒░██▄▄▄▄██ ▒▓▓▄ ▄██▒▒▓▓▄ ▄██▒░██▄▄▄▄██ ▒██░█▀  ▒██   ██░░ ▓██▓ ░ '
)
log.info(
  '	▒ ▓███▀ ░ ▓█   ▓██▒▒ ▓███▀ ░▒ ▓███▀ ░ ▓█   ▓██▒░▓█  ▀█▓░ ████▓▒░  ▒██▒ ░ '
)
log.info(
  '	░ ░▒ ▒  ░ ▒▒   ▓▒█░░ ░▒ ▒  ░░ ░▒ ▒  ░ ▒▒   ▓▒█░░▒▓███▀▒░ ▒░▒░▒░   ▒ ░░   '
)
log.info(
  '	  ░  ▒     ▒   ▒▒ ░  ░  ▒     ░  ▒     ▒   ▒▒ ░▒░▒   ░   ░ ▒ ▒░     ░    '
)
log.info(
  '	░          ░   ▒   ░        ░          ░   ▒    ░    ░ ░ ░ ░ ▒    ░      '
)
log.info(
  '	░ ░            ░  ░░ ░      ░ ░            ░  ░ ░          ░ ░           '
)
log.info(
  '	░                  ░        ░                        ░                   '
)
log.info('')

log.info(
  `Loaded the following configuration for environment ${process.env.ENVIRONMENT}`
)
log.info(config)

server.register(require('@fastify/swagger'), {
  swagger: {
    info: {
      title: 'CaccaBOT API',
      description: 'CaccaBOT API Documentation',
      version
    },
    host: `caccabot.duckdns.org`,
    schemes: ['https'],
    consumes: ['application/json'],
    produces: ['application/json']
  }
})

server.register(require('@fastify/swagger-ui'), {
  routePrefix: '/docs',
  uiConfig: {
    deepLinking: false,
    syntaxHighlight: {
      activate: true,
      theme: 'nord'
    }
  },
  uiHooks: {
    onRequest: function (
      request: FastifyRequest,
      reply: FastifyReply,
      next: () => void
    ) {
      next()
    },
    preHandler: function (
      request: FastifyRequest,
      reply: FastifyReply,
      next: () => void
    ) {
      next()
    }
  }
})

server.register(import('@fastify/autoload'), {
  dir: `${__dirname}/api`,
  dirNameRoutePrefix: true,
  options: { prefix: '/api' }
})

server.addHook('onRoute', (routeOptions: { url: string; method: string }) => {
  if (routeOptions.url.startsWith('/api') && routeOptions.method != 'HEAD') {
    log.info(`[ENDPOINT] ${routeOptions.method} ${routeOptions.url}`)
  }
})

server.register(import('@fastify/compress'))

server.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/public'
})

server.register(fastifyStatic, {
  root: path.join(__dirname, '/public/client'),
  prefix: '/',
  decorateReply: false
})

server.register(fastifyStatic, {
  root: path.join(__dirname, '/public/client/assets'),
  prefix: '/assets/',
  decorateReply: false
})

server.register(fastifyStatic, {
  root: path.join(__dirname, '/public/collectibles'),
  prefix: '/collectibles/',
  decorateReply: false,
  maxAge: '1d',
  immutable: true
})

server.register(fastifyStatic, {
  root: path.join(__dirname, '/public/pfp'),
  prefix: '/pfp/',
  decorateReply: false
})

server.register(import('@fastify/cors'), {
  origin: '*'
})

server.register(import('@ericedouard/fastify-socket.io'), {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
})

server.addHook(
  'onRequest',
  (req: FastifyRequest, res: FastifyReply, done: () => void) => {
    if (!req.headers['x-auth-token']) {
      log.info(`${req.method} | ${req.url}`)
    }
    done()
  }
)

server.decorate('NotFound', (req: FastifyRequest, res: FastifyReply) => {
  if (req.url.toLowerCase().startsWith('/api')) {
    res.code(404).send({ error: 'This endpoint does not exist' })
    return
  }

  const stream = fs.createReadStream(`${__dirname}/public/client/index.html`)
  res.type('text/html').send(stream)
})

server.setNotFoundHandler(server.NotFound)

async function initJobs() {
  const jobsDir = fs
    .readdirSync(`${path.resolve('./jobs')}`)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))

  for (const jobFile of jobsDir) {
    const job = await import(`${path.resolve('./jobs')}/${jobFile}`)
    schedule.scheduleJob(
      { rule: job.default.interval, tz: config.timezone },
      job.default.execute
    )
    log.info(`[JOB] ${job.default.interval} => ${job.default.name}`)
  }
}

function initListeners() {
  const listenersDir = fs
    .readdirSync(`${path.resolve('./middleware/listeners')}`)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))

  for (const listenerFile of listenersDir) {
    import(`${path.resolve('./middleware/listeners')}/${listenerFile}`)
      .then(() => {
        log.info(`[LISTENER] ${listenerFile} loaded`)
      })
      .catch((err) => {
        log.error(`[LISTENER] Failed to load ${listenerFile}:`, err)
      })
  }
}

server.listen(
  { host: '0.0.0.0', port: process.env.SERVER_PORT ?? 3000 },
  async (err: any, address: string) => {
    if (err) {
      log.error(err)
      process.exit(1)
    }

    initDatabase()
    await initJobs()
    initListeners()

    if (config.discordModuleEnabled) {
      await client.login(process.env.DISCORD_BOT_TOKEN)
    }

    log.info('[WEBSERVER] Ready on ' + address)
  }
)
