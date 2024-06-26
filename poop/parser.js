const cases = ['cacca++', 'cacca+=1', '++cacca', 'cacca=cacca+1']

function detectPoop(message) {
	if (message && message.content) {
		if (cases.includes(message.content.toLowerCase().replaceAll(' ', ''))) {
			return message.sender
		}
	}

	return null
}

module.exports = { detectPoop }
