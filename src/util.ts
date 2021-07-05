

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