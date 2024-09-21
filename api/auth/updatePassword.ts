import { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from "fastify"

import { updatePassword } from '../../database/index'
import { authenticate } from '../../middleware/auth'

interface UpdatePasswordBody {
	username: string;
	password: string;
}

const updatePasswordEndpoint = async function (server: FastifyInstance, options: RouteOptions) {
	server.patch('/password', async (req: FastifyRequest<{Body: UpdatePasswordBody}>, res: FastifyReply) => {
		const user = await authenticate(req, res)
		const { password } = req.body
		if (!password || password.length < 3) {
			res.code(403).send({ error: 'Invalid password' })
		}
		updatePassword(user.id, password)
	})
}

export default updatePasswordEndpoint;