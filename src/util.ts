

export function regexes(segments: Array<RegExp|string>, flags?: string) {
    return new RegExp(
        segments.map(segment => {
            if (segment instanceof RegExp) return segment.source
            return segment.toString()
        }).join(''),
        flags
    )
}


export function curry(func) {
    return function curried(...args) {
        if (args.length >= func.length) {
            return func.apply(this, args)
        } else {
            return function(...args2) {
                return curried.apply(this, args.concat(args2))
            }
        }
    }
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

export const chunkArray = (array: [], n: number) => {
    return Array.from(Array(Math.ceil(array.length/n)), (_,i) => array.slice(i*n, i*n+n))
}