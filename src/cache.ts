
import findCacheDir from 'find-cache-dir'
import path from 'path'
import fs from 'fs-extra'
import { sha1 } from './util.js'


export type CacheType = { 
	set: (key: string, contents: any) => Promise<void>, 
	get: (key: string) => Promise<any>,
	getSync: (key: string) => any,
	clear: () => Promise<void>
}

export const createCache = (subdirectory: string = ''): CacheType => {
	 
	const cacheDir = path.join(findCacheDir({ name :subdirectory }))

	async function set(key:string, contents:any): Promise<void> {
		const filePath = path.join(cacheDir, `${sha1(key)}.json`)
		const test = await fs.ensureDir(cacheDir)
		return await fs.outputJson(filePath, contents)
	}

	function getSync(key:string): any {
		const filePath = path.join(cacheDir, `${sha1(key)}.json`)
		return fs.readJsonSync(filePath, { throws: false })
	}

	async function get(key:string): Promise<any> {
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

	return { set, get, getSync, clear }
}
