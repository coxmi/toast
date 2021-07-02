
import findCacheDir from 'find-cache-dir'
import path from 'path'
import fs from 'fs-extra'
import crypto from 'crypto'


export const md5 = (string: string) => crypto.createHash('md5').update(string).digest("hex")
export const sha1 = (string: string) => crypto.createHash('sha1').update(string).digest("hex")


export default (subdirectory: string = '') => {
	
	const cacheDir = path.join(findCacheDir(), subdirectory)

	async function set(key:string, contents:any): Promise<void> {
		const filePath = path.join(cacheDir, `${md5(key)}.json`)
		const test = await fs.ensureDir(cacheDir)
		await fs.outputJson(filePath, contents)
	}

	async function get(key:string): Promise<any> {
		const filePath = path.join(cacheDir, `${md5(key)}.json`)
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
