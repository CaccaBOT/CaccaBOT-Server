const server = require('fastify')()
const { client } = require('./whatsapp/index')
const dotenv = require('dotenv')
const config = require('./config.json')
dotenv.config()

server.register(require('@fastify/swagger'), {
	swagger: {
		info: {
			title: 'CaccaBOT API',
			description: 'CaccaBOT API Documentation',
			version: config.version,
		},
		host: `caccabot.duckdns.org`,
		schemes: ['https'],
		consumes: ['application/json'],
		produces: ['application/json'],
	},
})

server.register(require('@fastify/swagger-ui'), {
	routePrefix: '/docs',
	uiConfig: {
		deepLinking: false,
		syntaxHighlight: {
			activate: true,
			theme: 'nord',
		},
	},
	uiHooks: {
		onRequest: function (request, reply, next) {
			next()
		},
		preHandler: function (request, reply, next) {
			next()
		},
	},
})

server.register(require('@fastify/autoload'), {
	dir: `${__dirname}/api`,
	dirNameRoutePrefix: true,
	options: { prefix: '/api' },
})

server.register(require('@fastify/cors'), {
	origin: '*',
})

server.decorate('NotFound', (req, res) => {
	if (req.url.toLowerCase().startsWith('/api')) {
		res.code(404).send({ error: 'This endpoint does not exist' })
	}
	res.redirect(`${config.frontendUrl}${req.url}`)
})

server.setNotFoundHandler(server.NotFound)

//client.initialize()

server.listen(
	{ host: '0.0.0.0', port: process.env.SERVER_PORT ?? 3000 },
	async (err, address) => {
		if (err) {
			console.error(err)
			process.exit(1)
		}
		console.log('[READY] CaccaBOT on ' + address)
	},
)
