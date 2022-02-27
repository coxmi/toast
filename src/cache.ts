
import findCacheDir from 'find-cache-dir'
import path from 'path'
import fs from 'fs-extra'
import { sha1 } from './util.js'


export default (subdirectory: string = '') => {
	 
	const cacheDir = path.join(findCacheDir(), subdirectory)

	async function set(key:string, contents:any): Promise<void> {
		const filePath = path.join(cacheDir, `${sha1(key)}.json`)
		const test = await fs.ensureDir(cacheDir)
		await fs.outputJson(filePath, contents)
	}

	async function get(key:string): Promise<string|null> {
		const filePath = path.join(cacheDir, `${sha1(key)}.json`)
		try {
			return await fs.readJson(filePath)	
		} catch (e) {
			if (e.code === 'ENOENT') {
				return null
			}
		}
	}

	async function clear(): Promise<void> {
		await fs.remove(cacheDir)
	}

	return { set, get, clear }
}
