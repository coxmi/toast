import crypto from 'crypto'
import fs from 'fs-extra'


export function sha1(string: string): string {
    return crypto.createHash('sha1').update(string).digest("hex")
}


export async function filehash(path: string): Promise<string|null> {
    try {
        const contents = await fs.readFile(path, 'utf8')
        return sha1(contents)
    } catch(error) {
        return null
    }
}

export function filehashSync(path: string): string|null {
    try {
        const contents = fs.readFileSync(path, 'utf8')
        return sha1(contents)
    } catch(error) {
        return null
    }
}

export function fileExists(path: string): boolean {
    try {
        const stats = fs.statSync(path)
        return stats.isFile()
    } catch {
        return false
    }    
}


export function leading(base: string, start: string): string {
    return base.startsWith(start) ? base : `${base}${start}`
}


export function trailing(base: string, end: string): string {
    return base.endsWith(end) ? base : `${base}${end}`
}


export function regexes(segments: Array<RegExp|string>, flags?: string) {
    return new RegExp(
        segments.map(segment => {
            if (segment instanceof RegExp) return segment.source
            return segment.toString()
        }).join(''),
        flags
    )
}


export function isIterable(x) {  
    return x && isFunction(x[Symbol.iterator])
}


export function isArray(x) {
    return Array.isArray(x)
}


export function isFunction(x) {
    return !!(x && x.constructor && x.call && x.apply)
}


export function chunkArray(array: [], n: number) {
    return Array.from(Array(Math.ceil(array.length/n)), (_,i) => array.slice(i*n, i*n+n))
}