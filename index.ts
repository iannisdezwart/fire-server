import * as http from 'http'
import { readSettings } from './settings'
import sendFileOrDirectory from './send-file-or-directory'

const PORT = +process.argv[2] | 3000

readSettings()

const server = http.createServer((req, res) => {
	sendFileOrDirectory(req, res)
})

server.listen(PORT, () => console.log(`Server running at port ${ PORT }`))