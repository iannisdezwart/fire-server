import * as fs from 'fs'

interface Settings {
	publicDir: string
}

export let settings: Settings

export const readSettings = () => {
	const settingsFile = fs.readFileSync('settings.json', 'utf8')
	settings = JSON.parse(settingsFile) as Settings

	if (settings.publicDir == null) {
		throw new Error('"publicDir" setting is not set')
	}
}