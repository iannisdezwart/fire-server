import * as http from 'http'
import * as fs from 'fs'
import * as mime from 'mime-types'
import { pathIsSafe } from '@iannisz/node-api-kit'
import { settings } from './settings'

/**
 * Sends a file to a client.
 *
 * Supports range requests
 * (https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests).
 * @param req The request object.
 * @param res The response object.
 * @param path The path of the file to send.
 */
const sendFile = (
	req: http.IncomingMessage,
	res: http.ServerResponse,
	path: string
) => {
	// Get file stats

	const stats = fs.statSync(path)

	// Get file mime type

	const mimeLookup = mime.lookup(path)
	const mimeType = mimeLookup == false ? 'text/plain' : mimeLookup

	// Range header variables

	const range = req.headers.range
	let start = 0
	let end = stats.size - 1

	// If the range header is set, extract the start and end positions.

	if (range != null) {
		const [ reqStart, reqEnd ] = range
			.replace(/bytes=/, '')
			.split('-')
			.map(el => +el)

		start = isNaN(reqStart) ? 0 : reqStart
		end = isNaN(reqEnd) ? stats.size - 1 : reqEnd
	}

	// I've seen browsers that set the start or end to -1,
	// to check if the server supports ranged requests.
	// We'll just set them to 0.

	if (start < 0) start = 0
	if (end < 0) end = 0

	// Handle ranged requests

	if (range != null) {
		// If the range is invalid, send a
		// 416 Range Not Satisfiable status code.

		if (start >= stats.size || end >= stats.size) {
			res.writeHead(416, {
				'Content-Range': `bytes */${ stats.size }`
			})

			res.write('Range Not Satisfiable')
			res.end()

			return
		}

		// The range is valid, send a 206 Partial Content status code.

		res.statusCode = 206
		res.setHeader('Content-Range', `bytes ${ start }-${ end }/${ stats.size }`)
		res.setHeader('Accept-Ranges', `bytes`)
		res.setHeader('Content-Type', mimeType)
		res.setHeader('Content-Length', end - start + 1)

		return
	}

	// Handle non-ranged requests

	res.setHeader('Content-Type', mimeType)
	res.setHeader('Content-Length', stats.size)

	// Stream the file to the client

	const stream = fs.createReadStream(path, { start, end })
	stream.pipe(res)
}

const sendDirectory = (
	req: http.IncomingMessage,
	res: http.ServerResponse,
	path: string,
	url: URL
) => {
	const files = fs.readdirSync(path)

	const filesAndDirectories = files
		.map(file => ({
			name: file,
			isDirectory: fs.statSync(`${ path }/${ file }`).isDirectory()
		}))
		.map(file => {
			if (file.isDirectory) {
				return /* html */ `
				<li>
					<a href="${ url.pathname }${ file.name }/">${ file.name }/</a>
				</li>
				`
			}
			else {
				return /* html */ `
				<li>
					<a href="${ url.pathname }${ file.name }">${ file.name }</a>
				</li>
				`
			}
		})

	const html = /* html */ `
	<!DOCTYPE html>
	<html>
		<head>
			<title>Directory listing for ${ url.pathname }</title>
		</head>
		<body>
			<h1>Directory listing for ${ url.pathname }</h1>
			<ul>
				${ filesAndDirectories.join('') }
			</ul>
		</body>
	</html>
	`

	res.setHeader('Content-Type', 'text/html')
	res.end(html)
}

/**
 * Handles a request to a file or directory.
 * @param req The request object.
 * @param res The response object.
 */
const sendFileOrDirectory = (
	req: http.IncomingMessage,
	res: http.ServerResponse
) => {
	const url = new URL(req.url, 'http://localhost')
	const path = `${ settings.publicDir }${ url.pathname }`

	if (!pathIsSafe(path, settings.publicDir)) {
		res.statusCode = 403
		res.end('Forbidden')
		return
	}

	if (!fs.existsSync(path)) {
		res.statusCode = 404
		res.end('Not found')
		return
	}

	if (fs.statSync(path).isDirectory()) {
		sendDirectory(req, res, path, url)
		return
	}

	sendFile(req, res, path)
}

export default sendFileOrDirectory